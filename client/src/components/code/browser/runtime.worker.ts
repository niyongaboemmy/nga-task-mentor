/**
 * The in-browser code runner (CODE_RUNNER_PLAN.md phase 6, tier T0): Python
 * (Pyodide), JavaScript (a small Node.js shim) and SQL (sql.js). One program
 * at a time; the page terminates this worker when a run takes too long.
 * Runtimes load from the CDN on first use and stay warm. A module worker
 * (Vite serves workers as ES modules in development).
 */
import { runNode, Unsupported } from "./nodeShim";
import { formatBox } from "./sqlFormat";
import type { Runtime, WorkerRequest, WorkerResponse } from "./protocol";

const ctx = self as unknown as {
  postMessage: (m: WorkerResponse) => void;
  onmessage: ((ev: MessageEvent<WorkerRequest>) => void) | null;
  initSqlJs?: (o: { locateFile: (f: string) => string }) => Promise<SqlJs>;
};

const PYODIDE_URL = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/";
const SQLJS_URL = "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/";

interface Pyodide {
  FS: { mkdirTree: (p: string) => void; writeFile: (p: string, d: string) => void; analyzePath: (p: string) => { exists: boolean } };
  setStdin: (o: { stdin: () => string | null | undefined }) => void;
  setStdout: (o: { write: (b: Uint8Array) => number }) => void;
  setStderr: (o: { write: (b: Uint8Array) => number }) => void;
  loadPackagesFromImports: (code: string) => Promise<void>;
  runPythonAsync: (code: string) => Promise<unknown>;
  globals: { set: (k: string, v: unknown) => void };
}
interface SqlJs {
  Database: new () => { exec: (sql: string) => { columns: string[]; values: unknown[][] }[]; close: () => void };
}


let pyodide: Promise<Pyodide> | null = null;
let sqljs: Promise<SqlJs> | null = null;

function loadPython() {
  pyodide ??= (async () => {
    const mod = (await import(/* @vite-ignore */ `${PYODIDE_URL}pyodide.mjs`)) as { loadPyodide: (o: { indexURL: string }) => Promise<Pyodide> };
    return mod.loadPyodide({ indexURL: PYODIDE_URL });
  })();
  pyodide.catch(() => (pyodide = null));
  return pyodide;
}
function loadSql() {
  sqljs ??= (async () => {
    // sql.js ships as a classic script; run it in the worker's global scope.
    const res = await fetch(`${SQLJS_URL}sql-wasm.js`);
    if (!res.ok) throw new Error(`sql.js: HTTP ${res.status}`);
    (0, eval)(await res.text());
    return ctx.initSqlJs!({ locateFile: (f) => `${SQLJS_URL}${f}` });
  })();
  sqljs.catch(() => (sqljs = null));
  return sqljs;
}
const load = (r: Runtime) => (r === "python" ? loadPython() : r === "sql" ? loadSql() : Promise.resolve(null));

let runCount = 0;
async function runPython(files: Record<string, string>, entry: string, stdin: string) {
  const py = await loadPython();
  const dec = new TextDecoder();
  let stdout = "";
  let stderr = "";
  let given = stdin === "";
  py.setStdin({ stdin: () => (given ? null : ((given = true), stdin)) });
  py.setStdout({ write: (b) => ((stdout += dec.decode(b, { stream: true })), b.length) });
  py.setStderr({ write: (b) => ((stderr += dec.decode(b, { stream: true })), b.length) });
  // A fresh folder per run, so earlier files and imports don't linger.
  const dir = `/home/pyodide/run${++runCount}`;
  for (const [path, content] of Object.entries(files)) {
    const full = `${dir}/${path}`;
    py.FS.mkdirTree(full.slice(0, full.lastIndexOf("/")));
    py.FS.writeFile(full, content);
  }
  const code = Object.entries(files)
    .filter(([p]) => p.endsWith(".py"))
    .map(([, c]) => c)
    .join("\n");
  try {
    await py.loadPackagesFromImports(code);
  } catch {
    // An unknown import fails below with Python's own error.
  }
  py.globals.set("__nga_dir", dir);
  py.globals.set("__nga_entry", entry);
  const exit = (await py.runPythonAsync(`
import os, sys, runpy, traceback
for _m in [m for m, v in list(sys.modules.items()) if (getattr(v, "__file__", None) or "").startswith("/home/pyodide/run")]:
    del sys.modules[_m]
os.chdir(__nga_dir)
sys.path[:] = [p for p in sys.path if not p.startswith("/home/pyodide/run")]
sys.path.insert(0, os.path.dirname(os.path.join(__nga_dir, __nga_entry)))
sys.argv = [__nga_entry]
__nga_code = 0
try:
    runpy.run_path(os.path.join(__nga_dir, __nga_entry), run_name="__main__")
except SystemExit as e:
    __nga_code = e.code if isinstance(e.code, int) else (0 if e.code is None else (print(e.code, file=sys.stderr) or 1))
except BaseException:
    _t, _v, _tb = sys.exc_info()
    _frames = [f for f in traceback.extract_tb(_tb) if f.filename.startswith(__nga_dir)]
    print("Traceback (most recent call last):", file=sys.stderr)
    for _f in _frames:
        print(f'  File "{os.path.relpath(_f.filename, __nga_dir)}", line {_f.lineno}, in {_f.name}', file=sys.stderr)
        if _f.line:
            print(f"    {_f.line}", file=sys.stderr)
    print("".join(traceback.format_exception_only(_t, _v)).replace(__nga_dir + "/", ""), end="", file=sys.stderr)
    __nga_code = 1
sys.stdout.flush(); sys.stderr.flush()
__nga_code
`)) as number;
  return { stdout, stderr, exit_code: Number(exit) || 0 };
}

async function runSql(files: Record<string, string>, entry: string) {
  const SQL = await loadSql();
  const db = new SQL.Database();
  let stdout = "";
  try {
    for (const setup of ["schema.sql", "seed.sql"]) if (setup !== entry && files[setup] != null) db.exec(files[setup]!);
    for (const r of db.exec(files[entry] ?? "")) stdout += formatBox(r);
    return { stdout, stderr: "", exit_code: 0 };
  } catch (e) {
    return { stdout, stderr: `Error: ${(e as Error).message}\n`, exit_code: 1 };
  } finally {
    db.close();
  }
}

ctx.onmessage = async (ev: MessageEvent<WorkerRequest>) => {
  const req = ev.data;
  const reply = (r: WorkerResponse) => ctx.postMessage(r);
  try {
    await load(req.runtime);
  } catch (e) {
    return reply({ id: req.id, ok: false, reason: "unavailable", message: String((e as Error)?.message ?? e) });
  }
  if (req.type === "load") return reply({ id: req.id, ok: true, loaded: true });
  const t0 = performance.now();
  try {
    const r =
      req.runtime === "python"
        ? await runPython(req.files, req.entry, req.stdin)
        : req.runtime === "sql"
          ? await runSql(req.files, req.entry)
          : await runNode({ ...req.files }, req.entry, req.stdin);
    reply({ id: req.id, ok: true, ...r, time_ms: performance.now() - t0 });
  } catch (e) {
    reply({ id: req.id, ok: false, reason: e instanceof Unsupported ? "unsupported" : "unavailable", message: String((e as Error)?.message ?? e) });
  }
};

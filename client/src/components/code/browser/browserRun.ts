import type { CodeFile, PracticeRunResult, RunTestResult, RunVerdict } from "../../../services/codeApi";
import type { Runtime, WorkerRequest, WorkerResponse } from "./protocol";

/**
 * Practice runs in the student's browser (CODE_RUNNER_PLAN.md phase 6):
 * instant, no queue, no server quota. Only for simple programs — one Python
 * program without requirements, a plain Node.js script, or SQL — and never
 * for grading, which always runs on the server. When the browser can't run
 * it (offline, an npm package, a blocked CDN), the caller runs it on the
 * server instead (`BrowserCantRun`).
 */

export class BrowserCantRun extends Error {}

/** Time for one run; the first Python or SQL run also loads the runtime. */
const RUN_LIMIT_MS = 10_000;
const LOAD_LIMIT_MS = 90_000;

const has = (files: CodeFile[], re: RegExp) => files.some((f) => re.test(f.path));

/** Which in-browser runtime fits these files, if any. */
export function browserRuntime(files: CodeFile[], language: string | null | undefined, entry: string | null | undefined): Runtime | null {
  if (typeof Worker === "undefined") return null;
  try {
    // An escape hatch (and what the server-run e2e tests use).
    if (localStorage.getItem("tm.code.browserRuns") === "off") return null;
  } catch {
    // storage blocked: browser runs stay on
  }
  const main = entry ?? "";
  const lang = (language ?? "").toLowerCase();
  if (lang === "sql" || main.endsWith(".sql")) return has(files, /\.sql$/) ? "sql" : null;
  if (lang.startsWith("python") || main.endsWith(".py")) {
    // Projects with dependencies or a framework need the server.
    if (has(files, /(^|\/)(requirements\.txt|pyproject\.toml|setup\.py|manage\.py|Pipfile)$/)) return null;
    return has(files, /\.py$/) ? "python" : null;
  }
  if (lang === "javascript" || /\.(c?js)$/.test(main)) {
    if (has(files, /(^|\/)package\.json$/) || has(files, /\.(ts|tsx|jsx|mjs|vue|svelte)$/)) return null;
    // ES modules (import/export) run on the server.
    if (files.some((f) => /\.c?js$/.test(f.path) && /^\s*(import\s[\w{*]|import\s*["']|export\s)/m.test(f.content))) return null;
    return has(files, /\.c?js$/) ? "javascript" : null;
  }
  return null;
}

/** The file to run: the tests' entry, or the usual main file. */
export function browserEntry(runtime: Runtime, files: CodeFile[], entry: string | null | undefined): string | null {
  const paths = files.map((f) => f.path);
  if (entry && paths.includes(entry)) return entry;
  const prefer = runtime === "python" ? ["main.py", "app.py", "solution.py"] : runtime === "sql" ? ["main.sql", "queries.sql", "query.sql"] : ["main.js", "index.js", "src/main.js", "src/index.js"];
  const ext = runtime === "python" ? ".py" : runtime === "sql" ? ".sql" : ".js";
  return prefer.find((p) => paths.includes(p)) ?? paths.find((p) => p.endsWith(ext) && !/^(schema|seed)\.sql$/.test(p) && !/(^|\/)test_|_test\.py$|\.test\.js$/.test(p)) ?? null;
}

let worker: Worker | null = null;
let seq = 0;
const loaded = new Set<Runtime>();

function spawn() {
  worker = new Worker(new URL("./runtime.worker.ts", import.meta.url), { type: "module" });
  loaded.clear();
  return worker;
}

/** Sends one request; on time-out the worker is thrown away (that stops endless loops). */
type Request = WorkerRequest extends infer R ? (R extends WorkerRequest ? Omit<R, "id"> : never) : never;
function call(req: Request, limitMs: number): Promise<WorkerResponse | "timeout"> {
  const w = worker ?? spawn();
  const id = ++seq;
  return new Promise((resolve) => {
    const done = (r: WorkerResponse | "timeout") => {
      clearTimeout(timer);
      w.removeEventListener("message", onMessage);
      w.removeEventListener("error", onError);
      resolve(r);
    };
    const onMessage = (e: MessageEvent<WorkerResponse>) => e.data.id === id && done(e.data);
    const onError = (e: ErrorEvent) => {
      e.preventDefault();
      w.terminate();
      worker = null;
      done({ id, ok: false, reason: "unavailable", message: e.message || "The browser runner stopped." });
    };
    const timer = setTimeout(() => {
      w.terminate();
      worker = null;
      done("timeout");
    }, limitMs);
    w.addEventListener("message", onMessage);
    w.addEventListener("error", onError);
    w.postMessage({ ...req, id });
  });
}

const normalize = (s: string | null | undefined) => (s ?? "").replace(/\r\n/g, "\n").trimEnd();

export async function runInBrowser(
  body: { files: CodeFile[]; language?: string | null; entry?: string | null; tests: { id: string; input: string; expected_output?: string | null }[] },
  onStatus?: (note: string | null) => void,
): Promise<PracticeRunResult> {
  const runtime = browserRuntime(body.files, body.language, body.entry);
  const entry = runtime && browserEntry(runtime, body.files, body.entry);
  if (!runtime || !entry) throw new BrowserCantRun("This program needs the server.");

  if (runtime !== "javascript" && !loaded.has(runtime)) {
    onStatus?.(runtime === "python" ? "Loading Python in your browser (first run only)…" : "Loading SQLite in your browser (first run only)…");
    const r = await call({ type: "load", runtime }, LOAD_LIMIT_MS);
    onStatus?.(null);
    if (r === "timeout" || !r.ok) throw new BrowserCantRun("The in-browser runtime couldn't load.");
    loaded.add(runtime);
  }

  const files = Object.fromEntries(body.files.map((f) => [f.path, f.content]));
  const tests: RunTestResult[] = [];
  for (const t of body.tests) {
    const r = await call({ type: "run", runtime, files, entry, stdin: t.input ?? "" }, RUN_LIMIT_MS);
    if (r !== "timeout" && !r.ok) throw new BrowserCantRun(r.message);
    if (r === "timeout") {
      tests.push({ id: t.id, verdict: "time-limit", passed: t.expected_output == null ? null : false, stdout: null, stderr: `Stopped after ${RUN_LIMIT_MS / 1000} s.`, exit_code: null, time_ms: RUN_LIMIT_MS, memory_kb: null });
      continue;
    }
    if (!("stdout" in r)) continue;
    const crashed = r.exit_code !== 0;
    const verdict: RunVerdict = crashed ? "runtime-error" : t.expected_output == null ? "ok" : normalize(r.stdout) === normalize(t.expected_output) ? "accepted" : "wrong-answer";
    tests.push({
      id: t.id,
      verdict,
      passed: t.expected_output == null ? null : verdict === "accepted",
      stdout: r.stdout,
      stderr: r.stderr || null,
      exit_code: r.exit_code,
      time_ms: r.time_ms,
      memory_kb: null,
    });
  }
  return { engine: "browser", language: runtime, entry, files_sent: Object.keys(files), compile: null, tests };
}

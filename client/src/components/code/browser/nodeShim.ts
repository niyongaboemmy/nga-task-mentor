/**
 * Just enough of Node.js for single-file JavaScript exercises in a worker:
 * console, process.stdout/stdin/exit, fs.readFileSync(0) for stdin,
 * readline (on "line"/"close", question, async iteration), path, util and
 * events. Anything else (npm packages, servers) is "unsupported": the
 * workspace then runs the program on the server instead.
 */

export class Unsupported extends Error {}
export class ExitSignal {
  code: number;
  constructor(code: number) {
    this.code = code;
  }
}

type Listener = (...args: unknown[]) => void;
export class Emitter {
  private ls = new Map<string, Listener[]>();
  on(e: string, f: Listener) {
    this.ls.set(e, [...(this.ls.get(e) ?? []), f]);
    return this;
  }
  addListener(e: string, f: Listener) {
    return this.on(e, f);
  }
  once(e: string, f: Listener) {
    const w: Listener = (...a) => {
      this.off(e, w);
      f(...a);
    };
    return this.on(e, w);
  }
  off(e: string, f: Listener) {
    this.ls.set(e, (this.ls.get(e) ?? []).filter((x) => x !== f));
    return this;
  }
  removeListener(e: string, f: Listener) {
    return this.off(e, f);
  }
  emit(e: string, ...a: unknown[]) {
    const fs = this.ls.get(e) ?? [];
    fs.forEach((f) => f(...a));
    return fs.length > 0;
  }
  listenerCount(e: string) {
    return (this.ls.get(e) ?? []).length;
  }
}

/** Node's util.inspect for the values students usually print. */
export function inspect(v: unknown, depth = 0, top = true): string {
  if (typeof v === "string") return top ? v : `'${v.replace(/'/g, "\\'")}'`;
  if (v === null) return "null";
  if (v === undefined) return "undefined";
  if (typeof v === "number") return Object.is(v, -0) ? "-0" : String(v);
  if (typeof v === "bigint") return `${v}n`;
  if (typeof v === "boolean" || typeof v === "symbol") return String(v);
  if (typeof v === "function") return `[Function: ${v.name || "(anonymous)"}]`;
  if (v instanceof Error) return v.stack || `${v.name}: ${v.message}`;
  if (depth > 2) return Array.isArray(v) ? "[Array]" : "[Object]";
  if (Array.isArray(v)) return v.length ? `[ ${v.map((x) => inspect(x, depth + 1, false)).join(", ")} ]` : "[]";
  if (v instanceof Map) return `Map(${v.size}) {${v.size ? ` ${[...v].map(([k, x]) => `${inspect(k, depth + 1, false)} => ${inspect(x, depth + 1, false)}`).join(", ")} ` : ""}}`;
  if (v instanceof Set) return `Set(${v.size}) {${v.size ? ` ${[...v].map((x) => inspect(x, depth + 1, false)).join(", ")} ` : ""}}`;
  const entries = Object.entries(v as object);
  const name = (v as object).constructor && (v as object).constructor !== Object ? `${(v as object).constructor.name} ` : "";
  if (!entries.length) return `${name}{}`;
  const key = (k: string) => (/^[A-Za-z_$][\w$]*$/.test(k) ? k : `'${k}'`);
  return `${name}{ ${entries.map(([k, x]) => `${key(k)}: ${inspect(x, depth + 1, false)}`).join(", ")} }`;
}

/** console.log's formatting: %s %d %i %f %j %o placeholders, then the rest. */
export function format(args: unknown[]): string {
  if (typeof args[0] === "string" && /%[sdifjoO%]/.test(args[0])) {
    let i = 1;
    const head = (args[0] as string).replace(/%([sdifjoO%])/g, (m, f) => {
      if (f === "%") return "%";
      if (i >= args.length) return m;
      const a = args[i++];
      if (f === "s") return typeof a === "string" ? a : inspect(a, 0, false);
      if (f === "d" || f === "i") return String(f === "i" ? parseInt(String(a), 10) : Number(a));
      if (f === "f") return String(parseFloat(String(a)));
      if (f === "j") return JSON.stringify(a);
      return inspect(a, 0, false);
    });
    return [head, ...args.slice(i).map((a) => inspect(a))].join(" ");
  }
  return args.map((a) => inspect(a)).join(" ");
}

const norm = (p: string) => {
  const out: string[] = [];
  for (const part of p.replace(/\\/g, "/").split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") out.pop();
    else out.push(part);
  }
  return out.join("/");
};
const dirname = (p: string) => (p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : ".");

export interface JsRunResult {
  stdout: string;
  stderr: string;
  exit_code: number;
}

/** Runs a CommonJS program; resolves when it has nothing left to do. */
export async function runNode(files: Record<string, string>, entry: string, stdin: string): Promise<JsRunResult> {
  let stdout = "";
  let stderr = "";
  const out = (s: string) => (stdout += s);
  const err = (s: string) => (stderr += s);

  // Timers are counted, so we know when the program is finished.
  let timers = 0;
  const live = new Set<number>();
  const sT = self.setTimeout.bind(self);
  const cT = self.clearTimeout.bind(self);
  const fail = { error: null as unknown };
  const guard =
    (f: (...a: unknown[]) => void) =>
    (...a: unknown[]) => {
      try {
        f(...a);
      } catch (e) {
        fail.error = e;
      }
    };
  const setTimeoutShim = (f: (...a: unknown[]) => void, ms?: number, ...a: unknown[]) => {
    timers++;
    const id = sT(() => {
      live.delete(id);
      timers--;
      guard(f)(...a);
    }, ms);
    live.add(id);
    return id;
  };
  const clearTimeoutShim = (id: number) => {
    if (live.delete(id)) {
      timers--;
      cT(id);
    }
  };
  const intervals = new Set<number>();
  const setIntervalShim = (f: (...a: unknown[]) => void, ms?: number, ...a: unknown[]) => {
    const id = self.setInterval(guard(f), ms, ...a) as unknown as number;
    intervals.add(id);
    return id;
  };
  const clearIntervalShim = (id: number) => {
    intervals.delete(id);
    self.clearInterval(id);
  };

  // stdin, as Node gives it: whole (fs.readFileSync(0)), or line by line (readline).
  const stdinStream = new Emitter() as Emitter & { setEncoding: () => void; resume: () => void; pause: () => void; isTTY: boolean };
  stdinStream.setEncoding = () => undefined;
  stdinStream.resume = () => undefined;
  stdinStream.pause = () => undefined;
  stdinStream.isTTY = false;
  let readers = 0;
  const feedStdin = () => {
    readers++;
    sT(() => {
      if (stdin) stdinStream.emit("data", stdin);
      stdinStream.emit("end");
      readers--;
    }, 0);
  };
  const origOn = stdinStream.on.bind(stdinStream);
  let fed = false;
  stdinStream.on = (e: string, f: Listener) => {
    origOn(e, f);
    if ((e === "data" || e === "end" || e === "readable") && !fed) {
      fed = true;
      feedStdin();
    }
    return stdinStream;
  };

  const makeReadline = () => ({
    createInterface() {
      const rl = new Emitter() as Emitter & {
        question: (q: string, cb: (a: string) => void) => void;
        close: () => void;
        setPrompt: (p: string) => void;
        prompt: () => void;
        [Symbol.asyncIterator]: () => AsyncIterator<string>;
      };
      const lines = stdin === "" ? [] : stdin.replace(/\r\n/g, "\n").replace(/\n$/, "").split("\n");
      let closed = false;
      let prompt = "> ";
      const waiting: ((a: string) => void)[] = [];
      const finish = () => {
        if (closed) return;
        closed = true;
        rl.emit("close");
      };
      readers++;
      // Deliver lines after the program's first synchronous pass, like Node.
      const pump = () => {
        if (closed) return void readers--;
        const line = lines.shift();
        if (line === undefined) {
          finish();
          readers--;
          return;
        }
        const q = waiting.shift();
        if (q) q(line);
        else rl.emit("line", line);
        sT(guard(pump), 0);
      };
      sT(guard(pump), 0);
      rl.question = (q, cb) => {
        out(q);
        waiting.push(cb);
      };
      rl.close = finish;
      rl.setPrompt = (p) => (prompt = p);
      rl.prompt = () => out(prompt);
      rl[Symbol.asyncIterator] = () => {
        const buf: string[] = [];
        let done = false;
        let wake: (() => void) | null = null;
        rl.on("line", (l) => {
          buf.push(l as string);
          wake?.();
        });
        rl.on("close", () => {
          done = true;
          wake?.();
        });
        return {
          async next() {
            while (!buf.length && !done) await new Promise<void>((r) => (wake = r));
            return buf.length ? { value: buf.shift()!, done: false } : { value: undefined, done: true };
          },
        };
      };
      return rl;
    },
  });

  const proc = {
    argv: ["node", `/work/${entry}`],
    env: {} as Record<string, string>,
    platform: "linux",
    exitCode: undefined as number | undefined,
    stdout: { write: (s: unknown) => (out(String(s)), true), isTTY: false },
    stderr: { write: (s: unknown) => (err(String(s)), true), isTTY: false },
    stdin: stdinStream,
    exit(code?: number) {
      throw new ExitSignal(code ?? proc.exitCode ?? 0);
    },
    on: () => proc,
    nextTick: (f: (...a: unknown[]) => void, ...a: unknown[]) => queueMicrotask(() => guard(f)(...a)),
    hrtime: Object.assign(() => [0, 0], { bigint: () => BigInt(Math.round(performance.now() * 1e6)) }),
    memoryUsage: () => ({ heapUsed: 0, rss: 0 }),
    cwd: () => "/work",
  };

  const consoleShim = {
    log: (...a: unknown[]) => out(format(a) + "\n"),
    info: (...a: unknown[]) => out(format(a) + "\n"),
    debug: (...a: unknown[]) => out(format(a) + "\n"),
    error: (...a: unknown[]) => err(format(a) + "\n"),
    warn: (...a: unknown[]) => err(format(a) + "\n"),
    table: (d: unknown) => out(inspect(d) + "\n"),
    dir: (d: unknown) => out(inspect(d, 0, false) + "\n"),
  };

  const fs = {
    readFileSync(p: unknown, enc?: unknown) {
      const text = p === 0 || p === "/dev/stdin" ? stdin : files[norm(String(p).replace(/^\/work\//, ""))];
      if (text === undefined) throw Object.assign(new Error(`ENOENT: no such file or directory, open '${String(p)}'`), { code: "ENOENT" });
      return enc ? text : Object.assign(new TextEncoder().encode(text), { toString: () => text });
    },
    existsSync: (p: string) => norm(p.replace(/^\/work\//, "")) in files,
    writeFileSync: (p: string, d: string) => {
      files[norm(p)] = String(d);
    },
  };
  const path = {
    join: (...p: string[]) => norm(p.join("/")),
    resolve: (...p: string[]) => "/work/" + norm(p.join("/")),
    basename: (p: string, ext?: string) => {
      const b = p.split("/").pop() ?? "";
      return ext && b.endsWith(ext) ? b.slice(0, -ext.length) : b;
    },
    dirname,
    extname: (p: string) => (/\.[^./]*$/.exec(p)?.[0] ?? ""),
    sep: "/",
  };
  const builtins: Record<string, unknown> = {
    fs,
    readline: makeReadline(),
    process: proc,
    path,
    util: { format: (...a: unknown[]) => format(a), inspect: (v: unknown) => inspect(v, 0, false) },
    events: Object.assign(Emitter, { EventEmitter: Emitter }),
    assert: Object.assign(
      (c: unknown, m?: string) => {
        if (!c) throw new Error(m ?? "Assertion failed");
      },
      { strictEqual: (a: unknown, b: unknown, m?: string) => { if (a !== b) throw new Error(m ?? `Expected ${inspect(a, 0, false)} to equal ${inspect(b, 0, false)}`); } },
    ),
  };

  const cache = new Map<string, { exports: unknown }>();
  const load = (file: string): unknown => {
    const hit = cache.get(file);
    if (hit) return hit.exports;
    const code = files[file];
    if (code === undefined) throw new Error(`Cannot find module './${file}'`);
    if (file.endsWith(".json")) return JSON.parse(code);
    const module = { exports: {} as unknown };
    cache.set(file, module);
    const require = (name: string) => {
      const bare = name.replace(/^node:/, "");
      if (bare in builtins) return builtins[bare];
      if (!name.startsWith(".") && !name.startsWith("/")) throw new Unsupported(`require("${name}")`);
      const base = norm(`${dirname(file)}/${name}`);
      const found = [base, `${base}.js`, `${base}.cjs`, `${base}.json`, `${base}/index.js`].find((p) => p in files);
      if (!found) throw new Error(`Cannot find module '${name}'`);
      return load(found);
    };
    const fn = new Function(
      "require", "module", "exports", "__filename", "__dirname", "process", "console", "setTimeout", "clearTimeout", "setInterval", "clearInterval", "setImmediate",
      `${code}\n//# sourceURL=${file}`,
    );
    fn(require, module, module.exports, `/work/${file}`, `/work/${dirname(file)}`, proc, consoleShim, setTimeoutShim, clearTimeoutShim, setIntervalShim, clearIntervalShim, (f: () => void) => setTimeoutShim(f, 0));
    return module.exports;
  };

  const errorText = (e: unknown) => (e instanceof Error ? `${e.stack?.includes(e.message) ? e.stack : `${e.name}: ${e.message}`}`.replace(/\n\s+at .*(blob:|worker|new Function|eval).*/g, "") : `Uncaught ${inspect(e, 0, false)}`);
  const finish = (code: number): JsRunResult => {
    intervals.forEach((id) => self.clearInterval(id));
    live.forEach((id) => cT(id));
    return { stdout, stderr, exit_code: code };
  };

  const onRejection = (e: PromiseRejectionEvent) => {
    e.preventDefault();
    fail.error = e.reason;
  };
  self.addEventListener("unhandledrejection", onRejection);
  try {
    load(entry);
    // Wait until no timers, stdin readers or pending promises are left.
    for (;;) {
      if (fail.error) throw fail.error;
      await new Promise((r) => sT(r, 0));
      if (fail.error) throw fail.error;
      if (timers === 0 && readers === 0 && intervals.size === 0) break;
    }
    await new Promise((r) => sT(r, 0));
    if (fail.error) throw fail.error;
    return finish(proc.exitCode ?? 0);
  } catch (e) {
    if (e instanceof ExitSignal) return finish(e.code);
    if (e instanceof Unsupported) throw e;
    err(errorText(e) + "\n");
    return finish(1);
  } finally {
    self.removeEventListener("unhandledrejection", onRejection);
  }
}

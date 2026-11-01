import { getCodeRunner, type RunTest } from "../../services/coderunner";
import type { PromptExample, PromptProblem } from "./learning";

/**
 * Prompt Problems (prompt interpreter report, Q11; Prather et al., CHI 2024): the student sees
 * input → output examples, writes a request in any language, and passes when the code the AI
 * generated from it passes the examples -- the shown ones and the teacher's hidden ones, which
 * never leave Task Mentor (the check reports only how many passed).
 *
 * An example is either a call ("is_even(4)" → "True": the entry's functions are evaluated by a
 * small driver) or a program run ("3\n4" on stdin → "7" on stdout).
 */

const CALL = /^\s*[A-Za-z_$][\w$]*\s*\([\s\S]*\)\s*$/;

const PY_DRIVER = (module: string) => `import sys
sys.path.insert(0, ".")
from ${module} import *  # noqa: F401,F403
expr = sys.stdin.read().strip()
print(repr(eval(expr)))
`;

const JS_DRIVER = (entry: string) => `import * as m from "./${entry}";
let s = "";
for await (const c of process.stdin) s += c;
const scope = { ...(m.default && typeof m.default === "object" ? m.default : {}), ...m };
delete scope.default;
const f = new Function(...Object.keys(scope), "return (" + s.trim() + ");");
const v = await f(...Object.values(scope));
console.log(v === undefined ? "undefined" : JSON.stringify(v));
`;

/** How two results compare: spaces, quote style and JSON spacing don't matter. */
export function sameResult(got: string, expected: string, language: PromptProblem["language"]): boolean {
  const norm = (s: string) => {
    let t = s.trim().replace(/\r\n/g, "\n");
    if (/^"[^"']*"$/.test(t)) t = `'${t.slice(1, -1)}'`;
    if (language === "javascript") {
      try {
        t = JSON.stringify(JSON.parse(t.replace(/^'([^']*)'$/, '"$1"')));
      } catch {
        /* not JSON */
      }
      t = t.replace(/^True$/, "true").replace(/^False$/, "false").replace(/^None$/, "null");
    } else t = t.replace(/^true$/, "True").replace(/^false$/, "False").replace(/^null$/, "None");
    return t.replace(/\s+/g, " ");
  };
  return norm(got) === norm(expected);
}

export interface PromptCheck {
  passed: number;
  total: number;
  shown: { input: string; expected: string; got: string; passed: boolean }[];
  hidden: { passed: number; total: number };
  error: string | null;
}

/** Runs the student's generated code against the examples on the school's code runner. */
export async function checkPromptProblem(p: PromptProblem, code: string): Promise<PromptCheck> {
  const all: (PromptExample & { hidden: boolean })[] = [...p.examples.map((e) => ({ ...e, hidden: false })), ...p.hidden.map((e) => ({ ...e, hidden: true }))];
  const calls = all.filter((e) => CALL.test(e.input));
  const programs = all.filter((e) => !CALL.test(e.input));
  const runner = getCodeRunner();
  const outcomes = new Map<PromptExample, { got: string; ok: boolean }>();
  let error: string | null = null;
  const run = async (examples: typeof all, driver: boolean) => {
    if (!examples.length) return;
    const module = p.entry.replace(/\.[^.]+$/, "");
    const driverFile = p.language === "python" ? "_tmcode_check.py" : "_tmcode_check.mjs";
    const files = [{ path: p.entry, content: code }, ...(driver ? [{ path: driverFile, content: p.language === "python" ? PY_DRIVER(module) : JS_DRIVER(p.entry) }] : [])];
    const tests: RunTest[] = examples.map((e, i) => ({ id: `ex${i}`, input: e.input, expected_output: e.output }));
    const r = await runner.run({ language: p.language, files, entry: driver ? driverFile : p.entry, tests, limits: { time_s: 3, wall_s: 8, memory_mb: 256 } } as never);
    if (r.compile && !r.compile.ok) error = r.compile.output.slice(0, 2000);
    if (r.error) error = r.error.message;
    examples.forEach((e, i) => {
      const t = r.tests.find((x) => x.id === `ex${i}`);
      const got = (t?.stdout ?? "").trim();
      outcomes.set(e, { got: got || (t?.stderr ?? "").trim().split("\n").pop() || "", ok: !!t && sameResult(got, e.output, p.language) });
    });
  };
  await run(calls, true);
  await run(programs, false);
  const shown = all.filter((e) => !e.hidden).map((e) => ({ input: e.input, expected: e.output, got: outcomes.get(e)?.got ?? "", passed: !!outcomes.get(e)?.ok }));
  const hidden = all.filter((e) => e.hidden);
  const hiddenPassed = hidden.filter((e) => outcomes.get(e)?.ok).length;
  const passed = shown.filter((s) => s.passed).length + hiddenPassed;
  return { passed, total: all.length, shown, hidden: { passed: hiddenPassed, total: hidden.length }, error };
}

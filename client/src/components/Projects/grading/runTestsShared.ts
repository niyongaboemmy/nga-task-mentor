import type { RunResponse, RunVerdict } from "../../../services/practicalsApi";

/** The Run tab's saved tests: their shape, storage, verdict words and last results (RunTests, RunPane). */

export interface RunCase {
  id: string;
  name: string;
  input: string;
  expected: string;
}

export const newCase = (n: number): RunCase => ({ id: `c${Date.now().toString(36)}${n}`, name: `Test ${n}`, input: "", expected: "" });

export const readStored = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};
export const writeStored = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage blocked: inputs are a convenience
  }
};

export const VERDICT: Record<RunVerdict, { label: string; tone: "ok" | "bad" | "warn" }> = {
  ok: { label: "Ran", tone: "ok" },
  accepted: { label: "Matches expected", tone: "ok" },
  "wrong-answer": { label: "Different output", tone: "warn" },
  "runtime-error": { label: "Crashed", tone: "bad" },
  "time-limit": { label: "Too slow (time limit)", tone: "bad" },
  "memory-limit": { label: "Out of memory", tone: "bad" },
  "output-limit": { label: "Too much output", tone: "bad" },
  "compile-error": { label: "Doesn't compile", tone: "bad" },
  "package-not-available": { label: "Package not available", tone: "bad" },
  "internal-error": { label: "Runner error", tone: "bad" },
};

export const TONE = {
  ok: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  warn: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  bad: "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300",
};

export const ERROR_TEXT: Record<string, string> = {
  RATE_LIMITED: "Too many runs in a minute. Wait a moment, then run again.",
  JUDGE_UNAVAILABLE: "The code runner isn't reachable right now. Try again in a minute, or open the project in TMCode.",
};

/** The last batch run per project revision, so switching tabs or students doesn't lose it. */
const lastRuns = new Map<string, RunResponse>();
const runKey = (projectId: number, revisionId: number | null) => `${projectId}:${revisionId ?? "head"}`;
export const lastRunOf = (projectId: number, revisionId: number | null) => lastRuns.get(runKey(projectId, revisionId)) ?? null;
/** Keeps (or with null forgets) a revision's last batch run. */
export const rememberRun = (projectId: number, revisionId: number | null, r: RunResponse | null) =>
  void (r ? lastRuns.set(runKey(projectId, revisionId), r) : lastRuns.delete(runKey(projectId, revisionId)));

/** The tests' outcome in a few words (the tab's badge). */
export function testsSummary(cases: RunCase[], result: RunResponse | null): { text: string; tone: "ok" | "warn" | "bad" } | null {
  if (!result) return null;
  if (result.compile && !result.compile.ok) return { text: "doesn't compile", tone: "bad" };
  const byId = new Map(result.tests.map((t) => [t.id, t]));
  const ran = cases.filter((c) => byId.has(c.id));
  if (!ran.length) return null;
  const compared = ran.filter((c) => c.expected.trim());
  const matched = compared.filter((c) => byId.get(c.id)?.verdict === "accepted").length;
  const crashed = ran.filter((c) => VERDICT[byId.get(c.id)!.verdict]?.tone === "bad").length;
  if (compared.length) return { text: `${matched}/${compared.length}`, tone: crashed ? "bad" : matched === compared.length ? "ok" : "warn" };
  return { text: crashed ? `${crashed} failed` : `${ran.length} ran`, tone: crashed ? "bad" : "ok" };
}

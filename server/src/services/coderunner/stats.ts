/**
 * Recent code runs in this process, for Admin → Code runner: counts per
 * engine and outcome, and the last errors. In memory only (one API process);
 * nothing about the code or its output is kept. Each record carries its
 * school; an admin's view counts only their own school's runs.
 */
import { ctid } from "../../tenancy/keys";

export interface RunRecord {
  /** Set by recordRun from the current tenant. */
  tid?: number;
  at: string;
  engine: string;
  language: string;
  tests: number;
  ms: number;
  /** "ok" when the runner answered (whatever the verdicts), else the error code. */
  outcome: string;
  message?: string;
}

const MAX_RECENT = 200;
const recent: RunRecord[] = [];
const since = new Date().toISOString();

export function recordRun(r: RunRecord) {
  recent.push({ ...r, tid: ctid() });
  if (recent.length > MAX_RECENT * 4) recent.shift();
}

export function runStats() {
  const tid = ctid();
  const mine = recent.filter((r) => r.tid === tid).slice(-MAX_RECENT);
  const byOutcome: Record<string, number> = {};
  const byEngine: Record<string, number> = {};
  const byLanguage: Record<string, number> = {};
  for (const r of mine) {
    byOutcome[r.outcome] = (byOutcome[r.outcome] ?? 0) + 1;
    byEngine[r.engine] = (byEngine[r.engine] ?? 0) + 1;
    byLanguage[r.language] = (byLanguage[r.language] ?? 0) + 1;
  }
  const ok = mine.filter((r) => r.outcome === "ok").map((r) => r.ms).sort((a, b) => a - b);
  const pct = (p: number) => (ok.length ? ok[Math.min(ok.length - 1, Math.floor((p / 100) * ok.length))] : null);
  return {
    since,
    window: mine.length,
    by_outcome: byOutcome,
    by_engine: byEngine,
    by_language: byLanguage,
    duration_ms: { p50: pct(50), p95: pct(95) },
    recent_errors: mine
      .filter((r) => r.outcome !== "ok")
      .slice(-20)
      .reverse()
      .map(({ tid: _tid, ...r }) => r),
  };
}

/** Tests only. */
export function resetRunStats() {
  recent.length = 0;
}

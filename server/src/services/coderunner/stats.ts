/**
 * Recent code runs in this process, for Admin → Code runner: counts per
 * engine and outcome, and the last errors. In memory only (one API process);
 * nothing about the code or its output is kept.
 */

export interface RunRecord {
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
  recent.push(r);
  if (recent.length > MAX_RECENT) recent.shift();
}

export function runStats() {
  const byOutcome: Record<string, number> = {};
  const byEngine: Record<string, number> = {};
  const byLanguage: Record<string, number> = {};
  for (const r of recent) {
    byOutcome[r.outcome] = (byOutcome[r.outcome] ?? 0) + 1;
    byEngine[r.engine] = (byEngine[r.engine] ?? 0) + 1;
    byLanguage[r.language] = (byLanguage[r.language] ?? 0) + 1;
  }
  const ok = recent.filter((r) => r.outcome === "ok").map((r) => r.ms).sort((a, b) => a - b);
  const pct = (p: number) => (ok.length ? ok[Math.min(ok.length - 1, Math.floor((p / 100) * ok.length))] : null);
  return {
    since,
    window: recent.length,
    by_outcome: byOutcome,
    by_engine: byEngine,
    by_language: byLanguage,
    duration_ms: { p50: pct(50), p95: pct(95) },
    recent_errors: recent.filter((r) => r.outcome !== "ok").slice(-20).reverse(),
  };
}

/** Tests only. */
export function resetRunStats() {
  recent.length = 0;
}

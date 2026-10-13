import React, { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Cpu, RefreshCw, XCircle } from "lucide-react";
import api from "../../utils/axiosConfig";
import { Button } from "../../components/ui/Button";
import { Skeleton } from "../../components/ui/Skeleton";
import PageHeader from "../../components/ui/PageHeader";

/**
 * Admin → Code runner: which engine runs students' code, whether it is
 * healthy, which languages work, and how recent runs went
 * (GET /api/code-runner/status). Read-only; refreshes every 30 s.
 */

interface RunRecord {
  at: string;
  engine: string;
  language: string;
  tests: number;
  ms: number;
  outcome: string;
  message?: string;
}

interface Status {
  engine: "tmjudge" | "judge0";
  engines: {
    tmjudge: {
      configured: boolean;
      url: string;
      reachable: boolean | null;
      error: string | null;
      sandbox: string | null;
      queue: { running: number; waiting: number; concurrency: number } | null;
      toolchains: Record<string, string | null>;
      features: string[];
      preview_origin: string | null;
      preview_secret_set: boolean;
    };
    judge0: {
      configured: boolean;
      role: "primary" | "fallback" | "off";
      quota: { remaining: number; limit: number; header: string; at: string } | null;
    };
  };
  languages: { key: string; label: string; engine: "tmjudge" | "judge0" | null; available: boolean }[];
  runs: {
    since: string;
    window: number;
    by_outcome: Record<string, number>;
    duration_ms: { p50: number | null; p95: number | null };
    recent_errors: RunRecord[];
  };
  checked_at: string;
}

const ENGINE_LABEL: Record<string, string> = { tmjudge: "NGA code runner (tm-judge)", judge0: "Judge0 (RapidAPI)" };

const OUTCOME_LABEL: Record<string, string> = {
  RUNNER_REJECTED: "Refused by the runner",
  QUOTA_EXCEEDED: "Quota used up",
  JUDGE_UNAVAILABLE: "Runner unreachable",
  UNSUPPORTED_LANGUAGE: "Language not supported",
  ERROR: "Other error",
};

const fmtTime = (iso: string) => new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** The runner's features, in words (CODE_RUNNER_PLAN.md phase 5). */
const FEATURES: { key: string; label: string; hint: string }[] = [
  { key: "run", label: "Run programs", hint: "Single files in the main languages" },
  { key: "projects", label: "Projects and more languages", hint: "Build files (Maven, npm, Cargo…) and every installed catalog language" },
  { key: "sessions", label: "Live terminal", hint: "Programs that ask for input while they run" },
  { key: "pty", label: "Real terminal", hint: "Colours, cursor and Ctrl+C reaching the program (needs containers)" },
  { key: "containers", label: "Containers (gVisor)", hint: ".NET, Kotlin/Gradle, Flutter and other heavy builds" },
  { key: "previews", label: "Web servers", hint: "Express, Flask, Spring… shown in a preview (also needs the preview address below)" },
  { key: "databases", label: "Databases", hint: "A fresh PostgreSQL or MySQL for each run" },
];

const Tile: React.FC<{ label: string; value: React.ReactNode; tone?: "ok" | "warn" | "bad" | "neutral"; hint?: string }> = ({
  label,
  value,
  tone = "neutral",
  hint,
}) => {
  const Icon = tone === "ok" ? CheckCircle2 : tone === "bad" ? XCircle : tone === "warn" ? AlertTriangle : null;
  const color =
    tone === "ok" ? "text-emerald-600" : tone === "bad" ? "text-rose-600" : tone === "warn" ? "text-amber-600" : "text-text-secondary-light";
  return (
    <div className="rounded-2xl border border-gray-200/70 bg-white p-4 dark:border-white/10 dark:bg-card-dark/40">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary-light dark:text-text-secondary-dark">{label}</p>
      <p className={`mt-1 flex items-center gap-1.5 text-lg font-bold ${color}`}>
        {Icon && <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />}
        <span className="text-text-primary-light dark:text-text-primary-dark">{value}</span>
      </p>
      {hint && <p className="mt-1 text-xs text-text-secondary-light dark:text-text-secondary-dark">{hint}</p>}
    </div>
  );
};

const CodeRunnerPage: React.FC = () => {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/code-runner/status");
      setStatus(res.data.data);
      setError(null);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || "Couldn't load the code runner status.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(t);
  }, [load]);

  const tm = status?.engines.tmjudge;
  const j0 = status?.engines.judge0;
  const total = status?.runs.window ?? 0;
  const ok = status?.runs.by_outcome.ok ?? 0;
  const failed = total - ok;

  return (
    <div className="space-y-6" data-testid="code-runner-page">
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Code runner" }]}
        title="Code runner"
        icon={<Cpu className="h-6 w-6 text-primary" aria-hidden="true" />}
        description={<>Runs students' code for quizzes, assignments and grading.{status && ` Checked ${fmtTime(status.checked_at)}.`}</>}
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
            icon={<RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />}
          >
            Refresh
          </Button>
        }
      />

      {error && (
        <p className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200" role="alert">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" /> {error}
        </p>
      )}

      {!status && !error ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : status ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Summary">
            <Tile label="Runs code on" value={ENGINE_LABEL[status.engine]} />
            <Tile
              label="NGA code runner"
              value={!tm?.configured ? "Not set up" : tm.reachable ? "Online" : "Offline"}
              tone={!tm?.configured ? "neutral" : tm.reachable ? "ok" : "bad"}
              hint={
                tm?.reachable && tm.queue
                  ? `${tm.queue.running} running · ${tm.queue.waiting} waiting · ${tm.queue.concurrency} at once`
                  : tm?.error ?? undefined
              }
            />
            <Tile
              label="Judge0"
              value={j0?.role === "primary" ? "In use" : j0?.role === "fallback" ? "Backup" : "Off"}
              tone={j0?.quota && j0.quota.remaining / Math.max(1, j0.quota.limit) < 0.2 ? "warn" : "neutral"}
              hint={j0?.quota ? `${j0.quota.remaining} of ${j0.quota.limit} ${j0.quota.header} left` : undefined}
            />
            <Tile
              label={`Recent runs (${total})`}
              value={total ? `${Math.round((ok / total) * 100)}% answered` : "None yet"}
              tone={!total ? "neutral" : failed / total > 0.1 ? "bad" : failed ? "warn" : "ok"}
              hint={status.runs.duration_ms.p50 != null ? `Typical ${status.runs.duration_ms.p50} ms · slow ${status.runs.duration_ms.p95} ms` : undefined}
            />
          </section>

          {tm?.configured && (
            <section className="rounded-2xl border border-gray-200/70 bg-white p-5 dark:border-white/10 dark:bg-card-dark/40" aria-labelledby="runner-features" data-testid="runner-features">
              <h2 id="runner-features" className="text-base font-semibold text-text-primary-light dark:text-text-primary-dark">
                What the code runner can do
              </h2>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {FEATURES.map((f) => {
                  const on = (tm.features ?? []).includes(f.key) && (f.key !== "previews" || (!!tm.preview_origin && tm.preview_secret_set));
                  return (
                    <li key={f.key} className="flex items-start gap-2 text-sm" data-testid={`feature-${f.key}`} data-on={on}>
                      {on ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-label="On" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-label="Off" />}
                      <span>
                        <span className="font-medium text-text-primary-light dark:text-text-primary-dark">{f.label}</span>
                        <span className="block text-xs text-text-secondary-light dark:text-text-secondary-dark">{f.hint}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-3 text-xs text-text-secondary-light dark:text-text-secondary-dark">
                Runner: <span className="font-mono">{tm.url}</span>
                {tm.preview_origin ? (
                  <>
                    {" "}
                    · Previews: <span className="font-mono">{tm.preview_origin}</span>
                    {!tm.preview_secret_set && " (secret missing or too short)"}
                  </>
                ) : (
                  " · Previews: no preview address set (JUDGE_PREVIEW_BASE)"
                )}
              </p>
            </section>
          )}

          <section className="rounded-2xl border border-gray-200/70 bg-white dark:border-white/10 dark:bg-card-dark/40" aria-labelledby="langs-h">
            <h2 id="langs-h" className="border-b border-gray-100 px-4 py-3 text-sm font-semibold dark:border-white/5">
              Languages
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-text-secondary-light dark:text-text-secondary-dark">
                  <tr>
                    <th className="px-4 py-2 font-semibold">Language</th>
                    <th className="px-4 py-2 font-semibold">Runs on</th>
                    <th className="px-4 py-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {status.languages.map((l) => {
                    const toolchain = l.engine === "tmjudge" ? Object.entries(tm?.toolchains ?? {}).find(([id]) => id.startsWith(l.key === "javascript" ? "node" : l.key === "cpp" ? "cpp" : l.key))?.[1] : null;
                    return (
                      <tr key={l.key} data-testid="runner-language">
                        <td className="px-4 py-2 font-medium">{l.label}</td>
                        <td className="px-4 py-2 text-text-secondary-light dark:text-text-secondary-dark">
                          {l.engine ? ENGINE_LABEL[l.engine] : "—"}
                          {toolchain ? <span className="ml-1 text-xs">({toolchain})</span> : null}
                        </td>
                        <td className="px-4 py-2">
                          {l.available ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
                              <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Available
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-text-secondary-light dark:text-text-secondary-dark">
                              <XCircle className="h-4 w-4" aria-hidden="true" /> Not available
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200/70 bg-white dark:border-white/10 dark:bg-card-dark/40" aria-labelledby="errs-h">
            <h2 id="errs-h" className="border-b border-gray-100 px-4 py-3 text-sm font-semibold dark:border-white/5">
              Recent problems
            </h2>
            {status.runs.recent_errors.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-text-secondary-light dark:text-text-secondary-dark">
                No failed runs since {fmtTime(status.runs.since)}.
              </p>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-white/5">
                {status.runs.recent_errors.map((r, i) => (
                  <li key={`${r.at}-${i}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5 text-sm" data-testid="runner-error">
                    <span className="text-xs tabular-nums text-text-secondary-light dark:text-text-secondary-dark">{fmtTime(r.at)}</span>
                    <span className="font-semibold">{OUTCOME_LABEL[r.outcome] ?? r.outcome}</span>
                    <span className="text-text-secondary-light dark:text-text-secondary-dark">
                      {r.language} · {ENGINE_LABEL[r.engine] ?? r.engine}
                    </span>
                    {r.message && <span className="w-full text-xs text-text-secondary-light dark:text-text-secondary-dark">{r.message}</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
};

export default CodeRunnerPage;

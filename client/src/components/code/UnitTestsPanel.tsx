import React, { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronRight, CircleSlash, FlaskConical, Loader2, Play, XCircle } from "lucide-react";
import { codeApi, type CodeFile, type PracticeRunResult, type UnitTestCase } from "../../services/codeApi";
import { runErrorMessage } from "../../utils/runErrors";

/**
 * A project's unit tests (CODE_RUNNER_PLAN.md §9): runs them on the code
 * runner and lists each test, with failures first and their messages one
 * click away. Used in the code workspace's Tests tab and in Grading.
 */

const STATUS = {
  passed: { label: "Passed", Icon: CheckCircle2, cls: "text-emerald-700 dark:text-emerald-300" },
  failed: { label: "Failed", Icon: XCircle, cls: "text-rose-700 dark:text-rose-300" },
  error: { label: "Error", Icon: AlertTriangle, cls: "text-rose-700 dark:text-rose-300" },
  skipped: { label: "Skipped", Icon: CircleSlash, cls: "text-text-secondary-light dark:text-text-secondary-dark" },
} as const;

const WHY: Record<string, string> = {
  error: "The tests couldn't run — usually the code or the tests don't compile. The output below says why.",
  "time-limit": "The tests took too long and were stopped.",
  "memory-limit": "The tests ran out of memory.",
  "package-not-available": "The project needs a package the school's runner doesn't have.",
  "internal-error": "The code runner had a problem. Try again.",
};

const order = (t: UnitTestCase) => (t.status === "failed" || t.status === "error" ? 0 : t.status === "passed" ? 1 : 2);

const TestRow: React.FC<{ t: UnitTestCase }> = ({ t }) => {
  const [open, setOpen] = useState(t.status === "failed" || t.status === "error");
  const s = STATUS[t.status];
  const more = !!(t.message || t.details);
  return (
    <li className="rounded-lg border border-gray-200 dark:border-white/10" data-testid="unit-test">
      <button
        type="button"
        onClick={() => more && setOpen((o) => !o)}
        aria-expanded={more ? open : undefined}
        className={`flex w-full items-center gap-2 px-2.5 py-2 text-left text-xs ${more ? "hover:bg-gray-50 dark:hover:bg-white/5" : "cursor-default"}`}
      >
        <s.Icon className={`h-4 w-4 shrink-0 ${s.cls}`} aria-label={s.label} />
        <span className="min-w-0 flex-1">
          <span className="font-semibold text-text-primary-light dark:text-text-primary-dark">{t.name}</span>
          {t.group && <span className="ml-2 truncate text-text-secondary-light dark:text-text-secondary-dark">{t.group}</span>}
        </span>
        {t.durationMs != null && <span className="shrink-0 tabular-nums text-text-secondary-light">{Math.round(t.durationMs)} ms</span>}
        {more && <ChevronRight className={`h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform ${open ? "rotate-90" : ""}`} aria-hidden="true" />}
      </button>
      {open && more && (
        <div className="border-t border-gray-200 px-2.5 py-2 dark:border-white/10">
          {t.message && <p className="mb-1 whitespace-pre-wrap text-xs font-medium text-rose-800 dark:text-rose-200">{t.message}</p>}
          {t.details && <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded bg-slate-950 p-2 font-mono text-[11px] text-slate-100">{t.details}</pre>}
          {t.file && (
            <p className="mt-1 font-mono text-[11px] text-text-secondary-light">
              {t.file}
              {t.line != null ? `:${t.line}` : ""}
            </p>
          )}
        </div>
      )}
    </li>
  );
};

const UnitTestsPanel: React.FC<{
  /** The files to test (read when Run is pressed, so it's always the latest). */
  getFiles: () => CodeFile[] | Promise<CodeFile[]>;
  language?: string | null;
  /** Shown above the button, e.g. whose project this is. */
  hint?: React.ReactNode;
  /** The workspace's "run tests" shortcut: true once per request (survives tab switches). */
  takeRunRequest?: () => boolean;
  runSignal?: number;
}> = ({ getFiles, language, hint, runSignal, takeRunRequest }) => {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<PracticeRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (running) return;
    setRunning(true);
    setError(null);
    try {
      const files = await getFiles();
      setResult(await codeApi.test({ files, language: language ?? null }));
    } catch (e) {
      setError(runErrorMessage(e, "The unit tests couldn't be run. Try again."));
    } finally {
      setRunning(false);
    }
  };

  const runRef = useRef(run);
  runRef.current = run;
  useEffect(() => {
    if (runSignal && takeRunRequest?.()) void runRef.current();
  }, [runSignal, takeRunRequest]);

  const unit = result?.unit ?? null;
  const tests = unit ? [...unit.tests].sort((a, b) => order(a) - order(b)) : [];

  return (
    <section className="space-y-2" aria-label="Unit tests" data-testid="unit-tests">
      <div className="flex flex-wrap items-center gap-2">
        <FlaskConical className="h-4 w-4 text-primary" aria-hidden="true" />
        <h3 className="text-xs font-semibold text-text-primary-light dark:text-text-primary-dark">Unit tests</h3>
        {hint && <span className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark">{hint}</span>}
        <button
          type="button"
          onClick={() => void run()}
          disabled={running}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
          data-testid="run-unit-tests"
        >
          {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" aria-hidden="true" />} {running ? "Building and testing…" : "Run unit tests"}
        </button>
      </div>

      {error && (
        <p className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200" role="alert">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {error}
        </p>
      )}

      {unit && (
        <div className="space-y-2">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" data-testid="unit-summary" aria-live="polite">
            <span className={`font-semibold ${unit.verdict === "passed" ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}`}>
              {unit.total > 0 ? `${unit.passed} of ${unit.total} passed` : unit.verdict === "passed" ? "All tests passed" : "No test results"}
            </span>
            {unit.failed + unit.errors > 0 && <span>{unit.failed + unit.errors} failed</span>}
            {unit.skipped > 0 && <span>{unit.skipped} skipped</span>}
            {unit.framework && <span className="text-text-secondary-light dark:text-text-secondary-dark">{unit.framework}</span>}
            {unit.time_ms != null && <span className="text-text-secondary-light dark:text-text-secondary-dark">{(unit.time_ms / 1000).toFixed(1)} s</span>}
          </p>
          {WHY[unit.verdict] && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-100" role="status">
              {result?.error?.message || WHY[unit.verdict]}
            </p>
          )}
          {tests.length > 0 && (
            <ul className="space-y-1.5" aria-label="Test results">
              {tests.map((t) => (
                <TestRow key={t.id} t={t} />
              ))}
            </ul>
          )}
          {(tests.length === 0 || unit.verdict !== "passed") && (unit.output || result?.compile?.output) && (
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-950 p-2.5 font-mono text-xs text-slate-100" data-testid="unit-output">
              {unit.output || result?.compile?.output}
              {unit.truncated && "\n… (cut short)"}
            </pre>
          )}
        </div>
      )}
    </section>
  );
};

export default UnitTestsPanel;

import React from "react";
import { AlertTriangle, CheckCircle2, Clock, Cpu, Globe, Loader2, Play, XCircle } from "lucide-react";
import type { PracticeRunResult, RunTestResult, RunVerdict } from "../../services/codeApi";
import { VERDICT } from "./verdicts";
import type { IoTest } from "./tests";

/**
 * The bottom panel of the code workspace (CODE_RUNNER_PLAN.md §6.3):
 * Output — run with your own input (a live terminal when the runner supports it); Tests — the visible input/output tests.
 * Verdicts use icon + words, never colour alone.
 */

export type BottomTab = "output" | "tests" | "preview";


const TONE = {
  ok: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  warn: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  bad: "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300",
};

export const VerdictChip: React.FC<{ verdict: RunVerdict }> = ({ verdict }) => {
  const v = VERDICT[verdict] ?? VERDICT["internal-error"];
  const Icon = v.tone === "ok" ? CheckCircle2 : v.tone === "warn" ? AlertTriangle : XCircle;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONE[v.tone]}`} data-testid="verdict">
      <Icon className="h-3 w-3" aria-hidden="true" />
      {v.label}
    </span>
  );
};

const Stats: React.FC<{ r: RunTestResult }> = ({ r }) => (
  <span className="inline-flex items-center gap-2 text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
    {r.time_ms != null && (
      <span className="inline-flex items-center gap-0.5">
        <Clock className="h-3 w-3" aria-hidden="true" /> {Math.round(r.time_ms)} ms
      </span>
    )}
    {r.memory_kb != null && (
      <span className="inline-flex items-center gap-0.5">
        <Cpu className="h-3 w-3" aria-hidden="true" /> {(r.memory_kb / 1024).toFixed(1)} MB
      </span>
    )}
    {r.exit_code != null && <span>exit {r.exit_code}</span>}
  </span>
);

/** Says the run happened in the browser (so it was instant, and isn't graded). */
const BrowserTag: React.FC = () => (
  <span className="inline-flex items-center gap-1 text-[11px] text-text-secondary-light dark:text-text-secondary-dark" title="Ran in your browser: instant, and nothing is sent to the server" data-testid="ran-in-browser">
    <Globe className="h-3 w-3" aria-hidden="true" /> In your browser
  </span>
);

const pre = "max-h-64 overflow-auto whitespace-pre-wrap rounded-lg p-2.5 font-mono text-xs";

export interface RunState {
  status: "idle" | "running" | "done" | "error";
  /** What was run: own input, or the visible tests. */
  kind?: BottomTab;
  result?: PracticeRunResult;
  error?: string;
  /** What is happening while it runs (e.g. loading Python in the browser). */
  note?: string;
}

const RunPanel: React.FC<{
  tab: BottomTab;
  onTab: (t: BottomTab) => void;
  stdin: string;
  onStdin: (v: string) => void;
  tests: IoTest[];
  state: RunState;
  onRun: () => void;
  onRunTests: () => void;
  canRun: boolean;
  /** An interactive terminal replaces the input box and output when the runner supports it. */
  terminal?: React.ReactNode;
  terminalBusy?: boolean;
  /** The project's unit tests, below its input/output tests. */
  unitTests?: React.ReactNode;
  /** A web server's Preview tab. */
  preview?: React.ReactNode;
}> = ({ tab, onTab, stdin, onStdin, tests, state, onRun, onRunTests, canRun, terminal, terminalBusy, unitTests, preview }) => {
  const running = state.status === "running" || (tab === "output" && !!terminalBusy);
  const result = state.result;
  const compileFailed = !!result?.compile && !result.compile.ok;
  const own = state.kind === "output" ? result?.tests[0] : undefined;
  const byId = new Map((state.kind === "tests" ? result?.tests ?? [] : []).map((t) => [t.id, t]));
  const passed = [...byId.values()].filter((t) => t.verdict === "accepted").length;

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="run-panel">
      <div className="flex shrink-0 items-center gap-1 border-b border-gray-200 px-2 dark:border-white/10" role="tablist" aria-label="Results">
        {(
          [
            ["output", "Output"],
            ["tests", `Tests${tests.length ? ` (${tests.length})` : ""}`],
            ...(preview ? ([["preview", "Preview"]] as [BottomTab, string][]) : []),
          ] as [BottomTab, string][]
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => onTab(k)}
            className={`border-b-2 px-3 py-2 text-xs font-semibold ${
              tab === k ? "border-primary text-primary dark:text-blue-300" : "border-transparent text-text-secondary-light hover:text-text-primary-light dark:text-text-secondary-dark"
            }`}
          >
            {label}
          </button>
        ))}
        <span className="ml-auto pr-1 text-[11px] text-text-secondary-light dark:text-text-secondary-dark" aria-live="polite">
          {running ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> {state.note ?? "Running…"}
            </span>
          ) : state.status === "done" && state.kind === "tests" && byId.size ? (
            <span className="inline-flex items-center gap-2">
              {passed}/{byId.size} tests passed {result?.engine === "browser" && <BrowserTag />}
            </span>
          ) : null}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {state.status === "error" && state.error && (
          <p className="mb-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200" role="alert">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {state.error}
          </p>
        )}
        {compileFailed && (
          <div className="mb-3" data-testid="compile-error">
            <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300">
              <XCircle className="h-4 w-4" aria-hidden="true" /> Your code doesn't compile
            </p>
            <pre className={`${pre} bg-slate-950 text-rose-200`}>{result!.compile!.output || "No compiler output."}</pre>
          </div>
        )}

        {tab === "preview" && preview ? (
          <div className="h-full">{preview}</div>
        ) : tab === "output" && terminal ? (
          <div className="h-full min-h-[12rem]">{terminal}</div>
        ) : tab === "output" ? (
          <div className="grid gap-3 lg:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-text-secondary-light dark:text-text-secondary-dark">Input</span>
              <textarea
                value={stdin}
                onChange={(e) => onStdin(e.target.value)}
                rows={4}
                placeholder="What your program reads when it starts, one value per line"
                className="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 font-mono text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-white/15 dark:bg-slate-800"
                data-testid="run-stdin"
              />
              <button
                type="button"
                onClick={onRun}
                disabled={!canRun || running}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                <Play className="h-3.5 w-3.5" /> Run
              </button>
            </label>
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary-light dark:text-text-secondary-dark">Output</span>
                {own && !compileFailed && <VerdictChip verdict={own.verdict} />}
                {own && <Stats r={own} />}
                {own && result?.engine === "browser" && <BrowserTag />}
              </div>
              {!own ? (
                <p className="rounded-lg bg-gray-50 p-2.5 text-xs text-text-secondary-light dark:bg-white/5 dark:text-text-secondary-dark">
                  {running ? state.note ?? "Running…" : "Press Run (Ctrl/⌘ + Enter) to see what your program prints."}
                </p>
              ) : compileFailed ? null : (
                <div className="space-y-2">
                  <pre className={`${pre} min-h-[3rem] bg-slate-950 text-slate-100`} data-testid="run-output">
                    {own.stdout || <span className="text-slate-500">(no output)</span>}
                  </pre>
                  {own.stderr && <pre className={`${pre} border border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200`}>{own.stderr}</pre>}
                  {own.truncated && <p className="text-[11px] text-amber-700 dark:text-amber-300">The output was cut short.</p>}
                </div>
              )}
            </div>
          </div>
        ) : tests.length === 0 ? (
          unitTests ?? (
            <p className="rounded-lg bg-gray-50 p-3 text-xs text-text-secondary-light dark:bg-white/5 dark:text-text-secondary-dark">
              This project has no input/output tests.
            </p>
          )
        ) : (
          <div className="space-y-2">
            <button
              type="button"
              onClick={onRunTests}
              disabled={!canRun || running}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5" /> Run tests
            </button>
            <ol className="space-y-2">
              {tests.map((t, i) => {
                const r = byId.get(t.id);
                return (
                  <li key={t.id} className="rounded-lg border border-gray-200 p-2.5 dark:border-white/10" data-testid="io-test">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold">{t.name || `Test ${i + 1}`}</span>
                      {r && !compileFailed && <VerdictChip verdict={r.verdict} />}
                      {r && <Stats r={r} />}
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-3">
                      <div>
                        <p className="mb-0.5 text-[10px] font-semibold uppercase text-text-secondary-light">Input</p>
                        <pre className={`${pre} bg-gray-50 dark:bg-white/5`}>{t.input || " "}</pre>
                      </div>
                      <div>
                        <p className="mb-0.5 text-[10px] font-semibold uppercase text-text-secondary-light">Expected</p>
                        <pre className={`${pre} bg-gray-50 dark:bg-white/5`}>{t.expected_output}</pre>
                      </div>
                      <div>
                        <p className="mb-0.5 text-[10px] font-semibold uppercase text-text-secondary-light">Got</p>
                        <pre className={`${pre} ${r?.verdict === "wrong-answer" ? "bg-amber-50 dark:bg-amber-500/10" : "bg-gray-50 dark:bg-white/5"}`}>
                          {r ? r.stdout || r.stderr || "(no output)" : "—"}
                        </pre>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
            {unitTests && <div className="border-t border-gray-200 pt-3 dark:border-white/10">{unitTests}</div>}
          </div>
        )}
      </div>
    </div>
  );
};

export default RunPanel;

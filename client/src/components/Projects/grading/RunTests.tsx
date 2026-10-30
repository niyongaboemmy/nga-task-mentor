import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Clock, Cpu, Eye, Info, Loader2, Play, Plus, RotateCcw, Trash2, XCircle } from "lucide-react";
import { practicalsApi, type RunCaseResult, type RunResponse } from "../../../services/practicalsApi";
import { ERROR_TEXT, TONE, VERDICT, lastRunOf, newCase, readStored, rememberRun, writeStored, type RunCase } from "./runTestsShared";
import { apiErrorCode, apiErrorMessage } from "../../../services/projectsApi";
import GradingUnitTests from "./GradingUnitTests";
import OutputPage from "./OutputPage";
import { outputDiff } from "./outputDiff";
import { looksLikeHtml } from "../../../vendor/nga-webrun";

/**
 * The Run tab's Tests: saved inputs, each with an optional expected output,
 * run all at once (a batch run) with a verdict per test. They are kept per
 * activity, so the same checks run for every student; "Run for each student"
 * runs them as soon as the next student opens. The project's own
 * .nga/tests.json is offered. The student's unit tests come last.
 */

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-white/10 dark:bg-slate-800";
const EDGE = { ok: "border-l-emerald-500", warn: "border-l-amber-500", bad: "border-l-rose-500" };
const label = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500";
const ghost = "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10";

const RunTests: React.FC<{
  projectId: number;
  revisionId: number | null;
  /** The program to run (as the Console runs it). */
  request: { language: string | null; entry: string | null } | null;
  runnable: boolean;
  /** The build step's name for a compile error ("build" for a Make project). */
  builds: boolean;
  studentName: string;
  casesKey: string;
  projectTests?: { name?: string; input: string; expected_output: string }[];
  /** A PHP program's output may be a page (the file it starts from). */
  phpPage: string | null;
  onResult: (cases: RunCase[], result: RunResponse | null) => void;
}> = ({ projectId, revisionId, request, runnable, builds, studentName, casesKey, projectTests, phpPage, onResult }) => {
  const [cases, setCases] = useState<RunCase[]>(() => {
    const saved = readStored<RunCase[]>(casesKey, []);
    return saved.length ? saved : [newCase(1)];
  });
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResultState] = useState<RunResponse | null>(() => lastRunOf(projectId, revisionId));
  const [autoRun, setAutoRun] = useState(() => readStored<boolean>("tm.grading.run.auto", false));
  const autoRan = useRef(result !== null);
  const setResult = useCallback(
    (r: RunResponse | null) => {
      rememberRun(projectId, revisionId, r);
      setResultState(r);
    },
    [projectId, revisionId],
  );

  useEffect(() => writeStored(casesKey, cases), [casesKey, cases]);
  useEffect(() => onResult(cases, result), [cases, result, onResult]);
  useEffect(() => {
    setResultState(lastRunOf(projectId, revisionId));
    setError(null);
  }, [projectId, revisionId]);

  // The project's own tests become the inputs when the teacher hasn't typed any yet.
  const testCases = useMemo(
    () => (projectTests ?? []).map((t, i) => ({ id: `p${i + 1}`, name: t.name || `Test ${i + 1}`, input: t.input, expected: t.expected_output })),
    [projectTests],
  );
  useEffect(() => {
    if (!testCases.length) return;
    setCases((cs) => (cs.length === 1 && !cs[0]!.input.trim() && !cs[0]!.expected.trim() ? testCases : cs));
  }, [testCases]);
  const usingProjectTests = testCases.length > 0 && cases.length === testCases.length && cases.every((c, i) => c.input === testCases[i]!.input && c.expected === testCases[i]!.expected);

  const canRun = runnable && !!request && !running;
  const run = useCallback(async () => {
    if (!runnable || !request) return;
    setRunning(true);
    setError(null);
    try {
      const r = await practicalsApi.run(projectId, {
        rev: revisionId,
        language: request.language,
        entry: request.entry,
        tests: cases.map((c) => ({ id: c.id, input: c.input, expected_output: c.expected.trim() ? c.expected : null })),
      });
      setResult(r);
    } catch (e) {
      const code = apiErrorCode(e);
      setError((code && ERROR_TEXT[code]) || apiErrorMessage(e, "The run failed. Try again."));
    } finally {
      setRunning(false);
    }
  }, [projectId, revisionId, request, cases, setResult, runnable]);

  // Run for each student, once, when the teacher asked for it.
  useEffect(() => {
    if (!autoRun || autoRan.current || !runnable || !request || running) return;
    autoRan.current = true;
    void run();
  }, [autoRun, runnable, request, running, run]);

  const update = (id: string, patch: Partial<RunCase>) => setCases((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const onKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl/⌘+Enter runs the tests here (elsewhere it saves the grade).
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      if (canRun) void run();
    }
  };

  const byId = new Map((result?.tests ?? []).map((t) => [t.id, t]));
  const compileFailed = !!result?.compile && !result.compile.ok;
  const ran = result ? cases.filter((c) => byId.has(c.id)) : [];
  const matched = ran.filter((c) => byId.get(c.id)?.verdict === "accepted").length;
  const compared = ran.filter((c) => c.expected.trim()).length;
  const crashed = ran.filter((c) => VERDICT[byId.get(c.id)!.verdict]?.tone === "bad").length;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-3" data-testid="run-tests-pane">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void run()}
          disabled={!canRun}
          data-testid="run-tests"
          title="Run every test (Ctrl/⌘ + Enter in a test)"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-white/10 dark:hover:bg-white/15"
        >
          {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          {running ? "Running…" : cases.length > 1 ? `Run ${cases.length} tests` : "Run the test"}
        </button>
        <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300" title="Run these tests as soon as you open the next student">
          <input
            type="checkbox"
            checked={autoRun}
            onChange={(e) => {
              setAutoRun(e.target.checked);
              writeStored("tm.grading.run.auto", e.target.checked);
            }}
            className="h-3.5 w-3.5 rounded border-slate-300"
          />
          Run for each student
        </label>
        {result && !compileFailed && ran.length > 0 && (
          <span className="flex flex-wrap items-center gap-1.5 text-xs" data-testid="run-summary" aria-live="polite">
            {compared > 0 && (
              <span className={`rounded-full px-2 py-0.5 font-semibold ${matched === compared ? TONE.ok : TONE.warn}`}>
                {matched} of {compared} match{compared === 1 && matched === 1 ? "es" : ""} the expected output
              </span>
            )}
            {crashed > 0 && <span className={`rounded-full px-2 py-0.5 font-semibold ${TONE.bad}`}>{crashed} stopped with an error</span>}
            {compared === 0 && crashed === 0 && <span className={`rounded-full px-2 py-0.5 font-semibold ${TONE.ok}`}>Ran {ran.length} test{ran.length === 1 ? "" : "s"}</span>}
            <span className="text-slate-500">
              {result.kind_label ?? (result.entry ? <code className="font-mono">{result.entry}</code> : null)} · revision #{result.revision.number}
              {result.compile?.time_ms != null ? ` · built in ${(result.compile.time_ms / 1000).toFixed(1)} s` : ""}
            </span>
          </span>
        )}
        {result && (
          <button type="button" onClick={() => setResult(null)} className={`${ghost} ml-auto`}>
            <RotateCcw className="h-3.5 w-3.5" /> Clear results
          </button>
        )}
      </div>

      {error && <Note tone="bad" text={error} />}
      {result?.error?.message && <Note tone="bad" text={result.error.message} />}
      {compileFailed && (
        <div className="mb-3 overflow-hidden rounded-xl border border-rose-200 dark:border-rose-500/30" data-testid="run-compile-error">
          <p className="flex items-center gap-1.5 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800 dark:bg-rose-500/10 dark:text-rose-300">
            <XCircle className="h-4 w-4" /> {studentName}'s code doesn't {builds ? "build" : "compile"}
          </p>
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap bg-slate-950 p-3 font-mono text-xs text-rose-200">{result!.compile!.output || "No compiler output."}</pre>
        </div>
      )}

      <ol className="space-y-2">
        {cases.map((c, i) => (
          <CaseCard
            key={c.id}
            c={c}
            index={i}
            result={byId.get(c.id) ?? null}
            hideOutput={compileFailed}
            page={phpPage ? { projectId, revisionId, path: phpPage } : null}
            canRemove={cases.length > 1}
            onChange={(patch) => update(c.id, patch)}
            onRemove={() => setCases((cs) => cs.filter((x) => x.id !== c.id))}
            onKeyDown={onKeyDown}
          />
        ))}
      </ol>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setCases((cs) => [...cs, newCase(cs.length + 1)])}
          disabled={cases.length >= 10}
          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-400 hover:text-slate-800 disabled:opacity-40 dark:border-white/15 dark:text-slate-300 dark:hover:border-white/30 dark:hover:text-white"
        >
          <Plus className="h-3.5 w-3.5" /> Add a test
        </button>
        {testCases.length > 0 && !usingProjectTests && (
          <button
            type="button"
            onClick={() => setCases(testCases)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-white/10"
            data-testid="use-project-tests"
          >
            Use the project's {testCases.length} test{testCases.length === 1 ? "" : "s"}
          </button>
        )}
        {usingProjectTests && (
          <span className="text-xs text-slate-500" data-testid="using-project-tests">
            These are the project's own tests.
          </span>
        )}
        <p className="ml-auto flex items-center gap-1 text-[11px] text-slate-500">
          <Info className="h-3.5 w-3.5" /> Each test's input is given to the program as it starts. Your tests are kept for every student.
        </p>
      </div>
      <div className="mt-4">
        <GradingUnitTests projectId={projectId} revisionId={revisionId} studentName={studentName} />
      </div>
    </div>
  );
};

const CaseCard: React.FC<{
  c: RunCase;
  index: number;
  result: RunCaseResult | null;
  hideOutput: boolean;
  /** A PHP program: its output can be viewed as a page. */
  page: { projectId: number; revisionId: number | null; path: string } | null;
  canRemove: boolean;
  onChange: (patch: Partial<RunCase>) => void;
  onRemove: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}> = ({ c, index, result, hideOutput, page, canRemove, onChange, onRemove, onKeyDown }) => {
  // New tests open; saved ones stay one line until they ran or are opened.
  const [open, setOpen] = useState(!c.input && !c.expected);
  const [showExpected, setShowExpected] = useState(!!c.expected);
  const [asPage, setAsPage] = useState(false);
  const html = !!page && !hideOutput && !!result?.stdout && looksLikeHtml(result.stdout);
  const v = result && !hideOutput ? VERDICT[result.verdict] ?? VERDICT["internal-error"] : null;
  const different = result?.verdict === "wrong-answer" && !!c.expected;
  const diff = different ? outputDiff(c.expected, result?.stdout ?? "") : null;
  const expanded = open || !!result;
  return (
    <li className={`overflow-hidden rounded-xl border border-l-4 border-slate-200 dark:border-white/10 ${v ? EDGE[v.tone] : "border-l-slate-200 dark:border-l-white/10"}`} data-testid="run-case">
      <div className="flex items-center gap-2 px-3 py-1.5">
        <button type="button" onClick={() => setOpen((x) => !x)} aria-expanded={expanded} aria-label={expanded ? `Fold ${c.name}` : `Open ${c.name}`} className="rounded p-0.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10">
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
        <input value={c.name} onChange={(e) => onChange({ name: e.target.value })} aria-label={`Name of test ${index + 1}`} className="min-w-0 flex-1 bg-transparent text-xs font-semibold outline-none" />
        {!expanded && c.input && <code className="hidden max-w-[40%] truncate font-mono text-[11px] text-slate-500 sm:block">{c.input.replace(/\n/g, " ⏎ ")}</code>}
        {v && (
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONE[v.tone]}`} data-testid="run-verdict">
            {v.tone === "ok" ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
            {v.label}
          </span>
        )}
        {result && !hideOutput && (
          <span className="hidden items-center gap-2 text-[11px] text-slate-500 sm:inline-flex">
            {result.time_ms != null && (
              <span className="inline-flex items-center gap-0.5">
                <Clock className="h-3 w-3" /> {Math.round(result.time_ms)} ms
              </span>
            )}
            {result.memory_kb != null && (
              <span className="inline-flex items-center gap-0.5">
                <Cpu className="h-3 w-3" /> {(result.memory_kb / 1024).toFixed(1)} MB
              </span>
            )}
            {result.exit_code != null && result.exit_code !== 0 && <span>exit {result.exit_code}</span>}
          </span>
        )}
        {canRemove && (
          <button type="button" onClick={onRemove} aria-label={`Remove ${c.name}`} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-rose-600 dark:hover:bg-white/5">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {expanded && (
        <div className="grid gap-3 border-t border-slate-100 p-3 dark:border-white/5 lg:grid-cols-2">
          <div className="space-y-2">
            <label className="block">
              <span className={label}>Input</span>
              <textarea
                value={c.input}
                onChange={(e) => onChange({ input: e.target.value })}
                onKeyDown={onKeyDown}
                rows={3}
                placeholder="What the program reads, one value per line. Leave empty if it reads nothing."
                className={inputCls}
                data-testid="run-input"
              />
            </label>
            {showExpected ? (
              <label className="block">
                <span className={label}>Expected output (optional)</span>
                <textarea value={c.expected} onChange={(e) => onChange({ expected: e.target.value })} onKeyDown={onKeyDown} rows={2} className={inputCls} />
              </label>
            ) : (
              <button type="button" onClick={() => setShowExpected(true)} className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:underline dark:text-slate-300">
                <ChevronDown className="h-3 w-3" /> Compare with an expected output
              </button>
            )}
          </div>
          <div className="min-w-0">
            <span className={label}>Output</span>
            {hideOutput ? (
              <p className="rounded-lg bg-slate-50 p-2.5 text-xs text-slate-500 dark:bg-white/5">Not run: the code doesn't compile.</p>
            ) : !result ? (
              <p className="rounded-lg bg-slate-50 p-2.5 text-xs text-slate-500 dark:bg-white/5">Run the tests to see what it prints.</p>
            ) : diff ? (
              <div className="overflow-hidden rounded-lg border border-amber-200 dark:border-amber-500/30" data-testid="run-diff">
                <div className="grid grid-cols-[2rem_1fr_1fr] bg-amber-50 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
                  <span className="px-1.5 py-1 text-right">#</span>
                  <span className="px-2 py-1">Expected</span>
                  <span className="px-2 py-1">Printed</span>
                </div>
                <div className="max-h-64 overflow-auto font-mono text-xs" data-testid="run-stdout">
                  {diff.map((r) => (
                    <div key={r.line} className={`grid grid-cols-[2rem_1fr_1fr] ${r.same ? "" : "bg-rose-50 dark:bg-rose-500/10"}`} data-same={r.same}>
                      <span className="select-none px-1.5 py-0.5 text-right text-slate-400">{r.line}</span>
                      <span className="whitespace-pre-wrap break-all px-2 py-0.5">{r.expected ?? <span className="text-slate-400">—</span>}</span>
                      <span className={`whitespace-pre-wrap break-all px-2 py-0.5 ${r.same ? "" : "font-semibold text-rose-700 dark:text-rose-300"}`}>{r.actual ?? <span className="text-slate-400">— missing</span>}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <pre className="max-h-64 min-h-[3rem] overflow-auto whitespace-pre-wrap rounded-lg bg-slate-950 p-2.5 font-mono text-xs text-slate-100" data-testid="run-stdout">
                {result.stdout || <span className="text-slate-500">(no output)</span>}
              </pre>
            )}
            {html && (
              <button
                type="button"
                onClick={() => setAsPage((x) => !x)}
                aria-pressed={asPage}
                className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:underline dark:text-slate-300"
                data-testid="run-view-page"
              >
                <Eye className="h-3 w-3" aria-hidden="true" /> {asPage ? "Hide the page" : "It printed a web page: view it as a page"}
              </button>
            )}
            {html && asPage && <OutputPage projectId={page!.projectId} revisionId={page!.revisionId} html={result!.stdout!} page={page!.path} />}
            {result && !hideOutput && result.stderr && (
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-rose-200 bg-rose-50 p-2.5 font-mono text-xs text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                {result.stderr}
              </pre>
            )}
          </div>
        </div>
      )}
    </li>
  );
};

export const Note: React.FC<{ text: string; tone: "info" | "warn" | "bad"; full?: boolean }> = ({ text, tone, full }) => {
  const cls =
    tone === "bad"
      ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200"
      : tone === "warn"
        ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200"
        : "border-sky-200 bg-sky-50 text-sky-800 dark:border-white/10 dark:bg-slate-800/70 dark:text-slate-200";
  const Icon = tone === "info" ? Info : AlertTriangle;
  const box = (
    <p className={`flex items-start gap-2 border px-3 py-2 text-xs ${cls} ${full ? "rounded-2xl" : "mb-3 rounded-lg"}`} role={tone === "bad" ? "alert" : undefined}>
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{text}</span>
    </p>
  );
  return full ? <div className="flex h-full items-center justify-center p-6">{box}</div> : box;
};

export default RunTests;

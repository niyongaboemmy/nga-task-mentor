import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  ChevronDown,
  Clock,
  Cpu,
  ExternalLink,
  Eye,
  Globe,
  Info,
  Loader2,
  Play,
  Plus,
  RotateCcw,
  Trash2,
  XCircle,
} from "lucide-react";
import { practicalsApi, type RunCaseResult, type RunResponse, type RunTargets, type RunVerdict } from "../../../services/practicalsApi";
import { apiErrorCode, apiErrorMessage } from "../../../services/projectsApi";
import Select from "../../ui/Select";
import GradingUnitTests from "./GradingUnitTests";
import OutputPage from "./OutputPage";
import { outputDiff } from "./outputDiff";
import { looksLikeHtml } from "../../../vendor/nga-webrun";

/**
 * The grading workspace's Run tab. The code runner looks at the whole
 * submitted project and says what it is (a C Make project, a Java program, a
 * Node package, a React app…); a program runs with the teacher's inputs,
 * every input at once, with each output beside its input and the differing
 * lines marked when an expected output is given. A browser app (React,
 * Angular…) gets the right place to check it instead of an input box.
 * Inputs are kept per activity, so the same checks run for every student.
 * A PHP program that prints a web page can be viewed as that page.
 */

export interface RunCase {
  id: string;
  name: string;
  input: string;
  expected: string;
}

const newCase = (n: number): RunCase => ({ id: `c${Date.now().toString(36)}${n}`, name: `Input ${n}`, input: "", expected: "" });

const read = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};
const write = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage blocked: inputs are a convenience
  }
};

const VERDICT: Record<RunVerdict, { label: string; tone: "ok" | "bad" | "warn" }> = {
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

const TONE = {
  ok: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  warn: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  bad: "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300",
};
const EDGE = { ok: "border-l-emerald-500", warn: "border-l-amber-500", bad: "border-l-rose-500" };

const ERROR_TEXT: Record<string, string> = {
  RATE_LIMITED: "Too many runs in a minute. Wait a moment, then run again.",
  JUDGE_UNAVAILABLE: "The code runner isn't reachable right now. Try again in a minute, or open the project in TMCode.",
};

/** The last run per project revision, so switching tabs or students doesn't lose it. */
const lastRuns = new Map<string, RunResponse>();
const runKey = (projectId: number, revisionId: number | null) => `${projectId}:${revisionId ?? "head"}`;

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-white/10 dark:bg-slate-800";
const label = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500";

const RunPane: React.FC<{
  projectId: number;
  revisionId: number | null;
  targets: RunTargets | null;
  targetsError: string | null;
  /** localStorage key for this activity's inputs. */
  casesKey: string;
  studentName: string;
  /** The project's own input/output tests (.nga/tests.json): offered as inputs. */
  projectTests?: { name?: string; input: string; expected_output: string }[];
  /** Where a browser app is checked instead (the workspace's other tabs). */
  onOpenPreview?: () => void;
  onOpenTmcode?: () => void;
}> = ({ projectId, revisionId, targets, targetsError, casesKey, studentName, projectTests, onOpenPreview, onOpenTmcode }) => {
  const [cases, setCases] = useState<RunCase[]>(() => {
    const saved = read<RunCase[]>(casesKey, []);
    return saved.length ? saved : [newCase(1)];
  });
  const [language, setLanguage] = useState<string | null>(null);
  const [entry, setEntry] = useState<string | null>(null);
  const [entries, setEntries] = useState<string[] | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResultState] = useState<RunResponse | null>(() => lastRuns.get(runKey(projectId, revisionId)) ?? null);
  const setResult = useCallback(
    (r: RunResponse | null) => {
      if (r) lastRuns.set(runKey(projectId, revisionId), r);
      else lastRuns.delete(runKey(projectId, revisionId));
      setResultState(r);
    },
    [projectId, revisionId],
  );
  const [error, setError] = useState<string | null>(null);
  const [autoRun, setAutoRun] = useState(() => read<boolean>("tm.grading.run.auto", false));
  const autoRan = useRef(result !== null);
  const project = targets?.project ?? null;

  useEffect(() => write(casesKey, cases), [casesKey, cases]);

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

  // The runner's guesses for this revision, until the teacher picks.
  useEffect(() => {
    setLanguage(targets?.project?.language ?? targets?.language ?? null);
    setEntries(targets?.entries ?? null);
    const last = lastRuns.get(runKey(projectId, revisionId)) ?? null;
    setEntry(last?.entry ?? targets?.project?.entry ?? targets?.entries[0] ?? null);
    setResultState(last);
    setError(null);
  }, [targets, projectId, revisionId]);

  // Older runners: another language means other entry files.
  const pickLanguage = async (key: string) => {
    setLanguage(key);
    setEntries(null);
    setEntry(null);
    try {
      const t = await practicalsApi.runTargets(projectId, revisionId, key);
      setEntries(t.entries);
      setEntry(t.entries[0] ?? null);
    } catch {
      setEntries([]);
    }
  };

  const langMeta = targets?.languages.find((l) => l.key === language) ?? null;
  const runnable = project ? project.runs : !!targets && !!language && !!entry && (langMeta?.runnable ?? targets.runnable);
  const canRun = runnable && !running;

  const run = useCallback(async () => {
    if (!runnable) return;
    setRunning(true);
    setError(null);
    try {
      const r = await practicalsApi.run(projectId, {
        rev: revisionId,
        ...(project ? { kind: project.kind, entry: project.chooses_entry ? entry : null } : { language, entry }),
        tests: cases.map((c) => ({ id: c.id, input: c.input, expected_output: c.expected.trim() ? c.expected : null })),
      });
      setResult(r);
    } catch (e) {
      const code = apiErrorCode(e);
      setError((code && ERROR_TEXT[code]) || apiErrorMessage(e, "The run failed. Try again."));
    } finally {
      setRunning(false);
    }
  }, [projectId, revisionId, project, language, entry, cases, setResult, runnable]);

  // Auto-run once per student when the teacher asked for it.
  useEffect(() => {
    if (!autoRun || autoRan.current || !runnable || running) return;
    autoRan.current = true;
    void run();
  }, [autoRun, runnable, running, run]);

  const update = (id: string, patch: Partial<RunCase>) => setCases((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const onKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl/⌘+Enter runs here (elsewhere it saves the grade).
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      if (canRun) void run();
    }
  };

  if (targetsError) return <Message tone="bad" text={targetsError} />;
  if (!targets) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
      </div>
    );
  }

  // A browser app (React, Vue, Angular, Next…): the right places to check it.
  if (project && !project.runs) {
    return (
      <div className="flex h-full flex-col gap-3 overflow-y-auto" data-testid="run-pane">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900" data-testid="run-web-app">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
              <Globe className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white" data-testid="run-project">
                {project.label}
              </h3>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                {project.web_app
                  ? "This app runs in a browser, so there's no program to give inputs to. Check what it shows and how it behaves instead."
                  : "This project builds, but has no program to run with inputs."}
                {project.tests ? " Its unit tests can run below." : ""}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {onOpenPreview && targets.html_entry && (
                  <button type="button" onClick={onOpenPreview} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">
                    <Eye className="h-3.5 w-3.5" aria-hidden="true" /> Preview
                  </button>
                )}
                {onOpenTmcode && (
                  <button type="button" onClick={onOpenTmcode} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5">
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> Open in TMCode to build and run it
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>
        <GradingUnitTests projectId={projectId} revisionId={revisionId} studentName={studentName} />
      </div>
    );
  }

  if (!project && !targets.languages.length) {
    return (
      <div className="flex h-full flex-col gap-3 overflow-y-auto">
        <Message
          tone="info"
          text={
            targets.html_entry
              ? "This is a web project: use the Preview tab to run it."
              : "There's no program to run in this revision (no C, C++, Java, Python, JavaScript or TypeScript files found)."
          }
        />
        <GradingUnitTests projectId={projectId} revisionId={revisionId} studentName={studentName} />
      </div>
    );
  }

  const byId = new Map((result?.tests ?? []).map((t) => [t.id, t]));
  const compileFailed = !!result?.compile && !result.compile.ok;
  const ran = result ? cases.filter((c) => byId.has(c.id)) : [];
  const matched = ran.filter((c) => byId.get(c.id)?.verdict === "accepted").length;
  const compared = ran.filter((c) => c.expected.trim()).length;
  const crashed = ran.filter((c) => VERDICT[byId.get(c.id)!.verdict]?.tone === "bad").length;
  const showEntryPicker = project ? project.chooses_entry && (entries?.length ?? 0) > 1 : true;
  // PHP printing HTML: the page it printed (its path, for its links and forms).
  const phpPage = result?.language === "php" ? result.entry ?? project?.entry ?? "index.php" : null;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900" data-testid="run-pane">
      {/* What runs */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2.5 dark:border-white/10">
        {project ? (
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-200">
              <Boxes className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-xs font-semibold text-slate-900 dark:text-white" data-testid="run-project">
                {project.label}
              </p>
              {!showEntryPicker && <p className="truncate text-[11px] text-slate-500">{project.entry ? <>starts from <code className="font-mono">{project.entry}</code></> : "built and run as a whole project"}</p>}
            </div>
          </div>
        ) : (
          targets.languages.length > 1 && (
            <div className="w-40">
              <Select size="sm" aria-label="Language" value={language ?? ""} onChange={(e) => void pickLanguage(e.target.value)}>
                {targets.languages.map((l) => (
                  <option key={l.key} value={l.key}>
                    {l.label} ({l.files} {l.files === 1 ? "file" : "files"})
                  </option>
                ))}
              </Select>
            </div>
          )
        )}
        {showEntryPicker && (
          <div className="min-w-[12rem] flex-1">
            <Select size="sm" aria-label="File to run" value={entry ?? ""} onChange={(e) => setEntry(e.target.value)} disabled={!entries?.length}>
              {!entries ? (
                <option value="">Finding the program…</option>
              ) : entries.length === 0 ? (
                <option value="">No files to run</option>
              ) : (
                entries.map((p, i) => (
                  <option key={p} value={p}>
                    {p}
                    {i === 0 ? "  (detected)" : ""}
                  </option>
                ))
              )}
            </Select>
          </div>
        )}
        <div className="ml-auto flex items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300" title="Run these inputs as soon as you open the next student">
            <input
              type="checkbox"
              checked={autoRun}
              onChange={(e) => {
                setAutoRun(e.target.checked);
                write("tm.grading.run.auto", e.target.checked);
              }}
              className="h-3.5 w-3.5 rounded border-slate-300"
            />
            Run for each student
          </label>
          <button
            type="button"
            onClick={() => void run()}
            disabled={!canRun}
            data-testid="run-program"
            title="Run (Ctrl/⌘ + Enter in an input)"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {running ? "Running…" : cases.length > 1 ? `Run ${cases.length} inputs` : "Run"}
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {!project && langMeta && !langMeta.runnable && (
          <Message tone="warn" inline text={`${langMeta.label} can't be run on the school's code runner yet. Read the code, or open the project in TMCode to run it.`} />
        )}
        {!project && targets.single_file && langMeta?.runnable && langMeta.files > 1 && (
          <Message
            tone="info"
            inline
            text={`The code runner runs one file: only ${entry ?? "the selected file"} is compiled. If the program needs its other ${langMeta.label} files, open it in TMCode.`}
          />
        )}
        {error && <Message tone="bad" inline text={error} />}
        {result?.error?.message && <Message tone="bad" inline text={result.error.message} />}

        {/* Summary of the last run */}
        {result && !compileFailed && ran.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs" data-testid="run-summary" aria-live="polite">
            {compared > 0 && (
              <span className={`rounded-full px-2.5 py-1 font-semibold ${matched === compared ? TONE.ok : TONE.warn}`}>
                {matched} of {compared} match{compared === 1 && matched === 1 ? "es" : ""} the expected output
              </span>
            )}
            {crashed > 0 && <span className={`rounded-full px-2.5 py-1 font-semibold ${TONE.bad}`}>{crashed} stopped with an error</span>}
            {compared === 0 && crashed === 0 && <span className={`rounded-full px-2.5 py-1 font-semibold ${TONE.ok}`}>Ran {ran.length} input{ran.length === 1 ? "" : "s"}</span>}
            <span className="text-slate-500">
              {result.kind_label ?? (result.entry ? <code className="font-mono">{result.entry}</code> : null)} · revision #{result.revision.number}
              {result.compile?.time_ms != null ? ` · built in ${(result.compile.time_ms / 1000).toFixed(1)} s` : ""}
            </span>
          </div>
        )}
        {compileFailed && (
          <div className="mb-3 overflow-hidden rounded-xl border border-rose-200 dark:border-rose-500/30" data-testid="run-compile-error">
            <p className="flex items-center gap-1.5 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800 dark:bg-rose-500/10 dark:text-rose-300">
              <XCircle className="h-4 w-4" /> {studentName}'s code doesn't {project && project.actions.includes("build") ? "build" : "compile"}
            </p>
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap bg-slate-950 p-3 font-mono text-xs text-rose-200">{result!.compile!.output || "No compiler output."}</pre>
          </div>
        )}

        <ol className="space-y-3">
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
            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-blue-400 hover:text-blue-700 disabled:opacity-40 dark:border-white/15 dark:text-slate-300"
          >
            <Plus className="h-3.5 w-3.5" /> Add an input
          </button>
          {testCases.length > 0 && !usingProjectTests && (
            <button
              type="button"
              onClick={() => setCases(testCases)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200"
              data-testid="use-project-tests"
            >
              Use the project's {testCases.length} test{testCases.length === 1 ? "" : "s"}
            </button>
          )}
          {usingProjectTests && <span className="text-xs text-slate-500" data-testid="using-project-tests">These are the project's own tests.</span>}
          {result && (
            <button type="button" onClick={() => setResult(null)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5">
              <RotateCcw className="h-3.5 w-3.5" /> Clear results
            </button>
          )}
          <p className="ml-auto flex items-center gap-1 text-[11px] text-slate-500">
            <Info className="h-3.5 w-3.5" /> Each input is given to the program as it starts. Your inputs are kept for every student.
          </p>
        </div>
        <div className="mt-4">
          <GradingUnitTests projectId={projectId} revisionId={revisionId} studentName={studentName} />
        </div>
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
  const [showExpected, setShowExpected] = useState(!!c.expected);
  const [asPage, setAsPage] = useState(false);
  const html = !!page && !hideOutput && !!result?.stdout && looksLikeHtml(result.stdout);
  const v = result && !hideOutput ? VERDICT[result.verdict] ?? VERDICT["internal-error"] : null;
  const different = result?.verdict === "wrong-answer" && !!c.expected;
  const diff = different ? outputDiff(c.expected, result?.stdout ?? "") : null;
  return (
    <li className={`overflow-hidden rounded-xl border border-l-4 border-slate-200 dark:border-white/10 ${v ? EDGE[v.tone] : "border-l-slate-200 dark:border-l-white/10"}`} data-testid="run-case">
      <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 dark:border-white/5">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500 dark:bg-white/10">{index + 1}</span>
        <input
          value={c.name}
          onChange={(e) => onChange({ name: e.target.value })}
          aria-label={`Name of input ${index + 1}`}
          className="min-w-0 flex-1 bg-transparent text-xs font-semibold outline-none"
        />
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
      <div className="grid gap-3 p-3 lg:grid-cols-2">
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
            <button type="button" onClick={() => setShowExpected(true)} className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:underline dark:text-blue-400">
              <ChevronDown className="h-3 w-3" /> Compare with an expected output
            </button>
          )}
        </div>
        <div className="min-w-0">
          <span className={label}>Output</span>
          {hideOutput ? (
            <p className="rounded-lg bg-slate-50 p-2.5 text-xs text-slate-500 dark:bg-white/5">Not run: the code doesn't compile.</p>
          ) : !result ? (
            <p className="rounded-lg bg-slate-50 p-2.5 text-xs text-slate-500 dark:bg-white/5">Run the program to see what it prints.</p>
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
              onClick={() => setAsPage((v) => !v)}
              aria-pressed={asPage}
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:underline dark:text-blue-400"
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
    </li>
  );
};

const Message: React.FC<{ text: string; tone: "info" | "warn" | "bad"; inline?: boolean }> = ({ text, tone, inline }) => {
  const cls =
    tone === "bad"
      ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200"
      : tone === "warn"
        ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200"
        : "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-200";
  const Icon = tone === "info" ? Info : AlertTriangle;
  const box = (
    <p className={`flex items-start gap-2 border px-3 py-2 text-xs ${cls} ${inline ? "mb-3 rounded-lg" : "rounded-2xl"}`} role={tone === "bad" ? "alert" : undefined}>
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{text}</span>
    </p>
  );
  return inline ? box : <div className="flex h-full items-center justify-center p-6">{box}</div>;
};

export default RunPane;

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, Clock, Cpu, Info, Loader2, Play, Plus, RotateCcw, Trash2, XCircle } from "lucide-react";
import { practicalsApi, type RunCaseResult, type RunResponse, type RunTargets, type RunVerdict } from "../../../services/practicalsApi";
import { apiErrorCode, apiErrorMessage } from "../../../services/projectsApi";
import Select from "../../ui/Select";
import GradingUnitTests from "./GradingUnitTests";

/**
 * The grading workspace's Run tab: runs a submitted program (C, C++, Java,
 * Python, JavaScript, TypeScript…) on the school's code runner with the
 * teacher's inputs, and shows the output of each. Inputs are kept per
 * activity, so the same checks run against every student with one click.
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
  "internal-error": { label: "Runner error", tone: "bad" },
};

const TONE = {
  ok: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  warn: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  bad: "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300",
};

const ERROR_TEXT: Record<string, string> = {
  RATE_LIMITED: "Too many runs in a minute. Wait a moment, then run again.",
  JUDGE_UNAVAILABLE: "The code runner isn't reachable right now. Try again in a minute, or open the project in TMCode.",
};

/** The last run per project revision, so switching tabs or students doesn't lose it. */
const lastRuns = new Map<string, RunResponse>();
const runKey = (projectId: number, revisionId: number | null) => `${projectId}:${revisionId ?? "head"}`;

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-white/10 dark:bg-slate-800";

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
}> = ({ projectId, revisionId, targets, targetsError, casesKey, studentName, projectTests }) => {
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
    setLanguage(targets?.language ?? null);
    setEntries(targets?.entries ?? null);
    const last = lastRuns.get(runKey(projectId, revisionId)) ?? null;
    setEntry(last?.entry ?? targets?.entries[0] ?? null);
    setResultState(last);
    setError(null);
  }, [targets, projectId, revisionId]);

  // Another language: ask for its entry files.
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
  const canRun = !!targets && !!language && !!entry && (langMeta?.runnable ?? targets.runnable) && !running;

  const run = useCallback(async () => {
    if (!language || !entry) return;
    setRunning(true);
    setError(null);
    try {
      const r = await practicalsApi.run(projectId, {
        rev: revisionId,
        language,
        entry,
        tests: cases.map((c) => ({ id: c.id, input: c.input, expected_output: c.expected.trim() ? c.expected : null })),
      });
      setResult(r);
    } catch (e) {
      const code = apiErrorCode(e);
      setError((code && ERROR_TEXT[code]) || apiErrorMessage(e, "The run failed. Try again."));
    } finally {
      setRunning(false);
    }
  }, [projectId, revisionId, language, entry, cases, setResult]);

  // Auto-run once per student when the teacher asked for it.
  useEffect(() => {
    if (!autoRun || autoRan.current || !targets?.runnable || !entry || running) return;
    autoRan.current = true;
    void run();
  }, [autoRun, targets, entry, running, run]);

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
  if (!targets.languages.length) {
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
  const compileFailed = result?.compile && !result.compile.ok;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900" data-testid="run-pane">
      {/* What to run */}
      <div className="flex shrink-0 flex-wrap items-end gap-2 border-b border-slate-200 px-3 py-2.5 dark:border-white/10">
        {targets.languages.length > 1 && (
          <div className="w-40">
            <Select size="sm" aria-label="Language" value={language ?? ""} onChange={(e) => void pickLanguage(e.target.value)}>
              {targets.languages.map((l) => (
                <option key={l.key} value={l.key}>
                  {l.label} ({l.files} {l.files === 1 ? "file" : "files"})
                </option>
              ))}
            </Select>
          </div>
        )}
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
        <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300" title="Run these inputs as soon as you open the next student">
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

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
  {langMeta && !langMeta.runnable && (
          <Message tone="warn" inline text={`${langMeta.label} can't be run on the school's code runner yet. Read the code, or open the project in TMCode to run it.`} />
        )}
        {targets.single_file && langMeta?.runnable && langMeta.files > 1 && (
          <Message
            tone="info"
            inline
            text={`The code runner runs one file: only ${entry ?? "the selected file"} is compiled. If the program needs its other ${langMeta.label} files, open it in TMCode.`}
          />
        )}
        {error && <Message tone="bad" inline text={error} />}
        {compileFailed && (
          <div className="mb-3 overflow-hidden rounded-xl border border-rose-200 dark:border-rose-500/30" data-testid="run-compile-error">
            <p className="flex items-center gap-1.5 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800 dark:bg-rose-500/10 dark:text-rose-300">
              <XCircle className="h-4 w-4" /> {studentName}'s code doesn't compile
            </p>
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap bg-slate-950 p-3 font-mono text-xs text-rose-200">{result!.compile!.output || "No compiler output."}</pre>
          </div>
        )}
        {result && (
          <p className="mb-3 text-[11px] text-slate-500">
            Ran <code className="font-mono">{result.entry}</code> at revision #{result.revision.number}
            {result.files_sent.length > 1 ? ` with ${result.files_sent.length} files` : ""}
            {result.files_skipped > 0 ? ` (${result.files_skipped} left out)` : ""} · {result.engine === "tmjudge" ? "school runner" : "Judge0"}
          </p>
        )}

        <ol className="space-y-3">
          {cases.map((c, i) => (
            <CaseCard
              key={c.id}
              c={c}
              index={i}
              result={byId.get(c.id) ?? null}
              hideOutput={!!compileFailed}
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
            <Info className="h-3.5 w-3.5" /> The program reads the input as stdin; there's no live terminal. Your inputs are kept for every student.
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
  canRemove: boolean;
  onChange: (patch: Partial<RunCase>) => void;
  onRemove: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}> = ({ c, index, result, hideOutput, canRemove, onChange, onRemove, onKeyDown }) => {
  const [showExpected, setShowExpected] = useState(!!c.expected);
  const v = result ? VERDICT[result.verdict] ?? VERDICT["internal-error"] : null;
  const different = result?.verdict === "wrong-answer";
  return (
    <li className="rounded-xl border border-slate-200 dark:border-white/10" data-testid="run-case">
      <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 dark:border-white/5">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500 dark:bg-white/10">{index + 1}</span>
        <input
          value={c.name}
          onChange={(e) => onChange({ name: e.target.value })}
          aria-label={`Name of input ${index + 1}`}
          className="min-w-0 flex-1 bg-transparent text-xs font-semibold outline-none"
        />
        {v && !hideOutput && (
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
            {result.exit_code != null && <span>exit {result.exit_code}</span>}
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
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Input (stdin)</span>
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
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Expected output (optional)</span>
              <textarea value={c.expected} onChange={(e) => onChange({ expected: e.target.value })} onKeyDown={onKeyDown} rows={2} className={inputCls} />
            </label>
          ) : (
            <button type="button" onClick={() => setShowExpected(true)} className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:underline dark:text-blue-400">
              <ChevronDown className="h-3 w-3" /> Compare with an expected output
            </button>
          )}
        </div>
        <div className="min-w-0">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Output</span>
          {hideOutput ? (
            <p className="rounded-lg bg-slate-50 p-2.5 text-xs text-slate-500 dark:bg-white/5">Not run: the code doesn't compile.</p>
          ) : !result ? (
            <p className="rounded-lg bg-slate-50 p-2.5 text-xs text-slate-500 dark:bg-white/5">Run the program to see what it prints.</p>
          ) : (
            <div className="space-y-2">
              <pre className="max-h-64 min-h-[3rem] overflow-auto whitespace-pre-wrap rounded-lg bg-slate-950 p-2.5 font-mono text-xs text-slate-100" data-testid="run-stdout">
                {result.stdout || <span className="text-slate-500">(no output)</span>}
              </pre>
              {result.stderr && (
                <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-rose-200 bg-rose-50 p-2.5 font-mono text-xs text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                  {result.stderr}
                </pre>
              )}
              {different && c.expected && (
                <div>
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-amber-600">Expected</span>
                  <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-amber-200 bg-amber-50 p-2.5 font-mono text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                    {c.expected}
                  </pre>
                </div>
              )}
            </div>
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

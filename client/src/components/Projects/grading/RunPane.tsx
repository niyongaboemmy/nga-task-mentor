import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Boxes, Clock, Cpu, Eraser, ExternalLink, Eye, FlaskConical, Globe, Loader2, Play, RotateCcw, Square, Terminal, XCircle } from "lucide-react";
import { practicalsApi, type LiveSessionInfo, type RunResponse, type RunTargets, type RunVerdict } from "../../../services/practicalsApi";
import { apiErrorCode, apiErrorMessage } from "../../../services/projectsApi";
import Select from "../../ui/Select";
import GradingUnitTests from "./GradingUnitTests";
import OutputPage from "./OutputPage";
import RunTests, { Note } from "./RunTests";
import { ERROR_TEXT, TONE, VERDICT, lastRunOf, testsSummary, type RunCase } from "./runTestsShared";
import { looksLikeHtml } from "../../../vendor/nga-webrun";
import { readSessionEvents, type LiveTransport } from "../../../vendor/nga-liveconsole";
import { useLiveRun } from "../../../vendor/nga-liveconsole/useLiveRun";
import LiveConsole, { type LiveConsoleTheme } from "../../../vendor/nga-liveconsole/LiveConsole";

/**
 * The grading workspace's Run tab, the MIS Code Playground's way: Run starts
 * the student's program live on the code runner (nga-liveconsole), its output
 * streams into the Console, and the teacher types its input when it asks;
 * Ctrl+C, End input, Stop and Run again as needed. The runner looks at the
 * whole submitted project and says what it is; with several programs (Task1/,
 * Task2/… exercises) the teacher picks the one to run, and only that one is
 * built. Saved tests with expected outputs, kept for every student, are the
 * secondary Tests tab. A browser app (React, Angular…) gets the right place to
 * check it instead. A PHP program that prints a web page can be viewed as one.
 */

/** The grading page's terminal: slate surfaces, no blue panels (dark and light). */
const CONSOLE_THEME: Partial<LiveConsoleTheme> = {
  out: "text-slate-100",
  err: "text-rose-300",
  in: "text-emerald-300 font-semibold",
  note: "text-slate-400",
  starting: "text-slate-400",
  asking: "bg-white/10 ring-1 ring-emerald-400/50",
  input: "text-emerald-300 font-semibold caret-emerald-400",
  barAsking: "border-white/10 bg-emerald-500/10",
  bar: "border-white/10",
  status: "text-slate-300",
  waiting: "text-emerald-300",
  eof: "text-slate-300 hover:bg-white/10",
  interrupt: "text-rose-300 hover:bg-rose-500/10",
};

type StartRequest = { rev: number | null; language: string | null; entry: string | null };

const ghost = "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-white/10";

const RunPane: React.FC<{
  projectId: number;
  revisionId: number | null;
  targets: RunTargets | null;
  targetsError: string | null;
  /** localStorage key for this activity's saved tests. */
  casesKey: string;
  studentName: string;
  /** The project's own input/output tests (.nga/tests.json): offered as tests. */
  projectTests?: { name?: string; input: string; expected_output: string }[];
  /** Where a browser app is checked instead (the workspace's other tabs). */
  onOpenPreview?: () => void;
  onOpenTmcode?: () => void;
}> = ({ projectId, revisionId, targets, targetsError, casesKey, studentName, projectTests, onOpenPreview, onOpenTmcode }) => {
  const [language, setLanguage] = useState<string | null>(null);
  const [entry, setEntry] = useState<string | null>(null);
  const [entries, setEntries] = useState<string[] | null>(null);
  const [tab, setTab] = useState<"console" | "tests">("console");
  const [info, setInfo] = useState<LiveSessionInfo | null>(null);
  const [liveOff, setLiveOff] = useState<string | null>(null);
  const [asPage, setAsPage] = useState(false);
  const [tests, setTests] = useState<{ cases: RunCase[]; result: RunResponse | null }>({ cases: [], result: null });
  const project = targets?.project ?? null;

  const transport = useMemo<LiveTransport<StartRequest>>(
    () => ({
      start: async (req) => {
        try {
          const started = await practicalsApi.startSession(projectId, req);
          setInfo(started);
          return started.id;
        } catch (e) {
          const code = apiErrorCode(e);
          throw Object.assign(new Error((code && ERROR_TEXT[code]) || apiErrorMessage(e, "The program couldn't start.")), { code });
        }
      },
      stream: async (id, onEvent, signal) => readSessionEvents(await practicalsApi.sessionEvents(projectId, id, signal), onEvent),
      input: (id, body) => practicalsApi.sessionInput(projectId, id, body),
      stop: (id) => practicalsApi.stopSession(projectId, id),
    }),
    [projectId],
  );
  const live = useLiveRun(transport, {
    // No live runs on this runner: the saved tests still run.
    onUnavailable: (message) => {
      setLiveOff(message);
      setTab("tests");
    },
  });
  const { stop: stopLive, clear: clearLive } = live;

  // The runner's guesses for this revision, until the teacher picks; another student or
  // revision stops the program that was running.
  useEffect(() => {
    setLanguage(targets?.project?.language ?? targets?.language ?? null);
    setEntries(targets?.entries ?? null);
    setEntry(lastRunOf(projectId, revisionId)?.entry ?? targets?.project?.entry ?? targets?.entries[0] ?? null);
  }, [targets, projectId, revisionId]);
  useEffect(() => {
    stopLive();
    clearLive();
    setInfo(null);
    setAsPage(false);
  }, [projectId, revisionId, stopLive, clearLive]);

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
  const showEntryPicker = project ? project.chooses_entry && (entries?.length ?? 0) > 1 : true;
  // What every run sends: the program the teacher picked, planned on the server like the playground.
  const request = useMemo(() => (targets ? { language, entry: !project || project.chooses_entry ? entry : null } : null), [targets, project, language, entry]);
  const running = live.state.phase === "running";

  const start = useCallback(() => {
    if (!runnable || !request) return;
    setAsPage(false);
    setInfo(null);
    void live.start({ rev: revisionId, ...request });
  }, [runnable, request, live, revisionId]);

  const onResult = useCallback((cases: RunCase[], result: RunResponse | null) => setTests({ cases, result }), []);

  if (targetsError) return <Note full tone="bad" text={targetsError} />;
  if (!targets) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
      </div>
    );
  }

  // A browser app (React, Vue, Angular, Next…): the right places to check it.
  if (project && !project.runs) {
    return (
      <div className="flex h-full flex-col gap-3 overflow-y-auto" data-testid="run-pane">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900" data-testid="run-web-app">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-white/10 dark:text-slate-200">
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
        <Note
          full
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

  const exit = live.state.exit;
  const verdict = exit ? (VERDICT[exit.verdict as RunVerdict] ?? VERDICT["internal-error"]) : null;
  const compileFailed = exit?.verdict === "compile-error";
  const builds = !!project?.actions.includes("build") && !project.chooses_entry;
  // PHP printing HTML: the page it printed (its path, for its links and forms).
  const phpPage = language === "php" ? (info?.entry ?? entry ?? project?.entry ?? "index.php") : null;
  const printedPage = !!phpPage && !running && exit?.verdict === "ok" && looksLikeHtml(live.state.output);
  const summary = testsSummary(tests.cases, tests.result);
  const ran = live.state.phase !== "idle";

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
              {!showEntryPicker && (
                <p className="truncate text-[11px] text-slate-500">
                  {project.entry ? (
                    <>
                      starts from <code className="font-mono">{project.entry}</code>
                    </>
                  ) : (
                    "built and run as a whole project"
                  )}
                </p>
              )}
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
          <div className="min-w-[12rem] flex-1" title="With several programs (Task1/, Task2/…), only the one you pick is built and run">
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
        <div className="ml-auto flex items-center gap-2">
          {running ? (
            <button
              type="button"
              onClick={live.stop}
              data-testid="run-stop"
              title="Stop the program"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-rose-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-rose-700"
            >
              <Square className="h-3.5 w-3.5 fill-current" /> Stop
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setTab("console");
                start();
              }}
              disabled={!runnable || !!liveOff}
              data-testid="run-program"
              title={liveOff ?? "Run the program: type its input in the Console when it asks"}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              {ran ? <RotateCcw className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {ran ? "Run again" : "Run"}
            </button>
          )}
        </div>
      </div>

      {/* Console | Tests */}
      <div className="flex shrink-0 items-center gap-1 border-b border-slate-200 px-2 dark:border-white/10" role="tablist" aria-label="Run">
        {(
          [
            ["console", "Console", Terminal],
            ["tests", "Tests", FlaskConical],
          ] as const
        ).map(([k, text, Icon]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            data-testid={`run-tab-${k}`}
            className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold ${
              tab === k ? "border-slate-900 text-slate-900 dark:border-white dark:text-white" : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" /> {text}
            {k === "tests" && summary && <span className={`rounded-full px-1.5 py-px text-[10px] ${TONE[summary.tone]}`}>{summary.text}</span>}
            {k === "console" && running && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" aria-label="running" />}
          </button>
        ))}
        {tab === "console" && live.state.console.length > 0 && (
          <button type="button" onClick={live.clear} className={`${ghost} ml-auto`} title="Clear the console (a running program keeps going)">
            <Eraser className="h-3.5 w-3.5" /> Clear
          </button>
        )}
      </div>

      {/* Console */}
      <div className={`min-h-0 flex-1 flex-col gap-2 overflow-hidden p-3 ${tab === "console" ? "flex" : "hidden"}`}>
        {!project && langMeta && !langMeta.runnable && <Note tone="warn" text={`${langMeta.label} can't be run on the school's code runner yet. Read the code, or open the project in TMCode to run it.`} />}
        {!project && targets.single_file && langMeta?.runnable && langMeta.files > 1 && (
          <Note tone="info" text={`The code runner runs one file: only ${entry ?? "the selected file"} is compiled. If the program needs its other ${langMeta.label} files, open it in TMCode.`} />
        )}
        {liveOff && <Note tone="info" text={`${liveOff} Run the saved tests instead.`} />}
        {live.state.error && !liveOff && <Note tone="bad" text={live.state.error.message} />}
        {compileFailed && (
          <p className="flex shrink-0 items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300" data-testid="run-compile-error">
            <XCircle className="h-4 w-4" /> {studentName}'s code doesn't {builds ? "build" : "compile"}: the errors are in the console below.
          </p>
        )}
        <div className="flex min-h-[12rem] flex-1 flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-950 dark:border-white/10" data-testid="run-terminal">
          <LiveConsole
            chunks={live.state.console}
            running={running}
            stage={live.state.live?.stage ?? null}
            lastOutputAt={live.state.lastOutputAt}
            onLine={live.sendLine}
            onEof={live.sendEof}
            onInterrupt={live.interrupt}
            theme={CONSOLE_THEME}
            texts={{
              starting: `Starting ${studentName}'s program…`,
              waiting: "The program is waiting for input — type it above and press Enter",
              quiet: "If the program is reading input, type it above and press Enter",
              inputLabel: "Input for the program — type and press Enter",
            }}
            testIdPrefix="run"
            emptyHint={
              <span className="font-sans text-xs text-slate-400" data-testid="run-console-hint">
                {runnable ? `Press Run to start ${studentName}'s program. Its output appears here; type its input when it asks.` : "There's no program to run here yet."}
              </span>
            }
          />
          {exit && !running && (
            <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-white/10 px-3 py-1.5 text-[11px] text-slate-400" data-testid="live-exit">
              {verdict && <span className={`rounded-full px-2 py-0.5 font-semibold ${TONE[verdict.tone]}`}>{live.state.stopped ? "Stopped" : verdict.label}</span>}
              {exit.time_ms != null && (
                <span className="inline-flex items-center gap-0.5">
                  <Clock className="h-3 w-3" /> {Math.round(exit.time_ms)} ms
                </span>
              )}
              {exit.memory_kb != null && (
                <span className="inline-flex items-center gap-0.5">
                  <Cpu className="h-3 w-3" /> {(exit.memory_kb / 1024).toFixed(1)} MB
                </span>
              )}
              {exit.code != null && exit.code !== 0 && <span>exit {exit.code}</span>}
              {info && (
                <span className="ml-auto truncate">
                  {info.kind_label ?? (info.entry ? <code className="font-mono">{info.entry}</code> : null)} · revision #{info.revision.number}
                </span>
              )}
            </div>
          )}
        </div>
        {printedPage && (
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => setAsPage((v) => !v)}
              aria-pressed={asPage}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:underline dark:text-slate-300"
              data-testid="run-view-page"
            >
              <Eye className="h-3 w-3" aria-hidden="true" /> {asPage ? "Hide the page" : "It printed a web page: view it as a page"}
            </button>
            {asPage && <OutputPage projectId={projectId} revisionId={revisionId} html={live.state.output} page={phpPage!} />}
          </div>
        )}
      </div>

      {/* Tests: kept mounted, so "Run for each student" runs while the Console is open */}
      <div className={`min-h-0 flex-1 flex-col overflow-hidden ${tab === "tests" ? "flex" : "hidden"}`}>
        <RunTests
          projectId={projectId}
          revisionId={revisionId}
          request={request}
          runnable={runnable}
          builds={builds}
          studentName={studentName}
          casesKey={casesKey}
          projectTests={projectTests}
          phpPage={phpPage}
          onResult={onResult}
        />
      </div>
    </div>
  );
};

export default RunPane;

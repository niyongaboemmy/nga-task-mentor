import React, { useCallback, useMemo, useRef, useState } from "react";
import { useAiAccess } from "../../../hooks/useAiAccess";
import { aiReasonShort } from "../../../services/aiApi";
import { AiReasonChip } from "../../ai/AiControls";
import { ArrowRight, Maximize2, Minimize2, Play, RotateCcw, Sparkles } from "lucide-react";
import CodeWorkspace, { type CodeWorkspaceHandle } from "../../code/CodeWorkspace";
import type { CodeFile, PracticeRunResult, RunVerdict } from "../../../services/codeApi";
import type { CodingAnswer, CodingData, QuestionComponentProps } from "../../../types/quiz.types";
import { QuizApiService } from "../../../services/quizApi";
import { formatClock } from "../../../utils/quizTimer";
import { guardEditorPaste, isPasteGuardActive, rememberInternalCopy } from "../../../hooks/useQuizLockdown";
import RichTextDisplay from "../../Common/RichTextDisplay";
import Select from "../../ui/Select";
import { languageLabel } from "../../code/languages";
import { AiSocraticChat } from "./AiSocraticChat";
import { answerLanguagesOf, buildInitialFiles, LANG_EXT } from "./CodeSpaceEditor";
import type { ProjectFile } from "./FileExplorer";

/**
 * A coding question in a quiz (CODE_RUNNER_PLAN.md §7.2): the answer area is
 * the code workspace itself — no "Start coding" gate. Run uses the live
 * terminal when the runner has it, Run tests runs the visible tests, hidden
 * tests run only at submission. "Expand" gives the whole screen, with the
 * timer, Exit and "Save & next" always in view. The answer keeps the
 * existing shape: {code, language}, a JSON file list for project questions.
 */

const toCodeFiles = (files: ProjectFile[]): CodeFile[] => files.map((f) => ({ path: f.name, content: f.content ?? "" }));

/** Run-code status text → workspace verdict. */
function verdictOf(status: string | null | undefined, passed: boolean | null | undefined, hasExpected: boolean): RunVerdict {
  const s = (status ?? "").toLowerCase();
  if (s.includes("compil")) return "compile-error";
  if (s.includes("time")) return "time-limit";
  if (s.includes("memory")) return "memory-limit";
  if (s.includes("output limit")) return "output-limit";
  if (s.includes("runtime") || s.includes("error") || s.includes("crash")) return "runtime-error";
  if (s.includes("internal")) return "internal-error";
  if (!hasExpected) return "ok";
  return passed ? "accepted" : "wrong-answer";
}

const QuizCodeAnswer: React.FC<QuestionComponentProps> = (props) => {
  const { question, answer, onAnswerChange, disabled = false, timeRemaining, onToggleFullscreen, isFullscreen, onNext } = props;
  const codingData = question.question_data as CodingData;
  const project = Boolean(codingData.project_mode);
  const languages = useMemo(() => answerLanguagesOf(codingData), [codingData]);
  const [language, setLanguage] = useState<string>(() => {
    const saved = (answer as CodingAnswer | undefined)?.language;
    return saved && languages.includes(saved) ? saved : languages[0] || "python";
  });
  const [projectFiles, setProjectFiles] = useState<ProjectFile[]>(() => buildInitialFiles(codingData, answer, language));
  const [showAi, setShowAi] = useState(false);
  // AI usage control: the AI tutor only when the quiz's AI setting and the school's policy allow it.
  const { access: aiAccess } = useAiAccess({ quiz: question.quiz_id });
  const aiHintAllowed = !!aiAccess?.features.hint;
  const workspace = useRef<CodeWorkspaceHandle>(null);
  const files = useMemo(() => toCodeFiles(projectFiles), [projectFiles]);

  const answerOf = useCallback(
    (pf: ProjectFile[], lang: string): CodingAnswer => ({ code: project ? JSON.stringify(pf) : pf[0]?.content ?? "", language: lang }),
    [project],
  );

  const onFilesChange = (next: CodeFile[]) => {
    if (disabled) return;
    const byName = new Map(projectFiles.map((f) => [f.name, f]));
    const pf: ProjectFile[] = next.map((f) => ({ ...(byName.get(f.path) ?? { language, is_entry_point: false }), name: f.path, content: f.content }));
    setProjectFiles(pf);
    onAnswerChange(answerOf(pf, language));
  };

  const changeLanguage = (next: string) => {
    if (next === language || project) return;
    const current = projectFiles[0];
    const renamed: ProjectFile = { ...(current ?? { content: "" }), name: `main.${LANG_EXT[next] ?? next}`, language: next, is_entry_point: true };
    setLanguage(next);
    setProjectFiles([renamed]);
    onAnswerChange(answerOf([renamed], next));
  };

  const reset = () => {
    if (!window.confirm("Start again from the starter code? Your changes to this answer are lost.")) return;
    const fresh = buildInitialFiles(codingData, null, language);
    setProjectFiles(fresh);
    onAnswerChange(answerOf(fresh, language), true);
  };

  // Runs go through the quiz's own route: the question's visible tests, the attempt's rules.
  const run = useCallback(
    async (body: { files: CodeFile[]; tests: { id: string; input: string; expected_output?: string | null }[] }): Promise<PracticeRunResult> => {
      const byName = new Map(projectFiles.map((f) => [f.name, f]));
      const pf: ProjectFile[] = body.files.map((f) => ({ ...(byName.get(f.path) ?? { language, is_entry_point: false }), name: f.path, content: f.content }));
      const code = project ? JSON.stringify(pf) : pf[0]?.content ?? "";
      const own = body.tests.length === 1 && body.tests[0]!.id === "own";
      if (own) {
        const res = await QuizApiService.runCode(question.id, { code, language, stdin: body.tests[0]!.input });
        const d = res.data;
        const verdict = verdictOf(d.status, null, false);
        return {
          engine: "quiz",
          language,
          entry: pf[0]?.name ?? null,
          files_sent: pf.map((f) => f.name),
          compile: verdict === "compile-error" ? { ok: false, output: d.stderr ?? "" } : null,
          tests: [{ id: "own", verdict, passed: null, stdout: d.stdout, stderr: d.stderr, exit_code: d.exit_code, time_ms: d.execution_time ?? null, memory_kb: d.memory_used ?? null }],
        };
      }
      const res = await QuizApiService.runTests(question.id, { code, language });
      const results = res.data.results ?? [];
      const compileFailed = results.length > 0 && results.every((r) => verdictOf(r.status, r.passed, true) === "compile-error");
      return {
        engine: "quiz",
        language,
        entry: pf[0]?.name ?? null,
        files_sent: pf.map((f) => f.name),
        compile: compileFailed ? { ok: false, output: results[0]?.error ?? "" } : null,
        tests: results.map((r) => ({
          id: String(r.testCaseId),
          verdict: verdictOf(r.status, r.passed, true),
          passed: r.passed,
          stdout: r.actual,
          stderr: r.error,
          time_ms: r.executionTime ?? null,
          memory_kb: r.memoryUsed ?? null,
        })),
      };
    },
    [language, project, projectFiles, question.id],
  );

  // The visible tests, as the workspace's Tests tab shows them (hidden ones stay on the server).
  const withTests = useMemo(() => {
    const visible = (codingData.test_cases ?? []).filter((t) => !t.is_hidden);
    if (!visible.length) return files;
    const tests = visible.map((t, i) => ({ id: String(t.id ?? i + 1), name: `Test ${i + 1}`, input: t.input ?? "", expected_output: t.expected_output ?? "" }));
    return [...files, { path: ".nga/tests.json", content: JSON.stringify({ entry: files[0]?.path ?? null, tests }) }];
  }, [codingData.test_cases, files]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onEditorMount = useCallback((editor: any) => {
    // Quiz lockdown (prevent_copy_paste): code copied in the editor may be
    // pasted back; anything else is undone (also the context-menu paste).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    editor.onKeyDown((e: any) => {
      if (!isPasteGuardActive()) return;
      const key = e.browserEvent?.key?.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && (key === "c" || key === "x")) {
        const sel = editor.getSelection();
        if (sel) rememberInternalCopy(editor.getModel()?.getValueInRange(sel));
      }
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    editor.onDidPaste((e: any) => {
      if (!isPasteGuardActive()) return;
      const pasted = editor.getModel()?.getValueInRange(e.range) ?? "";
      if (guardEditorPaste(pasted)) editor.trigger("lockdown", "undo", null);
    });
  }, []);

  const saveAndNext = () => {
    onAnswerChange(answerOf(projectFiles, language), true);
    onToggleFullscreen?.(false);
    onNext?.();
  };

  const aiPanel = showAi && aiHintAllowed ? (
    <AiSocraticChat questionId={question.id} currentCode={projectFiles.map((f) => (project ? `// ${f.name}\n${f.content}` : f.content)).join("\n\n")} language={language} />
  ) : undefined;

  const task = (
    <div className="space-y-3 text-sm">
      {question.questionBank?.question_text && <RichTextDisplay content={question.questionBank.question_text} />}
      {codingData.constraints && <p className="whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-xs dark:bg-white/5">{codingData.constraints}</p>}
    </div>
  );

  const toolbar = (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-gray-200 px-3 py-2 dark:border-white/10">
      {languages.length > 1 && !project ? (
        <div className="w-36">
          <Select size="sm" aria-label="Language" data-testid="code-language-picker" value={language} onChange={(e) => changeLanguage(e.target.value)} disabled={disabled}>
            {languages.map((l) => (
              <option key={l} value={l}>
                {languageLabel(l) || l}
              </option>
            ))}
          </Select>
        </div>
      ) : (
        <span className="text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark">{languageLabel(language) || language}</span>
      )}
      {typeof timeRemaining === "number" && timeRemaining >= 0 && isFullscreen && (
        <span
          className={`rounded-md px-2 py-0.5 font-mono text-xs font-bold tabular-nums ${timeRemaining <= 60 ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" : timeRemaining <= 300 ? "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" : "bg-gray-100 dark:bg-white/10"}`}
          aria-label={`Time left ${formatClock(timeRemaining)}`}
          data-testid="quiz-code-timer"
        >
          {formatClock(timeRemaining)}
        </span>
      )}
      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        {aiHintAllowed ? (
          <button type="button" onClick={() => setShowAi((v) => !v)} aria-pressed={showAi} className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${showAi ? "bg-primary-soft text-primary dark:bg-blue-500/15 dark:text-blue-300" : "hover:bg-gray-100 dark:hover:bg-white/10"}`}>
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> AI tutor
          </button>
        ) : aiAccess ? (
          <AiReasonChip message={aiReasonShort(aiAccess.reason, "quiz")} />
        ) : null}
        {!disabled && (
          <button type="button" onClick={reset} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold hover:bg-gray-100 dark:hover:bg-white/10" title="Start again from the starter code">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Reset
          </button>
        )}
        {onToggleFullscreen && (
          <button type="button" onClick={() => onToggleFullscreen(!isFullscreen)} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold hover:bg-gray-100 dark:hover:bg-white/10" data-testid="quiz-code-expand">
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" aria-hidden="true" /> : <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />} {isFullscreen ? "Exit full screen" : "Expand"}
          </button>
        )}
        <button
          type="button"
          onClick={() => workspace.current?.run()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
        >
          <Play className="h-3.5 w-3.5" aria-hidden="true" /> Run
        </button>
        {isFullscreen && onNext && (
          <button type="button" onClick={saveAndNext} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-hover" data-testid="quiz-code-next">
            Save &amp; next <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div
      className={`flex flex-col overflow-hidden border border-gray-200 bg-white dark:border-white/10 dark:bg-slate-950 ${isFullscreen ? "fixed inset-0 z-modal rounded-none" : "h-[70vh] min-h-[480px] rounded-2xl"}`}
      data-testid="quiz-code-answer"
    >
      {toolbar}
      <div className="min-h-0 flex-1">
        <CodeWorkspace
          key={isFullscreen ? "full" : "inline"}
          ref={workspace}
          files={withTests}
          onFilesChange={(next) => onFilesChange(next.filter((f) => f.path !== ".nga/tests.json"))}
          readOnly={disabled}
          task={isFullscreen ? task : undefined}
          language={language}
          rightPanel={aiPanel}
          run={run}
          interactive
          fixedFiles={!project}
          onEditorMount={onEditorMount}
          storageKey={isFullscreen ? "quiz-full" : "quiz"}
        />
      </div>
    </div>
  );
};

export default QuizCodeAnswer;

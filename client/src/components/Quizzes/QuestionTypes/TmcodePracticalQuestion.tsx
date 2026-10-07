import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, ClipboardList, Loader2, Play, Send, TerminalSquare, Undo2 } from "lucide-react";
import type { QuestionComponentProps, TmcodePracticalAnswer, TmcodePracticalData } from "../../../types/quiz.types";
import { apiErrorMessage, projectsApi, type ProjectSummary } from "../../../services/projectsApi";
import { practicalsApi } from "../../../services/practicalsApi";
import OpenProjectInTmcode from "../../Projects/OpenProjectInTmcode";
import RichTextDisplay from "../../Common/RichTextDisplay";

/**
 * A TMCode practical in a quiz: the student starts it (their own project, from
 * the teacher's starter files), works in TMCode, and submits the project here.
 * The submitted, frozen version is the answer; the teacher grades it later.
 */

const parseData = (raw: unknown): TmcodePracticalData => {
  let d: Partial<TmcodePracticalData> | null = null;
  if (typeof raw === "string") {
    try {
      d = JSON.parse(raw);
    } catch {
      d = null;
    }
  } else d = (raw as Partial<TmcodePracticalData>) ?? null;
  return {
    kind: d?.kind === "case_study" ? "case_study" : "practical",
    language: d?.language ?? null,
    instructions: d?.instructions ?? "",
    starter_project_id: d?.starter_project_id ?? null,
    starter_revision_id: d?.starter_revision_id ?? null,
    rubric: Array.isArray(d?.rubric) ? d!.rubric : [],
  };
};

const asAnswer = (a: unknown): TmcodePracticalAnswer | null => {
  const x = a as Partial<TmcodePracticalAnswer> | null;
  return x && x.project_id && x.link_id ? (x as TmcodePracticalAnswer) : null;
};

export const TmcodePracticalQuestion: React.FC<QuestionComponentProps> = ({
  question,
  answer,
  onAnswerChange,
  disabled = false,
  readOnlyReview = false,
}) => {
  const data = parseData((question as any).question_data ?? (question as any).questionBank?.question_data);
  const quizId = Number(question.quiz_id);
  const questionId = Number(question.id);
  const submitted = asAnswer(answer);

  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [linkId, setLinkId] = useState<number | null>(submitted?.link_id ?? null);
  const [loading, setLoading] = useState(!readOnlyReview);
  const [busy, setBusy] = useState<"start" | "submit" | "withdraw" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The student's project for this question, if they already started it.
  const load = useCallback(async () => {
    try {
      const list = await projectsApi.list("mine");
      for (const p of list.projects) {
        const l = p.links.items.find((x) => x.activity_type === "quiz" && x.activity_id === quizId && x.question_id === questionId);
        if (l && p.status !== "removed") {
          setProject(p);
          setLinkId(l.id);
          return;
        }
      }
      setProject(null);
    } catch (e) {
      setError(apiErrorMessage(e, "Couldn't load your project."));
    } finally {
      setLoading(false);
    }
  }, [quizId, questionId]);

  useEffect(() => {
    if (readOnlyReview) return;
    load();
    // Coming back from TMCode: refresh quietly.
    const onFocus = () => document.visibilityState === "visible" && load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load, readOnlyReview]);

  const start = async () => {
    setBusy("start");
    setError(null);
    try {
      const r = await practicalsApi.startQuizPractical(quizId, questionId);
      setLinkId(r.link_id);
      await load();
    } catch (e) {
      setError(apiErrorMessage(e, "Couldn't start the practical."));
    } finally {
      setBusy(null);
    }
  };

  const submit = async () => {
    if (!project || !linkId) return;
    setBusy("submit");
    setError(null);
    try {
      const link = await projectsApi.submit(project.id, linkId);
      onAnswerChange(
        { project_id: project.id, link_id: linkId, revision_id: link.revision_id ?? null, revision_number: link.revision_number ?? null },
        true,
      );
      await load();
    } catch (e) {
      setError(apiErrorMessage(e, "Couldn't submit the project."));
    } finally {
      setBusy(null);
    }
  };

  const withdraw = async () => {
    if (!project) return;
    setBusy("withdraw");
    setError(null);
    try {
      await projectsApi.withdraw(project.id);
      await load();
    } catch (e) {
      setError(apiErrorMessage(e, "Couldn't withdraw the submission."));
    } finally {
      setBusy(null);
    }
  };

  const isSubmitted = project?.status === "submitted" || project?.status === "graded";
  const head = project?.head?.number ?? null;
  const total = data.rubric.reduce((n, c) => n + (Number(c.max_score) || 0), 0);

  return (
    <div className="space-y-4" data-testid="tmcode-practical-question">
      {data.instructions && (
        <div className="rounded-xl bg-surface-light p-3.5 text-sm dark:bg-surface-dark/50">
          <RichTextDisplay content={data.instructions} />
        </div>
      )}

      {data.rubric.length > 0 && (
        <details className="group rounded-xl border border-gray-200 dark:border-gray-700">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-2.5 text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
            <ClipboardList className="h-4 w-4 text-violet-500" aria-hidden="true" />
            How it&apos;s graded
            <span className="ml-auto text-xs font-normal text-slate-500">
              {data.rubric.length} criteria · {total} marks
            </span>
          </summary>
          <ul className="divide-y divide-gray-100 border-t border-gray-100 dark:divide-gray-800 dark:border-gray-800">
            {data.rubric.map((c, i) => (
              <li key={i} className="flex items-start justify-between gap-3 px-3.5 py-2 text-sm">
                <span>
                  <span className="font-medium text-text-primary-light dark:text-text-primary-dark">{c.criteria}</span>
                  {c.description && <span className="block text-xs text-slate-500">{c.description}</span>}
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-violet-700 dark:text-violet-300">{c.max_score}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50/60 p-4 dark:border-blue-900/50 dark:from-blue-950/30 dark:to-indigo-950/20">
        {readOnlyReview ? (
          submitted ? (
            <p className="flex flex-wrap items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              Submitted project{submitted.revision_number ? ` (revision #${submitted.revision_number})` : ""}.
              <Link
                to={`/projects/${submitted.project_id}${submitted.revision_id ? `?tab=files&rev=${submitted.revision_id}` : ""}`}
                className="font-semibold text-blue-700 hover:underline dark:text-blue-300"
              >
                View the code
              </Link>
            </p>
          ) : (
            <p className="text-sm text-slate-600 dark:text-slate-300">No project was submitted for this practical.</p>
          )
        ) : loading ? (
          <p className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading your project…
          </p>
        ) : !project ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <TerminalSquare className="h-8 w-8 shrink-0 text-blue-600" aria-hidden="true" />
            <p className="flex-1 text-sm text-slate-700 dark:text-slate-200">
              Start the practical to get your own project{data.starter_project_id ? " with the starter files" : ""}, then work on
              it in TMCode.
            </p>
            <button
              type="button"
              onClick={start}
              disabled={disabled || !!busy}
              data-testid="practical-start"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {busy === "start" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
              Start the practical
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <ol className="flex flex-wrap items-center gap-2 text-xs font-semibold" aria-label="Progress">
              {[
                { label: "Started", done: true },
                { label: head ? `Saved · revision #${head}` : "Save from TMCode", done: !!head },
                {
                  label: isSubmitted ? `Submitted${submitted?.revision_number ? ` · #${submitted.revision_number}` : ""}` : "Submit",
                  done: isSubmitted,
                },
              ].map((s, i) => (
                <li
                  key={i}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${
                    s.done
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200"
                      : "bg-white text-slate-500 ring-1 ring-slate-200 dark:bg-white/5 dark:ring-white/10"
                  }`}
                >
                  {s.done && <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />}
                  {s.label}
                </li>
              ))}
            </ol>
            <div className="flex flex-wrap items-center gap-2">
              {!isSubmitted && <OpenProjectInTmcode projectId={project.id} />}
              {!isSubmitted ? (
                <button
                  type="button"
                  onClick={submit}
                  disabled={disabled || !!busy || !head}
                  title={head ? "Hand in your latest saved version" : "Save your work to Task Mentor from TMCode first"}
                  data-testid="practical-submit"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {busy === "submit" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
                  Submit project
                </button>
              ) : project.status === "submitted" ? (
                <button
                  type="button"
                  onClick={withdraw}
                  disabled={disabled || !!busy}
                  data-testid="practical-withdraw"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-white dark:border-white/10 dark:text-slate-200"
                >
                  {busy === "withdraw" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Undo2 className="h-4 w-4" aria-hidden="true" />}
                  Withdraw to keep editing
                </button>
              ) : null}
              <Link to={`/projects/${project.id}`} className="text-xs font-semibold text-blue-700 hover:underline dark:text-blue-300">
                Open the project page
              </Link>
            </div>
            {isSubmitted && (
              <p className="text-xs text-emerald-800 dark:text-emerald-300">
                Your project is handed in for this question. Your teacher grades it after the quiz.
              </p>
            )}
          </div>
        )}
        {error && (
          <p role="alert" className="mt-2 text-xs text-rose-600 dark:text-rose-400">
            {error}
          </p>
        )}
      </div>
    </div>
  );
};

export default TmcodePracticalQuestion;

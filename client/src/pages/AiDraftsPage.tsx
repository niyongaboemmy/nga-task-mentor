/* eslint-disable @typescript-eslint/no-explicit-any -- draft payloads are JSON whose shape depends on `kind` */
import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { Bot, Check, Trash2 } from "lucide-react";
import { getAiDraft, listAiDrafts, setAiDraftStatus, type AiDraft } from "../services/aiDraftsApi";
import { QuestionBankApiService } from "../services/quizApi";

/**
 * AI drafts: what the teacher's own Claude / ChatGPT saved through the NGA connector
 * (EXTERNAL_AI_CONTRACT.md §2). Nothing here is live: questions reach the bank only with
 * "Add to question bank", rubrics are loaded in the assignment form ("Load AI draft"),
 * and feedback is used from the marking assistant while grading. Discard drops a draft.
 */

const KIND_LABEL: Record<AiDraft["kind"], string> = {
  questions: "Questions",
  rubric: "Rubric",
  feedback: "Marking feedback",
};

const DraftBody: React.FC<{ draft: AiDraft }> = ({ draft }) => {
  const p = draft.payload ?? {};
  if (draft.kind === "questions") {
    const qs: any[] = Array.isArray(p.questions) ? p.questions : [];
    return (
      <ol className="list-decimal pl-5 space-y-1 text-sm text-text-primary-light dark:text-text-primary-dark">
        {qs.map((q, i) => (
          <li key={i}>
            <span className="text-xs uppercase tracking-wide text-text-secondary-light dark:text-text-secondary-dark mr-2">
              {String(q.question_type).replace(/_/g, " ")} · {q.difficulty_level}
            </span>
            {q.question_text}
          </li>
        ))}
      </ol>
    );
  }
  if (draft.kind === "rubric") {
    const rows: any[] = Array.isArray(p.criteria) ? p.criteria : [];
    return (
      <ul className="space-y-1 text-sm">
        {rows.map((c, i) => (
          <li key={i} className="flex gap-3">
            <span className="w-12 shrink-0 font-semibold tabular-nums">{c.max_score}</span>
            <span>
              <span className="font-medium">{c.criteria}</span>
              {c.description && <span className="block text-xs text-text-secondary-light dark:text-text-secondary-dark">{c.description}</span>}
            </span>
          </li>
        ))}
        <li className="text-xs text-text-secondary-light dark:text-text-secondary-dark">Total: {p.max_score} marks</li>
      </ul>
    );
  }
  return (
    <div className="text-sm space-y-1">
      {p.suggested_score != null && (
        <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
          Suggests {p.suggested_score} / {p.max_score}
        </p>
      )}
      <p className="whitespace-pre-wrap">{String(p.feedback ?? "")}</p>
    </div>
  );
};

const AiDraftsPage: React.FC = () => {
  const { draftId } = useParams<{ draftId?: string }>();
  const [drafts, setDrafts] = useState<AiDraft[] | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    const load = draftId ? getAiDraft(draftId).then((d) => [d]) : listAiDrafts();
    load
      .then((rows) => live && setDrafts(rows))
      .catch((e) => {
        if (!live) return;
        setDrafts([]);
        setError(e?.response?.data?.message || "Could not load your AI drafts.");
      });
    return () => {
      live = false;
    };
  }, [draftId]);

  const done = (id: number, status: "applied" | "discarded") =>
    setDrafts((rows) => (rows ?? []).map((r) => (r.id === id ? { ...r, status } : r)));

  const addQuestions = async (d: AiDraft) => {
    if (!d.course_id) return;
    setBusy(d.id);
    try {
      const qs = (d.payload?.questions ?? []).map((q: any) => ({ ...q, tags: q.tags ?? ["ai-draft"] }));
      await QuestionBankApiService.bulkCreateCourseQuestions(d.course_id, qs);
      await setAiDraftStatus(d.id, "applied");
      done(d.id, "applied");
      toast.success(`${qs.length} question${qs.length === 1 ? "" : "s"} added to the question bank.`);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Could not add the questions.");
    } finally {
      setBusy(null);
    }
  };

  const discard = async (d: AiDraft) => {
    setBusy(d.id);
    try {
      await setAiDraftStatus(d.id, "discarded");
      done(d.id, "discarded");
    } catch {
      toast.error("Could not discard the draft.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4" data-testid="ai-drafts-page">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-text-primary-light dark:text-text-primary-dark">
          <Bot className="w-5 h-5" aria-hidden /> AI drafts
        </h1>
        <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
          Drafts your own Claude or ChatGPT saved through the NGA connector. Nothing here is live until you confirm it.
        </p>
        {draftId && (
          <Link to="/ai-drafts" className="text-sm text-primary-600 dark:text-primary-400 hover:underline">
            All my AI drafts
          </Link>
        )}
      </header>
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      {drafts === null && <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">Loading…</p>}
      {drafts?.length === 0 && !error && (
        <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">No drafts waiting for you.</p>
      )}
      {drafts?.map((d) => (
        <article key={d.id} className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/40 p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-200 px-2 py-0.5 text-xs font-semibold">
              {KIND_LABEL[d.kind]}
            </span>
            <h2 className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">{d.title}</h2>
            {d.status !== "draft" && (
              <span className="ml-auto text-xs text-text-secondary-light dark:text-text-secondary-dark">{d.status === "applied" ? "Used" : "Discarded"}</span>
            )}
          </div>
          <DraftBody draft={d} />
          {d.status === "draft" && (
            <div className="flex flex-wrap items-center gap-2">
              {d.kind === "questions" && (
                <button
                  type="button"
                  onClick={() => void addQuestions(d)}
                  disabled={busy === d.id}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" aria-hidden /> Add to question bank
                </button>
              )}
              {d.kind === "rubric" && (
                <Link
                  to={d.assignment_id ? `/assignments/${d.assignment_id}/edit` : "/assignments/create"}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700"
                >
                  Open the assignment form (Rubric → Load AI draft)
                </Link>
              )}
              {d.kind === "feedback" && d.assignment_id && (
                <Link
                  to={`/assignments/${d.assignment_id}`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700"
                >
                  Open the assignment (the draft shows in the AI marking assistant when you mark)
                </Link>
              )}
              <button
                type="button"
                onClick={() => void discard(d)}
                disabled={busy === d.id}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-text-secondary-light dark:text-text-secondary-dark hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden /> Discard
              </button>
            </div>
          )}
        </article>
      ))}
    </div>
  );
};

export default AiDraftsPage;

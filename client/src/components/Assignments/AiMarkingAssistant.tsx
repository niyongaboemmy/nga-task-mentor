import React from "react";
import { AlertTriangle, Check, Sparkles } from "lucide-react";
import SubmissionsApiService, { type AiMarkingDraft } from "../../services/submissionsApi";

type Tone = "encouraging" | "neutral" | "direct";
const TONES: Array<{ id: Tone; label: string }> = [
  { id: "encouraging", label: "Encouraging" },
  { id: "neutral", label: "Neutral" },
  { id: "direct", label: "Direct" },
];

interface Props {
  submissionId: string | number;
  /** Put the suggested marks into the form (the teacher can still change them). */
  onApplyMarks: (rubricScores: Record<number, number>, total: number) => void;
  /** Put the suggested feedback into the feedback box. */
  onUseFeedback: (text: string) => void;
  /** Teacher-only notes per criterion, shown under each rubric row. */
  onCriterionNotes?: (notes: Record<number, string>) => void;
}

/**
 * "Draft with AI" for one submission: suggested rubric marks, a comment per
 * criterion for the teacher, and feedback for the student. Nothing is saved
 * and the student sees nothing until the teacher saves the grade.
 */
const AiMarkingAssistant: React.FC<Props> = ({ submissionId, onApplyMarks, onUseFeedback, onCriterionNotes }) => {
  const [tone, setTone] = React.useState<Tone>("encouraging");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<AiMarkingDraft | null>(null);
  const [applied, setApplied] = React.useState<{ marks: boolean; feedback: boolean }>({ marks: false, feedback: false });

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await SubmissionsApiService.draftFeedback(submissionId, { tone });
      setDraft(res.data);
      setApplied({ marks: false, feedback: false });
      onCriterionNotes?.(Object.fromEntries(res.data.criteria.filter((c) => c.comment).map((c) => [c.index, c.comment])));
    } catch (e: any) {
      setError(e?.response?.data?.message || "The AI couldn't draft this one. Try again, or mark it yourself.");
    } finally {
      setBusy(false);
    }
  };

  const feedbackText = draft
    ? [
        draft.feedback,
        draft.next_steps.length ? `Next steps:\n${draft.next_steps.map((s) => `- ${s}`).join("\n")}` : "",
      ]
        .filter(Boolean)
        .join("\n\n")
    : "";

  return (
    <section
      aria-labelledby="ai-marking-heading"
      className="rounded-2xl border border-violet-200 bg-violet-50/60 p-5 dark:border-violet-500/30 dark:bg-violet-500/10"
      data-testid="ai-marking"
    >
      <div className="flex flex-wrap items-center gap-3">
        <h4 id="ai-marking-heading" className="flex items-center gap-2 text-sm font-semibold text-violet-900 dark:text-violet-100">
          <Sparkles className="h-4 w-4" aria-hidden /> AI marking assistant
        </h4>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="flex rounded-full border border-violet-200 bg-white p-0.5 dark:border-violet-500/30 dark:bg-slate-900/40" role="radiogroup" aria-label="Feedback tone">
            {TONES.map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={tone === t.id}
                onClick={() => setTone(t.id)}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${tone === t.id ? "bg-violet-600 text-white" : "text-violet-800 hover:bg-violet-100 dark:text-violet-100 dark:hover:bg-violet-500/20"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void run()}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-violet-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-violet-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-violet-500/30 disabled:opacity-60"
          >
            {busy ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden /> : <Sparkles className="h-3.5 w-3.5" aria-hidden />}
            {busy ? "Reading the work…" : draft ? "Draft again" : "Draft marks & feedback"}
          </button>
        </div>
      </div>
      <p className="mt-1 text-xs text-violet-900/80 dark:text-violet-100/80">
        The AI reads the work and your rubric and suggests marks and feedback. You decide: nothing is saved, and the student sees nothing until you save the grade.
      </p>

      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-red-700 dark:text-red-300">
          {error}
        </p>
      )}

      {draft && (
        <div className="mt-4 space-y-4" data-testid="ai-draft">
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-800 dark:text-slate-100">
            <span className="text-2xl font-bold tabular-nums">
              {draft.score}
              <span className="text-base font-semibold text-slate-500 dark:text-slate-300"> / {draft.max_score}</span>
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                draft.confidence === "high"
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200"
                  : draft.confidence === "low"
                    ? "bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-100"
                    : "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
              }`}
            >
              {draft.confidence === "high" ? "Confident" : draft.confidence === "low" ? "Not sure: check carefully" : "Fairly sure"}
            </span>
            <button
              type="button"
              onClick={() => {
                onApplyMarks(draft.rubric_scores, draft.score);
                setApplied((a) => ({ ...a, marks: true }));
              }}
              className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-violet-300 bg-white px-3 py-1.5 text-xs font-semibold text-violet-800 hover:bg-violet-50 dark:border-violet-500/40 dark:bg-slate-900/40 dark:text-violet-100"
            >
              {applied.marks ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
              {applied.marks ? "Marks applied" : "Use these marks"}
            </button>
          </div>

          {draft.warnings.length > 0 && (
            <ul className="space-y-1">
              {draft.warnings.map((w) => (
                <li key={w} className="flex items-start gap-2 text-xs font-medium text-amber-800 dark:text-amber-200">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> {w}
                </li>
              ))}
            </ul>
          )}

          {draft.criteria.length > 0 && (
            <ul className="divide-y divide-violet-100 rounded-xl bg-white/70 dark:divide-violet-500/20 dark:bg-slate-900/30">
              {draft.criteria.map((c) => (
                <li key={c.index} className="flex gap-3 px-3 py-2 text-sm">
                  <span className="w-14 shrink-0 font-bold tabular-nums text-violet-800 dark:text-violet-200">
                    {c.score}/{c.max_score}
                  </span>
                  <span className="min-w-0">
                    <span className="font-semibold text-slate-900 dark:text-white">{c.criteria}</span>
                    {c.comment && <span className="block text-xs text-slate-600 dark:text-slate-300">{c.comment}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="rounded-xl bg-white/70 p-3 dark:bg-slate-900/30">
            <div className="mb-1 flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Suggested feedback for the student</span>
              <button
                type="button"
                onClick={() => {
                  onUseFeedback(feedbackText);
                  setApplied((a) => ({ ...a, feedback: true }));
                }}
                className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-violet-300 bg-white px-3 py-1.5 text-xs font-semibold text-violet-800 hover:bg-violet-50 dark:border-violet-500/40 dark:bg-slate-900/40 dark:text-violet-100"
              >
                {applied.feedback ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
                {applied.feedback ? "In the feedback box" : "Use this feedback"}
              </button>
            </div>
            <p className="whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-100">{feedbackText}</p>
            {draft.strengths.length > 0 && (
              <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                <span className="font-semibold">Strengths:</span> {draft.strengths.join(" · ")}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

export default AiMarkingAssistant;

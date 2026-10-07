import React from "react";
import { ClipboardCheck } from "lucide-react";

/**
 * A graded TMCode practical: the score per criterion with the teacher's
 * comments and feedback (quiz_attempts.grading_details.manual, written by
 * the grading workspace). Renders nothing until it is graded.
 */

interface Criterion {
  criteria: string;
  description?: string | null;
  max_score: number;
}

const parse = (raw: unknown): any => {
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const PracticalGradeSummary: React.FC<{ details: unknown; questionData: unknown; className?: string }> = ({
  details,
  questionData,
  className = "",
}) => {
  const manual = parse(details)?.manual;
  if (!manual) return null;
  const rubric: Criterion[] = Array.isArray(parse(questionData)?.rubric) ? parse(questionData).rubric : [];
  const scores: { index: number; score: number; comment?: string | null }[] = Array.isArray(manual.rubric_scores)
    ? manual.rubric_scores
    : [];
  const feedback = String(manual.feedback ?? "").split(/\n*Criteria notes:\n/)[0]?.trim();

  if (!scores.length && !feedback) return null;

  return (
    <div
      className={`rounded-2xl border border-violet-200 bg-violet-50/50 p-4 dark:border-violet-900/50 dark:bg-violet-950/20 ${className}`}
      data-testid="practical-grade-summary"
    >
      <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-violet-700 dark:text-violet-300">
        <ClipboardCheck className="h-3.5 w-3.5" aria-hidden="true" /> Graded against the criteria
      </p>
      {scores.length > 0 && (
        <ul className="space-y-2">
          {scores.map((s) => {
            const c = rubric[s.index];
            const max = Number(c?.max_score) || 0;
            const pct = max ? Math.min(100, Math.round((Number(s.score) / max) * 100)) : 0;
            return (
              <li key={s.index} className="rounded-xl bg-white/80 p-2.5 dark:bg-gray-900/50">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium text-text-primary-light dark:text-text-primary-dark">
                    {c?.criteria ?? `Criterion ${s.index + 1}`}
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums text-violet-700 dark:text-violet-300">
                    {s.score}
                    {max ? <span className="font-normal text-slate-500"> / {max}</span> : null}
                  </span>
                </div>
                {max > 0 && (
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                    <div className="h-full rounded-full bg-violet-500" style={{ width: `${pct}%` }} />
                  </div>
                )}
                {s.comment && <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300">{s.comment}</p>}
              </li>
            );
          })}
        </ul>
      )}
      {feedback && (
        <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">
          <span className="font-semibold">Teacher&apos;s feedback: </span>
          {feedback}
        </p>
      )}
    </div>
  );
};

export default PracticalGradeSummary;

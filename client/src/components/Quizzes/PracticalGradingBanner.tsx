import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, ClipboardCheck } from "lucide-react";
import { gradingWorkspaceHref, practicalsApi } from "../../services/practicalsApi";

interface PracticalQuestionCounts {
  question_id: number;
  title: string;
  points: number;
  to_grade: number;
  graded: number;
  total: number;
}

/**
 * Quiz submissions: one row per TMCode practical question, with how many
 * projects wait for grading and a way into the grading workspace. Renders
 * nothing for a quiz without practical questions.
 */
const PracticalGradingBanner: React.FC<{ quizId: number; className?: string }> = ({ quizId, className = "" }) => {
  const [items, setItems] = useState<PracticalQuestionCounts[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const first = await practicalsApi.roster("quiz", quizId);
        const questions = first.activity.questions ?? [];
        const rosters = await Promise.all(
          questions.map((q) =>
            q.question_id === first.activity.question?.id ? first : practicalsApi.roster("quiz", quizId, q.question_id).catch(() => null),
          ),
        );
        if (cancelled) return;
        setItems(
          questions.map((q, i) => ({
            ...q,
            to_grade: rosters[i]?.counts.to_grade ?? 0,
            graded: rosters[i]?.counts.graded ?? 0,
            total: rosters[i]?.counts.total ?? 0,
          })),
        );
      } catch {
        // 404: the quiz has no practical question (or the grader can't see it).
        if (!cancelled) setItems([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [quizId]);

  if (!items?.length) return null;
  const waiting = items.reduce((n, q) => n + q.to_grade, 0);

  return (
    <section
      aria-label="TMCode practicals to grade"
      data-testid="practical-grading-banner"
      className={`overflow-hidden rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-blue-50/60 dark:border-violet-900/50 dark:from-violet-950/30 dark:to-blue-950/20 ${className}`}
    >
      <div className="flex items-center gap-3 px-4 pt-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-md shadow-violet-500/20">
          <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-text-primary-light dark:text-text-primary-dark">TMCode practicals</h2>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            {waiting ? `${waiting} project${waiting === 1 ? "" : "s"} waiting to be graded against the criteria` : "Every submitted project is graded"}
          </p>
        </div>
      </div>
      <ul className="space-y-1.5 p-3">
        {items.map((q, i) => (
          <li key={q.question_id}>
            <Link
              to={gradingWorkspaceHref("quiz", quizId, { questionId: q.question_id })}
              className="group flex items-center gap-3 rounded-xl bg-white/80 px-3 py-2.5 shadow-sm ring-1 ring-black/5 transition hover:ring-violet-300 dark:bg-gray-900/60 dark:ring-white/10"
            >
              <span className="text-xs font-bold text-violet-600">Q{i + 1}</span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-text-primary-light dark:text-text-primary-dark">{q.title}</span>
              <span className="hidden text-xs text-slate-500 sm:inline">
                {q.graded}/{q.total} graded · {q.points} pts
              </span>
              {q.to_grade > 0 && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                  {q.to_grade} to grade
                </span>
              )}
              <ChevronRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-violet-600" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default PracticalGradingBanner;

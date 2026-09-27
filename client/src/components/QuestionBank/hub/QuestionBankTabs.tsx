import React from "react";
import { LayoutDashboard, ListChecks } from "lucide-react";
import { TopProgressBar } from "../../ui/Skeleton";

/**
 * The Questions / Dashboard tab bar shared by the teacher hub
 * (/question-bank) and a subject's own bank (/courses/:id/question-bank),
 * so both read the same way. The progress bar rides on its bottom border.
 */

export type QuestionBankTab = "questions" | "dashboard";

interface Props {
  active: QuestionBankTab;
  onChange: (tab: QuestionBankTab) => void;
  /** Tab order differs: the hub leads with its dashboard, a subject with its questions. */
  order?: QuestionBankTab[];
  /** Urgent alerts, shown as a badge on the Dashboard tab. */
  alertCount?: number;
  /** Question total, shown next to the Questions tab once known. */
  questionCount?: number | null;
  loading?: boolean;
}

const META: Record<QuestionBankTab, { label: string; icon: React.ElementType }> = {
  questions: { label: "Questions", icon: ListChecks },
  dashboard: { label: "Dashboard", icon: LayoutDashboard },
};

const QuestionBankTabs: React.FC<Props> = ({
  active,
  onChange,
  order = ["dashboard", "questions"],
  alertCount = 0,
  questionCount = null,
  loading = false,
}) => {
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const i = order.indexOf(active);
    const next = order[(i + (e.key === "ArrowRight" ? 1 : order.length - 1)) % order.length];
    onChange(next);
    (e.currentTarget.querySelector(`[data-tab="${next}"]`) as HTMLElement | null)?.focus();
  };

  return (
    <div className="relative print:hidden">
      <div
        role="tablist"
        aria-label="Question bank views"
        onKeyDown={onKeyDown}
        className="flex gap-1 border-b border-gray-200 dark:border-gray-800/60"
      >
        {order.map((id) => {
          const { label, icon: Icon } = META[id];
          const isActive = active === id;
          return (
            <button
              key={id}
              data-tab={id}
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onChange(id)}
              className={`-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors focus:outline-none focus-visible:bg-blue-50 dark:focus-visible:bg-blue-900/20 ${
                isActive
                  ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                  : "border-transparent text-slate-600 hover:border-gray-300 hover:text-text-primary-light dark:text-slate-300 dark:hover:border-gray-700 dark:hover:text-text-primary-dark"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
              {id === "questions" && questionCount != null && (
                <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums leading-none text-slate-600 dark:bg-gray-800 dark:text-slate-300">
                  {questionCount}
                </span>
              )}
              {id === "dashboard" && alertCount > 0 && (
                <span
                  className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white"
                  aria-label={`${alertCount} alert${alertCount === 1 ? "" : "s"} need attention`}
                >
                  {alertCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <TopProgressBar active={loading} className="absolute inset-x-0 bottom-0" label="Loading question bank" />
    </div>
  );
};

export default QuestionBankTabs;

import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { LiveCountdown } from "../Common/LiveCountdown";
import { StatePill } from "../Dashboard/student/StudentPanels";
import { PASS_MARK, TODO_STATES, type StudentTask } from "../../services/studentOverviewApi";
import { card, ink } from "./studentWorkTheme";

// The student's work as cards: shared by their Assignments and Submissions
// views so a piece of work looks the same wherever it shows up.

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : null);

export const WorkCard: React.FC<{ task: StudentTask }> = ({ task: t }) => {
  const open = TODO_STATES.includes(t.state);
  const when =
    t.state === "graded"
      ? `Marked ${day(t.graded_at) ?? ""}`
      : t.state === "submitted"
        ? `Handed in ${day(t.submitted_at) ?? ""}${t.is_late ? " · late" : ""}`
        : t.state === "missed"
          ? `Was due ${day(t.due_at) ?? ""}`
          : t.due_at
            ? `Due ${day(t.due_at)}`
            : "No due date";
  return (
    <li className={`${card} flex flex-col p-5 hover:shadow-md transition-shadow`}>
      <div className="flex items-center justify-between gap-2">
        <span
          className="truncate rounded-md px-2 py-0.5 text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-900/25 dark:text-blue-300"
          title={t.subject_name}
        >
          {t.subject_code || t.subject_name}
        </span>
        <StatePill state={t.state} />
      </div>
      <h3 className={`mt-3 font-semibold leading-snug line-clamp-2 ${ink.primary}`}>
        <Link to={t.action?.url ?? `/assignments/${t.id}`} className="hover:text-blue-600 dark:hover:text-blue-400">
          {t.title}
        </Link>
      </h3>
      <p className={`mt-1 text-sm truncate ${ink.secondary}`}>{t.subject_name}</p>
      <div className="mt-auto flex items-end justify-between gap-3 pt-5">
        <div className="min-w-0 text-sm">
          {open && t.countdown_to && t.countdown_label ? (
            <LiveCountdown to={t.countdown_to} kind={t.countdown_label} compact />
          ) : (
            <p className={t.state === "missed" ? "text-amber-600 dark:text-amber-400" : ink.secondary}>{when}</p>
          )}
          {t.max_score != null && <p className={`mt-0.5 text-xs ${ink.secondary}`}>{t.max_score} pts</p>}
        </div>
        {t.state === "graded" && t.score_pct != null ? (
          <Link to={t.action?.url ?? `/assignments/${t.id}`} className="text-right" title={t.has_feedback ? "Has feedback" : undefined}>
            <span className={`text-2xl font-bold tabular-nums ${t.score_pct < PASS_MARK ? "text-red-600 dark:text-red-400" : "text-blue-600 dark:text-blue-400"}`}>
              {Math.round(t.score_pct)}%
            </span>
            {t.score_display && <span className={`block text-xs ${ink.secondary}`}>{t.score_display}</span>}
          </Link>
        ) : (
          t.action && (
            <Link
              to={t.action.url}
              className={`shrink-0 inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                open
                  ? "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                  : "bg-surface-light dark:bg-surface-dark text-text-primary-light dark:text-text-primary-dark hover:bg-blue-50 dark:hover:bg-blue-900/20"
              }`}
            >
              {t.action.label}
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )
        )}
      </div>
    </li>
  );
};

export const WorkSkeleton: React.FC = () => (
  <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 animate-pulse" aria-busy="true" aria-label="Loading">
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="h-44 rounded-2xl bg-gray-200/70 dark:bg-gray-700/40" />
    ))}
  </div>
);

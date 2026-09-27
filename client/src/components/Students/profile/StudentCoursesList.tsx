import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, BookOpen, ChevronRight, Search } from "lucide-react";
import type { MarksSummary } from "../../../services/studentProfileApi";
import {
  needsAttention,
  type ActivityItem,
} from "../../../services/studentActivity";
import { EmptyState, Meter, Pct } from "./profileParts";
import { CARD, TONE_CLASSES, type ProfileSubject } from "./profileTheme";

// ─── Student profile → Enrolled courses ───────────────────────────────────────
// A plain list group: one row per subject with its code, how much work is
// marked, the average and anything needing attention. The row opens the
// subject.

interface Props {
  subjects: ProfileSubject[];
  items: ActivityItem[];
  summary: MarksSummary;
}

// Stable accent per subject so the initials badge is recognisable across visits.
const ACCENTS = [
  "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300",
];
const accentOf = (id: string) =>
  ACCENTS[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % ACCENTS.length];

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w) && !/^(of|and|the|using|&)$/i.test(w))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("") || "?";

export default function StudentCoursesList({
  subjects,
  items,
  summary,
}: Props) {
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return subjects
      .filter(
        (s) =>
          !q ||
          s.name.toLowerCase().includes(q) ||
          s.code.toLowerCase().includes(q),
      )
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((s) => ({
        ...s,
        stats: summary.byCourse[s.courseId],
        attention: items.filter(
          (i) => i.courseId === s.courseId && needsAttention(i),
        ).length,
      }));
  }, [subjects, items, summary, query]);

  if (subjects.length === 0) {
    return (
      <EmptyState icon={BookOpen} title="No courses enrolled">
        This student isn't enrolled in any subject for the selected academic
        year.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-3">
      {subjects.length > 6 && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search subjects…"
            aria-label="Search subjects"
            className="w-full h-9 pl-9 pr-3 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </div>
      )}

      <ul
        className={`${CARD} divide-y divide-gray-100 dark:divide-gray-800 overflow-hidden`}
      >
        {rows.length === 0 && (
          <li className="px-4 py-6 text-sm text-center text-text-secondary-light dark:text-text-secondary-dark/60">
            No subject matches “{query}”.
          </li>
        )}
        {rows.map((row) => {
          const marked = row.stats?.markedCount ?? 0;
          const total = row.stats?.totalCount ?? 0;
          return (
            <li key={row.courseId}>
              <Link
                to={`/courses/${row.courseId}`}
                className="group flex items-center gap-3 sm:gap-4 px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
              >
                <span
                  className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 ${accentOf(row.courseId)}`}
                >
                  {initialsOf(row.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-text-primary-light dark:text-text-primary-dark truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
                    {row.name}
                  </span>
                  <span className="block text-[11px] uppercase tracking-wide text-text-secondary-light dark:text-text-secondary-dark/60">
                    {row.code}
                  </span>
                </span>
                <span className="hidden md:block w-40">
                  <Meter
                    value={total ? Math.round((marked / total) * 100) : null}
                    color="#6366f1"
                  />
                  <span className="mt-1 block text-[10px] text-text-secondary-light dark:text-text-secondary-dark/60">
                    {total ? `${marked} of ${total} marked` : "No work set yet"}
                  </span>
                </span>
                <span className="w-10 flex justify-end flex-shrink-0">
                  {row.attention > 0 && (
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ring-1 ${TONE_CLASSES.danger.chip}`}
                      title={`${row.attention} need attention`}
                    >
                      <AlertTriangle className="w-3 h-3" />
                      {row.attention}
                    </span>
                  )}
                </span>
                <Pct
                  value={row.stats?.average ?? null}
                  className="w-12 text-right text-sm font-bold"
                />
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 flex-shrink-0" />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

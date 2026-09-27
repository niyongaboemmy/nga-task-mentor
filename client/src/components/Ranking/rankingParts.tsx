import React, { useMemo, useState } from "react";
import { Check, ChevronDown, Info, Search, X } from "lucide-react";
import { CARD } from "../Students/profile/profileTheme";
import { STATUS_META, type PerformanceStatus, type RankSubject } from "../../services/rankingApi";

// Small building blocks shared by the ranking panels.

export function StatusChip({ status, className = "" }: { status: PerformanceStatus; className?: string }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${className}`}
      style={{ color: meta.color, backgroundColor: `${meta.color}1a` }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
      {meta.label}
    </span>
  );
}

const CHIP_LIMIT = 12;

/**
 * Subject filter as chips. With many subjects (an admin sees the whole
 * catalogue) a search box narrows the chips instead of rendering hundreds.
 */
export function SubjectPicker({
  subjects,
  value,
  onChange,
}: {
  subjects: RankSubject[];
  value: string | null;
  onChange: (courseId: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  const searchable = subjects.length > CHIP_LIMIT;
  const selected = subjects.find((s) => s.course_id === value) ?? null;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = q
      ? subjects.filter((s) => s.name.toLowerCase().includes(q) || (s.code ?? "").toLowerCase().includes(q))
      : subjects;
    const list = matches.slice(0, CHIP_LIMIT);
    // Keep the selected subject visible even when it's outside the first page.
    if (selected && !list.includes(selected)) list.unshift(selected);
    return list;
  }, [subjects, query, selected]);
  const hidden = (query ? subjects.filter((s) => s.name.toLowerCase().includes(query.toLowerCase())).length : subjects.length) - visible.length;

  const chip = (active: boolean) =>
    `inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 ${
      active
        ? "bg-blue-600 border-blue-600 text-white shadow-sm"
        : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-text-secondary-light dark:text-text-secondary-dark hover:border-blue-300 dark:hover:border-blue-700 hover:text-blue-600 dark:hover:text-blue-300"
    }`;

  return (
    <div className="space-y-2 min-w-0">
      {searchable && (
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${subjects.length} subjects…`}
            aria-label="Search subjects"
            className="w-full h-9 pl-9 pr-3 text-sm rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-text-primary-light dark:text-text-primary-dark placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </div>
      )}
      <div role="radiogroup" aria-label="Subject" className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
        <button type="button" role="radio" aria-checked={value === null} onClick={() => onChange(null)} className={chip(value === null)}>
          {value === null && <Check className="w-3.5 h-3.5" />}
          All subjects
        </button>
        {visible.map((s) => {
          const active = s.course_id === value;
          return (
            <button
              key={s.course_id}
              type="button"
              role="radio"
              aria-checked={active}
              title={s.code ? `${s.name} (${s.code})` : s.name}
              onClick={() => onChange(active ? null : s.course_id)}
              className={chip(active)}
            >
              {active && <Check className="w-3.5 h-3.5" />}
              <span className="max-w-[14rem] truncate">{s.name}</span>
              {active && <X className="w-3.5 h-3.5 opacity-80" aria-hidden />}
            </button>
          );
        })}
        {hidden > 0 && (
          <span className="self-center text-xs text-text-secondary-light dark:text-text-secondary-dark/60 whitespace-nowrap">
            +{hidden} more — search to find them
          </span>
        )}
      </div>
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200/70 dark:border-gray-800 bg-white dark:bg-gray-900/40 p-3 sm:p-4 min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark/60 truncate">
        {label}
      </p>
      <p className="mt-1 text-xl sm:text-2xl font-bold tabular-nums text-text-primary-light dark:text-text-primary-dark" style={accent ? { color: accent } : undefined}>
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-text-secondary-light dark:text-text-secondary-dark/60 truncate">{hint}</p>}
    </div>
  );
}

export function RankingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse" aria-busy="true" aria-label="Loading ranking">
      <div className="h-40 rounded-2xl bg-gray-100 dark:bg-white/5" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-2xl bg-gray-100 dark:bg-white/5" />
        ))}
      </div>
      <div className="h-64 rounded-2xl bg-gray-100 dark:bg-white/5" />
    </div>
  );
}

export function HowItWorks({ audience }: { audience: "student" | "staff" }) {
  return (
    <details className={`${CARD} p-4 sm:p-5 group`}>
      <summary className="flex items-center gap-2 cursor-pointer list-none text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
        <Info className="w-4 h-4 text-blue-500" />
        How the ranking works
        <ChevronDown className="w-4 h-4 ml-auto transition-transform group-open:rotate-180" />
      </summary>
      <ul className="mt-3 space-y-1.5 text-xs leading-relaxed text-text-secondary-light dark:text-text-secondary-dark/80 list-disc pl-5">
        <li>Only marked work counts: graded assignments, completed quizzes and marks recorded in class.</li>
        <li>Work that is not handed in or not marked yet is listed as outstanding. It never counts as a zero.</li>
        <li>A quiz counts the best completed attempt. Recorded marks set as "not in final grade" are left out.</li>
        <li>Each subject's score is the average of its marked items. The overall score is the average of the subject scores, so every subject counts the same.</li>
        <li>
          {audience === "student"
            ? "You're ranked against every student with marks in the same subjects. Students with equal scores share a place."
            : "Students are ranked against everyone with marks in the selected subjects (or class). Equal scores share a place, and enrolled students with no marks are listed separately rather than ranked last."}
        </li>
        <li>The ranking follows the academic year and term picked in the top bar.</li>
      </ul>
    </details>
  );
}

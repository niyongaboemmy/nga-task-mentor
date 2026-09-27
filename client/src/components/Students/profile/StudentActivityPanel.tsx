import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { BellRing, ChevronDown, ChevronRight, Search } from "lucide-react";
import {
  needsAttention,
  relativeDays,
  statusLabel,
  statusTone,
  type ActivityItem,
  type ActivityKind,
} from "../../../services/studentActivity";
import { EmptyState, Pct, Segmented, SubjectSelect } from "./profileParts";
import { CARD, KIND_META, TONE_CLASSES, type ProfileSubject } from "./profileTheme";

// ─── Student profile → Assignments / Quizzes / Recorded ───────────────────────
// One panel for all three kinds of work: grouped by subject, filterable by
// subject and status, with an attention banner that surfaces what's overdue,
// failing or unmarked before anything else. Rows open the underlying item
// when the viewer is allowed to.

export type ActivityFilter = "all" | "attention" | "graded" | "awaiting" | "not_recorded" | "todo" | "overdue";

const FILTER_MATCH: Record<ActivityFilter, (i: ActivityItem) => boolean> = {
  all: () => true,
  attention: needsAttention,
  graded: (i) => i.status === "graded",
  awaiting: (i) => i.status === "awaiting",
  not_recorded: (i) => i.status === "not_recorded",
  todo: (i) => ["open", "due_soon", "upcoming", "in_progress"].includes(i.status),
  overdue: (i) => i.status === "overdue",
};

interface Props {
  kind: ActivityKind;
  items: ActivityItem[];
  subjects: ProfileSubject[];
  subjectId: string | null;
  onSubject: (courseId: string | null) => void;
  filter: ActivityFilter;
  onFilter: (filter: ActivityFilter) => void;
  linkFor: (item: ActivityItem) => string | null;
}

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : null;

function metaLine(item: ActivityItem): string {
  const parts: string[] = [];
  const when = relativeDays(item.date);
  const date = formatDate(item.date);
  if (item.kind === "assignment" && date) {
    parts.push(item.status === "graded" || item.status === "awaiting" ? `Due ${date}` : `Due ${date} · ${when}`);
  } else if (item.kind === "quiz" && date) {
    parts.push(item.status === "upcoming" ? `Opens ${date}` : `Closes ${date}${item.status === "graded" ? "" : ` · ${when}`}`);
  } else if (date) {
    parts.push(date);
  }
  if (item.kind === "quiz" && item.attempts > 1) parts.push(`${item.attempts} attempts · best counted`);
  if (item.kind === "assignment" && item.submittedAt && item.status !== "graded") {
    parts.push(`Submitted ${formatDate(item.submittedAt)}`);
  }
  if (!item.countsToFinal) parts.push("not in final grade");
  return parts.join(" · ");
}

function ActivityRow({ item, href }: { item: ActivityItem; href: string | null }) {
  const tone = TONE_CLASSES[statusTone(item)];
  const Icon = KIND_META[item.kind].icon;
  const inner = (
    <>
      <span className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${tone.soft}`}>
        <Icon className={`w-4 h-4 ${tone.icon}`} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-text-primary-light dark:text-text-primary-dark truncate">
          {item.title}
        </span>
        <span className="block text-[11px] text-text-secondary-light dark:text-text-secondary-dark/60 truncate">
          {metaLine(item) || "\u00a0"}
        </span>
        {/* The chip column is hidden on phones; the status goes here instead. */}
        <span className={`sm:hidden mt-1 inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-semibold ring-1 ${tone.chip}`}>
          {statusLabel(item)}
        </span>
      </span>
      <span className="text-right flex-shrink-0">
        {item.status === "graded" ? (
          <>
            <Pct value={item.percentage} className="block text-sm font-bold" />
            {item.score !== null && item.maxScore !== null && (
              <span className="block text-[11px] tabular-nums text-text-secondary-light dark:text-text-secondary-dark/60">
                {item.score} / {item.maxScore}
              </span>
            )}
          </>
        ) : (
          <span className="block text-sm font-bold text-text-secondary-light dark:text-text-secondary-dark/40">—</span>
        )}
      </span>
      <span
        className={`hidden sm:inline-flex w-32 justify-center items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 flex-shrink-0 ${tone.chip}`}
      >
        {statusLabel(item)}
      </span>
      {href && <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 flex-shrink-0" />}
    </>
  );
  const cls = "group flex items-center gap-3 px-4 py-3 transition-colors";
  return href ? (
    <Link to={href} className={`${cls} hover:bg-gray-50 dark:hover:bg-white/5`}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

export default function StudentActivityPanel({
  kind,
  items,
  subjects,
  subjectId,
  onSubject,
  filter,
  onFilter,
  linkFor,
}: Props) {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const meta = KIND_META[kind];

  const inSubject = useMemo(
    () => items.filter((i) => !subjectId || i.courseId === subjectId),
    [items, subjectId],
  );

  const counts = useMemo(() => {
    const out = {} as Record<ActivityFilter, number>;
    (Object.keys(FILTER_MATCH) as ActivityFilter[]).forEach((f) => {
      out[f] = inSubject.filter(FILTER_MATCH[f]).length;
    });
    return out;
  }, [inSubject]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return inSubject.filter((i) => FILTER_MATCH[filter](i) && (!q || i.title.toLowerCase().includes(q)));
  }, [inSubject, filter, query]);

  const groups = useMemo(() => {
    const bySubject = new Map<string, ActivityItem[]>();
    for (const item of visible) {
      const list = bySubject.get(item.courseId) ?? [];
      list.push(item);
      bySubject.set(item.courseId, list);
    }
    const name = (id: string) => subjects.find((s) => s.courseId === id)?.name ?? "Other subject";
    return [...bySubject.entries()]
      .map(([courseId, list]) => {
        const marked = list.filter((i) => i.status === "graded" && i.percentage !== null);
        const counted = marked.filter((i) => i.countsToFinal);
        return {
          courseId,
          name: name(courseId),
          code: subjects.find((s) => s.courseId === courseId)?.code ?? "",
          // Attention first, then newest first.
          items: [...list].sort(
            (a, b) =>
              Number(needsAttention(b)) - Number(needsAttention(a)) ||
              (b.date ?? "").localeCompare(a.date ?? ""),
          ),
          average: counted.length
            ? Math.round((counted.reduce((s, i) => s + (i.percentage as number), 0) / counted.length) * 10) / 10
            : null,
          marked: marked.length,
          attention: list.filter(needsAttention).length,
        };
      })
      .sort((a, b) => b.attention - a.attention || a.name.localeCompare(b.name));
  }, [visible, subjects]);

  // Attention summary for the banner, in the subject in view.
  const attention = inSubject.filter(needsAttention);
  const summaryParts = Object.entries(
    attention.reduce<Record<string, number>>((acc, i) => {
      const label = statusLabel(i).toLowerCase();
      acc[label] = (acc[label] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([label, n]) => `${n} ${label}`);

  const filterOptions: Array<{ value: ActivityFilter; label: string; count: number }> = [
    { value: "all" as const, label: "All", count: counts.all },
    { value: "attention" as const, label: "Needs attention", count: counts.attention },
    { value: "graded" as const, label: "Marked", count: counts.graded },
    kind === "recorded"
      ? { value: "not_recorded" as const, label: "Not marked", count: counts.not_recorded }
      : { value: "awaiting" as const, label: "Awaiting marking", count: counts.awaiting },
    { value: "todo" as const, label: "To do", count: counts.todo },
    { value: "overdue" as const, label: kind === "quiz" ? "Missed" : "Overdue", count: counts.overdue },
  ].filter((o) => o.value === "all" || o.value === filter || o.count > 0);

  const toggle = (courseId: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(courseId)) next.delete(courseId);
      else next.add(courseId);
      return next;
    });

  if (items.length === 0) {
    return (
      <EmptyState icon={meta.icon} title={`No ${meta.plural.toLowerCase()} yet`}>
        {kind === "recorded"
          ? "No class work, homework, midterm or CA exam has been recorded for this student this term."
          : `No ${meta.plural.toLowerCase()} have been set in this student's subjects this term.`}
      </EmptyState>
    );
  }

  return (
    <div className="space-y-4">
      {attention.length > 0 && filter !== "attention" && (
        <div
          role="status"
          className={`flex flex-wrap items-center gap-3 px-4 py-3 rounded-2xl ring-1 ${TONE_CLASSES.danger.chip}`}
        >
          <BellRing className="w-4 h-4 flex-shrink-0" />
          <p className="text-sm flex-1 min-w-0">
            <strong className="font-semibold">
              {attention.length} {attention.length === 1 ? "item needs" : "items need"} attention
            </strong>
            <span className="opacity-80"> — {summaryParts.join(" · ")}</span>
          </p>
          <button
            type="button"
            onClick={() => onFilter("attention")}
            className="text-xs font-semibold underline underline-offset-2 hover:no-underline"
          >
            Show them
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <SubjectSelect subjects={subjects} value={subjectId} onChange={onSubject} />
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${meta.plural.toLowerCase()}…`}
            aria-label={`Search ${meta.plural.toLowerCase()}`}
            className="h-9 w-56 max-w-full pl-9 pr-3 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </div>
        <Segmented label="Status" value={filter} options={filterOptions} onChange={onFilter} />
      </div>

      {groups.length === 0 ? (
        <div className={CARD}>
          <EmptyState icon={meta.icon} title="Nothing matches these filters">
            <button type="button" className="text-blue-600 hover:underline" onClick={() => { onFilter("all"); onSubject(null); setQuery(""); }}>
              Clear filters
            </button>
          </EmptyState>
        </div>
      ) : (
        groups.map((group) => {
          const open = !collapsed.has(group.courseId);
          return (
            <section key={group.courseId} className={`${CARD} overflow-hidden`} data-testid={`activity-group-${group.courseId}`}>
              <button
                type="button"
                aria-expanded={open}
                onClick={() => toggle(group.courseId)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left bg-gray-50/70 dark:bg-white/[0.03] hover:bg-gray-100/70 dark:hover:bg-white/5 transition-colors"
              >
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? "" : "-rotate-90"}`} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-text-primary-light dark:text-text-primary-dark truncate">
                    {group.name}
                  </span>
                  <span className="block text-[11px] text-text-secondary-light dark:text-text-secondary-dark/60">
                    {group.code && `${group.code} · `}
                    {group.marked}/{group.items.length} marked
                  </span>
                </span>
                {group.attention > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ring-1 ${TONE_CLASSES.danger.chip}`}>
                    {group.attention} need{group.attention === 1 ? "s" : ""} attention
                  </span>
                )}
                <span className="text-right">
                  <span className="block text-[10px] uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark/50">
                    Avg
                  </span>
                  <Pct value={group.average} className="text-sm font-bold" />
                </span>
              </button>
              <AnimatePresence initial={false}>
                {open && (
                  <motion.ul
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="divide-y divide-gray-100 dark:divide-gray-800 overflow-hidden"
                  >
                    {group.items.map((item) => (
                      <li key={item.key}>
                        <ActivityRow item={item} href={linkFor(item)} />
                      </li>
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>
            </section>
          );
        })
      )}
    </div>
  );
}

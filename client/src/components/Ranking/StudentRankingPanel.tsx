import { useState, type ElementType } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  ChevronDown,
  Lightbulb,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { Meter, Pct, EmptyState } from "../Students/profile/profileParts";
import { CARD, KIND_META } from "../Students/profile/profileTheme";
import {
  ordinal,
  type PendingItem,
  type StudentRanking,
  type Suggestion,
} from "../../services/rankingApi";
import { HowItWorks, StatusChip } from "./rankingParts";
import RankHero from "./RankHero";

// What a student sees: their own position, how each subject is going, what's
// outstanding and what to do next. Never anyone else's name or mark — the
// server doesn't send them.

const PRIORITY_STYLE: Record<Suggestion["priority"], { ring: string; icon: string; label: string }> = {
  high: { ring: "border-l-red-500", icon: "text-red-500", label: "Do this first" },
  medium: { ring: "border-l-amber-500", icon: "text-amber-500", label: "Worth doing" },
  low: { ring: "border-l-blue-500", icon: "text-blue-500", label: "Tip" },
};

const CATEGORY_ICON: Record<Suggestion["category"], ElementType> = {
  deadline: CalendarClock,
  subject: AlertTriangle,
  skill: Target,
  review: Lightbulb,
  rank: TrendingUp,
  strength: Sparkles,
  getting_started: Trophy,
};

const PENDING_STYLE: Record<PendingItem["status"], { label: string; className: string }> = {
  overdue: { label: "Overdue", className: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300" },
  due_soon: { label: "Due soon", className: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300" },
  missed: { label: "Missed", className: "bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-300" },
  open: { label: "Open", className: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300" },
  awaiting_mark: { label: "Awaiting mark", className: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300" },
};

const pendingHref = (p: PendingItem) =>
  p.kind === "assignment" ? `/assignments/${p.item_id}` : p.kind === "quiz" ? "/my-quizzes" : `/courses/${p.course_id}`;

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : null;

interface Props {
  data: StudentRanking;
  /** Open a subject's ranking (the page filters; the course tab passes nothing). */
  onSelectSubject?: (courseId: string) => void;
  scopedToSubject: boolean;
}

export default function StudentRankingPanel({ data, onSelectSubject, scopedToSubject }: Props) {
  const { subjects, suggestions, pending } = data;
  const [showAllPending, setShowAllPending] = useState(false);
  const subjectName = scopedToSubject ? subjects[0]?.name : null;
  const nameOf = new Map(data.available_subjects.map((s) => [s.course_id, s.name]));
  const actionable = pending.filter((p) => p.status !== "awaiting_mark");
  const awaiting = pending.filter((p) => p.status === "awaiting_mark");
  const shownPending = showAllPending ? pending : pending.slice(0, 6);

  return (
    <div className="space-y-4">
      {/* Hero — the position */}
      <RankHero data={data} subjectName={subjectName ?? null} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {/* Suggestions */}
        <section className={`${CARD} p-4 sm:p-5`}>
          <header className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-5 h-5 text-amber-500" />
            <h3 className="text-base font-bold text-text-primary-light dark:text-text-primary-dark">What to do next</h3>
            {suggestions.length > 0 && (
              <span className="ml-auto text-xs text-text-secondary-light dark:text-text-secondary-dark/60">
                {suggestions.length} suggestion{suggestions.length === 1 ? "" : "s"}
              </span>
            )}
          </header>
          {suggestions.length === 0 ? (
            <EmptyState icon={Sparkles} title="Nothing urgent">
              You're up to date. Keep handing work in on time and reviewing your corrections.
            </EmptyState>
          ) : (
            <ul className="space-y-2.5">
              {suggestions.map((s) => {
                const style = PRIORITY_STYLE[s.priority];
                const Icon = CATEGORY_ICON[s.category];
                return (
                  <li key={s.id} className={`rounded-xl border border-gray-100 dark:border-gray-800 border-l-4 ${style.ring} bg-gray-50/50 dark:bg-white/[0.02] p-3`}>
                    <div className="flex items-start gap-3">
                      <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${style.icon}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <p className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">{s.title}</p>
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${style.icon}`}>{style.label}</span>
                        </div>
                        <p className="mt-0.5 text-xs leading-relaxed text-text-secondary-light dark:text-text-secondary-dark/80">{s.detail}</p>
                        {s.action && (
                          <Link to={s.action.href} className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline">
                            {s.action.label}
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Outstanding work */}
        <section className={`${CARD} p-4 sm:p-5`}>
          <header className="flex items-center gap-2 mb-3">
            <CalendarClock className="w-5 h-5 text-blue-500" />
            <h3 className="text-base font-bold text-text-primary-light dark:text-text-primary-dark">Outstanding work</h3>
            <span className="ml-auto text-xs text-text-secondary-light dark:text-text-secondary-dark/60">
              {actionable.length} to do{awaiting.length ? ` · ${awaiting.length} awaiting mark` : ""}
            </span>
          </header>
          {pending.length === 0 ? (
            <EmptyState icon={CalendarClock} title="All caught up">
              No assignments or quizzes are waiting for you.
            </EmptyState>
          ) : (
            <>
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {shownPending.map((p) => {
                  const Kind = KIND_META[p.kind].icon;
                  const style = PENDING_STYLE[p.status];
                  const due = formatDate(p.due_date);
                  return (
                    <li key={`${p.kind}-${p.item_id}`}>
                      <Link to={pendingHref(p)} className="flex items-center gap-3 py-2.5 group">
                        <Kind className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate text-text-primary-light dark:text-text-primary-dark group-hover:text-blue-600 dark:group-hover:text-blue-400">
                            {p.title}
                          </p>
                          <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark/60 truncate">
                            {nameOf.get(p.course_id) ?? "Subject"}
                            {due && ` · ${p.kind === "quiz" ? "closes" : "due"} ${due}`}
                          </p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${style.className}`}>{style.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              {pending.length > 6 && (
                <button
                  type="button"
                  onClick={() => setShowAllPending((v) => !v)}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400"
                >
                  {showAllPending ? "Show less" : `Show all ${pending.length}`}
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAllPending ? "rotate-180" : ""}`} />
                </button>
              )}
            </>
          )}
        </section>
      </div>

      {/* Subjects */}
      <section className={`${CARD} p-4 sm:p-5`}>
        <header className="flex items-center gap-2 mb-3">
          <Target className="w-5 h-5 text-blue-500" />
          <h3 className="text-base font-bold text-text-primary-light dark:text-text-primary-dark">
            {scopedToSubject ? "Subject breakdown" : "Your subjects"}
          </h3>
          {!scopedToSubject && (
            <span className="ml-auto text-xs text-text-secondary-light dark:text-text-secondary-dark/60">Weakest first</span>
          )}
        </header>
        {subjects.length === 0 ? (
          <EmptyState icon={Target} title="No subjects this term">
            You aren't enrolled in any subject for the selected period.
          </EmptyState>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {[...subjects]
              .sort((a, b) => (a.score ?? 101) - (b.score ?? 101))
              .map((s) => (
                <article key={s.course_id} className="min-w-0 rounded-xl border border-gray-100 dark:border-gray-800 p-3 sm:p-4">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark truncate">{s.name}</p>
                      <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark/60">
                        {s.rank !== null ? `${ordinal(s.rank)} of ${s.ranked_count}` : "Not ranked yet"}
                        {s.pending_count > 0 && ` · ${s.pending_count} to do`}
                      </p>
                    </div>
                    <div className="text-right">
                      <Pct value={s.score} className="text-lg font-bold" />
                      <div className="mt-0.5">
                        <StatusChip status={s.status} />
                      </div>
                    </div>
                  </div>
                  <div className="mt-3">
                    <Meter value={s.score} reference={s.class_average} />
                    <div className="mt-1 flex justify-between text-[11px] text-text-secondary-light dark:text-text-secondary-dark/60">
                      <span>
                        {s.class_average !== null ? `Class average ${s.class_average}%` : "Class average hidden"}
                      </span>
                      {s.gap !== null && (
                        <span className={s.gap >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
                          {s.gap > 0 ? "+" : ""}
                          {s.gap} pts
                        </span>
                      )}
                    </div>
                  </div>
                  {Object.keys(s.by_kind).length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {(Object.entries(s.by_kind) as Array<[keyof typeof KIND_META, { score: number; count: number }]>).map(([k, v]) => (
                        <span key={k} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-white/5 text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
                          {KIND_META[k].plural}
                          <Pct value={v.score} className="font-semibold" />
                          <span className="opacity-60">×{v.count}</span>
                        </span>
                      ))}
                    </div>
                  )}
                  {s.weakest.length > 0 && (
                    <div className="mt-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark/60 mb-1">
                        Review these
                      </p>
                      <ul className="space-y-1">
                        {s.weakest.map((w) => (
                          <li key={`${w.kind}-${w.item_id}`} className="flex items-center gap-2 text-xs">
                            <span className="truncate flex-1 text-text-primary-light dark:text-text-primary-dark">{w.title}</span>
                            <Pct value={w.pct} className="font-semibold" />
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="mt-3 flex items-center gap-3 text-xs font-semibold">
                    {!scopedToSubject && onSelectSubject && (
                      <button type="button" onClick={() => onSelectSubject(s.course_id)} className="text-blue-600 dark:text-blue-400 hover:underline">
                        Ranking in this subject
                      </button>
                    )}
                    <Link to={`/courses/${s.course_id}`} className="text-text-secondary-light dark:text-text-secondary-dark hover:text-blue-600 dark:hover:text-blue-400">
                      Open subject
                    </Link>
                  </div>
                </article>
              ))}
          </div>
        )}
      </section>

      <HowItWorks audience="student" />
    </div>
  );
}

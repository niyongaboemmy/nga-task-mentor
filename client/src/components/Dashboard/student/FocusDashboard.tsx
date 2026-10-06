import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, RefreshCw } from "lucide-react";
import { useNow, formatRemaining } from "../../Common/LiveCountdown";
import {
  PASS_MARK,
  subjectLabel,
  TODO_STATES,
  type StudentSubjectSummary,
  type StudentTask,
} from "../../../services/studentOverviewApi";

/**
 * The student dashboard's building blocks ("Focus" layout, chosen from three
 * mockups): one blue hero that says in words what to do next, subject cards
 * that each carry their own next step, then what's coming up and recent marks.
 */

const card = "rounded-2xl bg-card-light dark:bg-card-dark/30 shadow-sm ring-1 ring-slate-200/70 dark:ring-white/[0.06]";
const ink = {
  primary: "text-text-primary-light dark:text-text-primary-dark",
  secondary: "text-text-secondary-light dark:text-text-secondary-dark",
};

const DAY = 86400000;

const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** "Today 17:00", "Wed 09:00", "3 Oct 23:59" -- short enough for a list column. */
export function whenLabel(iso: string, now = Date.now()): string {
  const d = new Date(iso);
  const days = Math.floor((new Date(d).setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) / DAY);
  const t = clock(iso);
  if (days === 0) return `Today ${t}`;
  if (days === 1) return `Tomorrow ${t}`;
  if (days > 1 && days < 7) return `${d.toLocaleDateString([], { weekday: "short" })} ${t}`;
  return `${d.toLocaleDateString([], { day: "numeric", month: "short" })} ${t}`;
}

const kindWord = (t: StudentTask) => (t.kind === "quiz" ? (t.quiz_type?.toLowerCase() === "exam" ? "exam" : "quiz") : "assignment");

// ─── Hero ─────────────────────────────────────────────────────────────────────

/** The sentence at the top: what to do, in the order to do it. */
function headline(first: StudentTask | null, second: StudentTask | null): string {
  if (!first) return "You're all caught up.";
  const one = first.state === "in_progress" ? `Finish your ${first.title} ${kindWord(first)}` : `Finish ${first.title}`;
  return second ? `${one},\nthen ${second.title}.` : `${one}.`;
}

function detail(t: StudentTask, now: number): string | null {
  if (t.state === "in_progress" && t.countdown_to) {
    const left = formatRemaining(new Date(t.countdown_to).getTime() - now);
    return left ? `${t.title} time left ${left}` : null;
  }
  if (t.due_at) return `${t.title} due ${whenLabel(t.due_at, now).replace(/^Today/, "today").replace(/^Tomorrow/, "tomorrow")}`;
  return null;
}

export const FocusHero: React.FC<{
  greeting: string;
  first: StudentTask | null;
  second: StudentTask | null;
  upcomingLater: number;
  weekDone: number;
  weekTotal: number;
  average: number | null;
  rank: number | null;
  rankedCount: number;
  showRank: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onSeeWeek: () => void;
}> = ({ greeting, first, second, upcomingLater, weekDone, weekTotal, average, rank, rankedCount, showRank, refreshing, onRefresh, onSeeWeek }) => {
  const now = useNow();
  const lines = [first, second].filter((t): t is StudentTask => !!t).map((t) => detail(t, now)).filter(Boolean);
  const pct = weekTotal ? Math.round((weekDone / weekTotal) * 100) : 0;
  const date = new Date(now).toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" });

  return (
    <section
      id="today"
      aria-label="What to do next"
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 to-blue-800 p-6 sm:p-8 text-white shadow-lg scroll-mt-24"
    >
      <div aria-hidden className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10" />
      <div aria-hidden className="absolute -bottom-20 right-40 h-48 w-48 rounded-full bg-white/5" />
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        aria-label="Refresh"
        className="absolute right-4 top-4 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white/80 hover:bg-white/20 hover:text-white disabled:opacity-60"
      >
        <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
      </button>

      <div className="relative flex flex-wrap items-center gap-8">
        <div className="min-w-0 flex-1 basis-[22rem]">
          <p className="text-sm font-medium text-blue-100">
            {greeting} · {date}
          </p>
          <h2 className="mt-2 whitespace-pre-line text-2xl sm:text-3xl font-bold leading-tight">{headline(first, second)}</h2>
          {lines.length > 0 ? (
            <p className="mt-2 text-blue-100">{lines.join(" · ")}</p>
          ) : (
            <p className="mt-2 text-blue-100">{upcomingLater ? `${upcomingLater} coming up later` : "No open work right now."}</p>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
            {first?.action && (
              <Link
                to={first.action.url}
                className="inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-blue-700 shadow hover:bg-blue-50"
              >
                {first.action.label} <ArrowRight className="h-4 w-4" />
              </Link>
            )}
            <button
              type="button"
              onClick={onSeeWeek}
              className="rounded-full bg-white/15 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/25"
            >
              See my week
            </button>
          </div>
        </div>

        <div className="flex items-center gap-6 sm:gap-8">
          <div className="relative h-28 w-28 sm:h-32 sm:w-32" role="img" aria-label={`${weekDone} of ${weekTotal} done this week`}>
            <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(255,255,255,.2)" strokeWidth="3.2" />
              <circle
                cx="18"
                cy="18"
                r="15.5"
                fill="none"
                stroke="#fff"
                strokeWidth="3.2"
                strokeLinecap="round"
                pathLength={100}
                strokeDasharray={`${pct} 100`}
              />
            </svg>
            <div className="absolute inset-0 grid place-items-center text-center">
              <div>
                <p className="text-2xl font-bold tabular-nums">
                  {weekDone}/{weekTotal}
                </p>
                <p className="text-[11px] text-blue-100">this week</p>
              </div>
            </div>
          </div>
          <div className="space-y-3 text-sm">
            <p>
              <span className="text-2xl font-bold tabular-nums">{average == null ? "—" : `${Math.round(average)}%`}</span>{" "}
              <span className="text-blue-100">average</span>
            </p>
            {showRank && (
              <Link to="/ranking" className="block hover:underline" aria-label="Open my ranking">
                <span className="text-2xl font-bold tabular-nums">{rank ? `#${rank}` : "—"}</span>{" "}
                <span className="text-blue-100">{rank ? `of ${rankedCount} in class` : "ranked after first marks"}</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

// ─── Subject cards ────────────────────────────────────────────────────────────

const TONES = [
  "bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300",
  "bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300",
  "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
  "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
  "bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300",
  "bg-cyan-50 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-300",
];

/** A short code when the subject has one (JS, DB, ENG); otherwise two
 *  letters from the name ("Web Application Development" -> "WA"). Long codes
 *  such as SPEWI302 share their prefix across a department, so they are skipped. */
const badge = (s: StudentSubjectSummary) =>
  s.subject_code && s.subject_code.length <= 4 ? s.subject_code.toUpperCase() : initials(s.subject_name);

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w) && !/^(of|and|the|using|with|for|to|in)$/i.test(w))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("") || name.slice(0, 2).toUpperCase();

export interface SubjectCardData {
  subject: StudentSubjectSummary;
  me: number | null;
  classAvg: number | null;
  next: StudentTask | null;
  latest: StudentTask | null;
}

export const SubjectCard: React.FC<{ data: SubjectCardData; index: number }> = ({ data, index }) => {
  const { subject, me, classAvg, next, latest } = data;
  const below = me != null && classAvg != null && me < classAvg;
  const now = Date.now();
  return (
    <Link
      to={`/courses/${subject.subject_id}`}
      aria-label={`Open ${subject.subject_name}`}
      className={`${card} group flex flex-col p-5 transition-shadow hover:shadow-md`}
    >
      <div className="flex items-center justify-between">
        <span className={`grid h-10 w-10 place-items-center rounded-xl text-sm font-bold ${TONES[index % TONES.length]}`}>{badge(subject)}</span>
        <span className={`text-2xl font-bold tabular-nums ${me == null ? "text-slate-300 dark:text-slate-600" : below ? "text-amber-600 dark:text-amber-400" : ink.primary}`}>
          {me == null ? "—" : `${Math.round(me)}%`}
        </span>
      </div>
      <p className={`mt-3 font-semibold leading-snug ${ink.primary} group-hover:text-blue-700 dark:group-hover:text-blue-300`}>{subject.subject_name}</p>
      <p className={`text-xs ${ink.secondary}`}>
        {me == null ? "no marks yet" : classAvg != null ? `class ${Math.round(classAvg)}%${below ? " · below average" : ""}` : subjectLabel(subject)}
      </p>
      <div className="mt-auto pt-4">
        {next ? (
          <div className={`rounded-xl px-3 py-2 text-sm ${next.state === "due_today" || next.state === "in_progress" ? "bg-red-50 dark:bg-red-500/10" : "bg-blue-50/70 dark:bg-blue-500/10"}`}>
            <p className={`text-xs font-semibold ${next.state === "due_today" || next.state === "in_progress" ? "text-red-700 dark:text-red-300" : "text-blue-700 dark:text-blue-300"}`}>
              Next · {next.state === "in_progress" ? "in progress now" : next.state === "not_open" && next.opens_at ? `opens ${whenLabel(next.opens_at, now).toLowerCase()}` : next.due_at ? whenLabel(next.due_at, now).toLowerCase() : "open now"}
            </p>
            <p className={`truncate font-medium ${ink.primary}`}>{next.title}</p>
          </div>
        ) : latest ? (
          <div className="rounded-xl bg-slate-50 dark:bg-white/[0.04] px-3 py-2 text-sm">
            <p className={`text-xs font-semibold ${ink.secondary}`}>Latest mark</p>
            <p className={`truncate font-medium ${ink.primary}`}>
              {latest.title} · {Math.round(latest.score_pct ?? 0)}%
            </p>
          </div>
        ) : (
          <p className={`rounded-xl bg-slate-50 dark:bg-white/[0.04] px-3 py-2 text-sm ${ink.secondary}`}>{me == null ? "Nothing set yet" : "Nothing due right now"}</p>
        )}
      </div>
    </Link>
  );
};

// ─── Coming up ────────────────────────────────────────────────────────────────

export const ComingUp: React.FC<{ tasks: StudentTask[] }> = ({ tasks }) => {
  const now = Date.now();
  const upcoming = tasks
    .filter((t) => TODO_STATES.includes(t.state) || t.state === "not_open")
    .map((t) => ({ t, at: t.state === "not_open" ? t.opens_at : t.due_at }))
    // What's running now first, then by time.
    .sort((a, b) => Number(b.t.state === "in_progress") - Number(a.t.state === "in_progress") || (a.at ?? "9").localeCompare(b.at ?? "9"));
  const missed = tasks.filter((t) => t.state === "missed");

  if (upcoming.length === 0 && missed.length === 0) {
    return <p className={`py-6 text-center text-sm ${ink.secondary}`}>Nothing due. New work shows up here as soon as it's set.</p>;
  }
  return (
    <ul className="divide-y divide-slate-100 dark:divide-white/[0.06] text-sm">
      {upcoming.map(({ t, at }) => {
        const urgent = t.state === "in_progress" || t.state === "due_today";
        return (
          <li key={`${t.kind}-${t.id}`}>
            <Link to={t.action?.url ?? "#"} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-3 hover:bg-slate-50 dark:hover:bg-white/[0.04]">
              <span className={`w-28 shrink-0 font-semibold tabular-nums ${urgent ? "text-red-600 dark:text-red-400" : ink.secondary}`}>
                {t.state === "in_progress" ? "In progress" : at ? whenLabel(at, now) : "Open"}
              </span>
              <span className={`min-w-0 flex-1 truncate font-medium ${ink.primary}`}>
                {t.title}
                {t.kind === "quiz" && <span className={`font-normal ${ink.secondary}`}> · {kindWord(t)}{t.state === "not_open" ? " opens" : ""}</span>}
              </span>
              <span className={`hidden shrink-0 sm:inline ${ink.secondary}`}>{t.subject_name}</span>
            </Link>
          </li>
        );
      })}
      {missed.map((t) => (
        <li key={`${t.kind}-${t.id}`} className="flex items-center gap-3 py-3">
          <span className="w-28 shrink-0 font-semibold text-red-600 dark:text-red-400">Missed</span>
          <span className={`min-w-0 flex-1 truncate font-medium ${ink.primary}`}>{t.title}</span>
          <span className={`hidden shrink-0 sm:inline ${ink.secondary}`}>{t.subject_name}</span>
        </li>
      ))}
    </ul>
  );
};

// ─── Recent marks ─────────────────────────────────────────────────────────────

export const MarksBars: React.FC<{ tasks: StudentTask[]; limit?: number }> = ({ tasks, limit = 6 }) => {
  const marks = tasks
    .filter((t) => t.state === "graded" && t.score_pct != null)
    .sort((a, b) => (a.graded_at ?? "").localeCompare(b.graded_at ?? ""))
    .slice(-limit);
  if (marks.length === 0) {
    return <p className={`py-6 text-center text-sm ${ink.secondary}`}>No marks yet this term.</p>;
  }
  const latest = marks[marks.length - 1];
  return (
    <div className="flex h-36 items-end gap-3" role="img" aria-label={`Recent marks: ${marks.map((m) => `${m.title} ${Math.round(m.score_pct!)}%`).join(", ")}`}>
      {marks.map((m) => {
        const pct = Math.max(4, Math.round(m.score_pct!));
        const low = pct < PASS_MARK;
        const tone = low ? "bg-red-400" : m === latest ? "bg-blue-600" : "bg-blue-300 dark:bg-blue-500/60";
        return (
          <Link key={`${m.kind}-${m.id}`} to={m.action?.url ?? "#"} title={`${m.title}: ${pct}%`} className="group flex h-full min-w-0 flex-1 flex-col justify-end text-center">
            <span className={`text-xs font-semibold tabular-nums ${low ? "text-red-600 dark:text-red-400" : ink.primary}`}>{pct}</span>
            <div className="mt-1 flex min-h-0 flex-1 items-end justify-center">
              <div className={`w-full max-w-[2.5rem] rounded-t-lg ${tone} transition-opacity group-hover:opacity-80`} style={{ height: `${pct}%` }} />
            </div>
            <p className={`mt-1.5 truncate text-[11px] ${ink.secondary}`}>{subjectLabel(m)}</p>
          </Link>
        );
      })}
    </div>
  );
};

export { card as focusCard, ink as focusInk };

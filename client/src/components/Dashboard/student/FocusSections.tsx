import React, { useMemo, useState, useSyncExternalStore } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  BellRing,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Info,
  Lightbulb,
  LineChart,
  Trophy,
  X,
} from "lucide-react";
import {
  PASS_MARK,
  reminderToAlert,
  subjectLabel,
  TODO_STATES,
  type StudentOverview,
  type StudentReminder,
  type StudentTask,
} from "../../../services/studentOverviewApi";
import { dismissAlert, getAlertsVersion, isImportant, subscribeAlerts, visibleAlerts } from "../../../services/alertStore";
import { focusCard as card, focusInk as ink, whenLabel } from "./FocusDashboard";

/**
 * The rest of the student dashboard, in the Focus style: the at-a-glance
 * numbers, reminders, the week, every task by what it needs, marks over time,
 * and tips. Each section is a plain card with a title row; colour only carries
 * meaning (blue = act, red = late or low, amber = below the class).
 */

const DAY = 86400000;

/** A card with a title row: icon, title, optional subtitle and a right-hand action. */
export const Section: React.FC<{
  id?: string;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}> = ({ id, title, subtitle, icon, action, className = "", children }) => (
  <section id={id} aria-labelledby={id ? `${id}-title` : undefined} className={`${card} scroll-mt-24 p-5 sm:p-6 ${className}`}>
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300">{icon}</span>
        <div className="min-w-0">
          <h2 id={id ? `${id}-title` : undefined} className={`text-base font-semibold ${ink.primary}`}>
            {title}
          </h2>
          {subtitle && <p className={`text-xs ${ink.secondary}`}>{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
    {children}
  </section>
);

// ─── At a glance ──────────────────────────────────────────────────────────────

const Tile: React.FC<{ label: string; children: React.ReactNode; onClick?: () => void; to?: string; ariaLabel?: string }> = ({
  label,
  children,
  onClick,
  to,
  ariaLabel,
}) => {
  const body = (
    <>
      <p className={`text-xs font-semibold uppercase tracking-wide ${ink.secondary}`}>{label}</p>
      <div className="mt-2">{children}</div>
    </>
  );
  const cls = `${card} block h-full p-5 text-left transition-shadow hover:shadow-md`;
  if (to) return <Link to={to} aria-label={ariaLabel} className={cls}>{body}</Link>;
  if (onClick) return <button type="button" onClick={onClick} aria-label={ariaLabel} className={`${cls} w-full`}>{body}</button>;
  return <div className={cls}>{body}</div>;
};

/** A thin bar for a percentage, with an optional tick (class average). */
export const Meter: React.FC<{ value: number | null; tick?: number | null; tone?: string; label: string }> = ({ value, tick, tone = "bg-blue-600", label }) => (
  <div className="relative mt-3 h-2 rounded-full bg-slate-100 dark:bg-white/[0.08]" role="img" aria-label={label}>
    {value != null && <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />}
    {tick != null && (
      <span className="absolute -top-1 h-4 w-0.5 rounded bg-slate-700 dark:bg-slate-200" style={{ left: `calc(${Math.min(100, tick)}% - 1px)` }} aria-hidden />
    )}
  </div>
);

export const AtAGlance: React.FC<{
  summary: StudentOverview["summary"];
  todo: number;
  average: number | null;
  averageIsOverall: boolean;
  classAverage: number | null;
  rank: number | null;
  rankedCount: number;
  band: string | null;
  showRank: boolean;
  onOpenTasks: (tab: TaskTab) => void;
  onOpenMarks: () => void;
}> = ({ summary: s, todo, average, averageIsOverall, classAverage, rank, rankedCount, band, showRank, onOpenTasks, onOpenMarks }) => {
  const total = todo + s.missed + s.graded + s.awaiting_grade;
  const parts: Array<{ key: string; n: number; label: string; tone: string; tab?: TaskTab }> = [
    { key: "todo", n: todo, label: "To do", tone: "bg-blue-600", tab: "todo" },
    { key: "missed", n: s.missed, label: "Missed", tone: "bg-red-500", tab: "missed" },
    { key: "marked", n: s.graded, label: "Marked", tone: "bg-emerald-500" },
    { key: "awaiting", n: s.awaiting_grade, label: "Awaiting mark", tone: "bg-amber-400", tab: "awaiting" },
  ];
  const below = average != null && classAverage != null && average < classAverage;
  return (
    <section aria-label="At a glance" className={`grid gap-4 grid-cols-2 ${showRank ? "xl:grid-cols-4" : "xl:grid-cols-3"}`}>
      <div className={`${card} col-span-2 p-5 xl:col-span-1`}>
        <p className={`text-xs font-semibold uppercase tracking-wide ${ink.secondary}`}>My tasks</p>
        <p className={`mt-2 text-3xl font-bold tabular-nums ${ink.primary}`}>
          {total} <span className={`text-sm font-medium ${ink.secondary}`}>{total === 1 ? "task" : "tasks"}</span>
        </p>
        <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.08]" aria-hidden>
          {total > 0 && parts.map((p) => (p.n ? <div key={p.key} className={p.tone} style={{ width: `${(p.n / total) * 100}%` }} /> : null))}
        </div>
        <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          {parts.map((p) => (
            <li key={p.key}>
              <button
                type="button"
                onClick={() => (p.tab ? onOpenTasks(p.tab) : onOpenMarks())}
                className={`flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left hover:bg-slate-50 dark:hover:bg-white/[0.04] ${ink.secondary}`}
              >
                <span className={`h-2 w-2 shrink-0 rounded-full ${p.tone}`} aria-hidden />
                <span className="flex-1">{p.label}</span>
                <span className={`font-semibold tabular-nums ${ink.primary}`}>{p.n}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <Tile label="Handed in" onClick={s.missed ? () => onOpenTasks("missed") : undefined}>
        <p className={`text-3xl font-bold tabular-nums ${ink.primary}`}>{s.completion_rate == null ? "—" : `${Math.round(s.completion_rate)}%`}</p>
        <Meter value={s.completion_rate} label={`Handed in ${s.completion_rate ?? 0}%`} tone={s.missed ? "bg-amber-500" : "bg-emerald-500"} />
        <p className={`mt-2 text-xs ${s.missed ? "font-medium text-red-600 dark:text-red-400" : ink.secondary}`}>
          {s.completion_rate == null ? "no closed work yet" : s.missed ? `${s.missed} missed` : "nothing missed"}
        </p>
      </Tile>

      <Tile label={averageIsOverall ? "My average" : "Recent average"}>
        <p className={`text-3xl font-bold tabular-nums ${below ? "text-amber-600 dark:text-amber-400" : ink.primary}`}>{average == null ? "—" : `${Math.round(average)}%`}</p>
        <Meter value={average} tick={classAverage} label={`My average ${average ?? "none"}, class ${classAverage ?? "unknown"}`} tone={below ? "bg-amber-500" : "bg-blue-600"} />
        <p className={`mt-2 text-xs ${ink.secondary}`}>{classAverage != null ? `class ${Math.round(classAverage)}%${below ? " · below class" : ""}` : "your marks this term"}</p>
      </Tile>

      {showRank && (
        <Tile label="Standing" to="/ranking" ariaLabel="Open my standing">
          <p className={`text-3xl font-bold tabular-nums ${ink.primary}`}>
            {rank ? `#${rank}` : "—"} {rank ? <span className={`text-sm font-medium ${ink.secondary}`}>of {rankedCount}</span> : null}
          </p>
          {/* Where you sit in the class: 1st on the right. */}
          <div className="relative mt-3 h-2 rounded-full bg-gradient-to-r from-slate-200 to-blue-200 dark:from-white/[0.08] dark:to-blue-500/30" aria-hidden>
            {rank && rankedCount > 1 && (
              <span
                className="absolute -top-1 h-4 w-4 rounded-full border-2 border-white bg-blue-600 shadow dark:border-slate-900"
                style={{ left: `calc(${((rankedCount - rank) / (rankedCount - 1)) * 100}% - 8px)` }}
              />
            )}
          </div>
          <p className={`mt-2 text-xs ${ink.secondary}`}>{rank ? band ?? "class rank" : "ranked after your first marks"}</p>
        </Tile>
      )}
    </section>
  );
};

// ─── Reminders ────────────────────────────────────────────────────────────────

const SEVERITY: Record<StudentReminder["severity"], { icon: React.ReactNode; tone: string }> = {
  critical: { icon: <AlertTriangle className="h-4 w-4" />, tone: "bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300" },
  warning: { icon: <AlertTriangle className="h-4 w-4" />, tone: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300" },
  info: { icon: <Info className="h-4 w-4" />, tone: "bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300" },
  success: { icon: <CheckCircle2 className="h-4 w-4" />, tone: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300" },
};

export const RemindersSection: React.FC<{ reminders: StudentReminder[]; className?: string }> = ({ reminders, className }) => {
  const navigate = useNavigate();
  // Re-render when a reminder is dismissed (here or from the bell).
  useSyncExternalStore(subscribeAlerts, getAlertsVersion, getAlertsVersion);
  const shown = (visibleAlerts(reminders.map(reminderToAlert)) as unknown as StudentReminder[]).filter((r) => r.id !== "all-clear");
  const urgent = shown.filter((r) => isImportant(reminderToAlert(r))).length;

  return (
    <Section
      id="reminders"
      title="Reminders"
      subtitle={urgent ? `${urgent} need${urgent === 1 ? "s" : ""} attention` : "Nothing urgent"}
      icon={<BellRing className="h-4 w-4" />}
      className={className}
    >
      {shown.length === 0 ? (
        <p className={`py-6 text-center text-sm ${ink.secondary}`}>You're all caught up.</p>
      ) : (
        <ul className="space-y-2">
          {shown.slice(0, 5).map((r) => {
            const sev = SEVERITY[r.severity] ?? SEVERITY.info;
            return (
              <li key={r.id} className="group flex items-start gap-3 rounded-xl p-2.5 hover:bg-slate-50 dark:hover:bg-white/[0.04]">
                <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${sev.tone}`}>{sev.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium ${ink.primary}`}>{r.title}</p>
                  {r.message && <p className={`line-clamp-2 text-xs ${ink.secondary}`}>{r.message}</p>}
                  {r.action && (
                    <button
                      type="button"
                      onClick={() => (r.action!.url.startsWith("#") ? document.getElementById(r.action!.url.slice(1))?.scrollIntoView({ behavior: "smooth" }) : navigate(r.action!.url))}
                      className="mt-1 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {r.action.label}
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => dismissAlert(reminderToAlert(r))}
                  aria-label={`Dismiss: ${r.title}`}
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-full opacity-60 hover:bg-slate-100 hover:opacity-100 dark:hover:bg-white/10 ${ink.secondary}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
};

// ─── This week ────────────────────────────────────────────────────────────────

const atOf = (t: StudentTask) => (t.state === "not_open" ? t.opens_at : t.due_at);
const kindWord = (t: StudentTask) => (t.kind === "quiz" ? (t.quiz_type?.toLowerCase() === "exam" ? "exam" : "quiz") : "assignment");

const TaskRow: React.FC<{ t: StudentTask; when: string; urgent?: boolean }> = ({ t, when, urgent }) => (
  <li>
    <Link to={t.action?.url ?? "#"} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-slate-50 dark:hover:bg-white/[0.04]">
      <span className={`w-24 shrink-0 text-xs font-semibold tabular-nums ${urgent ? "text-red-600 dark:text-red-400" : ink.secondary}`}>{when}</span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-sm font-medium ${ink.primary}`}>{t.title}</span>
        <span className={`block truncate text-xs ${ink.secondary}`}>
          {subjectLabel(t)} · {kindWord(t)}
        </span>
      </span>
    </Link>
  </li>
);

export const WeekSection: React.FC<{ tasks: StudentTask[]; className?: string }> = ({ tasks, className }) => {
  const [day, setDay] = useState<number | null>(null);
  const today = new Date().setHours(0, 0, 0, 0);
  const days = Array.from({ length: 7 }, (_, i) => today + i * DAY);
  const open = tasks.filter((t) => (TODO_STATES.includes(t.state) || t.state === "not_open") && atOf(t));
  const onDay = (start: number) => open.filter((t) => {
    const at = new Date(atOf(t)!).getTime();
    return at >= start && at < start + DAY;
  });
  const inWeek = open.filter((t) => {
    const at = new Date(atOf(t)!).getTime();
    return at >= today && at < today + 7 * DAY;
  });
  // What's running now first, then by time.
  const list = (day == null ? inWeek : onDay(day)).sort(
    (a, b) => Number(b.state === "in_progress") - Number(a.state === "in_progress") || atOf(a)!.localeCompare(atOf(b)!),
  );

  return (
    <Section id="week" title="This week" subtitle="Tap a day" icon={<CalendarDays className="h-4 w-4" />} className={className}>
      <div className="grid grid-cols-7 gap-1.5" role="tablist" aria-label="Days">
        {days.map((d, i) => {
          const n = onDay(d).length;
          const selected = day === d;
          const date = new Date(d);
          return (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setDay(selected ? null : d)}
              className={`flex flex-col items-center rounded-xl py-2 transition-colors ${
                selected ? "bg-blue-600 text-white" : i === 0 ? "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200" : `hover:bg-slate-50 dark:hover:bg-white/[0.04] ${ink.primary}`
              }`}
            >
              <span className={`text-[11px] font-medium ${selected ? "text-blue-100" : ink.secondary}`}>{i === 0 ? "Today" : date.toLocaleDateString([], { weekday: "short" })}</span>
              <span className="text-lg font-bold tabular-nums">{date.getDate()}</span>
              <span className={`mt-0.5 h-1.5 w-1.5 rounded-full ${n ? (selected ? "bg-white" : "bg-blue-600") : "bg-transparent"}`} aria-label={n ? `${n} due` : undefined} />
            </button>
          );
        })}
      </div>
      <p className={`mt-4 text-xs font-semibold ${ink.secondary}`}>
        {day == null ? `Next 7 days · ${inWeek.length}` : `${new Date(day).toLocaleDateString([], { weekday: "long", day: "numeric", month: "short" })} · ${list.length}`}
      </p>
      {list.length === 0 ? (
        <p className={`py-5 text-center text-sm ${ink.secondary}`}>{day == null ? "Nothing due in the next 7 days." : "Nothing due that day."}</p>
      ) : (
        <ul className="mt-1 divide-y divide-slate-100 dark:divide-white/[0.06]">
          {list.map((t) => (
            <TaskRow key={`${t.kind}-${t.id}`} t={t} when={t.state === "in_progress" ? "In progress" : whenLabel(atOf(t)!)} urgent={t.state === "due_today" || t.state === "in_progress"} />
          ))}
        </ul>
      )}
    </Section>
  );
};

// ─── My tasks ─────────────────────────────────────────────────────────────────

export type TaskTab = "todo" | "later" | "awaiting" | "missed";

const TABS: Array<{ key: TaskTab; label: string; states: StudentTask["state"][]; empty: string }> = [
  { key: "todo", label: "To do", states: ["in_progress", "due_today", "due_soon", "upcoming"], empty: "Nothing to do right now." },
  { key: "later", label: "Opening later", states: ["not_open"], empty: "Nothing scheduled to open." },
  { key: "awaiting", label: "Awaiting marks", states: ["submitted"], empty: "Nothing waiting for a mark." },
  { key: "missed", label: "Missed", states: ["missed"], empty: "Nothing missed. Well done." },
];

export const TaskBoard: React.FC<{ tasks: StudentTask[]; tab: TaskTab; onTab: (t: TaskTab) => void; className?: string }> = ({ tasks, tab, onTab, className }) => {
  const current = TABS.find((t) => t.key === tab)!;
  const rows = tasks
    .filter((t) => current.states.includes(t.state))
    // What's running now first, then by time.
    .sort((a, b) => Number(b.state === "in_progress") - Number(a.state === "in_progress") || (atOf(a) ?? t9(a)).localeCompare(atOf(b) ?? t9(b)));
  return (
    <Section id="tasks" title="My tasks" icon={<ClipboardList className="h-4 w-4" />} className={className}>
      <div className="mb-3 flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 dark:bg-white/[0.06]" role="tablist" aria-label="Task groups">
        {TABS.map((t) => {
          const n = tasks.filter((x) => t.states.includes(x.state)).length;
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onTab(t.key)}
              className={`flex flex-1 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                active ? `bg-white shadow-sm dark:bg-slate-800 ${ink.primary}` : `${ink.secondary} hover:text-text-primary-light dark:hover:text-text-primary-dark`
              }`}
            >
              {t.label}
              <span className={`rounded-full px-1.5 tabular-nums ${active ? (t.key === "missed" && n ? "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300" : "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300") : ""}`}>{n}</span>
            </button>
          );
        })}
      </div>
      {rows.length === 0 ? (
        <p className={`py-6 text-center text-sm ${ink.secondary}`}>{current.empty}</p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-white/[0.06]">
          {rows.map((t) => (
            <TaskRow
              key={`${t.kind}-${t.id}`}
              t={t}
              when={
                t.state === "in_progress"
                  ? "In progress"
                  : t.state === "missed"
                    ? "Missed"
                    : t.state === "submitted"
                      ? t.submitted_at ? `Sent ${whenLabel(t.submitted_at).replace(/^Today /, "")}` : "Handed in"
                      : atOf(t)
                        ? whenLabel(atOf(t)!)
                        : "Open"
              }
              urgent={t.state === "missed" || t.state === "due_today" || t.state === "in_progress"}
            />
          ))}
        </ul>
      )}
    </Section>
  );
};
const t9 = (t: StudentTask) => t.submitted_at ?? "9";

// ─── My marks ─────────────────────────────────────────────────────────────────

export const MarksSection: React.FC<{ tasks: StudentTask[]; className?: string }> = ({ tasks, className }) => {
  const navigate = useNavigate();
  const marks = useMemo(
    () => tasks.filter((t) => t.state === "graded" && t.score_pct != null && t.graded_at).sort((a, b) => a.graded_at!.localeCompare(b.graded_at!)),
    [tasks],
  );
  const trend = marks.slice(-12);
  const recent = [...marks].reverse().slice(0, 4);

  // A simple line over the last marks; the 50% pass line dashed behind it.
  const W = 320, H = 120, P = 8;
  const x = (i: number) => (trend.length === 1 ? W / 2 : P + (i * (W - 2 * P)) / (trend.length - 1));
  const y = (pct: number) => H - P - (Math.max(0, Math.min(100, pct)) / 100) * (H - 2 * P);
  const path = trend.map((m, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(m.score_pct!).toFixed(1)}`).join(" ");

  return (
    <Section
      id="results"
      title="My marks"
      subtitle={trend.length >= 2 ? "Over time · tap a point" : undefined}
      icon={<LineChart className="h-4 w-4" />}
      className={className}
      action={
        <Link to="/reports" className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400">
          All reports
        </Link>
      }
    >
      {trend.length >= 2 ? (
        <svg viewBox={`0 0 ${W} ${H}`} className="h-32 w-full" role="img" aria-label={`Marks over time: ${trend.map((m) => `${m.title} ${Math.round(m.score_pct!)}%`).join(", ")}`}>
          <defs>
            <linearGradient id="marksFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#2563eb" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
            </linearGradient>
          </defs>
          <line x1={P} x2={W - P} y1={y(PASS_MARK)} y2={y(PASS_MARK)} stroke="currentColor" strokeDasharray="4 4" className="text-slate-300 dark:text-slate-600" />
          <path d={`${path} L${x(trend.length - 1)},${H - P} L${x(0)},${H - P} Z`} fill="url(#marksFill)" />
          <path d={path} fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          {trend.map((m, i) => (
            <circle
              key={`${m.kind}-${m.id}`}
              cx={x(i)}
              cy={y(m.score_pct!)}
              r="4.5"
              className={`cursor-pointer ${m.score_pct! < PASS_MARK ? "fill-red-500" : "fill-blue-600"} stroke-white dark:stroke-slate-900`}
              strokeWidth="2"
              onClick={() => m.action && navigate(m.action.url)}
            >
              <title>{`${m.title}: ${Math.round(m.score_pct!)}%`}</title>
            </circle>
          ))}
        </svg>
      ) : (
        <p className={`py-4 text-center text-sm ${ink.secondary}`}>{marks.length === 1 ? "One mark so far. The chart starts with your second." : "No marks yet this term."}</p>
      )}
      {recent.length > 0 && (
        <ul className="mt-3 divide-y divide-slate-100 dark:divide-white/[0.06]">
          {recent.map((m) => {
            const pct = Math.round(m.score_pct!);
            const low = pct < PASS_MARK;
            return (
              <li key={`${m.kind}-${m.id}`}>
                <Link to={m.action?.url ?? "#"} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-slate-50 dark:hover:bg-white/[0.04]">
                  <span className={`w-12 shrink-0 text-lg font-bold tabular-nums ${low ? "text-red-600 dark:text-red-400" : ink.primary}`}>{pct}%</span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-sm font-medium ${ink.primary}`}>{m.title}</span>
                    <span className={`block truncate text-xs ${ink.secondary}`}>{subjectLabel(m)}</span>
                  </span>
                  {m.is_new && <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">New</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
};

// ─── Tips ─────────────────────────────────────────────────────────────────────

export interface Suggestion {
  id: string;
  priority: string;
  title: string;
  detail: string;
  action?: { label: string; href: string };
}

export const TipsSection: React.FC<{ tips: Suggestion[]; className?: string }> = ({ tips, className }) => (
  <Section title="Tips for you" icon={<Lightbulb className="h-4 w-4" />} className={className}>
    <ul className="space-y-3">
      {tips.slice(0, 3).map((t) => (
        <li key={t.id} className="rounded-xl bg-slate-50 p-3.5 dark:bg-white/[0.04]">
          <p className={`flex items-start gap-2 text-sm font-semibold ${ink.primary}`}>
            {t.priority === "high" ? <Trophy className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" /> : <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-300" aria-hidden />}
            {t.action ? (
              <Link to={t.action.href} className="hover:text-blue-600 dark:hover:text-blue-300">
                {t.title}
              </Link>
            ) : (
              t.title
            )}
          </p>
          <p className={`mt-1 text-xs leading-relaxed ${ink.secondary}`}>{t.detail}</p>
        </li>
      ))}
    </ul>
  </Section>
);

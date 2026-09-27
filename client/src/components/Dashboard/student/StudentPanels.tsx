import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  FileText,
  HelpCircle,
  Hourglass,
  Info,
  Lock,
  MessageSquare,
  PenLine,
  RotateCcw,
  Sparkles,
  Timer,
  X,
  XCircle,
} from "lucide-react";
import { STAT_COLORS } from "../dashboardUi";
import { LiveCountdown } from "../../Common/LiveCountdown";
import {
  PASS_MARK,
  TODO_STATES,
  subjectLabel,
  type StudentReminder,
  type StudentTask,
  type TaskState,
} from "../../../services/studentOverviewApi";

const ink = {
  primary: "text-text-primary-light dark:text-text-primary-dark",
  secondary: "text-text-secondary-light dark:text-text-secondary-dark/80",
  muted: "text-text-secondary-light/80 dark:text-text-secondary-dark/60",
};

// ─── Small pieces ─────────────────────────────────────────────────────────────

const STATE_META: Record<TaskState, { label: string; cls: string; icon: React.ReactNode }> = {
  in_progress: { label: "In progress", cls: "bg-red-50 text-red-700 dark:bg-red-900/25 dark:text-red-300", icon: <Timer className="w-3 h-3" /> },
  due_today: { label: "Due today", cls: "bg-red-50 text-red-700 dark:bg-red-900/25 dark:text-red-300", icon: <Hourglass className="w-3 h-3" /> },
  due_soon: { label: "Due soon", cls: "bg-amber-50 text-amber-700 dark:bg-amber-900/25 dark:text-amber-300", icon: <Hourglass className="w-3 h-3" /> },
  upcoming: { label: "To do", cls: "bg-blue-50 text-blue-700 dark:bg-blue-900/25 dark:text-blue-300", icon: <PenLine className="w-3 h-3" /> },
  not_open: { label: "Not open yet", cls: "bg-gray-100 text-gray-600 dark:bg-gray-700/40 dark:text-gray-300", icon: <Lock className="w-3 h-3" /> },
  submitted: { label: "Awaiting mark", cls: "bg-violet-50 text-violet-700 dark:bg-violet-900/25 dark:text-violet-300", icon: <Hourglass className="w-3 h-3" /> },
  graded: { label: "Marked", cls: "bg-blue-50 text-blue-700 dark:bg-blue-900/25 dark:text-blue-300", icon: <CheckCircle2 className="w-3 h-3" /> },
  missed: { label: "Missed", cls: "bg-gray-100 text-gray-600 dark:bg-gray-700/40 dark:text-gray-300", icon: <XCircle className="w-3 h-3" /> },
};

export const StatePill: React.FC<{ state: TaskState }> = ({ state }) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ${STATE_META[state].cls}`}>
    {STATE_META[state].icon}
    {STATE_META[state].label}
  </span>
);

const KindIcon: React.FC<{ kind: StudentTask["kind"]; className?: string }> = ({ kind, className = "w-9 h-9" }) => (
  <span className={`${className} shrink-0 rounded-xl flex items-center justify-center ${kind === "quiz" ? STAT_COLORS.violet : STAT_COLORS.blue}`}>
    {kind === "quiz" ? <ClipboardCheck className="w-4 h-4" aria-label="Quiz" /> : <FileText className="w-4 h-4" aria-label="Assignment" />}
  </span>
);

/** Subject, length and attempts as compact icon chips instead of a sentence. */
export const TaskChips: React.FC<{ task: StudentTask; light?: boolean }> = ({ task: t, light }) => {
  const chip = light
    ? "bg-white/15 text-white"
    : "bg-surface-light dark:bg-surface-dark/70 text-text-secondary-light dark:text-text-secondary-dark";
  const items: Array<{ key: string; icon?: React.ReactNode; text: string; title: string }> = [
    { key: "s", text: subjectLabel(t), title: t.subject_name },
  ];
  if (t.question_count) items.push({ key: "q", icon: <HelpCircle className="w-3 h-3" />, text: String(t.question_count), title: `${t.question_count} questions` });
  if (t.duration_minutes) items.push({ key: "d", icon: <Timer className="w-3 h-3" />, text: `${t.duration_minutes}m`, title: `About ${t.duration_minutes} minutes` });
  if (t.kind === "assignment" && t.max_score) items.push({ key: "p", text: `${t.max_score} pts`, title: `Out of ${t.max_score} points` });
  if (t.kind === "quiz" && t.max_attempts && TODO_STATES.includes(t.state)) {
    const left = t.max_attempts - t.attempts_used;
    items.push({ key: "a", icon: <RotateCcw className="w-3 h-3" />, text: `${left}/${t.max_attempts}`, title: `${left} of ${t.max_attempts} attempts left` });
  }
  return (
    <span className="inline-flex flex-wrap gap-1">
      {items.map((i) => (
        <span key={i.key} title={i.title} aria-label={i.title} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-medium ${chip}`}>
          {i.icon}
          {i.text}
        </span>
      ))}
    </span>
  );
};

const ActionButton: React.FC<{ task: StudentTask }> = ({ task }) => {
  if (!task.action) return null;
  const strong = task.state === "in_progress" || task.state === "due_today" || task.state === "due_soon";
  return (
    <Link
      to={task.action.url}
      className={`shrink-0 inline-flex items-center gap-1 rounded-full text-xs font-semibold px-3 py-1.5 transition-colors ${
        strong
          ? "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
          : "bg-surface-light dark:bg-surface-dark text-text-primary-light dark:text-text-primary-dark hover:bg-blue-50 dark:hover:bg-blue-900/20"
      }`}
    >
      {task.action.label}
      <ArrowRight className="w-3.5 h-3.5" />
    </Link>
  );
};

// ─── Focus card ───────────────────────────────────────────────────────────────

/** The one thing to do first. Always blue; urgency lives in the countdown chip. */
export const FocusCard: React.FC<{ task: StudentTask | null; nextDeadline: string | null; upcoming: number }> = ({
  task,
  nextDeadline,
  upcoming,
}) => {
  const base = "rounded-2xl p-5 text-white shadow-sm bg-blue-600";
  if (!task) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`${base} flex items-center gap-4`}>
        <span className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
          <Sparkles className="w-5 h-5" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-lg font-semibold">All caught up</p>
          <p className="text-sm text-white/80">{upcoming ? `${upcoming} coming up later` : "No open work"}</p>
        </div>
        {nextDeadline && <LiveCountdown to={nextDeadline} kind="due" className="!bg-white/15 !text-white" />}
      </motion.div>
    );
  }
  const running = task.state === "in_progress";
  const hot = running || task.state === "due_today";
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={base}>
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <span className="hidden sm:flex w-12 h-12 rounded-xl bg-white/15 items-center justify-center shrink-0">
          {task.kind === "quiz" ? <ClipboardCheck className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/75">
            {running ? "In progress · finish first" : task.state === "due_today" ? "Due today" : "Up next"}
          </p>
          <h3 className="text-xl font-bold leading-snug truncate">{task.title}</h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <TaskChips task={task} light />
            {task.has_draft && <span className="px-1.5 py-0.5 rounded-md text-[11px] font-semibold bg-amber-300 text-amber-950">Draft saved</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {task.countdown_to && task.countdown_label && (
            <span className={running ? "animate-pulse" : ""}>
              <LiveCountdown
                to={task.countdown_to}
                kind={task.countdown_label}
                className={hot ? "!bg-red-500 !text-white text-sm px-3 py-1.5" : "!bg-white/15 !text-white text-sm px-3 py-1.5"}
              />
            </span>
          )}
          {task.action && (
            <Link to={task.action.url} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-blue-700 font-semibold text-sm hover:bg-blue-50 shadow">
              {task.action.label}
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// ─── Reminders ────────────────────────────────────────────────────────────────

const R_ICON: Record<StudentReminder["severity"], React.ReactNode> = {
  critical: <AlertOctagon className="w-4 h-4 text-red-600 dark:text-red-400" aria-label="Urgent" />,
  warning: <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" aria-label="Attention" />,
  info: <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" aria-label="FYI" />,
  success: <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" aria-label="Good news" />,
};
const R_BAR: Record<StudentReminder["severity"], string> = {
  critical: "bg-red-500",
  warning: "bg-amber-500",
  info: "bg-blue-500",
  success: "bg-blue-300",
};
const reminderKind = (id: string) => (id.startsWith("running-") ? "time_left" : id.startsWith("opens-") ? "opens" : "due");

/** One line per reminder; tap it to read the detail. */
export const ReminderList: React.FC<{
  reminders: StudentReminder[];
  isNew: (r: StudentReminder) => boolean;
  onAction: (r: StudentReminder) => void;
  onDismiss: (r: StudentReminder) => void;
  limit?: number;
}> = ({ reminders, isNew, onAction, onDismiss, limit = 5 }) => {
  const [open, setOpen] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const list = reminders.filter((r) => r.id !== "all-clear");
  if (list.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <CheckCircle2 className="w-8 h-8 text-blue-500 mb-2" />
        <p className={`text-sm font-medium ${ink.primary}`}>Nothing to remind you about</p>
      </div>
    );
  }
  const shown = all ? list : list.slice(0, limit);
  return (
    <div>
      <ul className="space-y-1.5">
        {shown.map((r) => {
          const expanded = open === r.id;
          return (
            <li key={r.id} className="relative rounded-xl bg-surface-light dark:bg-surface-dark/50 overflow-hidden">
              <span className={`absolute left-0 inset-y-0 w-1 ${R_BAR[r.severity]}`} aria-hidden />
              <div className="flex items-center gap-2 pl-3 pr-2 py-2">
                <button
                  type="button"
                  onClick={() => setOpen(expanded ? null : r.id)}
                  aria-expanded={expanded}
                  className="flex-1 min-w-0 flex items-center gap-2 text-left"
                >
                  <span className="shrink-0 self-start mt-0.5">{R_ICON[r.severity]}</span>
                  <span className="flex-1 min-w-0">
                    <span className={`block text-sm font-medium leading-snug ${expanded ? "" : "line-clamp-1"} ${ink.primary}`}>{r.title}</span>
                    {(r.countdown_to || isNew(r)) && (
                      <span className="mt-1 flex items-center gap-1.5">
                        {r.countdown_to && <LiveCountdown to={r.countdown_to} kind={reminderKind(r.id)} compact />}
                        {isNew(r) && <span className="px-1.5 py-px rounded-full text-[10px] font-semibold bg-blue-600 text-white">New</span>}
                      </span>
                    )}
                  </span>
                  <ChevronDown className={`w-4 h-4 shrink-0 self-start mt-0.5 transition-transform ${expanded ? "rotate-180" : ""} ${ink.muted}`} />
                </button>
                {r.action && (
                  <button
                    type="button"
                    onClick={() => onAction(r)}
                    className="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-600 text-white hover:bg-blue-700"
                  >
                    {r.action.label}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onDismiss(r)}
                  aria-label={`Dismiss: ${r.title}`}
                  className={`shrink-0 p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 ${ink.muted}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <AnimatePresence initial={false}>
                {expanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="pl-9 pr-3 pb-2.5"
                  >
                    <p className={`text-xs ${ink.secondary}`}>{r.message}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          );
        })}
      </ul>
      {list.length > limit && (
        <button type="button" onClick={() => setAll((v) => !v)} className="mt-2 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">
          {all ? "Show fewer" : `+${list.length - limit} more`}
        </button>
      )}
    </div>
  );
};

// ─── Week agenda ──────────────────────────────────────────────────────────────

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const whenOf = (t: StudentTask) => (t.state === "not_open" ? t.opens_at : TODO_STATES.includes(t.state) ? t.due_at : null);

/** Seven days, today first. Each column's bar height is how much is due. */
export const WeekAgenda: React.FC<{
  tasks: StudentTask[];
  selected: string | null;
  onSelect: (key: string | null) => void;
}> = ({ tasks, selected, onSelect }) => {
  const days = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = dayKey(d);
      const items = tasks.filter((t) => {
        const w = whenOf(t);
        return w && dayKey(new Date(w)) === key;
      });
      return { d, key, items, i };
    });
  }, [tasks]);
  const max = Math.max(1, ...days.map((x) => x.items.length));

  return (
    <div className="grid grid-cols-7 gap-1.5 sm:gap-2" role="tablist" aria-label="This week">
      {days.map(({ d, key, items, i }) => {
        const active = selected === key;
        const urgent = items.some((t) => t.state === "in_progress" || t.state === "due_today");
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={`${d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}: ${items.length} task${items.length === 1 ? "" : "s"}`}
            onClick={() => onSelect(active ? null : key)}
            className={`rounded-xl px-1 pt-2 pb-1.5 flex flex-col items-center transition-all ${
              active
                ? "bg-blue-600 text-white shadow-md"
                : i === 0
                  ? "bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                  : "bg-surface-light dark:bg-surface-dark/50 hover:bg-gray-100 dark:hover:bg-gray-700/50"
            }`}
          >
            <span className={`text-[10px] sm:text-xs font-medium uppercase ${active ? "text-white/80" : ink.secondary}`}>
              {i === 0 ? "Today" : d.toLocaleDateString(undefined, { weekday: "short" })}
            </span>
            <span className={`text-base sm:text-lg font-bold ${active ? "text-white" : ink.primary}`}>{d.getDate()}</span>
            <span className="mt-1 h-8 w-full flex items-end justify-center" aria-hidden>
              <span
                className={`w-3 sm:w-4 rounded-t-md transition-all duration-500 ${
                  items.length === 0 ? "h-0.5 bg-gray-300 dark:bg-gray-600" : active ? "bg-white" : urgent ? "bg-red-500" : "bg-blue-500"
                }`}
                style={items.length ? { height: `${Math.max(20, (items.length / max) * 100)}%` } : undefined}
              />
            </span>
            <span className={`text-[10px] font-semibold tabular-nums h-3 ${active ? "text-white" : ink.primary}`}>{items.length || ""}</span>
          </button>
        );
      })}
    </div>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const matchesDay = (t: StudentTask, key: string) => {
  const w = t.state === "not_open" ? t.opens_at : t.due_at;
  return !!w && dayKey(new Date(w)) === key;
};

/** Under the week strip: the chosen day, else the next 7 days. */
export const WeekList: React.FC<{ tasks: StudentTask[]; day: string | null; onClear: () => void }> = ({ tasks, day, onClear }) => {
  const weekEnd = Date.now() + 7 * 86400000;
  const inWeek = tasks.filter((t) => {
    const w = whenOf(t);
    return !!w && new Date(w).getTime() <= weekEnd;
  });
  const list = day ? inWeek.filter((t) => matchesDay(t, day)) : inWeek;
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-1">
        <p className={`text-xs font-semibold uppercase tracking-wide ${ink.secondary}`}>
          {day ? "On this day" : "Next 7 days"} · {list.length}
        </p>
        {day && (
          <button type="button" onClick={onClear} className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">
            Whole week
          </button>
        )}
      </div>
      {list.length === 0 ? (
        <p className={`text-sm text-center py-5 ${ink.secondary}`}>{day ? "Nothing due that day." : "Nothing due in the next 7 days."}</p>
      ) : (
        <ul className="space-y-0.5 max-h-72 overflow-y-auto pr-1 -mx-2">
          {list.map((t) => (
            <TaskRow key={`${t.kind}-${t.id}`} task={t} />
          ))}
        </ul>
      )}
    </div>
  );
};

// ─── Task list ────────────────────────────────────────────────────────────────

export const TaskRow: React.FC<{ task: StudentTask }> = ({ task }) => (
  <motion.li
    initial={{ opacity: 0, y: 4 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-surface-light dark:hover:bg-surface-dark/50 transition-colors"
  >
    <KindIcon kind={task.kind} />
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5 min-w-0">
        <p className={`text-sm font-semibold truncate ${ink.primary}`}>{task.title}</p>
        {task.is_new && <span className="shrink-0 px-1.5 py-px rounded-full text-[10px] font-semibold bg-blue-600 text-white">New</span>}
        {task.has_draft && TODO_STATES.includes(task.state) && (
          <span className="shrink-0 px-1.5 py-px rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">Draft</span>
        )}
      </div>
      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
        <TaskChips task={task} />
        {task.countdown_to && task.countdown_label ? (
          <LiveCountdown to={task.countdown_to} kind={task.countdown_label} compact />
        ) : (
          <StatePill state={task.state} />
        )}
        {task.state === "submitted" && task.is_late && <span className={`text-[11px] ${ink.muted}`}>late</span>}
        {task.state === "graded" && task.score_pct != null && (
          <span className={`text-xs font-bold ${task.passed === false ? "text-red-600 dark:text-red-400" : "text-blue-600 dark:text-blue-400"}`}>
            {Math.round(task.score_pct)}%
          </span>
        )}
        {task.has_feedback && <MessageSquare className="w-3.5 h-3.5 text-blue-500" aria-label="Has feedback" />}
      </div>
    </div>
    <ActionButton task={task} />
  </motion.li>
);

export type BoardTab = "todo" | "coming" | "waiting" | "missed";

export const TaskBoard: React.FC<{ tasks: StudentTask[]; tab: BoardTab; onTab: (t: BoardTab) => void }> = ({ tasks, tab, onTab }) => {
  const groups: Record<BoardTab, StudentTask[]> = {
    todo: tasks.filter((t) => TODO_STATES.includes(t.state)),
    coming: tasks.filter((t) => t.state === "not_open"),
    waiting: tasks.filter((t) => t.state === "submitted"),
    missed: tasks.filter((t) => t.state === "missed"),
  };
  const labels: Record<BoardTab, string> = { todo: "To do", coming: "Opening later", waiting: "Awaiting marks", missed: "Missed" };
  const empty: Record<BoardTab, string> = {
    todo: "Nothing to do right now.",
    coming: "No quizzes scheduled to open.",
    waiting: "Nothing waiting for a mark.",
    missed: "Nothing missed in the last 30 days.",
  };
  const list = groups[tab];
  return (
    <div>
      <div className="flex gap-1 mb-3 overflow-x-auto p-1 rounded-full bg-surface-light dark:bg-surface-dark/60 w-fit max-w-full" role="tablist" aria-label="Task groups">
        {(Object.keys(groups) as BoardTab[]).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => onTab(k)}
            className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              tab === k ? "bg-blue-600 text-white shadow-sm" : `${ink.secondary} hover:text-text-primary-light dark:hover:text-text-primary-dark`
            }`}
          >
            {labels[k]} <span className="tabular-nums opacity-80">{groups[k].length}</span>
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <p className={`text-sm text-center py-8 ${ink.secondary}`}>{empty[tab]}</p>
      ) : (
        <ul className="space-y-0.5 max-h-[26rem] overflow-y-auto pr-1 -mx-2">
          {list.map((t) => (
            <TaskRow key={`${t.kind}-${t.id}`} task={t} />
          ))}
        </ul>
      )}
      {tab === "missed" && list.length > 0 && <p className={`mt-2 text-xs ${ink.muted}`}>Deadlines have passed. Ask your teacher about catching up.</p>}
    </div>
  );
};

// ─── Recent results (compact) ─────────────────────────────────────────────────

export const ResultsList: React.FC<{ tasks: StudentTask[]; limit?: number }> = ({ tasks, limit = 4 }) => {
  const graded = tasks.filter((t) => t.state === "graded").slice(0, limit);
  if (graded.length === 0) return null;
  return (
    <ul className="mt-3 space-y-1 -mx-2">
      {graded.map((t) => {
        const pct = t.score_pct ?? 0;
        const fresh = t.graded_at && Date.now() - new Date(t.graded_at).getTime() < 7 * 86400000;
        return (
          <li key={`${t.kind}-${t.id}`}>
            <Link to={t.action?.url ?? "#"} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-light dark:hover:bg-surface-dark/50 transition-colors">
              <span className={`w-10 text-right text-sm font-bold tabular-nums ${pct < PASS_MARK ? "text-red-600 dark:text-red-400" : "text-blue-600 dark:text-blue-400"}`}>
                {Math.round(pct)}%
              </span>
              <span className={`flex-1 min-w-0 text-sm truncate ${ink.primary}`}>{t.title}</span>
              {t.has_feedback && <MessageSquare className="w-3.5 h-3.5 text-blue-500 shrink-0" aria-label="Has feedback" />}
              {fresh && <span className="shrink-0 px-1.5 py-px rounded-full text-[10px] font-semibold bg-blue-600 text-white">New</span>}
              <span className={`text-[11px] shrink-0 ${ink.muted}`}>{subjectLabel(t)}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
};

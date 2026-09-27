import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Hourglass,
  Lock,
  MessageSquare,
  PenLine,
  RotateCcw,
  Sparkles,
  Timer,
  XCircle,
} from "lucide-react";
import { STAT_COLORS } from "../dashboardUi";
import { LiveCountdown } from "../../Common/LiveCountdown";
import {
  PASS_MARK,
  TODO_STATES,
  subjectLabel,
  type StudentSubjectSummary,
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
  graded: { label: "Marked", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-300", icon: <CheckCircle2 className="w-3 h-3" /> },
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

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

/** "12 questions · ~25 min · attempt 1 of 2" */
// eslint-disable-next-line react-refresh/only-export-components
export function taskMeta(t: StudentTask): string {
  const parts: string[] = [subjectLabel(t)];
  parts.push(t.kind === "quiz" ? t.quiz_type || "Quiz" : "Assignment");
  if (t.question_count) parts.push(`${t.question_count} questions`);
  if (t.duration_minutes) parts.push(`~${t.duration_minutes} min`);
  if (t.kind === "assignment" && t.max_score) parts.push(`${t.max_score} pts`);
  if (t.kind === "quiz" && t.max_attempts && TODO_STATES.includes(t.state)) {
    parts.push(`${t.max_attempts - t.attempts_used} of ${t.max_attempts} attempts left`);
  }
  return parts.join(" · ");
}

const ActionButton: React.FC<{ task: StudentTask; primary?: boolean }> = ({ task, primary }) => {
  if (!task.action) return null;
  const strong = primary || task.state === "in_progress" || task.state === "due_today";
  return (
    <Link
      to={task.action.url}
      className={`shrink-0 inline-flex items-center gap-1.5 rounded-full text-xs font-semibold transition-colors ${
        strong
          ? "px-3.5 py-2 bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
          : "px-3 py-1.5 bg-surface-light dark:bg-surface-dark text-text-primary-light dark:text-text-primary-dark hover:bg-gray-100 dark:hover:bg-gray-700"
      }`}
    >
      {task.action.label === "Retake" && <RotateCcw className="w-3.5 h-3.5" />}
      {task.action.label}
      <ArrowRight className="w-3.5 h-3.5" />
    </Link>
  );
};

// ─── Focus now ────────────────────────────────────────────────────────────────

/** The one thing to do first: a running quiz, else the nearest deadline. */
export const FocusCard: React.FC<{ task: StudentTask | null; nextCount: number }> = ({ task, nextCount }) => {
  if (!task) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-5 bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm"
      >
        <div className="flex items-center gap-3">
          <Sparkles className="w-6 h-6" />
          <div>
            <p className="text-lg font-semibold">Nothing urgent right now</p>
            <p className="text-sm text-white/85">
              {nextCount > 0 ? `${nextCount} task${nextCount === 1 ? "" : "s"} coming up. Getting ahead is the best way to stay stress-free.` : "No open work at the moment. Enjoy the break!"}
            </p>
          </div>
        </div>
      </motion.div>
    );
  }
  const running = task.state === "in_progress";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl p-5 shadow-sm text-white bg-gradient-to-br ${
        running ? "from-rose-500 to-red-600" : task.state === "due_today" ? "from-orange-500 to-rose-500" : "from-blue-600 to-indigo-600"
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-white/80">
        {running ? "Finish this first · quiz in progress" : task.state === "due_today" ? "Due today" : "Up next"}
      </p>
      <div className="mt-2 flex flex-col md:flex-row md:items-center gap-4 justify-between">
        <div className="min-w-0">
          <h3 className="text-xl font-bold leading-snug">{task.title}</h3>
          <p className="text-sm text-white/85 mt-0.5">{taskMeta(task)}</p>
          {task.has_draft && <p className="text-sm mt-1 font-medium">You have a saved draft. Submit it to count.</p>}
          {task.due_at && !running && <p className="text-xs text-white/75 mt-1">Deadline {fmtDate(task.due_at)} · late work isn't accepted</p>}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {task.countdown_to && task.countdown_label && (
            <LiveCountdown to={task.countdown_to} kind={task.countdown_label} className="!bg-white/20 !text-white text-sm px-3 py-1.5" />
          )}
          {task.action && (
            <Link
              to={task.action.url}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-gray-900 font-semibold text-sm hover:bg-white/90 shadow"
            >
              {task.action.label}
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// ─── Week agenda ──────────────────────────────────────────────────────────────

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/** Seven day columns (today first) with what's due each day; click to filter. */
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
        const when = t.state === "not_open" ? t.opens_at : TODO_STATES.includes(t.state) ? t.due_at : null;
        return when && dayKey(new Date(when)) === key;
      });
      return { d, key, items, i };
    });
  }, [tasks]);

  return (
    <div className="grid grid-cols-7 gap-1.5 sm:gap-2" role="tablist" aria-label="This week">
      {days.map(({ d, key, items, i }) => {
        const active = selected === key;
        const dueCount = items.filter((t) => t.state !== "not_open").length;
        const opens = items.length - dueCount;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={`${d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}: ${dueCount} due${opens ? `, ${opens} opening` : ""}`}
            onClick={() => onSelect(active ? null : key)}
            className={`rounded-xl px-1 py-2 sm:py-3 text-center transition-all ${
              active
                ? "bg-blue-600 text-white shadow"
                : i === 0
                  ? "bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                  : "bg-surface-light dark:bg-surface-dark/50 hover:bg-gray-100 dark:hover:bg-gray-700/50"
            }`}
          >
            <div className={`text-[10px] sm:text-xs font-medium uppercase ${active ? "text-white/80" : ink.secondary}`}>
              {i === 0 ? "Today" : d.toLocaleDateString(undefined, { weekday: "short" })}
            </div>
            <div className={`text-base sm:text-lg font-bold ${active ? "text-white" : ink.primary}`}>{d.getDate()}</div>
            <div className="flex justify-center gap-0.5 mt-1 min-h-[8px]">
              {items.slice(0, 4).map((t) => (
                <span
                  key={`${t.kind}-${t.id}`}
                  aria-hidden
                  className={`w-1.5 h-1.5 rounded-full ${
                    active ? "bg-white" : t.state === "not_open" ? "bg-gray-400" : t.kind === "quiz" ? "bg-violet-500" : "bg-blue-500"
                  }`}
                />
              ))}
            </div>
          </button>
        );
      })}
    </div>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const matchesDay = (t: StudentTask, key: string) => {
  const when = t.state === "not_open" ? t.opens_at : t.due_at;
  return !!when && dayKey(new Date(when)) === key;
};

/** Under the week strip: what's due on the chosen day, else the next 7 days. */
export const WeekList: React.FC<{ tasks: StudentTask[]; day: string | null; onClear: () => void }> = ({ tasks, day, onClear }) => {
  const weekEnd = Date.now() + 7 * 86400000;
  const inWeek = tasks.filter((t) => {
    if (!(TODO_STATES.includes(t.state) || t.state === "not_open")) return false;
    const when = t.state === "not_open" ? t.opens_at : t.due_at;
    return !!when && new Date(when).getTime() <= weekEnd;
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
        <p className={`text-sm text-center py-6 ${ink.secondary}`}>{day ? "Nothing due that day." : "Nothing due in the next 7 days."}</p>
      ) : (
        <ul className="space-y-0.5 max-h-[26rem] overflow-y-auto pr-1 -mx-2">
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
  <li className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-light dark:hover:bg-surface-dark/50 transition-colors">
    <KindIcon kind={task.kind} />
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <p className={`text-sm font-semibold truncate ${ink.primary}`}>{task.title}</p>
        {task.is_new && <span className="px-1.5 py-px rounded-full text-[10px] font-semibold bg-blue-600 text-white">New</span>}
        {task.has_draft && TODO_STATES.includes(task.state) && (
          <span className="px-1.5 py-px rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">Draft saved</span>
        )}
      </div>
      <p className={`text-xs ${ink.secondary} truncate`}>{taskMeta(task)}</p>
      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
        <StatePill state={task.state} />
        {task.countdown_to && task.countdown_label ? (
          <LiveCountdown to={task.countdown_to} kind={task.countdown_label} compact />
        ) : task.state === "submitted" && task.submitted_at ? (
          <span className={`text-[11px] ${ink.muted}`}>
            Handed in {new Date(task.submitted_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            {task.is_late ? " · late" : ""}
          </span>
        ) : task.state === "missed" && task.due_at ? (
          <span className={`text-[11px] ${ink.muted}`}>Closed {new Date(task.due_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
        ) : null}
        {task.state === "graded" && task.score_pct != null && (
          <span className={`text-xs font-semibold ${task.passed === false ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
            {task.score_display ?? `${task.score_pct}%`}
          </span>
        )}
      </div>
    </div>
    <ActionButton task={task} />
  </li>
);

export type BoardTab = "todo" | "coming" | "waiting" | "missed";

export const TaskBoard: React.FC<{ tasks: StudentTask[] }> = ({ tasks }) => {
  const [tab, setTab] = useState<BoardTab>("todo");
  const groups: Record<BoardTab, StudentTask[]> = {
    todo: tasks.filter((t) => TODO_STATES.includes(t.state)),
    coming: tasks.filter((t) => t.state === "not_open"),
    waiting: tasks.filter((t) => t.state === "submitted"),
    missed: tasks.filter((t) => t.state === "missed"),
  };
  const labels: Record<BoardTab, string> = { todo: "To do", coming: "Opening later", waiting: "Awaiting marks", missed: "Missed" };
  const list = groups[tab];
  const empty: Record<BoardTab, string> = {
    todo: "Nothing to do right now. Nice work!",
    coming: "No quizzes scheduled to open.",
    waiting: "Nothing waiting for a mark.",
    missed: "You haven't missed anything in the last 30 days.",
  };

  return (
    <div>
      {(
        <div className="flex gap-1 mb-3 overflow-x-auto" role="tablist" aria-label="Task groups">
          {(Object.keys(groups) as BoardTab[]).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                tab === k
                  ? "bg-blue-600 text-white"
                  : "bg-surface-light dark:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              {labels[k]} ({groups[k].length})
            </button>
          ))}
        </div>
      )}
      {list.length === 0 ? (
        <p className={`text-sm text-center py-8 ${ink.secondary}`}>{empty[tab]}</p>
      ) : (
        <ul className="space-y-1 max-h-[28rem] overflow-y-auto pr-1 -mx-2">
          {list.map((t) => (
            <TaskRow key={`${t.kind}-${t.id}`} task={t} />
          ))}
        </ul>
      )}
      {tab === "missed" && groups.missed.length > 0 && (
        <p className={`mt-2 text-xs ${ink.muted}`}>Deadlines have passed for these. Ask your teacher if you can still catch up.</p>
      )}
    </div>
  );
};

// ─── Results ──────────────────────────────────────────────────────────────────

export const ResultsList: React.FC<{ tasks: StudentTask[] }> = ({ tasks }) => {
  const graded = tasks.filter((t) => t.state === "graded").slice(0, 8);
  if (graded.length === 0) {
    return <p className={`text-sm text-center py-8 ${ink.secondary}`}>No marks yet this term. They'll show up here as soon as they're released.</p>;
  }
  return (
    <ul className="space-y-1 -mx-2">
      {graded.map((t) => {
        const pct = t.score_pct ?? 0;
        const tone = pct < PASS_MARK ? "bg-red-500" : pct < 70 ? "bg-amber-500" : "bg-emerald-500";
        const fresh = t.graded_at && Date.now() - new Date(t.graded_at).getTime() < 7 * 86400000;
        return (
          <li key={`${t.kind}-${t.id}`}>
            <Link to={t.action?.url ?? "#"} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-surface-light dark:hover:bg-surface-dark/50 transition-colors">
              <KindIcon kind={t.kind} className="w-8 h-8" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={`text-sm font-medium truncate ${ink.primary}`}>{t.title}</p>
                  {fresh && <span className="px-1.5 py-px rounded-full text-[10px] font-semibold bg-blue-600 text-white">New</span>}
                  {t.has_feedback && <MessageSquare className="w-3.5 h-3.5 text-blue-500 shrink-0" aria-label="Has feedback" />}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-700/60 overflow-hidden">
                    <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                  <span className={`text-[11px] ${ink.muted} whitespace-nowrap`}>{subjectLabel(t)}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className={`text-sm font-bold ${pct < PASS_MARK ? "text-red-600 dark:text-red-400" : ink.primary}`}>{Math.round(pct)}%</div>
                {t.score_display && <div className={`text-[11px] ${ink.muted}`}>{t.score_display}</div>}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
};

// ─── Subjects ─────────────────────────────────────────────────────────────────

export interface SubjectStanding {
  score: number | null;
  class_average: number | null;
  status: string;
}

export const SubjectCards: React.FC<{
  subjects: StudentSubjectSummary[];
  standing: Map<string, SubjectStanding>;
}> = ({ subjects, standing }) => (
  <div className="grid gap-3 sm:grid-cols-2">
    {subjects.map((s) => {
      const st = standing.get(String(s.subject_id));
      const avg = st?.score ?? s.recent_average;
      return (
        <Link
          key={s.subject_id}
          to={`/courses/${s.subject_id}`}
          className="group rounded-xl p-4 bg-surface-light dark:bg-surface-dark/50 hover:shadow-md transition-all"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className={`text-sm font-semibold ${ink.primary}`}>{s.subject_code || s.subject_name}</p>
              <p className={`text-xs ${ink.secondary} line-clamp-1`}>{s.subject_code ? s.subject_name : ""}</p>
            </div>
            <div className="text-right shrink-0">
              <div className={`text-lg font-bold ${avg != null && avg < PASS_MARK ? "text-red-600 dark:text-red-400" : ink.primary}`}>
                {avg != null ? `${Math.round(avg)}%` : "—"}
              </div>
              {st?.class_average != null && <div className={`text-[11px] ${ink.muted}`}>class {Math.round(st.class_average)}%</div>}
            </div>
          </div>
          <div className="mt-3 h-1.5 rounded-full bg-gray-200/70 dark:bg-gray-700/60 overflow-hidden" title="Work handed in">
            <div className="h-full rounded-full bg-blue-500" style={{ width: `${s.completion ?? 0}%` }} />
          </div>
          <div className={`mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] ${ink.secondary}`}>
            <span>{s.completion != null ? `${Math.round(s.completion)}% handed in` : "No closed work yet"}</span>
            {s.todo > 0 && <span className="text-blue-600 dark:text-blue-400 font-medium">{s.todo} to do</span>}
            {s.missed > 0 && <span className="text-red-600 dark:text-red-400">{s.missed} missed</span>}
            {s.awaiting > 0 && <span>{s.awaiting} awaiting mark</span>}
          </div>
          {s.next_task && (
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className={`text-xs truncate ${ink.primary}`}>Next: {s.next_task.title}</span>
              <LiveCountdown to={s.next_task.due_at} kind="due" compact />
            </div>
          )}
        </Link>
      );
    })}
  </div>
);

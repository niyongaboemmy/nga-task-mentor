import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  BellRing,
  BookOpen,
  CalendarDays,
  ClipboardList,
  FileText,
  LineChart,
  PieChart,
  RefreshCw,
  Trophy,
} from "lucide-react";
import axios from "../../utils/axiosConfig";
import { useAuth } from "../../contexts/AuthContext";
import { dashboardContainerVariants, dashboardItemVariants } from "./dashboardUi";
import { Panel } from "./instructor/InstructorPanels";
import {
  FocusCard,
  ReminderList,
  ResultsList,
  TaskBoard,
  WeekAgenda,
  WeekList,
  type BoardTab,
} from "./student/StudentPanels";
import { MarksTrend, RankTrack, RingGauge, StatusDonut, SubjectBars, type StatusKey } from "./student/StudentCharts";
import ReportCardPanel from "./student/ReportCardPanel";
import {
  getStudentOverview,
  reminderToAlert,
  subjectLabel,
  TODO_STATES,
  type StudentOverview,
  type StudentReminder,
} from "../../services/studentOverviewApi";
import {
  alertSignature,
  dismissAlert,
  getAlertsVersion,
  isImportant,
  isSeen,
  markSeen,
  publishAlerts,
  subscribeAlerts,
  visibleAlerts,
} from "../../services/alertStore";

/**
 * Student dashboard. What a student needs on opening, as visuals first:
 *   1. the one thing to do first (blue focus card with a live countdown),
 *   2. a snapshot: task status donut, work handed in, my average vs class,
 *      class rank,
 *   3. reminders (one line each, tap for detail) and the week ahead,
 *   4. every task grouped by what it needs (the donut opens a group),
 *   5. marks over time, my subjects against the class, report card.
 * Data: GET /dashboard/student/overview; averages including teacher-recorded
 * marks and the rank come from GET /rankings (optional).
 */

const REFRESH_MS = 60 * 1000;
const SEEN_AFTER_MS = 4000;

interface StandingResponse {
  view?: string;
  overall?: {
    rank: number | null;
    ranked_count: number;
    score: number | null;
    band: string | null;
    class_average: number | null;
    status: string;
  };
  subjects?: Array<{ course_id: string; score: number | null; class_average: number | null; status: string }>;
  suggestions?: Array<{ id: string; priority: string; title: string; detail: string; action?: { label: string; href: string } }>;
}

const periodName = (p: unknown): string | undefined =>
  p && typeof p === "object" && "name" in p ? String((p as { name: unknown }).name) : undefined;

function greeting(d = new Date()) {
  const h = d.getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

const DONUT_TO_TAB: Record<StatusKey, BoardTab> = { todo: "todo", missed: "missed", marked: "todo", awaiting: "waiting" };

const StudentDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [overview, setOverview] = useState<StudentOverview | null>(null);
  const [standing, setStanding] = useState<StandingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [staleError, setStaleError] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [tab, setTab] = useState<BoardTab>("todo");
  const hasData = useRef(false);
  const seq = useRef(0);
  useSyncExternalStore(subscribeAlerts, getAlertsVersion);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    if (hasData.current) setRefreshing(true);
    try {
      const [o, st] = await Promise.all([
        getStudentOverview(),
        axios
          .get("/rankings")
          .then((r) => (r.data?.data ?? null) as StandingResponse | null)
          .catch(() => null),
      ]);
      if (mine !== seq.current) return;
      hasData.current = true;
      setOverview(o);
      setStanding(st && st.view === "student" ? st : null);
      publishAlerts(o.reminders.map(reminderToAlert));
      setError(null);
      setStaleError(null);
    } catch (err) {
      if (mine !== seq.current) return;
      const e = err as { response?: { data?: { message?: string } } };
      const message = e?.response?.data?.message || "Couldn't load your dashboard.";
      if (hasData.current) setStaleError(message);
      else setError(message);
    } finally {
      if (mine === seq.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    load();
    // States move with the clock (due soon -> due today -> missed).
    const id = window.setInterval(() => document.visibilityState === "visible" && load(), REFRESH_MS);
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  const newSignatures = useMemo(
    () =>
      new Set(
        (overview?.reminders ?? [])
          .map(reminderToAlert)
          .filter((a) => isImportant(a) && !isSeen(a))
          .map(alertSignature),
      ),
    [overview],
  );
  useEffect(() => {
    if (!overview) return;
    const t = window.setTimeout(() => markSeen(overview.reminders.map(reminderToAlert)), SEEN_AFTER_MS);
    return () => window.clearTimeout(t);
  }, [overview]);

  useEffect(() => {
    if (!overview || !location.hash) return;
    document.getElementById(location.hash.slice(1))?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }, [overview, location.hash]);

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  const runAction = (r: { action?: { url: string } }) => {
    if (!r.action) return;
    if (r.action.url.startsWith("#")) scrollTo(r.action.url.slice(1));
    else navigate(r.action.url);
  };

  if (loading) return <Skeleton />;
  if (!overview) {
    return (
      <div className="bg-card-light dark:bg-card-dark/30 rounded-2xl shadow-sm p-8 text-center">
        <AlertTriangle className="w-8 h-8 mx-auto text-amber-500 mb-2" />
        <p className="text-text-primary-light dark:text-text-primary-dark font-medium">{error ?? "Couldn't load your dashboard."}</p>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            load();
          }}
          className="mt-4 px-4 py-2 rounded-full bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
        >
          Try again
        </button>
      </div>
    );
  }

  const s = overview.summary;
  const tasks = overview.tasks;
  // Recomputed each render so a dismissal (a store change) hides it at once.
  const reminders = visibleAlerts(overview.reminders.map(reminderToAlert)) as StudentReminder[];
  const focus =
    tasks.find((t) => t.state === "in_progress") ??
    tasks.find((t) => t.state === "due_today") ??
    tasks.find((t) => t.state === "due_soon") ??
    null;
  const upcoming = tasks.filter((t) => TODO_STATES.includes(t.state) || t.state === "not_open").length;
  const overall = standing?.overall;
  const average = overall?.score ?? s.recent_average;
  const importantCount = reminders.filter((r) => r.id !== "all-clear" && isImportant(reminderToAlert(r))).length;

  const counts: Record<StatusKey, number> = {
    todo: upcoming,
    missed: s.missed,
    marked: s.graded,
    awaiting: s.awaiting_grade,
  };
  const subjectStanding = new Map((standing?.subjects ?? []).map((x) => [String(x.course_id), x]));
  const subjectRows = overview.subjects.map((sub) => {
    const st = subjectStanding.get(String(sub.subject_id));
    return {
      id: sub.subject_id,
      label: subjectLabel(sub),
      name: sub.subject_name,
      me: st?.score ?? sub.recent_average,
      classAvg: st?.class_average ?? null,
      todo: sub.todo,
    };
  });
  const trend = tasks
    .filter((t) => t.state === "graded" && t.score_pct != null && t.graded_at)
    .sort((a, b) => a.graded_at!.localeCompare(b.graded_at!))
    .slice(-12)
    .map((t) => ({ at: t.graded_at!, pct: t.score_pct!, title: t.title, subject: subjectLabel(t), url: t.action?.url ?? null }));

  const yearName = periodName(user?.currentAcademicYear);
  const termName = periodName(user?.currentAcademicTerm);
  const suggestions = standing?.suggestions ?? [];

  const reportCard = (
    <Panel id="report-card" title="My Report Cards" icon={<FileText className="w-4 h-4" />} iconColor="indigo">
      <ReportCardPanel />
    </Panel>
  );

  return (
    <motion.div variants={dashboardContainerVariants} initial="hidden" animate="visible" className="space-y-5" aria-busy={refreshing}>
      {/* Header */}
      <motion.div variants={dashboardItemVariants} className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark">
            {greeting()}, {user?.first_name || "there"}
          </h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
            {(yearName || termName) && (
              <span className="px-2 py-0.5 rounded-full bg-surface-light dark:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark">
                {[yearName, termName].filter(Boolean).join(" · ")}
              </span>
            )}
            <HeaderChip n={s.in_progress} label="in progress" tone="red" onClick={() => scrollTo("today")} />
            <HeaderChip n={s.due_today} label="due today" tone="red" onClick={() => scrollTo("week")} />
            <HeaderChip n={s.due_this_week} label="this week" tone="blue" onClick={() => scrollTo("week")} />
            <HeaderChip n={s.new_results} label={s.new_results === 1 ? "new mark" : "new marks"} tone="blue" onClick={() => scrollTo("results")} />
          </div>
        </div>
        <button
          type="button"
          onClick={() => load()}
          disabled={refreshing}
          aria-label="Refresh"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium bg-card-light dark:bg-card-dark/40 shadow-sm hover:shadow text-text-primary-light dark:text-text-primary-dark disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </motion.div>

      {staleError && (
        <div role="status" className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-900/10 px-4 py-2 text-sm text-amber-800 dark:text-amber-200">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Couldn't refresh ({staleError}). Showing your last loaded tasks.
        </div>
      )}

      {overview.subjects.length === 0 ? (
        <>
          <div className="bg-card-light dark:bg-card-dark/30 rounded-2xl shadow-sm p-10 text-center">
            <BookOpen className="w-8 h-8 mx-auto text-blue-500 mb-2" />
            <p className="font-medium text-text-primary-light dark:text-text-primary-dark">You're not enrolled in any subject for this period</p>
            <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mt-1">Check the academic period in the top bar, or ask your class teacher.</p>
          </div>
          {reportCard}
        </>
      ) : (
        <>
          <div id="today" className="scroll-mt-24">
            <FocusCard task={focus} nextDeadline={s.next_deadline} upcoming={upcoming} />
          </div>

          {/* Snapshot */}
          <section aria-label="My progress" className="grid gap-3 grid-cols-2 xl:grid-cols-4">
            <SnapCard title="My tasks" icon={<PieChart className="w-4 h-4" />} className="col-span-2 xl:col-span-1">
              <StatusDonut
                counts={counts}
                onSelect={(k) => {
                  if (k === "marked") scrollTo("results");
                  else {
                    setTab(DONUT_TO_TAB[k]);
                    scrollTo("tasks");
                  }
                }}
              />
            </SnapCard>
            <SnapCard title="Handed in" center>
              <RingGauge
                value={s.completion_rate}
                label="Work handed in"
                tone="blue"
                title="Share of closed work you handed in"
                caption={
                  s.missed ? (
                    <button
                      type="button"
                      className="text-red-600 dark:text-red-400 font-medium hover:underline"
                      onClick={() => {
                        setTab("missed");
                        scrollTo("tasks");
                      }}
                    >
                      {s.missed} missed
                    </button>
                  ) : s.completion_rate != null ? (
                    "nothing missed"
                  ) : (
                    "no closed work yet"
                  )
                }
              />
            </SnapCard>
            <SnapCard title="Average" center>
              <RingGauge
                value={average}
                label={overall?.score != null ? "My average" : "Recent average"}
                reference={overall?.class_average != null ? { value: overall.class_average, label: "class" } : null}
                title={
                  overall?.score != null
                    ? "All your marks this term, including marks recorded by your teacher. The tick is the class average."
                    : "Your online marks in the last 30 days"
                }
                caption={
                  overall?.class_average != null ? (
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2.5 h-0.5 bg-current rounded" aria-hidden />
                      class {Math.round(overall.class_average)}%
                    </span>
                  ) : undefined
                }
              />
            </SnapCard>
            <Link to="/ranking" className="block col-span-2 xl:col-span-1" aria-label="Open my ranking">
              <SnapCard title="Standing" icon={<Trophy className="w-4 h-4" />}>
                <RankTrack rank={overall?.rank ?? null} of={overall?.ranked_count ?? 0} band={overall?.band ?? null} />
              </SnapCard>
            </Link>
          </section>

          {/* Reminders + week */}
          <div className="grid gap-5 lg:grid-cols-5">
            <Panel
              title="Reminders"
              subtitle={importantCount ? `${importantCount} need${importantCount === 1 ? "s" : ""} attention` : "Nothing urgent"}
              icon={<BellRing className="w-4 h-4" />}
              iconColor="blue"
              className="lg:col-span-2"
            >
              <ReminderList
                reminders={reminders}
                isNew={(r) => newSignatures.has(alertSignature(r))}
                onAction={runAction}
                onDismiss={(r) => dismissAlert(reminderToAlert(r))}
              />
            </Panel>
            <Panel id="week" title="This week" subtitle="Tap a day" icon={<CalendarDays className="w-4 h-4" />} className="lg:col-span-3">
              <WeekAgenda tasks={tasks} selected={day} onSelect={setDay} />
              <WeekList tasks={tasks} day={day} onClear={() => setDay(null)} />
            </Panel>
          </div>

          {/* Tasks + marks */}
          <div className="grid gap-5 lg:grid-cols-5">
            <Panel id="tasks" title="My tasks" icon={<ClipboardList className="w-4 h-4" />} className="lg:col-span-3">
              <TaskBoard tasks={tasks} tab={tab} onTab={setTab} />
            </Panel>
            <Panel
              id="results"
              title="My marks"
              subtitle="Over time · tap a point"
              icon={<LineChart className="w-4 h-4" />}
              className="lg:col-span-2"
              action={
                <Link to="/reports" className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">
                  All reports
                </Link>
              }
            >
              {trend.length >= 2 ? (
                <MarksTrend points={trend} onOpen={(url) => navigate(url)} />
              ) : (
                <p className="text-sm text-center py-6 text-text-secondary-light dark:text-text-secondary-dark">
                  {trend.length === 1 ? "One mark so far. The chart starts with your second." : "No online marks yet this term."}
                </p>
              )}
              <ResultsList tasks={tasks} />
            </Panel>
          </div>

          {/* Subjects + tips + report card */}
          <div className="grid gap-5 lg:grid-cols-3">
            <Panel
              title="My subjects"
              subtitle="You (bar) vs class average (tick) · tap to open"
              icon={<BookOpen className="w-4 h-4" />}
              iconColor="indigo"
              className="lg:col-span-2"
            >
              <SubjectBars rows={subjectRows} onSelect={(id) => navigate(`/courses/${id}`)} />
            </Panel>
            <div className="space-y-5">
              {suggestions.length > 0 && (
                <Panel title="Tips for you" icon={<Trophy className="w-4 h-4" />} iconColor="blue">
                  <ul className="space-y-2.5">
                    {suggestions.slice(0, 3).map((sg) => (
                      <li key={sg.id} className="flex gap-2">
                        <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${sg.priority === "high" ? "bg-blue-600" : "bg-blue-300"}`} aria-hidden />
                        <div className="min-w-0">
                          {sg.action ? (
                            <Link to={sg.action.href} className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark hover:text-blue-600">
                              {sg.title}
                            </Link>
                          ) : (
                            <p className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">{sg.title}</p>
                          )}
                          <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">{sg.detail}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </Panel>
              )}
              {reportCard}
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
};

// ─── Small pieces ─────────────────────────────────────────────────────────────

const HeaderChip: React.FC<{ n: number; label: string; tone: "red" | "blue"; onClick: () => void }> = ({ n, label, tone, onClick }) =>
  n > 0 ? (
    <button
      type="button"
      onClick={onClick}
      className={`px-2 py-0.5 rounded-full font-medium transition-colors ${
        tone === "red"
          ? "bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/25 dark:text-red-300"
          : "bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/25 dark:text-blue-300"
      }`}
    >
      {n} {label}
    </button>
  ) : null;

const SnapCard: React.FC<{ title: string; icon?: React.ReactNode; center?: boolean; className?: string; children: React.ReactNode }> = ({
  title,
  icon,
  center,
  className = "",
  children,
}) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    whileHover={{ y: -2 }}
    className={`bg-card-light dark:bg-card-dark/30 rounded-2xl shadow-sm hover:shadow-md transition-shadow p-3 sm:p-4 h-full ${className}`}
  >
    <div className="flex items-center gap-1.5 mb-2 text-text-secondary-light dark:text-text-secondary-dark">
      {icon}
      <span className="text-xs font-semibold uppercase tracking-wide">{title}</span>
    </div>
    <div className={center ? "flex justify-center" : ""}>{children}</div>
  </motion.div>
);

const Skeleton: React.FC = () => (
  <div className="space-y-5 animate-pulse" aria-busy="true" aria-label="Loading dashboard">
    <div className="h-8 w-64 rounded-lg bg-gray-200 dark:bg-gray-700/50" />
    <div className="h-24 rounded-2xl bg-blue-100/70 dark:bg-blue-900/20" />
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-44 rounded-2xl bg-gray-200/70 dark:bg-gray-700/40" />
      ))}
    </div>
    <div className="grid gap-5 lg:grid-cols-5">
      <div className="h-64 rounded-2xl bg-gray-200/70 dark:bg-gray-700/40 lg:col-span-2" />
      <div className="h-64 rounded-2xl bg-gray-200/70 dark:bg-gray-700/40 lg:col-span-3" />
    </div>
  </div>
);

export default StudentDashboard;

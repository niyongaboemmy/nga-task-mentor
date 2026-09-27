import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Award,
  BellRing,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  Hourglass,
  ListChecks,
  RefreshCw,
  Target,
  Timer,
  Trophy,
} from "lucide-react";
import axios from "../../utils/axiosConfig";
import { useAuth } from "../../contexts/AuthContext";
import { dashboardContainerVariants, dashboardItemVariants } from "./dashboardUi";
import { AlertsList, KpiTile, Panel } from "./instructor/InstructorPanels";
import {
  FocusCard,
  ResultsList,
  SubjectCards,
  TaskBoard,
  WeekAgenda,
  WeekList,
  type SubjectStanding,
} from "./student/StudentPanels";
import ReportCardPanel from "./student/ReportCardPanel";
import { LiveCountdown } from "../Common/LiveCountdown";
import {
  getStudentOverview,
  reminderToAlert,
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
 * Student dashboard, built around what a student needs the moment they open
 * the app, in this order:
 *   1. the one thing to do first (a running quiz, else the nearest deadline),
 *   2. reminders (due soon, drafts, missed, retakes, openings, new marks),
 *   3. the week ahead, day by day, with live countdowns,
 *   4. every task grouped by what it needs from them,
 *   5. how they're doing: recent marks, subjects, standing, report card.
 * Tasks and reminders: GET /dashboard/student/overview. Averages that include
 * teacher-recorded marks, and the class standing, come from GET /rankings
 * (optional: the page works without it).
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
    points_to_next: number | null;
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

const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};

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
    // States move with the clock (due soon -> due today -> missed), so refresh
    // every minute while the tab is visible, and when the student comes back.
    const id = window.setInterval(() => document.visibilityState === "visible" && load(), REFRESH_MS);
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  // Recomputed every render so a dismissal (a store change) hides it at once.
  const reminders = visibleAlerts((overview?.reminders ?? []).map(reminderToAlert)) as Array<
    StudentReminder & { notify?: boolean }
  >;
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

  const runAction = (a: { action?: { url: string } }) => {
    if (!a.action) return;
    if (a.action.url.startsWith("#")) {
      document.getElementById(a.action.url.slice(1))?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    } else navigate(a.action.url);
  };

  const subjectStanding = useMemo(() => {
    const m = new Map<string, SubjectStanding>();
    for (const s of standing?.subjects ?? []) {
      m.set(String(s.course_id), { score: s.score, class_average: s.class_average, status: s.status });
    }
    return m;
  }, [standing]);

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
  const focus =
    tasks.find((t) => t.state === "in_progress") ??
    tasks.find((t) => t.state === "due_today") ??
    tasks.find((t) => t.state === "due_soon") ??
    null;
  const upcomingCount = tasks.filter((t) => TODO_STATES.includes(t.state) || t.state === "not_open").length;
  const overall = standing?.overall;
  const yearName = periodName(user?.currentAcademicYear);
  const termName = periodName(user?.currentAcademicTerm);
  const importantCount = reminders.filter((r) => isImportant(r)).length;
  const hasTips = (standing?.suggestions?.length ?? 0) > 0;
  const reportCard = (
    <Panel id="report-card" title="My Report Cards" icon={<FileText className="w-4 h-4" />} iconColor="indigo">
      <ReportCardPanel />
    </Panel>
  );

  const headline: string[] = [];
  if (s.in_progress) headline.push(`${s.in_progress} quiz in progress`);
  if (s.due_today) headline.push(`${s.due_today} due today`);
  if (s.due_this_week - s.due_today - s.in_progress > 0) headline.push(`${s.due_this_week - s.due_today - s.in_progress} more this week`);
  if (s.new_results) headline.push(`${s.new_results} new mark${s.new_results === 1 ? "" : "s"}`);

  return (
    <motion.div variants={dashboardContainerVariants} initial="hidden" animate="visible" className="space-y-5" aria-busy={refreshing}>
      {/* Header */}
      <motion.div variants={dashboardItemVariants} className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark">
            {greeting()}, {user?.first_name || "there"}
          </h2>
          <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mt-1">
            {headline.length ? `${headline.join(" · ")}.` : "You're all caught up."}
            {(yearName || termName) && (
              <span className="text-text-secondary-light/80 dark:text-text-secondary-dark/60"> {[yearName, termName].filter(Boolean).join(" · ")}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {s.next_deadline && (
            <span className="hidden md:inline-flex items-center gap-2 text-xs text-text-secondary-light dark:text-text-secondary-dark">
              Next deadline <LiveCountdown to={s.next_deadline} kind="due" compact />
            </span>
          )}
          <button
            type="button"
            onClick={() => load()}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium bg-card-light dark:bg-card-dark/40 shadow-sm hover:shadow text-text-primary-light dark:text-text-primary-dark disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </motion.div>

      {staleError && (
        <div role="status" className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-900/10 px-4 py-2 text-sm text-amber-800 dark:text-amber-200">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Couldn't refresh ({staleError}). Showing your last loaded tasks.
        </div>
      )}

      {overview.subjects.length === 0 ? (
        <div className="bg-card-light dark:bg-card-dark/30 rounded-2xl shadow-sm p-10 text-center">
          <BookOpen className="w-8 h-8 mx-auto text-text-secondary-light dark:text-text-secondary-dark mb-2" />
          <p className="font-medium text-text-primary-light dark:text-text-primary-dark">You're not enrolled in any subject for this period</p>
          <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mt-1">
            If that looks wrong, check the academic period in the top bar or ask your class teacher.
          </p>
        </div>
      ) : (
        <>
          <div id="today" className="scroll-mt-24">
            <FocusCard task={focus} nextCount={upcomingCount} />
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <KpiTile
              icon={<ListChecks className="w-4 h-4" />}
              color="blue"
              label="To do"
              value={String(s.todo)}
              hint={s.drafts ? `${s.drafts} draft${s.drafts === 1 ? "" : "s"} unsubmitted` : `${s.due_this_week} due this week`}
              emphasis={s.due_today || s.in_progress ? "critical" : undefined}
              onClick={() => document.getElementById("tasks")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            />
            <KpiTile
              icon={<Timer className="w-4 h-4" />}
              color="red"
              label="Due today"
              value={String(s.due_today + s.in_progress)}
              hint={s.in_progress ? "quiz in progress" : s.due_today ? "don't leave it late" : "nothing today"}
              emphasis={s.due_today + s.in_progress > 0 ? "critical" : undefined}
            />
            <KpiTile
              icon={<Hourglass className="w-4 h-4" />}
              color="violet"
              label="Awaiting marks"
              value={String(s.awaiting_grade)}
              hint={s.new_results ? `${s.new_results} new this week` : undefined}
            />
            <KpiTile
              icon={<CheckCircle2 className="w-4 h-4" />}
              color="emerald"
              label="Handed in"
              value={s.completion_rate != null ? `${Math.round(s.completion_rate)}%` : "—"}
              progress={s.completion_rate}
              hint={s.missed ? `${s.missed} missed` : "of closed work"}
              emphasis={s.missed > 0 ? "warning" : undefined}
            />
            <KpiTile
              icon={<Target className="w-4 h-4" />}
              color="indigo"
              label={overall?.score != null ? "My average" : "Recent average"}
              value={
                overall?.score != null
                  ? `${Math.round(overall.score)}%`
                  : s.recent_average != null
                    ? `${Math.round(s.recent_average)}%`
                    : "—"
              }
              progress={overall?.score ?? s.recent_average}
              hint={
                overall?.class_average != null
                  ? `class ${Math.round(overall.class_average)}%`
                  : s.on_time_rate != null
                    ? `${Math.round(s.on_time_rate)}% on time`
                    : undefined
              }
            />
            <KpiTile
              icon={<Trophy className="w-4 h-4" />}
              color="amber"
              label="My standing"
              value={overall?.rank ? ordinal(overall.rank) : "—"}
              hint={overall?.rank ? `of ${overall.ranked_count}${overall.band ? ` · ${overall.band}` : ""}` : "no ranked marks yet"}
              to="/ranking"
            />
          </div>

          {/* Reminders + week */}
          <div className="grid gap-5 lg:grid-cols-5">
            <Panel
              title="Reminders"
              subtitle={importantCount ? `${importantCount} need${importantCount === 1 ? "s" : ""} your attention` : "Nothing urgent"}
              icon={<BellRing className="w-4 h-4" />}
              iconColor="amber"
              className="lg:col-span-2"
            >
              <AlertsList
                alerts={reminders}
                onDismiss={(a) => dismissAlert(reminderToAlert(a as StudentReminder))}
                onAction={runAction}
                isNew={(a) => newSignatures.has(alertSignature(a))}
                limit={4}
              />
            </Panel>
            <Panel
              id="week"
              title="This week"
              subtitle="Tap a day to see just that day"
              icon={<CalendarDays className="w-4 h-4" />}
              className="lg:col-span-3"
            >
              <WeekAgenda tasks={tasks} selected={day} onSelect={setDay} />
              <WeekList tasks={tasks} day={day} onClear={() => setDay(null)} />
              <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
                <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" />Assignment due</span>
                <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-500" />Quiz closes</span>
                <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-400" />Quiz opens</span>
              </p>
            </Panel>
          </div>

          {/* Tasks + results */}
          <div className="grid gap-5 lg:grid-cols-5">
            <Panel
              id="tasks"
              title="My tasks"
              subtitle="Everything across your subjects, most urgent first"
              icon={<ClipboardList className="w-4 h-4" />}
              className="lg:col-span-3"
            >
              <TaskBoard tasks={tasks} />
            </Panel>
            <Panel
              id="results"
              title="Recent results"
              subtitle="Your latest marks"
              icon={<Award className="w-4 h-4" />}
              iconColor="emerald"
              className="lg:col-span-2"
              action={
                <Link to="/reports" className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">
                  All reports
                </Link>
              }
            >
              <ResultsList tasks={tasks} />
            </Panel>
          </div>

          {/* Subjects + standing + report card */}
          <div className="grid gap-5 lg:grid-cols-3">
            <Panel
              title="My subjects"
              subtitle="Average, work handed in and what's next"
              icon={<BookOpen className="w-4 h-4" />}
              iconColor="indigo"
              className="lg:col-span-2"
            >
              <SubjectCards subjects={overview.subjects} standing={subjectStanding} />
            </Panel>
            <div className="space-y-5">
              {hasTips && standing?.suggestions && (
                <Panel title="Tips for you" subtitle="Based on your marks" icon={<Trophy className="w-4 h-4" />} iconColor="amber">
                  <ul className="space-y-2">
                    {standing.suggestions.slice(0, 3).map((sg) => (
                      <li key={sg.id} className="text-sm">
                        <p className="font-medium text-text-primary-light dark:text-text-primary-dark">{sg.title}</p>
                        <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">{sg.detail}</p>
                        {sg.action && (
                          <Link to={sg.action.href} className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">
                            {sg.action.label}
                          </Link>
                        )}
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

      {overview.subjects.length === 0 && reportCard}
    </motion.div>
  );
};

const Skeleton: React.FC = () => (
  <div className="space-y-5 animate-pulse" aria-busy="true" aria-label="Loading dashboard">
    <div className="h-8 w-64 rounded-lg bg-gray-200 dark:bg-gray-700/50" />
    <div className="h-28 rounded-2xl bg-gray-200/70 dark:bg-gray-700/40" />
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-28 rounded-2xl bg-gray-200/70 dark:bg-gray-700/40" />
      ))}
    </div>
    <div className="grid gap-5 lg:grid-cols-5">
      <div className="h-64 rounded-2xl bg-gray-200/70 dark:bg-gray-700/40 lg:col-span-2" />
      <div className="h-64 rounded-2xl bg-gray-200/70 dark:bg-gray-700/40 lg:col-span-3" />
    </div>
  </div>
);

export default StudentDashboard;

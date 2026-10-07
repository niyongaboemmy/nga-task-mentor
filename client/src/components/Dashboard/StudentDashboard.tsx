import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { AlertTriangle, BookOpen, FileText } from "lucide-react";
import axios from "../../utils/axiosConfig";
import { useAuth } from "../../contexts/AuthContext";
import { usePermissions } from "../../hooks/usePermissions";
import { dashboardContainerVariants, dashboardItemVariants } from "./dashboardUi";
import ReportCardPanel from "./student/ReportCardPanel";
import { FocusHero, SubjectCard, focusCard, focusInk, type SubjectCardData } from "./student/FocusDashboard";
import {
  AtAGlance,
  MarksSection,
  RemindersSection,
  Section,
  TaskBoard,
  TipsSection,
  WeekSection,
  type Suggestion,
  type TaskTab,
} from "./student/FocusSections";
import { STUDENT_DASHBOARD_DEMO, demoOverview, demoStanding } from "./student/demoData";
import {
  getStudentOverview,
  reminderToAlert,
  TODO_STATES,
  type StudentOverview,
  type StudentTask,
} from "../../services/studentOverviewApi";
import { publishAlerts } from "../../services/alertStore";

/**
 * Student dashboard ("Focus", picked from three mockups), top to bottom:
 *   1. a blue hero that says in words what to do next, with the action button,
 *      and this week's progress, average and class rank beside it,
 *   2. at a glance: my tasks by state, work handed in, my average against the
 *      class, and my standing,
 *   3. reminders (also published to the notification bell) and this week,
 *   4. every task by what it needs, and my marks over time,
 *   5. subject cards, busiest first, each with its next step and me vs class,
 *   6. tips (from the ranking) and the report cards.
 * Data: GET /dashboard/student/overview; averages including teacher-recorded
 * marks and the rank come from GET /rankings (optional, and only asked for
 * while the role holds RANKINGS_VIEW_OWN: without it there is no rank in the
 * hero and no class averages on subject cards).
 */

const REFRESH_MS = 60 * 1000;
/** Subject cards shown before "See all". */
const SUBJECTS_SHOWN = 4;
const DONE: StudentTask["state"][] = ["submitted", "graded"];

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
  suggestions?: Suggestion[];
}

/** "2026 - 2027" from the user's academic period, whatever shape it arrives in. */
const periodName = (p: unknown): string => {
  if (!p) return "";
  if (typeof p === "string") return p;
  const o = p as { name?: string; academic_year_name?: string; term_name?: string };
  return o.name ?? o.academic_year_name ?? o.term_name ?? "";
};

function greeting(d = new Date()) {
  const h = d.getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

/** Monday 00:00 to next Monday 00:00, local time. */
function thisWeek(now = new Date()): [number, number] {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return [start.getTime(), start.getTime() + 7 * 86400000];
}

const StudentDashboard: React.FC = () => {
  const { user } = useAuth();
  const { can } = usePermissions();
  const canSeeRanking = can("RANKINGS_VIEW_OWN");
  const location = useLocation();
  const [overview, setOverview] = useState<StudentOverview | null>(null);
  const [standing, setStanding] = useState<StandingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [staleError, setStaleError] = useState<string | null>(null);
  const [allSubjects, setAllSubjects] = useState(false);
  const [tab, setTab] = useState<TaskTab>("todo");
  const hasData = useRef(false);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    if (hasData.current) setRefreshing(true);
    try {
      // Local demo mode only (see student/demoData.ts); production never takes this branch.
      const [o, st] = STUDENT_DASHBOARD_DEMO
        ? [demoOverview(), demoStanding() as StandingResponse]
        : await Promise.all([
            getStudentOverview(),
            canSeeRanking
              ? axios
                  .get("/rankings")
                  .then((r) => (r.data?.data ?? null) as StandingResponse | null)
                  .catch(() => null)
              : Promise.resolve(null),
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
  }, [canSeeRanking]);

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

  useEffect(() => {
    if (!overview || !location.hash) return;
    document.getElementById(location.hash.slice(1))?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }, [overview, location.hash]);

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  const openTasks = (t: TaskTab) => {
    setTab(t);
    scrollTo("tasks");
  };

  if (loading) return <Skeleton />;
  if (!overview) {
    return (
      <div className={`${focusCard} p-8 text-center`}>
        <AlertTriangle className="w-8 h-8 mx-auto text-amber-500 mb-2" />
        <p className={`font-medium ${focusInk.primary}`}>{error ?? "Couldn't load your dashboard."}</p>
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

  const tasks = overview.tasks;
  // The hero names up to two things, in the order to do them.
  const order: StudentTask["state"][] = ["in_progress", "due_today", "due_soon", "upcoming"];
  const actionable = order.flatMap((st) =>
    tasks.filter((t) => t.state === st).sort((a, b) => (a.due_at ?? "9").localeCompare(b.due_at ?? "9")),
  );
  const [first = null, second = null] = actionable;
  const upcomingLater = tasks.filter((t) => TODO_STATES.includes(t.state) || t.state === "not_open").length;

  const [weekStart, weekEnd] = thisWeek();
  const weekTasks = tasks.filter((t) => {
    const due = t.due_at ? new Date(t.due_at).getTime() : null;
    return due != null && due >= weekStart && due < weekEnd;
  });
  const weekDone = weekTasks.filter((t) => DONE.includes(t.state)).length;

  const overall = standing?.overall;
  const average = overall?.score ?? overview.summary.recent_average;

  // Subjects: busiest first (work to do, then marks), each with its next step.
  const subjectStanding = new Map((standing?.subjects ?? []).map((x) => [String(x.course_id), x]));
  const cards: SubjectCardData[] = overview.subjects
    .map((subject) => {
      const own = tasks.filter((t) => t.subject_id === subject.subject_id);
      const next =
        own
          .filter((t) => TODO_STATES.includes(t.state) || t.state === "not_open")
          .sort((a, b) => ((a.state === "not_open" ? a.opens_at : a.due_at) ?? "9").localeCompare((b.state === "not_open" ? b.opens_at : b.due_at) ?? "9"))[0] ??
        null;
      const latest =
        own.filter((t) => t.state === "graded" && t.score_pct != null).sort((a, b) => (b.graded_at ?? "").localeCompare(a.graded_at ?? ""))[0] ?? null;
      const st = subjectStanding.get(String(subject.subject_id));
      return { subject, me: st?.score ?? subject.recent_average, classAvg: st?.class_average ?? null, next, latest };
    })
    .sort(
      (a, b) =>
        (b.subject.todo ?? 0) - (a.subject.todo ?? 0) ||
        Number(b.me != null) - Number(a.me != null) ||
        a.subject.subject_name.localeCompare(b.subject.subject_name),
    );
  const shownCards = allSubjects ? cards : cards.slice(0, SUBJECTS_SHOWN);
  const tips = standing?.suggestions ?? [];

  return (
    <motion.div variants={dashboardContainerVariants} initial="hidden" animate="visible" className="space-y-8" aria-busy={refreshing}>
      {staleError && (
        <div role="status" className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-900/10 px-4 py-2 text-sm text-amber-800 dark:text-amber-200">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Couldn't refresh ({staleError}). Showing your last loaded tasks.
        </div>
      )}

      <motion.div variants={dashboardItemVariants}>
        <FocusHero
          greeting={`${greeting()}, ${user?.first_name || "there"}`}
          period={[periodName(user?.currentAcademicYear), periodName(user?.currentAcademicTerm)].filter(Boolean).join(" · ")}
          newMarks={overview.summary.new_results}
          onSeeMarks={() => scrollTo("results")}
          first={first}
          second={second}
          upcomingLater={upcomingLater}
          weekDone={weekDone}
          weekTotal={weekTasks.length}
          average={average}
          rank={overall?.rank ?? null}
          rankedCount={overall?.ranked_count ?? 0}
          showRank={canSeeRanking}
          refreshing={refreshing}
          onRefresh={() => load()}
          onSeeWeek={() => scrollTo("coming-up")}
        />
      </motion.div>

      <motion.div variants={dashboardItemVariants}>
        <AtAGlance
          summary={overview.summary}
          todo={tasks.filter((t) => TODO_STATES.includes(t.state)).length}
          average={average}
          averageIsOverall={overall?.score != null}
          classAverage={overall?.class_average ?? null}
          rank={overall?.rank ?? null}
          rankedCount={overall?.ranked_count ?? 0}
          band={overall?.band ?? null}
          showRank={canSeeRanking}
          onOpenTasks={openTasks}
          onOpenMarks={() => scrollTo("results")}
        />
      </motion.div>

      <motion.div variants={dashboardItemVariants} className="grid gap-6 lg:grid-cols-5">
        <RemindersSection reminders={overview.reminders} className="lg:col-span-2" />
        <WeekSection tasks={tasks} className="lg:col-span-3" />
      </motion.div>

      <motion.div variants={dashboardItemVariants} className="grid gap-6 lg:grid-cols-5">
        <TaskBoard tasks={tasks} tab={tab} onTab={setTab} className="lg:col-span-3" />
        <MarksSection tasks={tasks} className="lg:col-span-2" />
      </motion.div>

      {overview.subjects.length === 0 ? (
        <div className={`${focusCard} p-10 text-center`}>
          <BookOpen className="w-8 h-8 mx-auto text-blue-500 mb-2" />
          <p className={`font-medium ${focusInk.primary}`}>You're not enrolled in any subject for this period</p>
          <p className={`text-sm mt-1 ${focusInk.secondary}`}>Check the academic period in the top bar, or ask your class teacher.</p>
        </div>
      ) : (
        <motion.section variants={dashboardItemVariants} aria-labelledby="my-subjects">
          <div className="mb-3 flex items-baseline justify-between">
            <div>
              <h2 id="my-subjects" className={`text-lg font-semibold ${focusInk.primary}`}>
                My subjects
              </h2>
              <p className={`text-xs ${focusInk.secondary}`}>You (bar) against the class average (tick) · tap to open</p>
            </div>
            {cards.length > SUBJECTS_SHOWN && (
              <button
                type="button"
                onClick={() => setAllSubjects((v) => !v)}
                aria-expanded={allSubjects}
                className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                {allSubjects ? "Show fewer" : `See all ${cards.length}`}
              </button>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {shownCards.map((c, i) => (
              <SubjectCard key={c.subject.subject_id} data={c} index={i} />
            ))}
          </div>
        </motion.section>
      )}

      <motion.div variants={dashboardItemVariants} className={`grid gap-6 ${tips.length ? "lg:grid-cols-3" : ""}`}>
        {tips.length > 0 && <TipsSection tips={tips} />}
        <Section id="report-card" title="My report cards" icon={<FileText className="h-4 w-4" />} className={tips.length ? "lg:col-span-2" : ""}>
          <ReportCardPanel />
        </Section>
      </motion.div>
    </motion.div>
  );
};

const Skeleton: React.FC = () => (
  <div className="space-y-8 animate-pulse" aria-busy="true" aria-label="Loading dashboard">
    <div className="h-56 rounded-3xl bg-blue-100/70 dark:bg-blue-900/20" />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-48 rounded-2xl bg-gray-200/70 dark:bg-gray-700/40" />
      ))}
    </div>
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="h-64 rounded-2xl bg-gray-200/70 dark:bg-gray-700/40 lg:col-span-2" />
      <div className="h-64 rounded-2xl bg-gray-200/70 dark:bg-gray-700/40 lg:col-span-3" />
    </div>
  </div>
);

export default StudentDashboard;

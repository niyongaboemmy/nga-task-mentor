import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { AlertTriangle, BookOpen } from "lucide-react";
import axios from "../../utils/axiosConfig";
import { useAuth } from "../../contexts/AuthContext";
import { dashboardContainerVariants, dashboardItemVariants } from "./dashboardUi";
import ReportCardPanel from "./student/ReportCardPanel";
import { ComingUp, FocusHero, MarksBars, SubjectCard, focusCard, focusInk, type SubjectCardData } from "./student/FocusDashboard";
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
 * Student dashboard ("Focus", picked from three mockups):
 *   1. a blue hero that says in words what to do next, with the action button,
 *      and this week's progress, average and class rank beside it,
 *   2. subject cards, busiest first, each with its own next step or latest mark,
 *   3. what's coming up (and anything missed), and recent marks with the
 *      report card.
 * Reminders go to the notification bell (publishAlerts), not onto the page.
 * Data: GET /dashboard/student/overview; averages including teacher-recorded
 * marks and the rank come from GET /rankings (optional).
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
}

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
  const location = useLocation();
  const [overview, setOverview] = useState<StudentOverview | null>(null);
  const [standing, setStanding] = useState<StandingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [staleError, setStaleError] = useState<string | null>(null);
  const [allSubjects, setAllSubjects] = useState(false);
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

  useEffect(() => {
    if (!overview || !location.hash) return;
    document.getElementById(location.hash.slice(1))?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }, [overview, location.hash]);

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView?.({ behavior: "smooth", block: "start" });

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
          first={first}
          second={second}
          upcomingLater={upcomingLater}
          weekDone={weekDone}
          weekTotal={weekTasks.length}
          average={average}
          rank={overall?.rank ?? null}
          rankedCount={overall?.ranked_count ?? 0}
          refreshing={refreshing}
          onRefresh={() => load()}
          onSeeWeek={() => scrollTo("coming-up")}
        />
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
            <h2 id="my-subjects" className={`text-lg font-semibold ${focusInk.primary}`}>
              Your subjects
            </h2>
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

      <div className="grid gap-6 lg:grid-cols-2">
        <motion.section variants={dashboardItemVariants} id="coming-up" aria-labelledby="coming-up-title" className={`${focusCard} p-6 scroll-mt-24`}>
          <h2 id="coming-up-title" className={`text-lg font-semibold ${focusInk.primary}`}>
            Coming up
          </h2>
          <div className="mt-3">
            <ComingUp tasks={tasks} />
          </div>
        </motion.section>
        <motion.section variants={dashboardItemVariants} id="results" aria-labelledby="marks-title" className={`${focusCard} p-6 scroll-mt-24`}>
          <h2 id="marks-title" className={`text-lg font-semibold ${focusInk.primary}`}>
            Recent marks
          </h2>
          <div className="mt-4">
            <MarksBars tasks={tasks} />
          </div>
          <div id="report-card" className="mt-5 border-t border-slate-100 dark:border-white/[0.06] pt-4">
            <ReportCardPanel />
          </div>
        </motion.section>
      </div>
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
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="h-64 rounded-2xl bg-gray-200/70 dark:bg-gray-700/40" />
      <div className="h-64 rounded-2xl bg-gray-200/70 dark:bg-gray-700/40" />
    </div>
  </div>
);

export default StudentDashboard;

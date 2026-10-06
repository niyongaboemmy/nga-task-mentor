import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BellRing,
  BookOpen,
  CalendarClock,
  ClipboardList,
  Download,
  Eye,
  FilePlus2,
  GraduationCap,
  Library,
  ListChecks,
  RefreshCw,
  Target,
  TrendingUp,
  Trophy,
  UserCheck,
  Users,
} from "lucide-react";
import axios from "../../utils/axiosConfig";
import { useAuth } from "../../contexts/AuthContext";
import { usePermissions } from "../../hooks/usePermissions";
import { ActivityRow, EmptyState, dashboardContainerVariants, dashboardItemVariants, type RecentActivity } from "./dashboardUi";
import {
  getInstructorOverview,
  overviewToCsv,
  subjectLabel,
  type DashboardAlert,
  type InstructorOverview,
} from "../../services/instructorOverviewApi";
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
import { ActivityTrendChart, ScoreDistributionChart, SubjectComparisonChart } from "./instructor/InstructorCharts";
import SchoolInsights from "./admin/SchoolInsights";
import BulkExportReportCards from "../ReportCard/BulkExportReportCards";
import { getAdminInsights, type AdminInsights } from "../../services/adminReportsApi";
import {
  AlertsList,
  GradingQueue,
  KpiTile,
  Panel,
  ProgressBar,
  StudentWatchlist,
  SubjectScorecards,
  UpcomingList,
  pct,
  relativeDue,
} from "./instructor/InstructorPanels";

/**
 * Instructor dashboard: one decision board across every subject the teacher is
 * assigned in the app-bar academic period. Data: GET
 * /dashboard/instructor/overview (optionally ?subjectId=) + the shared
 * /dashboard/activity feed. The subject focus lives in the URL (?subject=) so
 * a focused view can be bookmarked or shared.
 */

const REFRESH_MS = 2 * 60 * 1000;
/** How long "New" chips stay after the dashboard first shows an alert. */
const SEEN_AFTER_MS = 4000;

const periodName = (p: unknown): string | undefined =>
  p && typeof p === "object" && "name" in p ? String((p as { name: unknown }).name) : undefined;

function greeting(d = new Date()) {
  const h = d.getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

/** More subjects than this and the focus chips become a picker. */
const MAX_FOCUS_CHIPS = 12;
/** The comparison chart shows at most this many (the weakest) subjects. */
const MAX_COMPARED = 12;

export interface InstructorDashboardProps {
  /**
   * "admin": the same board over every subject in the school, plus the
   * school-wide layer (teachers, classes, report-card readiness, coverage).
   */
  variant?: "teacher" | "admin";
}

const InstructorDashboard: React.FC<InstructorDashboardProps> = ({ variant = "teacher" }) => {
  const isAdmin = variant === "admin";
  const { can } = usePermissions();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const subjectParam = params.get("subject");
  const subjectId = subjectParam ? Number(subjectParam) : null;

  const location = useLocation();
  const [overview, setOverview] = useState<InstructorOverview | null>(null);
  // The unfiltered subject list keeps the filter chips stable while focused.
  const [allSubjects, setAllSubjects] = useState<InstructorOverview["subjects"]>([]);
  const [activity, setActivity] = useState<RecentActivity[]>([]);
  const [insights, setInsights] = useState<AdminInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  /** Fatal: nothing to show yet. */
  const [error, setError] = useState<string | null>(null);
  /** A later refresh failed: keep showing the last good data with a notice. */
  const [staleError, setStaleError] = useState<string | null>(null);
  const [, setTick] = useState(0);
  useSyncExternalStore(subscribeAlerts, getAlertsVersion);
  // Only the latest request may write state (fast subject switching).
  const requestSeq = useRef(0);
  // Strings, not the period objects, so a re-created user object doesn't refetch.
  const termLabel = periodName(user?.currentAcademicTerm);
  const yearLabel = periodName(user?.currentAcademicYear);
  const hasData = useRef(false);

  const load = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      const seq = ++requestSeq.current;
      if (hasData.current) setRefreshing(true);
      try {
        const period = { term: termLabel, academic_year: yearLabel };
        const [o, act, ins] = await Promise.all([
          getInstructorOverview(subjectId, { fresh: mode === "refresh" }),
          axios
            .get("/dashboard/activity")
            .then((r) => (r.data?.data ?? []) as RecentActivity[])
            .catch(() => [] as RecentActivity[]),
          // The school-wide layer is optional: the board still renders without it.
          isAdmin && subjectId == null
            ? getAdminInsights(period, mode === "refresh").catch(() => null)
            : Promise.resolve(null),
        ]);
        if (seq !== requestSeq.current) return;
        if (isAdmin && subjectId == null) setInsights(ins);
        hasData.current = true;
        setOverview(o);
        if (subjectId == null) {
          setAllSubjects(o.subjects);
          publishAlerts(o.alerts); // the top-bar bell shows the same notifications
        }
        setActivity(act);
        setError(null);
        setStaleError(null);
      } catch (err) {
        if (seq !== requestSeq.current) return;
        const e = err as { response?: { status?: number; data?: { message?: string } } };
        if (e?.response?.status === 404 && subjectId != null) {
          // A stale ?subject= from another term: drop it and show everything.
          // Stay in the loading state; the unfocused load follows.
          setParams((p) => {
            p.delete("subject");
            return p;
          });
          return;
        }
        const message = e?.response?.data?.message || "Couldn't load your dashboard.";
        if (hasData.current) setStaleError(message);
        else setError(message);
      } finally {
        if (seq === requestSeq.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [subjectId, setParams, isAdmin, termLabel, yearLabel],
  );

  useEffect(() => {
    load();
  }, [load]);

  // The chips (and the bell) need the full picture even when the page opens
  // already focused on one subject.
  useEffect(() => {
    if (subjectId != null && allSubjects.length === 0) {
      getInstructorOverview(null)
        .then((o) => {
          setAllSubjects(o.subjects);
          publishAlerts(o.alerts);
        })
        .catch(() => undefined);
    }
  }, [subjectId, allSubjects.length]);

  // Quiet auto-refresh while the tab is visible, plus a clock for "updated Xm ago".
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") load("refresh");
    }, REFRESH_MS);
    const clock = window.setInterval(() => setTick((t) => t + 1), 30000);
    return () => {
      window.clearInterval(id);
      window.clearInterval(clock);
    };
  }, [load]);

  const selectSubject = useCallback(
    (id: number | null) => {
      setParams((p) => {
        if (id == null) p.delete("subject");
        else p.set("subject", String(id));
        return p;
      });
    },
    [setParams],
  );

  const alerts = visibleAlerts(overview?.alerts ?? []);
  // Which alerts are new to the teacher, captured before they get marked seen.
  const newSignatures = useMemo(
    () => new Set((overview?.alerts ?? []).filter((a) => isImportant(a) && !isSeen(a)).map(alertSignature)),
    [overview],
  );
  // Seeing the Notifications panel counts as reading them (clears the bell badge).
  useEffect(() => {
    if (!overview) return;
    const t = window.setTimeout(() => markSeen(overview.alerts), SEEN_AFTER_MS);
    return () => window.clearTimeout(t);
  }, [overview]);

  // Deep links such as /dashboard#students (from the bell) scroll once loaded.
  useEffect(() => {
    if (!overview || !location.hash) return;
    const el = document.getElementById(location.hash.slice(1));
    el?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }, [overview, location.hash]);

  const runAction = (a: Pick<DashboardAlert, "action">) => {
    if (!a.action) return;
    if (a.action.url.startsWith("#")) {
      document.getElementById(a.action.url.slice(1))?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    } else navigate(a.action.url);
  };

  const exportCsv = () => {
    if (!overview) return;
    const blob = new Blob([overviewToCsv(overview)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const term = periodName(user?.currentAcademicTerm) ?? "term";
    a.href = url;
    a.download = `${isAdmin ? "school" : "teaching"}-summary-${String(term).replace(/\s+/g, "-").toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <DashboardSkeleton />;

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

  const t = overview.totals;
  const importantCount = alerts.filter(isImportant).length;
  const focused = subjectId != null ? overview.subjects[0] : null;
  const yearName = periodName(user?.currentAcademicYear);
  const termName = periodName(user?.currentAcademicTerm);
  const updatedMins = Math.floor((Date.now() - new Date(overview.generated_at).getTime()) / 60000);
  const withAverage = overview.subjects.filter((s) => s.avg_score != null);
  const compared =
    withAverage.length > MAX_COMPARED
      ? [...withAverage].sort((a, b) => a.avg_score! - b.avg_score!).slice(0, MAX_COMPARED)
      : overview.subjects;

  const headline: string[] = [];
  if (t.pending_grading > 0) headline.push(`${t.pending_grading} submission${t.pending_grading === 1 ? "" : "s"} to grade`);
  if (t.due_next_7_days > 0) headline.push(`${t.due_next_7_days} deadline${t.due_next_7_days === 1 ? "" : "s"} in the next 7 days`);
  if (t.at_risk_students > 0) headline.push(`${t.at_risk_students} student${t.at_risk_students === 1 ? "" : "s"} needing support`);

  return (
    <motion.div
      variants={dashboardContainerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-5"
      aria-busy={refreshing}
    >
      {/* Header */}
      <motion.div variants={dashboardItemVariants} className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark">
            {greeting()}, {user?.first_name || "Teacher"}
          </h2>
          <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mt-1">
            {isAdmin && <span className="font-medium">School overview. </span>}
            {headline.length > 0 ? `Today: ${headline.join(" · ")}.` : isAdmin ? "Nothing outstanding across the school." : "You're all caught up."}
            {(yearName || termName) && (
              <span className="text-text-secondary-light/80 dark:text-text-secondary-dark/60">
                {" "}Showing {[yearName, termName].filter(Boolean).join(" · ")}.
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark/70">
            Updated {updatedMins <= 0 ? "just now" : `${updatedMins}m ago`}
          </span>
          <button
            type="button"
            onClick={() => load("refresh")}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium bg-card-light dark:bg-card-dark/40 shadow-sm hover:shadow text-text-primary-light dark:text-text-primary-dark disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium bg-card-light dark:bg-card-dark/40 shadow-sm hover:shadow text-text-primary-light dark:text-text-primary-dark"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          {isAdmin ? (
            <Link
              to="/courses"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
            >
              <BookOpen className="w-4 h-4" />
              Subjects report
            </Link>
          ) : (
            <Link
              to="/assignments/create"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
            >
              <FilePlus2 className="w-4 h-4" />
              New assignment
            </Link>
          )}
        </div>
      </motion.div>

      {staleError && (
        <motion.div
          variants={dashboardItemVariants}
          role="status"
          className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-900/10 px-4 py-2 text-sm text-amber-800 dark:text-amber-200"
        >
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Couldn't refresh ({staleError}). Showing data from {updatedMins <= 0 ? "just now" : `${updatedMins}m ago`}.
        </motion.div>
      )}

      {/* Subject focus */}
      {allSubjects.length > MAX_FOCUS_CHIPS && (
        <motion.div variants={dashboardItemVariants}>
          <SubjectFocusPicker subjects={allSubjects} selected={subjectId} onSelect={selectSubject} />
        </motion.div>
      )}
      {allSubjects.length > 1 && allSubjects.length <= MAX_FOCUS_CHIPS && (
        <motion.div variants={dashboardItemVariants} className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" role="tablist" aria-label="Focus on a subject">
          <Chip active={subjectId == null} onClick={() => selectSubject(null)}>
            All subjects ({allSubjects.length})
          </Chip>
          {allSubjects.map((s) => (
            <Chip key={s.subject_id} active={subjectId === s.subject_id} onClick={() => selectSubject(s.subject_id)} title={s.subject_name}>
              <HealthDot health={s.health} />
              {subjectLabel(s)}
            </Chip>
          ))}
        </motion.div>
      )}

      {overview.subjects.length === 0 ? (
        <div className="bg-card-light dark:bg-card-dark/30 rounded-2xl shadow-sm">
          <EmptyState
            icon={<BookOpen className="w-6 h-6 text-text-secondary-light dark:text-text-secondary-dark/60" />}
            title={isAdmin ? "No subjects found" : "No subjects assigned for this period"}
            description={
              isAdmin
                ? "The MIS subject catalogue returned no subjects. Check the MIS connection or switch the academic period in the top bar."
                : "Subjects you're assigned to teach in the MIS for the selected term will appear here. Try switching the academic period in the top bar."
            }
          />
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 2xl:grid-cols-8 gap-3">
            <KpiTile
              icon={<GraduationCap className="w-4 h-4" />}
              color="blue"
              label={focused ? "Students" : "Subjects"}
              value={focused ? (t.students ?? "—").toString() : t.subjects.toString()}
              hint={focused ? focused.class_groups.join(", ") || undefined : t.students != null ? `${t.students} students · ${t.class_groups} classes` : undefined}
              to="/courses"
            />
            <KpiTile
              icon={<ClipboardList className="w-4 h-4" />}
              color="amber"
              label="To grade"
              value={t.pending_grading.toString()}
              hint={t.overdue_grading > 0 ? `${t.overdue_grading} over a week old` : undefined}
              delta={{ current: t.graded_this_week, previous: t.graded_last_week, goodWhenUp: true, unit: " graded" }}
              emphasis={t.overdue_grading > 0 ? "critical" : undefined}
              to="/submissions?status=needs_grading"
            />
            <KpiTile
              icon={<Target className="w-4 h-4" />}
              color="emerald"
              label="Class average"
              value={pct(t.avg_score)}
              progress={t.avg_score}
              hint={t.avg_score == null ? "No graded work yet" : undefined}
            />
            <KpiTile
              icon={<UserCheck className="w-4 h-4" />}
              color="indigo"
              label="Pass rate"
              value={pct(t.pass_rate)}
              progress={t.pass_rate}
              hint="students at 50%+"
            />
            <KpiTile
              icon={<ListChecks className="w-4 h-4" />}
              color="violet"
              label="Participation"
              value={pct(t.participation)}
              progress={t.participation}
              delta={{ current: t.submissions_this_week, previous: t.submissions_last_week, goodWhenUp: true, unit: " submitted" }}
              hint={overview.rosters_available ? (t.missing_work > 0 ? `${t.missing_work} missing` : "closed work") : "roster unavailable"}
            />
            <KpiTile
              icon={<Users className="w-4 h-4" />}
              color="red"
              label="Need support"
              value={t.at_risk_students.toString()}
              hint={t.students ? `of ${t.students} students` : undefined}
              emphasis={t.at_risk_students > 0 ? "warning" : undefined}
              onClick={() => document.getElementById("students")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            />
            <KpiTile
              icon={<CalendarClock className="w-4 h-4" />}
              color="purple"
              label="Due in 7 days"
              value={t.due_next_7_days.toString()}
              hint={overview.upcoming[0]?.due_at ? `next ${relativeDue(overview.upcoming[0].due_at)}` : "nothing scheduled"}
              onClick={() => document.getElementById("upcoming")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            />
            <KpiTile
              icon={<Eye className="w-4 h-4" />}
              color="red"
              label="Live proctoring"
              value={t.live_proctoring.toString()}
              hint={
                t.stale_proctoring > 0
                  ? `${t.stale_proctoring} stale`
                  : t.flagged_sessions > 0
                    ? `${t.flagged_sessions} flagged`
                    : "students online now"
              }
              to="/proctoring/live"
            />
          </div>

          {/* Notifications + focused subject summary */}
          <div className="grid gap-5 lg:grid-cols-3">
            <Panel
              title="Notifications"
              subtitle={
                importantCount > 0
                  ? `${importantCount} need${importantCount === 1 ? "s" : ""} your attention, most urgent first`
                  : "Nothing urgent right now"
              }
              icon={<BellRing className="w-4 h-4" />}
              iconColor="amber"
              className={focused ? "lg:col-span-2" : "lg:col-span-3"}
            >
              <AlertsList
                alerts={alerts}
                onDismiss={dismissAlert}
                onAction={runAction}
                isNew={(a) => newSignatures.has(alertSignature(a))}
                limit={focused ? 4 : 3}
              />
            </Panel>
            {focused && (
              <Panel
                title={focused.subject_name}
                subtitle={focused.class_groups.join(", ") || "Subject summary"}
                icon={<BookOpen className="w-4 h-4" />}
                action={
                  <Link to={`/courses/${focused.subject_id}`} className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">
                    Open subject
                  </Link>
                }
              >
                <ul className="space-y-1.5 text-sm">
                  {focused.health_reasons.map((r) => (
                    <li key={r} className="text-text-secondary-light dark:text-text-secondary-dark">• {r}</li>
                  ))}
                </ul>
                <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                  <MiniStat label="Assignments" value={focused.assignments} />
                  <MiniStat label="Quizzes" value={focused.quizzes} />
                  <MiniStat label="Drafts" value={focused.drafts} />
                </div>
              </Panel>
            )}
          </div>

          {isAdmin && !focused && insights && <SchoolInsights insights={insights} />}

          {/* Trend + distribution */}
          <div className="grid gap-5 lg:grid-cols-3">
            <Panel
              title="Weekly activity"
              subtitle="Work submitted by students vs work you graded, last 10 weeks"
              icon={<TrendingUp className="w-4 h-4" />}
              className="lg:col-span-2"
            >
              <ActivityTrendChart trend={overview.trend} />
              <DataTable
                caption="Weekly activity data"
                head={["Week of", "Submitted", "Graded", "Avg score"]}
                rows={overview.trend.map((w) => [
                  new Date(w.week_start).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" }),
                  w.submissions,
                  w.graded,
                  pct(w.avg_score),
                ])}
              />
            </Panel>
            <Panel title="Score distribution" subtitle="Best graded result per student per assessment" icon={<BarChart3 className="w-4 h-4" />} iconColor="indigo">
              {overview.distribution.some((b) => b.count > 0) ? (
                <>
                  <ScoreDistributionChart distribution={overview.distribution} />
                  <DataTable caption="Score distribution data" head={["Band", "Results"]} rows={overview.distribution.map((b) => [`${b.band}%`, b.count])} />
                </>
              ) : (
                <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark py-16 text-center">No graded work yet this term.</p>
              )}
            </Panel>
          </div>

          {/* Subject scorecards */}
          <Panel
            title="Subject scorecards"
            subtitle="Click a row to focus the dashboard on that subject. Sort by any column."
            icon={<BookOpen className="w-4 h-4" />}
            iconColor="emerald"
          >
            <SubjectScorecards
              subjects={allSubjects.length ? allSubjects : overview.subjects}
              selected={subjectId}
              onSelect={selectSubject}
              pageSize={isAdmin || allSubjects.length > 15 ? 10 : undefined}
            />
          </Panel>

          {/* Work queues */}
          <div className="grid gap-5 lg:grid-cols-3">
            <Panel title="Grading queue" subtitle="Oldest waiting first" icon={<ClipboardList className="w-4 h-4" />} iconColor="amber">
              <GradingQueue items={overview.grading_queue} />
            </Panel>
            <Panel id="upcoming" title="Upcoming deadlines" subtitle="Next 14 days, with submissions so far" icon={<CalendarClock className="w-4 h-4" />} iconColor="purple">
              <UpcomingList items={overview.upcoming} />
            </Panel>
            <Panel
              id="students"
              title="Students"
              subtitle={`Below 50% or with 2+ missing submissions`}
              icon={<Users className="w-4 h-4" />}
              iconColor="red"
              action={
                isAdmin ? (
                  <Link to="/students?attention=1" className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap">
                    See all
                  </Link>
                ) : undefined
              }
            >
              <StudentWatchlist atRisk={overview.students.at_risk} top={overview.students.top} />
            </Panel>
          </div>

          {/* Comparison + assessment performance */}
          <div className="grid gap-5 lg:grid-cols-3">
            {!focused && overview.subjects.some((s) => s.avg_score != null) && (
              <Panel
                title="Subject comparison"
                subtitle={
                  compared.length < overview.subjects.filter((s) => s.avg_score != null).length
                    ? `The ${compared.length} lowest class averages against the pass mark`
                    : "Class average against the pass mark"
                }
                icon={<BarChart3 className="w-4 h-4" />}
              >
                <SubjectComparisonChart subjects={compared} onSelect={selectSubject} />
              </Panel>
            )}
            <Panel
              id="assessments"
              title="Assessment performance"
              subtitle="Published work this term, most recent first"
              icon={<Activity className="w-4 h-4" />}
              iconColor="violet"
              className={!focused && overview.subjects.some((s) => s.avg_score != null) ? "lg:col-span-2" : "lg:col-span-3"}
            >
              <AssessmentTable items={overview.assessments} />
            </Panel>
          </div>
        </>
      )}

      {/* Quick actions + activity */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Panel title="Quick actions" icon={<FilePlus2 className="w-4 h-4" />}>
          {isAdmin ? (
            <div className="grid grid-cols-2 gap-2">
              <QuickAction to="/courses" icon={<BookOpen className="w-4 h-4" />} label="All subjects" />
              <QuickAction to="/students" icon={<Users className="w-4 h-4" />} label="All students" />
              {can("RANKINGS_VIEW_ALL") && (
                <QuickAction to="/ranking" icon={<Trophy className="w-4 h-4" />} label="Ranking" />
              )}
              <QuickAction to="/submissions?status=needs_grading" icon={<ClipboardList className="w-4 h-4" />} label="Needs grading" />
              <QuickAction to="/quizzes" icon={<ListChecks className="w-4 h-4" />} label="Quizzes" />
              <QuickAction to="/grades" icon={<GraduationCap className="w-4 h-4" />} label="Grades" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <QuickAction to="/assignments/create" icon={<FilePlus2 className="w-4 h-4" />} label="New assignment" />
              <QuickAction to="/quizzes" icon={<ListChecks className="w-4 h-4" />} label="Quizzes" />
              <QuickAction to="/submissions" icon={<ClipboardList className="w-4 h-4" />} label="Submissions" />
              <QuickAction to="/question-bank" icon={<Library className="w-4 h-4" />} label="Question bank" />
              <QuickAction to="/students" icon={<Users className="w-4 h-4" />} label="My students" />
              <QuickAction to="/reports" icon={<BarChart3 className="w-4 h-4" />} label="Reports" />
            </div>
          )}
        </Panel>
        <Panel
          title="Recent activity"
          subtitle={isAdmin ? "Latest across the school" : "Latest across your subjects"}
          icon={<Activity className="w-4 h-4" />}
          iconColor="violet"
          className="lg:col-span-2"
        >
          {activity.length > 0 ? (
            <div className="space-y-1">
              {activity.slice(0, 5).map((a) => (
                <ActivityRow key={a.id} activity={a} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark py-6 text-center">No recent activity yet.</p>
          )}
        </Panel>
      </div>

      {isAdmin && <BulkExportReportCards />}
    </motion.div>
  );
};

// ─── Small pieces ─────────────────────────────────────────────────────────────

const Chip: React.FC<{ active: boolean; onClick: () => void; title?: string; children: React.ReactNode }> = ({
  active,
  onClick,
  title,
  children,
}) => (
  <button
    type="button"
    role="tab"
    aria-selected={active}
    title={title}
    onClick={onClick}
    className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
      active
        ? "bg-blue-600 text-white shadow-sm"
        : "bg-card-light dark:bg-card-dark/40 text-text-secondary-light dark:text-text-secondary-dark shadow-sm hover:text-text-primary-light dark:hover:text-text-primary-dark"
    }`}
  >
    {children}
  </button>
);

/** A searchable picker for schools with too many subjects for chips. */
const SubjectFocusPicker: React.FC<{
  subjects: InstructorOverview["subjects"];
  selected: number | null;
  onSelect: (id: number | null) => void;
}> = ({ subjects, selected, onSelect }) => {
  const sorted = useMemo(() => [...subjects].sort((a, b) => a.subject_name.localeCompare(b.subject_name)), [subjects]);
  const atRisk = subjects.filter((s) => s.health === "at_risk").slice(0, 6);
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
      <label className="flex items-center gap-2 text-sm text-text-secondary-light dark:text-text-secondary-dark">
        <span className="shrink-0">Focus</span>
        <select
          value={selected ?? ""}
          onChange={(e) => onSelect(e.target.value ? Number(e.target.value) : null)}
          className="min-w-0 w-full sm:w-80 rounded-full border border-border-light dark:border-border-dark/50 bg-card-light dark:bg-card-dark/40 px-3 py-1.5 text-sm text-text-primary-light dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          aria-label="Focus on a subject"
        >
          <option value="">All subjects ({subjects.length})</option>
          {sorted.map((s) => (
            <option key={s.subject_id} value={s.subject_id}>
              {s.subject_code ? `${s.subject_code} · ${s.subject_name}` : s.subject_name}
              {s.health === "at_risk" ? " (at risk)" : ""}
            </option>
          ))}
        </select>
      </label>
      {atRisk.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto" aria-label="Subjects at risk">
          {atRisk.map((s) => (
            <Chip key={s.subject_id} active={selected === s.subject_id} onClick={() => onSelect(s.subject_id)} title={s.subject_name}>
              <HealthDot health={s.health} />
              {subjectLabel(s)}
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
};

const HealthDot: React.FC<{ health: InstructorOverview["subjects"][number]["health"] }> = ({ health }) => (
  <span
    aria-hidden
    className={`w-2 h-2 rounded-full ${
      health === "at_risk" ? "bg-red-500" : health === "watch" ? "bg-amber-500" : health === "on_track" ? "bg-emerald-500" : "bg-gray-400"
    }`}
  />
);

const MiniStat: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="rounded-xl bg-surface-light dark:bg-surface-dark/50 py-2">
    <div className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark">{value}</div>
    <div className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark">{label}</div>
  </div>
);

const QuickAction: React.FC<{ to: string; icon: React.ReactNode; label: string }> = ({ to, icon, label }) => (
  <Link
    to={to}
    className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-surface-light dark:bg-surface-dark/50 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-sm font-medium text-text-primary-light dark:text-text-primary-dark transition-colors"
  >
    <span className="text-blue-600 dark:text-blue-400">{icon}</span>
    {label}
  </Link>
);

const DataTable: React.FC<{ caption: string; head: string[]; rows: Array<Array<string | number>> }> = ({ caption, head, rows }) => (
  <details className="mt-3 group">
    <summary className="text-xs text-text-secondary-light dark:text-text-secondary-dark cursor-pointer select-none hover:text-text-primary-light dark:hover:text-text-primary-dark">
      View as table
    </summary>
    <table className="mt-2 w-full text-xs">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="text-left text-text-secondary-light dark:text-text-secondary-dark">
          {head.map((h) => (
            <th key={h} scope="col" className="py-1 pr-3 font-medium">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody className="tabular-nums text-text-primary-light dark:text-text-primary-dark">
        {rows.map((r, i) => (
          <tr key={i} className="border-t border-border-light/60 dark:border-border-dark/30">
            {r.map((c, j) => (
              <td key={j} className="py-1 pr-3">{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </details>
);

const AssessmentTable: React.FC<{ items: InstructorOverview["assessments"] }> = ({ items }) => {
  const [showAll, setShowAll] = useState(false);
  if (items.length === 0) {
    return <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark py-6 text-center">No published assessments yet.</p>;
  }
  const shown = showAll ? items : items.slice(0, 8);
  return (
    <div className="overflow-x-auto -mx-5">
      <table className="w-full text-sm min-w-[620px]">
        <thead className="text-xs text-left text-text-secondary-light dark:text-text-secondary-dark border-b border-border-light dark:border-border-dark/40">
          <tr>
            <th scope="col" className="pl-5 pr-3 py-2 font-medium">Assessment</th>
            <th scope="col" className="px-3 py-2 font-medium">Due</th>
            <th scope="col" className="px-3 py-2 font-medium">Submitted</th>
            <th scope="col" className="px-3 py-2 font-medium">Average</th>
            <th scope="col" className="pr-5 pl-3 py-2 font-medium">Pass rate</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((a) => (
            <tr key={`${a.kind}-${a.id}`} className="border-b last:border-0 border-border-light/70 dark:border-border-dark/30 hover:bg-surface-light dark:hover:bg-surface-dark/40">
              <td className="pl-5 pr-3 py-2.5">
                <Link to={a.url} className="font-medium text-text-primary-light dark:text-text-primary-dark hover:text-blue-600 dark:hover:text-blue-400 line-clamp-1">
                  {a.title}
                </Link>
                <div className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                  {subjectLabel(a)} · {a.kind === "quiz" ? a.quiz_type || "Quiz" : "Assignment"}
                  {a.pending > 0 && <span className="text-amber-600 dark:text-amber-400"> · {a.pending} to grade</span>}
                </div>
              </td>
              <td className="px-3 py-2.5 text-xs text-text-secondary-light dark:text-text-secondary-dark whitespace-nowrap">
                {a.due_at ? relativeDue(a.due_at) : "—"}
              </td>
              <td className="px-3 py-2.5 w-32">
                <div className="text-xs text-text-primary-light dark:text-text-primary-dark tabular-nums">
                  {a.submitted}
                  {a.expected != null && `/${a.expected}`}
                </div>
                {a.expected != null && <ProgressBar value={a.participation} tone="blue" />}
              </td>
              <td className="px-3 py-2.5 w-28">
                <div className="text-xs font-medium text-text-primary-light dark:text-text-primary-dark">{pct(a.avg_score)}</div>
                <ProgressBar value={a.avg_score} />
              </td>
              <td className="pr-5 pl-3 py-2.5 text-xs text-text-primary-light dark:text-text-primary-dark tabular-nums">{pct(a.pass_rate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {items.length > 8 && (
        <div className="px-5 pt-3">
          <button type="button" onClick={() => setShowAll((v) => !v)} className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">
            {showAll ? "Show fewer" : `Show all ${items.length}`}
          </button>
        </div>
      )}
    </div>
  );
};

const DashboardSkeleton: React.FC = () => (
  <div className="space-y-5 animate-pulse" aria-busy="true" aria-label="Loading dashboard">
    <div className="h-8 w-72 rounded-lg bg-gray-200 dark:bg-gray-700/50" />
    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-28 rounded-2xl bg-gray-200/70 dark:bg-gray-700/40" />
      ))}
    </div>
    <div className="h-28 rounded-2xl bg-gray-200/70 dark:bg-gray-700/40" />
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="h-72 rounded-2xl bg-gray-200/70 dark:bg-gray-700/40 lg:col-span-2" />
      <div className="h-72 rounded-2xl bg-gray-200/70 dark:bg-gray-700/40" />
    </div>
  </div>
);

export default InstructorDashboard;

import { useEffect, useMemo, useState } from "react";
import UserAvatar from "../ui/UserAvatar";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  Award,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Gauge,
  Info,
  LifeBuoy,
  ListChecks,
  PencilLine,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Trophy,
  UserX,
} from "lucide-react";
import { BandPill, KpiCard, Panel, Progress } from "../Grades/reportUi";
import { containerVariants, itemVariants } from "../Grades/reportMotion";
import {
  BANDS,
  bandMeta,
  bandOf,
  buildReportAlerts,
  type AssessmentStat,
  type ReportAlert,
  type StudentStat,
} from "../../services/subjectReportApi";
import {
  ReportCardApiService,
  type ReportCardStatus,
} from "../../services/reportCardApi";
import type { Course } from "../../types/course.types";
import type { RecordedAssessmentsState } from "./useRecordedAssessments";

// ─── Course Details → "Overview" tab ──────────────────────────────────────────
// A one-screen decision board for the teacher: how the class is doing, what
// still needs doing, and who needs help — for the academic period picked in
// the app bar (every call here is scoped by the session term). Built from the
// same derived report the Reports page and the Recorded Assessments tab use
// (GET /courses/:id/grades → buildSubjectReport), so the numbers agree
// everywhere. A student sees the subject info and their own standing only.

export type OverviewTarget = "assignments" | "quizzes" | "recorded" | "students" | "report-cards";

interface CourseOverviewPanelProps {
  course: Course;
  courseId: string;
  state: RecordedAssessmentsState;
  /** Class-wide view (COURSES_VIEW_GRADES); otherwise the caller's own row. */
  canViewAll: boolean;
  canViewReportCards: boolean;
  periodLabel: string | null;
  termName?: string;
  academicYearName?: string;
  onNavigate: (tab: OverviewTarget) => void;
}

const KIND_META: Record<AssessmentStat["kind"], { label: string; tab: OverviewTarget; cls: string }> = {
  quiz: {
    label: "Quiz",
    tab: "quizzes",
    cls: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
  },
  assignment: {
    label: "Assignment",
    tab: "assignments",
    cls: "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300",
  },
  manual: {
    label: "Recorded",
    tab: "recorded",
    cls: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300",
  },
};

const TONE: Record<ReportAlert["tone"], { icon: React.ReactNode; ring: string; iconCls: string }> = {
  serious: {
    icon: <AlertTriangle className="w-4 h-4" />,
    ring: "border-red-200 dark:border-red-500/25 bg-red-50/60 dark:bg-red-500/5",
    iconCls: "bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400",
  },
  warning: {
    icon: <PencilLine className="w-4 h-4" />,
    ring: "border-amber-200 dark:border-amber-500/25 bg-amber-50/60 dark:bg-amber-500/5",
    iconCls: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400",
  },
  good: {
    icon: <CheckCircle2 className="w-4 h-4" />,
    ring: "border-emerald-200 dark:border-emerald-500/25 bg-emerald-50/60 dark:bg-emerald-500/5",
    iconCls: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
  },
};

/** The id-bearing fields of a roster row; which one is set depends on its source. */
type RosterRow = {
  user?: { id?: number | string; user_id?: number | string; email?: string };
  student_id?: number | string;
};

const formatDate = (iso: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? null
    : d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

// ─── Small pieces ─────────────────────────────────────────────────────────────

function SubjectInfoCard({
  course,
  enrolled,
  periodLabel,
}: {
  course: Course;
  enrolled: number;
  periodLabel: string | null;
}) {
  const rows: Array<[string, React.ReactNode]> = [
    ["Code", course.code],
    ["Credits", course.credits ?? 0],
    ["Enrolled", `${enrolled} student${enrolled !== 1 ? "s" : ""}`],
  ];
  if (periodLabel) rows.push(["Period", periodLabel]);
  return (
    <Panel title="About this subject" icon={<Info className="w-4 h-4" />}>
      <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark/70 leading-relaxed mb-4">
        {course.description?.trim() || "No description has been added for this subject yet."}
      </p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        {rows.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-[10px] font-bold uppercase tracking-widest text-text-secondary-light dark:text-text-secondary-dark/50">
              {label}
            </dt>
            <dd className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark truncate">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

function StudentRow({
  student,
  href,
  trailing,
  misUserId,
}: {
  student: StudentStat;
  href: string | null;
  /** The roster's MIS id for this student (matched by email), for their photo. */
  misUserId?: number | null;
  trailing: React.ReactNode;
}) {
  const body = (
    <>
      <UserAvatar decorative src={student.profileImage} misUserId={misUserId} name={student.name} size={32} shape="rounded" />
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold text-text-primary-light dark:text-text-primary-dark truncate">
          {student.name}
        </span>
        <span className="block text-[11px] text-text-secondary-light dark:text-text-secondary-dark/60">
          {student.markedCount} mark{student.markedCount !== 1 ? "s" : ""} recorded
        </span>
      </span>
      {trailing}
    </>
  );
  const cls =
    "flex items-center gap-3 px-2 py-2 -mx-2 rounded-xl transition-colors";
  return href ? (
    <Link to={href} className={`${cls} hover:bg-surface-light dark:hover:bg-surface-dark`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark/60 py-6 text-center">
      {children}
    </p>
  );
}

// ─── Report-card readiness ────────────────────────────────────────────────────

type Readiness = Record<ReportCardStatus | "not_started", number>;

function useReportCardReadiness(
  enabled: boolean,
  courseId: string,
  studentIds: number[],
  term?: string,
  academicYear?: string,
) {
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [failed, setFailed] = useState(false);
  const idsKey = studentIds.join(",");

  useEffect(() => {
    if (!enabled || !term || !academicYear || studentIds.length === 0) {
      setReadiness(null);
      return;
    }
    let cancelled = false;
    setFailed(false);
    ReportCardApiService.getSubjectOverview({
      subject_id: Number(courseId),
      term,
      academic_year: academicYear,
      student_ids: studentIds,
    })
      .then((res) => {
        if (cancelled) return;
        const counts: Readiness = { not_started: 0, draft: 0, saved: 0, approved: 0 };
        const byId = new Map(res.data.students.map((s) => [s.student_id, s.status]));
        for (const id of studentIds) {
          const status = byId.get(id) ?? null;
          counts[status ?? "not_started"] += 1;
        }
        setReadiness(counts);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, courseId, idsKey, term, academicYear]);

  return { readiness, failed };
}

const READINESS_SEGMENTS: Array<{ key: keyof Readiness; label: string; color: string }> = [
  { key: "approved", label: "Approved", color: "#2563eb" },
  { key: "saved", label: "Saved", color: "#60a5fa" },
  { key: "draft", label: "Draft", color: "#f59e0b" },
  { key: "not_started", label: "Not started", color: "#9ca3af" },
];

// ─── Panel ────────────────────────────────────────────────────────────────────

export default function CourseOverviewPanel({
  course,
  courseId,
  state,
  canViewAll,
  canViewReportCards,
  periodLabel,
  termName,
  academicYearName,
  onNavigate,
}: CourseOverviewPanelProps) {
  const { report, loading, error, refreshing, reload } = state;
  const roster = useMemo(
    () => (course.enrolledStudents ?? []) as unknown as RosterRow[],
    [course.enrolledStudents],
  );

  // Grade rows and roster rows don't share one id field (local vs MIS ids), so
  // student links resolve through the email — the id the Students tab uses.
  const hrefByEmail = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of roster) {
      const email = (s.user?.email || "").toLowerCase();
      const id = s.user?.user_id || s.user?.id;
      if (email && id) map.set(email, `/students/${id}`);
    }
    return map;
  }, [roster]);
  const hrefOf = (s: StudentStat) => hrefByEmail.get((s.email || "").toLowerCase()) ?? null;
  // Photos: the roster's MIS id (user.user_id), matched by email like the links above.
  const misIdByEmail = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of roster) {
      const email = (s.user?.email || "").toLowerCase();
      const misId = Number(s.user?.user_id);
      if (email && misId) map.set(email, misId);
    }
    return map;
  }, [roster]);
  const misIdOf = (s: StudentStat) => misIdByEmail.get((s.email || "").toLowerCase()) ?? null;

  // Same id derivation as SubjectReportCardDashboard, so statuses line up.
  const reportCardIds = useMemo(
    () =>
      roster
        .map((s) => Number(s.user?.id ?? s.user?.user_id ?? s.student_id ?? 0))
        .filter(Boolean),
    [roster],
  );
  const { readiness, failed: readinessFailed } = useReportCardReadiness(
    canViewAll && canViewReportCards,
    courseId,
    reportCardIds,
    termName,
    academicYearName,
  );

  const derived = useMemo(() => {
    if (!report) return null;
    const graded = report.students.filter((s) => s.markedCount > 0);
    const notAssessed = report.students.filter((s) => s.markedCount === 0);
    const cells = report.assessments.reduce((acc, a) => acc + a.rosterSize, 0);
    const markedCells = report.assessments.reduce((acc, a) => acc + a.markedCount, 0);
    const byScore = [...graded].sort((a, b) => a.overallPct - b.overallPct);
    const support = byScore.filter((s) => s.overallPct < 65).slice(0, 5);
    const top = [...byScore].reverse().filter((s) => s.overallPct >= 50).slice(0, 3);
    const recent = [...report.assessments]
      .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
      .slice(0, 5);
    const trend =
      report.timeline.length >= 2
        ? Math.round(
            ((report.timeline[report.timeline.length - 1].averagePct ?? 0) -
              (report.timeline[report.timeline.length - 2].averagePct ?? 0)) *
              10,
          ) / 10
        : null;
    return {
      graded,
      notAssessed,
      completion: cells > 0 ? Math.round((markedCells / cells) * 100) : 0,
      support,
      top,
      recent,
      trend,
      alerts: buildReportAlerts(report),
    };
  }, [report]);

  const runAlert = (alert: ReportAlert) => {
    const action = alert.action;
    if (!action) return;
    if (action.kind === "assessment") onNavigate(KIND_META[action.assessment.kind].tab);
    else if (action.kind === "filter" && action.filter === "at_risk") {
      document.getElementById("overview-support")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // ── Loading / error ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-4 animate-pulse p-1 sm:p-2" aria-busy="true" aria-label="Loading overview">
        <div className="h-16 rounded-2xl bg-surface-light dark:bg-surface-dark" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-2xl bg-surface-light dark:bg-surface-dark" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 h-56 rounded-2xl bg-surface-light dark:bg-surface-dark" />
          <div className="h-56 rounded-2xl bg-surface-light dark:bg-surface-dark" />
        </div>
      </div>
    );
  }

  const errorBanner = error && (
    <motion.div
      variants={itemVariants}
      className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl border border-red-200 dark:border-red-500/25 bg-red-50/60 dark:bg-red-500/5"
    >
      <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
      <button
        type="button"
        onClick={reload}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white dark:bg-white/10 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-300"
      >
        <RefreshCw className="w-3.5 h-3.5" /> Try again
      </button>
    </motion.div>
  );

  const enrolled = roster.length || report?.rosterSize || 0;

  // ── Student view: subject info + own standing ──────────────────────────
  if (!canViewAll) {
    const me = report?.students[0];
    return (
      <motion.div
        className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-1 sm:p-2"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {errorBanner && <div className="lg:col-span-3">{errorBanner}</div>}
        <div className="lg:col-span-2">
          <Panel title="Your standing" icon={<Gauge className="w-4 h-4" />} hint={periodLabel ?? undefined}>
            {me && me.markedCount > 0 ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-end gap-3">
                  <p className="text-4xl font-bold text-text-primary-light dark:text-text-primary-dark tabular-nums">
                    {me.overallPct}%
                  </p>
                  <BandPill band={me.band} />
                </div>
                <ul className="divide-y divide-gray-100 dark:divide-border-dark/30">
                  {report!.assessments
                    .filter((a) => me.marks[a.key] !== null && me.marks[a.key] !== undefined)
                    .map((a) => (
                      <li key={a.key} className="flex items-center justify-between gap-3 py-2 text-sm">
                        <span className="truncate text-text-primary-light dark:text-text-primary-dark">{a.title}</span>
                        <span className="font-semibold tabular-nums">{me.marks[a.key]}%</span>
                      </li>
                    ))}
                </ul>
              </div>
            ) : (
              <EmptyNote>No marks have been recorded for you in this subject yet.</EmptyNote>
            )}
          </Panel>
        </div>
        <SubjectInfoCard course={course} enrolled={enrolled} periodLabel={periodLabel} />
      </motion.div>
    );
  }

  // ── Teacher view ───────────────────────────────────────────────────────
  const hasAssessments = (report?.assessments.length ?? 0) > 0;

  // One sentence a teacher can read in two seconds.
  const headline = (() => {
    if (!report || !derived) return "No grade data is available for this period yet.";
    if (!hasAssessments) {
      return `${enrolled} student${enrolled !== 1 ? "s" : ""} enrolled — nothing has been assessed yet this period.`;
    }
    if (derived.graded.length === 0) {
      return `${report.assessments.length} assessment${report.assessments.length !== 1 ? "s" : ""} set, but no marks recorded yet.`;
    }
    const band = bandMeta(bandOf(report.classAverage)).label.toLowerCase();
    const parts = [`Class average ${report.classAverage}% (${band})`];
    if (report.atRiskCount > 0) {
      parts.push(`${report.atRiskCount} student${report.atRiskCount !== 1 ? "s" : ""} below 50%`);
    }
    if (report.outstandingMarks > 0) parts.push(`${report.outstandingMarks} marks still to record`);
    else parts.push("all marks recorded");
    return parts.join(" · ");
  })();

  return (
    <motion.div
      className="space-y-4 p-1 sm:p-2"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {errorBanner}

      {/* At a glance */}
      <motion.div
        variants={itemVariants}
        className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-500/10 dark:to-indigo-500/5 border border-blue-100 dark:border-blue-500/20"
      >
        <span className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-5 h-5" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-blue-700/70 dark:text-blue-300/70 flex items-center gap-1.5">
            At a glance
            {periodLabel && (
              <span className="inline-flex items-center gap-1 normal-case tracking-normal font-semibold">
                · <CalendarDays className="w-3 h-3" /> {periodLabel}
              </span>
            )}
          </p>
          <p className="text-sm sm:text-base font-semibold text-text-primary-light dark:text-text-primary-dark leading-snug">
            {headline}
          </p>
        </div>
        <button
          type="button"
          onClick={reload}
          disabled={refreshing}
          className="self-start sm:self-center inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-blue-700 dark:text-blue-300 bg-white/80 dark:bg-white/5 border border-blue-200 dark:border-blue-500/30 hover:bg-white dark:hover:bg-white/10 disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </motion.div>

      {report && derived && hasAssessments ? (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <KpiCard
              icon={<TrendingUp className="w-4 h-4 text-white" />}
              accent="bg-blue-600"
              label="Class average"
              value={report.classAverage}
              suffix="%"
              progress={report.classAverage}
              caption={
                derived.trend === null
                  ? `Median ${report.medianPct}%`
                  : `Median ${report.medianPct}% · ${derived.trend >= 0 ? "▲" : "▼"} ${Math.abs(derived.trend)} pts on last assessment`
              }
            />
            <KpiCard
              icon={<CheckCircle2 className="w-4 h-4 text-white" />}
              accent="bg-emerald-600"
              label="Pass rate"
              value={report.passRate}
              suffix="%"
              progress={report.passRate}
              progressColor="bg-emerald-500"
              caption={`${derived.graded.length - report.atRiskCount} of ${derived.graded.length} assessed students at 50%+`}
            />
            <KpiCard
              icon={<AlertTriangle className="w-4 h-4 text-white" />}
              accent={report.atRiskCount > 0 ? "bg-red-500" : "bg-gray-400"}
              label="At risk"
              value={report.atRiskCount}
              caption={report.atRiskCount > 0 ? "Below 50% — tap to see who" : "Nobody below 50%"}
              onClick={
                report.atRiskCount > 0
                  ? () => document.getElementById("overview-support")?.scrollIntoView({ behavior: "smooth", block: "start" })
                  : undefined
              }
            />
            <KpiCard
              icon={<ListChecks className="w-4 h-4 text-white" />}
              accent="bg-amber-500"
              label="Marking done"
              value={derived.completion}
              suffix="%"
              progress={derived.completion}
              progressColor={derived.completion === 100 ? "bg-emerald-500" : "bg-amber-500"}
              caption={
                report.outstandingMarks > 0
                  ? `${report.outstandingMarks} mark${report.outstandingMarks !== 1 ? "s" : ""} outstanding`
                  : "Every mark recorded"
              }
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Needs attention */}
            <Panel
              className="lg:col-span-2"
              title="Needs your attention"
              icon={<ClipboardCheck className="w-4 h-4" />}
              hint="What to act on next, most urgent first"
            >
              <ul className="space-y-2.5">
                {derived.alerts.map((alert) => {
                  const tone = TONE[alert.tone];
                  const actionable =
                    alert.action &&
                    (alert.action.kind === "assessment" ||
                      (alert.action.kind === "filter" && alert.action.filter === "at_risk"));
                  return (
                    <li
                      key={alert.id}
                      className={`flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl border ${tone.ring}`}
                    >
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${tone.iconCls}`}>
                          {tone.icon}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
                            {alert.title}
                          </p>
                          <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark/70 break-words">
                            {alert.detail}
                          </p>
                        </div>
                      </div>
                      {actionable ? (
                        <button
                          type="button"
                          onClick={() => runAlert(alert)}
                          className="self-start sm:self-center inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 text-text-primary-light dark:text-text-primary-dark hover:border-blue-400 transition-colors whitespace-nowrap"
                        >
                          {alert.action!.label} <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      ) : alert.action ? (
                        <Link
                          to={`/courses/${courseId}/reports`}
                          className="self-start sm:self-center inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 text-text-primary-light dark:text-text-primary-dark hover:border-blue-400 transition-colors whitespace-nowrap"
                        >
                          Open report <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </Panel>

            {/* Performance mix */}
            <Panel title="Performance mix" icon={<Gauge className="w-4 h-4" />} hint={`${derived.graded.length} assessed student${derived.graded.length !== 1 ? "s" : ""}`}>
              {derived.graded.length > 0 ? (
                <>
                  <div className="flex h-3 w-full rounded-full overflow-hidden bg-surface-light dark:bg-surface-dark mb-4" role="img" aria-label="Students per performance band">
                    {BANDS.map((b) => {
                      const n = report.bandCounts[b.key] ?? 0;
                      if (n === 0) return null;
                      return (
                        <motion.span
                          key={b.key}
                          className="h-full"
                          style={{ backgroundColor: b.color }}
                          initial={{ width: 0 }}
                          animate={{ width: `${(n / derived.graded.length) * 100}%` }}
                          transition={{ duration: 0.7, ease: "easeOut" }}
                        />
                      );
                    })}
                  </div>
                  <ul className="space-y-2">
                    {BANDS.map((b) => {
                      const n = report.bandCounts[b.key] ?? 0;
                      const share = Math.round((n / derived.graded.length) * 100);
                      return (
                        <li key={b.key} className="flex items-center gap-2.5 text-sm">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: b.color }} aria-hidden />
                          <span className="flex-1 text-text-primary-light dark:text-text-primary-dark">
                            {b.label}
                            <span className="ml-1.5 text-[11px] text-text-secondary-light dark:text-text-secondary-dark/60">{b.short}</span>
                          </span>
                          <span className="font-semibold tabular-nums">{n}</span>
                          <span className="w-10 text-right text-xs tabular-nums text-text-secondary-light dark:text-text-secondary-dark/60">
                            {share}%
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </>
              ) : (
                <EmptyNote>No student has a mark yet.</EmptyNote>
              )}
              {derived.notAssessed.length > 0 && (
                <p className="mt-4 flex items-center gap-2 text-xs text-text-secondary-light dark:text-text-secondary-dark/70">
                  <UserX className="w-3.5 h-3.5 flex-shrink-0" />
                  {derived.notAssessed.length} student{derived.notAssessed.length !== 1 ? "s have" : " has"} no mark yet
                </p>
              )}
            </Panel>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {/* Students to support */}
            <div id="overview-support" className="scroll-mt-24">
              <Panel title="Students to support" icon={<LifeBuoy className="w-4 h-4" />} hint="Lowest overall, below 65%">
                {derived.support.length > 0 ? (
                  <div className="space-y-1">
                    {derived.support.map((s) => (
                      <StudentRow
                        key={s.id}
                        student={s}
                        href={hrefOf(s)}
                        misUserId={misIdOf(s)}
                        trailing={
                          <span className="flex flex-col items-end gap-1">
                            <span className="text-sm font-bold tabular-nums">{s.overallPct}%</span>
                            <BandPill band={s.band} />
                          </span>
                        }
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyNote>Every assessed student is at 65% or above.</EmptyNote>
                )}
              </Panel>
            </div>

            {/* Top performers */}
            <Panel title="Top performers" icon={<Trophy className="w-4 h-4" />} hint="Candidates for extension work">
              {derived.top.length > 0 ? (
                <div className="space-y-1">
                  {derived.top.map((s, i) => (
                    <StudentRow
                      key={s.id}
                      student={s}
                      href={hrefOf(s)}
                      misUserId={misIdOf(s)}
                      trailing={
                        <span className="flex items-center gap-2">
                          {i === 0 && <Award className="w-4 h-4 text-amber-500" aria-label="Top of the class" />}
                          <span className="text-sm font-bold tabular-nums">{s.overallPct}%</span>
                        </span>
                      }
                    />
                  ))}
                </div>
              ) : (
                <EmptyNote>No student is at 50% or above yet.</EmptyNote>
              )}
            </Panel>

            {/* Recent assessments */}
            <Panel
              className="md:col-span-2 xl:col-span-1"
              title="Recent assessments"
              icon={<BookOpen className="w-4 h-4" />}
              hint="Class average and marking progress"
            >
              <ul className="space-y-1">
                {derived.recent.map((a) => {
                  const kind = KIND_META[a.kind];
                  const date = formatDate(a.date);
                  return (
                    <li key={a.key}>
                      <button
                        type="button"
                        onClick={() => onNavigate(kind.tab)}
                        className="w-full text-left flex flex-col gap-1.5 px-2 py-2 -mx-2 rounded-xl hover:bg-surface-light dark:hover:bg-surface-dark transition-colors"
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide flex-shrink-0 ${kind.cls}`}>
                            {kind.label}
                          </span>
                          <span className="flex-1 min-w-0 text-sm font-semibold text-text-primary-light dark:text-text-primary-dark truncate">
                            {a.title}
                          </span>
                          <span
                            className="text-sm font-bold tabular-nums flex-shrink-0"
                            style={a.averagePct !== null ? { color: bandMeta(bandOf(a.averagePct)).color } : undefined}
                          >
                            {a.averagePct !== null ? `${a.averagePct}%` : "—"}
                          </span>
                        </span>
                        <span className="flex items-center gap-3">
                          {date && (
                            <span className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark/60 w-12 flex-shrink-0">
                              {date}
                            </span>
                          )}
                          <span className="flex-1">
                            <Progress done={a.markedCount} total={a.rosterSize} />
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          </div>
        </>
      ) : (
        !error && (
          <motion.div
            variants={itemVariants}
            className="text-center py-10 px-4 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800"
          >
            <BookOpen className="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-gray-700" />
            <p className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
              No assessments yet for this period
            </p>
            <p className="mt-1 text-xs text-text-secondary-light dark:text-text-secondary-dark/60">
              Set a quiz or an assignment, or record marks from a paper test, and this board fills in.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {(["quizzes", "assignments", "recorded"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => onNavigate(tab)}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold border border-gray-200 dark:border-gray-700 hover:border-blue-400 text-text-primary-light dark:text-text-primary-dark transition-colors"
                >
                  {tab === "quizzes" ? "Quizzes" : tab === "assignments" ? "Assignments" : "Record marks"}
                </button>
              ))}
            </div>
          </motion.div>
        )
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Report-card readiness */}
        {canViewReportCards && (
          <Panel
            className="lg:col-span-2"
            title="Report card readiness"
            icon={<ClipboardCheck className="w-4 h-4" />}
            hint={periodLabel ?? undefined}
            action={
              <button
                type="button"
                onClick={() => onNavigate("report-cards")}
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
              >
                Open <ArrowRight className="w-3.5 h-3.5" />
              </button>
            }
          >
            {readiness ? (
              (() => {
                const total = Object.values(readiness).reduce((a, n) => a + n, 0);
                return (
                  <>
                    <div className="flex items-baseline gap-2 mb-3">
                      <p className="text-2xl font-bold tabular-nums text-text-primary-light dark:text-text-primary-dark">
                        {readiness.approved}/{total}
                      </p>
                      <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark/60">approved</p>
                    </div>
                    <div className="flex h-2.5 w-full rounded-full overflow-hidden bg-surface-light dark:bg-surface-dark mb-3">
                      {READINESS_SEGMENTS.map((seg) =>
                        readiness[seg.key] > 0 ? (
                          <motion.span
                            key={seg.key}
                            className="h-full"
                            style={{ backgroundColor: seg.color }}
                            initial={{ width: 0 }}
                            animate={{ width: `${(readiness[seg.key] / total) * 100}%` }}
                            transition={{ duration: 0.7, ease: "easeOut" }}
                          />
                        ) : null,
                      )}
                    </div>
                    <ul className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {READINESS_SEGMENTS.map((seg) => (
                        <li key={seg.key} className="flex items-center gap-2 text-xs">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: seg.color }} aria-hidden />
                          <span className="text-text-secondary-light dark:text-text-secondary-dark/70">{seg.label}</span>
                          <span className="font-semibold tabular-nums text-text-primary-light dark:text-text-primary-dark">
                            {readiness[seg.key]}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                );
              })()
            ) : (
              <EmptyNote>
                {readinessFailed
                  ? "Could not load report-card statuses."
                  : reportCardIds.length === 0
                    ? "No students enrolled for this period."
                    : "Loading report-card statuses…"}
              </EmptyNote>
            )}
          </Panel>
        )}

        <div className={canViewReportCards ? "" : "lg:col-span-3"}>
          <SubjectInfoCard course={course} enrolled={enrolled} periodLabel={periodLabel} />
        </div>
      </div>
    </motion.div>
  );
}

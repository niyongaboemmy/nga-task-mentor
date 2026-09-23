import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useSelector, useDispatch } from "react-redux";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Award,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Download,
  Gauge,
  GraduationCap,
  PencilLine,
  RefreshCw,
  Search,
  Table2,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { toast } from "react-toastify";
import type { RootState, AppDispatch } from "../store";
import { fetchCourses } from "../store/slices/courseSlice";
import StudentGradeModal from "../components/Courses/StudentGradeModal";
import { usePermissions } from "../hooks/usePermissions";
import AcademicPeriodPicker, {
  type SelectedPeriod,
} from "../components/Common/AcademicPeriodPicker";
import {
  BandPill,
  KpiCard,
  Panel,
  Progress,
  ReportSkeleton,
} from "../components/Grades/reportUi";
import {
  containerVariants,
  itemVariants,
} from "../components/Grades/reportMotion";
import {
  AssessmentAveragesChart,
  BandDistributionChart,
  PerformanceTrendChart,
} from "../components/Grades/SubjectReportCharts";
import {
  BANDS,
  bandMeta,
  bandOf,
  buildReportAlerts,
  buildSubjectReport,
  fetchSubjectGrades,
  type AssessmentStat,
  type BandKey,
  type StudentStat,
  type SubjectReport,
} from "../services/subjectReportApi";

// ─── Course reports ───────────────────────────────────────────────────────────
// The grade sheet for one subject, for whoever is looking at it:
//   • a teacher/admin gets the whole class — KPIs, the needs-attention list,
//     three charts and the full student × assessment matrix;
//   • a student gets only their own row, broken down per assessment.
//
// Both are built from GET /courses/:id/grades via buildSubjectReport, the same
// derivation the subject assessment report uses, so quizzes, assignments AND
// teacher-recorded marks are all present and a class average means the same
// thing on every screen. UI primitives come from components/Grades/reportUi so
// the surfaces match the rest of the app in dark mode (card/surface tokens
// rather than the raw grays this page used to paint, which sit lighter than
// everything around them).

const KIND_BADGE: Record<AssessmentStat["kind"], string> = {
  quiz: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
  assignment: "bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300",
  manual: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300",
};

const KIND_LABEL: Record<AssessmentStat["kind"], string> = {
  quiz: "Quiz",
  assignment: "Assignment",
  manual: "Recorded",
};

const KIND_SHORT: Record<AssessmentStat["kind"], string> = {
  quiz: "Quiz",
  assignment: "Assign",
  manual: "Mark",
};

/** Where a teacher goes to act on this assessment. */
const actionFor = (a: AssessmentStat) =>
  a.kind === "manual"
    ? { to: `/grades/${a.id}/marks`, label: "Enter marks" }
    : a.kind === "quiz"
      ? { to: `/quizzes/${a.id}/submissions`, label: "Grade quiz" }
      : { to: `/assignments/${a.id}`, label: "Grade work" };

const formatTime = (d: Date) =>
  d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

export default function CourseReportsPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const dispatch = useDispatch<AppDispatch>();
  const { can } = usePermissions();
  // Default to the self-view unless the caller holds "view all grades".
  const isStudent = !can("COURSES_VIEW_GRADES");

  const [report, setReport] = useState<SubjectReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [viewPeriod, setViewPeriod] = useState<SelectedPeriod | null>(null);

  // Cross-filtering — charts, KPI cards and the matrix all read this state.
  const [search, setSearch] = useState("");
  const [activeBand, setActiveBand] = useState<BandKey | null>(null);
  const [selectedAssessment, setSelectedAssessment] = useState<string | null>(null);
  const [onlyIncomplete, setOnlyIncomplete] = useState(false);
  const [openStudent, setOpenStudent] = useState<StudentStat | null>(null);

  const courseState = useSelector((state: RootState) => state.course);
  const currentCourse = courseState?.currentCourse;
  const courses = useMemo(() => courseState?.courses ?? [], [courseState?.courses]);

  const course = useMemo(() => {
    if (currentCourse && String(currentCourse.id) === String(courseId)) return currentCourse;
    return courses.find((c) => String(c.id) === String(courseId)) || null;
  }, [currentCourse, courses, courseId]);

  const load = useCallback(
    async (mode: "initial" | "refresh") => {
      if (!courseId) return;
      if (mode === "initial") setLoading(true);
      else setRefreshing(true);
      try {
        const payload = await fetchSubjectGrades(courseId, {
          academicTermId: viewPeriod?.academicTermId,
          // Recorded assessments are keyed on the term/year NAMES, so a past-
          // term view needs both or it shows the current term's marks.
          term: viewPeriod?.termName,
          academicYear: viewPeriod?.yearName,
        });
        setReport(buildSubjectReport(payload));
        setUpdatedAt(new Date());
        if (mode === "refresh") toast.success("Report updated");
      } catch {
        toast.error("Failed to load course grades");
        setReport(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [courseId, viewPeriod],
  );

  useEffect(() => {
    if (courseId && !course) dispatch(fetchCourses());
    load("initial");
    // `course` is deliberately out: it arrives from the fetch this effect starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, dispatch, load]);

  // ── Derived views ──────────────────────────────────────────────────────────
  const selected = report?.assessments.find((a) => a.key === selectedAssessment) ?? null;

  const columns = useMemo(() => {
    if (!report) return [];
    return onlyIncomplete
      ? report.assessments.filter((a) => a.markedCount < a.rosterSize)
      : report.assessments;
  }, [report, onlyIncomplete]);

  const studentRows = useMemo(() => {
    if (!report) return [];
    const q = search.trim().toLowerCase();
    return report.students
      .filter((s) => {
        if (activeBand && (s.markedCount === 0 || s.band !== activeBand)) return false;
        if (!q) return true;
        return s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
      })
      .sort((a, b) => b.overallPct - a.overallPct);
  }, [report, search, activeBand]);

  /** Service-derived alerts, wired to this page's navigation and filters. */
  const alerts = useMemo(() => {
    if (!report) return [];
    return buildReportAlerts(report).map((alert) => {
      const a = alert.action;
      if (!a) return { ...alert, resolved: undefined };
      if (a.kind === "assessment") {
        const target = actionFor(a.assessment);
        return { ...alert, resolved: { label: target.label, to: target.to } };
      }
      if (a.kind === "focus") {
        return {
          ...alert,
          resolved: { label: a.label, onClick: () => setSelectedAssessment(a.assessmentKey) },
        };
      }
      return {
        ...alert,
        resolved: {
          label: a.label,
          onClick: () =>
            a.filter === "incomplete" ? setOnlyIncomplete(true) : setActiveBand("at_risk"),
        },
      };
    });
  }, [report]);

  const handleExportCSV = () => {
    if (!report) return;
    const headers = [
      "Student",
      "Email",
      ...report.assessments.map((a) => `${KIND_LABEL[a.kind]}: ${a.title} (/${a.maxScore})`),
      "Overall %",
      "Band",
    ];
    const rows = report.students.map((s) => [
      s.name,
      s.email,
      ...report.assessments.map((a) => {
        const mark = s.marks[a.key];
        return mark === null || mark === undefined ? "-" : `${mark}%`;
      }),
      `${s.overallPct}%`,
      s.markedCount > 0 ? bandMeta(s.band).label : "No marks",
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${course?.code ?? `course-${courseId}`}-grades.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Grade sheet exported");
  };

  // ── Guards ─────────────────────────────────────────────────────────────────
  if (loading) return <ReportSkeleton />;

  if (!report || report.students.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="flex flex-col items-center gap-4 max-w-sm text-center">
          <div className="w-14 h-14 rounded-2xl bg-surface-light dark:bg-surface-dark flex items-center justify-center">
            <ClipboardList className="w-7 h-7 text-text-secondary-light dark:text-text-secondary-dark/60" />
          </div>
          <div>
            <p className="text-base font-bold text-text-primary-light dark:text-text-primary-dark">
              No grade data yet
            </p>
            <p className="mt-1 text-sm text-text-secondary-light dark:text-text-secondary-dark/70">
              {isStudent
                ? "Nothing has been marked for you in this subject yet."
                : "Nobody is enrolled for this period, or no assessment has been created."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => load("refresh")}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold border border-border-light dark:border-border-dark/40 text-text-secondary-light dark:text-text-secondary-dark hover:bg-surface-light dark:hover:bg-surface-dark/50 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Try again
            </button>
            <Link
              to={`/courses/${courseId}`}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              Back to course
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const filtersOn = Boolean(search || activeBand || selectedAssessment || onlyIncomplete);
  const resetFilters = () => {
    setSearch("");
    setActiveBand(null);
    setSelectedAssessment(null);
    setOnlyIncomplete(false);
  };

  return (
    <motion.div
      className="space-y-5 pb-10"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <StudentGradeModal
        isOpen={Boolean(openStudent)}
        onClose={() => setOpenStudent(null)}
        student={openStudent?.raw ?? null}
      />

      <Link
        to={`/courses/${courseId}`}
        className="flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:underline w-fit"
      >
        <ArrowLeft className="w-4 h-4" /> Back to course
      </Link>

      {/* Header */}
      <motion.div
        variants={itemVariants}
        className="bg-card-light dark:bg-card-dark/30 rounded-2xl border border-white dark:border-border-dark/30 p-4 sm:p-5 flex flex-wrap items-start justify-between gap-4"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-blue-600 flex items-center justify-center text-white flex-shrink-0">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark/60 uppercase tracking-widest font-medium">
              {isStudent ? "My performance" : "Class performance"}
            </p>
            <h1 className="text-xl sm:text-2xl font-bold text-text-primary-light dark:text-text-primary-dark truncate">
              {course?.title ?? "Course reports"}
            </h1>
            <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark/60 mt-0.5 flex flex-wrap items-center gap-2">
              {course?.code && (
                <span className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-[10px] font-bold uppercase tracking-wider">
                  {course.code}
                </span>
              )}
              <span>
                {report.assessments.length} assessment
                {report.assessments.length !== 1 ? "s" : ""}
                {!isStudent &&
                  ` · ${report.rosterSize} student${report.rosterSize !== 1 ? "s" : ""}`}
              </span>
              {updatedAt && <span>· updated {formatTime(updatedAt)}</span>}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!isStudent && <AcademicPeriodPicker onChange={setViewPeriod} />}
          <button
            onClick={() => load("refresh")}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-border-light dark:border-border-dark/40 text-text-secondary-light dark:text-text-secondary-dark hover:bg-surface-light dark:hover:bg-surface-dark/50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing" : "Refresh"}
          </button>
          {!isStudent && (
            <>
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-border-light dark:border-border-dark/40 text-text-secondary-light dark:text-text-secondary-dark hover:bg-surface-light dark:hover:bg-surface-dark/50 transition-colors"
              >
                <Download className="w-3.5 h-3.5" /> Export CSV
              </button>
              <Link
                to={`/grades/subjects/${courseId}`}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                <ClipboardCheck className="w-3.5 h-3.5" /> Report Card
              </Link>
            </>
          )}
        </div>
      </motion.div>

      {isStudent ? (
        <StudentSelfView report={report} />
      ) : (
        <>
          {/* KPIs */}
          <motion.div
            variants={containerVariants}
            className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
          >
            <KpiCard
              icon={<Gauge className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
              accent="bg-blue-100 dark:bg-blue-900/20"
              label="Class average"
              value={report.classAverage}
              suffix="%"
              progress={report.classAverage}
              caption={`Median ${report.medianPct}% · marked students only`}
            />
            <KpiCard
              icon={<CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
              accent="bg-emerald-100 dark:bg-emerald-900/20"
              label="Passing"
              value={report.passRate}
              suffix="%"
              progress={report.passRate}
              progressColor="bg-emerald-500"
              caption="At or above the 50% pass mark"
            />
            <KpiCard
              icon={<AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />}
              accent="bg-red-100 dark:bg-red-900/20"
              label="Needs attention"
              value={report.atRiskCount}
              caption={
                activeBand === "at_risk"
                  ? "Filtering the list — click to clear"
                  : "Below 50% — click to list them"
              }
              onClick={() => setActiveBand(activeBand === "at_risk" ? null : "at_risk")}
              active={activeBand === "at_risk"}
            />
            <KpiCard
              icon={<PencilLine className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
              accent="bg-amber-100 dark:bg-amber-900/20"
              label="Marks outstanding"
              value={report.outstandingMarks}
              caption={
                onlyIncomplete
                  ? "Showing unfinished columns — click to clear"
                  : "Student marks not entered yet"
              }
              onClick={() => setOnlyIncomplete((v) => !v)}
              active={onlyIncomplete}
            />
          </motion.div>

          {/* Needs attention */}
          <Panel
            title="Needs attention"
            icon={<AlertTriangle className="w-4 h-4" />}
            hint="Each item links to where you fix it"
          >
            <ul className="space-y-2">
              <AnimatePresence initial={false}>
                {alerts.map((a) => {
                  const tone = {
                    serious:
                      "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-300",
                    warning:
                      "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40 text-amber-700 dark:text-amber-300",
                    good: "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-300",
                  }[a.tone];
                  const Icon = a.tone === "good" ? CheckCircle2 : AlertTriangle;
                  return (
                    <motion.li
                      key={a.id}
                      layout
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0 }}
                      className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-xl border ${tone}`}
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">{a.title}</p>
                          <p className="text-xs opacity-80 truncate">{a.detail}</p>
                        </div>
                      </div>
                      {a.resolved &&
                        (a.resolved.to ? (
                          <Link
                            to={a.resolved.to}
                            className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full bg-white/70 dark:bg-black/20 hover:bg-white dark:hover:bg-black/40 transition-colors whitespace-nowrap"
                          >
                            {a.resolved.label} <ArrowRight className="w-3 h-3" />
                          </Link>
                        ) : (
                          <button
                            onClick={a.resolved.onClick}
                            className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full bg-white/70 dark:bg-black/20 hover:bg-white dark:hover:bg-black/40 transition-colors whitespace-nowrap"
                          >
                            {a.resolved.label} <ArrowRight className="w-3 h-3" />
                          </button>
                        ))}
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          </Panel>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <Panel
                title="Average by assessment"
                icon={<BarChart3 className="w-4 h-4" />}
                hint="Weakest first · click a bar to focus that assessment"
                action={
                  selected ? (
                    <button
                      onClick={() => setSelectedAssessment(null)}
                      className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
                    >
                      Clear focus
                    </button>
                  ) : undefined
                }
              >
                <AssessmentAveragesChart
                  assessments={report.assessments}
                  selectedKey={selectedAssessment}
                  onSelect={setSelectedAssessment}
                />
              </Panel>
            </div>

            <Panel
              title="Performance spread"
              icon={<Users className="w-4 h-4" />}
              hint="Click a band to filter the class"
            >
              <BandDistributionChart
                bandCounts={report.bandCounts}
                activeBand={activeBand}
                onSelectBand={setActiveBand}
              />
            </Panel>
          </div>

          <Panel
            title="Class average over time"
            icon={<TrendingUp className="w-4 h-4" />}
            hint="Dated assessments, oldest first — is the class improving?"
          >
            <PerformanceTrendChart timeline={report.timeline} />
          </Panel>

          {/* Focused assessment */}
          <AnimatePresence>
            {selected && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
              >
                <Panel
                  title={selected.title}
                  icon={<ClipboardList className="w-4 h-4" />}
                  hint={`${KIND_LABEL[selected.kind]} · max ${selected.maxScore}${
                    selected.date ? ` · ${new Date(selected.date).toLocaleDateString()}` : ""
                  }`}
                  action={
                    <Link
                      to={actionFor(selected).to}
                      className="flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
                    >
                      {actionFor(selected).label} <ArrowRight className="w-3 h-3" />
                    </Link>
                  }
                >
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      {
                        label: "Average",
                        value: selected.averagePct === null ? "—" : `${selected.averagePct}%`,
                      },
                      {
                        label: "Lowest",
                        value: selected.lowestPct === null ? "—" : `${selected.lowestPct}%`,
                      },
                      {
                        label: "Highest",
                        value: selected.highestPct === null ? "—" : `${selected.highestPct}%`,
                      },
                      { label: "Below 50%", value: String(selected.failingCount) },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        className="rounded-xl bg-surface-light dark:bg-surface-dark/60 px-3 py-2.5"
                      >
                        <p className="text-[10px] font-bold uppercase tracking-widest text-text-secondary-light dark:text-text-secondary-dark/60">
                          {stat.label}
                        </p>
                        <p className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark tabular-nums">
                          {stat.value}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3">
                    <Progress done={selected.markedCount} total={selected.rosterSize} />
                  </div>
                </Panel>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Grade matrix */}
          <Panel
            title="Grade sheet"
            icon={<Table2 className="w-4 h-4" />}
            hint={`${studentRows.length} of ${report.rosterSize} student${
              report.rosterSize !== 1 ? "s" : ""
            }${onlyIncomplete ? " · unfinished columns only" : ""}`}
            action={
              filtersOn ? (
                <button
                  onClick={resetFilters}
                  className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
                >
                  Reset filters
                </button>
              ) : undefined
            }
          >
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary-light dark:text-text-secondary-dark/60" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search students"
                  className="w-full pl-9 pr-3 py-2 rounded-xl text-sm bg-surface-light dark:bg-surface-dark/50 text-text-primary-light dark:text-text-primary-dark border border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {BANDS.map((b) => {
                  const isActive = activeBand === b.key;
                  return (
                    <button
                      key={b.key}
                      onClick={() => setActiveBand(isActive ? null : b.key)}
                      aria-pressed={isActive}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-semibold border transition-colors ${
                        isActive
                          ? "border-transparent text-white"
                          : "border-border-light dark:border-border-dark/40 text-text-secondary-light dark:text-text-secondary-dark hover:bg-surface-light dark:hover:bg-surface-dark/50"
                      }`}
                      style={isActive ? { backgroundColor: b.color } : undefined}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: isActive ? "#fff" : b.color }}
                        aria-hidden
                      />
                      {b.label}
                      <span className="tabular-nums opacity-80">
                        {report.bandCounts[b.key] ?? 0}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {studentRows.length === 0 ? (
              <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark/60 py-8 text-center">
                No students match these filters.
              </p>
            ) : (
              <>
                {/* Phone: one card per student — a 10-column matrix can't be
                    read at 400px, so it becomes a list of marks instead. */}
                <ul className="md:hidden space-y-2">
                  {studentRows.map((s) => (
                    <li key={s.id}>
                      <button
                        onClick={() => setOpenStudent(s)}
                        className="w-full text-left rounded-xl bg-surface-light dark:bg-surface-dark/50 p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark truncate">
                            {s.name}
                          </span>
                          <span className="text-sm font-bold tabular-nums text-text-primary-light dark:text-text-primary-dark">
                            {s.markedCount > 0 ? `${s.overallPct}%` : "—"}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                          {s.markedCount > 0 ? <BandPill band={s.band} /> : null}
                          <span className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark/60">
                            {s.markedCount}/{report.assessments.length} marked
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {columns.map((a) => {
                            const mark = s.marks[a.key];
                            const meta =
                              mark === null || mark === undefined ? null : bandMeta(bandOf(mark));
                            return (
                              <span
                                key={a.key}
                                title={a.title}
                                className="text-[10px] font-bold px-1.5 py-0.5 rounded-md tabular-nums text-text-secondary-light dark:text-text-secondary-dark/70"
                                style={
                                  meta
                                    ? { backgroundColor: `${meta.color}1f`, color: meta.color }
                                    : undefined
                                }
                              >
                                {KIND_SHORT[a.kind]} {meta ? `${mark}%` : "—"}
                              </span>
                            );
                          })}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>

                {/* Tablet and up: the full matrix, student + overall frozen. */}
                <div className="hidden md:block overflow-x-auto -mx-4 sm:-mx-5 px-4 sm:px-5">
                  <table className="min-w-full border-separate border-spacing-0">
                    <thead>
                      <tr>
                        <th className="sticky left-0 z-20 bg-card-light dark:bg-[#1c2635] text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-text-secondary-light dark:text-text-secondary-dark/60">
                          Student
                        </th>
                        <th className="sticky left-[180px] z-20 bg-card-light dark:bg-[#1c2635] text-center px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-text-secondary-light dark:text-text-secondary-dark/60 border-r border-border-light dark:border-border-dark/40">
                          Overall
                        </th>
                        {columns.map((a) => (
                          <th
                            key={a.key}
                            onClick={() =>
                              setSelectedAssessment(selectedAssessment === a.key ? null : a.key)
                            }
                            title={`${a.title} — click to focus`}
                            className={`px-3 py-2 min-w-[112px] text-center align-bottom cursor-pointer transition-colors ${
                              selectedAssessment === a.key
                                ? "bg-blue-50/70 dark:bg-blue-950/20"
                                : "hover:bg-surface-light/60 dark:hover:bg-surface-dark/40"
                            }`}
                          >
                            <span className="block text-[11px] font-semibold text-text-primary-light dark:text-text-primary-dark truncate max-w-[110px] mx-auto">
                              {a.title}
                            </span>
                            <span
                              className={`inline-block mt-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${KIND_BADGE[a.kind]}`}
                            >
                              {KIND_SHORT[a.kind]} / {a.maxScore}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {studentRows.map((s) => (
                        <tr key={s.id} onClick={() => setOpenStudent(s)} className="group cursor-pointer">
                          <td className="sticky left-0 z-10 bg-card-light dark:bg-[#1c2635] group-hover:bg-surface-light/80 dark:group-hover:bg-surface-dark/60 px-3 py-2.5 border-t border-border-light dark:border-border-dark/30 transition-colors">
                            <span className="flex items-center gap-2.5 min-w-0">
                              <span className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 flex items-center justify-center text-xs font-bold flex-shrink-0">
                                {s.name.charAt(0).toUpperCase()}
                              </span>
                              <span className="min-w-0">
                                <span className="block text-sm font-semibold text-text-primary-light dark:text-text-primary-dark truncate max-w-[150px]">
                                  {s.name}
                                </span>
                                <span className="block text-[11px] text-text-secondary-light dark:text-text-secondary-dark/60">
                                  {s.markedCount}/{report.assessments.length} marked
                                </span>
                              </span>
                            </span>
                          </td>
                          <td className="sticky left-[180px] z-10 bg-card-light dark:bg-[#1c2635] group-hover:bg-surface-light/80 dark:group-hover:bg-surface-dark/60 px-3 py-2.5 text-center border-t border-r border-border-light dark:border-border-dark/30 transition-colors">
                            {s.markedCount > 0 ? (
                              <span className="inline-flex flex-col items-center gap-1">
                                <span className="text-sm font-bold tabular-nums text-text-primary-light dark:text-text-primary-dark">
                                  {s.overallPct}%
                                </span>
                                <BandPill band={s.band} />
                              </span>
                            ) : (
                              <span className="text-[11px] font-semibold text-text-secondary-light dark:text-text-secondary-dark/50">
                                No marks
                              </span>
                            )}
                          </td>
                          {columns.map((a) => {
                            const mark = s.marks[a.key];
                            const meta =
                              mark === null || mark === undefined ? null : bandMeta(bandOf(mark));
                            return (
                              <td
                                key={a.key}
                                className={`px-3 py-2.5 text-center border-t border-border-light dark:border-border-dark/30 transition-colors ${
                                  selectedAssessment === a.key
                                    ? "bg-blue-50/50 dark:bg-blue-950/10"
                                    : ""
                                }`}
                              >
                                {meta ? (
                                  <span
                                    className="inline-block px-2.5 py-1 rounded-lg text-xs font-bold tabular-nums"
                                    style={{ backgroundColor: `${meta.color}1f`, color: meta.color }}
                                  >
                                    {mark}%
                                  </span>
                                ) : (
                                  <span className="text-text-secondary-light dark:text-text-secondary-dark/30 font-bold">
                                    —
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </Panel>
        </>
      )}
    </motion.div>
  );
}

// ─── Student self-view ────────────────────────────────────────────────────────
// A student's payload carries only their own row, so the same report object
// describes one person: their marks per assessment, and what is still pending.

function StudentSelfView({ report }: { report: SubjectReport }) {
  const me = report.students[0];

  const sections: Array<{ kind: AssessmentStat["kind"]; title: string; icon: React.ReactNode }> = [
    { kind: "assignment", title: "Assignments", icon: <ClipboardList className="w-4 h-4" /> },
    { kind: "quiz", title: "Quizzes", icon: <Zap className="w-4 h-4" /> },
    { kind: "manual", title: "Class assessments", icon: <Award className="w-4 h-4" /> },
  ];

  return (
    <>
      <motion.div
        variants={containerVariants}
        className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
      >
        <KpiCard
          icon={<Gauge className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
          accent="bg-blue-100 dark:bg-blue-900/20"
          label="Total grade"
          value={me.overallPct}
          suffix="%"
          progress={me.overallPct}
          caption={`${me.pointsEarned} of ${me.pointsMax} points earned`}
        />
        <KpiCard
          icon={<CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
          accent="bg-emerald-100 dark:bg-emerald-900/20"
          label="Marks received"
          value={me.markedCount}
          caption={`Out of ${report.assessments.length} assessment${
            report.assessments.length !== 1 ? "s" : ""
          } so far`}
        />
        <KpiCard
          icon={<PencilLine className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
          accent="bg-amber-100 dark:bg-amber-900/20"
          label="Awaiting marks"
          value={Math.max(0, report.assessments.length - me.markedCount)}
          caption="Your teacher hasn't entered these yet"
        />
        <KpiCard
          icon={<Award className="w-4 h-4 text-violet-600 dark:text-violet-400" />}
          accent="bg-violet-100 dark:bg-violet-900/20"
          label="Standing"
          value={me.markedCount > 0 ? me.overallPct : 0}
          suffix="%"
          caption={
            me.markedCount === 0
              ? "Nothing marked yet"
              : me.overallPct >= 50
                ? "Above the 50% pass mark"
                : "Below the pass mark — ask your teacher for support"
          }
        />
      </motion.div>

      {sections.map((section) => {
        const rows = report.assessments.filter((a) => a.kind === section.kind);
        const marked = rows.filter((a) => me.marks[a.key] !== null && me.marks[a.key] !== undefined);
        return (
          <Panel
            key={section.kind}
            title={section.title}
            icon={section.icon}
            hint={`${marked.length} of ${rows.length} marked`}
          >
            {rows.length === 0 ? (
              <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark/60 py-6 text-center">
                Nothing here for this subject yet.
              </p>
            ) : (
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {rows.map((a) => {
                  const mark = me.marks[a.key];
                  const meta = mark === null || mark === undefined ? null : bandMeta(bandOf(mark));
                  return (
                    <li
                      key={a.key}
                      className="flex items-center justify-between gap-3 rounded-xl bg-surface-light dark:bg-surface-dark/50 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark truncate">
                          {a.title}
                        </p>
                        <p className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark/60">
                          Max {a.maxScore}
                          {a.date ? ` · ${new Date(a.date).toLocaleDateString()}` : ""}
                          {!a.countsToFinal && " · not in final grade"}
                        </p>
                      </div>
                      {meta ? (
                        <span
                          className="px-2.5 py-1 rounded-lg text-sm font-bold tabular-nums whitespace-nowrap"
                          style={{ backgroundColor: `${meta.color}1f`, color: meta.color }}
                        >
                          {mark}%
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 whitespace-nowrap">
                          Not marked
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        );
      })}
    </>
  );
}

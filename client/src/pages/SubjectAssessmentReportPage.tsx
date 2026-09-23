import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  Download,
  Gauge,
  Loader2,
  PencilLine,
  RefreshCw,
  Search,
  TrendingUp,
  Users,
} from "lucide-react";
import { toast } from "react-toastify";
import { CourseApiService } from "../services/courseApi";
import { useTermYearSelector } from "../hooks/useTermYearSelector";
import TermYearSelect from "../components/ReportCard/TermYearSelect";
import StudentGradeModal from "../components/Courses/StudentGradeModal";
import {
  AssessmentAveragesChart,
  BandDistributionChart,
  PerformanceTrendChart,
} from "../components/Grades/SubjectReportCharts";
import {
  BANDS,
  bandMeta,
  bandOf,
  buildSubjectReport,
  fetchSubjectGrades,
  type AssessmentStat,
  type BandKey,
  type StudentStat,
  type SubjectReport,
} from "../services/subjectReportApi";

// ─── Subject assessment report ────────────────────────────────────────────────
// The Grades page answers "which subjects have assessments?". This page answers
// the next question a subject teacher actually has: *how did this class do, and
// what do I need to do about it?* — every quiz, assignment and hand-recorded
// mark for one subject and term, folded into one picture with the follow-up
// actions attached to the numbers that trigger them.
//
// All of it is derived client-side from GET /courses/:id/grades (see
// services/subjectReportApi.ts), so there is no second source of truth for a
// class average.

const container = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 120, damping: 18 } },
};

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

/** Where a teacher goes to act on this assessment. */
const actionFor = (a: AssessmentStat) =>
  a.kind === "manual"
    ? { to: `/grades/${a.id}/marks`, label: "Enter marks" }
    : a.kind === "quiz"
      ? { to: `/quizzes/${a.id}/submissions`, label: "Grade quiz" }
      : { to: `/assignments/${a.id}`, label: "Grade work" };

// ─── Count-up number ──────────────────────────────────────────────────────────
// A KPI that animates from 0 tells the eye "this just changed"; it also makes
// a re-fetch after a term switch visible without a spinner.

function CountUp({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [shown, setShown] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    const start = performance.now();
    const duration = 650;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round((from + (value - from) * eased) * 10) / 10);
      if (t < 1) frame = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return (
    <span className="tabular-nums">
      {Number.isInteger(value) ? Math.round(shown) : shown}
      {suffix}
    </span>
  );
}

function KpiCard({
  icon,
  label,
  value,
  suffix,
  caption,
  accent,
  progress,
  onClick,
  active = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  suffix?: string;
  caption: string;
  accent: string;
  progress?: number;
  onClick?: () => void;
  active?: boolean;
}) {
  const Wrapper = onClick ? motion.button : motion.div;
  return (
    <Wrapper
      variants={item}
      {...(onClick ? { onClick, type: "button" as const, "aria-pressed": active } : {})}
      whileHover={onClick ? { y: -3 } : undefined}
      className={`text-left bg-card-light dark:bg-card-dark/30 rounded-2xl border p-5 transition-colors ${
        active
          ? "border-blue-500/60 ring-2 ring-blue-500/20"
          : "border-white dark:border-border-dark/30"
      } ${onClick ? "hover:border-blue-400/50 cursor-pointer" : ""}`}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-8 h-8 rounded-xl flex items-center justify-center ${accent}`}>
          {icon}
        </span>
        <span className="text-[11px] font-bold uppercase tracking-widest text-text-secondary-light dark:text-text-secondary-dark/60">
          {label}
        </span>
      </div>
      <p className="text-3xl font-bold text-text-primary-light dark:text-text-primary-dark">
        <CountUp value={value} suffix={suffix} />
      </p>
      {typeof progress === "number" && (
        <div className="mt-3 h-1.5 w-full rounded-full bg-surface-light dark:bg-surface-dark overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-blue-600"
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
      )}
      <p className="mt-2 text-xs text-text-secondary-light dark:text-text-secondary-dark/60 leading-relaxed">
        {caption}
      </p>
    </Wrapper>
  );
}

function Panel({
  title,
  icon,
  hint,
  action,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      variants={item}
      className="bg-card-light dark:bg-card-dark/30 rounded-2xl border border-white dark:border-border-dark/30 p-5"
    >
      <header className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-8 h-8 rounded-xl bg-surface-light dark:bg-surface-dark flex items-center justify-center text-blue-600 dark:text-blue-400 flex-shrink-0">
            {icon}
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-text-primary-light dark:text-text-primary-dark">
              {title}
            </h2>
            {hint && (
              <p className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark/60">
                {hint}
              </p>
            )}
          </div>
        </div>
        {action}
      </header>
      {children}
    </motion.section>
  );
}

/** A horizontal marks-recorded bar — the same shape on both tables. */
function Progress({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const complete = total > 0 && done >= total;
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-1.5 rounded-full bg-surface-light dark:bg-surface-dark overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${complete ? "bg-emerald-500" : "bg-amber-500"}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
      <span className="text-[11px] font-semibold tabular-nums text-text-secondary-light dark:text-text-secondary-dark/70 w-12 text-right">
        {done}/{total}
      </span>
    </div>
  );
}

function BandPill({ band }: { band: BandKey }) {
  const meta = bandMeta(band);
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold"
      style={{ backgroundColor: `${meta.color}1f`, color: meta.color }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: meta.color }} aria-hidden />
      {meta.label}
    </span>
  );
}

export default function SubjectAssessmentReportPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const { years, terms, academicYear, term, academicTermId, setAcademicYear, setTerm } =
    useTermYearSelector();

  const [subjectName, setSubjectName] = useState<string>("");
  const [subjectCode, setSubjectCode] = useState<string>("");
  const [report, setReport] = useState<SubjectReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Cross-filtering state: the charts, KPI cards and tables all read it ──
  const [selectedAssessment, setSelectedAssessment] = useState<string | null>(null);
  const [activeBand, setActiveBand] = useState<BandKey | null>(null);
  const [onlyIncomplete, setOnlyIncomplete] = useState(false);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"score" | "name" | "marked">("score");
  const [openStudent, setOpenStudent] = useState<StudentStat | null>(null);

  const load = useCallback(
    async (mode: "initial" | "refresh") => {
      if (!courseId || !term || !academicYear) return;
      if (mode === "initial") setLoading(true);
      else setRefreshing(true);
      setError(null);
      try {
        const [payload, course] = await Promise.all([
          fetchSubjectGrades(courseId, { academicTermId, term, academicYear }),
          CourseApiService.getCourse(Number(courseId)).catch(() => null),
        ]);
        setReport(buildSubjectReport(payload));
        if (course?.data) {
          setSubjectName(course.data.title ?? `Subject #${courseId}`);
          setSubjectCode((course.data as { code?: string }).code ?? "");
        }
      } catch {
        setError("Failed to load this subject's assessment report.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [courseId, term, academicYear, academicTermId],
  );

  useEffect(() => {
    load("initial");
  }, [load]);

  // ── Derived views ───────────────────────────────────────────────────────────
  const assessmentRows = useMemo(() => {
    if (!report) return [];
    const rows = onlyIncomplete
      ? report.assessments.filter((a) => a.markedCount < a.rosterSize)
      : report.assessments;
    return [...rows].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  }, [report, onlyIncomplete]);

  const studentRows = useMemo(() => {
    if (!report) return [];
    const q = search.trim().toLowerCase();
    const rows = report.students.filter((s) => {
      if (activeBand && (s.markedCount === 0 || s.band !== activeBand)) return false;
      if (!q) return true;
      return s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
    });
    return rows.sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "marked") return b.markedCount - a.markedCount;
      return b.overallPct - a.overallPct;
    });
  }, [report, search, activeBand, sortBy]);

  /** The "what needs doing" list — every entry carries its own way to act. */
  const alerts = useMemo(() => {
    if (!report) return [];
    const out: Array<{
      id: string;
      tone: "warning" | "serious" | "good";
      title: string;
      detail: string;
      action?: { label: string; to?: string; onClick?: () => void };
    }> = [];

    if (report.unmarkedAssessments.length > 0) {
      const first = report.unmarkedAssessments[0];
      out.push({
        id: "unmarked",
        tone: "serious",
        title: `${report.unmarkedAssessments.length} assessment${report.unmarkedAssessments.length !== 1 ? "s" : ""} with no marks at all`,
        detail: report.unmarkedAssessments.map((a) => a.title).slice(0, 3).join(", "),
        action: { label: actionFor(first).label, to: actionFor(first).to },
      });
    }

    const partial = report.assessments.filter(
      (a) => a.markedCount > 0 && a.markedCount < a.rosterSize,
    );
    if (partial.length > 0) {
      out.push({
        id: "partial",
        tone: "warning",
        title: `${partial.length} assessment${partial.length !== 1 ? "s" : ""} only partly marked`,
        detail: `${report.outstandingMarks} student mark${report.outstandingMarks !== 1 ? "s" : ""} still missing across the subject.`,
        action: { label: "Show these", onClick: () => setOnlyIncomplete(true) },
      });
    }

    if (report.atRiskCount > 0) {
      out.push({
        id: "at-risk",
        tone: "serious",
        title: `${report.atRiskCount} student${report.atRiskCount !== 1 ? "s" : ""} below 50%`,
        detail: "They need intervention before the report card is issued.",
        action: { label: "List them", onClick: () => setActiveBand("at_risk") },
      });
    }

    const weakest = [...report.assessments]
      .filter((a) => a.averagePct !== null)
      .sort((a, b) => (a.averagePct ?? 0) - (b.averagePct ?? 0))[0];
    if (weakest && (weakest.averagePct ?? 0) < 50) {
      out.push({
        id: "weak-assessment",
        tone: "warning",
        title: `The class averaged ${weakest.averagePct}% on "${weakest.title}"`,
        detail: "Worth re-teaching this topic before moving on.",
        action: { label: "Focus", onClick: () => setSelectedAssessment(weakest.key) },
      });
    }

    if (out.length === 0 && report.assessments.length > 0) {
      out.push({
        id: "clear",
        tone: "good",
        title: "Everything is marked and nobody is below 50%",
        detail: "This subject is ready for report cards.",
      });
    }

    return out;
  }, [report]);

  const handleExport = () => {
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
    link.download = `${subjectCode || `subject-${courseId}`}-${term || "term"}-assessment-report.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Report exported");
  };

  // ── Guards ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark/70">
            Building the assessment report…
          </p>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="flex flex-col items-center gap-4 max-w-sm text-center">
          <div className="w-14 h-14 rounded-2xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800/50 flex items-center justify-center">
            <AlertCircle className="w-7 h-7 text-orange-500" />
          </div>
          <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark/70">
            {error ?? "Could not load this subject."}
          </p>
          <Link to="/grades" className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline text-sm">
            <ArrowLeft className="w-4 h-4" /> Back to Grades
          </Link>
        </div>
      </div>
    );
  }

  const selected = report.assessments.find((a) => a.key === selectedAssessment) ?? null;
  const filtersOn = Boolean(selectedAssessment || activeBand || onlyIncomplete || search);

  return (
    <motion.div className="space-y-5 pb-10" variants={container} initial="hidden" animate="visible">
      <Link
        to="/grades"
        className="flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:underline w-fit"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Grades
      </Link>

      {/* Header */}
      <motion.div
        variants={item}
        className="bg-card-light dark:bg-card-dark/30 rounded-2xl border border-white dark:border-border-dark/30 p-5 flex flex-wrap items-start justify-between gap-4"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-blue-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
            {(subjectCode || "SB").substring(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark/60 uppercase tracking-widest font-medium">
              Assessment report
            </p>
            <h1 className="text-xl sm:text-2xl font-bold text-text-primary-light dark:text-text-primary-dark truncate">
              {subjectName || `Subject #${courseId}`}
            </h1>
            <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark/60 mt-0.5">
              {report.assessments.length} assessment{report.assessments.length !== 1 ? "s" : ""} ·{" "}
              {report.rosterSize} student{report.rosterSize !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <TermYearSelect
            years={years}
            terms={terms}
            academicYear={academicYear}
            term={term}
            onAcademicYearChange={setAcademicYear}
            onTermChange={setTerm}
            disabled={refreshing}
          />
          <button
            onClick={() => load("refresh")}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-border-light dark:border-border-dark/40 text-text-secondary-light dark:text-text-secondary-dark hover:bg-surface-light dark:hover:bg-surface-dark/50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-border-light dark:border-border-dark/40 text-text-secondary-light dark:text-text-secondary-dark hover:bg-surface-light dark:hover:bg-surface-dark/50 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <Link
            to={`/grades/subjects/${courseId}`}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            <ClipboardCheck className="w-3.5 h-3.5" />
            Report Card
          </Link>
        </div>
      </motion.div>

      {/* KPIs */}
      <motion.div variants={container} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<Gauge className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
          accent="bg-blue-100 dark:bg-blue-900/20"
          label="Class average"
          value={report.classAverage}
          suffix="%"
          progress={report.classAverage}
          caption={`Median ${report.medianPct}% · counts only students with at least one mark`}
        />
        <KpiCard
          icon={<CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
          accent="bg-emerald-100 dark:bg-emerald-900/20"
          label="Pass rate"
          value={report.passRate}
          suffix="%"
          progress={report.passRate}
          caption="Share of marked students at or above 50%"
        />
        <KpiCard
          icon={<AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />}
          accent="bg-red-100 dark:bg-red-900/20"
          label="At risk"
          value={report.atRiskCount}
          caption={activeBand === "at_risk" ? "Filtering the roster — click to clear" : "Below 50% — click to list them"}
          onClick={() => setActiveBand(activeBand === "at_risk" ? null : "at_risk")}
          active={activeBand === "at_risk"}
        />
        <KpiCard
          icon={<PencilLine className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
          accent="bg-amber-100 dark:bg-amber-900/20"
          label="Marks outstanding"
          value={report.outstandingMarks}
          caption={onlyIncomplete ? "Showing only unfinished assessments — click to clear" : "Student marks not yet entered — click to review"}
          onClick={() => setOnlyIncomplete((v) => !v)}
          active={onlyIncomplete}
        />
      </motion.div>

      {/* Needs attention */}
      <Panel
        title="Needs attention"
        icon={<AlertTriangle className="w-4 h-4" />}
        hint="Derived from this term's marks — each item links to where you fix it"
      >
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {alerts.map((a) => {
              const tone = {
                serious: "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-300",
                warning: "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40 text-amber-700 dark:text-amber-300",
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
                  {a.action &&
                    (a.action.to ? (
                      <Link
                        to={a.action.to}
                        className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full bg-white/70 dark:bg-black/20 hover:bg-white dark:hover:bg-black/40 transition-colors whitespace-nowrap"
                      >
                        {a.action.label} <ArrowRight className="w-3 h-3" />
                      </Link>
                    ) : (
                      <button
                        onClick={a.action.onClick}
                        className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full bg-white/70 dark:bg-black/20 hover:bg-white dark:hover:bg-black/40 transition-colors whitespace-nowrap"
                      >
                        {a.action.label} <ArrowRight className="w-3 h-3" />
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
            hint="Weakest first · click a bar to focus that assessment below"
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
          hint="Click a band to filter the roster"
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

      {/* Assessment breakdown */}
      <Panel
        title="Assessments"
        icon={<ClipboardList className="w-4 h-4" />}
        hint={onlyIncomplete ? "Showing only assessments with missing marks" : "Every quiz, assignment and recorded mark this term"}
        action={
          onlyIncomplete ? (
            <button
              onClick={() => setOnlyIncomplete(false)}
              className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
            >
              Show all
            </button>
          ) : undefined
        }
      >
        {assessmentRows.length === 0 ? (
          <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark/60 py-8 text-center">
            {onlyIncomplete
              ? "Every assessment is fully marked."
              : "No assessments exist for this subject and term yet."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest text-text-secondary-light dark:text-text-secondary-dark/60">
                  {["Assessment", "Type", "Date", "Marked", "Average", "Low / High", ""].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-bold whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {assessmentRows.map((a) => {
                  const isSelected = selectedAssessment === a.key;
                  const action = actionFor(a);
                  return (
                    <motion.tr
                      layout
                      key={a.key}
                      onClick={() => setSelectedAssessment(isSelected ? null : a.key)}
                      className={`border-t border-border-light dark:border-border-dark/30 cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-blue-50/70 dark:bg-blue-950/20"
                          : "hover:bg-surface-light/60 dark:hover:bg-surface-dark/40"
                      }`}
                    >
                      <td className="px-3 py-3 max-w-[260px]">
                        <p className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark truncate" title={a.title}>
                          {a.title}
                        </p>
                        <p className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark/60">
                          Max {a.maxScore}
                          {!a.countsToFinal && " · not in final grade"}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg ${KIND_BADGE[a.kind]}`}>
                          {KIND_LABEL[a.kind]}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs text-text-secondary-light dark:text-text-secondary-dark/70 whitespace-nowrap">
                        {a.date ? new Date(a.date).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-3 py-3">
                        <Progress done={a.markedCount} total={a.rosterSize} />
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {a.averagePct === null ? (
                          <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark/50">
                            Not marked
                          </span>
                        ) : (
                          <span
                            className="text-sm font-bold tabular-nums"
                            style={{ color: bandMeta(bandOf(a.averagePct)).color }}
                          >
                            {a.averagePct}%
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-xs tabular-nums text-text-secondary-light dark:text-text-secondary-dark/70 whitespace-nowrap">
                        {a.lowestPct === null ? "—" : `${a.lowestPct}% / ${a.highestPct}%`}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Link
                          to={action.to}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
                        >
                          {action.label} <ArrowRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Roster */}
      <Panel
        title={selected ? `Students · ${selected.title}` : "Students"}
        icon={<Users className="w-4 h-4" />}
        hint={
          selected
            ? "Showing each student's mark for the focused assessment"
            : "Overall standing across every assessment — click a student for the full breakdown"
        }
        action={
          filtersOn ? (
            <button
              onClick={() => {
                setActiveBand(null);
                setSelectedAssessment(null);
                setOnlyIncomplete(false);
                setSearch("");
              }}
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
                  <span className="tabular-nums opacity-80">{report.bandCounts[b.key] ?? 0}</span>
                </button>
              );
            })}
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            aria-label="Sort students"
            className="px-3 py-2 rounded-xl text-sm bg-surface-light dark:bg-surface-dark/50 text-text-primary-light dark:text-text-primary-dark border border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="score">Sort: highest score</option>
            <option value="name">Sort: name</option>
            <option value="marked">Sort: most marks</option>
          </select>
        </div>

        {studentRows.length === 0 ? (
          <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark/60 py-8 text-center">
            No students match these filters.
          </p>
        ) : (
          <ul className="space-y-1.5">
            <AnimatePresence initial={false}>
              {studentRows.map((s) => {
                const focusMark = selected ? s.marks[selected.key] : null;
                return (
                  <motion.li key={s.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <button
                      onClick={() => setOpenStudent(s)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-surface-light/70 dark:hover:bg-surface-dark/50 transition-colors group"
                    >
                      <span className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {s.name.charAt(0).toUpperCase()}
                      </span>

                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-semibold text-text-primary-light dark:text-text-primary-dark truncate">
                          {s.name}
                        </span>
                        <span className="block text-[11px] text-text-secondary-light dark:text-text-secondary-dark/60">
                          {s.markedCount}/{report.assessments.length} marked · {s.pointsEarned}/{s.pointsMax} pts
                        </span>
                      </span>

                      {selected ? (
                        <span className="text-sm font-bold tabular-nums whitespace-nowrap"
                          style={{ color: focusMark === null || focusMark === undefined ? undefined : bandMeta(bandOf(focusMark)).color }}
                        >
                          {focusMark === null || focusMark === undefined ? (
                            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">Not marked</span>
                          ) : (
                            `${focusMark}%`
                          )}
                        </span>
                      ) : (
                        <>
                          <span className="hidden sm:block w-28">
                            <span className="block h-1.5 rounded-full bg-surface-light dark:bg-surface-dark overflow-hidden">
                              <motion.span
                                className="block h-full rounded-full"
                                style={{ backgroundColor: bandMeta(s.band).color }}
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(100, s.overallPct)}%` }}
                                transition={{ duration: 0.6, ease: "easeOut" }}
                              />
                            </span>
                          </span>
                          <span className="text-sm font-bold tabular-nums text-text-primary-light dark:text-text-primary-dark w-12 text-right">
                            {s.markedCount > 0 ? `${s.overallPct}%` : "—"}
                          </span>
                          <span className="hidden md:block">
                            {s.markedCount > 0 ? (
                              <BandPill band={s.band} />
                            ) : (
                              <span className="text-[11px] font-semibold text-text-secondary-light dark:text-text-secondary-dark/50">
                                No marks
                              </span>
                            )}
                          </span>
                        </>
                      )}

                      <ChevronDown className="w-4 h-4 -rotate-90 text-text-secondary-light dark:text-text-secondary-dark/40 group-hover:text-blue-500 transition-colors flex-shrink-0" />
                    </button>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </Panel>

      {/* Reuses the grade-sheet modal, so the per-student breakdown looks the
          same here as it does on the course reports page. */}
      <StudentGradeModal
        isOpen={Boolean(openStudent)}
        onClose={() => setOpenStudent(null)}
        student={openStudent?.raw ?? null}
      />
    </motion.div>
  );
}

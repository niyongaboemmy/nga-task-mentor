import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  Award,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Gauge,
  GraduationCap,
  Info,
  Lightbulb,
  PencilLine,
  RefreshCw,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { toast } from "react-toastify";
import { useAuth } from "../contexts/AuthContext";
import {
  BandPill,
  KpiCard,
  Panel,
  ReportSkeleton,
} from "../components/Grades/reportUi";
import {
  containerVariants,
  itemVariants,
} from "../components/Grades/reportMotion";
import { SubjectAveragesChart } from "../components/Grades/SubjectReportCharts";
import { bandMeta, bandOf } from "../services/subjectReportApi";
import {
  buildStudentOverview,
  fetchMyGrades,
  itemLabel,
  itemPercentage,
  type Recommendation,
  type StudentOverview,
  type SubjectView,
} from "../services/studentReportApi";

// ─── My Reports ───────────────────────────────────────────────────────────────
// A student's own academic picture across every enrolled subject: what has been
// marked, what it adds up to, and — the part that makes it worth opening — what
// to do about it.
//
// Two rules keep the numbers honest (see services/studentReportApi.ts): only
// marked work is averaged, and a subject with nothing marked has *no grade*
// rather than 0%. Without them the page reported a full timetable of untouched
// subjects as a failing student.

const TONE = {
  serious: {
    box: "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-300",
    Icon: AlertTriangle,
  },
  warning: {
    box: "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40 text-amber-700 dark:text-amber-300",
    Icon: AlertTriangle,
  },
  info: {
    box: "bg-surface-light dark:bg-surface-dark/60 border-border-light dark:border-border-dark/40 text-text-secondary-light dark:text-text-secondary-dark",
    Icon: Info,
  },
  good: {
    box: "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-300",
    Icon: Sparkles,
  },
} as const;

const formatDate = (value: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

function RecommendationRow({
  recommendation,
  onOpen,
}: {
  recommendation: Recommendation;
  onOpen: (courseId: number) => void;
}) {
  const { box, Icon } = TONE[recommendation.tone];
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-xl border ${box}`}
    >
      <div className="flex items-start gap-2.5 min-w-0">
        <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-semibold">{recommendation.title}</p>
          <p className="text-xs opacity-80">{recommendation.detail}</p>
        </div>
      </div>
      {recommendation.courseId !== undefined && (
        <button
          onClick={() => onOpen(recommendation.courseId!)}
          className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full bg-white/70 dark:bg-black/20 hover:bg-white dark:hover:bg-black/40 transition-colors whitespace-nowrap"
        >
          Open subject <ArrowRight className="w-3 h-3" />
        </button>
      )}
    </motion.li>
  );
}

function SubjectCard({ subject, onOpen }: { subject: SubjectView; onOpen: () => void }) {
  const bars: Array<{ label: string; done: number; total: number; color: string }> = [
    {
      label: "Assignments",
      done: subject.items.filter((i) => i.kind === "assignment" && i.submitted).length,
      total: subject.totalAssignments,
      color: "bg-indigo-500",
    },
    {
      label: "Quizzes",
      done: subject.items.filter((i) => i.kind === "quiz" && i.submitted).length,
      total: subject.totalQuizzes,
      color: "bg-pink-500",
    },
    {
      label: "Class marks",
      done: subject.assessmentsRecorded,
      total: subject.totalAssessments,
      color: "bg-amber-500",
    },
  ].filter((b) => b.total > 0);

  return (
    <motion.button
      variants={itemVariants}
      whileHover={{ y: -3 }}
      onClick={onOpen}
      className="text-left bg-card-light dark:bg-card-dark/30 rounded-2xl border border-white dark:border-border-dark/30 p-4 hover:border-blue-400/50 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
            {subject.code}
          </span>
          <h3 className="mt-2 text-sm font-bold text-text-primary-light dark:text-text-primary-dark line-clamp-2">
            {subject.courseName}
          </h3>
        </div>
        <div className="text-right flex-shrink-0">
          {subject.hasMarks ? (
            <>
              <p
                className="text-xl font-bold tabular-nums"
                style={{ color: bandMeta(bandOf(subject.percentage)).color }}
              >
                {subject.percentage}%
              </p>
              <p className="text-[10px] text-text-secondary-light dark:text-text-secondary-dark/60">
                {subject.totalPointsEarned}/{subject.totalMaxPoints} pts
              </p>
            </>
          ) : (
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg bg-surface-light dark:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark/70">
              No marks yet
            </span>
          )}
        </div>
      </div>

      {bars.length > 0 ? (
        <div className="mt-3 space-y-2">
          {bars.map((bar) => (
            <div key={bar.label}>
              <div className="flex justify-between text-[10px] font-semibold uppercase tracking-wider mb-1">
                <span className="text-text-secondary-light dark:text-text-secondary-dark/60">
                  {bar.label}
                </span>
                <span className="text-text-primary-light dark:text-text-primary-dark tabular-nums">
                  {bar.done}/{bar.total}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-surface-light dark:bg-surface-dark overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${bar.color}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${(bar.done / bar.total) * 100}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-[11px] text-text-secondary-light dark:text-text-secondary-dark/60">
          Nothing has been set for this subject yet.
        </p>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        {subject.hasMarks ? (
          <BandPill band={bandOf(subject.percentage)} />
        ) : (
          <span className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark/50">
            Not started
          </span>
        )}
        <span className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark/60">
          {subject.pendingCount > 0 ? `${subject.pendingCount} pending` : "All marked"}
        </span>
      </div>
    </motion.button>
  );
}

export default function StudentReportsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [overview, setOverview] = useState<StudentOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Recorded marks are keyed on the term/year names, so send the period the
  // student has selected rather than letting the server guess.
  const term = user?.currentAcademicTerm?.name ?? "";
  const academicYear = user?.currentAcademicYear?.name ?? "";

  const load = useCallback(
    async (mode: "initial" | "refresh") => {
      if (mode === "initial") setLoading(true);
      else setRefreshing(true);
      try {
        const rows = await fetchMyGrades(
          term && academicYear ? { term, academicYear } : undefined,
        );
        setOverview(buildStudentOverview(rows));
        if (mode === "refresh") toast.success("Report updated");
      } catch {
        toast.error("Failed to load your academic report");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [term, academicYear],
  );

  useEffect(() => {
    load("initial");
  }, [load]);

  const openSubject = (courseId: number) => navigate(`/courses/${courseId}/reports`);

  /** Every mark a teacher recorded, newest first, across all subjects. */
  const recordedMarks = useMemo(() => {
    if (!overview) return [];
    return overview.subjects
      .flatMap((subject) =>
        subject.items
          .filter((item) => item.kind === "manual" && item.marked)
          .map((item) => ({ item, subject })),
      )
      .sort((a, b) => (b.item.date ?? "").localeCompare(a.item.date ?? ""));
  }, [overview]);

  if (loading) return <ReportSkeleton />;

  if (!overview || overview.subjects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
        <div className="w-14 h-14 rounded-2xl bg-surface-light dark:bg-surface-dark flex items-center justify-center">
          <GraduationCap className="w-7 h-7 text-text-secondary-light dark:text-text-secondary-dark/60" />
        </div>
        <div>
          <p className="text-base font-bold text-text-primary-light dark:text-text-primary-dark">
            No reports yet
          </p>
          <p className="mt-1 text-sm text-text-secondary-light dark:text-text-secondary-dark/70 max-w-sm">
            You are not enrolled in any subject for this term, or nothing has been
            assessed yet.
          </p>
        </div>
        <button
          onClick={() => load("refresh")}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>
    );
  }

  return (
    <motion.div
      className="space-y-5 pb-10"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div
        variants={itemVariants}
        className="bg-card-light dark:bg-card-dark/30 rounded-2xl border border-white dark:border-border-dark/30 p-4 sm:p-5 flex flex-wrap items-start justify-between gap-4"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-blue-600 flex items-center justify-center text-white flex-shrink-0">
            <Award className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark/60 uppercase tracking-widest font-medium">
              Student report
            </p>
            <h1 className="text-xl sm:text-2xl font-bold text-text-primary-light dark:text-text-primary-dark">
              Academic Performance
            </h1>
            <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark/60 mt-0.5">
              {overview.subjects.length} subject{overview.subjects.length !== 1 ? "s" : ""} ·{" "}
              {overview.graded.length} with marks
              {term ? ` · ${term}` : ""}
            </p>
          </div>
        </div>

        <button
          onClick={() => load("refresh")}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-border-light dark:border-border-dark/40 text-text-secondary-light dark:text-text-secondary-dark hover:bg-surface-light dark:hover:bg-surface-dark/50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Refreshing" : "Refresh"}
        </button>
      </motion.div>

      {/* KPIs */}
      <motion.div
        variants={containerVariants}
        className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
      >
        <KpiCard
          icon={<Gauge className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
          accent="bg-blue-100 dark:bg-blue-900/20"
          label="Average"
          value={overview.overallAverage}
          suffix="%"
          progress={overview.overallAverage}
          caption={
            overview.graded.length === 0
              ? "Nothing marked yet — no average to show"
              : `Across the ${overview.graded.length} subject${
                  overview.graded.length !== 1 ? "s" : ""
                } with marks`
          }
        />
        <KpiCard
          icon={<CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
          accent="bg-emerald-100 dark:bg-emerald-900/20"
          label="Marked"
          value={overview.progress}
          suffix="%"
          progress={overview.progress}
          progressColor="bg-emerald-500"
          caption={`${overview.markedCount} of ${overview.markedCount + overview.pendingCount} assessments`}
        />
        <KpiCard
          icon={<PencilLine className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
          accent="bg-amber-100 dark:bg-amber-900/20"
          label="Awaiting marks"
          value={overview.pendingCount}
          caption="Not counted in your average until marked"
        />
        <KpiCard
          icon={<AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />}
          accent="bg-red-100 dark:bg-red-900/20"
          label="Overdue"
          value={overview.overdueCount}
          caption={
            overview.overdueCount === 0
              ? "Nothing is past its deadline"
              : "Work past due and not submitted"
          }
        />
      </motion.div>

      {/* What to do about it */}
      <Panel
        title="What to focus on"
        icon={<Lightbulb className="w-4 h-4" />}
        hint="Based on the work marked so far"
      >
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {overview.recommendations.map((r) => (
              <RecommendationRow key={r.id} recommendation={r} onOpen={openSubject} />
            ))}
          </AnimatePresence>
        </ul>
      </Panel>

      {/* Subject comparison — only subjects that actually have marks */}
      <Panel
        title="How your subjects compare"
        icon={<TrendingUp className="w-4 h-4" />}
        hint={
          overview.graded.length === 0
            ? "Appears once your first mark is in"
            : "Weakest first · click a bar to open that subject"
        }
      >
        {overview.graded.length === 0 ? (
          <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark/60 py-8 text-center">
            Nothing has been marked yet, so there is nothing to compare. Subjects
            with no marks are deliberately left out rather than shown as 0%.
          </p>
        ) : (
          <SubjectAveragesChart
            subjects={overview.graded.map((s) => ({
              key: String(s.courseId),
              label: s.code || s.courseName,
              value: s.percentage,
              tooltip: [
                s.courseName,
                `${s.totalPointsEarned}/${s.totalMaxPoints} points from ${s.markedCount} marked`,
                s.pendingCount > 0 ? `${s.pendingCount} still to be marked` : "Everything marked",
              ],
            }))}
            onSelect={(key) => openSubject(Number(key))}
          />
        )}
      </Panel>

      {/* Marks recorded by teachers */}
      <Panel
        title="Marks recorded by your teachers"
        icon={<ClipboardList className="w-4 h-4" />}
        hint="Class work, homework, midterms and CA exams marked off-platform"
      >
        {recordedMarks.length === 0 ? (
          <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark/60 py-8 text-center">
            No marks have been recorded for you yet this term.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left border-collapse">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-widest text-text-secondary-light dark:text-text-secondary-dark/60">
                  <th className="pb-2 pr-4">Subject</th>
                  <th className="pb-2 pr-4">Assessment</th>
                  <th className="pb-2 pr-4">Date</th>
                  <th className="pb-2 pr-4 text-right">Score</th>
                  <th className="pb-2 text-right">%</th>
                </tr>
              </thead>
              <tbody>
                {recordedMarks.map(({ item, subject }) => {
                  const pct = itemPercentage(item) ?? 0;
                  const date = formatDate(item.date);
                  return (
                    <tr
                      key={`${subject.courseId}-${item.id}`}
                      onClick={() => openSubject(subject.courseId)}
                      className="border-t border-border-light dark:border-border-dark/30 cursor-pointer hover:bg-surface-light/60 dark:hover:bg-surface-dark/40 transition-colors"
                    >
                      <td className="py-2.5 pr-4">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                          {subject.code}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4">
                        <span className="block text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
                          {itemLabel(item)}
                        </span>
                        {!item.countsToFinal && (
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark/60">
                            Not counted in final grade
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 pr-4 text-xs text-text-secondary-light dark:text-text-secondary-dark/70 whitespace-nowrap">
                        {date ? (
                          <span className="inline-flex items-center gap-1.5">
                            <CalendarDays className="w-3.5 h-3.5" />
                            {date}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-2.5 pr-4 text-right text-sm font-bold tabular-nums text-text-primary-light dark:text-text-primary-dark whitespace-nowrap">
                        {item.score}
                        <span className="text-text-secondary-light dark:text-text-secondary-dark/50">
                          {" "}
                          / {item.maxScore}
                        </span>
                      </td>
                      <td
                        className="py-2.5 text-right text-sm font-bold tabular-nums"
                        style={{ color: bandMeta(bandOf(pct)).color }}
                      >
                        {pct}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Per-subject detail */}
      <motion.section variants={itemVariants} className="space-y-3">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-xl bg-surface-light dark:bg-surface-dark flex items-center justify-center text-blue-600 dark:text-blue-400">
            <BookOpen className="w-4 h-4" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-text-primary-light dark:text-text-primary-dark">
              Subject details
            </h2>
            <p className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark/60">
              Open a subject for every mark behind its grade
            </p>
          </div>
        </div>

        <motion.div
          variants={containerVariants}
          className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4"
        >
          {overview.subjects.map((subject) => (
            <SubjectCard
              key={subject.courseId}
              subject={subject}
              onOpen={() => openSubject(subject.courseId)}
            />
          ))}
        </motion.div>
      </motion.section>

      <p className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark/50 text-center">
        Only marked work counts towards these figures.{" "}
        <Link to="/assignments" className="text-blue-600 dark:text-blue-400 hover:underline">
          See what is still open
        </Link>
      </p>
    </motion.div>
  );
}

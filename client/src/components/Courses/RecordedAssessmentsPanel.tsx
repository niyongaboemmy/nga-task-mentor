import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Gauge,
  PencilLine,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import { BandPill, Progress } from "../Grades/reportUi";
import {
  bandMeta,
  bandOf,
  type AssessmentStat,
  type StudentStat,
} from "../../services/subjectReportApi";
import type { RecordedAssessmentsState } from "./useRecordedAssessments";

// ─── Recorded assessments (course tab) ────────────────────────────────────────
// The marks a teacher enters by hand — class work, homework, midterms, CA exams
// — which never pass through a submission and so appear nowhere else on the
// course page.
//
// Both roles read the same endpoint, GET /courses/:id/grades: a teacher gets
// the whole roster and sees each assessment's spread; a student gets only their
// own row and sees their marks. One derivation (buildSubjectReport) means the
// percentages here always agree with the course report and the report card.

function Stat({
  icon,
  label,
  value,
  caption,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  caption: string;
  accent: string;
}) {
  return (
    <div className="bg-card-light dark:bg-card-dark/30 rounded-2xl border border-white dark:border-border-dark/30 p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${accent}`}>
          {icon}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-widest text-text-secondary-light dark:text-text-secondary-dark/60">
          {label}
        </span>
      </div>
      <p className="text-xl font-bold text-text-primary-light dark:text-text-primary-dark tabular-nums">
        {value}
      </p>
      <p className="mt-1 text-[11px] text-text-secondary-light dark:text-text-secondary-dark/60">
        {caption}
      </p>
    </div>
  );
}

/** One assessment for a teacher: its spread, and every student's mark inside. */
function AssessmentRow({
  assessment,
  students,
  canEdit,
  expanded,
  onToggle,
}: {
  assessment: AssessmentStat;
  students: StudentStat[];
  canEdit: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students
      .filter((s) => (q ? s.name.toLowerCase().includes(q) : true))
      .map((s) => ({ student: s, mark: s.marks[assessment.key] ?? null }))
      .sort((a, b) => {
        // Unmarked students first — they are the ones needing action.
        if ((a.mark === null) !== (b.mark === null)) return a.mark === null ? -1 : 1;
        return (b.mark ?? 0) - (a.mark ?? 0);
      });
  }, [students, assessment.key, search]);

  const date = assessment.date ? new Date(assessment.date).toLocaleDateString() : null;

  return (
    <motion.li
      layout
      // Explicit, not `variants` — this panel mounts inside the course page's
      // variant context *after* its animation has finished, so an inherited
      // "hidden" label would never be animated away and the row would stay
      // invisible. Self-contained motion is immune to that.
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="rounded-2xl border border-white dark:border-border-dark/30 bg-card-light dark:bg-card-dark/30 overflow-hidden"
    >
      <button
        onClick={onToggle}
        aria-expanded={expanded}
        className="w-full flex flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-surface-light/60 dark:hover:bg-surface-dark/40 transition-colors"
      >
        <ChevronDown
          className={`w-4 h-4 flex-shrink-0 text-text-secondary-light dark:text-text-secondary-dark/60 transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
        />
        <div className="flex-1 min-w-[160px]">
          <p className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark truncate">
            {assessment.title}
          </p>
          <p className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark/60 flex flex-wrap items-center gap-2">
            <span>Max {assessment.maxScore}</span>
            {date && (
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="w-3 h-3" />
                {date}
              </span>
            )}
            {!assessment.countsToFinal && <span>· not in final grade</span>}
          </p>
        </div>

        <div className="hidden sm:block w-40">
          <Progress done={assessment.markedCount} total={assessment.rosterSize} />
        </div>

        <div className="text-right min-w-[64px]">
          {assessment.averagePct === null ? (
            <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
              Not marked
            </span>
          ) : (
            <>
              <span
                className="text-sm font-bold tabular-nums"
                style={{ color: bandMeta(bandOf(assessment.averagePct)).color }}
              >
                {assessment.averagePct}%
              </span>
              <span className="block text-[10px] text-text-secondary-light dark:text-text-secondary-dark/60">
                class average
              </span>
            </>
          )}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-border-light dark:border-border-dark/30"
          >
            <div className="p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[160px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary-light dark:text-text-secondary-dark/60" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search students"
                    className="w-full pl-9 pr-3 py-2 rounded-xl text-sm bg-surface-light dark:bg-surface-dark/50 text-text-primary-light dark:text-text-primary-dark border border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <span className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark/60 whitespace-nowrap">
                  Low {assessment.lowestPct ?? "—"}% · High {assessment.highestPct ?? "—"}%
                  {assessment.failingCount > 0 && ` · ${assessment.failingCount} below 50%`}
                </span>
                {canEdit && (
                  <Link
                    to={`/grades/${assessment.id}/marks`}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors whitespace-nowrap"
                  >
                    <PencilLine className="w-3.5 h-3.5" />
                    {assessment.markedCount === 0 ? "Enter marks" : "Edit marks"}
                  </Link>
                )}
              </div>

              {rows.length === 0 ? (
                <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark/60 py-6 text-center">
                  No students match that search.
                </p>
              ) : (
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {rows.map(({ student, mark }) => (
                    <li
                      key={student.id}
                      className="flex items-center justify-between gap-3 rounded-xl bg-surface-light dark:bg-surface-dark/50 px-3 py-2"
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        <span className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 flex items-center justify-center text-[11px] font-bold flex-shrink-0">
                          {student.name.charAt(0).toUpperCase()}
                        </span>
                        <span className="text-sm text-text-primary-light dark:text-text-primary-dark truncate">
                          {student.name}
                        </span>
                      </span>
                      {mark === null ? (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 whitespace-nowrap">
                          Not marked
                        </span>
                      ) : (
                        <span
                          className="px-2 py-0.5 rounded-lg text-xs font-bold tabular-nums whitespace-nowrap"
                          style={{
                            backgroundColor: `${bandMeta(bandOf(mark)).color}1f`,
                            color: bandMeta(bandOf(mark)).color,
                          }}
                        >
                          {mark}%
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

export default function RecordedAssessmentsPanel({
  canViewAll,
  canEdit,
  state,
}: {
  canViewAll: boolean;
  canEdit: boolean;
  state: RecordedAssessmentsState;
}) {
  const { report, recorded, loading, refreshing, error, reload } = state;
  const [expanded, setExpanded] = useState<string | null>(null);

  // A student's own row is the only one their payload carries.
  const me = !canViewAll ? (report?.students[0] ?? null) : null;

  const markedCount = recorded.filter((a) => a.markedCount > 0).length;
  const outstanding = recorded.reduce(
    (acc, a) => acc + Math.max(0, a.rosterSize - a.markedCount),
    0,
  );
  const classAverage = useMemo(() => {
    const marked = recorded.filter((a) => a.averagePct !== null);
    if (marked.length === 0) return null;
    return (
      Math.round((marked.reduce((acc, a) => acc + (a.averagePct ?? 0), 0) / marked.length) * 10) /
      10
    );
  }, [recorded]);

  const myMarks = useMemo(() => {
    if (!me) return [];
    return recorded.map((a) => ({ assessment: a, mark: me.marks[a.key] ?? null }));
  }, [me, recorded]);

  const myAverage = useMemo(() => {
    const marks = myMarks.map((m) => m.mark).filter((m): m is number => m !== null);
    if (marks.length === 0) return null;
    return Math.round((marks.reduce((a, m) => a + m, 0) / marks.length) * 10) / 10;
  }, [myMarks]);

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse" aria-busy="true" aria-label="Loading recorded marks">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 rounded-2xl bg-card-light dark:bg-card-dark/30" />
          ))}
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 rounded-2xl bg-card-light dark:bg-card-dark/30" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <AlertTriangle className="w-8 h-8 text-amber-500" />
        <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark/70">{error}</p>
        <button
          onClick={reload}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Try again
        </button>
      </div>
    );
  }

  if (recorded.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-14 text-center">
        <div className="w-14 h-14 rounded-2xl bg-surface-light dark:bg-surface-dark flex items-center justify-center">
          <ClipboardList className="w-7 h-7 text-text-secondary-light dark:text-text-secondary-dark/50" />
        </div>
        <div>
          <p className="text-sm font-bold text-text-primary-light dark:text-text-primary-dark">
            No recorded assessments yet
          </p>
          <p className="mt-1 text-xs text-text-secondary-light dark:text-text-secondary-dark/60 max-w-sm">
            {canEdit
              ? "Class work, homework, midterms and CA exams you record by hand will appear here."
              : "Marks your teacher records in class — class work, homework, midterms and CA exams — will appear here."}
          </p>
        </div>
        {canEdit && (
          <Link
            to="/grades"
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            Add an assessment
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat
          icon={<ClipboardList className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />}
          accent="bg-blue-100 dark:bg-blue-900/20"
          label="Recorded assessments"
          value={String(recorded.length)}
          caption={
            canViewAll
              ? `${markedCount} with marks entered`
              : `${myMarks.filter((m) => m.mark !== null).length} marked for you`
          }
        />
        <Stat
          icon={<Gauge className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
          accent="bg-emerald-100 dark:bg-emerald-900/20"
          label={canViewAll ? "Class average" : "Your average"}
          value={
            canViewAll
              ? classAverage === null
                ? "—"
                : `${classAverage}%`
              : myAverage === null
                ? "—"
                : `${myAverage}%`
          }
          caption="Across marked assessments only"
        />
        {canViewAll ? (
          <Stat
            icon={<PencilLine className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />}
            accent="bg-amber-100 dark:bg-amber-900/20"
            label="Marks outstanding"
            value={String(outstanding)}
            caption={`Across ${report?.rosterSize ?? 0} enrolled student${
              (report?.rosterSize ?? 0) !== 1 ? "s" : ""
            }`}
          />
        ) : (
          <Stat
            icon={<CheckCircle2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />}
            accent="bg-amber-100 dark:bg-amber-900/20"
            label="Awaiting marks"
            value={String(myMarks.filter((m) => m.mark === null).length)}
            caption="Your teacher hasn't entered these yet"
          />
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark/60 flex items-center gap-1.5">
          {canViewAll ? (
            <Users className="w-3.5 h-3.5" />
          ) : (
            <ClipboardList className="w-3.5 h-3.5" />
          )}
          {canViewAll
            ? "Open an assessment to see every student's mark"
            : "Marks your teacher recorded for you in this subject"}
        </p>
        <button
          onClick={reload}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold border border-border-light dark:border-border-dark/40 text-text-secondary-light dark:text-text-secondary-dark hover:bg-surface-light dark:hover:bg-surface-dark/50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {canViewAll ? (
        <motion.ul layout className="space-y-2">
          {recorded.map((assessment) => (
            <AssessmentRow
              key={assessment.key}
              assessment={assessment}
              students={report?.students ?? []}
              canEdit={canEdit}
              expanded={expanded === assessment.key}
              onToggle={() => setExpanded(expanded === assessment.key ? null : assessment.key)}
            />
          ))}
        </motion.ul>
      ) : (
        <ul className="grid grid-cols-1 lg:grid-cols-2 gap-2">
          {myMarks.map(({ assessment, mark }) => {
            const date = assessment.date
              ? new Date(assessment.date).toLocaleDateString()
              : null;
            return (
              <motion.li
                key={assessment.key}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                className="flex items-center justify-between gap-3 rounded-2xl border border-white dark:border-border-dark/30 bg-card-light dark:bg-card-dark/30 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark truncate">
                    {assessment.title}
                  </p>
                  <p className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark/60 flex flex-wrap items-center gap-2">
                    <span>Max {assessment.maxScore}</span>
                    {date && (
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="w-3 h-3" />
                        {date}
                      </span>
                    )}
                    {!assessment.countsToFinal && <span>· not in final grade</span>}
                  </p>
                </div>
                {mark === null ? (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 whitespace-nowrap">
                    Not marked
                  </span>
                ) : (
                  <span className="flex flex-col items-end gap-1">
                    <span
                      className="text-sm font-bold tabular-nums"
                      style={{ color: bandMeta(bandOf(mark)).color }}
                    >
                      {mark}%
                    </span>
                    <BandPill band={bandOf(mark)} />
                  </span>
                )}
              </motion.li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

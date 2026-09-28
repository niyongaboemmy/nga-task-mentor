import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  AlertCircle,
  Eye,
  GraduationCap,
  BookOpen,
  Award,
  CalendarDays,
  FileSearch,
} from "lucide-react";
import { toast } from "react-toastify";
import { useAuth } from "../../contexts/AuthContext";
import ReportCardPreview from "./ReportCardPreview";
import AnnualReportCardPreview from "./AnnualReportCardPreview";
import {
  ReportCardApiService,
  scoreToLetterGrade,
  type ReportCardData,
  type ReportCardPreviewMeta,
  type AssessmentCategory,
} from "../../services/reportCardApi";

// ─── Student Details → "Report Cards" tab ─────────────────────────────────────
// The per-student counterpart to SubjectReportCardDashboard: one student,
// every enrolled subject. Reuses getStudentReportCard (already returns
// grades: SubjectGrade[] across every subject the student has a mapping for).
//
// The period is the one picked in the app bar (AcademicPeriodSwitcher) —
// switching it remounts the page, so there's no local term/year picker here
// to drift out of sync with the rest of the profile.

const CATEGORY_ORDER: AssessmentCategory[] = ["CW", "HW", "MD", "EOT"];
const CATEGORY_META: Record<AssessmentCategory, { label: string; color: string }> = {
  CW:  { label: "CW",  color: "bg-blue-500" },
  HW:  { label: "HW",  color: "bg-gray-400" },
  MD:  { label: "MD",  color: "bg-blue-700" },
  EOT: { label: "EOT", color: "bg-orange-500" },
};

export interface StudentReportCardDashboardProps {
  studentId: number;
  studentName: string;
}

export default function StudentReportCardDashboard({
  studentId,
  studentName,
}: StudentReportCardDashboardProps) {
  const { user } = useAuth();
  const academicYear: string = user?.currentAcademicYear?.name ?? "";
  const term: string = user?.currentAcademicTerm?.name ?? "";

  const [data, setData] = useState<ReportCardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [showPreview, setShowPreview] = useState(false);
  const [showProvisional, setShowProvisional] = useState(false);
  // The provisional view (what the card would show today) is optional: the
  // tab still works if it fails.
  const [preview, setPreview] = useState<ReportCardPreviewMeta | null>(null);
  const previewSeq = useRef(0);
  const [showAnnual, setShowAnnual] = useState(false);

  const fetchData = useCallback(async () => {
    if (!term || !academicYear) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setNotFound(false);
    setPreview(null);
    // Only the latest period's preview may land (a slow earlier one mustn't
    // overwrite it after a period switch).
    const seq = ++previewSeq.current;
    ReportCardApiService.getReportCardPreview(studentId, { term, academic_year: academicYear })
      .then((res) => {
        if (seq === previewSeq.current) setPreview(res.data.preview);
      })
      .catch(() => {
        if (seq === previewSeq.current) setPreview(null);
      });
    try {
      const res = await ReportCardApiService.getStudentReportCard(studentId, {
        term,
        academic_year: academicYear,
      });
      setData(res.data);
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setNotFound(true);
        setData(null);
      } else {
        toast.error("Failed to load the report card. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }, [studentId, term, academicYear]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const overallAverage =
    data && data.grades.length > 0
      ? parseFloat((data.grades.reduce((s, g) => s + g.total_score, 0) / data.grades.length).toFixed(2))
      : null;
  const overallLetter = overallAverage != null ? scoreToLetterGrade(overallAverage) : null;

  return (
    <div className="space-y-5">
      {/* Period selector */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark flex items-center gap-2">
          <GraduationCap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          Report Card — All Enrolled Subjects
        </h3>
        {term && academicYear && (
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-white/5 border border-blue-200 dark:border-blue-500/30 text-blue-700 dark:text-blue-300"
            title="Change the period from the academic year/term switcher in the top bar"
          >
            <CalendarDays className="w-3.5 h-3.5" />
            {academicYear} · {term}
          </span>
        )}
      </div>

      {!term || !academicYear ? (
        <div className="text-center py-14 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800">
          <AlertCircle className="w-9 h-9 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
          <p className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
            No academic period selected
          </p>
          <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark/60 mt-1">
            Pick a year and term from the switcher in the top bar.
          </p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-7 h-7 animate-spin text-blue-500" />
        </div>
      ) : notFound ? (
        <div className="text-center py-14 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800">
          <AlertCircle className="w-9 h-9 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
          <p className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
            No report card yet for {term} · {academicYear}
          </p>
          <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark/60 mt-1">
            You can still preview what it would show today from the marks recorded so far.
          </p>
          <button
            onClick={() => setShowProvisional(true)}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            <FileSearch className="w-3.5 h-3.5" /> Preview provisional card
          </button>
        </div>
      ) : data ? (
        <>
          {/* Overall summary */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40">
              <Award className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <span className="text-sm text-blue-700 dark:text-blue-300">
                Overall average:{" "}
                <strong className="font-semibold">
                  {overallAverage != null ? `${overallAverage} (${overallLetter!.letter})` : "—"}
                </strong>
              </span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/40">
              <BookOpen className="w-4 h-4 text-gray-600 dark:text-gray-400 flex-shrink-0" />
              <span className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                <strong className="font-semibold text-text-primary-light dark:text-text-primary-dark">{data.grades.length}</strong> subject{data.grades.length !== 1 ? "s" : ""} graded
              </span>
            </div>
            {preview && preview.overall.expected > 0 && (
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/15 border border-amber-100 dark:border-amber-800/40">
                <span className="text-sm text-amber-800 dark:text-amber-200">
                  <strong className="font-semibold">{preview.overall.recorded}/{preview.overall.expected}</strong> mapped marks recorded
                </span>
              </div>
            )}
            <div className="ml-auto flex items-center gap-2 flex-wrap">
              {preview && (preview.overall.completeness ?? 0) < 100 && (
                <button
                  onClick={() => setShowProvisional(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
                >
                  <FileSearch className="w-3.5 h-3.5" /> Provisional preview
                </button>
              )}
              <button
                onClick={() => setShowPreview(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-text-secondary-light dark:text-text-secondary-dark hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                <Eye className="w-3.5 h-3.5" /> Preview Report Card
              </button>
              <button
                onClick={() => setShowAnnual(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
              >
                <GraduationCap className="w-3.5 h-3.5" /> Annual Summary
              </button>
            </div>
          </div>

          {/* Per-subject cards */}
          {data.grades.length === 0 ? (
            <div className="text-center py-14 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800">
              <BookOpen className="w-9 h-9 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
              <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark/60">
                No subjects have been graded yet for this term.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              <AnimatePresence>
                {data.grades.map((grade) => {
                  const { letter, remark } = scoreToLetterGrade(grade.total_score);
                  const subjectName = data.subject_names?.[grade.subject_id] ?? `Subject #${grade.subject_id}`;
                  return (
                    <motion.div
                      key={grade.subject_id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-2xl border border-white dark:border-border-dark/30 bg-card-light dark:bg-card-dark/30 p-4 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark truncate">
                          {subjectName}
                        </p>
                        <span className="flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded-full bg-blue-600 text-white">
                          {letter}
                        </span>
                      </div>

                      <div className="flex items-baseline gap-1.5">
                        <span className="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark tabular-nums">
                          {grade.total_score.toFixed(1)}
                        </span>
                        <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark/60">/ 100 · {remark}</span>
                      </div>

                      <div className="space-y-1.5">
                        {CATEGORY_ORDER.map((cat) => {
                          const res = grade.categories[cat];
                          const pct = res ? Math.round((res.scaled_score / res.weight) * 100) : 0;
                          return (
                            <div key={cat} className="flex items-center gap-2">
                              <span className="w-7 text-[10px] font-semibold text-text-secondary-light dark:text-text-secondary-dark/60 flex-shrink-0">
                                {CATEGORY_META[cat].label}
                              </span>
                              <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                                {res && (
                                  <div
                                    className={`h-full rounded-full ${CATEGORY_META[cat].color}`}
                                    style={{ width: `${pct}%` }}
                                  />
                                )}
                              </div>
                              <span className="w-10 text-right text-[10px] tabular-nums text-text-secondary-light dark:text-text-secondary-dark/60">
                                {res ? res.scaled_score.toFixed(1) : "—"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </>
      ) : null}

      {preview && preview.subjects.length > 0 && term && academicYear && !loading && (
        <MarksCompleteness preview={preview} />
      )}

      {/* Modals */}
      {showPreview && (
        <ReportCardPreview
          studentId={studentId}
          studentName={studentName}
          term={term}
          academicYear={academicYear}
          onClose={() => setShowPreview(false)}
        />
      )}
      {showProvisional && (
        <ReportCardPreview
          mode="provisional"
          studentId={studentId}
          studentName={studentName}
          term={term}
          academicYear={academicYear}
          onClose={() => setShowProvisional(false)}
        />
      )}
      {showAnnual && (
        <AnnualReportCardPreview
          isOpen={showAnnual}
          onClose={() => setShowAnnual(false)}
          studentId={studentId}
          studentName={studentName}
          academicYear={academicYear}
        />
      )}
    </div>
  );
}

const SOURCE_LABEL: Record<ReportCardPreviewMeta["subjects"][number]["source"], { label: string; cls: string }> = {
  report_card: { label: "On the card", cls: "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300" },
  subject_mapping: { label: "Mapped", cls: "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300" },
  suggested: { label: "Not mapped: marks placed by type", cls: "bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-200" },
  none: { label: "Nothing mapped", cls: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
};

/** Which marks each subject still needs before its report-card line is final. */
function MarksCompleteness({ preview }: { preview: ReportCardPreviewMeta }) {
  return (
    <section className="rounded-2xl border border-white dark:border-border-dark/30 bg-card-light dark:bg-card-dark/30 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <h4 className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">Marks recorded per subject</h4>
        <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark/70">
          {preview.overall.completeness != null ? `${preview.overall.completeness}% complete` : "Nothing mapped yet"}
          {preview.overall.running_average != null && ` · currently ${preview.overall.running_average}%`}
        </span>
      </div>
      <ul className="divide-y divide-gray-100 dark:divide-gray-800">
        {preview.subjects.map((s) => {
          const pctDone = s.expected ? Math.round((s.recorded / s.expected) * 100) : 0;
          return (
            <li key={s.subject_id} className="py-2.5 grid gap-1.5 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] sm:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark truncate">{s.name}</span>
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-medium ${SOURCE_LABEL[s.source].cls}`}>{SOURCE_LABEL[s.source].label}</span>
                </div>
                {s.pending.length > 0 && (
                  <p className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark/60 truncate" title={s.pending.map((p) => `${p.category}: ${p.title}`).join("\n")}>
                    Waiting for {s.pending.slice(0, 2).map((p) => `${p.title} (${p.category})`).join(", ")}
                    {s.pending_total > 2 && ` and ${s.pending_total - 2} more`}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden" title={`${s.recorded} of ${s.expected} recorded`}>
                  <div className="h-full rounded-full bg-blue-500" style={{ width: `${pctDone}%` }} />
                </div>
                <span className="text-xs tabular-nums text-text-secondary-light dark:text-text-secondary-dark w-12 text-right">
                  {s.expected ? `${s.recorded}/${s.expected}` : "—"}
                </span>
              </div>
              <span className="text-sm font-semibold tabular-nums text-text-primary-light dark:text-text-primary-dark sm:w-16 sm:text-right">
                {s.running_percentage != null ? `${s.running_percentage}%` : "—"}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

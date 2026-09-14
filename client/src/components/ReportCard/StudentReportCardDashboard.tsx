import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  AlertCircle,
  Eye,
  GraduationCap,
  BookOpen,
  Award,
} from "lucide-react";
import { toast } from "react-toastify";
import { useTermYearSelector } from "../../hooks/useTermYearSelector";
import TermYearSelect from "./TermYearSelect";
import ReportCardPreview from "./ReportCardPreview";
import AnnualReportCardPreview from "./AnnualReportCardPreview";
import {
  ReportCardApiService,
  scoreToLetterGrade,
  type ReportCardData,
  type AssessmentCategory,
} from "../../services/reportCardApi";

// ─── Student Details → "Report Cards" tab ─────────────────────────────────────
// The per-student counterpart to SubjectReportCardDashboard: one student,
// every enrolled subject, for a selected term/year. Reuses
// getStudentReportCard (already returns grades: SubjectGrade[] across every
// subject the student has a mapping for) — no backend change needed.

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
  const {
    years, terms, academicYear, term,
    setAcademicYear, setTerm,
  } = useTermYearSelector();

  const [data, setData] = useState<ReportCardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [showPreview, setShowPreview] = useState(false);
  const [showAnnual, setShowAnnual] = useState(false);

  const fetchData = useCallback(async () => {
    if (!term || !academicYear) return;
    setLoading(true);
    setNotFound(false);
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
        <TermYearSelect
          years={years}
          terms={terms}
          academicYear={academicYear}
          term={term}
          onAcademicYearChange={setAcademicYear}
          onTermChange={setTerm}
        />
      </div>

      {loading ? (
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
            Try a different term, or check back once instructors have mapped assessments.
          </p>
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
            <div className="ml-auto flex items-center gap-2">
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

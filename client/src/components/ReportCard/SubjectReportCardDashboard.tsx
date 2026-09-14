import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  Users,
  TrendingUp,
  CheckCircle2,
  Eye,
  ThumbsUp,
  RotateCcw,
  GraduationCap,
  ChevronRight,
} from "lucide-react";
import { toast } from "react-toastify";
import { CourseApiService } from "../../services/courseApi";
import {
  ReportCardApiService,
  scoreToLetterGrade,
  STATUS_META,
  type ReportCardStatus,
  type StudentSubjectScore,
} from "../../services/reportCardApi";
import ReportCardPreview from "./ReportCardPreview";
import AnnualReportCardPreview from "./AnnualReportCardPreview";
import Tooltip from "../ui/Tooltip";

// ─── Read side of the subject report-card picture: class average, progress,
// and the student roster with Preview/Annual/status-lifecycle actions.
// Shared by SubjectGradesPage (alongside the drag-drop builder) and
// CourseReportCardsPanel (embedded read-only in Course Details), so a
// teacher can see the class's report cards without leaving either page.

export interface SubjectReportCardDashboardProps {
  courseId: number;
  term: string;
  academicYear: string;
  /** When set, shows an "Open Report Card Builder" link (e.g. from Course Details). */
  manageHref?: string;
  isAdmin: boolean;
}

interface RosterStudent {
  student_id: number;
  name: string;
}

function StatusBadge({ status }: { status: ReportCardStatus | null }) {
  if (!status) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800/80 text-text-secondary-light dark:text-text-secondary-dark/60 border border-gray-200 dark:border-gray-700/60">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600" />
        Not started
      </span>
    );
  }
  const m = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${m.color} ${m.bg} ${m.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

function ProgressSummary({ total, statuses }: { total: number; statuses: (ReportCardStatus | null)[] }) {
  const counts = { notStarted: 0, draft: 0, saved: 0, approved: 0 };
  statuses.forEach((s) => { if (!s) counts.notStarted++; else counts[s]++; });
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  const bars = [
    { label: "Not started", count: counts.notStarted, color: "bg-gray-300 dark:bg-gray-600" },
    { label: "Draft",       count: counts.draft,       color: "bg-orange-400" },
    { label: "Saved",       count: counts.saved,       color: "bg-blue-400" },
    { label: "Approved",    count: counts.approved,    color: "bg-blue-700" },
  ];

  return (
    <div className="bg-card-light dark:bg-card-dark/30 rounded-2xl border border-white dark:border-border-dark/30 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-secondary-light dark:text-text-secondary-dark flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-gray-400" />
          Class Progress — {total} student{total !== 1 ? "s" : ""}
        </h3>
        <span className="text-xs font-bold text-text-secondary-light dark:text-text-secondary-dark/60">
          {counts.approved}/{total} approved
        </span>
      </div>
      <div className="flex h-3 w-full rounded-full overflow-hidden gap-px bg-gray-100 dark:bg-gray-800">
        {bars.map((b) =>
          b.count > 0 ? (
            <motion.div key={b.label} className={b.color} initial={{ width: 0 }} animate={{ width: `${pct(b.count)}%` }} transition={{ duration: 0.6 }} title={`${b.label}: ${b.count}`} />
          ) : null,
        )}
      </div>
      <div className="flex flex-wrap gap-3">
        {bars.map((b) => (
          <span key={b.label} className="flex items-center gap-1.5 text-xs text-text-secondary-light dark:text-text-secondary-dark/70">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${b.color}`} />
            {b.label}: <strong className="font-semibold">{b.count}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function SubjectReportCardDashboard({
  courseId,
  term,
  academicYear,
  manageHref,
  isAdmin,
}: SubjectReportCardDashboardProps) {
  const [students, setStudents] = useState<RosterStudent[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(true);

  const [overview, setOverview] = useState<Map<number, StudentSubjectScore>>(new Map());
  const [overviewLoading, setOverviewLoading] = useState(false);

  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [revertingId, setRevertingId] = useState<number | null>(null);
  const [markingCompleteId, setMarkingCompleteId] = useState<number | null>(null);

  const [previewStudent, setPreviewStudent] = useState<{ id: number; name: string } | null>(null);
  const [annualStudent, setAnnualStudent] = useState<{ id: number; name: string } | null>(null);

  // ── Roster ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setStudentsLoading(true);
    CourseApiService.getCourseStudents(courseId)
      .then((res) => {
        if (cancelled) return;
        const rawStudents: any[] = res.data ?? [];
        const entries: RosterStudent[] = rawStudents
          .map((s: any) => {
            const uid = s.user?.id ?? s.user?.user_id ?? s.student_id ?? 0;
            const fn = s.profile?.first_name ?? s.user?.first_name ?? "";
            const ln = s.profile?.last_name ?? s.user?.last_name ?? "";
            return { student_id: uid, name: `${fn} ${ln}`.trim() || `Student #${uid}` };
          })
          .filter((s) => s.student_id);
        setStudents(entries);
      })
      .catch(() => {
        if (!cancelled) toast.error("Failed to load the class roster.");
      })
      .finally(() => {
        if (!cancelled) setStudentsLoading(false);
      });
    return () => { cancelled = true; };
  }, [courseId]);

  // ── Subject overview: status + this-subject score per student ────────────
  const fetchOverview = useCallback(async () => {
    if (!term || !academicYear || students.length === 0) return;
    setOverviewLoading(true);
    try {
      const res = await ReportCardApiService.getSubjectOverview({
        subject_id: courseId,
        term,
        academic_year: academicYear,
        student_ids: students.map((s) => s.student_id),
      });
      setOverview(new Map(res.data.students.map((s) => [s.student_id, s])));
    } catch {
      toast.error("Failed to load report-card statuses.");
    } finally {
      setOverviewLoading(false);
    }
  }, [courseId, term, academicYear, students]);

  useEffect(() => { fetchOverview(); }, [fetchOverview]);

  const classAverage = useMemo(() => {
    const scores = Array.from(overview.values()).map((s) => s.total_score).filter((v): v is number => v != null);
    if (scores.length === 0) return null;
    return parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2));
  }, [overview]);
  const avgLetter = classAverage != null ? scoreToLetterGrade(classAverage) : null;

  // ── Status lifecycle actions ───────────────────────────────────────────────
  const handleMarkComplete = async (studentId: number) => {
    const row = overview.get(studentId);
    if (!row?.report_card_id) return;
    setMarkingCompleteId(studentId);
    try {
      await ReportCardApiService.updateStatus(row.report_card_id, "saved");
      toast.success("Marked as complete — ready for admin review.");
      setOverview((prev) => new Map(prev).set(studentId, { ...row, status: "saved" }));
    } catch {
      toast.error("Failed to mark as complete.");
    } finally {
      setMarkingCompleteId(null);
    }
  };

  const handleApprove = async (studentId: number) => {
    const row = overview.get(studentId);
    if (!row?.report_card_id) return;
    setApprovingId(studentId);
    try {
      await ReportCardApiService.updateStatus(row.report_card_id, "approved");
      toast.success("Report card approved.");
      setOverview((prev) => new Map(prev).set(studentId, { ...row, status: "approved" }));
    } catch {
      toast.error("Failed to approve.");
    } finally {
      setApprovingId(null);
    }
  };

  const handleRevert = async (studentId: number) => {
    const row = overview.get(studentId);
    if (!row?.report_card_id) return;
    setRevertingId(studentId);
    try {
      await ReportCardApiService.updateStatus(row.report_card_id, "saved");
      toast.success("Reverted to Saved.");
      setOverview((prev) => new Map(prev).set(studentId, { ...row, status: "saved" }));
    } catch {
      toast.error("Failed to revert.");
    } finally {
      setRevertingId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header stats */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40">
            <Users className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <span className="text-sm text-blue-700 dark:text-blue-300">
              <strong className="font-semibold">{students.length}</strong> enrolled
            </span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/40">
            <TrendingUp className="w-4 h-4 text-gray-600 dark:text-gray-400 flex-shrink-0" />
            <span className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
              Class average:{" "}
              <strong className="font-semibold text-text-primary-light dark:text-text-primary-dark">
                {classAverage != null ? `${classAverage} (${avgLetter!.letter})` : "—"}
              </strong>
            </span>
          </div>
        </div>

        {manageHref && (
          <Link
            to={manageHref}
            className="flex items-center gap-1.5 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline"
          >
            Open Report Card Builder <ChevronRight className="w-4 h-4" />
          </Link>
        )}
      </div>

      {/* Class progress */}
      {students.length > 0 && !overviewLoading && (
        <ProgressSummary total={students.length} statuses={students.map((s) => overview.get(s.student_id)?.status ?? null)} />
      )}

      {/* Student roster */}
      <div className="rounded-2xl border border-white dark:border-border-dark/30 overflow-hidden bg-card-light dark:bg-card-dark/30">
        <div className="px-5 py-3.5 border-b border-border-light dark:border-border-dark/30 flex items-center justify-between">
          <span className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">Students</span>
          <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark/60">{students.length}</span>
        </div>

        {studentsLoading ? (
          <div className="flex items-center justify-center py-14">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        ) : students.length === 0 ? (
          <div className="text-center py-14">
            <Users className="w-10 h-10 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
            <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark/60">No students enrolled in this subject.</p>
          </div>
        ) : (
          <div className="divide-y divide-border-light dark:divide-border-dark/20">
            <AnimatePresence>
              {students.map((student) => {
                const row = overview.get(student.student_id);
                const status = row?.status ?? null;
                const score = row?.total_score ?? null;
                const letter = score != null ? scoreToLetterGrade(score).letter : null;
                return (
                  <motion.div
                    key={student.student_id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 hover:bg-surface-light dark:hover:bg-surface-dark/40 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {student.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark truncate">{student.name}</p>
                        <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark/60">
                          {score != null ? `${score} · Grade ${letter}` : "No score yet"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {overviewLoading ? (
                        <div className="h-6 w-20 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
                      ) : (
                        <StatusBadge status={status} />
                      )}

                      {row?.report_card_id && (
                        <Tooltip label="Preview report card">
                          <button
                            onClick={() => setPreviewStudent({ id: student.student_id, name: student.name })}
                            aria-label="Preview report card"
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-text-secondary-light dark:text-text-secondary-dark hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </Tooltip>
                      )}

                      <Tooltip label="Annual summary (all terms)">
                        <button
                          onClick={() => setAnnualStudent({ id: student.student_id, name: student.name })}
                          aria-label="Annual summary"
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                        >
                          <GraduationCap className="w-3.5 h-3.5" />
                        </button>
                      </Tooltip>

                      {status === "draft" && row?.report_card_id && (
                        <button
                          onClick={() => handleMarkComplete(student.student_id)}
                          disabled={markingCompleteId === student.student_id}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800/50 disabled:opacity-50 transition-colors"
                        >
                          {markingCompleteId === student.student_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                          <span className="hidden sm:inline">Done</span>
                        </button>
                      )}

                      {isAdmin && status === "saved" && (
                        <button
                          onClick={() => handleApprove(student.student_id)}
                          disabled={approvingId === student.student_id}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-50 transition-colors"
                        >
                          {approvingId === student.student_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ThumbsUp className="w-3.5 h-3.5" />}
                          <span className="hidden sm:inline">Approve</span>
                        </button>
                      )}

                      {isAdmin && status === "approved" && (
                        <Tooltip label="Revert to Saved">
                          <button
                            onClick={() => handleRevert(student.student_id)}
                            disabled={revertingId === student.student_id}
                            aria-label="Revert to Saved"
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-800/50 disabled:opacity-50 transition-colors"
                          >
                            {revertingId === student.student_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                          </button>
                        </Tooltip>
                      )}

                      <ChevronRight className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 flex-shrink-0" />
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Preview modal */}
      <AnimatePresence>
        {previewStudent && (
          <ReportCardPreview
            studentId={previewStudent.id}
            studentName={previewStudent.name}
            term={term}
            academicYear={academicYear}
            onClose={() => setPreviewStudent(null)}
          />
        )}
      </AnimatePresence>

      {/* Annual summary modal */}
      {annualStudent && (
        <AnnualReportCardPreview
          isOpen={!!annualStudent}
          onClose={() => setAnnualStudent(null)}
          studentId={annualStudent.id}
          studentName={annualStudent.name}
          academicYear={academicYear}
        />
      )}
    </div>
  );
}

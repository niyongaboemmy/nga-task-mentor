import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useSearchParams, useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Users,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  CheckCircle2,
  Eye,
  ThumbsUp,
  RotateCcw,
  GraduationCap,
  TrendingUp,
  FileText,
} from "lucide-react";
import { toast } from "react-toastify";
import { CourseApiService } from "../services/courseApi";
import axiosConfig from "../utils/axiosConfig";
import { usePermissions } from "../hooks/usePermissions";
import { useAuth } from "../contexts/AuthContext";
import { getAcademicTerms, getAcademicYears } from "../services/authService";
import ReportCardBuilder, { type SubjectOption } from "../components/ReportCard/ReportCardBuilder";
import ReportCardPreview from "../components/ReportCard/ReportCardPreview";
import AnnualReportCardPreview from "../components/ReportCard/AnnualReportCardPreview";
import {
  ReportCardApiService,
  scoreToLetterGrade,
  STATUS_META,
  type AssessmentCategory,
  type SubjectMappingItem,
  type ReportCardStatus,
  type StudentSubjectScore,
} from "../services/reportCardApi";
import {
  ManualAssessmentApiService,
  type ManualAssessment,
} from "../services/manualAssessmentApi";
import type { StudentEntry } from "../components/ReportCard/ManualAssessmentModal";

// ─── Page ─────────────────────────────────────────────────────────────────────
// The one-stop dashboard for a subject's report-card picture: class average,
// per-student status/score, and — collapsed by default once a mapping
// exists — the drag-drop builder to (re)map assessments into CW/HW/MD/EOT.
// Replaces the old standalone ReportCardBuilderPage + the heavy
// CourseReportCardsPanel that used to live inside Course Details.

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

interface RosterStudent extends StudentEntry {
  name: string;
}

export default function SubjectGradesPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [searchParams] = useSearchParams();
  const { user: authUser } = useAuth();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const isAdmin = can("REPORT_CARDS_APPROVE");

  const term = searchParams.get("term") ?? authUser?.currentAcademicTerm?.name ?? "";
  const academicYear = searchParams.get("year") ?? authUser?.currentAcademicYear?.name ?? "";

  const [subject, setSubject] = useState<SubjectOption | null>(null);
  const [students, setStudents] = useState<RosterStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [initialMappings, setInitialMappings] = useState<SubjectMappingItem[]>([]);
  const [mappingLoading, setMappingLoading] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);

  const [overview, setOverview] = useState<Map<number, StudentSubjectScore>>(new Map());
  const [overviewLoading, setOverviewLoading] = useState(false);

  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [revertingId, setRevertingId] = useState<number | null>(null);
  const [markingCompleteId, setMarkingCompleteId] = useState<number | null>(null);

  const [previewStudent, setPreviewStudent] = useState<{ id: number; name: string } | null>(null);
  const [annualStudent, setAnnualStudent] = useState<{ id: number; name: string } | null>(null);

  // ── Load course + assessments + roster ────────────────────────────────────
  useEffect(() => {
    if (!courseId) return;
    const id = parseInt(courseId, 10);

    (async () => {
      setLoading(true);
      setError(null);
      try {
        let academicTermId: number | undefined;
        try {
          if (academicYear && term) {
            const years = await getAcademicYears();
            const matchedYear = years.find((y) => y.name === academicYear);
            if (matchedYear) {
              const terms = await getAcademicTerms(matchedYear.academic_year_id);
              academicTermId = terms.find((t) => t.name === term)?.academic_term_id;
            }
          }
        } catch {
          // best-effort — endpoints below fall back to session-current term
        }

        const [courseRes, quizzesRes, assignmentsRes, studentsRes, manualsRes] = await Promise.all([
          CourseApiService.getCourse(id),
          CourseApiService.getCourseQuizzes(id, academicTermId),
          axiosConfig
            .get(`/courses/${id}/assignments`, {
              params: academicTermId ? { academic_term_id: academicTermId } : undefined,
            })
            .then((r) => r.data),
          CourseApiService.getCourseStudents(id).catch(() => ({ data: [] })),
          ManualAssessmentApiService.list({ course_id: id, term, academic_year: academicYear }).catch(
            () => ({ success: true, data: [] as ManualAssessment[] }),
          ),
        ]);

        const rawStudents: any[] = studentsRes.data ?? [];
        const entries: RosterStudent[] = rawStudents
          .map((s: any) => {
            const uid = s.user?.id ?? s.user?.user_id ?? s.student_id ?? 0;
            const fn = s.profile?.first_name ?? s.user?.first_name ?? "";
            const ln = s.profile?.last_name ?? s.user?.last_name ?? "";
            return { student_id: uid, name: `${fn} ${ln}`.trim() || `Student #${uid}` };
          })
          .filter((s) => s.student_id);
        setStudents(entries);

        const fetchedManuals: ManualAssessment[] = manualsRes.data ?? [];

        setSubject({
          id,
          name: courseRes.data.title ?? `Course #${id}`,
          quizzes: (quizzesRes.data ?? []).map((q: any) => ({ id: q.id, title: q.title })),
          assignments: ((assignmentsRes as any).data ?? []).map((a: any) => ({ id: a.id, title: a.title })),
          manualAssessments: fetchedManuals,
        });
      } catch {
        setError("Failed to load subject data. Please go back and try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, [courseId, term, academicYear]);

  // ── Existing subject-wide mapping (pre-populates the builder) ─────────────
  useEffect(() => {
    if (!subject || !term || !academicYear) return;
    (async () => {
      setMappingLoading(true);
      try {
        const res = await ReportCardApiService.getSubjectMapping({ subject_id: subject.id, term, academic_year: academicYear });
        const mappings = res.data.assessments ?? [];
        setInitialMappings(mappings);
        // No mapping yet → open the builder by default so there's nothing more to click.
        setBuilderOpen(mappings.length === 0);
      } catch {
        setInitialMappings([]);
        setBuilderOpen(true);
      } finally {
        setMappingLoading(false);
      }
    })();
  }, [subject, term, academicYear]);

  // ── Subject overview: status + this-subject score per student ────────────
  const fetchOverview = useCallback(async () => {
    if (!subject || !term || !academicYear || students.length === 0) return;
    setOverviewLoading(true);
    try {
      const res = await ReportCardApiService.getSubjectOverview({
        subject_id: subject.id,
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
  }, [subject, term, academicYear, students]);

  useEffect(() => { fetchOverview(); }, [fetchOverview]);

  const classAverage = useMemo(() => {
    const scores = Array.from(overview.values()).map((s) => s.total_score).filter((v): v is number => v != null);
    if (scores.length === 0) return null;
    return parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2));
  }, [overview]);

  // ── Shape initialMappings into the builder's dropped-item structure ───────
  const initialDropped = useMemo<
    Partial<Record<AssessmentCategory, Array<{ dndId: string; assessment_id: number; assessment_type: "quiz" | "assignment" | "manual"; title: string; subject_id: number }>>>
  >(() => {
    if (!subject || initialMappings.length === 0) return {};
    const dropped: Record<AssessmentCategory, any[]> = { CW: [], HW: [], MD: [], EOT: [] };
    const allItems = [
      ...subject.quizzes.map((q) => ({ id: q.id, title: q.title, type: "quiz" as const })),
      ...subject.assignments.map((a) => ({ id: a.id, title: a.title, type: "assignment" as const })),
      ...subject.manualAssessments.map((m) => ({ id: m.id, title: m.title, type: "manual" as const })),
    ];
    for (const mapping of initialMappings) {
      const found = allItems.find((i) => i.id === mapping.assessment_id && i.type === mapping.assessment_type);
      if (found) {
        dropped[mapping.category].push({
          dndId: `${mapping.assessment_type}-${mapping.assessment_id}`,
          assessment_id: mapping.assessment_id,
          assessment_type: mapping.assessment_type,
          title: found.title,
          subject_id: subject.id,
        });
      }
    }
    return dropped;
  }, [subject, initialMappings]);

  const onBuilderSaved = (studentsUpdated: number) => {
    toast.success(`Applied to ${studentsUpdated} enrolled student${studentsUpdated !== 1 ? "s" : ""}.`);
    fetchOverview();
  };

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

  // ── Render guards ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark/70">Loading subject grades…</p>
        </div>
      </div>
    );
  }

  if (error || !subject) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="flex flex-col items-center gap-4 max-w-sm text-center">
          <div className="w-14 h-14 rounded-2xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800/50 flex items-center justify-center">
            <AlertCircle className="w-7 h-7 text-orange-500" />
          </div>
          <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark/70">{error ?? "Could not load this subject."}</p>
          <Link to="/grades" className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline text-sm">
            <ArrowLeft className="w-4 h-4" /> Back to Grades
          </Link>
        </div>
      </div>
    );
  }

  const avgLetter = classAverage != null ? scoreToLetterGrade(classAverage) : null;

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <button
        onClick={() => navigate("/grades")}
        className="flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:underline"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Grades
      </button>

      {/* Header */}
      <div className="bg-card-light dark:bg-card-dark/30 rounded-2xl border border-white dark:border-border-dark/30 p-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark/60 uppercase tracking-widest font-medium mb-1">
            Report card dashboard
          </p>
          <h1 className="text-xl sm:text-2xl font-bold text-text-primary-light dark:text-text-primary-dark">{subject.name}</h1>
          <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark/70 mt-1">{term} · {academicYear}</p>
        </div>

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
      </div>

      {/* Build Mapping — collapsible */}
      <div className="rounded-2xl border border-white dark:border-border-dark/30 overflow-hidden">
        <button
          onClick={() => setBuilderOpen((o) => !o)}
          className="w-full flex items-center justify-between gap-3 px-5 py-4 bg-card-light dark:bg-card-dark/30 hover:bg-surface-light/60 dark:hover:bg-surface-dark/40 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <ClipboardList className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
              Build Mapping
            </span>
            {initialMappings.length > 0 && (
              <span className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-full px-2 py-0.5">
                <CheckCircle2 className="w-3 h-3" /> {initialMappings.length} mapped
              </span>
            )}
          </div>
          <ChevronDown className={`w-4 h-4 text-text-secondary-light dark:text-text-secondary-dark/60 transition-transform ${builderOpen ? "rotate-180" : ""}`} />
        </button>

        <AnimatePresence initial={false}>
          {builderOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-[#060A12] overflow-hidden"
            >
              {mappingLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                </div>
              ) : (
                <ReportCardBuilder
                  term={term}
                  academicYear={academicYear}
                  subjects={[subject]}
                  initialDropped={initialDropped}
                  onSaved={onBuilderSaved}
                  students={students}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
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

        {students.length === 0 ? (
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
                        <button
                          onClick={() => setPreviewStudent({ id: student.student_id, name: student.name })}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-text-secondary-light dark:text-text-secondary-dark hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                          title="Preview report card"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        onClick={() => setAnnualStudent({ id: student.student_id, name: student.name })}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                        title="Annual summary"
                      >
                        <GraduationCap className="w-3.5 h-3.5" />
                      </button>

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
                        <button
                          onClick={() => handleRevert(student.student_id)}
                          disabled={revertingId === student.student_id}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-800/50 disabled:opacity-50 transition-colors"
                        >
                          {revertingId === student.student_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                        </button>
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

      {/* Class attributes shortcut */}
      {students.length > 0 && term && academicYear && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-800/40">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0">
              <FileText className="w-4.5 h-4.5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">Class Teacher Attributes</p>
              <p className="text-xs text-blue-500 dark:text-blue-400 mt-0.5 leading-relaxed">
                Fill attendance, behavior ratings and teacher comments for all students at once
              </p>
            </div>
          </div>
          <Link
            to={`/courses/${courseId}/report-card-attributes?term=${encodeURIComponent(term)}&year=${encodeURIComponent(academicYear)}`}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-sm active:scale-95 whitespace-nowrap flex-shrink-0"
          >
            Open <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      )}

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

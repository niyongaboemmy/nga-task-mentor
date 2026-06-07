import { useState, useEffect, useMemo } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle2,
  BookOpen,
  ClipboardList,
  FileText,
  ThumbsUp,
  RotateCcw,
  ChevronRight,
  Info,
} from "lucide-react";
import { toast } from "react-toastify";
import { CourseApiService } from "../services/courseApi";
import axiosConfig from "../utils/axiosConfig";
import ReportCardBuilder, { type SubjectOption } from "../components/ReportCard/ReportCardBuilder";
import {
  ReportCardApiService,
  STATUS_META,
  type AssessmentCategory,
  type AssessmentItem,
  type ReportCardStatus,
} from "../services/reportCardApi";
import { useAuth } from "../contexts/AuthContext";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: ReportCardStatus | null }) {
  if (!status) return null;
  const m = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${m.color} ${m.bg} ${m.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

// ─── Guided step header ───────────────────────────────────────────────────────

const STEPS = [
  { id: 1, icon: ClipboardList, label: "Map Assessments", desc: "Drag assessments into CW / HW / MD / EOT" },
  { id: 2, icon: FileText,      label: "Attributes",     desc: "Attendance, behavior, teacher comment" },
  { id: 3, icon: ThumbsUp,      label: "Approve",        desc: "Admin reviews and approves for student" },
];

function StepIndicator({ currentStep }: { currentStep: 1 | 2 | 3 }) {
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((step, idx) => {
        const done = step.id < currentStep;
        const active = step.id === currentStep;
        return (
          <div key={step.id} className="flex items-center">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all
              ${active ? "bg-white/15 border border-white/30" : "opacity-50"}`}
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                ${done ? "bg-emerald-500 text-white" : active ? "bg-indigo-400 text-white" : "bg-white/20 text-white/60"}`}
              >
                {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : step.id}
              </div>
              <div className="hidden sm:block">
                <p className="text-xs font-semibold text-white leading-tight">{step.label}</p>
                <p className="text-[10px] text-white/50 leading-tight">{step.desc}</p>
              </div>
            </div>
            {idx < STEPS.length - 1 && (
              <ChevronRight className="w-4 h-4 text-white/20 mx-1 flex-shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Subject context panel ────────────────────────────────────────────────────

function SubjectContextPanel({
  courseName,
  otherSubjectIds,
  subjectIdToName,
}: {
  courseName: string;
  otherSubjectIds: number[];
  subjectIdToName: Map<number, string>;
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Info className="w-4 h-4 text-indigo-300" />
        <span className="text-sm font-semibold text-white/80">Report card context</span>
      </div>

      {/* Current subject */}
      <div className="flex items-center gap-3 p-3 rounded-xl bg-indigo-500/20 border border-indigo-400/30">
        <BookOpen className="w-4 h-4 text-indigo-300 flex-shrink-0" />
        <div>
          <p className="text-xs text-indigo-200/70">You are mapping assessments for</p>
          <p className="text-sm font-semibold text-white">{courseName}</p>
        </div>
        <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/40 text-indigo-200 font-medium">
          This subject
        </span>
      </div>

      {/* Other subjects already in the card */}
      {otherSubjectIds.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] text-white/40 uppercase tracking-wider font-medium">
            Already mapped by other instructors
          </p>
          {otherSubjectIds.map((sid) => (
            <div key={sid} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <span className="text-xs text-white/70">
                {subjectIdToName.get(sid) ?? `Subject #${sid}`}
              </span>
            </div>
          ))}
        </div>
      )}

      {otherSubjectIds.length === 0 && (
        <p className="text-xs text-white/40 px-1">
          You are the first instructor to contribute to this report card.
          Others can add their subjects after you save.
        </p>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReportCardBuilderPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [searchParams] = useSearchParams();
  const { user: authUser } = useAuth();

  const studentId   = parseInt(searchParams.get("studentId") ?? "0", 10);
  const term        = searchParams.get("term") ?? authUser?.currentAcademicTerm?.name ?? "";
  const academicYear = searchParams.get("year") ?? authUser?.currentAcademicYear?.name ?? "";

  // ── Load course assets ────────────────────────────────────────────────────
  const [subject, setSubject] = useState<SubjectOption | null>(null);
  const [studentName, setStudentName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Existing report card state (for pre-population & status display) ──────
  const [reportCardId, setReportCardId] = useState<number | null>(null);
  const [rcStatus, setRcStatus] = useState<ReportCardStatus | null>(null);
  const [initialMappings, setInitialMappings] = useState<AssessmentItem[]>([]);
  const [allMappedSubjectIds, setAllMappedSubjectIds] = useState<number[]>([]);
  const [rcLoading, setRcLoading] = useState(false);

  // ── Status change ─────────────────────────────────────────────────────────
  const [statusChanging, setStatusChanging] = useState(false);

  const isAdmin = authUser?.role === "admin";
  const isInstructor = authUser?.role === "instructor";

  // ── Fetch course + quizzes + assignments ──────────────────────────────────
  useEffect(() => {
    if (!courseId) return;
    const id = parseInt(courseId, 10);

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [courseRes, quizzesRes, assignmentsRes] = await Promise.all([
          CourseApiService.getCourse(id),
          CourseApiService.getCourseQuizzes(id),
          axiosConfig.get(`/courses/${id}/assignments`).then((r) => r.data),
        ]);

        setSubject({
          id,
          name: courseRes.data.title ?? `Course #${id}`,
          quizzes: (quizzesRes.data ?? []).map((q: any) => ({ id: q.id, title: q.title })),
          assignments: ((assignmentsRes as any).data ?? []).map((a: any) => ({ id: a.id, title: a.title })),
        });

        // Try to find the student name from course enrollment
        try {
          const studentsRes = await CourseApiService.getCourseStudents(id);
          const found = (studentsRes.data ?? []).find(
            (s: any) => (s.user?.id || s.user?.user_id) === studentId,
          );
          if (found) {
            const fn = found.profile?.first_name || found.user?.first_name || "";
            const ln = found.profile?.last_name  || found.user?.last_name  || "";
            setStudentName(`${fn} ${ln}`.trim());
          }
        } catch {
          // non-fatal — name display degrades gracefully
        }
      } catch {
        setError("Failed to load course data. Please go back and try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, [courseId, studentId]);

  // ── Fetch existing report card to pre-populate builder ────────────────────
  useEffect(() => {
    if (!studentId || !term || !academicYear) return;

    (async () => {
      setRcLoading(true);
      try {
        const res = await ReportCardApiService.getStudentReportCard(studentId, {
          term,
          academic_year: academicYear,
        });
        const rc = res.data.report_card;
        setReportCardId(rc.id);
        setRcStatus(rc.status);
        setInitialMappings(res.data.raw_assessments ?? []);

        // Which subject_ids are already in the card (from all instructors)?
        const ids = [...new Set((res.data.raw_assessments ?? []).map((a) => a.subject_id))];
        setAllMappedSubjectIds(ids);
      } catch {
        // 404 = no card yet; that is fine — builder will create it on first save
        setReportCardId(null);
        setRcStatus(null);
        setInitialMappings([]);
        setAllMappedSubjectIds([]);
      } finally {
        setRcLoading(false);
      }
    })();
  }, [studentId, term, academicYear]);

  // ── Pre-populate builder: only this subject's existing mappings ───────────
  const initialDropped = useMemo<Partial<Record<AssessmentCategory, Array<{ dndId: string; assessment_id: number; assessment_type: "quiz" | "assignment"; title: string; subject_id: number }>>>>(() => {
    if (!subject || initialMappings.length === 0) return {};
    const mine = initialMappings.filter((m) => m.subject_id === subject.id);
    if (mine.length === 0) return {};

    const dropped: Record<AssessmentCategory, any[]> = { CW: [], HW: [], MD: [], EOT: [] };

    for (const mapping of mine) {
      const allItems = [
        ...subject.quizzes.map((q) => ({ id: q.id, title: q.title, type: "quiz" as const })),
        ...subject.assignments.map((a) => ({ id: a.id, title: a.title, type: "assignment" as const })),
      ];
      const found = allItems.find(
        (i) => i.id === mapping.assessment_id && i.type === mapping.assessment_type,
      );
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

  // ── Other subjects already mapped (not this course) ───────────────────────
  const otherSubjectIds = useMemo(
    () => allMappedSubjectIds.filter((id) => id !== parseInt(courseId ?? "0", 10)),
    [allMappedSubjectIds, courseId],
  );

  // Map of subject_id → name — we only know this course's name right now
  const subjectIdToName = useMemo(() => {
    const m = new Map<number, string>();
    if (subject) m.set(subject.id, subject.name);
    return m;
  }, [subject]);

  // ── Status change handlers ────────────────────────────────────────────────
  const changeStatus = async (newStatus: ReportCardStatus) => {
    if (!reportCardId) {
      toast.error("Save the report card first before changing its status.");
      return;
    }
    setStatusChanging(true);
    try {
      await ReportCardApiService.updateStatus(reportCardId, newStatus);
      setRcStatus(newStatus);
      toast.success(`Status updated to "${STATUS_META[newStatus].label}".`);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Failed to update status.");
    } finally {
      setStatusChanging(false);
    }
  };

  const onBuilderSaved = (cardId: number) => {
    setReportCardId(cardId);
    if (!rcStatus) setRcStatus("draft");
    // Re-fetch to get updated allMappedSubjectIds
    ReportCardApiService.getStudentReportCard(studentId, { term, academic_year: academicYear })
      .then((res) => {
        const ids = [...new Set((res.data.raw_assessments ?? []).map((a) => a.subject_id))];
        setAllMappedSubjectIds(ids);
        setInitialMappings(res.data.raw_assessments ?? []);
      })
      .catch(() => {});
  };

  // ── Derived step for indicator ────────────────────────────────────────────
  const currentStep: 1 | 2 | 3 =
    rcStatus === "approved" ? 3 :
    rcStatus === "saved"    ? 2 :
    1;

  // ── Render guards ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-white/70">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
          <p className="text-sm">Loading course assessments…</p>
        </div>
      </div>
    );
  }

  if (error || !subject || !studentId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-white/70">
          <AlertCircle className="w-10 h-10 text-red-400" />
          <p className="text-sm text-red-300 max-w-sm text-center">
            {error ?? "Missing student ID. Navigate here from the Students tab inside a course."}
          </p>
          <Link to={`/courses/${courseId}`} className="flex items-center gap-2 text-indigo-300 hover:text-indigo-200 text-sm">
            <ArrowLeft className="w-4 h-4" /> Back to course
          </Link>
        </div>
      </div>
    );
  }

  const attrUrl = `/courses/${courseId}/report-card-attributes${term && academicYear ? `?term=${encodeURIComponent(term)}&year=${encodeURIComponent(academicYear)}` : ""}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900">

      {/* ── Top navigation bar ── */}
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-slate-900/80 border-b border-white/10 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Back + breadcrumb */}
          <div className="flex items-center gap-3">
            <Link
              to={`/courses/${courseId}#report-cards`}
              className="flex items-center gap-1.5 text-sm text-indigo-300 hover:text-indigo-200 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">{subject.name}</span>
              <span className="sm:hidden">Back</span>
            </Link>
            <span className="text-white/20">/</span>
            <span className="text-sm text-white/60">Report Card Builder</span>
          </div>

          {/* Step indicator */}
          <StepIndicator currentStep={currentStep} />
        </div>
      </div>

      {/* ── Student + status banner ── */}
      <div className="px-4 pt-5 pb-3">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-wrap items-start justify-between gap-4
            bg-white/5 border border-white/10 rounded-2xl px-5 py-4">

            {/* Student info */}
            <div>
              <p className="text-xs text-white/40 uppercase tracking-wider font-medium mb-1">
                Building report card for
              </p>
              <h1 className="text-xl font-bold text-white">
                {studentName || `Student #${studentId}`}
              </h1>
              <p className="text-sm text-white/50 mt-0.5">
                {term} · {academicYear}
              </p>
            </div>

            {/* Status + actions */}
            <div className="flex flex-col items-end gap-3">
              <div className="flex items-center gap-2">
                {rcLoading ? (
                  <div className="h-6 w-20 rounded-full bg-white/10 animate-pulse" />
                ) : (
                  <StatusPill status={rcStatus} />
                )}
              </div>

              {/* Status action buttons */}
              {!rcLoading && reportCardId && (
                <div className="flex items-center gap-2">
                  {/* Instructor: mark complete (saved) */}
                  {(isInstructor || isAdmin) && rcStatus === "draft" && (
                    <button
                      onClick={() => changeStatus("saved")}
                      disabled={statusChanging}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
                        bg-blue-500/20 border border-blue-400/40 text-blue-300
                        hover:bg-blue-500/30 disabled:opacity-40 transition-all"
                    >
                      {statusChanging ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      Mark as Complete
                    </button>
                  )}

                  {/* Instructor: revert to draft */}
                  {(isInstructor || isAdmin) && rcStatus === "saved" && (
                    <button
                      onClick={() => changeStatus("draft")}
                      disabled={statusChanging}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium
                        bg-white/10 border border-white/20 text-white/60
                        hover:bg-white/15 disabled:opacity-40 transition-all"
                    >
                      {statusChanging ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                      Revert to Draft
                    </button>
                  )}

                  {/* Admin: approve */}
                  {isAdmin && rcStatus === "saved" && (
                    <button
                      onClick={() => changeStatus("approved")}
                      disabled={statusChanging}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
                        bg-emerald-500/20 border border-emerald-400/40 text-emerald-300
                        hover:bg-emerald-500/30 disabled:opacity-40 transition-all"
                    >
                      {statusChanging ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ThumbsUp className="w-3.5 h-3.5" />}
                      Approve
                    </button>
                  )}

                  {/* Admin: revert approved */}
                  {isAdmin && rcStatus === "approved" && (
                    <button
                      onClick={() => changeStatus("saved")}
                      disabled={statusChanging}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium
                        bg-orange-500/10 border border-orange-400/30 text-orange-300
                        hover:bg-orange-500/20 disabled:opacity-40 transition-all"
                    >
                      {statusChanging ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                      Revert Approval
                    </button>
                  )}
                </div>
              )}

              {/* Approved lock notice */}
              {rcStatus === "approved" && !isAdmin && (
                <p className="text-xs text-emerald-300/70 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Approved — student can now view this report card
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Main content: subject context + builder ── */}
      <div className="px-4 pb-8">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5">

          {/* Left: context sidebar */}
          <div className="space-y-4">
            <SubjectContextPanel
              courseName={subject.name}
              otherSubjectIds={otherSubjectIds}
              subjectIdToName={subjectIdToName}
            />

            {/* Next-step callout */}
            <AnimatePresence>
              {rcStatus && rcStatus !== "approved" && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2"
                >
                  <p className="text-xs text-white/50 font-medium uppercase tracking-wider">Next step</p>
                  {rcStatus === "draft" && (
                    <>
                      <p className="text-sm text-white/70">
                        Once all instructors have mapped their subjects, fill attendance and behavior attributes.
                      </p>
                      <Link
                        to={attrUrl}
                        className="flex items-center gap-2 mt-2 text-sm text-blue-300 hover:text-blue-200 font-medium transition-colors"
                      >
                        <FileText className="w-4 h-4" />
                        Go to Class Attributes
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </>
                  )}
                  {rcStatus === "saved" && (
                    <p className="text-sm text-white/70">
                      {isAdmin
                        ? "This card is ready for your review. Click Approve above to publish it to the student."
                        : "Waiting for admin approval. Once approved, the student can view and download the report card."}
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right: the drag-drop builder */}
          <div className="min-w-0">
            <ReportCardBuilder
              studentId={studentId}
              term={term}
              academicYear={academicYear}
              subjects={[subject]}
              initialDropped={initialDropped}
              onSaved={onBuilderSaved}
              readOnly={rcStatus === "approved" && !isAdmin}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

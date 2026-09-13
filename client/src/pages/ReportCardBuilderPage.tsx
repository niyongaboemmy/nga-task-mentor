import { useState, useEffect, useMemo } from "react";
import { useParams, useSearchParams, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Users,
  FileText,
  ChevronRight,
  Info,
} from "lucide-react";
import { CourseApiService } from "../services/courseApi";
import axiosConfig from "../utils/axiosConfig";
import ReportCardBuilder, {
  type SubjectOption,
} from "../components/ReportCard/ReportCardBuilder";
import {
  ReportCardApiService,
  type AssessmentCategory,
  type SubjectMappingItem,
} from "../services/reportCardApi";
import {
  ManualAssessmentApiService,
  type ManualAssessment,
} from "../services/manualAssessmentApi";
import type { StudentEntry } from "../components/ReportCard/ManualAssessmentModal";
import { useAuth } from "../contexts/AuthContext";
import { getAcademicTerms, getAcademicYears } from "../services/authService";

// ─── Page ─────────────────────────────────────────────────────────────────────
// Subject-scoped report card builder: an instructor maps their subject's
// assessments into CW/HW/MD/EOT ONCE for a term/year, and that mapping is
// applied automatically to every student enrolled in the subject (fan-out
// happens server-side in saveSubjectMapping). There is no per-student picker
// here anymore — per-student concerns (attendance/behavior attributes, and
// approving/reverting an individual student's card) live in
// GeneralAttributesPage and CourseReportCardsPanel respectively.

export default function ReportCardBuilderPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [searchParams] = useSearchParams();
  const { user: authUser } = useAuth();
  const navigate = useNavigate();

  const term =
    searchParams.get("term") ?? authUser?.currentAcademicTerm?.name ?? "";
  const academicYear =
    searchParams.get("year") ?? authUser?.currentAcademicYear?.name ?? "";

  // ── Load course assets ────────────────────────────────────────────────────
  const [subject, setSubject] = useState<SubjectOption | null>(null);
  const [enrolledCount, setEnrolledCount] = useState<number>(0);
  const [enrolledStudents, setEnrolledStudents] = useState<StudentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Existing subject mapping (for pre-population) ──────────────────────────
  const [initialMappings, setInitialMappings] = useState<SubjectMappingItem[]>([]);
  const [mappingLoading, setMappingLoading] = useState(false);

  // ── Save result banner ─────────────────────────────────────────────────────
  const [lastSaveResult, setLastSaveResult] = useState<number | null>(null);

  // ── Fetch course + quizzes + assignments + manual assessments + students ────
  useEffect(() => {
    if (!courseId) return;
    const id = parseInt(courseId, 10);

    (async () => {
      setLoading(true);
      setError(null);
      try {
        // Resolve the real academic_term_id from the term/year NAME strings
        // carried in the URL, since quizzes/assignments scope by id and
        // otherwise silently default to the caller's session-current term.
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
        } catch (resolveErr) {
          console.error("Could not resolve academic_term_id for report card builder:", resolveErr);
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
          ManualAssessmentApiService.list({
            course_id: id,
            term,
            academic_year: academicYear,
          }).catch(() => ({ success: true, data: [] as ManualAssessment[] })),
        ]);

        const rawStudents: any[] = studentsRes.data ?? [];
        const entries: StudentEntry[] = rawStudents.map((s: any) => {
          const uid = s.user?.id ?? s.user?.user_id ?? s.student_id ?? 0;
          const fn = s.profile?.first_name ?? s.user?.first_name ?? "";
          const ln = s.profile?.last_name ?? s.user?.last_name ?? "";
          return { student_id: uid, name: `${fn} ${ln}`.trim() || `Student #${uid}` };
        });
        setEnrolledStudents(entries);
        setEnrolledCount(entries.length);

        const fetchedManuals: ManualAssessment[] = manualsRes.data ?? [];

        setSubject({
          id,
          name: courseRes.data.title ?? `Course #${id}`,
          quizzes: (quizzesRes.data ?? []).map((q: any) => ({ id: q.id, title: q.title })),
          assignments: ((assignmentsRes as any).data ?? []).map((a: any) => ({ id: a.id, title: a.title })),
          manualAssessments: fetchedManuals,
        });
      } catch {
        setError("Failed to load course data. Please go back and try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, [courseId, term, academicYear]);

  // ── Fetch the subject's existing canonical mapping ─────────────────────────
  useEffect(() => {
    if (!subject || !term || !academicYear) return;

    (async () => {
      setMappingLoading(true);
      try {
        const res = await ReportCardApiService.getSubjectMapping({
          subject_id: subject.id,
          term,
          academic_year: academicYear,
        });
        setInitialMappings(res.data.assessments ?? []);
      } catch {
        setInitialMappings([]);
      } finally {
        setMappingLoading(false);
      }
    })();
  }, [subject, term, academicYear]);

  // ── Shape initialMappings into the builder's dropped-item structure ───────
  const initialDropped = useMemo<
    Partial<
      Record<
        AssessmentCategory,
        Array<{
          dndId: string;
          assessment_id: number;
          assessment_type: "quiz" | "assignment" | "manual";
          title: string;
          subject_id: number;
        }>
      >
    >
  >(() => {
    if (!subject || initialMappings.length === 0) return {};

    const dropped: Record<AssessmentCategory, any[]> = { CW: [], HW: [], MD: [], EOT: [] };
    const allItems = [
      ...subject.quizzes.map((q) => ({ id: q.id, title: q.title, type: "quiz" as const })),
      ...subject.assignments.map((a) => ({ id: a.id, title: a.title, type: "assignment" as const })),
      ...subject.manualAssessments.map((m) => ({ id: m.id, title: m.title, type: "manual" as const })),
    ];

    for (const mapping of initialMappings) {
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

  const onBuilderSaved = (studentsUpdated: number) => {
    setLastSaveResult(studentsUpdated);
  };

  // ── Render guards ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#060A12] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <p className="text-sm text-slate-400 dark:text-slate-500">Loading course assessments…</p>
        </div>
      </div>
    );
  }

  if (error || !subject) {
    return (
      <div className="min-h-screen bg-[#060A12] flex items-center justify-center px-4">
        <div className="flex flex-col items-center gap-4 max-w-sm text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-950/50 border border-red-800/50 flex items-center justify-center">
            <AlertCircle className="w-7 h-7 text-red-500" />
          </div>
          <p className="text-sm text-slate-400 dark:text-slate-500">
            {error ?? "Could not load this course."}
          </p>
          <Link
            to={`/courses/${courseId}`}
            className="flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to course
          </Link>
        </div>
      </div>
    );
  }

  const attrUrl = `/courses/${courseId}/report-card-attributes${term && academicYear ? `?term=${encodeURIComponent(term)}&year=${encodeURIComponent(academicYear)}` : ""}`;

  return (
    <div className="min-h-screen bg-[#060A12]">
      {/* ── Top navigation bar ── */}
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-[#060A12]/90 border-b border-white/[0.06] px-4 sm:px-6 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={() => {
                try {
                  sessionStorage.setItem(`course-tab-${courseId}`, "report-cards");
                } catch {}
                navigate(`/courses/${courseId}`);
              }}
              className="flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 transition-colors flex-shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline truncate max-w-[160px]">{subject.name}</span>
              <span className="sm:hidden">Back</span>
            </button>
            <span className="text-slate-700 dark:text-slate-300 flex-shrink-0">/</span>
            <span className="text-sm text-slate-500 dark:text-slate-400 truncate">Report Card Builder</span>
          </div>
        </div>
      </div>

      {/* ── Subject banner ── */}
      <div className="px-4 sm:px-6 pt-5 pb-3">
        <div className="max-w-[1440px] mx-auto">
          <div className="flex flex-wrap items-start justify-between gap-4 bg-[#0A1020] border border-white/[0.07] rounded-2xl px-5 py-4 sm:py-5">
            <div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 uppercase tracking-widest font-medium mb-1">
                Mapping assessments for
              </p>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                {subject.name}
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {term} · {academicYear}
              </p>
            </div>

            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-950/40 border border-blue-800/50">
              <Users className="w-4 h-4 text-blue-400 flex-shrink-0" />
              <span className="text-sm text-blue-300">
                <strong className="font-semibold text-white">{enrolledCount}</strong> student
                {enrolledCount !== 1 ? "s" : ""} enrolled
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Save result banner ── */}
      {lastSaveResult !== null && (
        <div className="px-4 sm:px-6 pb-3">
          <div className="max-w-[1440px] mx-auto">
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-3 p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800/50 text-sm text-emerald-300"
            >
              <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                Applied automatically to <strong className="font-semibold text-emerald-200">{lastSaveResult}</strong> enrolled
                student{lastSaveResult !== 1 ? "s" : ""}. Each student's report card will reflect this
                mapping as soon as their scores are recorded.
              </span>
            </motion.div>
          </div>
        </div>
      )}

      {/* ── Main content: info sidebar + builder ── */}
      <div className="px-4 sm:px-6 pb-10">
        <div className="max-w-[1440px] mx-auto grid grid-cols-1 lg:grid-cols-[300px_1fr] xl:grid-cols-[320px_1fr] gap-5">
          {/* Left: context sidebar */}
          <div className="space-y-4 lg:sticky lg:top-[60px] lg:self-start">
            <div className="bg-[#0A1020] border border-white/[0.07] rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-semibold text-white">How this works</span>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
                Map this subject's quizzes, assignments, and manual entries into CW / HW / MD / EOT
                once. Saving applies the mapping to every student currently enrolled — you don't
                need to repeat this per student.
              </p>
            </div>

            <div className="bg-[#0A1020] border border-white/[0.07] rounded-2xl p-4 space-y-2.5">
              <p className="text-[11px] text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-widest">
                Next steps
              </p>
              <p className="text-sm text-slate-400 dark:text-slate-500 leading-relaxed">
                Once assessments are mapped, the class teacher fills attendance and behavior
                attributes for the whole class.
              </p>
              <Link
                to={attrUrl}
                className="flex items-center gap-2 mt-1 text-sm text-blue-400 hover:text-blue-300 font-medium transition-colors"
              >
                <FileText className="w-4 h-4" />
                Go to Class Attributes
                <ChevronRight className="w-3.5 h-3.5 ml-auto" />
              </Link>
            </div>
          </div>

          {/* Right: the drag-drop builder */}
          <div className="min-w-0 bg-[#0A1020] border border-white/[0.07] rounded-2xl overflow-hidden">
            {mappingLoading ? (
              <div className="flex items-center justify-center py-24">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              </div>
            ) : (
              <ReportCardBuilder
                term={term}
                academicYear={academicYear}
                subjects={[subject]}
                initialDropped={initialDropped}
                onSaved={onBuilderSaved}
                students={enrolledStudents}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "react-toastify";
import { CourseApiService } from "../services/courseApi";
import {
  ManualAssessmentApiService,
  type ManualAssessment,
} from "../services/manualAssessmentApi";
import ManualScoreEntry, { type StudentEntry } from "../components/ReportCard/ManualScoreEntry";

// Full-page manual marks entry — same ManualScoreEntry component the Report
// Card Builder's "Enter scores" modal uses, just flowed on a page instead of
// inside a fixed-height modal, so the two never drift apart visually.

export default function AssessmentMarksPage() {
  const { assessmentId } = useParams<{ assessmentId: string }>();
  const navigate         = useNavigate();

  const [assessment, setAssessment] = useState<ManualAssessment | null>(null);
  const [students, setStudents]     = useState<StudentEntry[]>([]);
  const [loading, setLoading]       = useState(true);
  const [courseName, setCourseName] = useState("");

  const id = parseInt(assessmentId ?? "", 10);

  // ── Load assessment + roster ──────────────────────────────────────────────
  // There's no single GET /manual-assessments/:id endpoint, so the assessment
  // is found by listing every course's assessments and matching the id.
  useEffect(() => {
    if (!id || isNaN(id)) return;

    (async () => {
      setLoading(true);
      try {
        const coursesRes = await CourseApiService.getCourses();
        const allCourses = coursesRes.data ?? [];
        const courseIds  = allCourses.map((c) => c.id);

        if (courseIds.length === 0) {
          toast.error("No courses found.");
          setLoading(false);
          return;
        }

        const listRes = await ManualAssessmentApiService.list({ course_ids: courseIds });
        const found = (listRes.data ?? []).find((a) => a.id === id);
        if (!found) {
          toast.error("Assessment not found.");
          setLoading(false);
          return;
        }

        setAssessment(found);
        const course = allCourses.find((c) => c.id === found.course_id);
        setCourseName(course?.title ?? `Course #${found.course_id}`);

        const studentsRes = await CourseApiService.getCourseStudents(found.course_id);
        const rawStudents: any[] = studentsRes.data ?? [];
        const roster: StudentEntry[] = rawStudents.map((s: any) => {
          const uid = s.user?.id ?? s.user?.user_id ?? s.student_id ?? s.id ?? 0;
          const fn  = s.profile?.first_name ?? s.user?.first_name ?? s.first_name ?? "";
          const ln  = s.profile?.last_name  ?? s.user?.last_name  ?? s.last_name  ?? "";
          const reg = s.profile?.registration_number ?? s.user?.registration_number ?? s.reg_number ?? s.registration_number ?? "";
          return {
            student_id: uid,
            name: `${fn} ${ln}`.trim() || `Student #${uid}`,
            reg_number: reg || undefined,
          };
        });
        setStudents(roster);
      } catch {
        toast.error("Failed to load assessment data.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const typeLabel = assessment ? ManualAssessmentApiService.getTypeLabel(assessment) : "—";

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[300px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="text-center py-20">
        <p className="text-text-secondary-light dark:text-text-secondary-dark">Assessment not found.</p>
        <button
          onClick={() => navigate("/grades")}
          className="mt-4 text-blue-600 dark:text-blue-400 hover:underline text-sm"
        >
          Back to Grades
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-4">
      <button
        onClick={() => navigate("/grades")}
        className="flex items-center gap-2 text-sm text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Grades
      </button>

      <div>
        <h1 className="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark">
          {ManualAssessmentApiService.getTypeLabel(assessment)}
        </h1>
        <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mt-1">
          Class name: <span className="font-semibold text-text-primary-light dark:text-text-primary-dark">{courseName}</span>
        </p>
        <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mt-0.5">
          {assessment.assessment_date ?? "—"} | {typeLabel}
        </p>
      </div>

      <div className="rounded-2xl border border-border-light dark:border-white/[0.08] bg-white dark:bg-[#0A1020] overflow-hidden">
        <ManualScoreEntry
          variant="page"
          assessment={assessment}
          students={students}
        />
      </div>
    </div>
  );
}

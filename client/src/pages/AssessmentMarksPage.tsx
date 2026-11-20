import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, Hash, RotateCcw } from "lucide-react";
import { toast } from "react-toastify";
import { CourseApiService } from "../services/courseApi";
import { ManualAssessmentApiService, type ManualAssessment } from "../services/manualAssessmentApi";
import ManualScoreEntry, { type MarksFilter, type StudentEntry } from "../components/ReportCard/ManualScoreEntry";
import ReportCardMappingStrip from "../components/ReportCard/ReportCardMappingStrip";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { Skeleton } from "../components/ui/Skeleton";

// Full-page manual marks entry — the same ManualScoreEntry the Report Card
// Builder's "Enter scores" modal uses, flowed on a page, with where the
// marks count on the report card right above it (and changeable there).
// `?filter=todo` opens on the students still without a mark.

const FILTERS: MarksFilter[] = ["all", "todo", "marked", "status", "unsaved"];

export default function AssessmentMarksPage() {
  const { assessmentId } = useParams<{ assessmentId: string }>();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialFilter = (FILTERS as string[]).includes(params.get("filter") ?? "") ? (params.get("filter") as MarksFilter) : "all";

  const [assessment, setAssessment] = useState<ManualAssessment | null>(null);
  const [students, setStudents] = useState<StudentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [courseName, setCourseName] = useState("");
  const [unsaved, setUnsaved] = useState(0);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [reload, setReload] = useState(0);

  const id = parseInt(assessmentId ?? "", 10);

  // There's no single GET /manual-assessments/:id endpoint, so the assessment
  // is found by listing every course's assessments and matching the id.
  useEffect(() => {
    if (!id || isNaN(id)) return;
    let live = true;
    (async () => {
      setLoading(true);
      setFailed(false);
      try {
        const coursesRes = await CourseApiService.getCourses();
        const allCourses = coursesRes.data ?? [];
        const courseIds = allCourses.map((c) => c.id);
        if (courseIds.length === 0) throw new Error("No courses");
        const listRes = await ManualAssessmentApiService.list({ course_ids: courseIds });
        const found = (listRes.data ?? []).find((a) => a.id === id);
        if (!live) return;
        if (!found) {
          setAssessment(null);
          toast.error("Assessment not found.");
          return;
        }
        setAssessment(found);
        setCourseName(allCourses.find((c) => c.id === found.course_id)?.title ?? `Course #${found.course_id}`);
        const studentsRes = await CourseApiService.getCourseStudents(found.course_id);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const raw: any[] = studentsRes.data ?? [];
        if (!live) return;
        setStudents(
          raw.map((s) => {
            const uid = s.user?.id ?? s.user?.user_id ?? s.student_id ?? s.id ?? 0;
            const fn = s.profile?.first_name ?? s.user?.first_name ?? s.first_name ?? "";
            const ln = s.profile?.last_name ?? s.user?.last_name ?? s.last_name ?? "";
            const reg = s.profile?.registration_number ?? s.user?.registration_number ?? s.reg_number ?? s.registration_number ?? "";
            return { student_id: uid, name: `${fn} ${ln}`.trim() || `Student #${uid}`, reg_number: reg || undefined };
          }),
        );
      } catch {
        if (!live) return;
        setFailed(true);
        toast.error("Couldn't load this assessment.");
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [id, reload]);

  const back = () => (unsaved ? setConfirmLeave(true) : navigate("/grades"));
  const onDirtyChange = useCallback((n: number) => setUnsaved(n), []);

  const backButton = (
    <button
      onClick={back}
      className="flex items-center gap-2 text-sm text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark transition-colors"
    >
      <ArrowLeft className="w-4 h-4" />
      Back to Grades
    </button>
  );

  if (loading) {
    return (
      <div className="space-y-4" data-testid="marks-page-skeleton">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-80" />
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  if (failed || !assessment) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <p className="text-text-secondary-light dark:text-text-secondary-dark">{failed ? "Couldn't load this assessment." : "Assessment not found."}</p>
        <div className="flex gap-2">
          {failed && (
            <button onClick={() => setReload((r) => r + 1)} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-1.5 text-sm font-semibold dark:border-panel-line">
              <RotateCcw className="h-4 w-4" /> Try again
            </button>
          )}
          <button onClick={() => navigate("/grades")} className="text-blue-600 dark:text-blue-400 hover:underline text-sm">
            Back to Grades
          </button>
        </div>
      </div>
    );
  }

  const label = ManualAssessmentApiService.getTypeLabel(assessment);
  return (
    <div className="space-y-4 pb-4">
      {backButton}

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary-light dark:text-text-secondary-dark">{courseName}</p>
          <h1 className="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark">{label}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-secondary-light dark:text-text-secondary-dark">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" aria-hidden />
              {assessment.assessment_date ? new Date(assessment.assessment_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "No date"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Hash className="h-4 w-4" aria-hidden />
              Out of {Number(assessment.max_score)}
            </span>
            {assessment.title && assessment.title !== label && <span className="truncate">{assessment.title}</span>}
          </div>
        </div>
      </header>

      <ReportCardMappingStrip subjectId={assessment.course_id} kind="manual" assessmentId={assessment.id} />

      <div className="rounded-2xl border border-border-light dark:border-panel-line bg-white dark:bg-panel-dark overflow-hidden">
        <ManualScoreEntry variant="page" assessment={assessment} students={students} initialFilter={initialFilter} onDirtyChange={onDirtyChange} />
      </div>

      <ConfirmDialog
        open={confirmLeave}
        title="Leave without saving?"
        description={`${unsaved} change${unsaved === 1 ? " isn't" : "s aren't"} saved. They stay on this device as a draft you can restore when you come back.`}
        confirmLabel="Leave"
        onConfirm={() => navigate("/grades")}
        onCancel={() => setConfirmLeave(false)}
      />
    </div>
  );
}

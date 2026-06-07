import { useState, useEffect } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import { CourseApiService } from "../services/courseApi";
import axiosConfig from "../utils/axiosConfig";
import ReportCardBuilder, {
  type SubjectOption,
} from "../components/ReportCard/ReportCardBuilder";

export default function ReportCardBuilderPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [searchParams] = useSearchParams();

  const studentId  = parseInt(searchParams.get("studentId") ?? "0", 10);
  const term        = searchParams.get("term") ?? "";
  const academicYear = searchParams.get("year") ?? "";

  const [subject, setSubject]   = useState<SubjectOption | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

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
          quizzes: (quizzesRes.data ?? []).map((q: any) => ({
            id: q.id,
            title: q.title,
          })),
          assignments: ((assignmentsRes as any).data ?? []).map((a: any) => ({
            id: a.id,
            title: a.title,
          })),
        });
      } catch {
        setError("Failed to load course data. Please go back and try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, [courseId]);

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
          <p className="text-sm text-red-300">
            {error ?? "Missing student ID. Please navigate here from the student's profile."}
          </p>
          <Link
            to={`/courses/${courseId}`}
            className="flex items-center gap-2 text-indigo-300 hover:text-indigo-200 text-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Back to course
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Back navigation */}
      <div className="bg-slate-900 px-6 py-3 border-b border-white/5">
        <Link
          to={`/courses/${courseId}`}
          className="inline-flex items-center gap-2 text-sm text-indigo-300 hover:text-indigo-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to {subject.name}
        </Link>
      </div>

      <ReportCardBuilder
        studentId={studentId}
        term={term}
        academicYear={academicYear}
        subjects={[subject]}
      />
    </div>
  );
}

import { useState, useEffect } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import { CourseApiService } from "../services/courseApi";
import GeneralAttributesForm, {
  type StudentRow,
} from "../components/ReportCard/GeneralAttributesForm";

export default function GeneralAttributesPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [searchParams] = useSearchParams();

  const term         = searchParams.get("term") ?? "";
  const academicYear = searchParams.get("year") ?? "";

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [courseName, setCourseName] = useState<string>("");
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    if (!courseId) return;
    const id = parseInt(courseId, 10);

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [courseRes, studentsRes] = await Promise.all([
          CourseApiService.getCourse(id),
          CourseApiService.getCourseStudents(id),
        ]);

        setCourseName(courseRes.data.title ?? `Course #${id}`);
        setStudents(
          (studentsRes.data ?? []).map((s: any) => ({
            id: s.id,
            name: `${s.first_name} ${s.last_name}`,
          })),
        );
      } catch {
        setError("Failed to load student list. Please go back and try again.");
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
          <p className="text-sm">Loading student roster…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-white/70">
          <AlertCircle className="w-10 h-10 text-red-400" />
          <p className="text-sm text-red-300">{error}</p>
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
          Back to {courseName}
        </Link>
      </div>

      <GeneralAttributesForm
        students={students}
        term={term}
        academicYear={academicYear}
      />
    </div>
  );
}

import { useState, useEffect } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import { toast } from "react-toastify";
import { CourseApiService } from "../services/courseApi";
import {
  ReportCardApiService,
  type AttributeRating,
} from "../services/reportCardApi";
import GeneralAttributesForm, {
  type StudentRow,
  type StudentInitialData,
} from "../components/ReportCard/GeneralAttributesForm";

export default function GeneralAttributesPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [searchParams] = useSearchParams();

  const term         = searchParams.get("term") ?? "";
  const academicYear = searchParams.get("year") ?? "";

  const [students, setStudents]       = useState<StudentRow[]>([]);
  const [courseName, setCourseName]   = useState<string>("");
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [initialData, setInitialData] = useState<Record<number, StudentInitialData>>({});
  const [formKey, setFormKey]         = useState(0);

  // Mark-all-complete state (shown after attributes are saved)
  const [savedCardIds, setSavedCardIds]         = useState<number[]>([]);
  const [markingComplete, setMarkingComplete]   = useState(false);
  const [allMarkedComplete, setAllMarkedComplete] = useState(false);

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

        // FIX: getCourseStudents wraps each entry in { user: {...}, profile: {...} }
        const mappedStudents: StudentRow[] = (studentsRes.data ?? [])
          .map((s: any) => ({
            id: s.user?.id || s.user?.user_id,
            name: `${s.profile?.first_name || s.user?.first_name || ""} ${s.profile?.last_name || s.user?.last_name || ""}`.trim()
              || `Student #${s.user?.id || s.user?.user_id}`,
          }))
          .filter((s: any) => s.id);

        setStudents(mappedStudents);

        // Pre-populate form from existing saved report card data
        if (term && academicYear && mappedStudents.length > 0) {
          const results = await Promise.allSettled(
            mappedStudents.map((s) =>
              ReportCardApiService.getStudentReportCard(s.id, {
                term,
                academic_year: academicYear,
              }),
            ),
          );

          const data: Record<number, StudentInitialData> = {};
          results.forEach((result, i) => {
            if (result.status !== "fulfilled") return;
            const rc = result.value.data;
            const student = mappedStudents[i];

            // Reconstruct attendance radio from attendance counts
            let attendance: "present" | "absent" | "late" = "present";
            if ((rc.report_card.attendance?.absent ?? 0) > 0) attendance = "absent";
            else if ((rc.report_card.attendance?.late ?? 0) > 0) attendance = "late";

            // Reconstruct attribute ratings map
            const attrs: Partial<Record<string, AttributeRating>> = {};
            for (const item of rc.attributes ?? []) {
              attrs[item.attribute_name] = item.rating;
            }

            data[student.id] = {
              attendance,
              attributes: attrs as StudentInitialData["attributes"],
              comment: rc.report_card.class_teacher_comment ?? "",
            };
          });

          setInitialData(data);
          setFormKey((k) => k + 1); // remount form with pre-populated data
        }
      } catch {
        setError("Failed to load student list. Please go back and try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, [courseId, term, academicYear]);

  const handleAllSaved = (reportCardIds: number[]) => {
    setSavedCardIds(reportCardIds);
  };

  const handleMarkAllComplete = async () => {
    if (savedCardIds.length === 0) return;
    setMarkingComplete(true);
    try {
      await Promise.all(
        savedCardIds.map((id) => ReportCardApiService.updateStatus(id, "saved")),
      );
      setAllMarkedComplete(true);
      toast.success("All report cards marked as complete — ready for admin review.");
    } catch {
      toast.error("Failed to mark some report cards as complete. Try again.");
    } finally {
      setMarkingComplete(false);
    }
  };

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
      <div className="bg-slate-900 px-6 py-3 border-b border-white/5 flex items-center justify-between">
        <Link
          to={`/courses/${courseId}`}
          className="inline-flex items-center gap-2 text-sm text-indigo-300 hover:text-indigo-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to {courseName}
        </Link>
        {term && academicYear && (
          <span className="text-xs text-white/40 hidden sm:block">
            {term} · {academicYear}
          </span>
        )}
      </div>

      {/* Warning: missing term/year — saves will fail silently without these */}
      {(!term || !academicYear) && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-6 py-3 flex items-center gap-2 text-sm text-amber-300">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>
            Missing term or academic year in URL — attributes cannot be saved.
            Navigate here via the Report Cards tab in a course.
          </span>
        </div>
      )}

      {/* Mark-all-complete callout — shown after all attributes are saved */}
      {savedCardIds.length > 0 && !allMarkedComplete && (
        <div className="mx-4 mt-4 p-4 bg-blue-500/10 border border-blue-400/30 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-blue-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Attributes saved for all students
            </p>
            <p className="text-xs text-blue-400/70 mt-0.5">
              Mark all report cards as complete to send them for admin review.
            </p>
          </div>
          <button
            onClick={handleMarkAllComplete}
            disabled={markingComplete}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {markingComplete ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
            Mark all as Complete
          </button>
        </div>
      )}

      {allMarkedComplete && (
        <div className="mx-4 mt-4 p-4 bg-emerald-500/10 border border-emerald-400/30 rounded-2xl flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-300">All report cards are now complete</p>
            <p className="text-xs text-emerald-400/70 mt-0.5">
              An admin can now review and approve them so students can view their cards.
            </p>
          </div>
        </div>
      )}

      <GeneralAttributesForm
        key={formKey}
        students={students}
        term={term}
        academicYear={academicYear}
        initialData={initialData}
        onAllSaved={handleAllSaved}
      />
    </div>
  );
}

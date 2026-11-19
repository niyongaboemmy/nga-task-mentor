import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { ArrowLeft, Loader2, AlertCircle, AlertTriangle, LayoutGrid, Lock } from "lucide-react";
import { toast } from "react-toastify";
import { CourseApiService } from "../services/courseApi";
import { ReportCardApiService, type AttributeRating } from "../services/reportCardApi";
import { ReportCardWorkflowApi } from "../services/reportCardWorkflowApi";
import GeneralAttributesForm, {
  type StudentRow,
  type StudentInitialData,
} from "../components/ReportCard/GeneralAttributesForm";

type Person = { id?: number; user_id?: number; first_name?: string; last_name?: string };
type RosterEntry = { user?: Person; profile?: Person };
type Results = Record<number, Array<{ name: string; score: number | null }>>;

/** Each student's saved card: counts, ratings, comment, subject totals and whether it is past draft. */
async function loadCards(students: StudentRow[], term: string, academicYear: string) {
  const settled = await Promise.allSettled(
    students.map((s) => ReportCardApiService.getStudentReportCard(s.id, { term, academic_year: academicYear })),
  );
  const data: Record<number, StudentInitialData> = {};
  const totals: Results = {};
  const locked = new Set<number>();
  settled.forEach((result, i) => {
    if (result.status !== "fulfilled") return;
    const rc = result.value.data;
    const student = students[i];
    const att = rc.report_card.attendance ?? ({} as Partial<typeof rc.report_card.attendance>);

    const attrs: Partial<Record<string, AttributeRating>> = {};
    for (const item of rc.attributes ?? []) attrs[item.attribute_name] = item.rating;

    totals[student.id] = (rc.grades ?? []).map((g) => ({
      name: rc.subject_names?.[g.subject_id] || `Subject ${g.subject_id}`,
      score: Number.isFinite(Number(g.total_score)) ? Math.max(0, Math.min(100, Number(g.total_score))) : null,
    }));

    data[student.id] = {
      present: att.present ?? 0,
      absent: att.absent ?? 0,
      late: att.late ?? 0,
      excused: att.excused ?? 0,
      sick: att.sick ?? 0,
      attributes: attrs,
      comment: rc.report_card.class_teacher_comment ?? "",
    };
    if (rc.report_card.status && rc.report_card.status !== "draft") locked.add(student.id);
  });
  return { data, totals, locked };
}

export default function GeneralAttributesPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [searchParams] = useSearchParams();

  const term = searchParams.get("term") ?? "";
  const academicYear = searchParams.get("year") ?? "";

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [courseName, setCourseName] = useState<string>("");
  const [classGroupId, setClassGroupId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialData, setInitialData] = useState<Record<number, StudentInitialData>>({});
  const [lockedIds, setLockedIds] = useState<Set<number>>(() => new Set());
  // The school's behaviour attributes (undefined: the form uses its default list).
  const [attributes, setAttributes] = useState<string[] | undefined>(undefined);
  // Subject totals per student, for the AI comment drafts.
  const [results, setResults] = useState<Results>({});
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    if (!courseId) return;
    const id = parseInt(courseId, 10);

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [courseRes, studentsRes, schemeRes] = await Promise.all([
          CourseApiService.getCourse(id),
          CourseApiService.getCourseStudents(id),
          ReportCardWorkflowApi.scheme().catch(() => null),
        ]);

        setCourseName(courseRes.data.title ?? `Course #${id}`);
        setClassGroupId(courseRes.data.class_group_id ?? null);
        const list = schemeRes?.data?.scheme?.attributes;
        setAttributes(Array.isArray(list) && list.length ? list : undefined);

        // getCourseStudents wraps each entry in { user: {...}, profile: {...} }
        const mappedStudents: StudentRow[] = ((studentsRes.data ?? []) as RosterEntry[])
          .map((s: RosterEntry) => ({
            id: Number(s.user?.id || s.user?.user_id || 0),
            name: `${s.profile?.first_name || s.user?.first_name || ""} ${s.profile?.last_name || s.user?.last_name || ""}`.trim()
              || `Student #${s.user?.id || s.user?.user_id}`,
          }))
          .filter((s: StudentRow) => s.id);

        setStudents(mappedStudents);

        if (term && academicYear && mappedStudents.length > 0) {
          const { data, totals, locked } = await loadCards(mappedStudents, term, academicYear);
          setInitialData(data);
          setResults(totals);
          setLockedIds(locked);
        }
        setFormKey((k) => k + 1); // remount the form with the loaded data
      } catch {
        const message = "Failed to load student list. Please go back and try again.";
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    })();
  }, [courseId, term, academicYear]);

  /** Pull the registers' day counts, then refresh the cards (unedited rows pick them up). */
  const importAttendance = useCallback(async () => {
    if (!classGroupId) throw new Error("This subject isn't linked to a class.");
    const res = await ReportCardWorkflowApi.importAttendance({ class_group_id: classGroupId, term, academic_year: academicYear });
    const { data, totals, locked } = await loadCards(students, term, academicYear);
    setInitialData(data);
    setResults(totals);
    setLockedIds(locked);
    return res.message || `Attendance imported for ${res.data?.updated ?? 0} student(s).`;
  }, [classGroupId, term, academicYear, students]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-text-secondary-light dark:text-text-secondary-dark/70">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 dark:text-blue-400" />
          <p className="text-sm">Loading student roster…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-text-secondary-light dark:text-text-secondary-dark/70">
          <AlertCircle className="w-10 h-10 text-red-500 dark:text-red-400" />
          <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
          <Link
            to={`/courses/${courseId}`}
            className="flex items-center gap-2 text-blue-600 dark:text-blue-300 hover:text-blue-700 dark:hover:text-blue-200 text-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Back to course
          </Link>
        </div>
      </div>
    );
  }

  const canSave = !!term && !!academicYear;

  return (
    <div>
      {/* Back navigation + the workbench, where status changes happen */}
      <div className="bg-white dark:bg-black px-4 sm:px-6 py-3 border-b border-slate-200 dark:border-white/5 flex flex-wrap items-center justify-between gap-2">
        <Link
          to={`/courses/${courseId}`}
          className="inline-flex items-center gap-2 text-sm text-blue-600 dark:text-blue-300 hover:text-blue-700 dark:hover:text-blue-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to {courseName}
        </Link>
        <div className="flex items-center gap-3">
          {term && academicYear && (
            <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark/40 hidden sm:block">
              {term} · {academicYear}
            </span>
          )}
          <Link
            to="/report-cards"
            data-testid="open-workbench"
            className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-400/30 dark:bg-blue-500/10 dark:text-blue-200"
          >
            <LayoutGrid className="h-4 w-4" aria-hidden />
            Open report card workbench
          </Link>
        </div>
      </div>

      {!canSave && (
        <div className="bg-amber-50 dark:bg-amber-500/10 border-b border-amber-200 dark:border-amber-500/30 px-6 py-3 flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>
            Missing term or academic year in URL — attributes cannot be saved.
            Navigate here via the Report Cards tab in a course.
          </span>
        </div>
      )}

      {lockedIds.size > 0 && (
        <div className="mx-4 mt-4 flex items-start gap-2 rounded-2xl border border-slate-200 bg-white p-3 text-sm text-text-secondary-light dark:border-white/10 dark:bg-white/5 dark:text-text-secondary-dark">
          <Lock className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden />
          <span>
            {lockedIds.size} card{lockedIds.size === 1 ? " is" : "s are"} past draft and read-only here. Reviewing, approving and
            reopening happen in the report card workbench.
          </span>
        </div>
      )}

      <GeneralAttributesForm
        results={results}
        key={formKey}
        students={students}
        term={term}
        academicYear={academicYear}
        initialData={initialData}
        attributes={attributes}
        lockedStudentIds={lockedIds}
        onImportAttendance={canSave && classGroupId ? importAttendance : undefined}
      />
    </div>
  );
}

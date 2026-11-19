import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { ArrowLeft, MessageSquareText } from "lucide-react";
import PageHeader from "../components/ui/PageHeader";
import { Button } from "../components/ui/Button";
import EmptyState from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";
import GeneralAttributesForm, { type StudentInitialData } from "../components/ReportCard/GeneralAttributesForm";
import { ReportCardApiService, type AttributeRating } from "../services/reportCardApi";
import { ReportCardWorkflowApi, apiMessage, type WorkbenchData } from "../services/reportCardWorkflowApi";
import { useAuth } from "../contexts/AuthContext";

/**
 * The class teacher's part of a class's report cards for a term: the
 * comment, the behaviour attributes and attendance in days (importable from
 * the attendance app). Cards past draft are read-only here.
 */

const BATCH = 8;

export default function ClassCommentsPage() {
  const { classGroupId: cgParam } = useParams();
  const classGroupId = Number(cgParam);
  const [params] = useSearchParams();
  const { user } = useAuth();
  const term = params.get("term") || user?.currentAcademicTerm?.name || "";
  const year = params.get("year") || user?.currentAcademicYear?.name || "";

  const [wb, setWb] = useState<WorkbenchData | null>(null);
  const [initial, setInitial] = useState<Record<number, StudentInitialData> | null>(null);
  const [results, setResults] = useState<Record<number, Array<{ name: string; score: number | null }>>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!classGroupId || !term || !year) return;
    setError(null);
    try {
      const res = await ReportCardWorkflowApi.workbench({ class_group_id: classGroupId, term, academic_year: year });
      setWb(res.data);
      const data: Record<number, StudentInitialData> = {};
      const totals: Record<number, Array<{ name: string; score: number | null }>> = {};
      const list = res.data.students;
      for (let i = 0; i < list.length; i += BATCH) {
        await Promise.all(
          list.slice(i, i + BATCH).map(async (s) => {
            try {
              const card = await ReportCardApiService.getStudentReportCard(s.student_id, { term, academic_year: year });
              const rc = card.data.report_card;
              data[s.student_id] = {
                present: rc.attendance.present,
                absent: rc.attendance.absent,
                late: rc.attendance.late,
                excused: rc.attendance.excused ?? 0,
                sick: rc.attendance.sick ?? 0,
                comment: rc.class_teacher_comment ?? "",
                attributes: Object.fromEntries(card.data.attributes.map((a) => [a.attribute_name, a.rating as AttributeRating])),
              };
              totals[s.student_id] = (card.data.document?.groups ?? []).flatMap((g) =>
                g.subjects.map((x) => ({ name: x.name, score: x.total })),
              );
            } catch {
              /* a card that can't be read starts empty */
            }
          }),
        );
      }
      setInitial(data);
      setResults(totals);
    } catch (e) {
      const msg = apiMessage(e, "Couldn't load this class.");
      setError(msg);
      toast.error(msg);
    }
  }, [classGroupId, term, year]);

  useEffect(() => {
    void load();
  }, [load]);

  const students = useMemo(() => (wb?.students ?? []).map((s) => ({ id: s.student_id, name: s.name })), [wb]);
  const locked = useMemo(() => new Set((wb?.students ?? []).filter((s) => !s.card.editable).map((s) => s.student_id)), [wb]);
  const back = `/report-cards/${classGroupId}?term=${encodeURIComponent(term)}&year=${encodeURIComponent(year)}`;

  const importAttendance = async () => {
    const res = await ReportCardWorkflowApi.importAttendance({ class_group_id: classGroupId, term, academic_year: year });
    await load();
    return res.message;
  };

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 sm:p-6">
      <PageHeader
        breadcrumb={[{ label: "Report cards", to: "/report-cards" }, { label: wb?.class_group.name ?? "Class", to: back }, { label: "Comments" }]}
        title={`Comments, attributes and attendance${wb ? ` · ${wb.class_group.name}` : ""}`}
        icon={<MessageSquareText className="h-6 w-6 text-blue-600" />}
        description={`${term} ${year} — only draft cards can be changed.`}
        actions={
          <Link to={back} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium hover:bg-gray-50 dark:border-white/10 dark:hover:bg-white/5">
            <ArrowLeft className="h-4 w-4" /> Back to workbench
          </Link>
        }
      />
      {error && !wb ? (
        <EmptyState title="Couldn't load this class" description={error} action={<Button size="sm" onClick={() => void load()}>Try again</Button>} />
      ) : !wb || !initial ? (
        <div className="space-y-2" aria-busy="true">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : students.length === 0 ? (
        <EmptyState title="No students in this class" />
      ) : (
        <GeneralAttributesForm
          students={students}
          term={term}
          academicYear={year}
          initialData={initial}
          results={results}
          attributes={wb.scheme.attributes}
          lockedStudentIds={locked}
          onImportAttendance={importAttendance}
          hideHeading
        />
      )}
    </div>
  );
}

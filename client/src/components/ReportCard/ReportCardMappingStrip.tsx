import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Layers } from "lucide-react";
import AssessmentMappingControl from "./AssessmentMappingControl";
import TemplatePreviewButton from "./templates/TemplatePreviewButton";
import { useSubjectMapping } from "../../hooks/useSubjectMapping";
import { toast } from "react-toastify";
import { toastWithUndo } from "../ui/UndoToast";
import type { AssessmentType } from "../../services/reportCardApi";

/**
 * Where an assessment's marks count on the report card, right where they are
 * recorded: its category in the school's builder (changeable here, with
 * undo), what that means, and a way to the template and the subject's
 * report card builder. Unmapped work is called out, since it counts nowhere.
 */
export default function ReportCardMappingStrip({ subjectId, kind, assessmentId }: { subjectId: number; kind: AssessmentType; assessmentId: number }) {
  const m = useSubjectMapping(subjectId);
  const category = m.categoryOf(kind, assessmentId);
  const meta = m.structure.categories.find((c) => c.key === category);
  const tvet = m.builder === "tvet";

  const change = async (next: typeof category) => {
    const before = category;
    if (next === before) return;
    const ok = await m.setCategory(kind, assessmentId, next);
    if (!ok) return;
    toastWithUndo(next ? `These marks now count as ${m.labelOf(next)}.` : "Taken off the report card.", () => {
      void m.setCategory(kind, assessmentId, before).then((done) => done && toast.success("Mapping restored."));
    });
  };

  if (m.loading) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 dark:border-panel-line dark:bg-panel-dark" data-testid="mapping-strip-skeleton">
        <div className="h-8 w-8 animate-pulse rounded-xl bg-gray-200 dark:bg-white/[0.08]" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 w-40 animate-pulse rounded bg-gray-200 dark:bg-white/[0.08]" />
          <div className="h-2.5 w-64 animate-pulse rounded bg-gray-200 dark:bg-white/[0.06]" />
        </div>
      </div>
    );
  }
  if (m.error) return null; // the marks still save; the mapping can be set on the Grades page

  return (
    <section
      data-testid="mapping-strip"
      aria-label="Report card mapping"
      className={`flex flex-col gap-3 rounded-2xl border px-4 py-3 sm:flex-row sm:items-center ${
        category ? "border-gray-200 bg-white dark:border-panel-line dark:bg-panel-dark" : "border-orange-200 bg-orange-50/70 dark:border-orange-500/30 dark:bg-orange-500/5"
      }`}
    >
      <span
        className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${
          category ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300" : "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300"
        }`}
        aria-hidden
      >
        {category ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
          {category ? `On the report card as ${meta?.label ?? category}` : "Not on the report card yet"}
        </p>
        <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark" data-testid="mapping-strip-hint">
          {category
            ? tvet
              ? `${meta?.short} is scored out of the module weight on the ${m.structure.label} card.`
              : `${meta?.short} is ${meta?.weight}% of the subject's total on the ${m.structure.label} card.`
            : `Choose a category so these marks count. The school uses the ${m.structure.label} builder (${m.structure.categories.map((c) => c.short).join(", ")}).`}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <AssessmentMappingControl category={category} saving={m.saving} onChange={(c) => void change(c)} className={category ? "" : "rounded-full ring-2 ring-orange-400/70"} />
        <TemplatePreviewButton builder={m.builder} />
        <Link
          to={`/grades/subjects/${subjectId}`}
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold text-text-secondary-light hover:bg-gray-100 hover:text-text-primary-light dark:text-text-secondary-dark dark:hover:bg-white/[0.06] dark:hover:text-text-primary-dark"
        >
          <Layers className="h-3.5 w-3.5" aria-hidden /> Report card builder
        </Link>
      </div>
    </section>
  );
}

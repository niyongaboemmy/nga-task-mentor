import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { toast } from "react-toastify";
import { Skeleton } from "../../ui/Skeleton";
import ConfirmDialog from "../../ui/ConfirmDialog";
import { ReportCardWorkflowApi, apiMessage } from "../../../services/reportCardWorkflowApi";
import { describeKinds, type FormativeResult as Result } from "./formativeText";

/**
 * TVET schools: new quizzes, assignments and recorded marks go to FA on
 * their own; this shows how much of the current term isn't mapped yet and
 * maps it to FA in one go (after a confirmation).
 */
export default function FormativeDefaultPanel({ refreshKey = 0 }: { refreshKey?: number }) {
  const [preview, setPreview] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [applying, setApplying] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setFailed(false);
    ReportCardWorkflowApi.mapFormative(true)
      .then((r) => setPreview(r.data))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => load(), [load, refreshKey]);

  const apply = async () => {
    setConfirm(false);
    setApplying(true);
    try {
      const r = await ReportCardWorkflowApi.mapFormative(false);
      toast.success(r.data.mapped ? `Mapped ${describeKinds(r.data.by_kind)} to FA (${r.data.term}, ${r.data.academic_year}).` : "Everything this term is already mapped.");
      load();
    } catch (e) {
      toast.error(apiMessage(e, "Couldn't map the work to FA."));
    } finally {
      setApplying(false);
    }
  };

  return (
    <section className="flex flex-col gap-3 rounded-3xl border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-500/30 dark:bg-blue-500/5 sm:flex-row sm:items-center md:p-5" data-testid="formative-default">
      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white" aria-hidden>
        <Sparkles className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">Formative (FA) by default</p>
        <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
          New quizzes, assignments and recorded marks are mapped to FA as soon as they're created. Teachers only move the comprehensive (CA) and integrated (IA) assessments.
        </p>
        {loading ? (
          <Skeleton className="mt-2 h-3.5 w-64" />
        ) : failed ? (
          <p className="mt-1 text-xs text-text-secondary-light dark:text-text-secondary-dark">Couldn't check this term's mapping.</p>
        ) : preview && preview.mapped > 0 ? (
          <p className="mt-1 text-xs font-semibold text-orange-700 dark:text-orange-300" data-testid="formative-pending">
            {describeKinds(preview.by_kind)} in {preview.subjects} subject{preview.subjects === 1 ? "" : "s"} aren't mapped yet this term.
          </p>
        ) : preview ? (
          <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-blue-700 dark:text-blue-300" data-testid="formative-done">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Everything this term is mapped.
          </p>
        ) : null}
      </div>
      {preview && preview.mapped > 0 && (
        <button
          type="button"
          onClick={() => setConfirm(true)}
          disabled={applying}
          data-testid="map-formative"
          className="inline-flex flex-shrink-0 items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-40"
        >
          {applying && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          Map {preview.mapped} to FA
        </button>
      )}
      <ConfirmDialog
        open={confirm}
        title={`Map ${preview?.mapped ?? 0} to FA?`}
        description={`${preview ? describeKinds(preview.by_kind) : ""} not mapped yet this term will count as FA (formative). Work already mapped keeps its category.`}
        confirmLabel="Map to FA"
        onConfirm={() => void apply()}
        onCancel={() => setConfirm(false)}
      />
    </section>
  );
}

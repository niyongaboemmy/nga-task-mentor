import { useCallback, useEffect, useState } from "react";
import { Scale } from "lucide-react";
import { toast } from "react-toastify";
import { Skeleton } from "../../ui/Skeleton";
import ComponentWeightsEditor from "../ComponentWeightsEditor";
import { ReportCardApiService, type BuilderStructure, type ComponentWeights, type ComponentWeightsResponse } from "../../../services/reportCardApi";

/**
 * The school's default weights for each kind of work inside every category
 * of its builder (e.g. FA = class work 30 · homework 20 · quizzes 20 ·
 * midterm 30). A subject can set its own in the report card builder; every
 * report built from marks (cards, grade sheets, rankings, dashboards) uses
 * the subject's, else these, else an equal average.
 */
export default function SchoolComponentWeightsPanel({ structure }: { structure: BuilderStructure }) {
  const [data, setData] = useState<ComponentWeightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setFailed(false);
    ReportCardApiService.getComponentWeights()
      .then((r) => setData(r.data))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => load(), [load]);

  const save = async (category: string, label: string, weights: Record<string, number> | null) => {
    if (!data) return;
    const next: ComponentWeights = { ...data.default };
    if (weights && Object.values(weights).some((w) => w > 0)) next[category] = weights;
    else delete next[category];
    setSaving(category);
    try {
      const r = await ReportCardApiService.saveDefaultComponentWeights(next);
      setData({ ...data, default: r.data.default, effective: r.data.default });
      toast.success(weights ? `${label}: the school's weights are saved.` : `${label}: every assessment counts the same again.`);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || `Couldn't save the weights for ${label}.`);
    } finally {
      setSaving(null);
    }
  };

  const rows = (data?.components ?? []).map((c) => ({ key: c.key, label: c.label }));

  return (
    <section
      aria-labelledby="tpl-component-weights"
      className="rounded-3xl border border-gray-200 bg-white p-4 dark:border-panel-line dark:bg-panel-dark md:p-5"
      data-testid="school-component-weights"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
          <Scale className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 id="tpl-component-weights" className="text-base font-semibold text-text-primary-light dark:text-text-primary-dark">
            Weights inside each category
          </h2>
          <p className="mt-0.5 text-sm text-text-secondary-light dark:text-text-secondary-dark">
            How much class work, homework, quizzes, midterms… weigh before they merge into a category. A subject can set its own in the report card
            builder. Left empty, every assessment in the category counts the same.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {structure.categories.map((c) => (
            <Skeleton key={c.key} className="h-40 w-full rounded-2xl" />
          ))}
        </div>
      ) : failed || !data ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-gray-200 p-3 text-sm dark:border-panel-line">
          <span className="text-text-secondary-light dark:text-text-secondary-dark">Couldn't load the weights.</span>
          <button type="button" onClick={load} className="font-semibold text-blue-600 hover:underline dark:text-blue-400">
            Try again
          </button>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {structure.categories.map((c) => (
            <ComponentWeightsEditor
              key={c.key}
              compact
              categoryLabel={`${c.label} (${c.short ?? c.key})`}
              rows={rows}
              value={data.default[c.key]}
              source={data.default[c.key] ? "school" : "none"}
              saving={saving === c.key}
              onSave={(w) => save(c.key, c.label, w)}
              onReset={data.default[c.key] ? () => save(c.key, c.label, null) : undefined}
              resetLabel="Count every assessment the same"
            />
          ))}
        </div>
      )}
    </section>
  );
}

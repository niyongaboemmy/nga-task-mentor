import { useEffect, useMemo, useState } from "react";
import { Loader2, RotateCcw, Save, Scale } from "lucide-react";

/**
 * How much each kind of work weighs inside one report card category (e.g.
 * FA = class work 30 · homework 20 · quizzes 20 · midterm 30). Weights are
 * relative: the card scales them over the kinds that have marks, so the
 * shares are shown live. Kinds with marks but weight 0 don't count, and say so.
 */

export interface ComponentRow {
  key: string;
  label: string;
  /** Assessments of this kind in the category (when known). */
  count?: number;
}

export default function ComponentWeightsEditor({
  categoryLabel,
  rows,
  value,
  source,
  saving,
  onSave,
  onReset,
  resetLabel = "Use the school's weights",
  compact = false,
}: {
  categoryLabel: string;
  rows: ComponentRow[];
  value: Record<string, number> | undefined;
  /** Where the current weights come from, for the badge. */
  source: "subject" | "school" | "none";
  saving?: boolean;
  onSave: (weights: Record<string, number>) => void;
  onReset?: () => void;
  resetLabel?: string;
  compact?: boolean;
}) {
  const initial = useMemo(() => Object.fromEntries(rows.map((r) => [r.key, value?.[r.key] != null ? String(value[r.key]) : ""])), [rows, value]);
  const [draft, setDraft] = useState<Record<string, string>>(initial);
  useEffect(() => setDraft(initial), [initial]);

  const nums = rows.map((r) => ({ ...r, w: Math.max(0, Number(draft[r.key]) || 0) }));
  const counted = nums.filter((r) => (r.count ?? 1) > 0);
  const total = counted.reduce((a, r) => a + r.w, 0);
  const invalid = rows.some((r) => draft[r.key] !== "" && (!Number.isFinite(Number(draft[r.key])) || Number(draft[r.key]) < 0 || Number(draft[r.key]) > 100));
  const dirty = rows.some((r) => (draft[r.key] ?? "") !== (initial[r.key] ?? ""));
  const sum = nums.reduce((a, r) => a + r.w, 0);
  const unweighted = counted.filter((r) => r.w === 0 && (r.count ?? 0) > 0);

  return (
    <div className={`rounded-2xl border border-blue-200 bg-white dark:border-blue-500/25 dark:bg-panel-dark ${compact ? "p-3" : "p-4"}`} data-testid="component-weights-editor">
      <div className="flex flex-wrap items-center gap-2">
        <Scale className="h-4 w-4 text-blue-600 dark:text-blue-400" aria-hidden />
        <p className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">Weights inside {categoryLabel}</p>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            source === "subject"
              ? "bg-blue-600 text-white"
              : source === "school"
                ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"
                : "bg-gray-100 text-text-secondary-light dark:bg-white/10 dark:text-text-secondary-dark"
          }`}
          data-testid="component-weights-source"
        >
          {source === "subject" ? "This subject" : source === "school" ? "School default" : "Equal per assessment"}
        </span>
      </div>
      <p className="mt-1 text-xs text-text-secondary-light dark:text-text-secondary-dark">
        Each kind of work is averaged first, then the kinds are combined by these weights (scaled over the kinds that have marks). Leave all empty to average every assessment equally.
      </p>
      <ul className="mt-3 space-y-2">
        {nums.map((r) => {
          const share = total > 0 && (r.count ?? 1) > 0 ? Math.round((r.w / total) * 1000) / 10 : 0;
          return (
            <li key={r.key} className="grid grid-cols-[minmax(0,1fr)_88px_56px] items-center gap-3" data-testid={`kind-weight-${r.key}`}>
              <div className="min-w-0">
                <p className="truncate text-sm text-text-primary-light dark:text-text-primary-dark">{r.label}</p>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                  <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${share}%` }} />
                </div>
                {r.count != null && (
                  <p className="mt-0.5 text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
                    {r.count} assessment{r.count === 1 ? "" : "s"}
                  </p>
                )}
              </div>
              <input
                type="number"
                min={0}
                max={100}
                value={draft[r.key] ?? ""}
                placeholder="0"
                onChange={(e) => setDraft((d) => ({ ...d, [r.key]: e.target.value }))}
                aria-label={`${r.label} weight in ${categoryLabel}`}
                className="h-9 rounded-xl border border-gray-200 bg-white px-2.5 text-right text-sm tabular-nums text-text-primary-light focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/30 dark:border-panel-line dark:bg-panel-raised dark:text-text-primary-dark"
              />
              <span className="text-right text-xs font-semibold tabular-nums text-text-secondary-light dark:text-text-secondary-dark" title="Share of the category">
                {share ? `${share}%` : "–"}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3 dark:border-panel-line">
        <span className={`text-xs font-semibold ${sum === 100 || sum === 0 ? "text-text-secondary-light dark:text-text-secondary-dark" : "text-orange-600 dark:text-orange-300"}`} data-testid="component-weights-sum">
          {sum === 0 ? "No weights: every assessment counts the same" : sum === 100 ? "Weights add up to 100" : `Weights add up to ${Math.round(sum * 100) / 100} (scaled to 100 on the card)`}
        </span>
        {unweighted.length > 0 && sum > 0 && (
          <span className="text-xs font-semibold text-orange-600 dark:text-orange-300" data-testid="component-weights-unweighted">
            {unweighted.map((r) => r.label).join(", ")} {unweighted.length === 1 ? "has" : "have"} marks but no weight: not counted
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {onReset && source !== "none" && (
            <button type="button" onClick={onReset} disabled={saving} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-semibold text-text-primary-light hover:border-blue-300 disabled:opacity-40 dark:border-panel-line dark:text-text-primary-dark">
              <RotateCcw className="h-3.5 w-3.5" aria-hidden /> {resetLabel}
            </button>
          )}
          <button
            type="button"
            onClick={() => onSave(Object.fromEntries(nums.filter((r) => r.w > 0).map((r) => [r.key, r.w])))}
            disabled={saving || !dirty || invalid}
            data-testid="component-weights-save"
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Save className="h-3.5 w-3.5" aria-hidden />}
            Save weights
          </button>
        </div>
      </div>
    </div>
  );
}

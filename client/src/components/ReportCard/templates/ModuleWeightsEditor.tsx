import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Loader2, RotateCcw, Search, X } from "lucide-react";
import { toast } from "react-toastify";
import { Skeleton } from "../../ui/Skeleton";
import { toastWithUndo } from "../../ui/UndoToast";
import { ReportCardWorkflowApi, apiMessage, type TemplateModule } from "../../../services/reportCardWorkflowApi";

/**
 * Each module's weight on TVET report cards (its learning hours: FA, CA and
 * IA are scored out of it). The weight lives on the MIS subject, so it's the
 * same everywhere; it's saved there as soon as a field is left (Enter or
 * Tab), with Undo. A weight set only in Task Mentor earlier still wins and
 * can be removed; modules with no weight anywhere use the default.
 */

const CATEGORY_LABEL: Record<string, string> = { specific: "Specific", general: "General", complementary: "Complementary" };
const INPUT =
  "rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-text-primary-light placeholder-gray-400 focus:border-blue-400/60 focus:outline-none focus:ring-2 focus:ring-blue-400/30 dark:border-panel-line dark:bg-panel-raised dark:text-text-primary-dark dark:placeholder-white/25";

export default function ModuleWeightsEditor({
  overrides,
  onRemoveOverride,
  defaultWeight,
  onDefaultWeight,
}: {
  /** Weights set in Task Mentor earlier (subject id -> weight), which win over MIS. */
  overrides: Record<string, string>;
  onRemoveOverride: (id: number) => void;
  defaultWeight: number;
  onDefaultWeight: (n: number) => void;
}) {
  const [modules, setModules] = useState<TemplateModule[] | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [draft, setDraft] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState<number | null>(null);
  const [savedId, setSavedId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(false);

  const load = useCallback(() => {
    setState("loading");
    ReportCardWorkflowApi.templateModules()
      .then((res) => {
        setModules(res.data.modules);
        setState("ready");
      })
      .catch((e) => {
        setState("failed");
        toast.error(apiMessage(e, "Couldn't load the modules from MIS."));
      });
  }, []);
  useEffect(() => load(), [load]);

  const setMisWeight = useCallback(async (m: TemplateModule, weight: number | null, opts: { undoable?: boolean } = { undoable: true }) => {
    const before = m.learning_hours;
    setSaving(m.id);
    try {
      await ReportCardWorkflowApi.saveModuleWeight(m.id, weight);
      setModules((list) => (list ?? []).map((x) => (x.id === m.id ? { ...x, learning_hours: weight } : x)));
      setDraft((d) => {
        const n = { ...d };
        delete n[m.id];
        return n;
      });
      setSavedId(m.id);
      window.setTimeout(() => setSavedId((v) => (v === m.id ? null : v)), 1600);
      if (opts.undoable) {
        toastWithUndo(`${m.code ?? m.name}: weight ${weight ?? "cleared"} saved in MIS.`, () => void setMisWeight({ ...m, learning_hours: weight }, before, { undoable: false }).then(() => toast.success("Weight restored.")));
      }
    } catch (e) {
      toast.error(apiMessage(e, "Couldn't save the weight in MIS."));
      setDraft((d) => {
        const n = { ...d };
        delete n[m.id];
        return n;
      });
    } finally {
      setSaving(null);
    }
  }, []);

  const commit = (m: TemplateModule) => {
    const raw = draft[m.id];
    if (raw === undefined) return;
    const t = raw.trim();
    const n = t === "" ? null : Number(t);
    if (n != null && (!Number.isInteger(n) || n < 1 || n > 1000)) {
      toast.error("The module weight is a whole number from 1 to 1000.");
      return;
    }
    if (n === (m.learning_hours ?? null)) {
      setDraft((d) => {
        const x = { ...d };
        delete x[m.id];
        return x;
      });
      return;
    }
    void setMisWeight(m, n);
  };

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (modules ?? []).filter(
      (m) => (!q || m.name.toLowerCase().includes(q) || (m.code ?? "").toLowerCase().includes(q)) && (!onlyMissing || (m.learning_hours == null && !(overrides[String(m.id)] ?? "").trim())),
    );
  }, [modules, query, onlyMissing, overrides]);
  const missing = (modules ?? []).filter((m) => m.learning_hours == null && !(overrides[String(m.id)] ?? "").trim()).length;

  return (
    <div data-testid="module-weights-editor">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-xs font-bold uppercase tracking-wide text-text-secondary-light dark:text-text-secondary-dark">Module weights</h3>
          <p className="mt-0.5 text-xs text-text-secondary-light dark:text-text-secondary-dark">
            Each module's learning hours (credits × 10): FA, CA and IA are scored out of it. Saved on the MIS subject when you leave a field.
          </p>
        </div>
        <label className="flex w-40 flex-col gap-1">
          <span className="text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark">Default weight</span>
          <input
            className={`${INPUT} w-full`}
            type="number"
            min={1}
            max={1000}
            value={Number.isFinite(defaultWeight) ? defaultWeight : ""}
            onChange={(e) => onDefaultWeight(e.target.value === "" ? NaN : Number(e.target.value))}
            aria-label="Default module weight"
          />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden />
          <input className={`${INPUT} w-full pl-9`} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search modules by name or code" aria-label="Search modules" />
        </div>
        <button
          type="button"
          onClick={() => setOnlyMissing((v) => !v)}
          aria-pressed={onlyMissing}
          data-testid="only-missing"
          className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
            onlyMissing ? "border-blue-600 bg-blue-600 text-white" : "border-gray-200 text-text-primary-light hover:border-blue-300 dark:border-panel-line dark:text-text-primary-dark"
          }`}
        >
          No weight yet{modules ? ` (${missing})` : ""}
        </button>
      </div>
      <div className="mt-3 max-h-[28rem] overflow-y-auto rounded-2xl border border-gray-200 dark:border-panel-line">
        {state === "loading" ? (
          <div className="space-y-2 p-3" data-testid="modules-skeleton">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : state === "failed" ? (
          <div className="flex flex-col items-center gap-2 p-6 text-center text-sm text-text-secondary-light dark:text-text-secondary-dark">
            Couldn't load the modules from MIS.
            <button type="button" onClick={load} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-semibold dark:border-panel-line">
              <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Try again
            </button>
          </div>
        ) : shown.length === 0 ? (
          <p className="p-6 text-center text-sm text-text-secondary-light dark:text-text-secondary-dark">{modules?.length ? "No module matches." : "MIS has no modules yet."}</p>
        ) : (
          <table className="w-full text-sm" data-testid="module-weights">
            <thead className="sticky top-0 z-10 bg-gray-50 text-left text-[11px] uppercase tracking-wide text-text-secondary-light dark:bg-panel-raised dark:text-text-secondary-dark">
              <tr>
                <th className="px-3 py-2 font-semibold">Module</th>
                <th className="hidden px-3 py-2 font-semibold sm:table-cell">Group</th>
                <th className="px-3 py-2 text-right font-semibold">Weight (MIS)</th>
                <th className="px-3 py-2 text-right font-semibold">On the card</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((m) => {
                const own = (overrides[String(m.id)] ?? "").trim();
                const effective = own ? Number(own) : (m.learning_hours ?? defaultWeight);
                const value = draft[m.id] ?? (m.learning_hours != null ? String(m.learning_hours) : "");
                return (
                  <tr key={m.id} className="border-t border-gray-100 dark:border-panel-line" data-testid={`weight-row-${m.id}`}>
                    <td className="px-3 py-2">
                      <div className="font-medium text-text-primary-light dark:text-text-primary-dark">{m.name}</div>
                      {m.code && <div className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark">{m.code}</div>}
                    </td>
                    <td className="hidden px-3 py-2 text-xs text-text-secondary-light dark:text-text-secondary-dark sm:table-cell">{m.category ? CATEGORY_LABEL[m.category] : "–"}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1.5">
                        <input
                          type="number"
                          min={1}
                          max={1000}
                          value={value}
                          placeholder="–"
                          disabled={saving === m.id}
                          onChange={(e) => setDraft((d) => ({ ...d, [m.id]: e.target.value }))}
                          onBlur={() => commit(m)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              commit(m);
                            } else if (e.key === "Escape") {
                              setDraft((d) => {
                                const x = { ...d };
                                delete x[m.id];
                                return x;
                              });
                            }
                          }}
                          aria-label={`${m.name} weight in MIS`}
                          className={`${INPUT} w-24 text-right tabular-nums`}
                        />
                        <span className="inline-flex w-4 justify-center" aria-live="polite">
                          {saving === m.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" aria-label="Saving" />
                          ) : savedId === m.id ? (
                            <Check className="h-3.5 w-3.5 text-blue-600" aria-label="Saved" />
                          ) : null}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className="font-semibold tabular-nums text-text-primary-light dark:text-text-primary-dark">{Number.isFinite(effective) ? effective : "–"}</span>
                      <div className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
                        {own ? (
                          <span className="inline-flex items-center gap-1 text-blue-700 dark:text-blue-300">
                            Task Mentor
                            <button type="button" onClick={() => onRemoveOverride(m.id)} aria-label={`Remove the Task Mentor weight for ${m.name}`} className="rounded p-0.5 hover:bg-blue-50 dark:hover:bg-blue-500/10">
                              <X className="h-3 w-3" aria-hidden />
                            </button>
                          </span>
                        ) : m.learning_hours != null ? (
                          "MIS"
                        ) : (
                          <span className="text-orange-600 dark:text-orange-300">default</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

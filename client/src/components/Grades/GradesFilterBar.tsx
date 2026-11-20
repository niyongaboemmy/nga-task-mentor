import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Filter, X } from "lucide-react";

/**
 * The Grades page filters: each facet is a small menu of options with live
 * counts (what you'd get by picking it, given the other filters), shown as
 * removable chips once picked. Pure UI: the page owns the values and counts.
 */

export interface FacetOption {
  value: string;
  label: string;
  count: number;
}

export interface Facet {
  key: string;
  label: string;
  options: FacetOption[];
  selected: string[];
  onChange: (values: string[]) => void;
}

function FilterMenu({ facet }: { facet: Facet }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const n = facet.selected.length;
  const toggle = (v: string) => facet.onChange(facet.selected.includes(v) ? facet.selected.filter((x) => x !== v) : [...facet.selected, v]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        data-testid={`filter-${facet.key}`}
        className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-colors ${
          n
            ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-300"
            : "border-border-light text-text-primary-light hover:border-blue-300 dark:border-border-dark/40 dark:text-text-primary-dark dark:hover:border-blue-500/40"
        }`}
      >
        {facet.label}
        {n > 0 && <span className="rounded-full bg-blue-600 px-1.5 text-[10px] leading-4 text-white">{n}</span>}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 z-30 mt-1.5 w-64 rounded-2xl border border-border-light bg-card-light p-1.5 dark:border-border-dark/40 dark:bg-card-dark"
        >
          <div className="max-h-72 overflow-y-auto">
            {facet.options.map((o) => {
              const on = facet.selected.includes(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={on}
                  onClick={() => toggle(o.value)}
                  disabled={!on && o.count === 0}
                  data-testid={`filter-${facet.key}-${o.value}`}
                  className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm text-text-primary-light transition-colors hover:bg-surface-light disabled:cursor-not-allowed disabled:opacity-40 dark:text-text-primary-dark dark:hover:bg-surface-dark/60"
                >
                  <span
                    className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${
                      on ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300 dark:border-white/20"
                    }`}
                    aria-hidden
                  >
                    {on && <Check className="h-3 w-3" />}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{o.label}</span>
                  <span className="text-xs tabular-nums text-text-secondary-light dark:text-text-secondary-dark">{o.count}</span>
                </button>
              );
            })}
          </div>
          {n > 0 && (
            <button
              type="button"
              onClick={() => facet.onChange([])}
              className="mt-1 w-full rounded-xl px-2.5 py-1.5 text-left text-xs font-semibold text-blue-700 hover:bg-surface-light dark:text-blue-300 dark:hover:bg-surface-dark/60"
            >
              Clear {facet.label.toLowerCase()}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function GradesFilterBar({
  facets,
  dateFrom,
  dateTo,
  onDate,
  shown,
  total,
  onClearAll,
}: {
  facets: Facet[];
  dateFrom: string;
  dateTo: string;
  onDate: (from: string, to: string) => void;
  shown: number;
  total: number;
  onClearAll: () => void;
}) {
  const chips = facets.flatMap((f) => f.selected.map((v) => ({ f, v, label: f.options.find((o) => o.value === v)?.label ?? v })));
  const active = chips.length > 0 || !!dateFrom || !!dateTo;
  const dateInput =
    "h-9 rounded-xl border border-border-light bg-transparent px-2.5 text-xs text-text-primary-light focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/30 dark:border-border-dark/40 dark:text-text-primary-dark dark:[color-scheme:dark]";
  return (
    <div className="space-y-2" data-testid="grades-filters">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-text-secondary-light dark:text-text-secondary-dark">
          <Filter className="h-3.5 w-3.5" aria-hidden /> Filter
        </span>
        {facets.map((f) => (
          <FilterMenu key={f.key} facet={f} />
        ))}
        <span className="inline-flex items-center gap-1.5">
          <input type="date" value={dateFrom} max={dateTo || undefined} onChange={(e) => onDate(e.target.value, dateTo)} aria-label="From date" className={dateInput} data-testid="filter-from" />
          <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark">to</span>
          <input type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => onDate(dateFrom, e.target.value)} aria-label="To date" className={dateInput} data-testid="filter-to" />
        </span>
        {active && (
          <span className="ml-auto text-xs text-text-secondary-light dark:text-text-secondary-dark" aria-live="polite" data-testid="filter-result">
            Showing <strong className="text-text-primary-light dark:text-text-primary-dark">{shown}</strong> of {total} assessments
          </span>
        )}
      </div>
      {active && (
        <div className="flex flex-wrap items-center gap-1.5" data-testid="filter-chips">
          {chips.map(({ f, v, label }) => (
            <button
              key={`${f.key}:${v}`}
              type="button"
              onClick={() => f.onChange(f.selected.filter((x) => x !== v))}
              aria-label={`Remove filter ${f.label}: ${label}`}
              className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 py-0.5 pl-2.5 pr-1.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300"
            >
              <span className="font-normal opacity-80">{f.label}:</span> {label}
              <X className="h-3 w-3" aria-hidden />
            </button>
          ))}
          {(dateFrom || dateTo) && (
            <button
              type="button"
              onClick={() => onDate("", "")}
              aria-label="Remove the date filter"
              className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 py-0.5 pl-2.5 pr-1.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300"
            >
              <span className="font-normal opacity-80">Date:</span> {dateFrom || "…"} – {dateTo || "…"}
              <X className="h-3 w-3" aria-hidden />
            </button>
          )}
          <button type="button" onClick={onClearAll} className="text-[11px] font-semibold text-text-secondary-light hover:text-blue-700 dark:text-text-secondary-dark dark:hover:text-blue-300" data-testid="filter-clear">
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}

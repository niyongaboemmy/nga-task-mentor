import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpenCheck,
  CalendarRange,
  Check,
  FileText,
  GraduationCap,
  Layers,
  MonitorPlay,
  NotebookPen,
  RefreshCw,
  Search,
  X,
  type LucideIcon,
} from "lucide-react";
import type {
  AISourceGroup,
  AISourceGroupKey,
  AISourceItem,
  AISourcesResponse,
} from "../../../services/aiQuestionGenerationApi";
import { groupByWeek, matchesQuery, sourceKey, weekLabel } from "./aiGeneratorModel";
import Select from "../../ui/Select";

const GROUP_ICONS: Record<AISourceGroupKey, LucideIcon> = {
  curriculum: GraduationCap,
  weeks: CalendarRange,
  lesson_plans: BookOpenCheck,
  notes: NotebookPen,
  materials: FileText,
  elearning: MonitorPlay,
};
const WEEKLY: AISourceGroupKey[] = ["weeks", "lesson_plans", "elearning"];

/** What the AI can read in one run (server trims beyond this). */
export const SOURCE_CHAR_BUDGET = 80_000;

interface Props {
  data: AISourcesResponse | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  selected: Map<string, AISourceItem>;
  onToggle: (item: AISourceItem) => void;
  onSetMany: (items: AISourceItem[], on: boolean) => void;
  onClear: () => void;
  classGroupId: number | null;
  onClassGroupChange: (id: number) => void;
}

const SourcePicker: React.FC<Props> = ({
  data,
  loading,
  error,
  onRetry,
  selected,
  onToggle,
  onSetMany,
  onClear,
  classGroupId,
  onClassGroupChange,
}) => {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<AISourceGroupKey | "all">("all");

  const groups = useMemo(() => data?.groups ?? [], [data]);
  const visibleGroups = useMemo(
    () =>
      groups
        .filter((g) => active === "all" || g.key === active)
        .map((g) => ({ ...g, items: g.items.filter((i) => matchesQuery(i, query)) })),
    [groups, active, query],
  );
  const totalItems = groups.reduce((n, g) => n + g.items.length, 0);

  const selectedChars = [...selected.values()].reduce((n, s) => n + (s.chars_estimate ?? 0), 0);
  const unknownSized = [...selected.values()].filter((s) => s.chars_estimate === undefined).length;
  const budgetPct = Math.min(100, Math.round((selectedChars / SOURCE_CHAR_BUDGET) * 100));

  if (loading && !data) return <PickerSkeleton />;

  if (error && !data) {
    return (
      <div className="rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/10 p-6 text-center">
        <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
        <p className="text-sm font-medium text-red-700 dark:text-red-300">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-gray-800 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-100/60"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Try again
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 min-h-0">
      {/* Search + class group */}
      <div className="flex flex-col sm:flex-row gap-2">
        <label className="relative flex-1">
          <span className="sr-only">Search resources</span>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search topics, weeks, files…"
            className="w-full pl-9 pr-8 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 text-sm text-text-primary-light dark:text-text-primary-dark placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg text-gray-400 hover:text-gray-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </label>
        {(data?.scope.class_groups.length ?? 0) > 1 && (
          <Select variant="outline"
            aria-label="Class group"
            value={classGroupId ?? ""}
            onChange={(e) => onClassGroupChange(Number(e.target.value))}
          >
            {data!.scope.class_groups.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        )}
      </div>

      {/* Group filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin" role="tablist" aria-label="Resource type">
        <FilterChip active={active === "all"} onClick={() => setActive("all")} icon={Layers} label="All" count={totalItems} />
        {groups.map((g) => (
          <FilterChip
            key={g.key}
            active={active === g.key}
            onClick={() => setActive(g.key)}
            icon={GROUP_ICONS[g.key]}
            label={g.label}
            count={g.items.length}
            warn={g.status === "unavailable"}
            selectedCount={g.items.filter((i) => selected.has(sourceKey(i))).length}
          />
        ))}
      </div>

      {/* Selection summary */}
      <div>
        <div className="rounded-2xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/80 dark:bg-blue-950/40 px-3 py-2.5">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-blue-800 dark:text-blue-200" aria-live="polite">
              {selected.size ? `${selected.size} resource${selected.size === 1 ? "" : "s"} selected` : "Nothing selected yet"}
            </span>
            {selected.size > 0 && (
              <button type="button" onClick={onClear} className="text-blue-600 dark:text-blue-300 hover:underline">
                Clear
              </button>
            )}
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-blue-100 dark:bg-blue-900/50 overflow-hidden" aria-hidden>
            <div
              className={`h-full rounded-full transition-all ${budgetPct >= 100 ? "bg-amber-500" : "bg-blue-500"}`}
              style={{ width: `${Math.max(selected.size ? 3 : 0, budgetPct)}%` }}
            />
          </div>
          <p className="mt-1 text-[11px] text-blue-700/80 dark:text-blue-300/80">
            ~{Math.round(selectedChars / 1000)}k of {SOURCE_CHAR_BUDGET / 1000}k characters
            {unknownSized ? ` + ${unknownSized} file${unknownSized === 1 ? "" : "s"}/note${unknownSized === 1 ? "" : "s"} measured when read` : ""}
            {budgetPct >= 100 ? " — long items will be shortened evenly" : ""}
          </p>
        </div>
      </div>
      {loading && (
        <p className="text-xs text-blue-600 dark:text-blue-300 flex items-center gap-1.5">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Refreshing from the MIS…
        </p>
      )}

      {/* Lists */}
      <div className="space-y-5">
        {visibleGroups.map((g) => (
          <GroupSection
            key={g.key}
            group={g}
            query={query}
            selected={selected}
            onToggle={onToggle}
            onSetMany={onSetMany}
          />
        ))}
        {totalItems === 0 && !loading && (
          <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 p-8 text-center">
            <Layers className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
              No teaching resources found for this subject yet
            </p>
            <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-1">
              Add a scheme of work, lesson plans or materials in the MIS — or switch to “Upload a document”.
            </p>
          </div>
        )}
      </div>

    </div>
  );
};

const FilterChip: React.FC<{
  active: boolean;
  onClick: () => void;
  icon: LucideIcon;
  label: string;
  count: number;
  warn?: boolean;
  selectedCount?: number;
}> = ({ active, onClick, icon: Icon, label, count, warn, selectedCount }) => (
  <button
    type="button"
    role="tab"
    aria-selected={active}
    onClick={onClick}
    className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
      active
        ? "bg-blue-600 border-blue-600 text-white"
        : "bg-white dark:bg-gray-800/60 border-gray-200 dark:border-gray-700 text-text-secondary-light dark:text-text-secondary-dark hover:border-blue-400"
    }`}
  >
    <Icon className="w-3.5 h-3.5" />
    {label}
    <span className={`tabular-nums ${active ? "text-white/80" : "text-gray-400"}`}>{count}</span>
    {!!selectedCount && (
      <span className={`ml-0.5 px-1.5 rounded-full text-[10px] font-bold ${active ? "bg-white/25" : "bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-200"}`}>
        {selectedCount}✓
      </span>
    )}
    {warn && <AlertTriangle className="w-3 h-3 text-amber-500" />}
  </button>
);

const GroupSection: React.FC<{
  group: AISourceGroup;
  query: string;
  selected: Map<string, AISourceItem>;
  onToggle: (item: AISourceItem) => void;
  onSetMany: (items: AISourceItem[], on: boolean) => void;
}> = ({ group, query, selected, onToggle, onSetMany }) => {
  const Icon = GROUP_ICONS[group.key];
  const header = (
    <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark">
      <Icon className="w-3.5 h-3.5" /> {group.label}
    </h4>
  );

  if (group.status === "unavailable") {
    return (
      <section className="space-y-2">
        {header}
        <p className="text-xs rounded-xl px-3 py-2 bg-amber-50 dark:bg-amber-900/15 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50">
          {group.message}
        </p>
      </section>
    );
  }
  if (!group.items.length) {
    return query ? null : (
      <section className="space-y-2">
        {header}
        <p className="text-xs text-gray-400 px-1">None yet.</p>
      </section>
    );
  }

  if (!WEEKLY.includes(group.key)) {
    return (
      <section className="space-y-2">
        {header}
        <ItemGrid items={group.items} selected={selected} onToggle={onToggle} />
      </section>
    );
  }

  return (
    <section className="space-y-3">
      {header}
      {groupByWeek(group.items).map(({ week, items }) => {
        const pickable = items.filter((i) => i.supported);
        const allOn = pickable.length > 0 && pickable.every((i) => selected.has(sourceKey(i)));
        return (
          <div key={week || "none"} className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">
                <CalendarRange className="w-3 h-3" /> {week ? weekLabel(week) : "No week set"}
              </span>
              {pickable.length > 1 && (
                <button
                  type="button"
                  onClick={() => onSetMany(pickable, !allOn)}
                  className="text-[11px] font-medium text-blue-600 dark:text-blue-300 hover:underline"
                >
                  {allOn ? "Deselect week" : `Select all ${pickable.length}`}
                </button>
              )}
            </div>
            <ItemGrid items={items} selected={selected} onToggle={onToggle} />
          </div>
        );
      })}
    </section>
  );
};

const ItemGrid: React.FC<{
  items: AISourceItem[];
  selected: Map<string, AISourceItem>;
  onToggle: (item: AISourceItem) => void;
}> = ({ items, selected, onToggle }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-2">
    {items.map((item) => {
      const on = selected.has(sourceKey(item));
      return (
        <button
          key={sourceKey(item)}
          type="button"
          disabled={!item.supported}
          aria-pressed={on}
          onClick={() => onToggle(item)}
          title={item.supported ? undefined : item.reason}
          className={`group text-left flex gap-3 rounded-xl border p-3 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
            !item.supported
              ? "opacity-50 cursor-not-allowed border-gray-200 dark:border-gray-800"
              : on
                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/25 shadow-sm shadow-blue-500/10"
                : "border-gray-200 dark:border-gray-700/70 bg-white dark:bg-gray-800/40 hover:border-blue-300 dark:hover:border-blue-700"
          }`}
        >
          <span
            className={`mt-0.5 w-4 h-4 shrink-0 rounded-md border flex items-center justify-center transition-colors ${
              on ? "bg-blue-600 border-blue-600" : "border-gray-300 dark:border-gray-600 group-hover:border-blue-400"
            }`}
          >
            {on && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-text-primary-light dark:text-text-primary-dark line-clamp-2">
              {item.title}
            </span>
            {item.subtitle && (
              <span className="block text-xs text-text-secondary-light dark:text-text-secondary-dark line-clamp-2 mt-0.5">
                {item.subtitle}
              </span>
            )}
            {(item.meta?.length || !item.supported) && (
              <span className="flex flex-wrap gap-1 mt-1.5">
                {item.meta?.map((m) => (
                  <span key={m} className="text-[10px] px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700/60 text-gray-600 dark:text-gray-300">
                    {m}
                  </span>
                ))}
                {!item.supported && item.reason && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                    {item.reason}
                  </span>
                )}
              </span>
            )}
          </span>
        </button>
      );
    })}
  </div>
);

const PickerSkeleton = () => (
  <div className="space-y-3 animate-pulse" aria-label="Loading resources">
    <div className="h-9 rounded-xl bg-gray-100 dark:bg-gray-800" />
    <div className="flex gap-2">
      {[70, 110, 90, 100].map((w) => (
        <div key={w} className="h-7 rounded-full bg-gray-100 dark:bg-gray-800" style={{ width: w }} />
      ))}
    </div>
    {[0, 1, 2, 3].map((i) => (
      <div key={i} className="h-16 rounded-xl bg-gray-100 dark:bg-gray-800" />
    ))}
    <p className="text-xs text-gray-400 text-center">Loading your curriculum, weeks, lesson plans and materials from the MIS…</p>
  </div>
);

export default SourcePicker;

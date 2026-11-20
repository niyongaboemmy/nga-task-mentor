import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, ShieldCheck, X } from "lucide-react";
import { filtersFromParams, writeFilters, GENDER_LABEL, type GenderFilter } from "./broadsheetFilters";
import type { SchoolReports } from "../../services/reportCardWorkflowApi";
import EmptyState from "../ui/EmptyState";
import Select from "../ui/Select";
import { ExportActions, Section, StatTile } from "./shared";
import { markTone, pct } from "./format";

// Early-warning list: low average, several failed subjects, low attendance or
// a big drop since last term. Worst first (the server orders it).

type Filter = "all" | "high" | "medium";
type Reason = "all" | "average" | "failed" | "attendance" | "drop";
type Sort = "severity" | "average" | "attendance" | "name";

const REASON_LABEL: Record<Reason, string> = { all: "Any reason", average: "Low average", failed: "Failed subjects", attendance: "Low attendance", drop: "Dropped since last term" };
/** The server words each reason; sort them into kinds for filtering. */
const reasonKind = (r: string): Reason => (/attend/i.test(r) ? "attendance" : /fail/i.test(r) ? "failed" : /drop|down|fell/i.test(r) ? "drop" : "average");
const inputCls =
  "h-9 rounded-xl border border-border-light bg-card-light px-3 text-sm text-text-primary-light focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-border-dark/50 dark:bg-card-dark/30 dark:text-text-primary-dark";

const SEVERITY = {
  high: { label: "High", cls: "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300" },
  medium: { label: "Medium", cls: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300" },
} as const;

export default function AtRiskTab({ data, onExport }: { data: SchoolReports; onExport: () => void }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [reason, setReason] = useState<Reason>("all");
  const [sort, setSort] = useState<Sort>("severity");
  // Search, gender and classes are shared with the broadsheet (URL).
  const [params, setParams] = useSearchParams();
  const shared = filtersFromParams(params);
  const setShared = (patch: { q?: string; gender?: GenderFilter; classes?: string[] }) =>
    setParams((p) => writeFilters(p, { ...filtersFromParams(p), ...patch }), { replace: true });
  const list = data.at_risk;
  const high = list.filter((s) => s.severity === "high").length;
  const classOptions = useMemo(() => [...new Set(list.map((s) => s.class_name ?? "—"))].sort(), [list]);
  const rows = useMemo(() => {
    const q = shared.q.trim().toLowerCase();
    const out = list.filter(
      (s) =>
        (filter === "all" || s.severity === filter) &&
        (!q || s.name.toLowerCase().includes(q)) &&
        (shared.gender === "all" || s.gender === shared.gender) &&
        (!shared.classes.length || shared.classes.includes(s.class_name ?? "—")) &&
        (reason === "all" || s.reasons.some((r) => reasonKind(r) === reason)),
    );
    if (sort === "name") return [...out].sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "average") return [...out].sort((a, b) => (a.average ?? 101) - (b.average ?? 101));
    if (sort === "attendance") return [...out].sort((a, b) => (a.attendance_rate ?? 101) - (b.attendance_rate ?? 101));
    return out; // the server's order: worst first
  }, [list, filter, reason, sort, shared.q, shared.gender, shared.classes]);
  const narrowed = filter !== "all" || reason !== "all" || !!shared.q.trim() || shared.gender !== "all" || shared.classes.length > 0;

  if (list.length === 0) {
    return (
      <Section title="At risk" actions={<ExportActions what="the at-risk list" onCsv={onExport} disabled />}>
        <EmptyState
          icon={<ShieldCheck className="h-6 w-6" />}
          title="Nobody flagged as at risk"
          description={`No student is below the ${data.pass_mark}% pass mark, failing two or more subjects, under 85% attendance or down 10+ points.`}
        />
      </Section>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Flagged" value={list.length} hint={`of ${data.students} students`} />
        <StatTile label="High" value={high} tone={high > 0 ? "bad" : "default"} />
        <StatTile label="Medium" value={list.length - high} tone={list.length - high > 0 ? "warn" : "default"} />
      </div>

      <Section
        title="Students at risk"
        description="Average below the pass mark, 2+ failed subjects, attendance under 85% or a drop of 10+ points"
        actions={<ExportActions what="the at-risk list" onCsv={onExport} />}
     >
        <div className="mb-3 flex flex-wrap gap-1.5 print:hidden" role="group" aria-label="Filter by severity">
          {(["all", "high", "medium"] as const).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                filter === f
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-border-light text-text-secondary-light hover:border-blue-400 dark:border-border-dark/50 dark:text-text-secondary-dark"
              }`}
           >
              {f === "all" ? `All (${list.length})` : f === "high" ? `High (${high})` : `Medium (${list.length - high})`}
            </button>
          ))}
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-2 print:hidden">
          <label className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <span className="sr-only">Search at-risk students</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary-light dark:text-text-secondary-dark" />
            <input type="search" value={shared.q} onChange={(e) => setShared({ q: e.target.value })} placeholder="Search a student" className={`${inputCls} w-full pl-9`} />
          </label>
          <Select aria-label="Reason" value={reason} onChange={(e) => setReason(e.target.value as Reason)}>
            {(Object.keys(REASON_LABEL) as Reason[]).map((r) => (
              <option key={r} value={r}>
                {REASON_LABEL[r]}
              </option>
            ))}
          </Select>
          <Select aria-label="Gender" value={shared.gender} onChange={(e) => setShared({ gender: e.target.value as GenderFilter })}>
            {(["all", "female", "male", "unknown"] as GenderFilter[]).map((g) => (
              <option key={g} value={g}>
                {GENDER_LABEL[g]}
              </option>
            ))}
          </Select>
          {classOptions.length > 1 && (
            <Select
              aria-label="Class"
              value={shared.classes.length === 1 ? shared.classes[0] : ""}
              onChange={(e) => setShared({ classes: e.target.value ? [e.target.value] : [] })}
              className={inputCls}
           >
              <option value="">{shared.classes.length > 1 ? `${shared.classes.length} classes` : "All classes"}</option>
              {classOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          )}
          <Select aria-label="Sort by" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="severity">Worst first</option>
            <option value="average">Lowest average</option>
            <option value="attendance">Lowest attendance</option>
            <option value="name">Name A–Z</option>
          </Select>
          {narrowed && (
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline dark:text-blue-300"
              onClick={() => {
                setFilter("all");
                setReason("all");
                setShared({ q: "", gender: "all", classes: [] });
              }}
           >
              <X className="h-3 w-3" aria-hidden /> Clear ({rows.length} of {list.length})
            </button>
          )}
        </div>
        {rows.length === 0 && (
          <p className="py-8 text-center text-sm text-text-secondary-light dark:text-text-secondary-dark">No flagged student matches these filters.</p>
        )}

        <ul className="divide-y divide-border-light dark:divide-border-dark/30">
          {rows.map((s) => (
            <li key={s.student_id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start print:break-inside-avoid">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${SEVERITY[s.severity].cls}`}>
                    {SEVERITY[s.severity].label}
                  </span>
                  <span className="font-semibold text-text-primary-light dark:text-text-primary-dark">{s.name}</span>
                  <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                    {[s.class_name, s.gender === "unknown" ? null : s.gender === "female" ? "Girl" : "Boy"].filter(Boolean).join(" · ")}
                  </span>
                </div>
                <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-sm text-text-secondary-light dark:text-text-secondary-dark">
                  {s.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
                {s.failed_subjects.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {s.failed_subjects.map((f) => (
                      <span key={f} className="rounded-md border border-red-200 px-1.5 py-0.5 text-[11px] font-medium text-red-700 dark:border-red-900/50 dark:text-red-300">
                        {f}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <dl className="grid flex-shrink-0 grid-cols-2 gap-x-4 text-xs sm:text-right">
                <div>
                  <dt className="text-text-secondary-light dark:text-text-secondary-dark">Average</dt>
                  <dd className={`text-sm font-bold tabular-nums ${markTone(s.average, data.pass_mark) || "text-text-primary-light dark:text-text-primary-dark"}`}>
                    {pct(s.average)}
                  </dd>
                </div>
                <div>
                  <dt className="text-text-secondary-light dark:text-text-secondary-dark">Attendance</dt>
                  <dd
                    className={`text-sm font-bold tabular-nums ${
                      s.attendance_rate != null && s.attendance_rate < 85 ? "text-red-600 dark:text-red-400" : "text-text-primary-light dark:text-text-primary-dark"
                    }`}
                 >
                    {pct(s.attendance_rate)}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

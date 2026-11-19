import { useMemo, useState } from "react";
import { ShieldCheck } from "lucide-react";
import type { SchoolReports } from "../../services/reportCardWorkflowApi";
import EmptyState from "../ui/EmptyState";
import { ExportActions, Section, StatTile } from "./shared";
import { markTone, pct } from "./format";

// Early-warning list: low average, several failed subjects, low attendance or
// a big drop since last term. Worst first (the server orders it).

type Filter = "all" | "high" | "medium";

const SEVERITY = {
  high: { label: "High", cls: "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300" },
  medium: { label: "Medium", cls: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300" },
} as const;

export default function AtRiskTab({ data, onExport }: { data: SchoolReports; onExport: () => void }) {
  const [filter, setFilter] = useState<Filter>("all");
  const list = data.at_risk;
  const high = list.filter((s) => s.severity === "high").length;
  const rows = useMemo(() => (filter === "all" ? list : list.filter((s) => s.severity === filter)), [list, filter]);

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

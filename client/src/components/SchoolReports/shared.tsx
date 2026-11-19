import React from "react";
import { Download, Printer } from "lucide-react";
import { Skeleton } from "../ui/Skeleton";
import { actionBtn, round1 } from "./format";

// ─── School reports: shared bits ──────────────────────────────────────────────
// Tiles, div bars, export buttons and skeletons used by every tab of
// /reports/school. Flat surfaces with borders (no shadows, no accent strips),
// blue as the only accent; emerald / amber / red carry meaning only.

// ─── Layout ──────────────────────────────────────────────────────────────────

export const Section: React.FC<{
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ title, description, actions, children, className = "" }) => (
  <section
    className={`rounded-2xl border border-border-light bg-card-light p-4 dark:border-border-dark/40 dark:bg-card-dark/30 sm:p-5 print:break-inside-avoid print:rounded-none print:border-gray-300 print:p-2 ${className}`}
  >
    <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <h2 className="text-sm font-bold text-text-primary-light dark:text-text-primary-dark">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-text-secondary-light dark:text-text-secondary-dark">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 print:hidden">{actions}</div>}
    </div>
    {children}
  </section>
);

export const StatTile: React.FC<{
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "default" | "good" | "warn" | "bad";
}> = ({ label, value, hint, tone = "default" }) => {
  const valueTone = {
    default: "text-text-primary-light dark:text-text-primary-dark",
    good: "text-emerald-700 dark:text-emerald-400",
    warn: "text-amber-700 dark:text-amber-400",
    bad: "text-red-600 dark:text-red-400",
  }[tone];
  return (
    <div className="rounded-xl border border-border-light bg-card-light p-3 dark:border-border-dark/40 dark:bg-card-dark/30 sm:p-4 print:break-inside-avoid">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark">{label}</p>
      <p className={`mt-1 text-xl font-bold tabular-nums sm:text-2xl ${valueTone}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-text-secondary-light dark:text-text-secondary-dark">{hint}</p>}
    </div>
  );
};

const BAR_TONE = {
  blue: "bg-blue-600 dark:bg-blue-500",
  soft: "bg-blue-300 dark:bg-blue-400/60",
  good: "bg-emerald-500",
  bad: "bg-red-500",
} as const;

/** A horizontal bar drawn with divs (no chart library). */
export const Bar: React.FC<{
  value: number | null | undefined;
  max?: number;
  tone?: keyof typeof BAR_TONE;
  label?: string;
  className?: string;
}> = ({ value, max = 100, tone = "blue", label, className = "" }) => {
  const width = value == null || max <= 0 ? 0 : Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div
      className={`h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/10 ${className}`}
      role="img"
      aria-label={label ?? (value == null ? "No data" : `${round1(value)} of ${max}`)}
    >
      <div className={`h-full rounded-full ${BAR_TONE[tone]}`} style={{ width: `${width}%` }} />
    </div>
  );
};

// ─── Actions ─────────────────────────────────────────────────────────────────

/** "Export CSV" + "Print / PDF" — on every tab, hidden on paper. */
export const ExportActions: React.FC<{ onCsv: () => void; disabled?: boolean; what: string }> = ({ onCsv, disabled, what }) => (
  <div className="flex flex-wrap items-center gap-2 print:hidden">
    <button type="button" className={actionBtn} onClick={onCsv} disabled={disabled} aria-label={`Export ${what} as CSV`}>
      <Download className="h-3.5 w-3.5" aria-hidden /> Export CSV
    </button>
    <button type="button" className={actionBtn} onClick={() => window.print()} aria-label={`Print ${what} or save as PDF`}>
      <Printer className="h-3.5 w-3.5" aria-hidden /> Print / PDF
    </button>
  </div>
);

// ─── Loading ─────────────────────────────────────────────────────────────────

export const ReportsSkeleton: React.FC = () => (
  <div className="space-y-4" aria-hidden="true">
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="rounded-xl border border-border-light p-4 dark:border-border-dark/40">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-3 h-7 w-16" />
        </div>
      ))}
    </div>
    <div className="rounded-2xl border border-border-light p-4 dark:border-border-dark/40">
      <Skeleton className="h-4 w-40" />
      <div className="mt-4 space-y-2.5">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-6 w-full" />
        ))}
      </div>
    </div>
  </div>
);

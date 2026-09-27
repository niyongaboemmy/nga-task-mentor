import React from "react";
import { bandMeta, bandOf } from "../../../services/subjectReportApi";
import { SELECT, type ProfileSubject } from "./profileTheme";

// Small building blocks shared by the student profile tabs.

/** A percentage in its score-band colour, or a dash when there's no mark. */
export function Pct({ value, className = "" }: { value: number | null | undefined; className?: string }) {
  if (value === null || value === undefined) {
    return <span className={`text-text-secondary-light dark:text-text-secondary-dark/50 ${className}`}>—</span>;
  }
  return (
    <span className={`tabular-nums ${className}`} style={{ color: bandMeta(bandOf(value)).color }}>
      {value}%
    </span>
  );
}

export function BandChip({ value }: { value: number | null }) {
  if (value === null) return null;
  const band = bandMeta(bandOf(value));
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ color: band.color, backgroundColor: `${band.color}1a` }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: band.color }} />
      {band.label}
    </span>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: Array<{ value: T; label: string; count?: number }>;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex p-0.5 rounded-full bg-gray-100 dark:bg-white/5 max-w-full overflow-x-auto"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`whitespace-nowrap px-3 h-8 rounded-full text-xs font-semibold transition-colors ${
              active
                ? "bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-300 shadow-sm"
                : "text-text-secondary-light dark:text-text-secondary-dark/70 hover:text-text-primary-light dark:hover:text-text-primary-dark"
            }`}
          >
            {o.label}
            {typeof o.count === "number" && (
              <span className="ml-1.5 tabular-nums opacity-70">{o.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function SubjectSelect({
  subjects,
  value,
  onChange,
  allLabel = "All subjects",
}: {
  subjects: ProfileSubject[];
  value: string | null;
  onChange: (courseId: string | null) => void;
  allLabel?: string;
}) {
  return (
    <select
      aria-label="Subject"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      className={SELECT}
    >
      <option value="">{allLabel}</option>
      {subjects.map((s) => (
        <option key={s.courseId} value={s.courseId}>
          {s.name}
        </option>
      ))}
    </select>
  );
}

/** Horizontal meter with an optional reference tick (e.g. class average). */
export function Meter({
  value,
  reference,
  referenceLabel = "Class average",
  color: fixedColor,
}: {
  value: number | null;
  reference?: number | null;
  referenceLabel?: string;
  /** Overrides the score-band colour (e.g. for a progress bar, where 50% isn't "fair"). */
  color?: string;
}) {
  const color = fixedColor ?? (value === null ? undefined : bandMeta(bandOf(value)).color);
  return (
    <div className="relative h-1.5 rounded-full bg-gray-100 dark:bg-white/10">
      {value !== null && (
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${Math.min(100, Math.max(0, value))}%`, backgroundColor: color }}
        />
      )}
      {reference !== null && reference !== undefined && (
        <span
          title={`${referenceLabel}: ${reference}%`}
          className="absolute -top-1 -bottom-1 w-0.5 rounded bg-gray-500 dark:bg-gray-300"
          style={{ left: `calc(${Math.min(100, Math.max(0, reference))}% - 1px)` }}
        />
      )}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="text-center py-14 px-4">
      <div className="w-12 h-12 mx-auto rounded-2xl bg-gray-100 dark:bg-white/5 flex items-center justify-center mb-3">
        <Icon className="w-6 h-6 text-gray-400 dark:text-gray-500" />
      </div>
      <h3 className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">{title}</h3>
      {children && (
        <p className="mt-1 text-xs text-text-secondary-light dark:text-text-secondary-dark/70 max-w-sm mx-auto">
          {children}
        </p>
      )}
    </div>
  );
}

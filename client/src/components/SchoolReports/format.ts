// ─── School reports: formatting and class names ──────────────────────────────
// Plain helpers (no components) so shared.tsx stays fast-refresh friendly.

export const round1 = (n: number) => Math.round(n * 10) / 10;

/** 61.25 → "61.3", null → "—". */
export const num = (n: number | null | undefined): string => (n == null || !Number.isFinite(n) ? "—" : String(round1(n)));

/** 61.25 → "61.3%", null → "—". */
export const pct = (n: number | null | undefined): string => (n == null || !Number.isFinite(n) ? "—" : `${round1(n)}%`);

/** 3.2 → "+3.2", -1 → "-1", 0 → "0", null → "—". */
export const signed = (n: number | null | undefined): string =>
  n == null || !Number.isFinite(n) ? "—" : `${n > 0 ? "+" : ""}${round1(n)}`;

/** "3/40", or "—". */
export const position = (p: number | null, of: number | null) => (p == null ? "—" : of ? `${p}/${of}` : String(p));

/** The headline sentence for a female − male gap: "Girls +3.2 vs boys". */
export const gapText = (gap: number | null, unit = "") => {
  if (gap == null) return "Not enough marks for both genders";
  if (round1(gap) === 0) return "Girls and boys level";
  return `Girls ${signed(gap)}${unit} vs boys`;
};

/** Red text below the pass mark — meaning, not decoration. */
export const markTone = (value: number | null | undefined, passMark: number) =>
  value == null ? "text-text-secondary-light dark:text-text-secondary-dark" : value < passMark ? "text-red-600 dark:text-red-400" : "";

// ─── Tables ──────────────────────────────────────────────────────────────────

export const tableWrap = "-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0 print:mx-0 print:overflow-visible print:px-0";
// Text colour sits on the table so a cell can override it (red below the pass mark).
export const tableCls = "w-full border-collapse text-sm text-text-primary-light dark:text-text-primary-dark print:text-[10px]";
export const th =
  "whitespace-nowrap border-b border-border-light px-2.5 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-text-secondary-light dark:border-border-dark/40 dark:text-text-secondary-dark print:px-1 print:py-1";
export const thNum = `${th} text-right`;
export const td =
  "whitespace-nowrap border-b border-border-light/70 px-2.5 py-2 dark:border-border-dark/30 print:px-1 print:py-0.5";
export const tdNum = `${td} text-right tabular-nums`;

// ─── Buttons ─────────────────────────────────────────────────────────────────

export const actionBtn =
  "inline-flex items-center gap-1.5 rounded-lg border border-border-light bg-card-light px-3 py-1.5 text-xs font-semibold text-text-primary-light transition-colors hover:border-blue-400 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:cursor-not-allowed disabled:opacity-50 dark:border-border-dark/50 dark:bg-card-dark/30 dark:text-text-primary-dark dark:hover:text-blue-300";

export const secondaryBtn = actionBtn;

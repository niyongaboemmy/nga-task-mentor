import type { AssessmentCategory } from "../../services/reportCardApi";

// ─── Shared report-card category config (both builders) ──────────────────────────────────────
// Single source of truth for the report-card categories, their weights, and
// their colors — used by ReportCardBuilder's drag-drop UI and by
// AssessmentMappingControl (the quick-map dropdown used on the Grades page),
// so the two surfaces never drift out of sync.

export interface CategoryMeta {
  label: string;
  shortLabel: string;
  weight: number;
  bg: string;
  border: string;
  badge: string;
  dot: string;
  ring: string;
}

// Dark-mode fills are deliberately subtle (near-background) — category
// identity comes from the full border + dot + badge, not a bright
// background wash. A saturated fill covering a whole card reads as "light
// card dropped onto a dark page"; a near-black card with a defined border
// reads as a native part of the dark surface.
export const CATEGORIES: Record<AssessmentCategory, CategoryMeta> = {
  CW: {
    label: "Class Work",
    shortLabel: "CW",
    weight: 15,
    bg: "bg-blue-50 dark:bg-blue-950/25",
    border: "border-blue-200 dark:border-blue-800/60",
    badge: "bg-blue-600 text-white",
    dot: "bg-blue-500 dark:bg-blue-400",
    ring: "ring-blue-500/40",
  },
  HW: {
    label: "Homework",
    shortLabel: "HW",
    weight: 10,
    bg: "bg-gray-50 dark:bg-slate-900/40",
    border: "border-gray-200 dark:border-slate-600/60",
    badge: "bg-gray-500 text-white",
    dot: "bg-gray-400 dark:bg-slate-400",
    ring: "ring-gray-400/40",
  },
  MD: {
    label: "Mid-Term",
    shortLabel: "MD",
    weight: 25,
    bg: "bg-blue-100/70 dark:bg-blue-900/20",
    border: "border-blue-300 dark:border-blue-700/60",
    badge: "bg-blue-700 text-white",
    dot: "bg-blue-600 dark:bg-blue-300",
    ring: "ring-blue-400/40",
  },
  EOT: {
    label: "End of Term",
    shortLabel: "EOT",
    weight: 50,
    bg: "bg-orange-50 dark:bg-orange-950/20",
    border: "border-orange-200 dark:border-orange-800/60",
    badge: "bg-orange-600 text-white",
    dot: "bg-orange-500 dark:bg-orange-400",
    ring: "ring-orange-500/40",
  },
  FA: {
    label: "Formative Assessment",
    shortLabel: "FA",
    weight: 100,
    bg: "bg-blue-50 dark:bg-blue-950/25",
    border: "border-blue-200 dark:border-blue-800/60",
    badge: "bg-blue-600 text-white",
    dot: "bg-blue-500 dark:bg-blue-400",
    ring: "ring-blue-500/40",
  },
  CA: {
    label: "Comprehensive Assessment",
    shortLabel: "CA",
    weight: 100,
    bg: "bg-orange-50 dark:bg-orange-950/20",
    border: "border-orange-200 dark:border-orange-800/60",
    badge: "bg-orange-600 text-white",
    dot: "bg-orange-500 dark:bg-orange-400",
    ring: "ring-orange-500/40",
  },
  IA: {
    label: "Integrated Assessment",
    shortLabel: "IA",
    weight: 100,
    bg: "bg-blue-50/60 dark:bg-blue-950/30",
    border: "border-blue-300 dark:border-blue-700/60",
    badge: "bg-blue-900 text-white",
    dot: "bg-blue-900 dark:bg-blue-200",
    ring: "ring-blue-700/40",
  },
};

/** The Normal builder's categories (the active builder's come from useReportCardStructure). */
export const CATEGORY_ORDER: AssessmentCategory[] = ["CW", "HW", "MD", "EOT"];
export const ALL_CATEGORIES: AssessmentCategory[] = ["CW", "HW", "MD", "EOT", "FA", "CA", "IA"];

/** An empty category -> items record covering every category of both builders. */
export function emptyByCategory<T>(): Record<AssessmentCategory, T[]> {
  return { CW: [], HW: [], MD: [], EOT: [], FA: [], CA: [], IA: [] };
}

/** How a category's weight reads: "15%" in Normal, "/ weight" in TVET (out of the module weight). */
export function weightLabel(builder: "normal" | "tvet", weight: number): string {
  return builder === "tvet" ? "/ weight" : `${weight}%`;
}

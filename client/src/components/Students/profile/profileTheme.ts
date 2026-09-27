import { ClipboardCheck, ClipboardList, HelpCircle, type LucideIcon } from "lucide-react";
import type { ActivityKind, Tone } from "../../../services/studentActivity";
import type { StandingKindFilter } from "../../../services/studentStandingApi";

// Shared presentation for the student profile. Kept out of the .tsx files so
// those export components only (React Fast Refresh).

export const TONE_CLASSES: Record<Tone, { chip: string; icon: string; soft: string; dot: string }> = {
  danger: {
    chip: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/30",
    icon: "text-red-600 dark:text-red-400",
    soft: "bg-red-50 dark:bg-red-500/10",
    dot: "bg-red-500",
  },
  warning: {
    chip: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30",
    icon: "text-amber-600 dark:text-amber-400",
    soft: "bg-amber-50 dark:bg-amber-500/10",
    dot: "bg-amber-500",
  },
  info: {
    chip: "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/30",
    icon: "text-blue-600 dark:text-blue-400",
    soft: "bg-blue-50 dark:bg-blue-500/10",
    dot: "bg-blue-500",
  },
  success: {
    chip: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30",
    icon: "text-emerald-600 dark:text-emerald-400",
    soft: "bg-emerald-50 dark:bg-emerald-500/10",
    dot: "bg-emerald-500",
  },
  neutral: {
    chip: "bg-gray-100 text-gray-600 ring-gray-200 dark:bg-white/5 dark:text-gray-300 dark:ring-white/10",
    icon: "text-gray-500 dark:text-gray-400",
    soft: "bg-gray-100 dark:bg-white/5",
    dot: "bg-gray-400",
  },
};

export const KIND_META: Record<ActivityKind, { label: string; plural: string; icon: LucideIcon }> = {
  assignment: { label: "Assignment", plural: "Assignments", icon: ClipboardList },
  quiz: { label: "Quiz", plural: "Quizzes", icon: HelpCircle },
  recorded: { label: "Recorded assessment", plural: "Recorded", icon: ClipboardCheck },
};

export const CARD =
  "rounded-2xl border border-gray-200/70 dark:border-gray-800 bg-white dark:bg-gray-900/40";

export const SELECT =
  "h-9 pl-3 pr-8 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-text-primary-light dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-blue-500/30 max-w-full";

export interface ProfileSubject {
  courseId: string;
  name: string;
  code: string;
}

export const KIND_OPTIONS: Array<{ value: StandingKindFilter; label: string }> = [
  { value: "all", label: "All work" },
  { value: "assignment", label: "Assignments" },
  { value: "quiz", label: "Quizzes" },
  { value: "recorded", label: "Recorded" },
];

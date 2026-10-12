import React from "react";

/**
 * Status colours (CODE_RUNNER_PLAN.md §6.5), the same rule as TMCode:
 * success = done/passed, attention = needs action, danger = error/late,
 * info = submitted/running, neutral = not started.
 */
export type BadgeTone = "success" | "attention" | "danger" | "info" | "neutral";

const TONES: Record<BadgeTone, string> = {
  success: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  attention: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  danger: "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300",
  info: "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300",
  neutral: "bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300",
};

export const Badge: React.FC<{ tone?: BadgeTone; children: React.ReactNode; icon?: React.ReactNode; className?: string; testId?: string }> = ({
  tone = "neutral",
  children,
  icon,
  className = "",
  testId,
}) => (
  <span
    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONES[tone]} ${className}`}
    data-testid={testId}
  >
    {icon}
    {children}
  </span>
);

export default Badge;

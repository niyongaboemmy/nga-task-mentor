import React from "react";
import { Bot, Lock, Sparkles } from "lucide-react";
import Badge, { type BadgeTone } from "../ui/Badge";
import { AI_MODE_OPTIONS, type AiMode } from "../../services/aiApi";
import { useAiPolicy } from "../../hooks/useAiAccess";

/**
 * AI usage control UI (AI_USAGE_CONTROL_PLAN.md §5.6-5.8):
 *   AiModeControl  the teacher's "AI assistance for students" setting
 *   AiModeBadge    "AI: Off / Hints / Full" on quiz and assignment lists/details
 *   AiReasonChip   why AI isn't available here (student views)
 */

export const AI_DISABLED_BY_ADMIN = "Disabled by the school administrator";

export const AiModeControl: React.FC<{
  value: AiMode;
  onChange: (mode: AiMode) => void;
  /** Prefix for element ids (e.g. "quiz" → quiz-ai_mode). */
  idPrefix: string;
  /** "an assignment" / "this quiz" in the help text. */
  itemLabel?: string;
}> = ({ value, onChange, idPrefix, itemLabel = "it" }) => {
  const { policy } = useAiPolicy();
  // Shown but disabled when the school has AI off or locks every assessment:
  // the teacher's choice is kept for when it is switched back on.
  const locked = !!policy && !policy.itemModes;
  const current = AI_MODE_OPTIONS.find((o) => o.value === value) ?? AI_MODE_OPTIONS[0];
  return (
    <div className="space-y-1.5" data-testid={`${idPrefix}-ai-mode`}>
      <span id={`${idPrefix}-ai_mode-label`} className="block text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
        AI assistance for students
      </span>
      <div
        role="radiogroup"
        aria-labelledby={`${idPrefix}-ai_mode-label`}
        aria-describedby={`${idPrefix}-ai_mode-help`}
        aria-disabled={locked || undefined}
        className={`inline-flex flex-wrap gap-1 rounded-xl bg-gray-100 dark:bg-gray-800 p-1 ${locked ? "opacity-60" : ""}`}
      >
        {AI_MODE_OPTIONS.map((o) => (
          <button
            key={o.value}
            id={`${idPrefix}-ai_mode-${o.value}`}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            disabled={locked}
            onClick={() => onChange(o.value)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed ${
              value === o.value
                ? "bg-white dark:bg-gray-900 shadow text-text-primary-light dark:text-text-primary-dark"
                : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            {o.value === "off" ? <Lock className="w-3.5 h-3.5" aria-hidden /> : o.value === "hints" ? <Sparkles className="w-3.5 h-3.5" aria-hidden /> : <Bot className="w-3.5 h-3.5" aria-hidden />}
            {o.label}
          </button>
        ))}
      </div>
      <p id={`${idPrefix}-ai_mode-help`} className="text-xs text-text-secondary-light dark:text-text-secondary-dark/80">
        {locked ? (
          <>
            <span className="font-medium text-amber-700 dark:text-amber-300">{AI_DISABLED_BY_ADMIN}.</span>{" "}
            Your choice is kept for when AI is turned back on.
          </>
        ) : (
          <>
            {current.help} Applies while students work on {itemLabel}; your own AI tools aren't affected.
          </>
        )}
      </p>
    </div>
  );
};

const BADGE_TONE: Record<AiMode, BadgeTone> = { off: "neutral", hints: "info", full: "success" };

export const AiModeBadge: React.FC<{ mode?: AiMode | null; className?: string }> = ({ mode, className }) => {
  const m: AiMode = mode === "hints" || mode === "full" ? mode : "off";
  const label = AI_MODE_OPTIONS.find((o) => o.value === m)!.short;
  return (
    <Badge tone={BADGE_TONE[m]} className={className} testId="ai-mode-badge" icon={<Bot className="w-3 h-3" aria-hidden />}>
      AI: {label}
    </Badge>
  );
};

export const AiReasonChip: React.FC<{ message: string; className?: string }> = ({ message, className = "" }) => (
  <span
    className={`inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-white/10 dark:text-gray-300 ${className}`}
    data-testid="ai-reason-chip"
    title={message}
  >
    <Lock className="w-3 h-3" aria-hidden />
    {message}
  </span>
);

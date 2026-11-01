import React from "react";
import { Bot, Lock, Sparkles } from "lucide-react";
import Badge, { type BadgeTone } from "../ui/Badge";
import { AI_MODE_OPTIONS, type AiHelp, type AiMode } from "../../services/aiApi";
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

/**
 * What each layer lets the teacher tune (proposal §8.3, A4, A11): Learning's help strength,
 * pseudo-code, tiny syntax examples and question allowance; Industrial's "students' own AI tools".
 * For a quiz with AI the session is a timed task, not an exam (D9).
 */
export const AiLayerOptions: React.FC<{
  mode: AiMode;
  help: AiHelp;
  onHelp: (h: AiHelp) => void;
  ownTools: boolean;
  onOwnTools: (v: boolean) => void;
  idPrefix: string;
  /** A quiz: say that AI makes it a timed task. */
  quiz?: boolean;
}> = ({ mode, help, onHelp, ownTools, onOwnTools, idPrefix, quiz }) => {
  if (mode === "off") return null;
  const box = "rounded-xl border border-gray-200 dark:border-gray-700 p-3 space-y-3 text-sm";
  const label = "text-text-primary-light dark:text-text-primary-dark";
  const hint = "text-xs text-text-secondary-light dark:text-text-secondary-dark/80";
  return (
    <div className={box} data-testid={`${idPrefix}-ai-layer-options`}>
      {quiz && <p className={hint}>With AI on, TMCode shows this quiz as a <strong>timed task</strong>, not an exam: exams are always No AI.</p>}
      {mode === "hints" ? (
        <>
          <fieldset className="space-y-1.5">
            <legend className={`font-medium ${label}`}>Help strength</legend>
            <div className="flex flex-wrap gap-3">
              {(
                [
                  ["hints", "Hints", "Questions and nudges only"],
                  ["tutor", "Tutor", "Also explains concepts, errors and reviews code, in words"],
                ] as const
              ).map(([v, l, d]) => (
                <label key={v} className="inline-flex items-start gap-2 cursor-pointer" title={d}>
                  <input type="radio" name={`${idPrefix}-ai-strength`} checked={help.strength === v} onChange={() => onHelp({ ...help, strength: v })} data-testid={`${idPrefix}-ai-strength-${v}`} />
                  <span>
                    <span className={label}>{l}</span> <span className={hint}>{d}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={help.pseudo} onChange={(e) => onHelp({ ...help, pseudo: e.target.checked })} data-testid={`${idPrefix}-ai-pseudo`} />
            <span className={label}>Pseudo-code in words</span>
            <span className={hint}>("loop over the list; keep the largest so far")</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={help.syntax} onChange={(e) => onHelp({ ...help, syntax: e.target.checked })} data-testid={`${idPrefix}-ai-syntax`} />
            <span className={label}>Tiny generic syntax examples</span>
            <span className={hint}>(at most 2 lines, never the students' own names)</span>
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <span className={label}>Questions:</span>
            <input
              type="number"
              min={1}
              max={100}
              className="w-16 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent px-2 py-1"
              value={help.allowance.max}
              onChange={(e) => onHelp({ ...help, allowance: { ...help.allowance, max: Math.max(1, Math.min(100, Number(e.target.value) || 1)) } })}
              aria-label="Questions a student can ask in a row"
              data-testid={`${idPrefix}-ai-allowance-max`}
            />
            <span className={hint}>in a row, one more every</span>
            <input
              type="number"
              min={0.5}
              max={120}
              step={0.5}
              className="w-16 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent px-2 py-1"
              value={help.allowance.regain_minutes}
              onChange={(e) => onHelp({ ...help, allowance: { ...help.allowance, regain_minutes: Math.max(0.5, Math.min(120, Number(e.target.value) || 3)) } })}
              aria-label="Minutes until one more question"
              data-testid={`${idPrefix}-ai-allowance-minutes`}
            />
            <span className={hint}>minutes (a pause to think is part of learning)</span>
          </div>
        </>
      ) : (
        <label className="flex items-start gap-2 cursor-pointer">
          <input type="checkbox" checked={ownTools} onChange={(e) => onOwnTools(e.target.checked)} data-testid={`${idPrefix}-ai-own-tools`} className="mt-1" />
          <span>
            <span className={label}>Allow students' own AI tools</span>{" "}
            <span className={hint}>(Industrial · Open: Claude Code, Copilot, AI command-line tools and own keys. They bypass the school's logging and limits; best for S5–S6 and TVET.)</span>
          </span>
        </label>
      )}
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

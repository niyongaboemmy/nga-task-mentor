import { ProctoringSettings, Quiz } from "../models";
import type { TmcodeDelivery } from "../models/ProctoringSettings.model";
import { aiAppEnabled, normalizeAiMode, type AiMode } from "../vendor/nga-access";
import { getAiPolicy } from "../services/aiPolicy";

/**
 * TMCode delivery and policy for a quiz (plan §10.1): stored on
 * proctoring_settings (tmcode_delivery, tmcode_policy). Mirrors
 * nga-tmcode/packages/protocol/src/policy.ts.
 */

export type Mode = "practice" | "monitored" | "secure";

export interface Policy {
  mode: Mode;
  intelligence: "none" | "basic" | "diagnostics" | "full";
  paste: "allow" | "internal_only" | "block";
  terminal: "off" | "restricted" | "full";
  internet_in_preview: boolean;
  require_seb: boolean;
  allow_offline_grace_minutes: number;
  locked_settings: string[];
  /**
   * AI in the exam (AI_USAGE_CONTROL_PLAN.md §6): the quiz's ai_mode as the teacher set it,
   * or "off" while the school's AI policy refuses (master off, Task Mentor/TMCode off, or
   * every assessment locked). Never taken from the stored tmcode_policy.
   */
  ai: AiMode;
}

export const EXAM_POLICY_DEFAULTS: Policy = {
  mode: "monitored",
  intelligence: "basic",
  paste: "internal_only",
  terminal: "off",
  internet_in_preview: false,
  require_seb: false,
  allow_offline_grace_minutes: 10,
  locked_settings: [],
  ai: "off",
};

const pick = <T extends string>(v: unknown, allowed: readonly T[], dflt: T): T =>
  typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : dflt;

/** A stored tmcode_policy (any shape) as a complete, valid Policy. */
export function normalizePolicy(raw: unknown, lockdownBrowser = false): Policy {
  const p = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const d = EXAM_POLICY_DEFAULTS;
  const mode = pick(p.mode, ["practice", "monitored", "secure"] as const, d.mode);
  const grace = Math.round(Number(p.allow_offline_grace_minutes));
  return {
    mode,
    intelligence: pick(p.intelligence, ["none", "basic", "diagnostics", "full"] as const, d.intelligence),
    paste: pick(p.paste, ["allow", "internal_only", "block"] as const, d.paste),
    // A full terminal is for practice only (plan §8.2).
    terminal:
      mode === "practice"
        ? pick(p.terminal, ["off", "restricted", "full"] as const, d.terminal)
        : pick(p.terminal, ["off", "restricted"] as const, d.terminal),
    internet_in_preview:
      typeof p.internet_in_preview === "boolean" ? p.internet_in_preview : d.internet_in_preview,
    require_seb: p.require_seb === true || lockdownBrowser,
    allow_offline_grace_minutes:
      Number.isFinite(grace) && grace >= 0 ? Math.min(30, grace) : d.allow_offline_grace_minutes,
    locked_settings: Array.isArray(p.locked_settings)
      ? p.locked_settings.filter((s): s is string => typeof s === "string")
      : [],
    ai: "off",
  };
}

/** The exam's `ai`: the quiz's ai_mode unless the school policy refuses AI in assessments. */
export async function examAiMode(quizId: number): Promise<AiMode> {
  const policy = await getAiPolicy();
  if (!aiAppEnabled(policy, "tm") || !aiAppEnabled(policy, "tmcode") || policy!.assessments === "always_off") {
    return "off";
  }
  const quiz = await Quiz.findByPk(quizId, { attributes: ["id", "ai_mode"] });
  return normalizeAiMode(quiz?.ai_mode);
}

export interface QuizTmcodeSettings {
  delivery: TmcodeDelivery;
  policy: Policy;
}

export async function tmcodeSettingsFor(quizId: number): Promise<QuizTmcodeSettings> {
  const s = await ProctoringSettings.findOne({
    where: { quiz_id: quizId },
    attributes: ["enabled", "lockdown_browser", "tmcode_delivery", "tmcode_policy"],
  });
  const delivery = (s?.tmcode_delivery as TmcodeDelivery) || "web";
  const policy = normalizePolicy(s?.tmcode_policy, !!s?.enabled && !!s?.lockdown_browser);
  if (delivery !== "web") policy.ai = await examAiMode(quizId);
  return { delivery, policy };
}

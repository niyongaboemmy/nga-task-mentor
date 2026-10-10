import { ProctoringSettings } from "../models";
import type { TmcodeDelivery } from "../models/ProctoringSettings.model";

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
  /** Run and Debug (breakpoints, stepping) in the exam. Off unless the teacher turns it on. */
  debugger: boolean;
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
  debugger: false,
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
    debugger: p.debugger === true,
  };
}

export interface QuizTmcodeSettings {
  delivery: TmcodeDelivery;
  policy: Policy;
  /** Oldest TMCode version allowed for this exam; null = any. */
  min_app_version: string | null;
}

const VERSION = /^\d+\.\d+\.\d+$/;

/**
 * A quiz's minimum TMCode version: `min_app_version` in its stored
 * tmcode_policy (set from the proctoring settings form), else the
 * TMCODE_MIN_APP_VERSION env var, else null. Only "x.y.z" counts.
 */
export function minAppVersion(raw: unknown, env = process.env.TMCODE_MIN_APP_VERSION): string | null {
  const p = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const own = typeof p.min_app_version === "string" ? p.min_app_version.trim() : "";
  if (VERSION.test(own)) return own;
  const fallback = (env ?? "").trim();
  return VERSION.test(fallback) ? fallback : null;
}

export async function tmcodeSettingsFor(quizId: number): Promise<QuizTmcodeSettings> {
  const s = await ProctoringSettings.findOne({
    where: { quiz_id: quizId },
    attributes: ["enabled", "lockdown_browser", "tmcode_delivery", "tmcode_policy"],
  });
  const delivery = (s?.tmcode_delivery as TmcodeDelivery) || "web";
  return {
    delivery,
    policy: normalizePolicy(s?.tmcode_policy, !!s?.enabled && !!s?.lockdown_browser),
    min_app_version: minAppVersion(s?.tmcode_policy),
  };
}

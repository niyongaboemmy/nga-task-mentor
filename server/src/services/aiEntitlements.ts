import { Request } from "express";
import { AiEntitlement, AppSetting } from "../models";
import {
  isPaidProvider,
  parseMode,
  premiumDefaultLimit,
  premiumModels,
  type PaidAccess,
  type PaidProviderId,
} from "../tmcode/ai/service";

/**
 * Who may use what beyond the free AI (GRADING_PREMIUM_CONTRACTS.md):
 *  - staff: holders of a grader permission get the staff switch for third-party AI tools;
 *  - premium: the role permission AI_PREMIUM, or a per-user row in ai_entitlements
 *    (premium=true), with a daily limit (the row's, else TMCODE_AI_PREMIUM_PER_DAY);
 *  - BYOK: anyone allowed AI, while the school's "allow own API keys" setting is on (default).
 * decideAi (the school policy, the item's mode, AI_USE) is checked by the caller first.
 */

export const STAFF_PERMISSIONS = ["PROJECTS_MONITOR", "PROJECTS_VIEW_ALL", "SUBMISSIONS_GRADE", "QUIZZES_MANAGE_ANY", "ASSIGNMENTS_MANAGE_ANY"] as const;

const permsOf = (req: Request): Set<string> => ((req as any).user?.permissions as Set<string>) ?? new Set<string>();

export const isStaff = (req: Request) => {
  const p = permsOf(req);
  return STAFF_PERMISSIONS.some((k) => p.has(k));
};

export interface PremiumEntitlement {
  entitled: boolean;
  /** "role": AI_PREMIUM on the role; "grant": a per-user row; null: not entitled. */
  via: "role" | "grant" | null;
  limit: number;
}

/** Pure: the effective entitlement from the role permission and the user's row. */
export function effectiveEntitlement(rolePremium: boolean, row: Pick<AiEntitlement, "premium" | "daily_limit"> | null): PremiumEntitlement {
  const granted = !!row?.premium;
  const limit = row?.daily_limit != null && Number(row.daily_limit) > 0 ? Number(row.daily_limit) : premiumDefaultLimit();
  return { entitled: rolePremium || granted, via: granted ? "grant" : rolePremium ? "role" : null, limit };
}

export async function premiumEntitlement(req: Request): Promise<PremiumEntitlement> {
  const id = Number((req as any).user?.id);
  const row = Number.isInteger(id) && id > 0 ? await AiEntitlement.findByPk(id).catch(() => null) : null;
  return effectiveEntitlement(permsOf(req).has("AI_PREMIUM"), row);
}

// ── app settings ──

export const BYOK_SETTING = "ai.byok_allowed";

let byokCache: { at: number; value: boolean } | null = null;

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await AppSetting.findByPk(key).catch(() => null);
  if (!row || row.value == null) return fallback;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return fallback;
  }
}

export async function setSetting(key: string, value: unknown, by: number | null) {
  await AppSetting.upsert({ key, value: JSON.stringify(value), updated_by: by, updated_at: new Date() } as any);
  if (key === BYOK_SETTING) byokCache = null;
}

/** "Allow own API keys (BYOK)": on unless the school switched it off. Cached for 10 s. */
export async function byokAllowed(): Promise<boolean> {
  if (byokCache && Date.now() - byokCache.at < 10_000) return byokCache.value;
  const value = (await getSetting<boolean>(BYOK_SETTING, true)) !== false;
  byokCache = { at: Date.now(), value };
  return value;
}

export const resetByokCacheForTests = () => (byokCache = null);

// ── a request's paid access ──

export interface ByokInput {
  provider: string;
  key: string;
}

export type AccessCheck = { ok: true; access?: PaidAccess } | { ok: false; status: number; code: string; message: string };

/**
 * What a request in `mode` may use: nothing extra for the free modes; the premium allowance when
 * the user is entitled; the request's own key when BYOK is allowed. Refusals carry the codes of
 * the contract (PREMIUM_REQUIRED, BYOK_DISABLED, BYOK_KEY_REQUIRED, MODEL_UNKNOWN).
 */
export async function accessFor(req: Request, mode: string, byok?: ByokInput | null): Promise<AccessCheck> {
  const m = parseMode(mode);
  if (m.tier === "free") return { ok: true };
  if (m.tier === "premium") {
    const e = await premiumEntitlement(req);
    if (!e.entitled) return { ok: false, status: 403, code: "PREMIUM_REQUIRED", message: "Premium AI isn't switched on for your account. Use the free AI, or ask the school." };
    if (!premiumModels().some((x) => x.id === `premium:${m.provider}/${m.model}`)) {
      return { ok: false, status: 400, code: "MODEL_UNKNOWN", message: "That premium model isn't available. Pick another one." };
    }
    return { ok: true, access: { tier: "premium", limit: e.limit } };
  }
  if (!(await byokAllowed())) return { ok: false, status: 403, code: "BYOK_DISABLED", message: "The school has switched off using your own API keys. Use the free AI." };
  if (!isPaidProvider(m.provider) || !m.model) return { ok: false, status: 400, code: "MODEL_UNKNOWN", message: "Pick a provider and a model for your own key." };
  if (!byok?.key || byok.provider !== m.provider) {
    return { ok: false, status: 400, code: "BYOK_KEY_REQUIRED", message: "Add your API key for this provider in TMCode's settings to use this model." };
  }
  return { ok: true, access: { tier: "byok", provider: m.provider as PaidProviderId, key: byok.key } };
}

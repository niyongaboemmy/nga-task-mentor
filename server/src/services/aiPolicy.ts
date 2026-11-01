import axios from "axios";
import {
  AI_REASON_MESSAGES,
  aiAppEnabled,
  decideAi,
  normalizeAiPolicy,
  type AiApp,
  type AiPolicy,
  type AiReason,
} from "../vendor/nga-access";
import { clientBasicAuth } from "../access/misClient";

/**
 * The school-wide AI policy, owned by NGA MIS (AI_USAGE_CONTROL_PLAN.md §4-5):
 * GET {MIS}/integrations/ai-policy with this app's SSO client credentials
 * (HTTP Basic, the same pair /sso/token uses).
 *
 *  - cached in memory for 60 s; a new `ai_policy_v` seen by the /auth/verify
 *    poll (misBearerAuth) expires the cache at once;
 *  - a fetch never holds a request for more than 3 s (AI_POLICY_TIMEOUT_MS);
 *  - when MIS can't be reached the last good copy is used for up to 15 min,
 *    then nothing: no policy means no AI (fail closed, GLOBAL_OFF);
 *  - after a failure, MIS isn't asked again for 10 s, so an outage doesn't
 *    add a timeout to every AI request.
 */

const TTL_MS = 60_000;
const STALE_GRACE_MS = 15 * 60_000;
const RETRY_AFTER_FAILURE_MS = 10_000;

const timeoutMs = () => {
  const n = Number(process.env.AI_POLICY_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? n : 3000;
};
const misBase = () => (process.env.NGA_MIS_BASE_URL || "").replace(/\/+$/, "");

interface Cached {
  policy: AiPolicy;
  fetchedAt: number;
  /** false once a newer ai_policy_v was reported: refetch, but keep it as the stale copy. */
  fresh: boolean;
}

let cached: Cached | null = null;
let inflight: Promise<AiPolicy | null> | null = null;
let lastFailureAt = 0;
let warnedAt = 0;
/** undefined: no override; null or a policy: what tests asked for. */
let override: AiPolicy | null | undefined;

/** GET the policy from MIS (no cache). Throws when it can't. */
export async function fetchAiPolicyFromMis(): Promise<AiPolicy> {
  const base = misBase();
  if (!base) throw new Error("NGA_MIS_BASE_URL is not set");
  const auth = clientBasicAuth();
  if (!auth) throw new Error("SSO_CLIENT_ID / SSO_CLIENT_SECRET are not set");
  const res = await axios.get(`${base}/integrations/ai-policy`, {
    headers: { Authorization: auth },
    timeout: timeoutMs(),
  });
  const raw = res.data?.data?.policy;
  if (!raw || typeof raw !== "object") throw new Error("MIS returned no ai policy");
  return normalizeAiPolicy(raw);
}

function staleCopy(now: number): AiPolicy | null {
  return cached && now - cached.fetchedAt < STALE_GRACE_MS ? cached.policy : null;
}

async function refresh(): Promise<AiPolicy | null> {
  try {
    const policy = await fetchAiPolicyFromMis();
    cached = { policy, fetchedAt: Date.now(), fresh: true };
    lastFailureAt = 0;
    return policy;
  } catch (err: any) {
    const now = Date.now();
    lastFailureAt = now;
    if (now - warnedAt > 60_000) {
      warnedAt = now;
      console.warn(`[ai-policy] MIS fetch failed (${err?.message ?? err}); ${staleCopy(now) ? "using the last good copy" : "AI is off until MIS answers"}`);
    }
    return staleCopy(now);
  }
}

/** The current policy, or null (= AI off everywhere). Never throws. */
export async function getAiPolicy(): Promise<AiPolicy | null> {
  if (override !== undefined) return override;
  const now = Date.now();
  if (cached?.fresh && now - cached.fetchedAt < TTL_MS) return cached.policy;
  if (lastFailureAt && now - lastFailureAt < RETRY_AFTER_FAILURE_MS) return staleCopy(now);
  if (!inflight) inflight = refresh().finally(() => (inflight = null));
  return inflight;
}

/**
 * Asks MIS now, whatever the cache says (services/aiLive.ts watches the policy with it while
 * TMCode apps are listening). Shares a fetch already on its way; never throws.
 */
export async function refreshAiPolicyNow(): Promise<AiPolicy | null> {
  if (override !== undefined) return override;
  if (!inflight) inflight = refresh().finally(() => (inflight = null));
  return inflight;
}

/**
 * Called with MIS /auth/verify's `data.ai_policy_v`: a version other than the
 * cached one means the super admin changed the policy -- refetch on next use.
 */
export function noteAiPolicyVersion(v: unknown) {
  const n = Number(v);
  if (v === null || v === undefined || !Number.isFinite(n) || !cached) return;
  if (cached.policy.v !== n) cached.fresh = false;
}

// ─── Refusals ────────────────────────────────────────────────────────────────

/** Thrown where AI is about to be called while the policy has it off (provider chokepoints). */
export class AiDisabledError extends Error {
  readonly statusCode = 403;
  readonly code = "AI_DISABLED";
  constructor(readonly reason: AiReason) {
    super(AI_REASON_MESSAGES[reason]);
    this.name = "AiDisabledError";
  }
}

export const isAiDisabledError = (e: unknown): e is AiDisabledError =>
  e instanceof AiDisabledError || (e as any)?.code === "AI_DISABLED";

/** The JSON a refusal answers with (inside TM's usual { success:false, message } envelope). */
export const aiDisabledBody = (reason: AiReason) => ({
  success: false,
  code: "AI_DISABLED" as const,
  reason,
  message: AI_REASON_MESSAGES[reason],
});

/** Throws AiDisabledError unless the policy has AI on for `app` (no user involved). */
export async function assertAiApp(app: AiApp): Promise<AiPolicy> {
  const policy = await getAiPolicy();
  if (!aiAppEnabled(policy, app)) throw new AiDisabledError(policy?.enabled ? "APP_OFF" : "GLOBAL_OFF");
  return policy!;
}

/**
 * AI grading on submit (short answers, the coding AI suggestion): a system action,
 * decided by the policy alone (features.grading). Never throws.
 */
export async function aiGradingAllowed(): Promise<boolean> {
  try {
    return decideAi(await getAiPolicy(), { app: "tm", feature: "grading", hasAiUse: false }).allowed;
  } catch {
    return false;
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

/**
 * Pin the policy (a policy, or null = unavailable); `undefined` goes back to MIS.
 * Normalised like MIS's answer, so blocks a test leaves out (e.g. `personal`) get defaults.
 */
export function setAiPolicyForTests(policy: (Omit<AiPolicy, "personal"> & { personal?: unknown }) | null | undefined) {
  override = policy === undefined || policy === null ? policy : normalizeAiPolicy(policy);
}

/** Forget the cache, the failure back-off and any override. */
export function resetAiPolicyCache() {
  cached = null;
  inflight = null;
  lastFailureAt = 0;
  warnedAt = 0;
  override = undefined;
}

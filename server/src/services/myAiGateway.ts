import { AiDisabledError, getAiPolicy } from "./aiPolicy";
import { clientBasicAuth } from "../access/misClient";
import type { AiReason, AiTask } from "../vendor/nga-access";
import type { JSONSchema } from "./aiProviders/types";

/**
 * "My AI" for Task Mentor (PERSONAL_AI_PROVIDERS_PLAN.md §3, §10; contract:
 * nga_central_mis MY_AI_GATEWAY.md). People keep their own AI provider keys in the
 * MIS; the keys never come here. For a call *by a person*, Task Mentor asks the MIS
 * gateway to answer with that person's key, and runs its own school AI when the MIS
 * says so (409), when the key failed and fallback is allowed (503), or when the MIS
 * can't be reached. The school policy (requireAi / assertAiApp) still decides first.
 *
 * Every call: HTTP Basic with this app's SSO client id/secret, plus
 * `X-Nga-On-Behalf-Of: <MIS user id>` -- never the local users.id.
 */

const ROUTES_TTL_MS = 60_000;
const ROUTES_TIMEOUT_MS = 3_000;
/** Longer than the slowest local provider (90 s) plus the hop. */
const GENERATE_TIMEOUT_MS = 120_000;

const misBase = () => (process.env.NGA_MIS_BASE_URL || "").replace(/\/+$/, "");
const envMs = (name: string, dflt: number) => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : dflt;
};

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MyAiChoice {
  credentialId: number;
  provider: string;
  model: string;
  label?: string | null;
}

export interface MyAiTaskRoute {
  route: "personal" | "school";
  reason: string;
  credentialId?: number;
  provider?: string;
  model?: string;
  label?: string | null;
  fallbackToSchool?: boolean;
}

export interface MyAiRoutes {
  v?: number | null;
  policyV?: number | null;
  enabled: boolean;
  byTask?: Partial<Record<AiTask, MyAiTaskRoute>>;
  choices?: MyAiChoice[];
}

/** What answered a call, returned to the client as `ai`. */
export interface AiAnswer {
  route: "personal" | "school";
  reason: string;
  credentialId?: number;
  label?: string | null;
  provider?: string;
  model?: string;
  /** The personal key that failed before the school AI answered (AI_KEY_NO_CREDIT, …). */
  fallbackFrom?: string;
  /** A 409's `skipped` (which personal route was passed over, if any). */
  skipped?: unknown;
}

/** Who asked and for what -- captured at request time (jobs run later). */
export interface PersonalAiCall {
  /** The signed-in user's MIS user id (req.user.mis_user_id). Null = no gateway. */
  misUserId: number | null | undefined;
  task: AiTask;
  /** Short feature name for the MIS usage log, e.g. "tm.rubric". */
  feature: string;
  inAssessment?: boolean;
  /** One-off choice from the AI panel: "school", "<credentialId>" or "<credentialId>:<model>". */
  aiRoute?: string | null;
}

/** A personal key failed and the person did not allow the school AI to answer instead. */
export class PersonalAiUnavailableError extends Error {
  readonly statusCode = 503;
  constructor(
    message: string,
    readonly code: string,
    readonly label?: string | null,
  ) {
    super(message);
    this.name = "PersonalAiUnavailableError";
  }
}

export const isPersonalAiUnavailableError = (e: unknown): e is PersonalAiUnavailableError =>
  e instanceof PersonalAiUnavailableError;

/** A non-200 answer from the gateway (or a network failure: status null). */
class GatewayError extends Error {
  constructor(
    readonly status: number | null,
    readonly body: any,
    message: string,
  ) {
    super(message);
    this.name = "GatewayError";
  }
}

// ─── HTTP ────────────────────────────────────────────────────────────────────

function headersFor(misUserId: number, json: boolean): Record<string, string> {
  const auth = clientBasicAuth();
  if (!auth) throw new GatewayError(null, null, "SSO_CLIENT_ID / SSO_CLIENT_SECRET are not set");
  const h: Record<string, string> = {
    Authorization: auth,
    "X-Nga-On-Behalf-Of": String(misUserId),
    Accept: "application/json",
  };
  if (json) h["Content-Type"] = "application/json";
  return h;
}

async function call(
  method: "GET" | "POST",
  path: string,
  misUserId: number,
  body: unknown,
  timeoutMs: number,
): Promise<any> {
  const base = misBase();
  if (!base) throw new GatewayError(null, null, "NGA_MIS_BASE_URL is not set");
  let res: Response;
  try {
    res = await fetch(`${base}/integrations/ai${path}`, {
      method,
      headers: headersFor(misUserId, method === "POST"),
      body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err: any) {
    if (err instanceof GatewayError) throw err;
    throw new GatewayError(null, null, err?.message ?? String(err));
  }
  let parsed: any = null;
  try {
    parsed = await res.json();
  } catch {
    parsed = null;
  }
  if (res.status !== 200) throw new GatewayError(res.status, parsed, `gateway ${path} answered ${res.status}`);
  return parsed;
}

const validMisId = (id: unknown): id is number => Number.isInteger(Number(id)) && Number(id) > 0;

export interface GatewayJsonRequest {
  prompt: string;
  schema: JSONSchema;
  schemaName?: string;
  maxOutputTokens?: number;
}

export interface GatewayTextRequest {
  prompt: string;
  system?: string;
}

/** The gateway bound to one person and one call context (what `personal` gets). */
export interface BoundGateway {
  json<T = any>(req: GatewayJsonRequest): Promise<{ data: T; ai: AiAnswer }>;
  text(req: GatewayTextRequest): Promise<{ data: string; ai: AiAnswer }>;
}

function bind(ctx: PersonalAiCall & { misUserId: number }): BoundGateway {
  const common = {
    task: ctx.task,
    feature: ctx.feature,
    inAssessment: ctx.inAssessment === true,
    aiRoute: ctx.aiRoute ?? null,
  };
  const timeout = envMs("MY_AI_GENERATE_TIMEOUT_MS", GENERATE_TIMEOUT_MS);
  return {
    async json<T>(req: GatewayJsonRequest) {
      const out = await call("POST", "/gateway/json", ctx.misUserId, { ...common, ...req }, timeout);
      return { data: out?.data as T, ai: out?.ai as AiAnswer };
    },
    async text(req: GatewayTextRequest) {
      const out = await call("POST", "/gateway/text", ctx.misUserId, { ...common, ...req }, timeout);
      return { data: String(out?.data ?? ""), ai: out?.ai as AiAnswer };
    },
  };
}

// ─── Routes (cached per person) ──────────────────────────────────────────────

interface CachedRoutes {
  routes: MyAiRoutes;
  at: number;
}
const routesCache = new Map<number, CachedRoutes>();
const MAX_CACHED = 5000;
/** The last ai_routes_v reported per person by /auth/verify. */
const routesVersions = new Map<number, number>();
let lastPolicyV: number | null = null;

/** The person's resolved route map (no secrets) -- 60 s cache. Throws when the MIS can't answer. */
export async function getRoutes(misUserId: number): Promise<MyAiRoutes> {
  const hit = routesCache.get(misUserId);
  if (hit && Date.now() - hit.at < ROUTES_TTL_MS) return hit.routes;
  const out = await call("GET", "/routes", misUserId, undefined, envMs("MY_AI_ROUTES_TIMEOUT_MS", ROUTES_TIMEOUT_MS));
  const routes: MyAiRoutes = out?.data && typeof out.data === "object" ? out.data : { enabled: false };
  if (routesCache.size >= MAX_CACHED && !routesCache.has(misUserId)) {
    const oldest = routesCache.keys().next().value;
    if (oldest !== undefined) routesCache.delete(oldest);
  }
  routesCache.set(misUserId, { routes, at: Date.now() });
  return routes;
}

/** A fresh cached copy, without asking the MIS. */
function cachedRoutes(misUserId: number): MyAiRoutes | null {
  const hit = routesCache.get(misUserId);
  return hit && Date.now() - hit.at < ROUTES_TTL_MS ? hit.routes : null;
}

/**
 * Called with /auth/verify's `data.ai_routes_v` for that person: a different version
 * means they changed their keys or routes in the MIS -- forget their cached map.
 */
export function noteAiRoutesVersion(misUserId: unknown, v: unknown) {
  const id = Number(misUserId);
  const n = Number(v);
  if (!validMisId(id) || v === null || v === undefined || !Number.isFinite(n)) return;
  const prev = routesVersions.get(id);
  routesVersions.set(id, n);
  const hit = routesCache.get(id);
  if (prev !== undefined && prev !== n) routesCache.delete(id);
  else if (hit && hit.routes.v != null && Number(hit.routes.v) !== n) routesCache.delete(id);
}

/** Called with /auth/verify's `data.ai_policy_v`: a new school policy can change every route. */
export function noteMyAiPolicyVersion(v: unknown) {
  const n = Number(v);
  if (v === null || v === undefined || !Number.isFinite(n)) return;
  if (lastPolicyV !== null && lastPolicyV !== n) routesCache.clear();
  lastPolicyV = n;
}

/** Both versions from one /auth/verify answer. */
export function noteMyAiVersions(misUserId: unknown, data: any) {
  noteMyAiPolicyVersion(data?.ai_policy_v);
  noteAiRoutesVersion(misUserId, data?.ai_routes_v);
}

/** Tests only. */
export function resetMyAiCache() {
  routesCache.clear();
  routesVersions.clear();
  lastPolicyV = null;
}

// ─── The policy gate ─────────────────────────────────────────────────────────

/** Why the gateway is skipped without asking it, or null to ask. */
async function skipReason(ctx: PersonalAiCall): Promise<string | null> {
  if (!validMisId(ctx.misUserId)) return "NO_MIS_USER";
  const policy = await getAiPolicy();
  const p = policy?.personal;
  if (!p || !p.enabled) return "PERSONAL_OFF";
  if (p.apps?.tm === false) return "APP_OFF";
  return null;
}

/** GET /api/ai/my-routes: the person's routes for the UI, or { enabled:false }. Never throws. */
export async function myRoutesForUi(misUserId: number | null | undefined): Promise<MyAiRoutes> {
  try {
    if (await skipReason({ misUserId, task: "author", feature: "ui" })) return { enabled: false };
    return await getRoutes(misUserId as number);
  } catch {
    return { enabled: false };
  }
}

// ─── withPersonalAi ──────────────────────────────────────────────────────────

const school = (reason: string, extra: Partial<AiAnswer> = {}): AiAnswer => ({ route: "school", reason, ...extra });

/**
 * Run one person-initiated AI call with that person's own key when the MIS says so,
 * else with the school AI -- exactly the table in MY_AI_GATEWAY.md:
 *
 *   policy personal off / app off  → school, the gateway is never called
 *   200                            → the personal answer
 *   409 AI_USE_SCHOOL              → school, { reason, skipped }
 *   503 fallbackAllowed            → school, { reason: KEY_NOT_ACTIVE, fallbackFrom, label }
 *   503 no fallback                → throws PersonalAiUnavailableError (503, the message)
 *   403 AI_DISABLED                → throws AiDisabledError (as today)
 *   anything else / network        → school, { reason: GATEWAY_UNAVAILABLE }
 *
 * `personal` must send the same prompt/schema `school` would use.
 */
export async function withPersonalAi<T>(
  ctx: PersonalAiCall,
  run: { personal: (gw: BoundGateway) => Promise<{ data: T; ai: AiAnswer }>; school: () => Promise<T> },
): Promise<{ result: T; ai: AiAnswer }> {
  const skip = await skipReason(ctx);
  if (skip) return { result: await run.school(), ai: school(skip) };

  const misUserId = Number(ctx.misUserId);
  const choice = ctx.aiRoute == null ? "" : String(ctx.aiRoute).trim();
  if (choice === "school") return { result: await run.school(), ai: school("NO_ROUTE") };
  if (!choice) {
    // The cached map already says the school AI answers this task: no need to ask.
    const known = cachedRoutes(misUserId);
    const r = known && (!known.enabled ? { route: "school", reason: "PERSONAL_OFF" } : known.byTask?.[ctx.task]);
    if (r && r.route === "school") return { result: await run.school(), ai: school(r.reason || "NO_ROUTE") };
  }

  let personal: { data: T; ai: AiAnswer };
  try {
    personal = await run.personal(bind({ ...ctx, misUserId, aiRoute: choice || null }));
  } catch (err) {
    if (!(err instanceof GatewayError)) throw err;
    const b = err.body ?? {};
    if (err.status === 409) {
      return { result: await run.school(), ai: school(String(b.reason || "NO_ROUTE"), b.skipped != null ? { skipped: b.skipped } : {}) };
    }
    if (err.status === 503 && typeof b.code === "string" && b.code.startsWith("AI_")) {
      if (b.fallbackAllowed === true) {
        return {
          result: await run.school(),
          ai: school("KEY_NOT_ACTIVE", { fallbackFrom: b.code, label: b.label ?? null }),
        };
      }
      throw new PersonalAiUnavailableError(
        String(b.message || "Your own AI key could not answer. Try again, or choose School AI."),
        b.code,
        b.label ?? null,
      );
    }
    if (err.status === 403 && b.code === "AI_DISABLED") {
      throw new AiDisabledError((b.reason as AiReason) || "GLOBAL_OFF");
    }
    if (err.status !== null) console.warn(`[my-ai] ${err.message}; the school AI answers`);
    else console.warn(`[my-ai] gateway unreachable (${err.message}); the school AI answers`);
    return { result: await run.school(), ai: school("GATEWAY_UNAVAILABLE") };
  }
  return { result: personal.data, ai: { ...personal.ai, reason: personal.ai?.reason || "PERSONAL", route: "personal" } };
}

// ─── From a request ──────────────────────────────────────────────────────────

/** The panel's one-off choice, as sent in the body (JSON or multipart) or query. */
export function aiRouteFrom(req: { body?: any; query?: any }): string | null {
  const raw = req.body?.aiRoute ?? req.query?.aiRoute;
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  const s = String(raw).trim().slice(0, 200);
  return s ? s : null;
}

/**
 * The My AI context of a call the signed-in person makes now. Capture it at request
 * time: a background job that runs later must not read `req` again.
 */
export function personalAiFrom(
  req: { user?: any; body?: any; query?: any },
  task: AiTask,
  feature: string,
  opts: { inAssessment?: boolean } = {},
): PersonalAiCall {
  return {
    misUserId: req.user?.mis_user_id ?? null,
    task,
    feature,
    inAssessment: opts.inAssessment === true,
    aiRoute: aiRouteFrom(req),
  };
}

/** The 503 answer for a PersonalAiUnavailableError (the person's key failed, no fallback). */
export const personalAiErrorBody = (e: PersonalAiUnavailableError) => ({
  success: false,
  code: e.code,
  message: e.message,
  label: e.label ?? null,
});

import OpenAI from "openai";
import { isFreeModel, freeModels } from "../../services/aiProviders/openrouterProvider";
import { assertAiApp } from "../../services/aiPolicy";

/**
 * TMCode AI (nga-tmcode docs/AI_AND_ACTIVITY_PLAN.md, B): chat and inline completions for the
 * TMCode editor, on free AI only. The keys stay here (TMCode is public).
 *
 * Modes:
 * - "free" (default): OpenRouter's free models (`:free` ids only, the free-only guard of
 *   openrouterProvider), with OpenRouter's own fallback across them.
 * - "auto": TMCode picks the provider per request from what is left today: the OpenRouter
 *   account's real free-request counter (shared by every NGA app), and the other free tiers
 *   (Gemini, Groq, GLM) by our own counts. Chat goes to the strongest available model, inline
 *   completions to the fastest, and OpenRouter's shared pool is kept for chat.
 * - "<provider>/<model>": one model the student chose (free ones only).
 *
 * Every student also has a daily allowance (TMCODE_AI_CHAT_PER_DAY, TMCODE_AI_COMPLETE_PER_DAY),
 * so one student can't spend the school's free requests.
 *
 * Paid tiers (GRADING_PREMIUM_CONTRACTS.md), never the default:
 * - "premium:<provider>/<model>": the school's paid keys (TMCODE_AI_PREMIUM_MODELS, with
 *   TMCODE_AI_PREMIUM_<PROVIDER>_KEY), for entitled users only (the caller checks, see
 *   services/aiEntitlements.ts), counted against a per-user premium allowance.
 * - "byok:<provider>/<model>": the user's own API key, sent with the request, used for that
 *   request only: never stored, never logged, scrubbed from every error.
 * The free-only guard applies to the free modes only.
 */

/** chat: a question; agent: one more step of an agent's work (tool results back); complete: ghost text. */
export type Kind = "chat" | "agent" | "complete";
export type ProviderId = "openrouter" | "gemini" | "groq" | "glm";

interface ProviderDef {
  id: ProviderId;
  label: string;
  baseURL: () => string;
  key: () => string | undefined;
  /** Chat models, best first. */
  chat: () => string[];
  /** The fast model for inline completions (null: not used for them). */
  complete: () => string | null;
  /** Requests a day the free tier allows (our own count; OpenRouter's comes from its API). */
  daily: () => number;
}

const num = (v: string | undefined, d: number) => (Number(v) > 0 ? Number(v) : d);

export const PROVIDERS: Record<ProviderId, ProviderDef> = {
  openrouter: {
    id: "openrouter",
    label: "OpenRouter (free models)",
    baseURL: () => process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
    key: () => process.env.OPENROUTER_API_KEY,
    chat: () => freeModels(),
    complete: () => null,
    daily: () => num(process.env.TMCODE_AI_LIMIT_OPENROUTER, 50),
  },
  gemini: {
    id: "gemini",
    label: "Google Gemini (free tier)",
    baseURL: () => "https://generativelanguage.googleapis.com/v1beta/openai/",
    key: () => (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "your_gemini_api_key_here" ? process.env.GEMINI_API_KEY : undefined),
    chat: () => [process.env.GEMINI_MODEL || "gemini-2.5-flash"],
    complete: () => process.env.TMCODE_AI_GEMINI_COMPLETE_MODEL || "gemini-2.5-flash-lite",
    daily: () => num(process.env.TMCODE_AI_LIMIT_GEMINI, 250),
  },
  groq: {
    id: "groq",
    label: "Groq (free tier)",
    baseURL: () => "https://api.groq.com/openai/v1",
    key: () => process.env.GROQ_API_KEY,
    chat: () => [process.env.GROQ_MODEL || "openai/gpt-oss-20b"],
    complete: () => process.env.TMCODE_AI_GROQ_COMPLETE_MODEL || "qwen/qwen3.8-27b",
    daily: () => num(process.env.TMCODE_AI_LIMIT_GROQ, 1000),
  },
  glm: {
    id: "glm",
    label: "Zhipu GLM (free)",
    baseURL: () => "https://api.z.ai/api/paas/v4",
    key: () => process.env.GLM_API_KEY,
    chat: () => [process.env.GLM_MODEL || "glm-4.5-flash"],
    complete: () => null,
    daily: () => num(process.env.TMCODE_AI_LIMIT_GLM, 500),
  },
};

/** Auto's order: OpenRouter's shared pool last for chat, never for inline completions. */
const AUTO_CHAT: ProviderId[] = ["gemini", "groq", "openrouter", "glm"];
/** Agents take many steps: the fastest reliable tool-caller first, OpenRouter's shared pool last. */
const AUTO_AGENT: ProviderId[] = ["groq", "gemini", "openrouter", "glm"];
/** The model an agent uses on a provider (better at tools than the chat default when they differ). */
const agentModel = (p: ProviderId) => (p === "groq" ? process.env.TMCODE_AI_GROQ_AGENT_MODEL || "openai/gpt-oss-120b" : PROVIDERS[p].chat()[0]);
const AUTO_COMPLETE: ProviderId[] = ["groq", "gemini"];

// ── paid tiers: premium (school keys) and BYOK (the user's own key) ──

export type Tier = "free" | "premium" | "byok";
export type PaidProviderId = "openai" | "anthropic" | "gemini" | "openrouter" | "groq" | "deepseek";

interface PaidProviderDef {
  id: PaidProviderId;
  label: string;
  /** OpenAI-compatible endpoint. */
  baseURL: string;
  /** The school's key for premium: TMCODE_AI_PREMIUM_<PROVIDER>_KEY, else the provider's usual key. */
  premiumKey: () => string | undefined;
  /** Shown to BYOK users as a starting point (any model id the provider knows works). */
  suggested: string[];
}

const envKey = (...names: string[]) => {
  for (const n of names) {
    const v = process.env[n]?.trim();
    if (v && !/^your_/i.test(v)) return v;
  }
  return undefined;
};

export const PAID_PROVIDERS: Record<PaidProviderId, PaidProviderDef> = {
  openai: { id: "openai", label: "OpenAI", baseURL: "https://api.openai.com/v1", premiumKey: () => envKey("TMCODE_AI_PREMIUM_OPENAI_KEY", "OPENAI_API_KEY"), suggested: ["gpt-4.1", "gpt-4.1-mini", "gpt-4o", "o4-mini"] },
  anthropic: { id: "anthropic", label: "Anthropic (Claude)", baseURL: "https://api.anthropic.com/v1/", premiumKey: () => envKey("TMCODE_AI_PREMIUM_ANTHROPIC_KEY", "ANTHROPIC_API_KEY"), suggested: ["claude-sonnet-4-5", "claude-haiku-4-5", "claude-opus-4-1"] },
  gemini: { id: "gemini", label: "Google Gemini", baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/", premiumKey: () => envKey("TMCODE_AI_PREMIUM_GEMINI_KEY", "GEMINI_API_KEY"), suggested: ["gemini-2.5-pro", "gemini-2.5-flash"] },
  openrouter: { id: "openrouter", label: "OpenRouter", baseURL: "https://openrouter.ai/api/v1", premiumKey: () => envKey("TMCODE_AI_PREMIUM_OPENROUTER_KEY", "OPENROUTER_API_KEY"), suggested: ["anthropic/claude-sonnet-4.5", "openai/gpt-4.1", "google/gemini-2.5-pro"] },
  groq: { id: "groq", label: "Groq", baseURL: "https://api.groq.com/openai/v1", premiumKey: () => envKey("TMCODE_AI_PREMIUM_GROQ_KEY", "GROQ_API_KEY"), suggested: ["openai/gpt-oss-120b", "llama-3.3-70b-versatile"] },
  deepseek: { id: "deepseek", label: "DeepSeek", baseURL: "https://api.deepseek.com/v1", premiumKey: () => envKey("TMCODE_AI_PREMIUM_DEEPSEEK_KEY", "DEEPSEEK_API_KEY"), suggested: ["deepseek-chat", "deepseek-reasoner"] },
};

export const isPaidProvider = (p: unknown): p is PaidProviderId => typeof p === "string" && Object.prototype.hasOwnProperty.call(PAID_PROVIDERS, p);

export type ParsedMode = { tier: "free"; mode: string } | { tier: "premium" | "byok"; provider: string; model: string };

/** "free" | "auto" | "<provider>/<model>" (free), "premium:<provider>/<model>", "byok:<provider>/<model>". Pure. */
export function parseMode(mode: string): ParsedMode {
  const m = /^(premium|byok):([^/\s]+)\/(.+)$/.exec(mode.trim());
  if (m) return { tier: m[1] as "premium" | "byok", provider: m[2], model: m[3].trim() };
  if (/^(premium|byok):/.test(mode.trim())) return { tier: mode.trim().startsWith("premium") ? "premium" : "byok", provider: "", model: "" };
  return { tier: "free", mode };
}

export const tierOf = (mode: string): Tier => parseMode(mode).tier;

export interface PremiumModel {
  id: string;
  label: string;
  provider: PaidProviderId;
  providerLabel: string;
}

/** TMCODE_AI_PREMIUM_MODELS entries ("provider/model", comma separated), parsed. Pure on the env. */
export function premiumModelsConfigured(): { provider: string; model: string; configured: boolean }[] {
  return String(process.env.TMCODE_AI_PREMIUM_MODELS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      const i = entry.indexOf("/");
      const provider = i > 0 ? entry.slice(0, i) : entry;
      const model = i > 0 ? entry.slice(i + 1).trim() : "";
      return { provider, model, configured: !!model && isPaidProvider(provider) && !!PAID_PROVIDERS[provider].premiumKey() };
    });
}

/** The premium models on offer: listed in the env AND their provider has a key. */
export function premiumModels(): PremiumModel[] {
  const seen = new Set<string>();
  const out: PremiumModel[] = [];
  for (const e of premiumModelsConfigured()) {
    if (!e.configured || !isPaidProvider(e.provider)) continue;
    const id = `premium:${e.provider}/${e.model}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, label: e.model, provider: e.provider, providerLabel: PAID_PROVIDERS[e.provider].label });
  }
  return out;
}

export function byokProviders() {
  return (Object.values(PAID_PROVIDERS) as PaidProviderDef[]).map((p) => ({ id: p.id, label: p.label, suggested_models: p.suggested }));
}

export const premiumDefaultLimit = () => num(process.env.TMCODE_AI_PREMIUM_PER_DAY, 50);

/**
 * How a paid request may go, decided by the caller (entitlement, school setting) and passed in:
 * premium with the user's daily premium allowance, or BYOK with the key from the request body.
 */
export type PaidAccess = { tier: "premium"; limit: number } | { tier: "byok"; provider: PaidProviderId; key: string };

/** Hides a key (and anything that looks like an API key) in text that may reach a log or the user. */
export function scrubSecrets(text: string, key?: string | null): string {
  let t = String(text ?? "");
  if (key && key.length >= 4) t = t.split(key).join("***");
  return t
    .replace(/\b(sk-(?:ant-|or-|proj-)?[A-Za-z0-9_\-]{8,})/g, "***")
    .replace(/\bAIza[0-9A-Za-z_\-]{20,}/g, "***")
    .replace(/\bgsk_[A-Za-z0-9]{10,}/g, "***")
    .replace(/(Bearer\s+)[A-Za-z0-9._\-]{8,}/gi, "$1***");
}

// ── usage today (in memory: a restart forgives the day's counts, never over-spends a free tier) ──

const day = () => new Date().toISOString().slice(0, 10);
let today = day();
const providerUse = new Map<ProviderId, number>();
const userUse = new Map<string, number>();
/** Premium questions per user today (agent steps after the first don't count; see streamChat). */
const premiumUse = new Map<number, number>();
const cooldown = new Map<ProviderId, number>();

function roll() {
  const d = day();
  if (d === today) return;
  today = d;
  providerUse.clear();
  userUse.clear();
  premiumUse.clear();
}

export function premiumUsed(userId: number) {
  roll();
  return premiumUse.get(userId) ?? 0;
}
function countPremium(userId: number) {
  roll();
  premiumUse.set(userId, premiumUsed(userId) + 1);
}

export function userLimit(kind: Kind) {
  if (kind === "chat") return num(process.env.TMCODE_AI_CHAT_PER_DAY, 40);
  if (kind === "agent") return num(process.env.TMCODE_AI_AGENT_STEPS_PER_DAY, 300);
  return num(process.env.TMCODE_AI_COMPLETE_PER_DAY, 200);
}
export function userUsed(userId: number, kind: Kind) {
  roll();
  return userUse.get(`${userId}|${kind}`) ?? 0;
}
function countUse(userId: number, kind: Kind, provider: ProviderId) {
  roll();
  userUse.set(`${userId}|${kind}`, userUsed(userId, kind) + 1);
  providerUse.set(provider, (providerUse.get(provider) ?? 0) + 1);
}

// OpenRouter tells how many free requests the account has left today (all NGA apps together).
let orRemaining: { at: number; used: number; limit: number; remaining: number } | null = null;
export async function openRouterRemaining(): Promise<{ used: number; limit: number; remaining: number } | null> {
  if (orRemaining && Date.now() - orRemaining.at < 60_000) return orRemaining;
  const key = PROVIDERS.openrouter.key();
  if (!key) return null;
  try {
    const res = await fetch(`${PROVIDERS.openrouter.baseURL()}/key`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(5000) });
    const body = (await res.json()) as { data?: { free_model_daily_requests?: { used: number; limit: number; remaining: number } } };
    const f = body.data?.free_model_daily_requests;
    if (!f) return null;
    orRemaining = { at: Date.now(), ...f };
    return orRemaining;
  } catch {
    return orRemaining;
  }
}

/** Requests a provider can still take today, keeping a reserve for the school's other AI features. */
export async function remaining(p: ProviderId): Promise<{ used: number; limit: number; remaining: number }> {
  roll();
  if (p === "openrouter") {
    const live = await openRouterRemaining();
    if (live) return live;
  }
  const limit = PROVIDERS[p].daily();
  const used = providerUse.get(p) ?? 0;
  return { used, limit, remaining: Math.max(0, limit - used) };
}

const RESERVE: Record<ProviderId, number> = { openrouter: 10, gemini: 25, groq: 50, glm: 25 };

export function configured(p: ProviderId) {
  return !!PROVIDERS[p].key();
}
function coolingDown(p: ProviderId) {
  return (cooldown.get(p) ?? 0) > Date.now();
}

/** What to try, in order, for a request. */
export async function plan(kind: Kind, mode: string): Promise<{ provider: ProviderId; model: string; fallbacks?: string[] }[]> {
  if (mode.includes("/") && !mode.startsWith("openrouter/") && mode !== "free" && mode !== "auto") {
    const [p, ...rest] = mode.split("/");
    const model = rest.join("/");
    const def = PROVIDERS[p as ProviderId];
    if (!def || !configured(def.id) || !(def.chat().includes(model) || def.complete() === model)) throw new AiError(400, "MODEL_UNKNOWN", "That model isn't available. Pick another one, or Auto.");
    return [{ provider: def.id, model }];
  }
  if (mode.startsWith("openrouter/")) {
    const model = mode.slice("openrouter/".length);
    if (!isFreeModel(model)) throw new AiError(400, "MODEL_NOT_FREE", "Only free models can be used.");
    return [{ provider: "openrouter", model, fallbacks: freeModels().filter((m) => m !== model) }];
  }
  if (mode !== "auto") {
    // Free (default): OpenRouter's free models only. Inline completions use Auto's fast models,
    // so typing never spends the shared OpenRouter pool.
    if (kind === "complete") return plan("complete", "auto");
    if (!configured("openrouter")) throw new AiError(503, "NOT_CONFIGURED", "OpenRouter isn't set up on Task Mentor. Switch to Auto.");
    const models = freeModels();
    return [{ provider: "openrouter", model: models[0], fallbacks: models.slice(1) }];
  }
  const order = kind === "chat" ? AUTO_CHAT : kind === "agent" ? AUTO_AGENT : AUTO_COMPLETE;
  const out: { provider: ProviderId; model: string; fallbacks?: string[] }[] = [];
  for (const p of order) {
    if (!configured(p) || coolingDown(p)) continue;
    const r = await remaining(p);
    if (r.remaining <= RESERVE[p]) continue;
    const model = kind === "chat" ? PROVIDERS[p].chat()[0] : kind === "agent" ? agentModel(p) : PROVIDERS[p].complete();
    if (!model) continue;
    out.push({ provider: p, model, ...(p === "openrouter" ? { fallbacks: PROVIDERS.openrouter.chat().slice(1) } : {}) });
  }
  return out;
}

/** Per-model request options: reasoning models answer directly (fast suggestions, no hidden thinking). */
function modelOptions(provider: ProviderId, model: string, kind: Kind): Record<string, unknown> {
  if (provider !== "groq") return {};
  if (/^qwen\//.test(model)) return { reasoning_effort: "none" };
  if (/gpt-oss/.test(model)) return { reasoning_effort: kind === "complete" ? "low" : "medium", include_reasoning: false };
  return {};
}

export class AiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const clients = new Map<ProviderId, OpenAI>();
function client(p: ProviderId) {
  let c = clients.get(p);
  if (!c) {
    c = new OpenAI({
      apiKey: PROVIDERS[p].key(),
      baseURL: PROVIDERS[p].baseURL(),
      timeout: 60_000,
      maxRetries: 0,
      ...(p === "openrouter" ? { defaultHeaders: { "X-Title": "NGA TMCode", ...(process.env.OPENROUTER_SITE_URL ? { "HTTP-Referer": process.env.OPENROUTER_SITE_URL } : {}) } } : {}),
    });
    clients.set(p, c);
  }
  return c;
}

function noteFailure(p: ProviderId, err: unknown) {
  const status = (err as { status?: number })?.status;
  if (status === 401 || status === 402 || status === 403) cooldown.set(p, Date.now() + 60 * 60_000);
  else if (status === 429) {
    cooldown.set(p, Date.now() + 5 * 60_000);
    if (p === "openrouter") orRemaining = null;
  }
}

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}
export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export interface ToolDef {
  type: "function";
  function: { name: string; description?: string; parameters?: Record<string, unknown> };
}

export interface StreamResult {
  /** A free provider, or a paid one (premium / BYOK). */
  provider: ProviderId | PaidProviderId;
  model: string;
  tier: Tier;
}

export interface StreamOptions {
  /** Paid modes only: what the caller allowed (premium allowance, or the request's own key). */
  access?: PaidAccess;
  /** Answer length cap (default TMCODE_AI_MAX_TOKENS, else 1500 for chat, 4000 for agents). */
  maxTokens?: number;
  temperature?: number;
}

type Delta = { content?: string | null; tool_calls?: { index: number; id?: string; function?: { name?: string; arguments?: string } }[] };
type Chunk = { model?: string; choices?: { delta?: Delta }[]; usage?: { cost?: number } };

/** Reads a streamed answer: text to onDelta, tool calls assembled. `check` may refuse a chunk. */
async function readStream(
  stream: AsyncIterable<Chunk>,
  model: string,
  onFirst: (served: string) => void,
  onDelta: (text: string) => void,
  check?: (served: string, chunk: Chunk) => void,
): Promise<{ sent: boolean; served: string; tool_calls?: ToolCall[] }> {
  let served = model;
  let sent = false;
  // Tool calls arrive in pieces (name, then the arguments a few characters at a time).
  const calls: { id: string; name: string; args: string }[] = [];
  for await (const chunk of stream) {
    if (chunk.model) served = chunk.model;
    check?.(served, chunk);
    if (!sent) {
      sent = true;
      onFirst(served);
    }
    const delta = chunk.choices?.[0]?.delta;
    const text = delta?.content;
    if (text) onDelta(text);
    for (const tc of delta?.tool_calls ?? []) {
      const c = (calls[tc.index ?? 0] ??= { id: "", name: "", args: "" });
      if (tc.id) c.id = tc.id;
      if (tc.function?.name) c.name += tc.function.name;
      if (tc.function?.arguments) c.args += tc.function.arguments;
    }
  }
  const tool_calls = calls
    .filter((c) => c && c.name)
    .map((c, i) => ({ id: c.id || `call_${Date.now()}_${i}`, type: "function" as const, function: { name: c.name, arguments: c.args || "{}" } }));
  return { sent, served, ...(tool_calls.length ? { tool_calls } : {}) };
}

// ── paid requests ──

interface PaidStep {
  tier: "premium" | "byok";
  provider: PaidProviderId;
  model: string;
  key: string;
}

/** The one step of a paid request, checked against what the caller allowed. */
export function paidStep(mode: string, access: PaidAccess | undefined): PaidStep {
  const m = parseMode(mode);
  if (m.tier === "free") throw new AiError(400, "MODEL_UNKNOWN", "That model isn't available.");
  if (m.tier === "premium") {
    if (access?.tier !== "premium") throw new AiError(403, "PREMIUM_REQUIRED", "Premium AI isn't switched on for your account. Use the free AI, or ask the school.");
    const pm = premiumModels().find((x) => x.id === `premium:${m.provider}/${m.model}`);
    const key = pm ? PAID_PROVIDERS[pm.provider].premiumKey() : undefined;
    if (!pm || !key) throw new AiError(400, "MODEL_UNKNOWN", "That premium model isn't available. Pick another one.");
    return { tier: "premium", provider: pm.provider, model: m.model, key };
  }
  if (!isPaidProvider(m.provider) || !m.model) throw new AiError(400, "MODEL_UNKNOWN", "Pick a provider and a model for your own key.");
  if (access?.tier !== "byok" || !access.key || access.provider !== m.provider) {
    throw new AiError(400, "BYOK_KEY_REQUIRED", `Add your ${PAID_PROVIDERS[m.provider].label} API key in TMCode's settings to use this model.`);
  }
  return { tier: "byok", provider: m.provider, model: m.model, key: access.key };
}

const premiumClients = new Map<string, OpenAI>();
/** Premium clients are kept (school keys); a BYOK client is made for the request and dropped with it. */
function paidClient(step: PaidStep): OpenAI {
  const make = () =>
    new OpenAI({
      apiKey: step.key,
      baseURL: PAID_PROVIDERS[step.provider].baseURL,
      timeout: 90_000,
      maxRetries: 0,
      ...(step.provider === "openrouter" ? { defaultHeaders: { "X-Title": "NGA TMCode" } } : {}),
    });
  if (step.tier === "byok") return make();
  const id = `${step.provider}|${step.key}`;
  let c = premiumClients.get(id);
  if (!c) {
    c = make();
    premiumClients.set(id, c);
  }
  return c;
}

/** A provider's refusal as the app sees it: keys scrubbed, BYOK refusals as BYOK_REJECTED. */
export function paidFailure(e: unknown, step: Pick<PaidStep, "tier" | "provider" | "key">): AiError {
  if (e instanceof AiError) return new AiError(e.status, e.code, scrubSecrets(e.message, step.key));
  const err = e as { status?: number; message?: string; error?: { message?: string } };
  const status = Number(err?.status) || 0;
  const said = scrubSecrets(String(err?.error?.message ?? err?.message ?? ""), step.key).replace(/\s+/g, " ").trim().slice(0, 300);
  const label = PAID_PROVIDERS[step.provider].label;
  if (step.tier === "byok" && status >= 400 && status < 500) {
    const why =
      status === 401 || status === 403
        ? `${label} refused your API key`
        : status === 402 || status === 429
          ? `${label} says your key is out of credit or over its rate limit`
          : status === 404
            ? `${label} doesn't know that model with your key`
            : `${label} refused the request`;
    return new AiError(400, "BYOK_REJECTED", said ? `${why}: ${said}` : `${why}.`);
  }
  if (step.tier === "premium" && status === 429) return new AiError(429, "PROVIDER_QUOTA", `${label} is busy or over its limit. Try again in a minute, or use the free AI.`);
  if (step.tier === "premium" && status) console.error(`[tmcode-ai] premium ${step.provider} failed (${status}): ${said}`);
  return new AiError(502, "PROVIDER_FAILED", "The AI didn't answer. Try again, or switch model.");
}

async function streamPaid(
  userId: number,
  mode: string,
  messages: ChatMessage[],
  onMeta: (m: StreamResult) => void,
  onDelta: (text: string) => void,
  signal: AbortSignal,
  agent: { tools: ToolDef[]; step: number } | undefined,
  opts: StreamOptions,
): Promise<StreamResult & { tool_calls?: ToolCall[] }> {
  const step = paidStep(mode, opts.access);
  const kind: Kind = agent && agent.step > 0 ? "agent" : "chat";
  if (step.tier === "premium" && opts.access?.tier === "premium") {
    // A question counts against the premium allowance; an agent's next steps against the agent allowance.
    if (kind === "chat" && premiumUsed(userId) >= opts.access.limit)
      throw new AiError(429, "PREMIUM_QUOTA", `You've used today's ${opts.access.limit} premium AI requests. Switch to the free AI; they come back tomorrow.`);
    if (kind === "agent" && userUsed(userId, "agent") >= userLimit("agent"))
      throw new AiError(429, "USER_QUOTA", `TMCode AI has done today's ${userLimit("agent")} agent steps for you. They come back tomorrow.`);
  }
  const body: Record<string, unknown> = {
    model: step.model,
    messages,
    stream: true,
    temperature: opts.temperature ?? (agent ? 0.2 : 0.3),
    max_tokens: opts.maxTokens ?? num(process.env.TMCODE_AI_MAX_TOKENS, agent ? 4000 : 1500),
  };
  if (agent?.tools.length) {
    body.tools = agent.tools;
    body.tool_choice = "auto";
  }
  let r: Awaited<ReturnType<typeof readStream>>;
  try {
    const stream = (await paidClient(step).chat.completions.create(body as never, { signal })) as unknown as AsyncIterable<Chunk>;
    r = await readStream(stream, step.model, (served) => onMeta({ provider: step.provider, model: served, tier: step.tier }), onDelta);
  } catch (e) {
    if (signal.aborted) throw e;
    throw paidFailure(e, step);
  }
  if (!r.sent) throw new AiError(502, "EMPTY", "The AI sent an empty answer.");
  if (step.tier === "premium") {
    if (kind === "chat") countPremium(userId);
    else {
      roll();
      userUse.set(`${userId}|agent`, userUsed(userId, "agent") + 1);
    }
  }
  return { provider: step.provider, model: r.served, tier: step.tier, ...(r.tool_calls ? { tool_calls: r.tool_calls } : {}) };
}

/**
 * Streams one answer: tries the plan in order (a provider that fails before sending anything
 * passes to the next). `onDelta` gets the text as it arrives. Counts the use when it worked.
 * Paid modes (premium:/byok:) go to their one model, with `opts.access` from the caller.
 */
export async function streamChat(
  userId: number,
  mode: string,
  messages: ChatMessage[],
  onMeta: (m: StreamResult) => void,
  onDelta: (text: string) => void,
  signal: AbortSignal,
  agent?: { tools: ToolDef[]; step: number },
  opts: StreamOptions = {},
): Promise<StreamResult & { tool_calls?: ToolCall[] }> {
  // Chokepoint (AI_USAGE_CONTROL_PLAN.md §5.5): nothing reaches a provider while the
  // school's AI policy has TMCode AI off (throws AiDisabledError).
  await assertAiApp("tmcode");
  if (parseMode(mode).tier !== "free") return streamPaid(userId, mode, messages, onMeta, onDelta, signal, agent, opts);
  // An agent's first step is the student's question; its next steps (tool results) have their own allowance.
  const kind: Kind = agent && agent.step > 0 ? "agent" : "chat";
  if (userUsed(userId, kind) >= userLimit(kind))
    throw new AiError(429, "USER_QUOTA", kind === "chat" ? `You've used today's ${userLimit("chat")} AI questions. They come back tomorrow.` : `TMCode AI has done today's ${userLimit("agent")} agent steps for you. They come back tomorrow.`);
  const steps = await plan(agent ? "agent" : "chat", mode);
  if (!steps.length) throw new AiError(429, "POOL_EXHAUSTED", "The school's free AI requests are used up for today. Try again tomorrow.");
  let lastErr: unknown = null;
  for (const step of steps) {
    let sent = false;
    try {
      const body: Record<string, unknown> = {
        model: step.model,
        messages,
        stream: true,
        temperature: opts.temperature ?? (agent ? 0.2 : 0.3),
        max_tokens: opts.maxTokens ?? num(process.env.TMCODE_AI_MAX_TOKENS, agent ? 4000 : 1500),
        ...modelOptions(step.provider, step.model, "chat"),
      };
      if (agent?.tools.length) {
        body.tools = agent.tools;
        body.tool_choice = "auto";
      }
      // OpenRouter falls back across free models itself (free ids only, see openrouterProvider).
      if (step.provider === "openrouter" && step.fallbacks?.length) body.models = [step.model, ...step.fallbacks].slice(0, 3);
      const stream = (await client(step.provider).chat.completions.create(body as never, { signal })) as unknown as AsyncIterable<Chunk>;
      const r = await readStream(
        stream,
        step.model,
        (served) => {
          sent = true;
          onMeta({ provider: step.provider, model: served, tier: "free" });
        },
        onDelta,
        (served, chunk) => {
          if (step.provider === "openrouter" && (!isFreeModel(served) || (chunk.usage?.cost ?? 0) > 0)) throw new AiError(502, "NOT_FREE", "OpenRouter answered with a paid model; the answer was stopped.");
        },
      );
      if (!r.sent) throw new AiError(502, "EMPTY", "The AI sent an empty answer.");
      countUse(userId, kind, step.provider);
      return { provider: step.provider, model: r.served, tier: "free", ...(r.tool_calls ? { tool_calls: r.tool_calls } : {}) };
    } catch (e) {
      if (signal.aborted) throw e;
      lastErr = e;
      noteFailure(step.provider, e);
      // Once part of an answer was shown, switching provider mid-answer would garble it.
      if (sent) throw e;
    }
  }
  if (lastErr instanceof AiError) throw lastErr;
  const status = (lastErr as { status?: number })?.status;
  if (status === 429) {
    throw new AiError(
      429,
      mode === "auto" ? "POOL_EXHAUSTED" : "PROVIDER_QUOTA",
      mode === "auto" ? "Every free AI is busy or used up right now. Try again in a few minutes." : "This model's free requests are used up for now. Switch to Auto: it picks a free AI that still has requests left.",
    );
  }
  throw new AiError(502, "PROVIDER_FAILED", "The AI didn't answer. Try again, or switch model.");
}

const COMPLETE_SYSTEM =
  "You complete code. Reply with ONLY the text to insert at <CURSOR>: no explanation, no code fences, no repetition of the code before or after the cursor. Keep it short (a line or a small block). If nothing sensible fits, reply with nothing.";

/**
 * One inline completion (ghost text): short, fast, cheap. Null when nothing fits.
 * Premium mode completes with the free Auto models (ghost text would spend the premium allowance
 * in minutes); BYOK completes with the user's own model and key.
 */
export async function complete(
  userId: number,
  mode: string,
  input: { prefix: string; suffix: string; language: string; path: string },
  signal: AbortSignal,
  opts: Pick<StreamOptions, "access"> = {},
): Promise<{ text: string; provider: ProviderId | PaidProviderId; model: string; tier: Tier } | null> {
  await assertAiApp("tmcode");
  const messages: ChatMessage[] = [
    { role: "system", content: COMPLETE_SYSTEM },
    { role: "user", content: `File: ${input.path} (${input.language})\n\n${input.prefix.slice(-3000)}<CURSOR>${input.suffix.slice(0, 1500)}` },
  ];
  const parsed = parseMode(mode);
  if (parsed.tier === "byok") {
    const step = paidStep(mode, opts.access);
    try {
      const res = await paidClient(step).chat.completions.create({ model: step.model, messages, temperature: 0.1, max_tokens: 200 } as never, { signal, timeout: 10_000 });
      const text = cleanCompletion(String((res as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message?.content ?? ""), input.prefix, input.suffix);
      return text ? { text, provider: step.provider, model: step.model, tier: "byok" } : null;
    } catch (e) {
      if (signal.aborted) return null;
      throw paidFailure(e, step);
    }
  }
  if (parsed.tier === "premium") paidStep(mode, opts.access); // still only for the entitled
  if (userUsed(userId, "complete") >= userLimit("complete")) throw new AiError(429, "USER_QUOTA", "You've used today's AI suggestions. They come back tomorrow.");
  const steps = await plan("complete", parsed.tier === "premium" ? "auto" : mode);
  if (!steps.length) throw new AiError(429, "POOL_EXHAUSTED", "No free AI is left for suggestions today.");
  for (const step of steps) {
    try {
      const res = await client(step.provider).chat.completions.create({ model: step.model, messages, temperature: 0.1, max_tokens: 200, ...modelOptions(step.provider, step.model, "complete") } as never, { signal, timeout: 8000 });
      countUse(userId, "complete", step.provider);
      const text = cleanCompletion(String((res as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message?.content ?? ""), input.prefix, input.suffix);
      return text ? { text, provider: step.provider, model: step.model, tier: "free" } : null;
    } catch (e) {
      if (signal.aborted) return null;
      noteFailure(step.provider, e);
    }
  }
  return null;
}

/** Strips fences and any echo of the code around the cursor. */
export function cleanCompletion(text: string, prefix: string, suffix: string): string {
  let t = text.replace(/^```[\w-]*\n?/, "").replace(/\n?```\s*$/, "");
  const lastLine = prefix.split("\n").pop() ?? "";
  if (lastLine.trim() && t.startsWith(lastLine)) t = t.slice(lastLine.length);
  const nextLine = suffix.split("\n")[0] ?? "";
  if (nextLine.trim() && t.endsWith(nextLine)) t = t.slice(0, -nextLine.length);
  return t.replace(/\s+$/, (s) => (s.includes("\n") ? "" : s));
}

/** The models a student can choose (free only), for the picker. */
export function catalog() {
  const out: { id: string; label: string; provider: ProviderId; providerLabel: string }[] = [];
  for (const p of Object.values(PROVIDERS)) {
    if (!configured(p.id)) continue;
    for (const m of p.chat()) out.push({ id: `${p.id}/${m}`, label: m.replace(/:free$/, ""), provider: p.id, providerLabel: p.label });
  }
  return out;
}

/** For tests. */
export function resetAiUsage() {
  providerUse.clear();
  userUse.clear();
  premiumUse.clear();
  cooldown.clear();
  premiumClients.clear();
  orRemaining = null;
}

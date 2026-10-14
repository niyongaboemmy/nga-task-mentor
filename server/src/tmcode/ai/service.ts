import OpenAI from "openai";
import { isFreeModel, freeModels } from "../../services/aiProviders/openrouterProvider";

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
 */

export type Kind = "chat" | "complete";
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
const AUTO_COMPLETE: ProviderId[] = ["groq", "gemini"];

// ── usage today (in memory: a restart forgives the day's counts, never over-spends a free tier) ──

const day = () => new Date().toISOString().slice(0, 10);
let today = day();
const providerUse = new Map<ProviderId, number>();
const userUse = new Map<string, number>();
const cooldown = new Map<ProviderId, number>();

function roll() {
  const d = day();
  if (d === today) return;
  today = d;
  providerUse.clear();
  userUse.clear();
}

export function userLimit(kind: Kind) {
  return kind === "chat" ? num(process.env.TMCODE_AI_CHAT_PER_DAY, 40) : num(process.env.TMCODE_AI_COMPLETE_PER_DAY, 200);
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
  const order = kind === "chat" ? AUTO_CHAT : AUTO_COMPLETE;
  const out: { provider: ProviderId; model: string; fallbacks?: string[] }[] = [];
  for (const p of order) {
    if (!configured(p) || coolingDown(p)) continue;
    const r = await remaining(p);
    if (r.remaining <= RESERVE[p]) continue;
    const model = kind === "chat" ? PROVIDERS[p].chat()[0] : PROVIDERS[p].complete();
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

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export interface StreamResult {
  provider: ProviderId;
  model: string;
}

/**
 * Streams one answer: tries the plan in order (a provider that fails before sending anything
 * passes to the next). `onDelta` gets the text as it arrives. Counts the use when it worked.
 */
export async function streamChat(userId: number, mode: string, messages: ChatMessage[], onMeta: (m: StreamResult) => void, onDelta: (text: string) => void, signal: AbortSignal): Promise<StreamResult> {
  if (userUsed(userId, "chat") >= userLimit("chat")) throw new AiError(429, "USER_QUOTA", `You've used today's ${userLimit("chat")} AI questions. They come back tomorrow.`);
  const steps = await plan("chat", mode);
  if (!steps.length) throw new AiError(429, "POOL_EXHAUSTED", "The school's free AI requests are used up for today. Try again tomorrow.");
  let lastErr: unknown = null;
  for (const step of steps) {
    let sent = false;
    try {
      const body: Record<string, unknown> = { model: step.model, messages, stream: true, temperature: 0.3, max_tokens: num(process.env.TMCODE_AI_MAX_TOKENS, 1500), ...modelOptions(step.provider, step.model, "chat") };
      // OpenRouter falls back across free models itself (free ids only, see openrouterProvider).
      if (step.provider === "openrouter" && step.fallbacks?.length) body.models = [step.model, ...step.fallbacks].slice(0, 3);
      const stream = (await client(step.provider).chat.completions.create(body as never, { signal })) as unknown as AsyncIterable<{ model?: string; choices?: { delta?: { content?: string | null } }[]; usage?: { cost?: number } }>;
      let served = step.model;
      for await (const chunk of stream) {
        if (chunk.model) served = chunk.model;
        if (step.provider === "openrouter" && (!isFreeModel(served) || (chunk.usage?.cost ?? 0) > 0)) throw new AiError(502, "NOT_FREE", "OpenRouter answered with a paid model; the answer was stopped.");
        if (!sent) {
          sent = true;
          onMeta({ provider: step.provider, model: served });
        }
        const text = chunk.choices?.[0]?.delta?.content;
        if (text) onDelta(text);
      }
      if (!sent) throw new AiError(502, "EMPTY", "The AI sent an empty answer.");
      countUse(userId, "chat", step.provider);
      return { provider: step.provider, model: served };
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

/** One inline completion (ghost text): short, fast, cheap. Null when nothing fits. */
export async function complete(userId: number, mode: string, input: { prefix: string; suffix: string; language: string; path: string }, signal: AbortSignal): Promise<{ text: string; provider: ProviderId; model: string } | null> {
  if (userUsed(userId, "complete") >= userLimit("complete")) throw new AiError(429, "USER_QUOTA", "You've used today's AI suggestions. They come back tomorrow.");
  const steps = await plan("complete", mode);
  if (!steps.length) throw new AiError(429, "POOL_EXHAUSTED", "No free AI is left for suggestions today.");
  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "You complete code. Reply with ONLY the text to insert at <CURSOR>: no explanation, no code fences, no repetition of the code before or after the cursor. Keep it short (a line or a small block). If nothing sensible fits, reply with nothing.",
    },
    { role: "user", content: `File: ${input.path} (${input.language})\n\n${input.prefix.slice(-3000)}<CURSOR>${input.suffix.slice(0, 1500)}` },
  ];
  for (const step of steps) {
    try {
      const res = await client(step.provider).chat.completions.create({ model: step.model, messages, temperature: 0.1, max_tokens: 200, ...modelOptions(step.provider, step.model, "complete") } as never, { signal, timeout: 8000 });
      countUse(userId, "complete", step.provider);
      const text = cleanCompletion(String((res as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message?.content ?? ""), input.prefix, input.suffix);
      return text ? { text, provider: step.provider, model: step.model } : null;
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
  cooldown.clear();
  orRemaining = null;
}

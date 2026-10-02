import { AIProvider } from "./types";
import { geminiProvider } from "./geminiProvider";
import { groqProvider } from "./groqProvider";
import { glmProvider } from "./glmProvider";
import { openaiProvider } from "./openaiProvider";
import { deepseekProvider } from "./deepseekProvider";

// Ported from nga_central_mis/backend/src/services/aiProviders/registry.ts
const ALL_PROVIDERS: Record<string, AIProvider> = {
  gemini: geminiProvider,
  groq: groqProvider,
  glm: glmProvider,
  openai: openaiProvider,
  deepseek: deepseekProvider,
};

const DEFAULT_ORDER = "gemini,groq,deepseek,glm";

/**
 * Providers to try, in order. Defaults to AI_PROVIDER_ORDER (comma-separated env var,
 * falling back to DEFAULT_ORDER) — pass `overrideOrder` only when a specific feature has
 * a genuine reason to prefer a different provider first, which still falls through to the
 * rest of the configured providers rather than being limited to just the override.
 */
export function orderedProviders(overrideOrder?: string[]): AIProvider[] {
  const names = (overrideOrder ?? (process.env.AI_PROVIDER_ORDER || DEFAULT_ORDER).split(","))
    .map((s) => s.trim())
    .filter(Boolean);
  return names.map((name) => ALL_PROVIDERS[name]).filter((p): p is AIProvider => !!p);
}

export function isAnyProviderConfigured(): boolean {
  return orderedProviders().some((p) => p.isConfigured());
}

export function getProviderStatus(): Record<string, boolean> {
  return Object.fromEntries(
    Object.entries(ALL_PROVIDERS).map(([name, p]) => [name, p.isConfigured()]),
  );
}

// --- Cooldown / circuit breaker ---------------------------------------------------
// A provider that just returned a quota/rate-limit error is skipped for COOLDOWN_MS
// rather than retried every request — daily/per-minute quotas do reset, so this is a
// temporary skip, not a permanent disable. In-memory only.
const COOLDOWN_MS = 5 * 60 * 1000;
const cooldownUntil = new Map<string, number>();

export function isCoolingDown(providerName: string): boolean {
  const until = cooldownUntil.get(providerName);
  return !!until && until > Date.now();
}

export function markCoolingDown(providerName: string, ms: number = COOLDOWN_MS): void {
  cooldownUntil.set(providerName, Date.now() + ms);
}

// --- Catalogue for pickers ---------------------------------------------------------
// What the teacher-facing "which AI" picker shows. Models mirror the defaults each
// provider adapter falls back to when its *_MODEL env var is unset.
const PROVIDER_META: Record<string, { label: string; model: () => string }> = {
  gemini: { label: "Google Gemini", model: () => process.env.GEMINI_MODEL || "gemini-2.5-flash" },
  groq: { label: "Groq", model: () => process.env.GROQ_MODEL || "openai/gpt-oss-20b" },
  glm: { label: "Zhipu GLM", model: () => process.env.GLM_MODEL || "glm-4.5-flash" },
  openai: { label: "OpenAI", model: () => process.env.OPENAI_MODEL || "gpt-4o" },
  deepseek: { label: "DeepSeek", model: () => process.env.DEEPSEEK_MODEL || "deepseek-chat" },
};

export interface ProviderDescription {
  name: string;
  label: string;
  model: string;
  configured: boolean;
  cooling_down: boolean;
  /** Position in AI_PROVIDER_ORDER (0 = tried first), null when not in the order at all. */
  order: number | null;
}

export function describeProviders(): ProviderDescription[] {
  const order = orderedProviders().map((p) => p.name);
  return Object.entries(ALL_PROVIDERS)
    .map(([name, p]) => ({
      name,
      label: PROVIDER_META[name]?.label ?? name,
      model: PROVIDER_META[name]?.model() ?? "",
      configured: p.isConfigured(),
      cooling_down: isCoolingDown(name),
      order: order.includes(name) ? order.indexOf(name) : null,
    }))
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
}

/**
 * Order that tries `preferred` first and then falls through to the normal
 * AI_PROVIDER_ORDER, so picking a provider never removes the safety net.
 */
export function preferredOrder(preferred?: string | null): string[] | undefined {
  if (!preferred || !ALL_PROVIDERS[preferred]) return undefined;
  const rest = orderedProviders()
    .map((p) => p.name)
    .filter((n) => n !== preferred);
  return [preferred, ...rest];
}

import { GenerateJSONParams } from "./types";
import { orderedProviders, isCoolingDown, markCoolingDown } from "./registry";
import { isQuotaError, isDeadProviderError, friendlyAIErrorMessage } from "./errors";

/** A bad key or an empty billing account won't recover in minutes. */
const DEAD_PROVIDER_COOLDOWN_MS = 60 * 60 * 1000;

function coolDownIfNeeded(name: string, err: any) {
  if (isDeadProviderError(err)) markCoolingDown(name, DEAD_PROVIDER_COOLDOWN_MS);
  else if (isQuotaError(err)) markCoolingDown(name);
}

export interface GenerateStructuredContentResult<T> {
  data: T;
  providerUsed: string;
}

export interface GenerateStructuredContentOptions {
  /** Try these providers, in this order, instead of AI_PROVIDER_ORDER — see orderedProviders(). */
  providerOrder?: string[];
}

// Adapted from nga_central_mis/backend/src/services/aiProviders/generate.ts (that version
// throws a shared ServiceUnavailableError via an error-class hierarchy this app doesn't
// have; here a plain Error with the same friendly message is thrown instead — every
// existing controller here already reads `.message` off caught errors).

/**
 * Tries each configured provider in AI_PROVIDER_ORDER (or `options.providerOrder` when given),
 * skipping any currently cooling down from a recent quota error. Returns the first success.
 */
export async function generateStructuredContent<T = any>(
  params: GenerateJSONParams,
  options?: GenerateStructuredContentOptions,
): Promise<GenerateStructuredContentResult<T>> {
  const providers = orderedProviders(options?.providerOrder);
  let lastErr: any = null;
  let attempted = 0;

  for (const provider of providers) {
    if (!provider.isConfigured()) continue;
    if (isCoolingDown(provider.name)) {
      console.log(`[AI] ${provider.name} is cooling down, skipping`);
      continue;
    }

    attempted++;
    try {
      console.log(`[AI] Using ${provider.name} for structured generation`);
      const data = await provider.generateJSON<T>(params);
      return { data, providerUsed: provider.name };
    } catch (err: any) {
      lastErr = err;
      console.error(`[AI] Provider ${provider.name} failed:`, err?.message);
      coolDownIfNeeded(provider.name, err);
    }
  }

  if (attempted === 0) {
    throw new Error(
      "AI generation is not configured. Add an API key for at least one AI provider to the backend environment.",
    );
  }
  throw new Error(friendlyAIErrorMessage(lastErr));
}

/**
 * Complete top-level `{…}` objects inside a (possibly truncated) JSON array.
 * A reply cut off mid-question still yields the questions before it.
 */
function salvageObjects(text: string): any[] {
  const start = text.indexOf("[");
  if (start < 0) return [];
  const out: any[] = [];
  let depth = 0;
  let inString = false;
  let escaped = false;
  let objStart = -1;
  for (let i = start + 1; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === "{") {
      if (depth === 0) objStart = i;
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 0 && objStart >= 0) {
        try {
          out.push(JSON.parse(text.slice(objStart, i + 1)));
        } catch {
          /* skip the malformed one, keep going */
        }
        objStart = -1;
      }
    } else if (c === "]" && depth === 0) break;
  }
  return out;
}

export const parseLenientJson = (text: string): any => {
  const cleaned = text
    .replace(/^```(?:json)?\s*/m, "")
    .replace(/\s*```\s*$/m, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const arrMatch = cleaned.match(/\[[\s\S]*\]/);
    if (arrMatch) {
      try {
        return JSON.parse(arrMatch[0]);
      } catch {
        /* fall through to salvage */
      }
    }
    const salvaged = salvageObjects(cleaned);
    if (salvaged.length) return salvaged;
    const objMatch = cleaned.match(/\{[\s\S]*\}/);
    if (objMatch) return JSON.parse(objMatch[0]);
    throw new Error("AI response was not valid JSON");
  }
};

/**
 * Same provider order/fallback/cooldown behavior as generateStructuredContent, but for
 * operations whose output shape is too polymorphic for a fixed JSON Schema (quiz
 * questions generated from a document, where question_data/correct_answer differ per
 * question type) — asks for JSON via the prompt text itself instead of constrained
 * decoding, and lenient-parses whatever text comes back.
 */
export async function generateFreeformJSON<T = any>(
  prompt: string,
  maxOutputTokens?: number,
  options?: GenerateStructuredContentOptions,
): Promise<GenerateStructuredContentResult<T>> {
  const providers = orderedProviders(options?.providerOrder);
  let lastErr: any = null;
  let attempted = 0;

  for (const provider of providers) {
    if (!provider.isConfigured()) continue;
    if (isCoolingDown(provider.name)) {
      console.log(`[AI] ${provider.name} is cooling down, skipping`);
      continue;
    }

    attempted++;
    try {
      console.log(`[AI] Using ${provider.name} for freeform generation`);
      const text = await provider.generateText(prompt, maxOutputTokens, { json: true });
      const data = parseLenientJson(text) as T;
      return { data, providerUsed: provider.name };
    } catch (err: any) {
      lastErr = err;
      console.error(`[AI] Provider ${provider.name} failed:`, err?.message);
      coolDownIfNeeded(provider.name, err);
    }
  }

  if (attempted === 0) {
    throw new Error(
      "AI generation is not configured. Add an API key for at least one AI provider to the backend environment.",
    );
  }
  throw new Error(friendlyAIErrorMessage(lastErr));
}

import { GenerateJSONParams } from "./types";
import { orderedProviders, isCoolingDown, markCoolingDown } from "./registry";
import { isQuotaError, friendlyAIErrorMessage } from "./errors";

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
      if (isQuotaError(err)) {
        markCoolingDown(provider.name);
      }
    }
  }

  if (attempted === 0) {
    throw new Error(
      "AI generation is not configured. Add an API key for at least one AI provider to the backend environment.",
    );
  }
  throw new Error(friendlyAIErrorMessage(lastErr));
}

const stripAndParseJson = (text: string): any => {
  const cleaned = text
    .replace(/^```(?:json)?\s*/m, "")
    .replace(/\s*```\s*$/m, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const arrMatch = cleaned.match(/\[[\s\S]*\]/);
    if (arrMatch) return JSON.parse(arrMatch[0]);
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
      const text = await provider.generateText(prompt, maxOutputTokens);
      const data = stripAndParseJson(text) as T;
      return { data, providerUsed: provider.name };
    } catch (err: any) {
      lastErr = err;
      console.error(`[AI] Provider ${provider.name} failed:`, err?.message);
      if (isQuotaError(err)) {
        markCoolingDown(provider.name);
      }
    }
  }

  if (attempted === 0) {
    throw new Error(
      "AI generation is not configured. Add an API key for at least one AI provider to the backend environment.",
    );
  }
  throw new Error(friendlyAIErrorMessage(lastErr));
}

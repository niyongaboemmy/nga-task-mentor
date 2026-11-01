import { GenerateJSONParams } from "./types";
import { orderedProviders, isCoolingDown, markCoolingDown } from "./registry";
import { isQuotaError, isDeadProviderError, friendlyAIErrorMessage } from "./errors";
import { assertAiApp } from "../aiPolicy";
import { withPersonalAi, type AiAnswer, type PersonalAiCall } from "../myAiGateway";

/** A bad key or an empty billing account won't recover in minutes. */
const DEAD_PROVIDER_COOLDOWN_MS = 60 * 60 * 1000;

function coolDownIfNeeded(name: string, err: any) {
  if (isDeadProviderError(err)) markCoolingDown(name, DEAD_PROVIDER_COOLDOWN_MS);
  else if (isQuotaError(err)) markCoolingDown(name);
}

export interface GenerateStructuredContentResult<T> {
  data: T;
  providerUsed: string;
  /** What answered (My AI): set when the call passed `options.personal`. */
  ai?: AiAnswer;
}

export interface GenerateStructuredContentOptions {
  /** Try these providers, in this order, instead of AI_PROVIDER_ORDER — see orderedProviders(). */
  providerOrder?: string[];
  /**
   * A call made by a person (My AI, MY_AI_GATEWAY.md): their own key may answer through
   * the MIS gateway, with the same prompt/schema; otherwise the school chain below runs.
   * Leave unset for system work (grading on submit) — that always uses the school AI.
   */
  personal?: PersonalAiCall | null;
}

/** Personal answers report the provider of the person's key as providerUsed. */
const personalProvider = (ai: AiAnswer) => `${ai.provider || "personal"}`;

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
  // Chokepoint (AI_USAGE_CONTROL_PLAN.md §5.5): no provider is called while the
  // school's AI policy has AI off for Task Mentor -- throws AiDisabledError (403).
  await assertAiApp("tm");
  if (options?.personal) {
    const { result, ai } = await withPersonalAi(options.personal, {
      personal: async (gw) => {
        const out = await gw.json<T>({
          prompt: params.prompt,
          schema: params.schema,
          schemaName: params.schemaName,
          maxOutputTokens: params.maxOutputTokens,
        });
        return { data: { data: out.data, providerUsed: personalProvider(out.ai) }, ai: out.ai };
      },
      school: () => schoolStructured<T>(params, options),
    });
    return { ...result, ai };
  }
  return schoolStructured<T>(params, options);
}

async function schoolStructured<T>(
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
  // Chokepoint (AI_USAGE_CONTROL_PLAN.md §5.5): no provider is called while the
  // school's AI policy has AI off for Task Mentor -- throws AiDisabledError (403).
  await assertAiApp("tm");
  if (options?.personal) {
    const { result, ai } = await withPersonalAi(options.personal, {
      // Same prompt; the gateway's plain-text call, parsed as leniently as below.
      personal: async (gw) => {
        const out = await gw.text({ prompt, system: FREEFORM_JSON_SYSTEM });
        return { data: { data: parseLenientJson(out.data) as T, providerUsed: personalProvider(out.ai) }, ai: out.ai };
      },
      school: () => schoolFreeform<T>(prompt, maxOutputTokens, options),
    });
    return { ...result, ai };
  }
  return schoolFreeform<T>(prompt, maxOutputTokens, options);
}

/** The gateway's text call has no JSON mode; this asks for the same thing the local json mode does. */
const FREEFORM_JSON_SYSTEM = "Reply with valid JSON only: no prose, no markdown code fences.";

async function schoolFreeform<T>(
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

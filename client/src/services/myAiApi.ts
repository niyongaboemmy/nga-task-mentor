import { useEffect, useState } from "react";
import axios from "../utils/axiosConfig";
import { misHomeUrl } from "../utils/misLinks";

/**
 * My AI (people's own AI keys, held in the NGA MIS; MY_AI_GATEWAY.md). Task Mentor
 * never sees the keys: the server asks the MIS which AI answers, and the panels show
 * a small "Answers with" control plus who answered (`ai` in each AI response).
 */

export interface MyAiChoice {
  credentialId: number;
  provider: string;
  model: string;
  label?: string | null;
}

export interface MyAiRoutes {
  enabled: boolean;
  v?: number | null;
  byTask?: Record<string, { route: "personal" | "school"; reason: string; credentialId?: number; label?: string | null; model?: string; provider?: string }>;
  choices?: MyAiChoice[];
}

/** What answered a call (the `ai` field of an AI response). */
export interface AiAnswer {
  /** "handoff": the person pasted the answer from their own Claude / ChatGPT. */
  route: "personal" | "school" | "handoff";
  reason: string;
  credentialId?: number;
  label?: string | null;
  provider?: string;
  model?: string;
  fallbackFrom?: string;
}

/** Where people manage their own keys (MIS front end). */
export const myAiManageUrl = (): string => `${misHomeUrl()}/my-ai`;

/** The value sent as `aiRoute` for a choice: "<credentialId>:<model>". */
export const choiceValue = (c: MyAiChoice) => `${c.credentialId}:${c.model}`;

export const choiceLabel = (c: MyAiChoice) => `${c.label || c.provider}${c.model ? ` · ${c.model}` : ""}`;

const TTL_MS = 60_000;
let cached: { at: number; value: Promise<MyAiRoutes> } | null = null;

/** GET /api/ai/my-routes, cached for a minute; { enabled:false } on any error. */
export function fetchMyAiRoutes(): Promise<MyAiRoutes> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;
  // Never throws, even where axios is stubbed: the control simply stays hidden.
  const value = Promise.resolve()
    .then(() => axios.get("/ai/my-routes"))
    .then((res) => (res.data?.data as MyAiRoutes) ?? { enabled: false })
    .catch(() => {
      cached = null;
      return { enabled: false } as MyAiRoutes;
    });
  cached = { at: Date.now(), value };
  return value;
}

/** Tests only. */
export function clearMyAiRoutesCache() {
  cached = null;
}

/** The signed-in person's My AI routes (null while loading, or when `skip`). */
export function useMyAiRoutes(skip = false): MyAiRoutes | null {
  const [routes, setRoutes] = useState<MyAiRoutes | null>(null);
  useEffect(() => {
    if (skip) return;
    let alive = true;
    fetchMyAiRoutes().then((r) => alive && setRoutes(r));
    return () => {
      alive = false;
    };
  }, [skip]);
  return routes;
}

const FALLBACK_WHY: Record<string, string> = {
  AI_KEY_NO_CREDIT: "was out of credit",
  AI_KEY_INVALID: "was not accepted by the provider",
  AI_KEY_RATE_LIMITED: "was busy (rate-limited)",
  AI_PERSONAL_FAILED: "could not answer",
};

/** One line saying who answered, or null when there's nothing worth saying. */
export function describeAiAnswer(ai: AiAnswer | null | undefined): string | null {
  if (!ai) return null;
  if (ai.route === "handoff") return "via your own AI (pasted)";
  if (ai.route === "personal") {
    const who = ai.label || (ai.provider ? `My ${ai.provider}` : "My AI");
    return `via ${who}${ai.model ? ` · ${ai.model}` : ""}`;
  }
  if (ai.fallbackFrom) {
    const why = FALLBACK_WHY[ai.fallbackFrom] ?? "could not answer";
    return `Your key${ai.label ? ` '${ai.label}'` : ""} ${why}, so School AI answered.`;
  }
  return null;
}

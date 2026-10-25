import { NextFunction, Request, Response } from "express";
import {
  AI_REASON_MESSAGES,
  decideAi,
  type AiApp,
  type AiDecision,
  type AiFeature,
  type AiPolicy,
} from "../vendor/nga-access";
import { aiDisabledBody, getAiPolicy } from "../services/aiPolicy";
import type { ItemContext } from "../utils/aiContext";
import { trackAiDenied } from "../utils/aiEvents";

/**
 * AI on a route (AI_USAGE_CONTROL_PLAN.md §5.3): the shared decideAi rule --
 *   1. the school-wide policy (MIS; fail closed),
 *   2. inside a quiz/assignment, the teacher's ai_mode (learners only),
 *   3. otherwise the role permission AI_USE.
 * A refusal is 403 { success:false, code:"AI_DISABLED", reason, message }.
 */

export type AiContextResolver = (req: Request) => Promise<ItemContext | null | undefined>;

export const hasAiUse = (req: Request) => !!(req as any).user?.permissions?.has("AI_USE");

export interface AiVerdict extends AiDecision {
  message: string;
  policy: AiPolicy | null;
  item: ItemContext | null;
}

/** decideAi for this caller (the policy fetched, the item context given). */
export async function decideAiFor(
  req: Request,
  feature: AiFeature,
  item: ItemContext | null | undefined,
  app: AiApp = "tm",
): Promise<AiVerdict> {
  const policy = await getAiPolicy();
  const d = decideAi(policy, { app, feature, hasAiUse: hasAiUse(req), assessment: item ?? null });
  return { ...d, message: AI_REASON_MESSAGES[d.reason], policy, item: item ?? null };
}

export const requireAi =
  (feature: AiFeature, resolveCtx?: AiContextResolver, app: AiApp = "tm") =>
  async (req: Request, res: Response, next: NextFunction) => {
    let item: ItemContext | null | undefined = null;
    try {
      if (resolveCtx) item = await resolveCtx(req);
    } catch (err: any) {
      console.error("[requireAi] could not resolve the item:", err?.message ?? err);
      return res.status(500).json({ success: false, message: "Could not check whether AI is allowed here." });
    }
    const verdict = await decideAiFor(req, feature, item, app);
    if (!verdict.allowed) {
      trackAiDenied(req, feature, verdict.reason, item ?? null);
      return res.status(403).json(aiDisabledBody(verdict.reason));
    }
    (req as any).aiVerdict = verdict;
    next();
  };

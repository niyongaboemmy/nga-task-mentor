import { Request } from "express";
import { trackKeyEvent } from "../activity/keyEvents";
import type { AiAssessmentContext, AiFeature, AiMode, AiReason } from "../vendor/nga-access";

/**
 * AI usage control activity events (AI_USAGE_CONTROL_PLAN.md §8):
 *   tm.ai.mode_set       a teacher set the AI mode of their quiz/assignment
 *   tm.ai.mode_override  someone else (a super admin, *_MANAGE_ANY) changed it
 *   tm.ai.denied         a learner asked for AI inside an item that has it off
 *                        (sampled: once per learner, item and feature per 10 min)
 * Params carry ids and codes only.
 */

export function trackAiModeChange(
  req: Request,
  kind: "quiz" | "assignment",
  item: { id: number; created_by?: number | string | null },
  from: AiMode | null,
  to: AiMode,
) {
  if (from === to) return;
  const actor = Number((req as any).user?.id);
  const override = item.created_by != null && Number(item.created_by) !== actor;
  trackKeyEvent(req, override ? "tm.ai.mode_override" : "tm.ai.mode_set", {
    kind,
    item_id: item.id,
    from: from ?? null,
    to,
  });
}

const DENIED_SAMPLE_MS = 10 * 60_000;
const lastDenied = new Map<string, number>();

export function trackAiDenied(req: Request, feature: AiFeature, reason: AiReason, item: AiAssessmentContext | null) {
  if (!item) return; // role refusals outside an item aren't interesting to teachers
  const key = `${(req as any).user?.id}|${item.kind}|${item.id}|${feature}`;
  const now = Date.now();
  if (now - (lastDenied.get(key) ?? 0) < DENIED_SAMPLE_MS) return;
  lastDenied.set(key, now);
  if (lastDenied.size > 5000) {
    for (const [k, at] of lastDenied) if (now - at > DENIED_SAMPLE_MS) lastDenied.delete(k);
  }
  trackKeyEvent(req, "tm.ai.denied", { feature, reason, kind: item.kind, item_id: item.id });
}

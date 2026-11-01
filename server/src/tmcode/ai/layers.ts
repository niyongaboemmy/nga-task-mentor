import { Request } from "express";
import { Assignment, Quiz, QuizQuestion } from "../../models";
import { decideAiFor, type AiVerdict } from "../../middleware/requireAi";
import type { ItemContext } from "../../utils/aiContext";
import { getQuestionBankInclude } from "../../utils/quizUtils";
import type { AiFeature } from "../../vendor/nga-access";
import { normalizeHelp, signLayer, type LearningHelp } from "./learning";

/**
 * The AI layer of a TMCode request (nga-tmcode reports/TMCode vibe coding proposal 2026.md §8):
 * Exam (no AI), Learning (the item's ai_mode is "hints": the tutor, words only) or Industrial.
 *
 * decideAi (vendored @nga/access) allows a "hints" item only the `hint` feature; TMCode's tutor is
 * that feature -- read-only tools, the tutor prompt and the output filter (learning.ts) -- so a
 * learner's chat in a hints item is decided as `hint`, and suggestions stay refused.
 */

export type Layer = "exam" | "learning" | "industrial";

export interface LayerDecision {
  layer: Layer;
  verdict: AiVerdict;
  item: ItemContext | null;
  /** Learning's knobs (the item's ai_help, else the defaults). */
  help: LearningHelp;
  /** Industrial: the teacher allowed students' own AI tools for the item. */
  ownTools: boolean;
  /** When the item is due (the sticky layer's expiry starts from it). */
  due: Date | null;
}

interface ItemSettings {
  help: LearningHelp;
  ownTools: boolean;
  due: Date | null;
}

async function settingsOf(item: ItemContext | null): Promise<ItemSettings> {
  const none: ItemSettings = { help: normalizeHelp(null), ownTools: false, due: null };
  if (!item) return none;
  if (item.kind === "assignment") {
    const a = await Assignment.findByPk(item.id, { attributes: ["id", "ai_help", "ai_own_tools", "due_date"] });
    return a ? { help: normalizeHelp(a.ai_help), ownTools: !!a.ai_own_tools, due: a.due_date ?? null } : none;
  }
  if (item.kind === "quiz") {
    const q = await Quiz.findByPk(item.id, { attributes: ["id", "ai_help", "ai_own_tools", "end_date"] });
    return q ? { help: normalizeHelp(q.ai_help), ownTools: !!q.ai_own_tools, due: q.end_date ?? null } : none;
  }
  return none;
}

/** The layer for this user and item; `feature` is what the request wants ("assist" or "complete"). */
export async function decideLayer(req: Request, feature: Extract<AiFeature, "assist" | "complete">, item: ItemContext | null): Promise<LayerDecision> {
  const settings = await settingsOf(item);
  if (item && item.aiMode === "hints") {
    // The tutor is decideAi's "hint" feature; suggestions (generated code) are not allowed in Learning.
    const hint = await decideAiFor(req, "hint", item, "tmcode");
    if (!hint.allowed) return { layer: "exam", verdict: hint, item, ...settings };
    if (feature === "complete") return { layer: "learning", verdict: { ...hint, allowed: false, reason: "HINTS_ONLY", message: "Learning: suggestions write code, so they're off. Ask the tutor instead." }, item, ...settings };
    return { layer: "learning", verdict: hint, item, ...settings };
  }
  const v = await decideAiFor(req, feature, item, "tmcode");
  return { layer: v.allowed ? "industrial" : "exam", verdict: v, item, ...settings };
}

/** The project's signed layer, for TMCode to keep in `.tmcode/layer.json` (null: no key, or no item). */
export function layerToken(projectId: number | null, d: LayerDecision): { claims: string; sig: string } | null {
  if (!projectId || !d.item) return null;
  const mode = d.layer === "learning" ? "hints" : d.layer === "industrial" ? "full" : "off";
  return signLayer(projectId, mode, d.ownTools, d.due);
}

const parse = (v: unknown) => {
  if (typeof v !== "string") return v;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
};

/** A quiz's reference solutions, for the Learning filter to compare against (never sent to a model). */
export async function referenceSolutions(item: ItemContext | null): Promise<string[]> {
  if (!item || item.kind !== "quiz") return [];
  try {
    const questions = await QuizQuestion.findAll({ where: { quiz_id: item.id }, include: getQuestionBankInclude() });
    const out: string[] = [];
    for (const q of questions) {
      const data: any = parse(q.questionBank?.question_data);
      if (typeof data?.reference_solution === "string" && data.reference_solution.trim()) out.push(data.reference_solution);
    }
    return out.slice(0, 50);
  } catch (e) {
    console.error("[tmcode-ai] reference solutions:", (e as Error).message);
    return [];
  }
}

import { generateStructuredContent, JSONSchema } from "../aiProviders";
import { preferredOrder } from "../aiProviders/registry";
import { htmlToText } from "./misCourseResources";

/**
 * AI marking assistant: drafts rubric scores and feedback for ONE submission.
 * Nothing is stored and nothing is shown to the student: the teacher reviews,
 * edits and saves through the normal grading endpoint (PATCH /grade). The AI
 * never sees the student's name, only the work.
 *
 * Scores are clamped to each criterion's maximum and snapped to half marks, so
 * a model that can't count can't produce an impossible grade.
 */

/** Characters of the student's work sent to the model (typed answer + files). */
export const WORK_BUDGET = 12_000;
const DESCRIPTION_BUDGET = 4_000;

export const TONES = ["encouraging", "neutral", "direct"] as const;
export type Tone = (typeof TONES)[number];

export interface RubricCriterion {
  criteria: string;
  description?: string;
  max_score: number;
}

export interface FeedbackInput {
  title: string;
  description: string;
  maxScore: number;
  rubric: RubricCriterion[];
  /** The student's typed answer (HTML or text). */
  text: string;
  /** Text read from attached files, with their names. */
  files: Array<{ name: string; text: string }>;
  /** Attached files the AI couldn't read (images, other formats). */
  unread: string[];
  tone?: Tone;
  instructions?: string;
  provider?: string | null;
}

export interface FeedbackDraft {
  /** Index → suggested score, ready for `rubric_scores` (empty without a rubric). */
  rubric_scores: Record<number, number>;
  criteria: Array<{ index: number; criteria: string; score: number; max_score: number; comment: string }>;
  score: number;
  max_score: number;
  /** Feedback to the student, ready for the feedback box. */
  feedback: string;
  strengths: string[];
  next_steps: string[];
  confidence: "low" | "medium" | "high";
  /** Things the teacher should know (couldn't read a file, off-topic, very short…). */
  warnings: string[];
  provider_used: string;
}

const draftSchema: JSONSchema = {
  type: "object",
  properties: {
    criteria: {
      type: "array",
      description: "One entry per rubric criterion, in the same order (empty when there is no rubric)",
      items: {
        type: "object",
        properties: {
          index: { type: "number", description: "0-based position of the criterion in the rubric" },
          score: { type: "number", description: "Marks for this criterion, 0 to its maximum" },
          comment: { type: "string", description: "One or two sentences for the TEACHER explaining the mark, quoting the work" },
        },
        required: ["index", "score", "comment"],
      },
    },
    overall_score: { type: "number", description: "Total marks, 0 to the assignment maximum (used when there is no rubric)" },
    feedback: { type: "string", description: "Feedback addressed to the student (second person), 3-6 sentences" },
    strengths: { type: "array", items: { type: "string" }, description: "Up to 3 specific strengths" },
    next_steps: { type: "array", items: { type: "string" }, description: "Up to 3 concrete next steps" },
    confidence: { type: "string", description: "How sure the marks are: low, medium or high" },
    off_topic: { type: "boolean", description: "true when the work doesn't answer this assignment" },
  },
  required: ["criteria", "overall_score", "feedback", "strengths", "next_steps", "confidence", "off_topic"],
};

/** Half marks, between 0 and max. Pure. */
export function snap(score: unknown, max: number): number {
  const n = Number(score);
  if (!Number.isFinite(n) || !(max > 0)) return 0;
  return Math.min(max, Math.max(0, Math.round(n * 2) / 2));
}

/** The student's work as text, within budget, files labelled. Pure. */
export function workText(text: string, files: Array<{ name: string; text: string }>, budget = WORK_BUDGET): { text: string; truncated: boolean } {
  const parts = [htmlToText(text || "").trim() ? `TYPED ANSWER:\n${htmlToText(text).trim()}` : ""]
    .concat(files.filter((f) => f.text.trim()).map((f) => `FILE "${f.name}":\n${f.text.trim()}`))
    .filter(Boolean);
  const all = parts.join("\n\n");
  return { text: all.slice(0, budget), truncated: all.length > budget };
}

const TONE_LINE: Record<Tone, string> = {
  encouraging: "Warm and encouraging: start with what went well, then what to improve.",
  neutral: "Balanced and factual.",
  direct: "Short and direct, focused on what to fix.",
};

export function buildFeedbackPrompt(p: {
  title: string;
  description: string;
  maxScore: number;
  rubric: RubricCriterion[];
  work: string;
  truncated: boolean;
  tone: Tone;
  instructions?: string;
}): string {
  const rubric = p.rubric.length
    ? p.rubric.map((c, i) => `${i}. ${c.criteria} (max ${c.max_score})${c.description ? `: ${c.description}` : ""}`).join("\n")
    : "(no rubric: give one overall_score out of the total)";
  return `You are an experienced secondary-school teacher in Rwanda (Competence-Based Curriculum) helping a colleague mark a student's assignment. Your draft will be checked and edited by the teacher before the student sees anything.

ASSIGNMENT: ${p.title || "(untitled)"}
TOTAL MARKS: ${p.maxScore}
TASK (written by the teacher):
"""
${p.description || "(no description)"}
"""

RUBRIC:
${rubric}

STUDENT'S WORK${p.truncated ? " (long: only the beginning is shown)" : ""}:
"""
${p.work}
"""
${p.instructions ? `\nTHE TEACHER ASKS: ${p.instructions}\n` : ""}
RULES:
- Mark only what is in the work. Be fair and consistent with the rubric descriptors; don't reward length.
- For each criterion give a score from 0 to its max and a short comment for the teacher quoting or pointing to the work.
- Feedback to the student: ${TONE_LINE[p.tone]} Speak to the student ("you"), name specific things they did, and give clear next steps. No mark numbers in the feedback.
- Never invent facts about the student. Write in the same language as the student's work.
- If the work doesn't answer the task, set off_topic=true and give low marks with an explanation.
- confidence: "low" when the work is very short, unclear, or the rubric is hard to apply.

Return JSON only.`;
}

export async function draftFeedback(input: FeedbackInput): Promise<FeedbackDraft> {
  const { text: work, truncated } = workText(input.text, input.files);
  if (!work.trim()) {
    throw Object.assign(
      new Error(
        input.unread.length
          ? `The AI can't read ${input.unread.join(", ")} (only typed answers, PDF and Word files). Mark this one yourself.`
          : "This submission is empty: there is nothing for the AI to read.",
      ),
      { statusCode: 400 },
    );
  }
  const tone: Tone = TONES.includes(input.tone as Tone) ? (input.tone as Tone) : "encouraging";
  type Raw = {
    criteria?: Array<{ index?: number; score?: number; comment?: string }>;
    overall_score?: number;
    feedback?: string;
    strengths?: string[];
    next_steps?: string[];
    confidence?: string;
    off_topic?: boolean;
  };
  let data: Raw;
  let providerUsed: string;
  try {
    ({ data, providerUsed } = await generateStructuredContent<Raw>(
      {
        schemaName: "marking_draft",
        schema: draftSchema,
        prompt: buildFeedbackPrompt({
          title: input.title,
          description: htmlToText(input.description || "").slice(0, DESCRIPTION_BUDGET),
          maxScore: input.maxScore,
          rubric: input.rubric,
          work,
          truncated,
          tone,
          instructions: input.instructions?.slice(0, 500),
        }),
        maxOutputTokens: 2500,
      },
      { providerOrder: preferredOrder(input.provider) },
    ));
  } catch (err: any) {
    throw Object.assign(new Error(err?.message || "The AI service is unavailable."), { statusCode: 503 });
  }

  const byIndex = new Map<number, { score?: number; comment?: string }>();
  (data?.criteria || []).forEach((c, pos) => {
    const i = Number.isInteger(Number(c?.index)) ? Number(c.index) : pos;
    if (!byIndex.has(i)) byIndex.set(i, c);
  });
  const criteria = input.rubric.map((c, index) => {
    const raw = byIndex.get(index) ?? {};
    return {
      index,
      criteria: c.criteria,
      max_score: Number(c.max_score) || 0,
      score: snap(raw.score, Number(c.max_score) || 0),
      comment: String(raw.comment || "").trim().slice(0, 600),
    };
  });
  const rubric_scores: Record<number, number> = {};
  for (const c of criteria) rubric_scores[c.index] = c.score;
  const score = criteria.length
    ? Math.min(input.maxScore, Math.round(criteria.reduce((a, c) => a + c.score, 0) * 100) / 100)
    : snap(data?.overall_score, input.maxScore);

  const feedback = String(data?.feedback || "").trim().slice(0, 3000);
  if (!feedback && criteria.every((c) => !c.comment)) {
    throw Object.assign(new Error("The AI didn't return a usable draft. Try again."), { statusCode: 502 });
  }
  const list = (v: unknown) => (Array.isArray(v) ? v.map((s) => String(s).trim()).filter(Boolean).slice(0, 3).map((s) => s.slice(0, 300)) : []);
  const warnings: string[] = [];
  if (input.unread.length) warnings.push(`Not read by the AI: ${input.unread.join(", ")}. Check those files yourself.`);
  if (truncated) warnings.push("The work is long: the AI only read the beginning.");
  if (data?.off_topic) warnings.push("The AI thinks this work may not answer the assignment.");
  const confidence = (["low", "medium", "high"] as const).includes(data?.confidence as never) ? (data!.confidence as FeedbackDraft["confidence"]) : "medium";

  return {
    rubric_scores,
    criteria,
    score,
    max_score: input.maxScore,
    feedback,
    strengths: list(data?.strengths),
    next_steps: list(data?.next_steps),
    confidence,
    warnings,
    provider_used: providerUsed,
  };
}

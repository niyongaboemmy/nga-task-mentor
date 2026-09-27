import { z } from "zod";
import { SUPPORTED_AI_QUESTION_TYPES } from "../services/ai/prompts/generateFromDocumentPrompt";

/**
 * One generation call is one batch. The client splits a bigger plan into
 * batches itself (so the teacher sees progress, can cancel, and keeps what
 * already came back if a later batch fails) — hence the modest per-call cap.
 */
export const AI_BATCH_MAX_QUESTIONS = 12;
export const AI_PER_CELL_MAX = 10;
export const AI_INSTRUCTIONS_MAX = 2000;

const count = z.coerce.number().int().min(0).max(AI_PER_CELL_MAX).default(0);

export const aiPlanItemSchema = z.object({
  question_type: z.enum(SUPPORTED_AI_QUESTION_TYPES as [string, ...string[]], {
    message: "Unsupported question type",
  }),
  EASY: count,
  MEDIUM: count,
  DIFFICULT: count,
});

export const aiGenerateBatchSchema = z
  .object({
    context_id: z.string().uuid({ message: "context_id is required" }),
    plan: z.array(aiPlanItemSchema).min(1, "Choose at least one question type").max(13),
    additional_context: z
      .string()
      .trim()
      .max(AI_INSTRUCTIONS_MAX, `Instructions must be at most ${AI_INSTRUCTIONS_MAX} characters`)
      .optional()
      .transform((v) => (v ? v : undefined)),
    provider: z
      .enum(["gemini", "groq", "glm", "openai"])
      .nullish()
      .transform((v) => v ?? null),
    avoid_questions: z.array(z.string().max(500)).max(60).optional().default([]),
    /** Run as a background job (202 + job_id) instead of holding the request open. */
    async: z.boolean().optional().default(false),
  })
  .superRefine((body, ctx) => {
    const seen = new Set<string>();
    body.plan.forEach((p, i) => {
      if (seen.has(p.question_type)) {
        ctx.addIssue({
          code: "custom",
          path: ["plan", i, "question_type"],
          message: `${p.question_type} is listed twice`,
        });
      }
      seen.add(p.question_type);
    });
    const total = body.plan.reduce((n, p) => n + p.EASY + p.MEDIUM + p.DIFFICULT, 0);
    if (total < 1) {
      ctx.addIssue({ code: "custom", path: ["plan"], message: "Ask for at least one question" });
    } else if (total > AI_BATCH_MAX_QUESTIONS) {
      ctx.addIssue({
        code: "custom",
        path: ["plan"],
        message: `At most ${AI_BATCH_MAX_QUESTIONS} questions per batch (got ${total})`,
      });
    }
  });

export const aiResolveSourcesSchema = z.object({
  sources: z
    .array(
      z.object({
        kind: z.enum([
          "competency",
          "sow_entry",
          "lesson_plan",
          "lesson_note",
          "material",
          "elearning_item",
        ]),
        id: z.union([z.string(), z.number()]).transform((v) => String(v)),
      }),
    )
    .min(1, "Pick at least one resource")
    .max(25, "Pick at most 25 resources at a time"),
  class_group_id: z.coerce.number().int().positive().optional(),
  academic_term_id: z.coerce.number().int().positive().optional(),
});

export type AIGenerateBatchBody = z.infer<typeof aiGenerateBatchSchema>;
export type AIResolveSourcesBody = z.infer<typeof aiResolveSourcesSchema>;

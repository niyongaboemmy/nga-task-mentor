import { z } from "zod";
import { RUBRIC_MAX_CRITERIA, RUBRIC_MIN_CRITERIA } from "../services/ai/rubricGenerator";

export const RUBRIC_DESCRIPTION_MAX = 200_000;
export const RUBRIC_INSTRUCTIONS_MAX = 1000;

export const generateRubricSchema = z.object({
  title: z.string().trim().max(500).optional().default(""),
  // HTML from the rich editor (images included as URLs), reduced to text server-side.
  description: z.string().max(RUBRIC_DESCRIPTION_MAX, "The description is too long for the AI to read").optional().default(""),
  max_score: z.coerce
    .number({ message: "Enter the maximum marks first" })
    .positive("Maximum marks must be greater than 0")
    .max(1000, "Maximum marks must be at most 1000"),
  criteria_count: z.coerce
    .number()
    .int()
    .min(RUBRIC_MIN_CRITERIA, `Choose at least ${RUBRIC_MIN_CRITERIA} criteria`)
    .max(RUBRIC_MAX_CRITERIA, `Choose at most ${RUBRIC_MAX_CRITERIA} criteria`)
    .nullish()
    .transform((v) => v ?? null),
  instructions: z
    .string()
    .trim()
    .max(RUBRIC_INSTRUCTIONS_MAX, `Guidance must be at most ${RUBRIC_INSTRUCTIONS_MAX} characters`)
    .optional()
    .transform((v) => (v ? v : undefined)),
  provider: z
    .enum(["gemini", "groq", "glm", "openai", "deepseek", "openrouter"])
    .nullish()
    .transform((v) => v ?? null),
});

export const importEditorImageSchema = z.object({
  url: z.string().trim().url("Enter a valid image address").max(4000),
});

/** POST /api/submissions/:id/ai-feedback */
export const draftFeedbackSchema = z.object({
  tone: z.enum(["encouraging", "neutral", "direct"]).optional(),
  instructions: z.string().max(500).optional(),
  provider: z.string().max(40).nullable().optional(),
});

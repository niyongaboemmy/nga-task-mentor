import { z } from "zod";

export const createManualAssessmentSchema = z.object({
  course_id: z.number().int().positive("course_id must be a positive integer"),
  title: z.string().trim().min(1, "title is required").max(255),
  max_score: z.number().positive("max_score must be positive"),
  term: z.string().trim().min(1, "term is required").max(50),
  academic_year: z.string().trim().min(1, "academic_year is required").max(20),
});

export const updateManualAssessmentSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  max_score: z.number().positive().optional(),
});

export const upsertScoresSchema = z.object({
  scores: z.array(
    z.object({
      student_id: z.number().int().positive(),
      score: z.number().min(0),
    }),
  ).min(1, "At least one score entry is required"),
});

export type CreateManualAssessmentPayload = z.infer<typeof createManualAssessmentSchema>;
export type UpdateManualAssessmentPayload = z.infer<typeof updateManualAssessmentSchema>;
export type UpsertScoresPayload = z.infer<typeof upsertScoresSchema>;

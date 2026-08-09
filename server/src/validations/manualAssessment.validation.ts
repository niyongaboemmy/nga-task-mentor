import { z } from "zod";

export const ASSESSMENT_TYPES = [
  "class_work",
  "group_work",
  "homework",
  "midterm",
  "participation",
  "ca_end_of_term",
] as const;

export const createManualAssessmentSchema = z.object({
  course_id: z.number().int().positive("course_id must be a positive integer"),
  title: z.string().trim().min(1, "title is required").max(255),
  assessment_type: z.enum(ASSESSMENT_TYPES).optional().nullable(),
  assessment_number: z.number().int().positive().optional().nullable(),
  assessment_date: z.string().trim().optional().nullable(),
  add_to_final_grade: z.boolean().optional(),
  max_score: z.number().positive("max_score must be positive"),
  term: z.string().trim().min(1, "term is required").max(50),
  academic_year: z.string().trim().min(1, "academic_year is required").max(20),
});

export const updateManualAssessmentSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  assessment_type: z.enum(ASSESSMENT_TYPES).optional().nullable(),
  assessment_number: z.number().int().positive().optional().nullable(),
  assessment_date: z.string().trim().optional().nullable(),
  add_to_final_grade: z.boolean().optional(),
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

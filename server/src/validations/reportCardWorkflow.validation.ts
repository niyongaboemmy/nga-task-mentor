import { z } from "zod";

const term = z.string().trim().min(1, "term is required").max(50);
const year = z.string().trim().min(1, "academic_year is required").max(20);
const id = z.number().int().positive();
const isoDate = z
  .string()
  .trim()
  .refine((v) => !Number.isNaN(Date.parse(v)), "must be a date");

export const transitionSchema = z.object({
  card_ids: z.array(id).min(1, "Pick at least one report card").max(200, "At most 200 cards at a time"),
  action: z.enum(["review", "return", "approve", "publish", "unpublish", "reopen"] as const),
  reason: z.string().trim().max(500).optional().nullable(),
  /** publish only: a future time schedules the release instead of publishing now. */
  publish_at: isoDate.optional().nullable(),
  /** return only: subjects whose sign-off reopens with the card. */
  reopen_subject_ids: z.array(id).max(50).optional(),
});

export const cycleSettingsSchema = z.object({
  class_group_ids: z.array(id).min(1).max(200),
  term,
  academic_year: year,
  marks_due_at: isoDate.optional().nullable(),
  review_due_at: isoDate.optional().nullable(),
  publish_at: isoDate.optional().nullable(),
  next_term_begins_on: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "next_term_begins_on must be YYYY-MM-DD")
    .optional()
    .nullable(),
});

export const signoffSchema = z.object({
  class_group_id: id,
  subject_id: id,
  term,
  academic_year: year,
  action: z.enum(["submit", "reopen"] as const),
  reason: z.string().trim().max(500).optional().nullable(),
  resolutions: z
    .array(
      z.object({
        report_card_id: id,
        assessment_type: z.enum(["quiz", "assignment", "manual"] as const),
        assessment_id: id,
        status: z.enum(["absent", "exempt"] as const),
      }),
    )
    .max(2000)
    .optional(),
});

export const attendanceImportSchema = z.object({
  class_group_id: id,
  term,
  academic_year: year,
});

export type TransitionPayload = z.infer<typeof transitionSchema>;
export type CycleSettingsPayload = z.infer<typeof cycleSettingsSchema>;
export type SignoffPayload = z.infer<typeof signoffSchema>;
export type AttendanceImportPayload = z.infer<typeof attendanceImportSchema>;

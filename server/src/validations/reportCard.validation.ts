import { z } from "zod";

const assessmentItemSchema = z.object({
  subject_id: z.number().int().positive("subject_id must be a positive integer"),
  assessment_type: z.enum(["quiz", "assignment"] as const),
  assessment_id: z.number().int().positive("assessment_id must be a positive integer"),
  category: z.enum(["CW", "HW", "MD", "EOT"] as const),
});

// assessments can be empty — allows initializing a report card record before
// any assessments are dragged in (instructor opens builder for the first time).
export const builderSaveSchema = z.object({
  student_id: z.number().int().positive("student_id must be a positive integer"),
  term: z.string().trim().min(1, "term is required").max(50),
  academic_year: z.string().trim().min(1, "academic_year is required").max(20),
  assessments: z.array(assessmentItemSchema).min(0),
});

const attributeItemSchema = z.object({
  attribute_name: z.string().trim().min(1, "attribute_name is required").max(100),
  rating: z.enum(["Excellent", "Very good", "Good"] as const),
});

export const attributesSaveSchema = z.object({
  student_id: z.number().int().positive("student_id must be a positive integer"),
  term: z.string().trim().min(1, "term is required").max(50),
  academic_year: z.string().trim().min(1, "academic_year is required").max(20),
  class_teacher_comment: z.string().trim().max(2000).optional().nullable(),
  attendance_present: z.number().int().min(0, "attendance_present cannot be negative").default(0),
  attendance_absent: z.number().int().min(0, "attendance_absent cannot be negative").default(0),
  attendance_late: z.number().int().min(0, "attendance_late cannot be negative").default(0),
  attributes: z.array(attributeItemSchema).min(1, "At least one attribute is required"),
});

export const generatePdfSchema = z.object({
  report_card_id: z.number().int().positive("report_card_id must be a positive integer"),
});

// Status transition: instructor may set draft↔saved; admin may set any state.
// Role enforcement is done in the controller, not here.
export const updateStatusSchema = z.object({
  status: z.enum(["draft", "saved", "approved"] as const),
});

export type BuilderSavePayload = z.infer<typeof builderSaveSchema>;
export type AttributesSavePayload = z.infer<typeof attributesSaveSchema>;
export type GeneratePdfPayload = z.infer<typeof generatePdfSchema>;
export type UpdateStatusPayload = z.infer<typeof updateStatusSchema>;

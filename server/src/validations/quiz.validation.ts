import { z } from "zod";

/**
 * Quiz create/update payload validation.
 *
 * These mirror the DB constraints on `quizzes` (see models/Quiz.model.ts) so
 * that bad input is rejected with a field-level 400 *before* it reaches
 * Sequelize — previously a wrong `type`/`status` (the client used to send
 * "practice"/"graded"/"archived", none of which exist in the ENUMs) surfaced
 * as an opaque 500 "Server error".
 *
 * Deliberately NOT accepted: `time_limit`. Timing is per-question
 * (`QuestionBank.time_limit_seconds`), so a quiz-level limit is stripped if a
 * stale client still sends it.
 */
export const QUIZ_TYPES = ["Assessment", "Homework", "Quiz", "Exam"] as const;
export const QUIZ_STATUSES = ["draft", "published", "completed"] as const;

export const QUIZ_TITLE_MAX = 200;
export const QUIZ_DESCRIPTION_MAX = 5000;
export const QUIZ_INSTRUCTIONS_MAX = 10000;
export const QUIZ_MAX_ATTEMPTS_MAX = 50;

/**
 * "" → null (an emptied form input), numeric strings → numbers; `undefined`
 * stays `undefined` so partial updates don't clear fields that weren't sent.
 */
type OptionalNumber = z.ZodType<number | null | undefined>;
type OptionalString = z.ZodType<string | null | undefined>;

const optionalNumber = (schema: z.ZodNumber): OptionalNumber =>
  z.preprocess((v) => {
    if (v === "") return null;
    if (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v))) {
      return Number(v);
    }
    return v;
  }, schema.nullable().optional()) as unknown as OptionalNumber;

/** "" → null, otherwise must be a parseable date string. */
const optionalDate: OptionalString = z.preprocess(
  (v) => (v === "" ? null : v),
  z
    .string()
    .refine((s) => !isNaN(new Date(s).getTime()), {
      message: "Must be a valid date/time",
    })
    .nullable()
    .optional(),
) as unknown as OptionalString;

const optionalText = (max: number): OptionalString =>
  z.preprocess(
    (v) => (v === "" ? null : v),
    z.string().trim().max(max, `Must be at most ${max} characters`).nullable().optional(),
  ) as unknown as OptionalString;

const baseQuizFields = {
  title: z
    .string({ message: "Title is required" })
    .trim()
    .min(1, "Title is required")
    .max(QUIZ_TITLE_MAX, `Title must be at most ${QUIZ_TITLE_MAX} characters`),
  description: z
    .string({ message: "Description is required" })
    .trim()
    .min(1, "Description is required")
    .max(
      QUIZ_DESCRIPTION_MAX,
      `Description must be at most ${QUIZ_DESCRIPTION_MAX} characters`,
    ),
  instructions: optionalText(QUIZ_INSTRUCTIONS_MAX),
  type: z.enum(QUIZ_TYPES, {
    message: `Quiz type must be one of: ${QUIZ_TYPES.join(", ")}`,
  }),
  status: z.enum(QUIZ_STATUSES, {
    message: `Status must be one of: ${QUIZ_STATUSES.join(", ")}`,
  }),
  max_attempts: optionalNumber(
    z
      .number({ message: "Maximum attempts must be a number" })
      .int("Maximum attempts must be a whole number")
      .min(1, "Maximum attempts must be at least 1")
      .max(
        QUIZ_MAX_ATTEMPTS_MAX,
        `Maximum attempts cannot exceed ${QUIZ_MAX_ATTEMPTS_MAX}`,
      ),
  ),
  passing_score: optionalNumber(
    z
      .number({ message: "Passing score must be a number" })
      .min(0, "Passing score cannot be negative")
      .max(100, "Passing score cannot exceed 100%"),
  ),
  show_results_immediately: z.boolean({
    message: "show_results_immediately must be true or false",
  }),
  randomize_questions: z.boolean({
    message: "randomize_questions must be true or false",
  }),
  show_correct_answers: z.boolean({
    message: "show_correct_answers must be true or false",
  }),
  enable_automatic_grading: z.boolean({
    message: "enable_automatic_grading must be true or false",
  }),
  require_manual_grading: z.boolean({
    message: "require_manual_grading must be true or false",
  }),
  is_public: z.boolean({ message: "is_public must be true or false" }),
  start_date: optionalDate,
  end_date: optionalDate,
};

/** end_date must be after start_date when both are set. */
const dateOrderCheck = (
  data: { start_date?: string | null; end_date?: string | null },
  ctx: z.RefinementCtx,
) => {
  if (data.start_date && data.end_date) {
    if (new Date(data.end_date).getTime() <= new Date(data.start_date).getTime()) {
      ctx.addIssue({
        code: "custom",
        path: ["end_date"],
        message: "End date must be after the start date",
      });
    }
  }
};

export const createQuizSchema = z
  .object({
    ...baseQuizFields,
    // Only used by POST /api/quizzes (no :courseId in the path).
    course_id: optionalNumber(
      z.number({ message: "course_id must be a number" }).int().positive(),
    ),
    type: baseQuizFields.type.default("Quiz"),
    status: baseQuizFields.status.default("draft"),
    show_results_immediately: baseQuizFields.show_results_immediately.default(true),
    randomize_questions: baseQuizFields.randomize_questions.default(false),
    show_correct_answers: baseQuizFields.show_correct_answers.default(false),
    enable_automatic_grading: baseQuizFields.enable_automatic_grading.default(true),
    require_manual_grading: baseQuizFields.require_manual_grading.default(false),
    is_public: baseQuizFields.is_public.default(false),
  })
  .superRefine(dateOrderCheck);

export const updateQuizSchema = z
  .object({
    title: baseQuizFields.title.optional(),
    description: baseQuizFields.description.optional(),
    instructions: baseQuizFields.instructions,
    type: baseQuizFields.type.optional(),
    status: baseQuizFields.status.optional(),
    max_attempts: baseQuizFields.max_attempts,
    passing_score: baseQuizFields.passing_score,
    show_results_immediately: baseQuizFields.show_results_immediately.optional(),
    randomize_questions: baseQuizFields.randomize_questions.optional(),
    show_correct_answers: baseQuizFields.show_correct_answers.optional(),
    enable_automatic_grading: baseQuizFields.enable_automatic_grading.optional(),
    require_manual_grading: baseQuizFields.require_manual_grading.optional(),
    is_public: baseQuizFields.is_public.optional(),
    start_date: baseQuizFields.start_date,
    end_date: baseQuizFields.end_date,
  })
  .superRefine(dateOrderCheck);

export type CreateQuizPayload = z.infer<typeof createQuizSchema>;
export type UpdateQuizPayload = z.infer<typeof updateQuizSchema>;

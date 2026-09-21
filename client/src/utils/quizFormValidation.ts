import type {
  CreateQuizRequest,
  Quiz,
  QuizStatus,
  QuizType,
} from "../types/quiz.types";
import { formatUTCToLocalDateTime, parseLocalDateTimeToUTC } from "./dateUtils";

/**
 * Client-side mirror of server/src/validations/quiz.validation.ts so the user
 * gets inline feedback before a request is made. The server remains the
 * source of truth; its field errors are merged into the same shape.
 */
export const QUIZ_TYPES: { value: QuizType; label: string }[] = [
  { value: "Quiz", label: "Quiz" },
  { value: "Assessment", label: "Assessment" },
  { value: "Homework", label: "Homework" },
  { value: "Exam", label: "Exam" },
];

export const QUIZ_STATUSES: { value: QuizStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "completed", label: "Completed" },
];

export const QUIZ_TITLE_MAX = 200;
export const QUIZ_DESCRIPTION_MAX = 5000;
export const QUIZ_INSTRUCTIONS_MAX = 10000;
export const QUIZ_MAX_ATTEMPTS_MAX = 50;

/** What the form holds: strings for every free-text/numeric input. */
export interface QuizFormValues {
  title: string;
  description: string;
  instructions: string;
  type: QuizType;
  status: QuizStatus;
  max_attempts: string;
  passing_score: string;
  show_results_immediately: boolean;
  randomize_questions: boolean;
  show_correct_answers: boolean;
  enable_automatic_grading: boolean;
  require_manual_grading: boolean;
  is_public: boolean;
  /** `datetime-local` value ("YYYY-MM-DDTHH:mm") in the browser's zone. */
  start_date: string;
  end_date: string;
}

export type QuizFormErrors = Partial<Record<keyof QuizFormValues, string>>;

export interface FieldError {
  field: string;
  message: string;
}

export const EMPTY_QUIZ_FORM: QuizFormValues = {
  title: "",
  description: "",
  instructions: "",
  type: "Quiz",
  status: "draft",
  max_attempts: "",
  passing_score: "",
  show_results_immediately: true,
  randomize_questions: false,
  show_correct_answers: false,
  enable_automatic_grading: true,
  require_manual_grading: false,
  is_public: false,
  start_date: "",
  end_date: "",
};

const toLocalInput = (iso?: string | null): string => {
  if (!iso) return "";
  try {
    return formatUTCToLocalDateTime(iso);
  } catch {
    return "";
  }
};

/** Build form values from an existing quiz (edit mode). */
export function quizToFormValues(quiz: Quiz): QuizFormValues {
  return {
    title: quiz.title ?? "",
    description: quiz.description ?? "",
    instructions: quiz.instructions ?? "",
    type: quiz.type ?? "Quiz",
    status: quiz.status ?? "draft",
    max_attempts:
      quiz.max_attempts === null || quiz.max_attempts === undefined
        ? ""
        : String(quiz.max_attempts),
    passing_score:
      quiz.passing_score === null || quiz.passing_score === undefined
        ? ""
        : String(Number(quiz.passing_score)),
    show_results_immediately: quiz.show_results_immediately ?? true,
    randomize_questions: quiz.randomize_questions ?? false,
    show_correct_answers: quiz.show_correct_answers ?? false,
    enable_automatic_grading: quiz.enable_automatic_grading !== false,
    require_manual_grading: quiz.require_manual_grading ?? false,
    is_public: quiz.is_public ?? false,
    start_date: toLocalInput(quiz.start_date),
    end_date: toLocalInput(quiz.end_date),
  };
}

const isBlank = (v: string) => v.trim() === "";
const asNumber = (v: string) => (isBlank(v) ? null : Number(v));

/**
 * Validate the form. Returns an empty object when everything is fine.
 * `mode` only affects which fields exist (status is edit-only).
 */
export function validateQuizForm(
  values: QuizFormValues,
  mode: "create" | "edit" = "create",
): QuizFormErrors {
  const errors: QuizFormErrors = {};

  if (isBlank(values.title)) {
    errors.title = "Quiz title is required";
  } else if (values.title.trim().length > QUIZ_TITLE_MAX) {
    errors.title = `Title must be at most ${QUIZ_TITLE_MAX} characters`;
  }

  if (isBlank(values.description)) {
    errors.description = "Description is required";
  } else if (values.description.trim().length > QUIZ_DESCRIPTION_MAX) {
    errors.description = `Description must be at most ${QUIZ_DESCRIPTION_MAX} characters`;
  }

  if (values.instructions.trim().length > QUIZ_INSTRUCTIONS_MAX) {
    errors.instructions = `Instructions must be at most ${QUIZ_INSTRUCTIONS_MAX} characters`;
  }

  if (!QUIZ_TYPES.some((t) => t.value === values.type)) {
    errors.type = "Please choose a valid quiz type";
  }

  if (mode === "edit" && !QUIZ_STATUSES.some((s) => s.value === values.status)) {
    errors.status = "Please choose a valid status";
  }

  const attempts = asNumber(values.max_attempts);
  if (attempts !== null) {
    if (!Number.isInteger(attempts)) {
      errors.max_attempts = "Maximum attempts must be a whole number";
    } else if (attempts < 1) {
      errors.max_attempts = "Maximum attempts must be at least 1";
    } else if (attempts > QUIZ_MAX_ATTEMPTS_MAX) {
      errors.max_attempts = `Maximum attempts cannot exceed ${QUIZ_MAX_ATTEMPTS_MAX}`;
    }
  }

  const score = asNumber(values.passing_score);
  if (score !== null) {
    if (Number.isNaN(score)) {
      errors.passing_score = "Passing score must be a number";
    } else if (score < 0) {
      errors.passing_score = "Passing score cannot be negative";
    } else if (score > 100) {
      errors.passing_score = "Passing score cannot exceed 100%";
    }
  }

  const start = isBlank(values.start_date) ? null : new Date(values.start_date);
  const end = isBlank(values.end_date) ? null : new Date(values.end_date);
  if (start && Number.isNaN(start.getTime())) {
    errors.start_date = "Start date is not a valid date";
  }
  if (end && Number.isNaN(end.getTime())) {
    errors.end_date = "End date is not a valid date";
  }
  if (
    start &&
    end &&
    !errors.start_date &&
    !errors.end_date &&
    end.getTime() <= start.getTime()
  ) {
    errors.end_date = "End date must be after the start date";
  }

  return errors;
}

/** Convert form values into the API payload (numbers, nulls, ISO dates). */
export function toQuizPayload(
  values: QuizFormValues,
  mode: "create" | "edit" = "create",
): CreateQuizRequest & { status?: QuizStatus } {
  const payload: CreateQuizRequest & { status?: QuizStatus } = {
    title: values.title.trim(),
    description: values.description.trim(),
    instructions: isBlank(values.instructions) ? null : values.instructions.trim(),
    type: values.type,
    max_attempts: asNumber(values.max_attempts),
    passing_score: asNumber(values.passing_score),
    show_results_immediately: values.show_results_immediately,
    randomize_questions: values.randomize_questions,
    show_correct_answers: values.show_correct_answers,
    enable_automatic_grading: values.enable_automatic_grading,
    require_manual_grading: values.require_manual_grading,
    is_public: values.is_public,
    start_date: isBlank(values.start_date)
      ? null
      : parseLocalDateTimeToUTC(values.start_date).toISOString(),
    end_date: isBlank(values.end_date)
      ? null
      : parseLocalDateTimeToUTC(values.end_date).toISOString(),
  };
  if (mode === "edit") payload.status = values.status;
  return payload;
}

/** Map server `{field,message}[]` errors onto the form error shape. */
export function serverErrorsToFormErrors(
  errors?: FieldError[] | null,
): QuizFormErrors {
  const out: QuizFormErrors = {};
  for (const e of errors ?? []) {
    if (e && e.field && e.field in EMPTY_QUIZ_FORM) {
      out[e.field as keyof QuizFormValues] = e.message;
    }
  }
  return out;
}

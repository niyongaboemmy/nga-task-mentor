import { describe, it, expect } from "vitest";
import {
  EMPTY_QUIZ_FORM,
  quizToFormValues,
  serverErrorsToFormErrors,
  toQuizPayload,
  validateQuizForm,
  type QuizFormValues,
} from "../utils/quizFormValidation";
import type { Quiz } from "../types/quiz.types";

const valid: QuizFormValues = {
  ...EMPTY_QUIZ_FORM,
  title: "  Algebra  ",
  description: "Linear equations",
};

describe("validateQuizForm", () => {
  it("passes a minimal valid form", () => {
    expect(validateQuizForm(valid)).toEqual({});
  });

  it("requires title and description (whitespace is not enough)", () => {
    const errors = validateQuizForm({ ...valid, title: "   ", description: "" });
    expect(errors.title).toBe("Quiz title is required");
    expect(errors.description).toBe("Description is required");
  });

  it("enforces the title length limit", () => {
    expect(validateQuizForm({ ...valid, title: "x".repeat(201) }).title).toMatch(
      /at most 200/,
    );
  });

  it("rejects invalid type values (the old practice/graded/exam options)", () => {
    expect(
      validateQuizForm({ ...valid, type: "practice" as QuizFormValues["type"] }).type,
    ).toBeDefined();
  });

  it("only validates status in edit mode", () => {
    const bad = { ...valid, status: "archived" as QuizFormValues["status"] };
    expect(validateQuizForm(bad, "create").status).toBeUndefined();
    expect(validateQuizForm(bad, "edit").status).toBeDefined();
  });

  it.each([
    ["0", "at least 1"],
    ["51", "cannot exceed 50"],
    ["1.5", "whole number"],
  ])("rejects max_attempts %s", (value, fragment) => {
    expect(validateQuizForm({ ...valid, max_attempts: value }).max_attempts).toContain(
      fragment,
    );
  });

  it("accepts empty max_attempts (unlimited)", () => {
    expect(validateQuizForm({ ...valid, max_attempts: "" }).max_attempts).toBeUndefined();
  });

  it.each([
    ["-1", "negative"],
    ["101", "exceed 100"],
  ])("rejects passing_score %s", (value, fragment) => {
    expect(validateQuizForm({ ...valid, passing_score: value }).passing_score).toContain(
      fragment,
    );
  });

  it("rejects an end date that is not after the start date", () => {
    const errors = validateQuizForm({
      ...valid,
      start_date: "2026-09-21T10:00",
      end_date: "2026-09-21T09:00",
    });
    expect(errors.end_date).toBe("End date must be after the start date");
  });

  it("accepts a valid availability window", () => {
    expect(
      validateQuizForm({
        ...valid,
        start_date: "2026-09-21T10:00",
        end_date: "2026-09-22T10:00",
      }),
    ).toEqual({});
  });

  it("has no time_limit field at all", () => {
    expect("time_limit" in EMPTY_QUIZ_FORM).toBe(false);
  });
});

describe("toQuizPayload", () => {
  it("trims text, converts numbers, nulls blanks and emits ISO dates", () => {
    const payload = toQuizPayload({
      ...valid,
      instructions: "  ",
      max_attempts: "3",
      passing_score: "62.5",
      start_date: "2026-09-21T10:00",
      end_date: "",
      is_public: true,
    });
    expect(payload.title).toBe("Algebra");
    expect(payload.instructions).toBeNull();
    expect(payload.max_attempts).toBe(3);
    expect(payload.passing_score).toBe(62.5);
    expect(payload.end_date).toBeNull();
    expect(payload.is_public).toBe(true);
    expect(new Date(payload.start_date!).getTime()).toBe(
      new Date("2026-09-21T10:00").getTime(),
    );
    expect("time_limit" in payload).toBe(false);
  });

  it("only includes status in edit mode", () => {
    expect(toQuizPayload(valid, "create").status).toBeUndefined();
    expect(toQuizPayload({ ...valid, status: "published" }, "edit").status).toBe(
      "published",
    );
  });
});

describe("quizToFormValues", () => {
  const quiz = {
    id: 1,
    title: "T",
    description: "D",
    instructions: null,
    status: "published",
    type: "Exam",
    max_attempts: null,
    passing_score: "70.00",
    show_results_immediately: false,
    randomize_questions: true,
    show_correct_answers: false,
    enable_automatic_grading: false,
    require_manual_grading: true,
    is_public: true,
    start_date: "2026-09-21T08:00:00.000Z",
    end_date: null,
    course_id: 1,
    created_by: 1,
    created_at: "",
    updated_at: "",
  } as unknown as Quiz;

  it("maps every editable field, including the grading flags", () => {
    const v = quizToFormValues(quiz);
    expect(v).toMatchObject({
      title: "T",
      instructions: "",
      status: "published",
      type: "Exam",
      max_attempts: "",
      passing_score: "70",
      show_results_immediately: false,
      randomize_questions: true,
      enable_automatic_grading: false,
      require_manual_grading: true,
      is_public: true,
      end_date: "",
    });
    expect(v.start_date).toMatch(/^2026-09-2\dT\d\d:\d\d$/);
  });
});

describe("serverErrorsToFormErrors", () => {
  it("maps known fields and ignores unknown ones", () => {
    expect(
      serverErrorsToFormErrors([
        { field: "type", message: "bad type" },
        { field: "course_id", message: "ignored" },
      ]),
    ).toEqual({ type: "bad type" });
  });

  it("handles null/undefined", () => {
    expect(serverErrorsToFormErrors(null)).toEqual({});
    expect(serverErrorsToFormErrors(undefined)).toEqual({});
  });
});

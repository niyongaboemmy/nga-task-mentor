import React, { useEffect, useState } from "react";
import {
  EMPTY_QUIZ_FORM,
  QUIZ_INSTRUCTIONS_MAX,
  QUIZ_MAX_ATTEMPTS_MAX,
  QUIZ_STATUSES,
  QUIZ_TITLE_MAX,
  QUIZ_TYPES,
  serverErrorsToFormErrors,
  toQuizPayload,
  validateQuizForm,
  type FieldError,
  type QuizFormErrors,
  type QuizFormValues,
} from "../../utils/quizFormValidation";
import type { CreateQuizRequest, QuizStatus } from "../../types/quiz.types";

export interface QuizFormProps {
  mode: "create" | "edit";
  initialValues?: Partial<QuizFormValues>;
  submitting?: boolean;
  /** Field errors returned by the server on the last submit. */
  serverErrors?: FieldError[] | null;
  /** Non-field error message from the server on the last submit. */
  serverMessage?: string | null;
  onSubmit: (payload: CreateQuizRequest & { status?: QuizStatus }) => void;
  onCancel: () => void;
  submitLabel?: string;
  /** Extra sections (e.g. proctoring opt-in) rendered above the buttons. */
  children?: React.ReactNode;
}

const inputClass = (hasError: boolean) =>
  `w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:border-transparent text-sm dark:bg-gray-800/30 ${
    hasError
      ? "border-red-400 focus:ring-red-500 dark:border-red-500/70"
      : "border-gray-300 dark:border-gray-700/40 focus:ring-blue-500"
  }`;

const labelClass =
  "block text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark mb-1";

const FieldErrorText: React.FC<{ id: string; message?: string }> = ({
  id,
  message,
}) =>
  message ? (
    <p
      id={id}
      role="alert"
      className="mt-1 text-xs text-red-600 dark:text-red-400"
    >
      {message}
    </p>
  ) : null;

/**
 * Shared create/edit quiz form. Owns its own values + client-side validation;
 * the parent owns the API call and passes back server-side field errors so
 * they show inline next to the right input.
 *
 * There is intentionally no quiz-level time limit here: every question has
 * its own `time_limit_seconds`.
 */
export const QuizForm: React.FC<QuizFormProps> = ({
  mode,
  initialValues,
  submitting = false,
  serverErrors,
  serverMessage,
  onSubmit,
  onCancel,
  submitLabel,
  children,
}) => {
  const [values, setValues] = useState<QuizFormValues>({
    ...EMPTY_QUIZ_FORM,
    ...initialValues,
  });
  const [errors, setErrors] = useState<QuizFormErrors>({});
  const [touched, setTouched] = useState<Partial<Record<keyof QuizFormValues, boolean>>>({});
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  // Merge server errors whenever a new batch arrives.
  useEffect(() => {
    if (serverErrors && serverErrors.length) {
      setErrors((prev) => ({ ...prev, ...serverErrorsToFormErrors(serverErrors) }));
      setAttemptedSubmit(true);
    }
  }, [serverErrors]);

  const setField = <K extends keyof QuizFormValues>(
    field: K,
    value: QuizFormValues[K],
  ) => {
    setValues((prev) => {
      const next = { ...prev, [field]: value };
      // Re-validate live once the user has tried to submit or left the field.
      if (attemptedSubmit || touched[field]) {
        const fresh = validateQuizForm(next, mode);
        setErrors((old) => {
          const merged: QuizFormErrors = { ...old };
          delete merged[field];
          // Date fields cross-validate; keep them in sync with each other.
          if (field === "start_date" || field === "end_date") {
            delete merged.start_date;
            delete merged.end_date;
            if (fresh.start_date) merged.start_date = fresh.start_date;
            if (fresh.end_date) merged.end_date = fresh.end_date;
          } else if (fresh[field]) {
            merged[field] = fresh[field];
          }
          return merged;
        });
      }
      return next;
    });
  };

  const handleBlur = (field: keyof QuizFormValues) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const fresh = validateQuizForm(values, mode);
    setErrors((old) => {
      const merged = { ...old };
      if (fresh[field]) merged[field] = fresh[field];
      else delete merged[field];
      return merged;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAttemptedSubmit(true);
    const fresh = validateQuizForm(values, mode);
    setErrors(fresh);
    if (Object.keys(fresh).length > 0) {
      // Focus the first invalid field for keyboard/screen-reader users.
      const first = Object.keys(fresh)[0];
      document.getElementById(`quiz-${first}`)?.focus();
      return;
    }
    onSubmit(toQuizPayload(values, mode));
  };

  const errorId = (field: keyof QuizFormValues) => `quiz-${field}-error`;
  const ariaProps = (field: keyof QuizFormValues) => ({
    "aria-invalid": Boolean(errors[field]),
    "aria-describedby": errors[field] ? errorId(field) : undefined,
  });

  const errorCount = Object.keys(errors).length;

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {(serverMessage || (attemptedSubmit && errorCount > 0)) && (
        <div
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300"
        >
          {serverMessage ||
            `Please fix the ${errorCount} highlighted field${errorCount === 1 ? "" : "s"} below.`}
        </div>
      )}

      {/* Title */}
      <div>
        <label htmlFor="quiz-title" className={labelClass}>
          Quiz Title <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="quiz-title"
          name="title"
          value={values.title}
          onChange={(e) => setField("title", e.target.value)}
          onBlur={() => handleBlur("title")}
          placeholder="Enter quiz title..."
          maxLength={QUIZ_TITLE_MAX}
          className={inputClass(Boolean(errors.title))}
          {...ariaProps("title")}
        />
        <FieldErrorText id={errorId("title")} message={errors.title} />
      </div>

      {/* Description */}
      <div>
        <label htmlFor="quiz-description" className={labelClass}>
          Description <span className="text-red-500">*</span>
        </label>
        <textarea
          id="quiz-description"
          name="description"
          value={values.description}
          onChange={(e) => setField("description", e.target.value)}
          onBlur={() => handleBlur("description")}
          placeholder="Enter quiz description..."
          rows={3}
          className={`${inputClass(Boolean(errors.description))} resize-none`}
          {...ariaProps("description")}
        />
        <FieldErrorText id={errorId("description")} message={errors.description} />
      </div>

      {/* Type / Status */}
      <div className={`grid gap-4 ${mode === "edit" ? "md:grid-cols-2" : ""}`}>
        <div>
          <label htmlFor="quiz-type" className={labelClass}>
            Quiz Type <span className="text-red-500">*</span>
          </label>
          <select
            id="quiz-type"
            name="type"
            value={values.type}
            onChange={(e) => setField("type", e.target.value as QuizFormValues["type"])}
            className={inputClass(Boolean(errors.type))}
            {...ariaProps("type")}
          >
            {QUIZ_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <FieldErrorText id={errorId("type")} message={errors.type} />
        </div>

        {mode === "edit" && (
          <div>
            <label htmlFor="quiz-status" className={labelClass}>
              Quiz Status
            </label>
            <select
              id="quiz-status"
              name="status"
              value={values.status}
              onChange={(e) =>
                setField("status", e.target.value as QuizFormValues["status"])
              }
              className={inputClass(Boolean(errors.status))}
              {...ariaProps("status")}
            >
              {QUIZ_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <FieldErrorText id={errorId("status")} message={errors.status} />
            <p className="mt-1 text-xs text-text-secondary-light dark:text-text-secondary-dark/70">
              Published quizzes are visible to students. A quiz needs at least
              one question before it can be published.
            </p>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div>
        <label htmlFor="quiz-instructions" className={labelClass}>
          Instructions (Optional)
        </label>
        <textarea
          id="quiz-instructions"
          name="instructions"
          value={values.instructions}
          onChange={(e) => setField("instructions", e.target.value)}
          onBlur={() => handleBlur("instructions")}
          placeholder="Enter quiz instructions..."
          rows={2}
          maxLength={QUIZ_INSTRUCTIONS_MAX}
          className={`${inputClass(Boolean(errors.instructions))} resize-none`}
          {...ariaProps("instructions")}
        />
        <FieldErrorText id={errorId("instructions")} message={errors.instructions} />
      </div>

      {/* Settings */}
      <div className="space-y-4">
        <h3 className="text-base font-medium text-text-primary-light dark:text-text-primary-dark">
          Quiz Settings
        </h3>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="quiz-max_attempts" className={labelClass}>
              Maximum Attempts
            </label>
            <input
              type="number"
              id="quiz-max_attempts"
              name="max_attempts"
              value={values.max_attempts}
              onChange={(e) => setField("max_attempts", e.target.value)}
              onBlur={() => handleBlur("max_attempts")}
              placeholder="Unlimited"
              min={1}
              max={QUIZ_MAX_ATTEMPTS_MAX}
              step={1}
              className={inputClass(Boolean(errors.max_attempts))}
              {...ariaProps("max_attempts")}
            />
            <FieldErrorText id={errorId("max_attempts")} message={errors.max_attempts} />
          </div>

          <div>
            <label htmlFor="quiz-passing_score" className={labelClass}>
              Passing Score (%)
            </label>
            <input
              type="number"
              id="quiz-passing_score"
              name="passing_score"
              value={values.passing_score}
              onChange={(e) => setField("passing_score", e.target.value)}
              onBlur={() => handleBlur("passing_score")}
              placeholder="e.g. 60"
              min={0}
              max={100}
              step={0.1}
              className={inputClass(Boolean(errors.passing_score))}
              {...ariaProps("passing_score")}
            />
            <FieldErrorText id={errorId("passing_score")} message={errors.passing_score} />
          </div>
        </div>

        <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark/70">
          Timing is set per question when you add questions — there is no
          quiz-wide time limit.
        </p>

        {/* Availability window */}
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="quiz-start_date" className={labelClass}>
              Available From (Optional)
            </label>
            <input
              type="datetime-local"
              id="quiz-start_date"
              name="start_date"
              value={values.start_date}
              onChange={(e) => setField("start_date", e.target.value)}
              onBlur={() => handleBlur("start_date")}
              className={inputClass(Boolean(errors.start_date))}
              {...ariaProps("start_date")}
            />
            <FieldErrorText id={errorId("start_date")} message={errors.start_date} />
          </div>
          <div>
            <label htmlFor="quiz-end_date" className={labelClass}>
              Available Until (Optional)
            </label>
            <input
              type="datetime-local"
              id="quiz-end_date"
              name="end_date"
              value={values.end_date}
              onChange={(e) => setField("end_date", e.target.value)}
              onBlur={() => handleBlur("end_date")}
              min={values.start_date || undefined}
              className={inputClass(Boolean(errors.end_date))}
              {...ariaProps("end_date")}
            />
            <FieldErrorText id={errorId("end_date")} message={errors.end_date} />
          </div>
        </div>

        {/* Options */}
        <div className="space-y-2">
          {(
            [
              ["show_results_immediately", "Show results immediately after completion"],
              ["randomize_questions", "Randomize question order"],
              ["show_correct_answers", "Show correct answers after completion"],
            ] as const
          ).map(([field, label]) => (
            <div key={field} className="flex items-center">
              <input
                type="checkbox"
                id={`quiz-${field}`}
                name={field}
                checked={values[field]}
                onChange={(e) => setField(field, e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label
                htmlFor={`quiz-${field}`}
                className="ml-2 text-sm text-text-secondary-light dark:text-text-secondary-dark"
              >
                {label}
              </label>
            </div>
          ))}
        </div>

        {/* Grading */}
        <div className="space-y-2 border-t border-gray-200 dark:border-gray-800 pt-4">
          <h4 className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
            Grading Options
          </h4>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="quiz-enable_automatic_grading"
              name="enable_automatic_grading"
              checked={values.enable_automatic_grading}
              onChange={(e) => setField("enable_automatic_grading", e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label
              htmlFor="quiz-enable_automatic_grading"
              className="ml-2 text-sm text-text-secondary-light dark:text-text-secondary-dark"
            >
              Show grades to students immediately after quiz completion
            </label>
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="quiz-require_manual_grading"
              name="require_manual_grading"
              checked={values.require_manual_grading}
              onChange={(e) => setField("require_manual_grading", e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label
              htmlFor="quiz-require_manual_grading"
              className="ml-2 text-sm text-text-secondary-light dark:text-text-secondary-dark"
            >
              Require instructor manual grading (grades hidden until reviewed)
            </label>
          </div>
          <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark/70 ml-6">
            {values.require_manual_grading
              ? "Students will see 'Pending' until an instructor reviews and grades the quiz."
              : values.enable_automatic_grading
                ? "Grades are calculated automatically and shown immediately."
                : "Grades are hidden from students until released."}
          </p>
        </div>

        {/* Visibility */}
        <div className="flex items-center border-t border-gray-200 dark:border-gray-800 pt-4">
          <input
            type="checkbox"
            id="quiz-is_public"
            name="is_public"
            checked={values.is_public}
            onChange={(e) => setField("is_public", e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label
            htmlFor="quiz-is_public"
            className="ml-2 text-sm text-text-secondary-light dark:text-text-secondary-dark"
          >
            Make this quiz publicly accessible
          </label>
        </div>
      </div>

      {children}

      {/* Action Buttons */}
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="px-4 py-2 border border-gray-300 dark:border-gray-700 text-text-secondary-light dark:text-text-secondary-dark rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 text-sm disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          {submitting
            ? mode === "create"
              ? "Creating..."
              : "Saving..."
            : submitLabel ?? (mode === "create" ? "Create Quiz" : "Save Changes")}
        </button>
      </div>
    </form>
  );
};

export default QuizForm;

import type { StudentQuizState } from "../types/quiz.types";

/**
 * What the "Take again" action on the results page should offer, derived
 * from the quiz's attempt settings (max_attempts, null = unlimited), its
 * availability window, and any attempt still in progress. The server
 * enforces the same rules (POST /quizzes/submissions → 409
 * MAX_ATTEMPTS_REACHED / 400 QUIZ_NOT_AVAILABLE); this only decides what to
 * show.
 */
export type RetakeStatus =
  | "resume"
  | "available"
  | "used_up"
  | "not_open"
  | "closed"
  | "unavailable";

export interface RetakeState {
  status: RetakeStatus;
  enabled: boolean;
  title: string;
  hint: string;
  /** e.g. "2 of 3 tries used" / "1 try used · unlimited" */
  triesLabel: string;
  used: number;
  /** null = unlimited */
  max: number | null;
  left: number | null;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export function describeRetake(state: StudentQuizState | null | undefined): RetakeState | null {
  if (!state) return null;
  const { attempts, availability } = state;
  const used = attempts.attempts_used;
  const max = attempts.max_attempts;
  const left = attempts.attempts_left;

  const triesLabel =
    max === null
      ? `${used} ${plural(used, "try", "tries")} used · unlimited`
      : `${used} of ${max} ${plural(max, "try", "tries")} used`;

  const base = { triesLabel, used, max, left };

  if (attempts.in_progress_submission_id !== null && state.can_start) {
    return {
      ...base,
      status: "resume",
      enabled: true,
      title: "Resume attempt",
      hint: `Attempt ${attempts.current_attempt_number}${max !== null ? ` of ${max}` : ""} is still open`,
    };
  }

  if (state.can_start && attempts.can_start_new_attempt) {
    return {
      ...base,
      status: "available",
      enabled: true,
      title: "Take again",
      hint:
        left === null
          ? "Unlimited tries"
          : `${left} ${plural(left, "try", "tries")} left`,
    };
  }

  if (!attempts.can_start_new_attempt) {
    return {
      ...base,
      status: "used_up",
      enabled: false,
      title: "No tries left",
      hint: `All ${max ?? used} ${plural(max ?? used, "try", "tries")} used`,
    };
  }

  if (availability.state === "not_open") {
    return { ...base, status: "not_open", enabled: false, title: "Not open yet", hint: "Opens later" };
  }
  if (availability.state === "closed" || availability.state === "unpublished") {
    return { ...base, status: "closed", enabled: false, title: "Quiz closed", hint: "No more tries" };
  }
  return {
    ...base,
    status: "unavailable",
    enabled: false,
    title: "Can't retake",
    hint: state.blocked_reason || "Not available right now",
  };
}

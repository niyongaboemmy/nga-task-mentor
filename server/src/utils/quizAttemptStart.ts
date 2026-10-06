import { Request } from "express";
import { Op, Transaction } from "sequelize";
import { QuizSubmission } from "../models";
import { availabilityMessage, quizAvailability } from "./quizStudentView";
import { studentMayTakeQuiz } from "./studentEnrollment";
import {
  computeAttemptEndTime,
  finalizeFromSavedAttempts,
  FinalizedSummary,
  isPastDeadline,
} from "./quizTiming";

/**
 * Start or resume the signed-in student's attempt at a quiz — the rules of
 * POST /quizzes/submissions, shared with TMCode's POST /tmcode/launch so
 * both enforce the same availability, enrolment and max-attempt rules.
 * The caller commits (expired, created) or rolls back (resumed, refused).
 */
export type AttemptStart =
  | { kind: "resumed"; submission: QuizSubmission }
  | { kind: "created"; submission: QuizSubmission }
  | { kind: "expired"; summary: FinalizedSummary }
  | { kind: "refused"; status: number; code: string; message: string; data?: unknown };

export async function startOrResumeAttempt(
  req: Request,
  quiz: any,
  transaction: Transaction,
  status: "in_progress" = "in_progress",
): Promise<AttemptStart> {
  const existing = await QuizSubmission.findOne({
    where: { quiz_id: quiz.id, student_id: req.user.id, status: "in_progress" },
    transaction,
  });

  if (existing) {
    // Time already ran out on the attempt: submit it with what was saved
    // rather than discarding it.
    const closedMeanwhile = quizAvailability(quiz).state === "closed";
    if (isPastDeadline(existing) || closedMeanwhile) {
      const summary = await finalizeFromSavedAttempts(existing, quiz, transaction);
      return { kind: "expired", summary };
    }
    return { kind: "resumed", submission: existing };
  }

  // Published and inside its availability window
  const availability = quizAvailability(quiz);
  if (availability.state !== "open") {
    return {
      kind: "refused",
      status: 400,
      code: "QUIZ_NOT_AVAILABLE",
      message: `Quiz is not currently available. ${availabilityMessage(availability)}`.trim(),
      data: { availability },
    };
  }

  if (!(await studentMayTakeQuiz(req, quiz))) {
    return {
      kind: "refused",
      status: 403,
      code: "NOT_ENROLLED",
      message: "You are not enrolled in this quiz's subject.",
    };
  }

  const previousSubmissions = await QuizSubmission.count({
    where: {
      quiz_id: quiz.id,
      student_id: req.user.id,
      status: { [Op.in]: ["completed", "timed_out", "abandoned"] },
    },
    transaction,
  });

  // max_attempts (null = unlimited)
  const maxAttempts = Number(quiz.max_attempts) > 0 ? Number(quiz.max_attempts) : null;
  if (maxAttempts !== null && previousSubmissions >= maxAttempts) {
    return {
      kind: "refused",
      status: 409,
      code: "MAX_ATTEMPTS_REACHED",
      message: `You have used all ${maxAttempts} attempt${maxAttempts === 1 ? "" : "s"} for this quiz.`,
      data: { max_attempts: maxAttempts, attempts_used: previousSubmissions },
    };
  }

  // The attempt clock always starts on the server: a client-supplied
  // started_at could otherwise push the deadline out.
  const startTime = new Date();
  const submission = await QuizSubmission.create(
    {
      quiz_id: quiz.id,
      student_id: req.user.id,
      total_score: 0,
      max_score: 0,
      percentage: 0,
      status,
      grade_status: "pending",
      time_taken: 0,
      started_at: startTime,
      end_time: computeAttemptEndTime(quiz, startTime),
      attempt_number: previousSubmissions + 1,
      passed: false,
    } as any,
    { transaction },
  );
  return { kind: "created", submission };
}

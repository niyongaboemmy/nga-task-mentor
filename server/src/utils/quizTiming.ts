import { Transaction } from "sequelize";
import { QuizAttempt, QuizQuestion } from "../models";
import { gradeStatusOnSubmit, isPassed } from "./quizStudentView";

/**
 * Quiz timing rules shared by the submission/attempt controllers.
 *
 * A quiz either has an overall duration (`quizzes.time_limit`, minutes) or it
 * doesn't. With a duration, the attempt's `end_time` is fixed on the server
 * when it starts and is the only authoritative deadline — the client timer is
 * just a display of it. Without one, each question keeps its own
 * `time_limit_seconds` and `end_time` stays null.
 */

/**
 * How late (after `end_time`) a final submission is still graded from the
 * answers the client sends. Covers the auto-submit request that fires at 0:00
 * and its network round trip; past this only answers already saved on the
 * server count.
 */
export const SUBMIT_GRACE_SECONDS = 30;

type TimedQuiz = { time_limit?: number | null; end_date?: Date | string | null };
type TimedSubmission = { end_time?: Date | string | null };

export const hasOverallDuration = (quiz?: TimedQuiz | null): boolean =>
  Number(quiz?.time_limit) > 0;

/**
 * Deadline for an attempt starting at `startTime`: start + duration, but never
 * past the quiz's own availability window. `undefined` when the quiz has no
 * overall duration.
 */
export function computeAttemptEndTime(
  quiz: TimedQuiz,
  startTime: Date,
): Date | undefined {
  if (!hasOverallDuration(quiz)) return undefined;
  const byDuration = startTime.getTime() + Number(quiz.time_limit) * 60_000;
  const closesAt = quiz.end_date ? new Date(quiz.end_date).getTime() : NaN;
  const end =
    Number.isFinite(closesAt) && closesAt > startTime.getTime()
      ? Math.min(byDuration, closesAt)
      : byDuration;
  return new Date(end);
}

/** Whole seconds left on the attempt, or null when it has no deadline. */
export function secondsRemaining(
  submission: TimedSubmission,
  now: Date = new Date(),
): number | null {
  if (!submission?.end_time) return null;
  const ms = new Date(submission.end_time).getTime() - now.getTime();
  return Math.max(0, Math.floor(ms / 1000));
}

/** True once `end_time` + grace has passed. Attempts without a deadline never expire. */
export function isPastDeadline(
  submission: TimedSubmission,
  now: Date = new Date(),
  graceSeconds: number = SUBMIT_GRACE_SECONDS,
): boolean {
  if (!submission?.end_time) return false;
  return (
    now.getTime() > new Date(submission.end_time).getTime() + graceSeconds * 1000
  );
}

export interface FinalizedSummary {
  submission_id: number;
  final_score: number;
  max_score: number;
  percentage: number;
  passed: boolean;
  answered: number;
  timed_out: true;
}

/**
 * Close an attempt whose time ran out using the answers already saved on the
 * server (each was graded when it was saved). Nothing the student saved is
 * discarded; the attempt ends as "completed" so it shows in their results
 * like any other finished quiz.
 */
export async function finalizeFromSavedAttempts(
  submission: any,
  quiz: any,
  transaction?: Transaction,
): Promise<FinalizedSummary> {
  const [questions, attempts] = await Promise.all([
    QuizQuestion.findAll({
      where: { quiz_id: submission.quiz_id },
      attributes: ["id", "points"],
      transaction,
    }),
    QuizAttempt.findAll({
      where: { submission_id: submission.id },
      attributes: ["id", "question_id", "points_earned"],
      transaction,
    }),
  ]);

  const maxScore = questions.reduce((sum, q) => sum + Number(q.points || 0), 0);
  const totalScore = attempts.reduce(
    (sum, a) => sum + (parseFloat(String(a.points_earned)) || 0),
    0,
  );
  const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
  const passed = isPassed(percentage, quiz);

  const now = new Date();
  const startedAt = submission.started_at
    ? new Date(submission.started_at).getTime()
    : now.getTime();
  const endAt = submission.end_time
    ? Math.min(now.getTime(), new Date(submission.end_time).getTime())
    : now.getTime();

  await submission.update(
    {
      total_score: totalScore,
      max_score: maxScore,
      percentage,
      passed,
      status: "completed",
      completed_at: now,
      time_taken: Math.max(0, Math.floor((endAt - startedAt) / 1000)),
      grade_status: gradeStatusOnSubmit(quiz),
    },
    { transaction },
  );

  return {
    submission_id: submission.id,
    final_score: totalScore,
    max_score: maxScore,
    percentage,
    passed,
    answered: attempts.length,
    timed_out: true,
  };
}

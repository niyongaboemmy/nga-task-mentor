import { judge0Configured } from "./coderunner";
import { literal } from "sequelize";
import { Quiz, QuizAttempt, QuizQuestion, QuizSubmission } from "../models";
import { AdvancedQuizGrader, isPendingGrade } from "../utils/quizGrader";
import { getQuestionBankInclude } from "../utils/quizUtils";
import { Judge0Service } from "./Judge0Service";
import { gradeStatusOnSubmit, isPassed } from "../utils/quizStudentView";

/**
 * Background grading of code answers. Answers saved or submitted are queued
 * (grading_details.queued, graded every few seconds) so no request waits for
 * the judge; answers left pending because the judge was unavailable
 * (grading_details.judge_unavailable, TM-FIX-6) are re-graded every few
 * minutes. Run by the periodic jobs below and by
 * scripts/regradePendingCodeAttempts.ts.
 *
 * - An answer whose submission a teacher has already graded is left alone.
 * - A finished submission gets its totals recomputed from its attempts; it
 *   stays "pending" while any answer still awaits review.
 * - `dryRun` only reports what would be re-graded.
 */
export interface RegradeReport {
  found: number;
  regraded: number;
  still_unavailable: number;
  skipped_teacher_graded: number;
  submissions_updated: number[];
}

const running = { queued: false, unavailable: false };

type Which = "queued" | "unavailable";

const WHERE: Record<Which, string> = {
  // Saved or submitted code answers waiting for their first grade.
  queued: "JSON_EXTRACT(grading_details, '$.queued') = true",
  // Answers left pending while the judge was unavailable.
  unavailable: "JSON_EXTRACT(grading_details, '$.judge_unavailable') = true",
};

const sameAnswer = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

async function gradeWaiting(which: Which, opts: { limit?: number; dryRun?: boolean }): Promise<RegradeReport> {
  const report: RegradeReport = {
    found: 0,
    regraded: 0,
    still_unavailable: 0,
    skipped_teacher_graded: 0,
    submissions_updated: [],
  };
  if (running[which]) return report; // one pass at a time
  running[which] = true;
  try {
    const attempts = await QuizAttempt.findAll({
      where: literal(WHERE[which]) as any,
      order: [["id", "ASC"]],
      limit: opts.limit ?? 50,
    });
    report.found = attempts.length;
    if (opts.dryRun || attempts.length === 0) return report;

    const touched = new Set<number>();
    for (const attempt of attempts) {
      const submission = attempt.submission_id
        ? await QuizSubmission.findByPk(attempt.submission_id)
        : null;
      if (submission?.grade_status === "graded") {
        report.skipped_teacher_graded++;
        if (which === "queued") {
          // A teacher graded the submission: the answer no longer waits.
          await attempt.update({ grading_details: { ...(attempt.grading_details as any), queued: false } });
        }
        continue;
      }
      const question = await QuizQuestion.findByPk(attempt.question_id, {
        include: getQuestionBankInclude(),
      });
      if (!question) continue;

      const answered = attempt.submitted_answer;
      const result: any = await AdvancedQuizGrader.gradeWithConfig(question, answered as any);
      if (result?.detailed_feedback?.judge_unavailable) {
        report.still_unavailable++;
        if (which === "queued") {
          // Hand it to the slower "judge unavailable" pass.
          await attempt.update({ grading_details: { ...(result.detailed_feedback ?? {}), queued: false } });
        }
        continue;
      }
      // The student may have saved a new answer while this one was graded:
      // then this grade is stale and the new answer stays queued.
      await attempt.reload();
      if (!sameAnswer(attempt.submitted_answer, answered)) continue;
      await attempt.update({
        is_correct: result.is_correct,
        points_earned: result.points_earned,
        grading_details: result.detailed_feedback ?? null,
      });
      report.regraded++;
      if (submission && submission.status !== "in_progress") touched.add(submission.id);
    }

    for (const id of touched) {
      if (await recomputeSubmission(id)) report.submissions_updated.push(id);
    }
    return report;
  } finally {
    running[which] = false;
  }
}

/** Re-grade answers left pending while the judge was unavailable. */
export async function regradePendingCodeAttempts(opts: { limit?: number; dryRun?: boolean } = {}): Promise<RegradeReport> {
  return gradeWaiting("unavailable", opts);
}

/** Grade code answers queued by saves and submits (CODE_RUNNER_PLAN.md §17). */
export async function gradeQueuedCodeAttempts(opts: { limit?: number; dryRun?: boolean } = {}): Promise<RegradeReport> {
  return gradeWaiting("queued", { limit: 10, ...opts });
}

/** Totals of a finished submission from its saved attempts. */
export async function recomputeSubmission(submissionId: number): Promise<boolean> {
  const submission = await QuizSubmission.findByPk(submissionId);
  if (!submission || submission.grade_status === "graded") return false;
  const quiz = await Quiz.findByPk(submission.quiz_id);
  const [questions, attempts] = await Promise.all([
    QuizQuestion.findAll({ where: { quiz_id: submission.quiz_id }, attributes: ["id", "points"] }),
    QuizAttempt.findAll({
      where: { submission_id: submission.id },
      attributes: ["id", "question_id", "points_earned", "grading_details"],
    }),
  ]);
  const max = questions.reduce((sum, q) => sum + Number(q.points || 0), 0);
  const total = attempts.reduce((sum, a) => sum + (parseFloat(String(a.points_earned)) || 0), 0);
  const percentage = max > 0 ? (total / max) * 100 : 0;
  await submission.update({
    total_score: total,
    max_score: max,
    percentage,
    passed: isPassed(percentage, quiz),
    grade_status: gradeStatusOnSubmit(
      quiz,
      attempts.some((a) => isPendingGrade(a.grading_details)),
    ),
  });
  return true;
}

let judgeTimers: NodeJS.Timeout[] = [];

/**
 * Judge upkeep, started with the server:
 *  - read the judge's runtimes now (newest version per language), then a
 *    daily health/quota check;
 *  - every CODE_REGRADE_INTERVAL_MIN minutes (default 10, 0 = off) re-grade
 *    answers left pending while the judge was unavailable.
 */
export function startJudgeMaintenance(): void {
  stopJudgeMaintenance();
  // Judge0 only when it is set up (a key, or a self-hosted address): otherwise
  // every start and every day logged a refused call to a service we don't use.
  if (judge0Configured()) {
    void Judge0Service.loadLanguages();
    const daily = setInterval(() => void Judge0Service.healthCheck(), 24 * 60 * 60_000);
    daily.unref?.();
    judgeTimers.push(daily);
  }

  // Queued code answers: every CODE_GRADE_QUEUE_INTERVAL_MS (default 3 s).
  const queueMs = Number(process.env.CODE_GRADE_QUEUE_INTERVAL_MS ?? 3000);
  if (Number.isFinite(queueMs) && queueMs > 0) {
    const queue = setInterval(() => {
      gradeQueuedCodeAttempts()
        .then((r) => {
          if (r.regraded || r.still_unavailable) console.log("[grading] queued code answers:", JSON.stringify(r));
        })
        .catch((e) => console.error("[grading] queued code pass failed:", e?.message));
    }, queueMs);
    queue.unref?.();
    judgeTimers.push(queue);
  }

  const minutes = Number(process.env.CODE_REGRADE_INTERVAL_MIN ?? 10);
  if (Number.isFinite(minutes) && minutes > 0) {
    const regrade = setInterval(() => {
      regradePendingCodeAttempts()
        .then((r) => {
          if (r.found) console.log("[judge0] re-grade pass:", JSON.stringify(r));
        })
        .catch((e) => console.error("[judge0] re-grade pass failed:", e?.message));
    }, minutes * 60_000);
    regrade.unref?.();
    judgeTimers.push(regrade);
  }
}

export function stopJudgeMaintenance(): void {
  for (const t of judgeTimers) clearInterval(t);
  judgeTimers = [];
}

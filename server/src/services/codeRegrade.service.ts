import { literal } from "sequelize";
import { Quiz, QuizAttempt, QuizQuestion, QuizSubmission } from "../models";
import { AdvancedQuizGrader, isPendingGrade } from "../utils/quizGrader";
import { getQuestionBankInclude } from "../utils/quizUtils";
import { Judge0Service } from "./Judge0Service";
import { gradeStatusOnSubmit, isPassed } from "../utils/quizStudentView";

/**
 * Re-grade code answers that were left pending because the judge was
 * unavailable (grading_details.judge_unavailable, TM-FIX-6). Run by the
 * periodic job in index.ts and by scripts/regradePendingCodeAttempts.ts.
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

let running = false;

export async function regradePendingCodeAttempts(
  opts: { limit?: number; dryRun?: boolean } = {},
): Promise<RegradeReport> {
  const report: RegradeReport = {
    found: 0,
    regraded: 0,
    still_unavailable: 0,
    skipped_teacher_graded: 0,
    submissions_updated: [],
  };
  if (running) return report; // one pass at a time
  running = true;
  try {
    const attempts = await QuizAttempt.findAll({
      where: literal(
        "JSON_EXTRACT(grading_details, '$.judge_unavailable') = true",
      ) as any,
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
        continue;
      }
      const question = await QuizQuestion.findByPk(attempt.question_id, {
        include: getQuestionBankInclude(),
      });
      if (!question) continue;

      const result: any = await AdvancedQuizGrader.gradeWithConfig(
        question,
        attempt.submitted_answer as any,
      );
      if (result?.detailed_feedback?.judge_unavailable) {
        report.still_unavailable++;
        continue;
      }
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
    running = false;
  }
}

/** Totals of a finished submission from its saved attempts. */
async function recomputeSubmission(submissionId: number): Promise<boolean> {
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
  void Judge0Service.loadLanguages();
  const daily = setInterval(() => void Judge0Service.healthCheck(), 24 * 60 * 60_000);
  daily.unref?.();
  judgeTimers.push(daily);

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

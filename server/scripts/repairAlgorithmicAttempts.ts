/**
 * TM-FIX-2 data repair for algorithmic answers (defect D2).
 *
 * Until TM-FIX-2 the algorithmic widget submitted a placeholder
 * ({solution: "Algorithm progress", language: "algorithm", ...}) that the
 * server graded as code → every algorithmic answer scored 0 ("code is
 * required"). This script finds those attempts (algorithmic, 0/no points, no
 * code) and puts their submissions back in the teacher's review queue:
 *   - quiz_submissions.grade_status = 'pending' (skipped when a teacher has
 *     already graded the submission: those are only reported)
 *   - quiz_attempts.grading_details = {grade_status: 'pending', pending_reason}
 *     when nothing is stored there yet
 * It NEVER awards points.
 *
 * Dry run by default (prints the report, writes nothing):
 *   cd server && npx ts-node --transpile-only scripts/repairAlgorithmicAttempts.ts
 * Write mode — only after the report has been reviewed with the Coding
 * Academy lead:
 *   cd server && npx ts-node --transpile-only scripts/repairAlgorithmicAttempts.ts --apply
 */
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { QueryTypes } from "sequelize";
import { sequelize } from "../src/config/database";
import { normalizeAlgorithmicAnswer } from "../src/utils/quizGrader";

const APPLY = process.argv.includes("--apply");
const REASON = "No code submitted – needs manual review.";

async function main() {
  const rows = await sequelize.query<any>(
    `SELECT qa.id AS attempt_id, qa.submission_id, qa.quiz_id, qa.student_id,
            qa.points_earned, qa.submitted_answer, qa.grading_details,
            qs.grade_status, qs.status AS submission_status
       FROM quiz_attempts qa
       JOIN quiz_questions qq ON qq.id = qa.question_id
       JOIN question_bank qb ON qb.id = qq.question_id
       LEFT JOIN quiz_submissions qs ON qs.id = qa.submission_id
      WHERE qb.question_type = 'algorithmic'
        AND (qa.points_earned IS NULL OR qa.points_earned = 0)`,
    { type: QueryTypes.SELECT },
  );

  const noCode = rows.filter((r) => normalizeAlgorithmicAnswer(r.submitted_answer) === null);
  const toReopen = new Set<number>();
  const alreadyGraded = new Set<number>();
  for (const r of noCode) {
    if (!r.submission_id) continue;
    if (r.grade_status === "graded") alreadyGraded.add(r.submission_id);
    else if (r.submission_status !== "in_progress") toReopen.add(r.submission_id);
  }

  console.log(`Mode: ${APPLY ? "APPLY (writing)" : "dry run (no writes)"}`);
  console.log(
    `Algorithmic attempts with 0 points: ${rows.length}; without code: ${noCode.length}`,
  );
  if (noCode.length) {
    console.table(
      noCode.map((r) => ({
        attempt_id: r.attempt_id,
        submission_id: r.submission_id,
        quiz_id: r.quiz_id,
        student_id: r.student_id,
        grade_status: r.grade_status,
        answer: String(
          typeof r.submitted_answer === "string"
            ? r.submitted_answer
            : JSON.stringify(r.submitted_answer),
        ).slice(0, 60),
      })),
    );
  }
  console.log(
    `Submissions to mark pending: ${toReopen.size} ${JSON.stringify([...toReopen])}`,
  );
  console.log(
    `Already graded by a teacher (left alone): ${alreadyGraded.size} ${JSON.stringify([...alreadyGraded])}`,
  );

  if (!APPLY) {
    console.log("Dry run only. Re-run with --apply to write.");
    await sequelize.close();
    return;
  }

  await sequelize.transaction(async (transaction) => {
    if (toReopen.size) {
      await sequelize.query(
        `UPDATE quiz_submissions SET grade_status = 'pending'
          WHERE id IN (:ids) AND grade_status <> 'graded'`,
        { replacements: { ids: [...toReopen] }, transaction },
      );
    }
    const attemptIds = noCode
      .filter((r) => !r.grading_details && toReopen.has(r.submission_id))
      .map((r) => r.attempt_id);
    if (attemptIds.length) {
      await sequelize.query(
        `UPDATE quiz_attempts SET grading_details = :details
          WHERE id IN (:ids) AND grading_details IS NULL`,
        {
          replacements: {
            ids: attemptIds,
            details: JSON.stringify({ grade_status: "pending", pending_reason: REASON }),
          },
          transaction,
        },
      );
    }
    console.log(
      `Marked ${toReopen.size} submission(s) pending; flagged ${attemptIds.length} attempt(s).`,
    );
  });
  await sequelize.close();
}

main().catch(async (e) => {
  console.error(e);
  await sequelize.close();
  process.exit(1);
});

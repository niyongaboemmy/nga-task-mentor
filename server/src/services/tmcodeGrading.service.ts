import { Op } from "sequelize";
import {
  QuizAttempt,
  QuizQuestion,
  QuizSubmission,
  TmcodeRun,
  TmcodeSnapshot,
} from "../models";
import { AdvancedQuizGrader } from "../utils/quizGrader";
import { getQuestionBankInclude } from "../utils/quizUtils";
import { answerFromFiles, gunzipFiles, profileForQuestion } from "../tmcode/exam";
import { getCodeRunner } from "./coderunner";
import { recomputeSubmission } from "./codeRegrade.service";

/**
 * TMCode grading queue (plan §8.3): submitting never calls the judge in the
 * request. Each final snapshot becomes a tmcode_runs row, graded here on the
 * CodeRunner with every test (visible and hidden), one at a time, in this
 * process. Crash-safe: a row is claimed queued → running → done | error, and
 * rows left "running" by a crash are re-queued at start-up.
 *
 * A judge outage doesn't fail the run: the answer is stored pending
 * (judge_unavailable) and the periodic re-grade job (codeRegrade.service)
 * grades it when the judge is back.
 */

const MAX_TRIES = 3;

export async function enqueueGrading(
  submissionId: number,
  items: Array<{ question_id: number; snapshot_id: number }>,
  purpose: "grade" | "regrade" = "grade",
) {
  const now = new Date();
  for (const it of items) {
    await TmcodeRun.create({
      submission_id: submissionId,
      question_id: it.question_id,
      snapshot_id: it.snapshot_id,
      purpose,
      status: "queued",
      attempts: 0,
      queued_at: now,
    } as any);
  }
}

/** Runs a crash left "running" go back in the queue. */
export async function requeueStaleRuns(): Promise<number> {
  const [n] = await TmcodeRun.update(
    { status: "queued", started_at: null } as any,
    { where: { status: "running" } },
  );
  return n;
}

export const hasPendingRuns = async (submissionId: number) =>
  (await TmcodeRun.count({
    where: { submission_id: submissionId, status: { [Op.in]: ["queued", "running"] } },
  })) > 0;

/** Grade one snapshot's files as the question's answer and store it on the attempt. */
async function gradeRun(run: TmcodeRun) {
  const [snapshot, question, submission] = await Promise.all([
    TmcodeSnapshot.findByPk(run.snapshot_id),
    QuizQuestion.findByPk(run.question_id, { include: getQuestionBankInclude() }),
    QuizSubmission.findByPk(run.submission_id),
  ]);
  if (!snapshot || !question || !submission) throw new Error("run references missing rows");
  // A teacher's grade is final.
  if (submission.grade_status === "graded") return { skipped: true };

  const answer = answerFromFiles(gunzipFiles(snapshot.files_gz), profileForQuestion(question));
  const result: any = await AdvancedQuizGrader.gradeWithConfig(question, answer as any);
  const details = {
    ...(result.detailed_feedback || {}),
    source: "tmcode",
    snapshot_seq: snapshot.seq,
    session_id: snapshot.session_id,
  };

  const values = {
    submitted_answer: answer,
    grading_details: details,
    is_correct: result.is_correct,
    points_earned: result.points_earned,
    status: "completed" as const,
    completed_at: new Date(),
  };
  const attempt = await QuizAttempt.findOne({
    where: { submission_id: submission.id, question_id: question.id },
  });
  if (attempt) await attempt.update(values);
  else {
    await QuizAttempt.create({
      ...values,
      quiz_id: submission.quiz_id,
      question_id: question.id,
      student_id: submission.student_id,
      submission_id: submission.id,
      time_taken: 0,
      started_at: new Date(),
    } as any);
  }
  return { score: result.points_earned, max: Number(question.points) || 0, details };
}

/**
 * Claim and grade the oldest queued run. Returns false when the queue is
 * empty. Exposed for tests; the worker calls it on a timer.
 */
export async function processNextRun(): Promise<boolean> {
  const next = await TmcodeRun.findOne({
    where: { status: "queued" },
    order: [
      ["queued_at", "ASC"],
      ["id", "ASC"],
    ],
  });
  if (!next) return false;
  const [claimed] = await TmcodeRun.update(
    { status: "running", started_at: new Date(), attempts: next.attempts + 1 } as any,
    { where: { id: next.id, status: "queued" } },
  );
  if (!claimed) return true; // someone else took it

  try {
    const out: any = await gradeRun(next);
    await next.update({
      status: "done",
      engine: getCodeRunner().name,
      finished_at: new Date(),
      results: out.skipped ? { skipped: "teacher_graded" } : out.details,
      score: out.score ?? null,
      max_score: out.max ?? null,
      error: null,
    } as any);
  } catch (error: any) {
    const tries = next.attempts + 1;
    console.error(`[tmcode] grading run ${next.id} failed (try ${tries}):`, error?.message);
    await next.update({
      status: tries < MAX_TRIES ? "queued" : "error",
      error: String(error?.message ?? error),
      finished_at: tries < MAX_TRIES ? null : new Date(),
    } as any);
  }

  if (!(await hasPendingRuns(next.submission_id))) {
    await recomputeSubmission(next.submission_id);
  }
  return true;
}

let timer: NodeJS.Timeout | null = null;
let busy = false;

/** Concurrency 1: one run at a time, drained on each tick. */
export async function drainQueue(max = 50) {
  if (busy) return;
  busy = true;
  try {
    for (let i = 0; i < max && (await processNextRun()); i++);
  } finally {
    busy = false;
  }
}

export async function startTmcodeWorker() {
  stopTmcodeWorker();
  const n = await requeueStaleRuns().catch(() => 0);
  if (n) console.log(`[tmcode] re-queued ${n} grading run(s) left running`);
  const ms = Number(process.env.TMCODE_WORKER_INTERVAL_MS) || 2000;
  timer = setInterval(() => {
    drainQueue().catch((e) => console.error("[tmcode] worker:", e?.message));
  }, ms);
  timer.unref?.();
}

export function stopTmcodeWorker() {
  if (timer) clearInterval(timer);
  timer = null;
}

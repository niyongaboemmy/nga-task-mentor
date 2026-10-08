import crypto from "crypto";
import { Quiz, QuizQuestion, QuizSubmission, QuizAttempt, User } from "../models";
import { sequelize } from "../config/database";
import { getQuestionBankInclude } from "../utils/quizUtils";
import { AdvancedQuizGrader } from "../utils/quizGrader";
import { isPassed } from "../utils/quizStudentView";

/**
 * Paper answer sheets (nga-desktop docs/NEXT_FEATURES_ANALYSIS.md §3 #8).
 *
 * The teacher prints one sheet per student (client src/paper): numbered
 * bubbles for the quiz's choice questions (single choice, multiple choice,
 * true/false) in quiz order, and a QR code with quiz, student and a short
 * sheet key. A scanned sheet comes back as the bubbles each student filled.
 * It is stored like an online attempt (QuizAttempt.submitted_answer in the
 * same shapes) and scored by the same grader, so the result counts everywhere
 * (dashboards, early warning, rankings). Written questions on the quiz are left
 * at 0 for the teacher to mark in the grading page.
 *
 * The sheet key changes when the quiz's questions, their order or their
 * options change: sheets printed before an edit are refused, not mis-marked.
 */

export const PAPER_FEEDBACK = "Marked from a paper answer sheet.";
export const MAX_OPTIONS = 5;
const CHOICE = new Set(["single_choice", "multiple_choice", "true_false"]);

export interface SheetQuestion {
  /** quiz_questions.id */
  id: number;
  /** 1-based, as printed. */
  number: number;
  type: "single_choice" | "multiple_choice" | "true_false";
  options: number;
  points: number;
}

export interface SheetSpec {
  quizId: number;
  title: string;
  key: string;
  questions: SheetQuestion[];
  /** Question numbers the sheet doesn't cover (written, or more than 5 options). */
  manual: number[];
  maxScore: number;
}

const optionCount = (q: any): number => {
  const type = q.questionBank?.question_type;
  if (type === "true_false") return 2;
  const opts = q.questionBank?.question_data?.options;
  return Array.isArray(opts) ? opts.length : 0;
};

/** The printable spec of a quiz (pure over loaded rows; no answers in it). */
export function buildSpec(quiz: { id: number; title?: string }, questions: any[]): SheetSpec {
  const ordered = [...questions].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id - b.id);
  const out: SheetQuestion[] = [];
  const manual: number[] = [];
  ordered.forEach((q, i) => {
    const type = q.questionBank?.question_type;
    const n = optionCount(q);
    if (CHOICE.has(type) && n >= 2 && n <= MAX_OPTIONS) {
      out.push({ id: Number(q.id), number: i + 1, type, options: n, points: parseFloat(String(q.points ?? 1)) || 0 });
    } else manual.push(i + 1);
  });
  const fingerprint = [quiz.id, ...out.map((q) => `${q.id}:${q.number}:${q.type}:${q.options}`), "m", ...manual].join("|");
  const key = crypto.createHash("sha256").update(fingerprint).digest("hex").slice(0, 10);
  const maxScore = ordered.reduce((s, q) => s + (parseFloat(String(q.points ?? 1)) || 0), 0);
  return { quizId: Number(quiz.id), title: String(quiz.title || ""), key, questions: out, manual, maxScore };
}

/** Bubbles filled → the answer shape the grader expects (pure). Null = no valid answer. */
export function toAnswer(type: SheetQuestion["type"], selected: number[] | null | undefined, options: number): unknown {
  const sel = [...new Set((selected ?? []).filter((i) => Number.isInteger(i) && i >= 0 && i < options))].sort((a, b) => a - b);
  if (type === "multiple_choice") return sel.length ? { selected_option_indices: sel } : null;
  if (sel.length !== 1) return null; // blank or two bubbles on a one-answer question
  if (type === "true_false") return { selected_answer: sel[0] === 0 };
  return { selected_option_index: sel[0] };
}

export async function loadQuiz(quizId: number) {
  return Quiz.findByPk(quizId, {
    include: [{ model: QuizQuestion, as: "questions", include: getQuestionBankInclude() as any }],
  }) as Promise<any>;
}

export interface PaperResult {
  studentId: number;
  /** quiz_questions.id → bubble indices filled (0 = A / True). */
  answers: Record<string, number[] | null>;
}

export interface SavedResult {
  studentId: number;
  submissionId: number;
  score: number;
  maxScore: number;
  percentage: number;
  updated: boolean;
}

/**
 * Stores and scores one student's sheet. A second scan of the same student's
 * sheet updates the earlier paper submission (keeping any marks the teacher
 * already gave written questions) instead of adding an attempt.
 */
export async function saveResult(quiz: any, spec: SheetSpec, r: PaperResult, gradedBy: number): Promise<SavedResult> {
  const studentId = Math.trunc(Number(r.studentId));
  const student = studentId > 0 ? await User.findByPk(studentId) : null;
  if (!student) throw Object.assign(new Error(`Student ${r.studentId} not found`), { status: 400 });
  const questions: any[] = quiz.questions || [];
  const byId = new Map(questions.map((q) => [Number(q.id), q]));
  const sheetIds = new Set(spec.questions.map((q) => q.id));

  return sequelize.transaction(async (transaction) => {
    const now = new Date();
    let submission: any = await QuizSubmission.findOne({
      where: { quiz_id: quiz.id, student_id: studentId, feedback: PAPER_FEEDBACK, status: "completed" } as any,
      order: [["id", "DESC"]],
      transaction,
    });
    const updated = !!submission;
    if (!submission) {
      await QuizSubmission.update({ status: "abandoned" } as any, { where: { quiz_id: quiz.id, student_id: studentId, status: "in_progress" } as any, transaction });
      const count = await QuizSubmission.count({ where: { quiz_id: quiz.id, student_id: studentId } as any, transaction });
      submission = await QuizSubmission.create(
        {
          quiz_id: quiz.id, student_id: studentId, status: "completed", grade_status: "pending",
          total_score: 0, max_score: spec.maxScore, percentage: 0, passed: false,
          attempt_number: count + 1, started_at: now, completed_at: now, time_taken: 0, feedback: PAPER_FEEDBACK,
        } as any,
        { transaction },
      );
    }
    const existing: any[] = await QuizAttempt.findAll({ where: { submission_id: submission.id } as any, transaction });
    const attemptOf = new Map(existing.map((a) => [Number(a.question_id), a]));

    let total = 0;
    for (const q of questions) {
      const qid = Number(q.id);
      const prior = attemptOf.get(qid);
      if (!sheetIds.has(qid)) {
        // Written question: keep what the teacher gave it, if anything.
        const pts = prior ? parseFloat(String(prior.points_earned || 0)) : 0;
        total += pts;
        if (!prior) {
          await QuizAttempt.create(
            { quiz_id: quiz.id, question_id: qid, student_id: studentId, submission_id: submission.id, status: "completed", started_at: now, completed_at: now, time_taken: 0, points_earned: 0 } as any,
            { transaction },
          );
        }
        continue;
      }
      const sq = spec.questions.find((x) => x.id === qid)!;
      const answer = toAnswer(sq.type, r.answers?.[String(qid)] ?? null, sq.options);
      let points = 0;
      let correct = false;
      let details: unknown = { source: "paper", selected: r.answers?.[String(qid)] ?? null };
      if (answer !== null) {
        try {
          const g: any = await AdvancedQuizGrader.gradeWithConfig(byId.get(qid), answer as any);
          points = Number(g.points_earned) || 0;
          correct = !!g.is_correct;
          details = { ...g, source: "paper" };
        } catch {
          /* ungradeable: 0, the teacher can adjust */
        }
      }
      total += points;
      const row = {
        submitted_answer: answer, correct_answer: AdvancedQuizGrader.normalizeCorrectAnswer(byId.get(qid)) ?? null,
        grading_details: details, is_correct: correct, points_earned: points, status: "completed", completed_at: now,
      };
      if (prior) await prior.update(row, { transaction });
      else {
        await QuizAttempt.create(
          { quiz_id: quiz.id, question_id: qid, student_id: studentId, submission_id: submission.id, started_at: now, time_taken: 0, ...row } as any,
          { transaction },
        );
      }
    }
    const max = spec.maxScore || 0;
    const percentage = max > 0 ? Math.round((total / max) * 10000) / 100 : 0;
    await submission.update(
      {
        total_score: total, max_score: max, percentage, passed: isPassed(percentage, quiz),
        // Written questions still need the teacher; otherwise the teacher's reviewed scan is the grade.
        grade_status: spec.manual.length ? "pending" : "graded",
        graded_at: now, graded_by: gradedBy, completed_at: submission.completed_at ?? now,
      },
      { transaction },
    );
    return { studentId, submissionId: Number(submission.id), score: total, maxScore: max, percentage, updated };
  });
}

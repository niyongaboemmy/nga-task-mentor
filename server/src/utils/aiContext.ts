import { Request } from "express";
import { Op } from "sequelize";
import {
  Assignment,
  Project,
  ProjectActivityLink,
  Quiz,
  QuizQuestion,
  Submission,
  TmcodeSession,
} from "../models";
import { normalizeAiMode, type AiAssessmentContext, type AiMode } from "../vendor/nga-access";
import { canManageAssignment, canManageQuiz } from "./ownership";
import { canGradeAssignment, canGradeQuiz } from "./gradingAccess";
import { resolveProjectAccess } from "../tmcode/projects/access";

/**
 * Which quiz/assignment a caller is working inside, for the AI decision
 * (AI_USAGE_CONTROL_PLAN.md §5.2). Each resolver returns the item's context
 * ONLY when the caller is a learner in it; null otherwise:
 *
 *   - the item's creator, or someone holding *_MANAGE_ANY, is not "in" it --
 *     their AI is decided by their role (AI_USE);
 *   - nor is a teacher who may grade it (gradingAccess: a teacher of its subject);
 *   - an unknown item is null too (the route answers 404 on its own).
 *
 * examActive: the caller has an active TMCode exam session for that quiz.
 */

export type ItemContext = AiAssessmentContext;

const GRADE_PERMS = ["QUIZZES_GRADE", "SUBMISSIONS_GRADE", "GRADING_MANUAL_ASSESS"];
const userOf = (req: Request) => (req as any).user as { id: number; permissions?: Set<string> } | undefined;
const mayGrade = (req: Request) => GRADE_PERMS.some((p) => userOf(req)?.permissions?.has(p));
const positive = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/** The active TMCode exam session of a user (optionally for one quiz). */
export async function activeExamSession(userId: number, quizId?: number) {
  return TmcodeSession.findOne({
    where: {
      user_id: userId,
      status: "active",
      ended_at: { [Op.is]: null },
      ...(quizId ? { quiz_id: quizId } : {}),
    } as never,
    attributes: ["id", "quiz_id"],
  });
}

type QuizLike = Pick<Quiz, "id" | "created_by" | "course_id" | "academic_term_id"> & { ai_mode?: AiMode | null };
type AssignmentLike = Pick<Assignment, "id" | "created_by" | "course_id" | "academic_term_id"> & { ai_mode?: AiMode | null };

/** Is the caller staff for this quiz (owner, MANAGE_ANY or grader)? */
async function staffForQuiz(req: Request, quiz: QuizLike) {
  if (canManageQuiz(userOf(req), quiz)) return true;
  return mayGrade(req) && (await canGradeQuiz(req, quiz));
}

async function staffForAssignment(req: Request, a: AssignmentLike) {
  if (canManageAssignment(userOf(req), a)) return true;
  return mayGrade(req) && (await canGradeAssignment(req, a));
}

export async function forQuiz(req: Request, quizOrId: number | QuizLike | null | undefined): Promise<ItemContext | null> {
  const quiz =
    typeof quizOrId === "number" || typeof quizOrId === "string"
      ? positive(quizOrId) && (await Quiz.findByPk(Number(quizOrId)))
      : quizOrId;
  if (!quiz || !userOf(req)) return null;
  if (await staffForQuiz(req, quiz)) return null;
  const exam = await activeExamSession(Number(userOf(req)!.id), quiz.id);
  return { kind: "quiz", id: quiz.id, aiMode: normalizeAiMode(quiz.ai_mode), examActive: !!exam };
}

/** A question of a quiz (quiz_questions.id) → that quiz. */
export async function forQuestion(req: Request, questionId: unknown): Promise<ItemContext | null> {
  const id = positive(questionId);
  if (!id) return null;
  const q = await QuizQuestion.findByPk(id, { attributes: ["id", "quiz_id"] });
  return q ? forQuiz(req, Number(q.quiz_id)) : null;
}

export async function forAssignment(
  req: Request,
  assignmentOrId: number | AssignmentLike | null | undefined,
): Promise<ItemContext | null> {
  const a =
    typeof assignmentOrId === "number" || typeof assignmentOrId === "string"
      ? positive(assignmentOrId) && (await Assignment.findByPk(Number(assignmentOrId)))
      : assignmentOrId;
  if (!a || !userOf(req)) return null;
  if (await staffForAssignment(req, a)) return null;
  return { kind: "assignment", id: a.id, aiMode: normalizeAiMode(a.ai_mode), examActive: false };
}

/** An assignment submission: its student is in the assignment; anyone else (the grader) is not. */
export async function forSubmission(req: Request, submissionId: unknown): Promise<ItemContext | null> {
  const id = positive(submissionId);
  const user = userOf(req);
  if (!id || !user) return null;
  const s = await Submission.findByPk(id, { attributes: ["id", "assignment_id", "student_id"] });
  if (!s || Number(s.student_id) !== Number(user.id)) return null;
  return forAssignment(req, Number(s.assignment_id));
}

const STRICTNESS: Record<AiMode, number> = { off: 0, hints: 1, full: 2 };

/**
 * A TMCode/TM project → the activity it is the workspace for: its
 * assignment_id (TMCode assignments) or its activity links (quiz/assignment).
 * Only for the project's owner or members (the learner) -- a teacher or admin
 * reading it is not in the item. With several linked items the strictest
 * ai_mode wins; a project linked to nothing is general use (null).
 */
export async function forProject(req: Request, projectId: unknown): Promise<ItemContext | null> {
  const id = positive(projectId);
  if (!id || !userOf(req)) return null;
  const access = await resolveProjectAccess(req, id);
  if (!access || access.role === "admin" || access.role === "teacher") return null;
  const project: Project = access.project;

  const items: ItemContext[] = [];
  if (project.assignment_id) {
    const ctx = await forAssignment(req, Number(project.assignment_id));
    if (ctx) items.push(ctx);
  }
  const links = await ProjectActivityLink.findAll({
    where: { project_id: project.id, activity_type: { [Op.in]: ["quiz", "assignment"] } },
    attributes: ["activity_type", "activity_id"],
  });
  for (const link of links) {
    if (link.activity_type === "assignment" && Number(link.activity_id) === Number(project.assignment_id)) continue;
    const ctx =
      link.activity_type === "quiz"
        ? await forQuiz(req, Number(link.activity_id))
        : await forAssignment(req, Number(link.activity_id));
    if (ctx) items.push(ctx);
  }
  if (!items.length) return null;
  // An exam in progress decides first, then the strictest setting.
  items.sort((a, b) => Number(!!b.examActive) - Number(!!a.examActive) || STRICTNESS[a.aiMode] - STRICTNESS[b.aiMode]);
  return items[0];
}

/**
 * While a learner has a TMCode exam open, that quiz is the context of every
 * TMCode AI request, whatever project (if any) the request names.
 */
export async function examContext(req: Request): Promise<ItemContext | null> {
  const user = userOf(req);
  if (!user) return null;
  const session = await activeExamSession(Number(user.id));
  if (!session) return null;
  const quiz = await Quiz.findByPk(Number(session.quiz_id));
  if (!quiz) return { kind: "quiz", id: Number(session.quiz_id), aiMode: "off", examActive: true };
  return { kind: "quiz", id: quiz.id, aiMode: normalizeAiMode(quiz.ai_mode), examActive: true };
}

/** ?quiz= | ?assignment= | ?project= (GET /api/ai/access). */
export async function fromQuery(req: Request): Promise<ItemContext | null> {
  const q = req.query as Record<string, unknown>;
  if (q.quiz != null) return forQuiz(req, positive(q.quiz));
  if (q.assignment != null) return forAssignment(req, positive(q.assignment));
  if (q.project != null) return forProject(req, q.project);
  return null;
}

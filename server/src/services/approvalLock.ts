import type { NextFunction, Request, Response } from "express";
import { Op } from "sequelize";
import { ReportCard } from "../models/ReportCard.model";
import { ReportCardAssessment } from "../models/ReportCardAssessment.model";
import { User } from "../models/User.model";
import { Submission } from "../models/Submission.model";
import { QuizSubmission } from "../models/QuizSubmission.model";
import { QuizQuestion } from "../models/QuizQuestion.model";

/**
 * Approved marks stay approved. Once a report card is approved (or
 * published), nothing that feeds its marks may change behind it:
 *
 *  - the assessment itself (quiz + its questions, assignment, manual
 *    assessment): no edit, delete, marks-scope or status change while ANY
 *    approved/published card maps it;
 *  - a student's mark on it (grading, regrading, resets, deleted
 *    submissions, manual/paper scores, late submissions or attempts): no
 *    change while THAT student's card is approved/published.
 *
 * Returning the card to draft (reopen) lifts the lock. Refusals are 423 with
 * code MARKS_APPROVED and say how many cards hold the marks.
 */

export type AssessmentKind = "quiz" | "assignment" | "manual";
const FROZEN = ["approved", "published"];
export const MARKS_APPROVED = "MARKS_APPROVED";

interface Lock {
  cards: number;
  periods: string[];
}

/** Approved/published cards that map this assessment, optionally only for these card keys. */
export async function frozenCardsFor(kind: AssessmentKind, assessmentId: number, cardStudentKeys?: number[]): Promise<Lock> {
  if (!(assessmentId > 0)) return { cards: 0, periods: [] };
  if (cardStudentKeys && cardStudentKeys.length === 0) return { cards: 0, periods: [] };
  const rows = await ReportCardAssessment.findAll({
    where: { assessment_type: kind, assessment_id: assessmentId },
    attributes: ["report_card_id"],
    raw: true,
  });
  const ids = [...new Set(rows.map((r: any) => Number(r.report_card_id)))];
  if (!ids.length) return { cards: 0, periods: [] };
  const cards = await ReportCard.findAll({
    where: {
      id: { [Op.in]: ids },
      status: { [Op.in]: FROZEN },
      ...(cardStudentKeys ? { student_id: { [Op.in]: cardStudentKeys } } : {}),
    },
    attributes: ["id", "term", "academic_year"],
    raw: true,
  });
  return { cards: cards.length, periods: [...new Set(cards.map((c: any) => `${c.term} ${c.academic_year}`))] };
}

/** Card keys (MIS id first, local id for legacy cards) of local user ids. */
export async function cardKeysOfLocalUsers(localIds: number[]): Promise<number[]> {
  const ids = [...new Set(localIds.filter((n) => Number.isInteger(n) && n > 0))];
  if (!ids.length) return [];
  const users = await User.findAll({ where: { id: { [Op.in]: ids } }, attributes: ["id", "mis_user_id"], raw: true });
  const keys = new Set<number>(ids);
  for (const u of users as any[]) if (u.mis_user_id != null) keys.add(Number(u.mis_user_id));
  return [...keys];
}

/** Card keys of MIS ids (manual scores are keyed on them): the id plus linked local ids. */
export async function cardKeysOfMisIds(misIds: number[]): Promise<number[]> {
  const ids = [...new Set(misIds.filter((n) => Number.isInteger(n) && n > 0))];
  if (!ids.length) return [];
  const users = await User.findAll({ where: { mis_user_id: { [Op.in]: ids } }, attributes: ["id"], raw: true });
  return [...new Set([...ids, ...users.map((u: any) => Number(u.id))])];
}

const NOUN: Record<AssessmentKind, string> = { quiz: "quiz", assignment: "assignment", manual: "assessment" };

function refuse(res: Response, kind: AssessmentKind, lock: Lock, scope: "assessment" | "mark") {
  const n = lock.cards;
  const period = lock.periods.length ? ` (${lock.periods.join(", ")})` : "";
  const message =
    scope === "assessment"
      ? `This ${NOUN[kind]}'s marks are on ${n} approved report card${n === 1 ? "" : "s"}${period}, so it can't be changed. Return ${n === 1 ? "that card" : "those cards"} to draft first.`
      : `${n === 1 ? "This student's" : `${n} students'`} report card${n === 1 ? " is" : "s are"} approved${period}, so ${n === 1 ? "this mark" : "these marks"} can't be changed. Return the card${n === 1 ? "" : "s"} to draft first.`;
  return res.status(423).json({ success: false, code: MARKS_APPROVED, message });
}

type Resolver = (req: Request) => Promise<{ kind: AssessmentKind; id: number; cardKeys?: number[] } | null>;

/** Route guard: resolve what the request changes, refuse when approved cards hold it. */
export const guard =
  (scope: "assessment" | "mark", resolve: Resolver) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const target = await resolve(req);
      if (!target) return next();
      const lock = await frozenCardsFor(target.kind, target.id, scope === "mark" ? (target.cardKeys ?? []) : undefined);
      if (lock.cards > 0) return refuse(res, target.kind, lock, scope);
      next();
    } catch (e) {
      next(e);
    }
  };

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : 0;
};

// ── Resolvers for each route shape ─────────────────────────────────────────

/** The assessment named by a route param. */
export const byParam = (kind: AssessmentKind, param: string): Resolver => async (req) => {
  const id = num(req.params[param]);
  return id ? { kind, id } : null;
};

/** A quiz question → its quiz. */
export const quizOfQuestion: Resolver = async (req) => {
  const q = await QuizQuestion.findByPk(num(req.params.id), { attributes: ["quiz_id"], raw: true });
  return q ? { kind: "quiz", id: Number((q as any).quiz_id) } : null;
};

/** An assignment submission → its assignment and student. */
export const assignmentSubmission =
  (param = "id"): Resolver =>
  async (req) => {
    const s = await Submission.findByPk(num(req.params[param]), { attributes: ["assignment_id", "student_id"], raw: true });
    if (!s) return null;
    return { kind: "assignment", id: Number((s as any).assignment_id), cardKeys: await cardKeysOfLocalUsers([Number((s as any).student_id)]) };
  };

/** A quiz submission → its quiz and student. */
export const quizSubmission =
  (param: string): Resolver =>
  async (req) => {
    const s = await QuizSubmission.findByPk(num(req.params[param]), { attributes: ["quiz_id", "student_id"], raw: true });
    if (!s) return null;
    return { kind: "quiz", id: Number((s as any).quiz_id), cardKeys: await cardKeysOfLocalUsers([Number((s as any).student_id)]) };
  };

/** The caller's own submission/attempt on an assessment named by a param or body field. */
export const ownWork =
  (kind: AssessmentKind, from: { param?: string; body?: string }): Resolver =>
  async (req) => {
    const id = num(from.param ? req.params[from.param] : (req.body ?? {})[from.body!]);
    const me = num((req as any).user?.id);
    return id && me ? { kind, id, cardKeys: await cardKeysOfLocalUsers([me]) } : null;
  };

/** An assessment param + students listed in the body or params. */
export const withStudents =
  (kind: AssessmentKind, param: string, students: (req: Request) => { local?: number[]; mis?: number[] }): Resolver =>
  async (req) => {
    const id = num(req.params[param]);
    if (!id) return null;
    const s = students(req);
    const keys = [...(await cardKeysOfLocalUsers(s.local ?? [])), ...(await cardKeysOfMisIds(s.mis ?? []))];
    return { kind, id, cardKeys: [...new Set(keys)] };
  };

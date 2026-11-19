import { Request, Response } from "express";
import type { Target } from "../vendor/nga-access";
import { denyResponse, once, scopedAllow, scopedFilter } from "../access/policy";
import { allowedStudentIds, reportCardStudentMisIds, studentTarget } from "../access/targets";
import { ReportCard } from "../models/ReportCard.model";
import { isEditable } from "../services/reportCardWorkflow";
import { User } from "../models/User.model";

/**
 * Report-card access, shared by the card and workflow controllers. With
 * ACCESS_V2_MODE=off these return the legacy answer; shadow logs where v2
 * disagrees; enforce lets v2 decide over the student's class group /
 * (subject, class) pair.
 */

/** v2 target for a report card's student (student_id may be local or MIS). */
export const cardStudentTarget = async (req: Request, studentId: number, extra: Target = {}): Promise<Target> => {
  const misId = (await reportCardStudentMisIds([studentId])).get(studentId) ?? studentId;
  return studentTarget(req, misId, extra);
};

/** Keep only the report-card student ids v2 lets the caller see with `caps`. */
export const filterCardStudents = (
  req: Request,
  ids: number[],
  caps: string[],
  opts: { minDepth?: "summary" | "detail"; subjectId?: number | null } = {},
) =>
  scopedFilter(req, ids, caps.join("|"), async (snap) => {
    const misOf = await reportCardStudentMisIds(ids);
    const allowed = new Set(await allowedStudentIds(req, snap, caps, [...new Set(misOf.values())], opts));
    return ids.filter((id) => allowed.has(misOf.get(id) ?? id));
  });

export const userPermissions = (req: Request): Set<string> => (req as any).user?.permissions ?? new Set();

/**
 * May the caller read this student's cards at all, and at which level?
 * Legacy: REPORT_CARDS_VIEW_ALL anywhere -> every card of every student;
 * otherwise their own published cards. v2: VIEW_ALL @detail over the
 * student, else VIEW_OWN over the student (SELF / mentees / children).
 */
export const reportCardReadAccess = async (
  req: Request,
  studentId: number,
): Promise<{ allowed: boolean; canViewAll: boolean }> => {
  const perms = userPermissions(req);
  const target = once(() => cardStudentTarget(req, studentId));
  const canViewAll = await scopedAllow(req, {
    caps: "REPORT_CARDS_VIEW_ALL",
    minDepth: "detail",
    target,
    legacy: perms.has("REPORT_CARDS_VIEW_ALL"),
  });
  if (canViewAll) return { allowed: true, canViewAll: true };
  const own = await scopedAllow(req, { caps: "REPORT_CARDS_VIEW_OWN", target, legacy: await isOwnStudent(req, studentId) });
  return { allowed: own, canViewAll: false };
};

/** Legacy "own": the caller is this student (local id or MIS id). */
async function isOwnStudent(req: Request, studentId: number): Promise<boolean> {
  const user = (req as any).user;
  if (!user) return false;
  if (Number(user.id) === studentId) return true;
  if (user.mis_user_id != null && Number(user.mis_user_id) === studentId) return true;
  return false;
}

/** Every id a student's cards may be keyed on (MIS id + linked local ids, legacy). */
export async function cardStudentIds(studentId: number): Promise<number[]> {
  const users = await User.findAll({
    where: { mis_user_id: studentId },
    attributes: ["id"],
    raw: true,
  });
  const self = await User.findByPk(studentId, { attributes: ["id", "mis_user_id"], raw: true });
  const ids = new Set<number>([studentId, ...users.map((u: any) => Number(u.id))]);
  if (self && (self as any).mis_user_id != null && users.length === 0) ids.add(Number((self as any).mis_user_id));
  return [...ids];
}

export const CARD_LOCKED = "CARD_LOCKED";

/** 409 when any of the cards is past draft; returns true when the response was sent. */
export function rejectLocked(res: Response, cards: Array<ReportCard | null | undefined>): boolean {
  const locked = cards.filter((c): c is ReportCard => !!c && !isEditable(c.status));
  if (locked.length === 0) return false;
  const c = locked[0];
  res.status(409).json({
    success: false,
    code: CARD_LOCKED,
    message:
      locked.length === 1
        ? `This report card is ${c.status} and can't be changed. Reopen it to draft first.`
        : `${locked.length} report cards are past draft and can't be changed. Reopen them to draft first.`,
    data: { locked: locked.map((l) => ({ report_card_id: l.id, student_id: l.student_id, status: l.status })) },
  });
  return true;
}

export { denyResponse, once, scopedAllow };

/** "First Last" of the signed-in user, for the audit trail. */
export async function actorName(req: Request): Promise<string | null> {
  const id = (req as any).user?.id;
  if (!id) return null;
  const u: any = await User.findByPk(id, { attributes: ["first_name", "last_name"], raw: true });
  return u ? `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || null : null;
}

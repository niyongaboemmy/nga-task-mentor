import { Request } from "express";
import axios from "axios";
import { User } from "../models/User.model";
import { getMisToken } from "./misUtils";
import { isCreator } from "./ownership";

/**
 * Who may grade a quiz or assignment's submissions.
 *
 * Editing, deleting and status changes stay with the item's creator or a
 * super admin (utils/ownership.ts). Grading is wider: any teacher assigned in
 * the MIS to the item's subject (course_id = MIS subject id) grades its
 * submissions, the way a subject's co-teachers share one class's marking.
 *
 *   1. super admin (*_MANAGE_ANY)
 *   2. the creator, by local id OR by MIS user id (a teacher can end up with
 *      more than one local User row, e.g. one lazily created by id from a
 *      roster and one from their own login)
 *   3. a teacher assigned to the subject, in the item's term or the current one
 */

type Gradable = {
  created_by?: number | string | null;
  course_id?: number | string | null;
  academic_term_id?: number | string | null;
} | null | undefined;

type ManageAnyKey = "QUIZZES_MANAGE_ANY" | "ASSIGNMENTS_MANAGE_ANY";

/** MIS subject ids the caller teaches in a term (null = MIS default/current); memoised per request. */
export async function getAssignedSubjectIdSet(
  req: Request,
  termId: number | null,
): Promise<Set<number>> {
  const r = req as any;
  r.__assignedSubjects ??= new Map<string, Promise<Set<number>>>();
  const key = termId == null ? "current" : String(termId);
  if (!r.__assignedSubjects.has(key)) {
    r.__assignedSubjects.set(key, fetchAssignedSubjectIds(req, termId));
  }
  return r.__assignedSubjects.get(key);
}

async function fetchAssignedSubjectIds(req: Request, termId: number | null): Promise<Set<number>> {
  const token = getMisToken(req, { quiet: true });
  if (!token) return new Set();
  try {
    const response = await axios.get(
      `${process.env.NGA_MIS_BASE_URL}/academics/my-assigned-subjects`,
      {
        headers: { Authorization: `Bearer ${token}` },
        params: termId ? { academic_term_id: termId } : {},
      },
    );
    if (!response.data?.success) return new Set();
    return new Set(
      (response.data.data || [])
        .map((s: any) => Number(s.id ?? s.subject_id))
        .filter((id: number) => !isNaN(id) && id > 0),
    );
  } catch (error: any) {
    console.warn("gradingAccess: MIS my-assigned-subjects fetch failed:", error.message);
    return new Set();
  }
}

async function isCreatorByMisId(req: Request, item: Gradable): Promise<boolean> {
  const misUserId = Number((req as any).user?.mis_user_id);
  if (!item?.created_by || !misUserId) return false;
  const creator = await User.findByPk(Number(item.created_by), { attributes: ["id", "mis_user_id"] });
  return !!creator?.mis_user_id && Number(creator.mis_user_id) === misUserId;
}

export async function teachesSubject(req: Request, item: Gradable): Promise<boolean> {
  const subjectId = Number(item?.course_id);
  if (!subjectId) return false;
  const termId = item?.academic_term_id ? Number(item.academic_term_id) : null;
  if ((await getAssignedSubjectIdSet(req, termId)).has(subjectId)) return true;
  // an item from a term whose assignment list is stale/empty: fall back to the current term
  return termId !== null && (await getAssignedSubjectIdSet(req, null)).has(subjectId);
}

async function canGrade(req: Request, item: Gradable, manageAny: ManageAnyKey): Promise<boolean> {
  const user = (req as any).user;
  if (!user || !item) return false;
  if (user.permissions?.has(manageAny)) return true;
  if (isCreator(user, item)) return true;
  if (await isCreatorByMisId(req, item)) return true;
  return teachesSubject(req, item);
}

export const canGradeAssignment = (req: Request, assignment: Gradable) =>
  canGrade(req, assignment, "ASSIGNMENTS_MANAGE_ANY");

export const canGradeQuiz = (req: Request, quiz: Gradable) =>
  canGrade(req, quiz, "QUIZZES_MANAGE_ANY");

export const GRADE_DENIED_MESSAGE =
  "Only a teacher of this subject, the creator or a super admin can grade this submission";

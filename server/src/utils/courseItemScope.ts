import { Request } from "express";
import { Op } from "sequelize";

/**
 * Which of a subject's assignments and quizzes a caller sees on the course
 * page. The tab counters (course statistics) and the lists behind the tabs
 * must apply the same rules, or a tab says "1" and opens empty:
 *   - the selected academic term, plus legacy rows with no term;
 *   - students (no ASSIGNMENTS_VIEW_SUBMISSIONS) see published/completed
 *     assignments only, never drafts or removed ones;
 *   - students (no QUIZZES_EDIT) see published quizzes only, as
 *     quiz.controller getQuizzes does.
 */

export function termScope(termId: number | null) {
  return termId ? { [Op.or]: [{ academic_term_id: termId }, { academic_term_id: null }] } : {};
}

export function isAssignmentStudentView(req: Request): boolean {
  return !req.user?.permissions?.has("ASSIGNMENTS_VIEW_SUBMISSIONS");
}

/** Status filter for assignments listed or counted on a course page. */
export function assignmentStatusScope(req: Request) {
  return isAssignmentStudentView(req)
    ? { status: { [Op.in]: ["published", "completed"] } }
    : {};
}

/** Status filter for quizzes counted on a course page. */
export function quizStatusScope(req: Request) {
  return req.user?.permissions?.has("QUIZZES_EDIT") ? {} : { status: "published" };
}

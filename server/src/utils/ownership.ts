/**
 * "Only the creator or a super admin" rule for quizzes and assignments.
 *
 * Holding QUIZZES_EDIT / ASSIGNMENTS_EDIT / *_GRADE says *what kind* of thing a
 * caller may do; this says *which* items. Co-teachers of a subject can see
 * each other's quizzes and assignments, but editing, changing status and
 * manual grading stay with the item's creator. The *_MANAGE_ANY permissions
 * (seeded on the admin role only) are the super-admin bypass.
 */

type Caller = { id: number | string; permissions?: Set<string> } | undefined;
type Owned = { created_by?: number | string | null } | null | undefined;

const sameId = (a: unknown, b: unknown) =>
  a !== null && a !== undefined && b !== null && b !== undefined && Number(a) === Number(b);

export const isCreator = (user: Caller, item: Owned) =>
  !!user && !!item && sameId(item.created_by, user.id);

export const canManageQuiz = (user: Caller, quiz: Owned) =>
  !!user?.permissions?.has("QUIZZES_MANAGE_ANY") || isCreator(user, quiz);

export const canManageAssignment = (user: Caller, assignment: Owned) =>
  !!user?.permissions?.has("ASSIGNMENTS_MANAGE_ANY") || isCreator(user, assignment);

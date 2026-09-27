// ─── Grade-sheet identity matching ────────────────────────────────────────────
// GET /courses/:id/grades lays submissions against a roster. A roster row is
// known by its MIS id (MIS-enrolled students) and/or its local users.id
// (local-only submitters, self-view); a submission carries the local
// student_id plus the joined User's mis_user_id. Matching must use only ids
// the row actually has — never fall back to a value taken from the submission
// itself, or every submission matches every row and the whole class inherits
// the best score in it.

export interface RosterIdentity {
  id?: number | string | null;
  user_id?: number | string | null;
  mis_user_id?: number | string | null;
}

export interface SubmissionIdentity {
  student_id?: number | string | null;
  student?: { id?: number | string | null; mis_user_id?: number | string | null } | null;
}

const present = (v: unknown): v is number | string =>
  v !== null && v !== undefined && v !== "";

export const submissionBelongsTo = (
  sub: SubmissionIdentity,
  student: RosterIdentity,
): boolean => {
  const subMisId = sub.student?.mis_user_id;
  if (present(subMisId) && present(student.mis_user_id)) {
    if (String(subMisId) === String(student.mis_user_id)) return true;
  }
  const subLocalId = present(sub.student_id) ? sub.student_id : sub.student?.id;
  if (present(subLocalId) && present(student.user_id)) {
    if (String(subLocalId) === String(student.user_id)) return true;
  }
  return false;
};

/**
 * The highest-scoring attempt. total_score is a MySQL DECIMAL and comes back as
 * a string, so compare numerically — "9.00" > "10.00" as strings.
 */
export const bestBySubmissionScore = <T extends { total_score: unknown }>(
  subs: T[],
): T | null =>
  subs.reduce<T | null>(
    (best, cur) =>
      best === null || Number(cur.total_score) > Number(best.total_score) ? cur : best,
    null,
  );

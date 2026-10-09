/**
 * Is a project hand-in late?
 *
 * Late means handed in after the due date — except a re-hand-in of exactly
 * the work that was already handed in on time (same frozen revision, or the
 * same git commit). Withdrawing after the due date and submitting the same
 * version again (or a teacher's return answered without changes) must not
 * turn on-time work into late work. Any change to the work after the due
 * date is late, as before.
 */

export interface PreviousHandIn {
  is_late: unknown;
  /** submissions.project_ref of the earlier hand-in (JSON or parsed). */
  project_ref: unknown;
}

export function handInIsLate(args: {
  now: Date;
  due: Date | string | null | undefined;
  previous: PreviousHandIn | null | undefined;
  revisionId: number | null;
  commit: string | null;
}): boolean {
  const { now, due, previous, revisionId, commit } = args;
  if (!due || !(now.getTime() > new Date(due).getTime())) return false;
  if (!previous || isTruthy(previous.is_late)) return true;
  const ref = parseRef(previous.project_ref);
  if (!ref) return true;
  const sameRevision = revisionId != null && Number(ref.revision_id) === revisionId;
  const sameCommit = !!commit && ref.git_commit === commit;
  return !(sameRevision || sameCommit);
}

/** Would handing in now be late (the due date has passed)? For warnings. */
export function pastDue(due: Date | string | null | undefined, now = new Date()): boolean {
  return !!due && now.getTime() > new Date(due).getTime();
}

const isTruthy = (v: unknown) => v === true || v === 1 || v === "1" || v === "true";

function parseRef(raw: unknown): { revision_id?: unknown; git_commit?: unknown } | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      const v = JSON.parse(raw);
      return v && typeof v === "object" ? v : null;
    } catch {
      return null;
    }
  }
  return typeof raw === "object" ? (raw as any) : null;
}

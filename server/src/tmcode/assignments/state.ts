/**
 * Pure rules of TMCode practicals (ASSIGNMENTS_PLAN.md): which state a
 * student's work is in, and when an assignment is read-only. Shared by the
 * assignments API, the projects API (read_only on workspaces) and tests.
 */

export type WorkState = "not_started" | "in_progress" | "submitted" | "graded";

/** Submission statuses that mean "handed in" (graded is its own state). */
const HANDED_IN = ["submitted", "resubmitted", "late", "completed"];

export interface WorkInputs {
  /** The student's workspace (or the project they linked). */
  project?: { id: number } | null;
  link?: { status: string } | null;
  submission?: { status?: string | null; grade?: string | number | null } | null;
}

export function workState({ project, link, submission }: WorkInputs): WorkState {
  if (submission?.status === "graded") return "graded";
  if (link?.status === "submitted" || (submission?.status && HANDED_IN.includes(submission.status))) {
    return "submitted";
  }
  if (project || link) return "in_progress";
  return "not_started";
}

/** A completed assignment is viewable but closed: no saving, submitting or starting. */
export const isReadOnlyStatus = (status: string | null | undefined) => status === "completed";

/** Students only ever see published or completed TMCode assignments. */
export const STUDENT_STATUSES = ["published", "completed"] as const;

/** `submissions.grade` is TEXT; a number when it holds one. */
export function gradeNumber(grade: unknown): number | null {
  if (grade === null || grade === undefined || grade === "") return null;
  const n = Number(grade);
  return Number.isFinite(n) ? n : null;
}

/** Share live status can't be turned off while the workspace's assignment is open. */
export const presenceLocked = (assignmentStatus: string | null | undefined) => assignmentStatus === "published";

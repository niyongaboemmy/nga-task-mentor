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

/** `submissions.grade` is TEXT ("7" or, from the grading workspace, "7/10"); a number when it holds one. */
export function gradeNumber(grade: unknown): number | null {
  if (grade === null || grade === undefined || grade === "") return null;
  const n = Number(String(grade).split("/")[0].trim());
  return Number.isFinite(n) ? n : null;
}

export interface ProjectEventLike {
  id?: number | string;
  type: string;
  data?: Record<string, unknown> | string | null;
  created_at: Date | string;
}

/**
 * The teacher's latest "Return for changes" on this assignment that the
 * student hasn't answered with a new hand-in yet: the newest of the project's
 * `returned` (data.assignment_id) and `submitted` (data.activity_id, an
 * assignment link) events for it, when that is a return. Null otherwise.
 */
export function pendingReturn(
  events: ProjectEventLike[],
  assignmentId: number,
): { returned_at: string; returned_message: string | null } | null {
  let latest: { e: ProjectEventLike; data: Record<string, any> } | null = null;
  for (const e of events) {
    const data = parseData(e.data);
    const forThis =
      (e.type === "returned" && Number(data.assignment_id) === assignmentId) ||
      (e.type === "submitted" && data.activity_type === "assignment" && Number(data.activity_id) === assignmentId);
    if (!forThis) continue;
    if (!latest || newer(e, latest.e)) latest = { e, data };
  }
  if (!latest || latest.e.type !== "returned") return null;
  const message = typeof latest.data.message === "string" && latest.data.message.trim() ? latest.data.message.trim() : null;
  return { returned_at: new Date(latest.e.created_at).toISOString(), returned_message: message };
}

const newer = (a: ProjectEventLike, b: ProjectEventLike) => {
  const ta = new Date(a.created_at).getTime();
  const tb = new Date(b.created_at).getTime();
  return ta !== tb ? ta > tb : Number(a.id ?? 0) > Number(b.id ?? 0);
};

function parseData(raw: ProjectEventLike["data"]): Record<string, any> {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      const v = JSON.parse(raw);
      return v && typeof v === "object" ? v : {};
    } catch {
      return {};
    }
  }
  return raw as Record<string, any>;
}

/** Share live status can't be turned off while the workspace's assignment is open. */
export const presenceLocked = (assignmentStatus: string | null | undefined) => assignmentStatus === "published";

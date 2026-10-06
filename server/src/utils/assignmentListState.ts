/**
 * Where an assignment stands for one student, as the /assignments list shows
 * and filters it. Stored assignment status (published/completed) says what the
 * teacher did; this says what the student still has to do.
 */
export type StudentAssignmentState = "todo" | "submitted" | "graded" | "missed";

export const STUDENT_STATES: StudentAssignmentState[] = ["todo", "submitted", "graded", "missed"];

export function studentAssignmentState(
  assignment: { status: string; due_date: Date | string },
  submission: { status: string; grade?: string | null } | null,
  now: Date = new Date(),
): StudentAssignmentState {
  // A saved draft was never handed in.
  const handedIn = submission && submission.status !== "draft" ? submission : null;
  if (handedIn) {
    const graded = handedIn.status === "graded" || (handedIn.grade != null && handedIn.grade !== "");
    return graded ? "graded" : "submitted";
  }
  // Closed by the teacher, or past due, with nothing handed in. Late submission
  // is still possible while published, but the work is overdue all the same.
  if (assignment.status === "completed" || new Date(assignment.due_date).getTime() < now.getTime()) return "missed";
  return "todo";
}

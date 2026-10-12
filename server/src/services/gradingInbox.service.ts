import type { GradingQueueItem } from "./instructorOverview.service";

export interface GradingInboxItem {
  id: number;
  kind: "assignment" | "quiz" | string;
  title: string;
  subject: { id: number; name: string; code: string | null };
  to_grade: number;
  late: number;
  due_at: string | null;
  waiting_days: number;
  oldest_at: string | null;
  /** Code work is graded in Grading (files, Run, criteria). */
  code: boolean;
  /** The one place to grade it. */
  grade_url: string;
}

/**
 * The To grade list: the overview's grading queue (most waiting first), each
 * with where to grade it. Code assignments open Grading directly; quizzes
 * open their submissions (which lead into Grading for coding questions).
 */
export function gradingInboxItems(
  queue: GradingQueueItem[],
  codeAssignments: Set<number>,
  quizzesWithCode: Set<number>,
): GradingInboxItem[] {
  return queue.map((q) => {
    const isAssignment = q.kind === "assignment";
    const code = isAssignment ? codeAssignments.has(q.id) : quizzesWithCode.has(q.id);
    return {
      id: q.id,
      kind: q.kind,
      title: q.title,
      subject: { id: q.subject_id, name: q.subject_name, code: q.subject_code },
      to_grade: q.pending,
      late: q.late ?? 0,
      due_at: q.due_at ?? null,
      waiting_days: q.waiting_days,
      oldest_at: q.oldest_at,
      code,
      grade_url: isAssignment && code ? `/grading/assignment/${q.id}` : q.url,
    };
  });
}

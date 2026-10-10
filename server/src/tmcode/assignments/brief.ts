/**
 * What a student is told about how an assignment is graded and until when it
 * takes work (UX gap review 2026-10-10, S2 and S6). Pure, shared by the
 * assignments API and its tests.
 */
import { isReadOnlyStatus } from "./state";
import { RubricScore, rubricScoresWithComments } from "../practical/criteriaNotes";

/** One rubric criterion as the API sends it. */
export interface RubricCriterion {
  criteria: string;
  description: string | null;
  max_score: number;
}

/**
 * `assignments.rubric` (JSON text or an array; anything else is no rubric) as
 * a typed list. Rows without a criterion name are dropped; a missing or bad
 * max score becomes 0.
 */
export function typedRubric(raw: unknown): RubricCriterion[] {
  let value: unknown = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  return value
    .filter((c: any) => c && typeof c === "object" && String(c.criteria ?? "").trim())
    .map((c: any) => {
      const max = Number(c.max_score);
      const description = typeof c.description === "string" && c.description.trim() ? c.description : null;
      return { criteria: String(c.criteria).trim(), description, max_score: Number.isFinite(max) ? max : 0 };
    });
}

/**
 * The per-criterion scores and comments the student may see: only once the
 * work is graded (the same moment `grade` and `feedback` become visible), and
 * null when the teacher graded without the rubric.
 */
export function studentRubricScores(
  submission: { status?: string | null; rubric_scores?: unknown; feedback?: string | null } | null | undefined,
  rubric: RubricCriterion[],
): Required<RubricScore>[] | null {
  if (!submission || submission.status !== "graded") return null;
  const scores = rubricScoresWithComments(submission.rubric_scores, submission.feedback, rubric);
  if (!scores || scores.length === 0) return null;
  return scores.map((s) => ({
    index: s.index,
    score: s.score,
    comment: s.comment?.trim() ? s.comment.trim() : null,
  }));
}

/**
 * Until when an assignment takes hand-ins. A TMCode hand-in (POST
 * /projects/:id/links/:linkId/submit) is refused only once the teacher
 * closes the assignment (status completed, or no longer published); after
 * the due date it is accepted and marked late. There is no scheduled close
 * date, so `accepts_late_until` is null and `late_policy` says why.
 */
export interface SubmissionWindow {
  /** Hand-ins are accepted right now (late or not). */
  accepts_submissions: boolean;
  /** "until_closed": work after the due date is accepted, marked late, until the teacher closes it. */
  late_policy: "until_closed";
  /** A fixed last moment for late work; null = no fixed date (until the teacher closes the assignment). */
  accepts_late_until: string | null;
}

export function submissionWindow(status: string | null | undefined): SubmissionWindow {
  return {
    accepts_submissions: status === "published" && !isReadOnlyStatus(status),
    late_policy: "until_closed",
    accepts_late_until: null,
  };
}

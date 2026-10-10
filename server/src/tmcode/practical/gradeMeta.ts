import crypto from "crypto";
import { z } from "zod";
import type { RubricScore } from "./criteriaNotes";

/**
 * Practical grades beyond the score: line annotations, draft vs released,
 * who graded and when, and an opaque version for stale-write checks
 * (UX gap review G1, G4, G8, G13). No migration: the extra data lives in
 * JSON columns students never receive.
 *
 *  - Assignments: `submissions.project_ref.grading` (project_ref is not mapped
 *    by the Submission model, so no web or student endpoint returns it). A
 *    DRAFT never touches grade / feedback / rubric_scores / status, which is
 *    what every student view reads; releasing copies the draft there.
 *  - Quiz practicals: `quiz_attempts.grading_details.draft` (students get
 *    grading_details only through studentGradingDetails, a whitelist) and
 *    `grading_details.manual` for the released grade, as before.
 */

export interface Annotation {
  path: string;
  line: number;
  text: string;
}

export const annotationSchema = z.object({
  path: z.string().trim().min(1).max(260),
  line: z.number().int().min(1).max(1_000_000),
  text: z.string().trim().min(1).max(2000),
});
export const annotationsSchema = z.array(annotationSchema).max(500);

/** A saved-but-not-released grade. */
export interface DraftGrade {
  score: number;
  rubric_scores: RubricScore[];
  /** As the student would read it (assignments: composed with the criteria notes). */
  feedback: string;
  annotations: Annotation[];
  by: number;
  at: string;
}

/** submissions.project_ref.grading */
export interface AssignmentGradeMeta {
  draft?: DraftGrade | null;
  /** Annotations of the released grade. */
  annotations?: Annotation[];
  graded_by?: number | null;
  graded_at?: string | null;
  /** Fingerprint of grade + feedback when released: tells a later web re-grade apart. */
  fp?: string | null;
  /** Every save (draft or release), so the version changes even when nothing else does. */
  saved_at?: string | null;
  /** The released grade that "Allow resubmission" took back. */
  previous?: { grade: string | null; feedback: string | null; rubric_scores: unknown; graded_by: number | null; graded_at: string | null; at: string } | null;
}

export function parseJson<T = any>(v: unknown): T | null {
  if (v == null) return null;
  if (typeof v === "string") {
    try {
      return JSON.parse(v) as T;
    } catch {
      return null;
    }
  }
  return v as T;
}

const sha = (s: string) => crypto.createHash("sha1").update(s).digest("hex");

/** Opaque version of whatever grade state the inputs describe. */
export function versionOf(parts: unknown[]): string {
  return sha(JSON.stringify(parts)).slice(0, 16);
}

/** The version of "no grade row yet". */
export const NO_GRADE_VERSION = "0";

export const gradeFingerprint = (grade: string | null | undefined, feedback: string | null | undefined) =>
  sha(`${grade ?? ""}\n${feedback ?? ""}`).slice(0, 12);

/** project_ref.grading, or {} */
export function assignmentMeta(projectRef: unknown): AssignmentGradeMeta {
  const ref = parseJson<Record<string, any>>(projectRef);
  const g = ref && typeof ref === "object" ? ref.grading : null;
  return g && typeof g === "object" ? (g as AssignmentGradeMeta) : {};
}

/** project_ref with its `grading` replaced (the hand-in fields kept). */
export function withMeta(projectRef: unknown, meta: AssignmentGradeMeta): string {
  const ref = parseJson<Record<string, any>>(projectRef);
  const base = ref && typeof ref === "object" && !Array.isArray(ref) ? ref : {};
  return JSON.stringify({ ...base, grading: meta });
}

/** Did this project_ref come from a hand-in (not only grading data)? */
export const isHandIn = (projectRef: unknown) => {
  const ref = parseJson<Record<string, any>>(projectRef);
  return !!ref && typeof ref === "object" && ref.project_id != null;
};

export const cleanAnnotations = (v: unknown): Annotation[] =>
  Array.isArray(v)
    ? v
        .filter((a) => a && typeof a.path === "string" && Number.isFinite(Number(a.line)) && typeof a.text === "string")
        .map((a) => ({ path: String(a.path), line: Number(a.line), text: String(a.text) }))
    : [];

/** One-line explanations of the TMCode exam flags, for teachers. */
export const FLAG_EXPLANATIONS: Record<string, string> = {
  journal_tampered:
    "A saved snapshot didn't match its signature: the work record may have been edited outside TMCode. Check the answer by hand.",
  offline_final_late:
    "The final answer was saved offline after the deadline (or arrived after the offline grace). It was not accepted as on time.",
  // Not stored as a flag: derived from the latest heartbeat (focus "out").
  focus_out: "TMCode isn't the window in front right now: the student switched to another app.",
};

export const flagExplanation = (rule: string) =>
  FLAG_EXPLANATIONS[rule] ?? "TMCode recorded this event for you to review.";

/**
 * The line annotations a student may see on an assignment grade: those of the
 * released grade, only while that grade is still the one stored (a later
 * web re-grade without annotations hides them). Never a draft's.
 */
export function releasedAnnotations(row: { status?: string | null; grade?: string | null; feedback?: string | null; project_ref?: unknown }): Annotation[] {
  if (row.status !== "graded") return [];
  const meta = assignmentMeta(row.project_ref);
  if (!meta.fp || meta.fp !== gradeFingerprint(row.grade ?? null, row.feedback ?? null)) return [];
  return cleanAnnotations(meta.annotations);
}

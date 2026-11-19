import type { ReportCardStatus } from "../models/ReportCard.model";

/**
 * The report card state machine (docs/REPORTS_AND_REPORT_CARD_REVIEW.md §6).
 * Pure: the controller loads the facts, this decides.
 *
 *   draft ──review──▶ reviewed ──approve──▶ approved ──publish──▶ published
 *     ▲                  │                     │  ▲                  │
 *     └──────return──────┘                     │  └────unpublish─────┘
 *     ▲                                        │                     │
 *     └────────────────reopen──────────────────┴─────────────────────┘
 *
 * Only a draft card can be edited. Approval freezes a snapshot; the only way
 * back to editing is reopen (approved/published) or return (reviewed), both
 * with a reason.
 */

export type WorkflowAction = "review" | "return" | "approve" | "publish" | "unpublish" | "reopen";

export const WORKFLOW_ACTIONS: WorkflowAction[] = ["review", "return", "approve", "publish", "unpublish", "reopen"];

interface ActionRule {
  from: ReportCardStatus[];
  to: ReportCardStatus;
  /** The capability that may take this action (v2 scoped over the student). */
  capability: string;
  reasonRequired: boolean;
  label: string;
}

export const ACTION_RULES: Record<WorkflowAction, ActionRule> = {
  review: { from: ["draft"], to: "reviewed", capability: "REPORT_CARDS_REVIEW", reasonRequired: false, label: "Review" },
  return: { from: ["reviewed"], to: "draft", capability: "REPORT_CARDS_REVIEW|REPORT_CARDS_APPROVE", reasonRequired: true, label: "Return to draft" },
  approve: { from: ["reviewed"], to: "approved", capability: "REPORT_CARDS_APPROVE", reasonRequired: false, label: "Approve" },
  publish: { from: ["approved"], to: "published", capability: "REPORT_CARDS_PUBLISH", reasonRequired: false, label: "Publish" },
  unpublish: { from: ["published"], to: "approved", capability: "REPORT_CARDS_PUBLISH", reasonRequired: true, label: "Unpublish" },
  reopen: { from: ["approved", "published"], to: "draft", capability: "REPORT_CARDS_APPROVE", reasonRequired: true, label: "Reopen to draft" },
};

/** Statuses whose content is frozen in a snapshot. */
export const FROZEN_STATUSES: ReportCardStatus[] = ["approved", "published"];

export const isEditable = (status: ReportCardStatus | string | null | undefined) => !status || status === "draft";
export const isFrozen = (status: ReportCardStatus | string | null | undefined) =>
  status === "approved" || status === "published";
/** What students and parents may see. */
export const isVisibleToStudent = (status: ReportCardStatus | string | null | undefined) => status === "published";

/** What a card still lacks before it can be reviewed. */
export interface ReadinessFacts {
  /** Subjects on the card (taught to the class) that are not submitted by their teacher. */
  unsubmitted_subjects: Array<{ subject_id: number; name: string }>;
  /** Subjects with no mapped assessment at all for this card. */
  empty_subjects: Array<{ subject_id: number; name: string }>;
  /** Mapped marks neither recorded nor resolved absent/exempt. */
  missing_marks: number;
  has_comment: boolean;
  attributes_rated: number;
  attributes_expected: number;
  attendance_days: number;
}

export type BlockerCode =
  | "SUBJECT_NOT_SUBMITTED"
  | "SUBJECT_EMPTY"
  | "MISSING_MARKS"
  | "NO_COMMENT"
  | "ATTRIBUTES_INCOMPLETE"
  | "NO_ATTENDANCE";

export interface Blocker {
  code: BlockerCode;
  message: string;
}

/** Codes that warn but never block a review (the school's card prints subjects with no marks). */
export const WARNING_CODES: BlockerCode[] = ["SUBJECT_EMPTY", "NO_ATTENDANCE"];

const listNames = (list: Array<{ name: string }>) => {
  const shown = list.slice(0, 3).map((s) => s.name).join(", ");
  return list.length > 3 ? `${shown} and ${list.length - 3} more` : shown;
};

/** Everything a draft card still lacks, blocking or not. */
export function readinessIssues(f: ReadinessFacts): Blocker[] {
  const out: Blocker[] = [];
  if (f.unsubmitted_subjects.length) {
    out.push({ code: "SUBJECT_NOT_SUBMITTED", message: `Marks not submitted: ${listNames(f.unsubmitted_subjects)}` });
  }
  if (f.missing_marks > 0) {
    out.push({
      code: "MISSING_MARKS",
      message: `${f.missing_marks} mark${f.missing_marks === 1 ? "" : "s"} not recorded (record it, or mark absent/exempt)`,
    });
  }
  if (!f.has_comment) out.push({ code: "NO_COMMENT", message: "Class teacher's comment is empty" });
  if (f.attributes_rated < f.attributes_expected) {
    out.push({
      code: "ATTRIBUTES_INCOMPLETE",
      message: `${f.attributes_rated} of ${f.attributes_expected} attributes rated`,
    });
  }
  if (f.empty_subjects.length) {
    out.push({ code: "SUBJECT_EMPTY", message: `No assessments mapped: ${listNames(f.empty_subjects)}` });
  }
  if (f.attendance_days <= 0) out.push({ code: "NO_ATTENDANCE", message: "Attendance not recorded" });
  return out;
}

/** Why a draft card can't be reviewed yet (empty = ready). */
export const reviewBlockers = (f: ReadinessFacts): Blocker[] =>
  readinessIssues(f).filter((b) => !WARNING_CODES.includes(b.code));

/** What is worth fixing but doesn't stop a review. */
export const reviewWarnings = (f: ReadinessFacts): Blocker[] =>
  readinessIssues(f).filter((b) => WARNING_CODES.includes(b.code));

export type TransitionCheck =
  | { ok: true; to: ReportCardStatus }
  | { ok: false; code: "INVALID_TRANSITION" | "REASON_REQUIRED" | "NOT_READY" | "SAME_PERSON"; message: string; blockers?: Blocker[] };

/**
 * May `action` be taken on a card in `from`? Permission is checked by the
 * caller; this checks the state, the reason, readiness (review) and the
 * four-eyes rule (approve).
 */
export function checkTransition(
  action: WorkflowAction,
  from: ReportCardStatus,
  opts: {
    reason?: string | null;
    readiness?: ReadinessFacts | null;
    actorId?: number | null;
    reviewedBy?: number | null;
    requireDistinctApprover?: boolean;
  } = {},
): TransitionCheck {
  const rule = ACTION_RULES[action];
  if (!rule) return { ok: false, code: "INVALID_TRANSITION", message: `Unknown action '${action}'` };
  if (!rule.from.includes(from)) {
    return {
      ok: false,
      code: "INVALID_TRANSITION",
      message: `Can't ${rule.label.toLowerCase()} a ${from} card (only ${rule.from.join(" or ")})`,
    };
  }
  if (rule.reasonRequired && !(opts.reason ?? "").trim()) {
    return { ok: false, code: "REASON_REQUIRED", message: `A reason is required to ${rule.label.toLowerCase()}` };
  }
  if (action === "review" && opts.readiness) {
    const blockers = reviewBlockers(opts.readiness);
    if (blockers.length) return { ok: false, code: "NOT_READY", message: blockers[0].message, blockers };
  }
  if (
    action === "approve" &&
    opts.requireDistinctApprover &&
    opts.actorId != null &&
    opts.reviewedBy != null &&
    opts.actorId === opts.reviewedBy
  ) {
    return { ok: false, code: "SAME_PERSON", message: "The card must be approved by someone other than its reviewer" };
  }
  return { ok: true, to: rule.to };
}

/** The actions available from a status (UI hints; permission still applies). */
export const actionsFrom = (status: ReportCardStatus): WorkflowAction[] =>
  WORKFLOW_ACTIONS.filter((a) => ACTION_RULES[a].from.includes(status));

/**
 * Legacy PATCH /:id/status bodies, mapped onto actions. "saved" was "marked
 * complete" (now: review); "approved" from a reviewed card approves and,
 * because approval used to mean visible, also publishes.
 */
export function legacyStatusToActions(from: ReportCardStatus, status: string): WorkflowAction[] | null {
  if (status === from) return [];
  if (status === "saved" || status === "reviewed") return from === "draft" ? ["review"] : null;
  if (status === "draft") return from === "reviewed" ? ["return"] : from === "approved" || from === "published" ? ["reopen"] : null;
  if (status === "approved") return from === "reviewed" ? ["approve"] : from === "published" ? ["unpublish"] : null;
  if (status === "published") return from === "reviewed" ? ["approve", "publish"] : from === "approved" ? ["publish"] : null;
  return null;
}

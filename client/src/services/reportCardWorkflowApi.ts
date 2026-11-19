import axios from "../utils/axiosConfig";
import type { GradeBand } from "./reportCardApi";

/**
 * Report card workflow API (server: controllers/reportCardWorkflow.controller.ts,
 * controllers/reportAnalytics.controller.ts):
 *   draft -> reviewed -> approved -> published; only a draft can be edited.
 */

export type CardStatus = "draft" | "reviewed" | "approved" | "published";
export type WorkflowAction = "review" | "return" | "approve" | "publish" | "unpublish" | "reopen";

export const ACTION_LABEL: Record<WorkflowAction, string> = {
  review: "Mark reviewed",
  return: "Return to draft",
  approve: "Approve",
  publish: "Publish",
  unpublish: "Unpublish",
  reopen: "Reopen to draft",
};
/** Actions that need a reason (the server refuses them without one). */
export const REASON_ACTIONS: WorkflowAction[] = ["return", "unpublish", "reopen"];
/** Which status each action applies to. */
export const ACTION_FROM: Record<WorkflowAction, CardStatus[]> = {
  review: ["draft"],
  return: ["reviewed"],
  approve: ["reviewed"],
  publish: ["approved"],
  unpublish: ["published"],
  reopen: ["approved", "published"],
};

export interface Blocker {
  code: string;
  message: string;
}

export interface TransitionResult {
  report_card_id: number;
  student_id: number | null;
  ok: boolean;
  status: CardStatus | null;
  code?: string;
  message?: string;
  blockers?: Blocker[];
  scheduled_for?: string | null;
}

export interface TransitionResponse {
  success: boolean;
  message: string;
  data: { action: WorkflowAction; ok: number; failed: number; results: TransitionResult[] };
}

// ─── Cycles (class x term) ───────────────────────────────────────────────────

export interface CycleSettings {
  marks_due_at: string | null;
  review_due_at: string | null;
  publish_at: string | null;
  next_term_begins_on: string | null;
}

export interface CallerCan {
  review: boolean;
  approve: boolean;
  publish: boolean;
  edit_settings: boolean;
}

export interface CycleRow {
  class_group_id: number;
  name: string;
  grade_name: string | null;
  program_name: string | null;
  students: number;
  counts: { draft: number; reviewed: number; approved: number; published: number; not_started: number };
  subjects_total: number;
  subjects_submitted: number;
  i_teach: boolean;
  cycle: CycleSettings | null;
}

export interface CyclesResponse {
  success: boolean;
  data: { term: string; academic_year: string; classes: CycleRow[]; can: CallerCan };
}

export interface WorkbenchSubject {
  subject_id: number;
  name: string;
  teachers: string[];
  i_teach: boolean;
  mapped_cards: number;
  /** Cards in the class (mapped_cards of total_cards have this subject mapped). */
  total_cards?: number;
  missing_marks: number;
  signoff: { status: "open" | "submitted"; submitted_by: string | null; submitted_at: string | null; returned_reason: string | null };
}

export interface WorkbenchStudent {
  student_id: number;
  name: string;
  registration_number: string | null;
  gender: string | null;
  card: {
    id: number;
    uuid: string;
    status: CardStatus;
    version: number;
    reviewed_at: string | null;
    approved_at: string | null;
    published_at: string | null;
    publish_at: string | null;
    returned_reason: string | null;
    editable: boolean;
  };
  subjects: Record<number, { total: number | null; missing: number }>;
  average: number | null;
  has_comment: boolean;
  attributes_rated: number;
  attendance_days: number;
  attendance_source: "manual" | "imported";
  blockers: Blocker[];
  warnings: Blocker[];
  changed_since_approval: number;
  actions: WorkflowAction[];
}

export interface WorkbenchData {
  class_group: { id: number; name: string; grade_name: string | null; program_name: string | null };
  term: string;
  academic_year: string;
  cycle: CycleSettings & { id: number };
  scheme: { attributes: string[]; pass_mark: number; require_distinct_approver: boolean };
  subjects: WorkbenchSubject[];
  students: WorkbenchStudent[];
  counts: { draft: number; reviewed: number; approved: number; published: number; scheduled: number; ready: number };
  blockers: Array<{ code: string; students: number; example: string }>;
  can: CallerCan;
  roster_complete: boolean;
}

export interface MissingMark {
  student_id: number;
  name: string;
  report_card_id: number;
  assessment_type: "quiz" | "assignment" | "manual";
  assessment_id: number;
  title: string;
  category: string;
}

export interface HistoryData {
  report_card_id: number;
  status: CardStatus;
  version: number;
  returned_reason: string | null;
  publish_at: string | null;
  transitions: Array<{
    id: number;
    action: string;
    from_status: string;
    to_status: string;
    version: number | null;
    actor_name: string | null;
    reason: string | null;
    at: string;
  }>;
  versions: Array<{
    version: number;
    approved_at: string;
    sha256: string | null;
    superseded_at: string | null;
    superseded_reason: string | null;
    backfilled: boolean;
  }>;
}

export interface DiffData {
  frozen: boolean;
  version?: number;
  approved_at?: string;
  changes: Array<{ subject_id: number; name: string; approved: number | null; now: number | null }>;
}

// ─── Scheme ──────────────────────────────────────────────────────────────────

export interface ReportCardScheme {
  category_weights: { CW: number; HW: number; MD: number; EOT: number };
  pass_mark: number;
  attributes: string[];
  subject_groups: Array<{ name: string; subject_ids: number[] }>;
  show_position: boolean;
  show_class_average: boolean;
  show_subject_teacher: boolean;
  head_title: string;
  require_distinct_approver: boolean;
}

/** The scale on NGA's issued cards (A* 90-100 ... U 0-19). */
export const NGA_BANDS: GradeBand[] = [
  { min: 90, letter: "A*", remark: "Outstanding" },
  { min: 80, letter: "A", remark: "Excellent" },
  { min: 70, letter: "B", remark: "Very good" },
  { min: 60, letter: "C", remark: "Good" },
  { min: 50, letter: "D", remark: "Satisfactory" },
  { min: 40, letter: "E", remark: "Fair" },
  { min: 30, letter: "F", remark: "Weak" },
  { min: 20, letter: "G", remark: "Poor" },
  { min: 0, letter: "U", remark: "Ungraded" },
];

// ─── School reports ──────────────────────────────────────────────────────────

export type Gender = "female" | "male" | "unknown";

export interface Stat {
  n: number;
  mean: number | null;
  median: number | null;
  sd: number | null;
  min: number | null;
  max: number | null;
  pass_rate: number | null;
}
export type Distribution = Array<{ letter: string; min: number; count: number }>;

export interface SchoolReports {
  term: string;
  academic_year: string;
  class_group_id: number | null;
  basis: "issued" | "issued_and_drafts";
  provisional: boolean;
  drafts_included: number;
  truncated: boolean;
  pass_mark: number;
  bands: GradeBand[];
  classes: Array<{ id: number; name: string; program_name: string | null }>;
  students: number;
  with_marks: number;
  performance: {
    overall: Stat & { distribution: Distribution };
    subjects: Array<Stat & { subject_id: number; name: string; distribution: Distribution }>;
    classes: Array<Stat & { class_group_id: number | null; name: string; program_name: string | null; students: number; at_risk: number }>;
    hardest_subjects: Array<Stat & { subject_id: number; name: string }>;
  };
  gender: {
    overall: Record<Gender, Stat & { students: number; distribution: Distribution }>;
    gap: number | null;
    pass_rate_gap: number | null;
    subjects: Array<{ subject_id: number; name: string; female: Stat; male: Stat; unknown: Stat; gap: number | null }>;
    classes: Array<{
      class_group_id: number | null;
      name: string;
      female: Stat & { students: number };
      male: Stat & { students: number };
      unknown: Stat & { students: number };
      gap: number | null;
    }>;
    unknown_count: number;
  };
  trends: {
    terms: string[];
    overall: Array<Stat & { term: string }>;
    subjects: Array<{ subject_id: number; name: string; terms: Array<{ term: string; mean: number | null; n: number }> }>;
    classes: Array<{ class_group_id: number | null; name: string; terms: Array<{ term: string; mean: number | null; n: number }> }>;
    improvement: Array<{ student_id: number; name: string; class_name: string | null; previous: number; current: number; change: number }>;
    previous_term: string | null;
  };
  at_risk: Array<{
    student_id: number;
    name: string;
    gender: Gender;
    class_name: string | null;
    average: number | null;
    failed_subjects: string[];
    attendance_rate: number | null;
    reasons: string[];
    severity: "high" | "medium";
  }>;
  broadsheet: {
    subjects: Array<{ subject_id: number; name: string }>;
    students: Array<{
      student_id: number;
      name: string;
      registration_number: string | null;
      gender: Gender;
      class_name: string | null;
      status: string;
      subjects: Record<number, number>;
      total: number;
      average: number | null;
      grade: string | null;
      position: number | null;
      position_of: number | null;
      passed: number;
      failed: number;
      attendance_rate: number | null;
    }>;
    subject_stats: Array<{ subject_id: number; mean: number | null; max: number | null; min: number | null; pass_rate: number | null }>;
  };
}

// ─── Calls ───────────────────────────────────────────────────────────────────

export const ReportCardWorkflowApi = {
  async transition(body: {
    card_ids: number[];
    action: WorkflowAction;
    reason?: string | null;
    publish_at?: string | null;
    reopen_subject_ids?: number[];
  }): Promise<TransitionResponse> {
    // A refused batch answers 409 with the same body; hand it back either way.
    try {
      return (await axios.post("/report-cards/transition", body)).data;
    } catch (e: unknown) {
      const r = (e as ApiError).response;
      if (r?.status === 409 && (r.data?.data as { results?: unknown } | undefined)?.results) return r.data as unknown as TransitionResponse;
      throw e;
    }
  },
  async cycles(params: { term: string; academic_year: string }): Promise<CyclesResponse> {
    return (await axios.get("/report-cycles", { params })).data;
  },
  async workbench(params: { class_group_id: number; term: string; academic_year: string }): Promise<{ success: boolean; data: WorkbenchData }> {
    return (await axios.get("/report-cycles/workbench", { params })).data;
  },
  async saveSettings(body: { class_group_ids: number[]; term: string; academic_year: string } & Partial<CycleSettings>) {
    return (await axios.put("/report-cycles/settings", body)).data as { success: boolean; message: string };
  },
  async signoffPreview(params: { class_group_id: number; subject_id: number; term: string; academic_year: string }) {
    return (await axios.get("/report-cycles/signoff/preview", { params })).data as {
      success: boolean;
      data: { status: "open" | "submitted"; returned_reason: string | null; locked_cards: number; missing: MissingMark[] };
    };
  },
  /** Submit (with absent/exempt resolutions) or reopen a subject's marks for a class. 409 carries the still-missing list. */
  async signoff(body: {
    class_group_id: number;
    subject_id: number;
    term: string;
    academic_year: string;
    action: "submit" | "reopen";
    reason?: string;
    resolutions?: Array<{ report_card_id: number; assessment_type: string; assessment_id: number; status: "absent" | "exempt" }>;
  }) {
    return (await axios.post("/report-cycles/signoff", body)).data as { success: boolean; message: string };
  },
  async importAttendance(body: { class_group_id: number; term: string; academic_year: string }) {
    return (await axios.post("/report-cycles/attendance/import", body)).data as {
      success: boolean;
      message: string;
      data: { updated: number; locked: number; received: number };
    };
  },
  async history(cardId: number): Promise<{ success: boolean; data: HistoryData }> {
    return (await axios.get(`/report-cards/${cardId}/history`)).data;
  },
  async diff(cardId: number): Promise<{ success: boolean; data: DiffData }> {
    return (await axios.get(`/report-cards/${cardId}/diff`)).data;
  },
  async scheme(): Promise<{ success: boolean; data: { scheme: ReportCardScheme; bands: GradeBand[] } }> {
    return (await axios.get("/report-cards/scheme")).data;
  },
  async saveScheme(scheme: ReportCardScheme): Promise<{ success: boolean; data: { scheme: ReportCardScheme } }> {
    return (await axios.put("/report-cards/scheme", { scheme })).data;
  },
  async saveBands(bands: GradeBand[]): Promise<{ success: boolean; bands: GradeBand[] }> {
    return (await axios.put("/settings/grading", { bands })).data;
  },
  async schoolReports(params: {
    term: string;
    academic_year: string;
    class_group_id?: number | null;
    include_drafts?: boolean;
    fresh?: boolean;
  }): Promise<{ success: boolean; data: SchoolReports }> {
    return (
      await axios.get("/reports/school", {
        params: {
          term: params.term,
          academic_year: params.academic_year,
          ...(params.class_group_id ? { class_group_id: params.class_group_id } : {}),
          ...(params.include_drafts ? { include_drafts: 1 } : {}),
          ...(params.fresh ? { fresh: 1 } : {}),
        },
      })
    ).data;
  },
};

/** The server's message from an axios error, else `fallback`. */
/** The shape of an axios error body the server sends. */
export type ApiError = { response?: { status?: number; data?: { message?: string; code?: string; data?: unknown } } };

export const apiMessage = (e: unknown, fallback: string): string => (e as ApiError)?.response?.data?.message || fallback;

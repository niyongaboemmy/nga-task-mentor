import axios from "../utils/axiosConfig";
import type { BuilderStructure, GradeBand, ReportCardBuilderKind } from "./reportCardApi";

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
  /** May write class-teacher comments / rate attributes (older servers omit it). */
  comment?: boolean;
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
  /** RTB module code and category, and the mark needed to be Competent. */
  code?: string | null;
  category?: "specific" | "general" | "complementary" | null;
  threshold?: number;
  teachers: string[];
  i_teach: boolean;
  mapped_cards: number;
  /** Cards in the class (mapped_cards of total_cards have this subject mapped). */
  total_cards?: number;
  missing_marks: number;
  signoff: { status: "open" | "submitted"; submitted_by: string | null; submitted_at: string | null; returned_reason: string | null };
}

/** One student's mark in one module, as the workbench shows it. */
export interface WorkbenchCell {
  /** Mark out of 100 over the work assessed so far (points / covered x 100). */
  total: number | null;
  /** Marks mapped but not recorded (and not marked absent/exempt). */
  missing: number;
  /** How many of the term's 100 points are assessed (CW+HW+MD+EOT weights that have marks). */
  covered?: number | null;
  /** Points earned out of `covered`. */
  points?: number | null;
  /** Points per category (out of its weight); null = no marks in that category yet. */
  /** Scaled points per category of the school's builder (Normal CW/HW/MD/EOT, TVET FA/CA/IA as %). */
  categories?: Record<string, number | null> | null;
  competent?: boolean | null;
  /** The assessments behind `missing`: what still needs a mark, and where to record it. */
  missing_items?: WorkbenchMissingItem[];
}

export interface WorkbenchMissingItem {
  assessment_type: "quiz" | "assignment" | "manual" | string;
  assessment_id: number;
  category: string;
  title: string;
  href: string | null;
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
  /** total: mark out of 100 over the assessed work; covered: weight (of 100) that has marks. */
  subjects: Record<number, WorkbenchCell>;
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
  scheme: {
    attributes: string[];
    pass_mark: number;
    require_distinct_approver: boolean;
    category_weights?: { CW: number; HW: number; MD: number; EOT: number };
    builder?: ReportCardBuilderKind;
    structure?: BuilderStructure;
    competence_thresholds?: { specific: number; general: number; complementary: number };
  };
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

/** TVET template options (server services/tenantSettings.ts TvetTemplateOptions). */
export interface TvetTemplateOptions {
  district: string;
  sector: string;
  school_email: string;
  school_phone: string;
  headmaster_name: string;
  qualification_title: string;
  default_module_weight: number;
  module_weights: Record<string, number>;
  show_attendance: boolean;
  show_attributes: boolean;
}

export const DEFAULT_TVET_OPTIONS: TvetTemplateOptions = {
  district: "",
  sector: "",
  school_email: "",
  school_phone: "",
  headmaster_name: "",
  qualification_title: "",
  default_module_weight: 100,
  module_weights: {},
  show_attendance: false,
  show_attributes: false,
};

export interface TemplateModule {
  id: number;
  name: string;
  code: string | null;
  category: "specific" | "general" | "complementary" | null;
  learning_hours: number | null;
  rqf_level: string | null;
  override: number | null;
}

/** The school's identity block as MIS keeps it (this tenant's School). */
export interface SchoolProfile {
  school_id: number | null;
  name: string | null;
  address: string | null;
  district: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  sector: string | null;
  trade: string | null;
  qualification_title: string | null;
  head_teacher_name: string | null;
  logo_url: string | null;
}
export type SchoolProfileField = "name" | "address" | "district" | "contact_email" | "contact_phone" | "sector" | "trade" | "qualification_title" | "head_teacher_name";

export interface ReportCardScheme {
  /** The school's builder (Normal / TVET); a save without it keeps the current one. */
  builder?: ReportCardBuilderKind;
  tvet?: TvetTemplateOptions;
  category_weights: { CW: number; HW: number; MD: number; EOT: number };
  pass_mark: number;
  attributes: string[];
  subject_groups: Array<{ name: string; subject_ids: number[] }>;
  show_position: boolean;
  show_class_average: boolean;
  show_subject_teacher: boolean;
  head_title: string;
  require_distinct_approver: boolean;
  /** Each module's position in the class. */
  show_subject_rank?: boolean;
  /** Competent / NYC per module (RTB). */
  show_competence?: boolean;
  /** Mark (out of 100) a module needs to be Competent, by RTB category. */
  competence_thresholds?: { specific: number; general: number; complementary: number };
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
  /** Every card of the class in one PDF, ranking order: ranking cover + one card per page. */
  async classPdf(params: { class_group_id: number; term: string; academic_year: string }): Promise<Blob> {
    try {
      return (await axios.get("/report-cycles/class-pdf", { params, responseType: "blob" })).data as Blob;
    } catch (e) {
      // A blob error body hides the server's message: read it back out.
      const data = (e as { response?: { data?: unknown } })?.response?.data;
      if (data instanceof Blob) {
        try {
          const body = JSON.parse(await data.text()) as { message?: string };
          if (body?.message) throw new Error(body.message);
        } catch (inner) {
          if (inner instanceof Error && inner.message && !(inner instanceof SyntaxError)) throw inner;
        }
      }
      throw e;
    }
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
  async saveScheme(scheme: Partial<ReportCardScheme>): Promise<{ success: boolean; data: { scheme: ReportCardScheme } }> {
    return (await axios.put("/report-cards/scheme", { scheme })).data;
  },
  /** The builder the school chose and its mapping categories (any signed-in user). */
  async structure(): Promise<{
    success: boolean;
    data: { builder: ReportCardBuilderKind; structure: BuilderStructure; competence_thresholds: { specific: number; general: number; complementary: number }; pass_mark: number };
  }> {
    return (await axios.get("/report-cards/structure")).data;
  },
  /** The school's identity block from MIS; can_edit = the caller may change it there (Manage schools). */
  async templateSchool(fresh = false): Promise<{ success: boolean; data: { profile: SchoolProfile | null; can_edit: boolean; source: "mis" | "last" | "none" } }> {
    return (await axios.get("/report-cards/templates/school", { params: fresh ? { fresh: 1 } : {} })).data;
  },
  async saveTemplateSchool(patch: Partial<Record<SchoolProfileField, string | null>>): Promise<{ success: boolean; data: { profile: SchoolProfile } }> {
    return (await axios.put("/report-cards/templates/school", patch)).data;
  },
  /** Sets a module's weight on its MIS subject (null clears it). */
  async saveModuleWeight(subjectId: number, weight: number | null): Promise<{ success: boolean; data: { id: number; weight: number | null } }> {
    return (await axios.put(`/report-cards/templates/modules/${subjectId}/weight`, { weight })).data;
  },
  /** TVET: map this term's unmapped quizzes, assignments and recorded marks to FA (dry run counts them). */
  async mapFormative(dryRun = false): Promise<{
    success: boolean;
    data: { term: string; academic_year: string; scanned: number; already_mapped: number; mapped: number; by_kind: { quiz: number; assignment: number; manual: number }; subjects: number; cards_updated: number; dry_run: boolean };
  }> {
    return (await axios.post("/report-cards/templates/map-formative", { dry_run: dryRun })).data;
  },
  /** MIS modules with learning hours, for the TVET module-weight editor. */
  async templateModules(): Promise<{ success: boolean; data: { modules: TemplateModule[]; default_module_weight: number } }> {
    return (await axios.get("/report-cards/templates/modules")).data;
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

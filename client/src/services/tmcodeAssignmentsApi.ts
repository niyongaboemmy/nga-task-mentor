import type { ProjectStatus } from "./projectsApi";
import api from "../utils/axiosConfig";
import { normalizeProjectDetail, unwrap, type PresenceSummary, type ProjectDetail } from "./projectsApi";

/**
 * TMCode practicals and case studies (ASSIGNMENTS_PLAN.md): the web client of
 * /api/tmcode/assignments. Teachers set an assignment's TMCode settings (kind,
 * language, starter files, instructions); students open it in TMCode and
 * see their workspace; teachers follow every student's workspace.
 */

export type TmcodeKind = "practical" | "case_study";
export type WorkState = "not_started" | "in_progress" | "submitted" | "graded";

/** What GET /api/assignments/:id carries as `tmcode` (null = not a TMCode assignment). */
export interface TmcodeSettings {
  kind: TmcodeKind | null;
  language: string | null;
  starter_project_id: number | null;
  /** null = the starter's latest saved version at start time. */
  starter_revision_id: number | null;
  instructions: string | null;
}

export const EMPTY_TMCODE: TmcodeSettings = {
  kind: null,
  language: null,
  starter_project_id: null,
  starter_revision_id: null,
  instructions: null,
};

export interface MyWork {
  project_id: number | null;
  /** Stored status of the student's project (draft / submitted / graded / removed). */
  project_status?: ProjectStatus | null;
  link_id: number | null;
  state: WorkState;
  submitted_at: string | null;
  revision_number: number | null;
  grade: number | null;
  max_points: number;
  feedback: string | null;
}

export interface TeachingCounts {
  students: number;
  started: number;
  submitted: number;
  graded: number;
}

export interface AssignmentSummary {
  id: number;
  title: string;
  kind: TmcodeKind | null;
  course_id: number | null;
  course_name: string | null;
  status: "draft" | "published" | "completed" | "removed";
  due_date: string | null;
  points: number;
  language: string | null;
  read_only: boolean;
  late: boolean;
  my: MyWork | null;
  teaching?: TeachingCounts;
}

export interface AssignmentDetail extends AssignmentSummary {
  description_html: string;
  instructions: string | null;
  attachments: { name: string; url: string }[];
  rubric: { criteria: string; max_score: number; description?: string }[];
  starter: { project_id: number; revision_id: number | null; file_count: number; size_bytes: number } | null;
}

export interface WorkspaceUser {
  /** Local id; null for an enrolled student who never signed in to Task Mentor. */
  id: number | null;
  mis_user_id: number | null;
  name: string;
  email: string | null;
  avatar_url: string | null;
}

export interface WorkspaceRow {
  user: WorkspaceUser;
  project_id: number | null;
  project_status?: ProjectStatus | null;
  link_id: number | null;
  submission_id: number | null;
  state: WorkState;
  last_activity_at: string | null;
  /** null without a project; `shared: false` = "Live status not shared". */
  presence: (PresenceSummary & { shared: boolean }) | null;
  revision_id: number | null;
  revision_number: number | null;
  submitted_at: string | null;
  grade: number | null;
  max_points: number;
}

export interface WorkspacesView {
  assignment: {
    id: number;
    title: string;
    status: string;
    kind: TmcodeKind | null;
    course_id: number | null;
    due_date: string | null;
    points: number;
    read_only: boolean;
  };
  counts: TeachingCounts & { live: number };
  workspaces: WorkspaceRow[];
}

export const KIND_LABEL: Record<TmcodeKind, string> = {
  practical: "Practical",
  case_study: "Case study",
};

export const STATE_META: Record<WorkState, { label: string; tone: "slate" | "blue" | "emerald" | "violet" }> = {
  not_started: { label: "Not started", tone: "slate" },
  in_progress: { label: "Working", tone: "blue" },
  submitted: { label: "Submitted", tone: "violet" },
  graded: { label: "Graded", tone: "emerald" },
};

const BASE = "/tmcode/assignments";

export const tmcodeAssignmentsApi = {
  async list(scope: "student" | "teaching" = "student"): Promise<AssignmentSummary[]> {
    const res = await api.get(BASE, { params: { scope } });
    const data = unwrap<{ assignments?: AssignmentSummary[] }>(res.data);
    return Array.isArray(data?.assignments) ? data.assignments : [];
  },

  async get(id: number): Promise<AssignmentDetail> {
    const res = await api.get(`${BASE}/${id}`);
    return unwrap<{ assignment: AssignmentDetail }>(res.data).assignment;
  },

  async start(id: number): Promise<{ project: ProjectDetail; created: boolean }> {
    const res = await api.post(`${BASE}/${id}/start`);
    const data = unwrap<{ project: unknown; created: boolean }>(res.data);
    return { project: normalizeProjectDetail(data.project), created: !!data.created };
  },

  /** kind null turns TMCode off. */
  async setTmcode(id: number, settings: TmcodeSettings): Promise<AssignmentDetail> {
    const res = await api.put(`${BASE}/${id}/tmcode`, {
      kind: settings.kind,
      language: settings.language || null,
      starter_project_id: settings.starter_project_id,
      starter_revision_id: settings.starter_project_id ? settings.starter_revision_id : null,
      instructions: settings.instructions?.trim() ? settings.instructions : null,
    });
    return unwrap<{ assignment: AssignmentDetail }>(res.data).assignment;
  },

  async workspaces(id: number): Promise<WorkspacesView> {
    const res = await api.get(`${BASE}/${id}/workspaces`);
    return unwrap<WorkspacesView>(res.data);
  },

  /** `tmcode://assignment?id=…&api=…`, built by the server from its own origin. */
  async openLink(id: number): Promise<string> {
    const res = await api.get(`${BASE}/${id}/open-link`);
    const link = unwrap<{ deeplink?: string }>(res.data)?.deeplink;
    if (!link) throw new Error("No TMCode link in the response");
    return link;
  },
};

/** Same settings? (decides whether the form needs a PUT after saving). */
export const sameTmcode = (a: TmcodeSettings, b: TmcodeSettings): boolean =>
  a.kind === b.kind &&
  (a.kind === null ||
    ((a.language || null) === (b.language || null) &&
      a.starter_project_id === b.starter_project_id &&
      (a.starter_project_id ? a.starter_revision_id : null) === (b.starter_project_id ? b.starter_revision_id : null) &&
      (a.instructions?.trim() || null) === (b.instructions?.trim() || null)));

/** GET /api/assignments/:id's `tmcode` (or nothing) as form settings. */
export function tmcodeFromAssignment(raw: unknown): TmcodeSettings {
  const t = raw && typeof raw === "object" ? (raw as Partial<TmcodeSettings>) : null;
  if (!t?.kind) return { ...EMPTY_TMCODE };
  return {
    kind: t.kind,
    language: t.language ?? null,
    starter_project_id: t.starter_project_id ?? null,
    starter_revision_id: t.starter_revision_id ?? null,
    instructions: t.instructions ?? null,
  };
}

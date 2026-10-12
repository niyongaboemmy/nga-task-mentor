import api from "../utils/axiosConfig";
import { normalizeProjectDetail, unwrap, type ProjectDetail, type ProjectStatus } from "./projectsApi";

/**
 * TMCode practicals beyond assignments, and the grading workspace
 * (server: controllers/tmcodePracticals.controller.ts, /api/tmcode/...).
 */

export type PracticalActivity = "assignment" | "quiz";

export interface PracticalCriterion {
  criteria: string;
  description?: string | null;
  max_score: number;
}

export interface CriterionScore {
  index: number;
  score: number;
  comment?: string | null;
}

export interface GradingRow {
  student: { id: number; name: string; email?: string | null; avatar_url?: string | null } | null;
  state: "submitted" | "in_progress" | "graded" | "not_started";
  project: {
    id: number;
    name: string;
    status: ProjectStatus;
    kind: "tm" | "github";
    language: string | null;
    repo_url: string | null;
  } | null;
  link: {
    id: number;
    status: "linked" | "submitted";
    submitted_at: string | null;
    revision_id: number | null;
    revision_number: number | null;
    git_commit: string | null;
  } | null;
  grade: {
    score: number | null;
    rubric_scores: CriterionScore[] | null;
    feedback: string | null;
    graded_at: string | null;
    ref_id: number | null;
  } | null;
  submitted_at: string | null;
  late: boolean;
}

/** What the student was asked to do (the workspace's Details tab). */
export interface GradingBrief {
  /** Assignment description / quiz question text (rich HTML). */
  description: string | null;
  /** TMCode instructions shown beside the code. */
  instructions: string | null;
  language: string | null;
  kind: string | null;
  submission_type: string | null;
  attachments: { name: string; url: string; type?: string | null; size?: number | null }[];
  starter: { project_id: number; revision_id: number | null } | null;
  status: string | null;
  created_at: string | null;
}

/** What a revision can run (GET /projects/:id/run-targets). */
export interface RunTargets {
  revision: { id: number; number: number };
  engine: "judge0" | "tmjudge";
  /** The runner takes the entry file only (Judge0 CE). */
  single_file: boolean;
  language: string | null;
  languages: { key: string; label: string; files: number; runnable: boolean }[];
  runnable: boolean;
  /** Likely entry files, best first. */
  entries: string[];
  html_entry: string | null;
  has_package_json: boolean;
}

export type RunVerdict =
  | "accepted"
  | "wrong-answer"
  | "ok"
  | "runtime-error"
  | "time-limit"
  | "memory-limit"
  | "output-limit"
  | "compile-error"
  | "internal-error";

export interface RunCaseResult {
  id: string;
  verdict: RunVerdict;
  passed: boolean;
  stdout: string | null;
  stderr: string | null;
  exit_code?: number | null;
  time_ms: number | null;
  memory_kb: number | null;
  status?: string;
}

export interface RunResponse {
  engine: string;
  language: string;
  entry: string;
  revision: { id: number; number: number };
  files_sent: string[];
  files_skipped: number;
  compile: { ok: boolean; output: string; time_ms?: number } | null;
  tests: RunCaseResult[];
}

export interface GradingRoster {
  activity: {
    type: PracticalActivity;
    id: number;
    title: string;
    course_id: number | null;
    due_date: string | null;
    max_points: number;
    rubric: PracticalCriterion[];
    question: { id: number; text: string; instructions: string } | null;
    /** Missing from servers older than the Details tab rework. */
    brief?: GradingBrief;
    /** Quiz: every practical question, to switch between. */
    questions?: { question_id: number; title: string; points: number }[];
    can_grade: boolean;
  };
  counts: { total: number; to_grade: number; graded: number };
  rows: GradingRow[];
}

const BASE = "/tmcode";

/** Where the grading workspace for an activity lives. */
export const gradingWorkspaceHref = (
  type: PracticalActivity,
  id: number,
  opts: { questionId?: number | null; studentId?: number | null } = {},
) => {
  const q = new URLSearchParams();
  if (opts.questionId) q.set("question", String(opts.questionId));
  if (opts.studentId) q.set("student", String(opts.studentId));
  const qs = q.toString();
  return `/grading/practical/${type}/${id}${qs ? `?${qs}` : ""}`;
};

export const practicalsApi = {
  /** Start a quiz practical question: idempotent; 201 when created. */
  async startQuizPractical(quizId: number, questionId: number): Promise<{ project: ProjectDetail; link_id: number; created: boolean }> {
    const res = await api.post(`${BASE}/quizzes/${quizId}/questions/${questionId}/start`);
    const data = unwrap<Record<string, unknown>>(res.data);
    return { project: normalizeProjectDetail(data.project), link_id: Number(data.link_id), created: !!data.created };
  },

  async roster(type: PracticalActivity, id: number, questionId?: number | null): Promise<GradingRoster> {
    const res = await api.get(`${BASE}/grading/${type}/${id}`, { params: questionId ? { question_id: questionId } : undefined });
    return unwrap<GradingRoster>(res.data);
  },

  async saveGrade(
    type: PracticalActivity,
    id: number,
    studentId: number,
    body: { question_id?: number | null; rubric_scores: CriterionScore[]; score?: number | null; feedback: string },
  ): Promise<{ score: number; max_points: number }> {
    const res = await api.put(`${BASE}/grading/${type}/${id}/students/${studentId}`, body);
    return unwrap(res.data);
  },

  /** A short-lived sandboxed URL that serves the project at a revision as a site. */
  async preview(projectId: number, rev?: number | null): Promise<{ url: string; entry: string }> {
    const res = await api.post(`${BASE}/projects/${projectId}/preview`, rev ? { rev } : {});
    return unwrap(res.data);
  },

  /** Languages and likely entry files the Run tab can run in a revision. */
  async runTargets(projectId: number, rev?: number | null, language?: string | null): Promise<RunTargets> {
    const params: Record<string, string> = {};
    if (rev) params.rev = String(rev);
    if (language) params.language = language;
    const res = await api.get(`${BASE}/projects/${projectId}/run-targets`, { params });
    return unwrap<RunTargets>(res.data);
  },

  /** Runs a revision on the code runner with these inputs. Nothing is saved. */
  async run(
    projectId: number,
    body: {
      rev?: number | null;
      language?: string | null;
      entry?: string | null;
      tests: { id: string; input: string; expected_output?: string | null }[];
    },
  ): Promise<RunResponse> {
    const res = await api.post(`${BASE}/projects/${projectId}/run`, body, { timeout: 150_000 });
    return unwrap<RunResponse>(res.data);
  },
};

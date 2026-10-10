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
  grade: GradeView | null;
  submitted_at: string | null;
  late: boolean;
  /** The project revision holding the starter files (null: none). */
  starter_revision?: number | null;
  /** Every revision the teacher may read, oldest first (load one by `id`). */
  revisions?: { revision: number; at: string; id: number }[];
}

export interface Annotation {
  path: string;
  line: number;
  text: string;
}

export interface GradeView {
  score: number | null;
  rubric_scores: CriterionScore[] | null;
  feedback: string | null;
  /** When the grade shown was saved (a draft's save, or the release); null for old grades. */
  graded_at: string | null;
  ref_id: number | null;
  /** Line comments on the student's files. */
  annotations?: Annotation[];
  /** false: nothing released yet, or what is shown is an unreleased draft. */
  released?: boolean;
  status?: "ungraded" | "draft" | "released";
  graded_by?: { id: number; name: string } | null;
  /** What the student currently sees (a released grade under a draft). */
  released_score?: number | null;
  /** Opaque; send back as `if_version` so a save can't overwrite someone else's. */
  version?: string;
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
    /** Quiz: every practical question, to switch between. */
    questions?: { question_id: number; title: string; points: number }[];
    can_grade: boolean;
    /** Return for changes exists for assignments only. */
    can_return?: boolean;
  };
  counts: { total: number; to_grade: number; graded: number; drafts?: number };
  rows: GradingRow[];
}

export interface TmcodeSessionFlag {
  rule: string;
  severity: "info" | "warn" | "high";
  at: string | null;
  question_id: number | null;
  explanation: string;
}

export interface TmcodeSessionRow {
  student: { id: number; name: string; avatar_url?: string | null } | null;
  submission_id: number;
  session_id: string;
  status: "active" | "offline" | "submitted";
  mode: string;
  started_at: string | null;
  last_heartbeat: string | null;
  last_sync: string | null;
  submitted_at: string | null;
  current_task: { question_id: number; title: string } | null;
  focus: string | null;
  app_version: string | null;
  os: string | null;
  flags: TmcodeSessionFlag[];
}

export interface QuizSessions {
  quiz: { id: number; title: string };
  generated_at: string;
  stale_after_s: number;
  counts: { total: number; active: number; offline: number; submitted: number; flagged: number };
  sessions: TmcodeSessionRow[];
  explanations: Record<string, string>;
}

export interface MyTmcodeSession {
  submission_id: number;
  status: "active" | "offline" | "submitted";
  active: boolean;
  last_saved_at: string | null;
  last_heartbeat: string | null;
  app_version: string | null;
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
    body: {
      question_id?: number | null;
      rubric_scores: CriterionScore[];
      score?: number | null;
      feedback: string;
      /** Omit to keep the saved ones. */
      annotations?: Annotation[];
      /** false: a draft the student doesn't see. Default true. */
      release?: boolean;
      if_version?: string | null;
    },
  ): Promise<{ score: number; max_points: number; released?: boolean; locks_student?: boolean; grade?: GradeView | null }> {
    const res = await api.put(`${BASE}/grading/${type}/${id}/students/${studentId}`, body);
    return unwrap(res.data);
  },

  /** Release every draft grade of the activity (quiz: of one practical question). */
  async releaseDrafts(type: PracticalActivity, id: number, questionId?: number | null): Promise<{ released: number; skipped: { student_id: number; code: string }[] }> {
    const res = await api.post(`${BASE}/grading/${type}/${id}/release`, questionId ? { question_id: questionId } : {});
    return unwrap(res.data);
  },

  /** tmcode://grading?type=&id=&question=&student=&api= */
  async gradingLink(type: PracticalActivity, id: number, opts: { questionId?: number | null; studentId?: number | null } = {}): Promise<string> {
    const params: Record<string, number> = {};
    if (opts.questionId) params.question_id = opts.questionId;
    if (opts.studentId) params.student_id = opts.studentId;
    const res = await api.get(`${BASE}/grading/${type}/${id}/open-link`, { params });
    return String(unwrap<{ deeplink: string }>(res.data).deeplink);
  },

  /** Teacher: the quiz's TMCode exam sessions. */
  async quizSessions(quizId: number): Promise<QuizSessions> {
    const res = await api.get(`${BASE}/quizzes/${quizId}/sessions`);
    return unwrap<QuizSessions>(res.data);
  },

  /** Student: their own TMCode session on the open attempt (null: none). */
  async mySession(quizId: number): Promise<MyTmcodeSession | null> {
    const res = await api.get(`${BASE}/quizzes/${quizId}/my-session`);
    return unwrap<{ session: MyTmcodeSession | null }>(res.data).session ?? null;
  },

  /** A short-lived sandboxed URL that serves the project at a revision as a site. */
  async preview(projectId: number, rev?: number | null): Promise<{ url: string; entry: string }> {
    const res = await api.post(`${BASE}/projects/${projectId}/preview`, rev ? { rev } : {});
    return unwrap(res.data);
  },
};

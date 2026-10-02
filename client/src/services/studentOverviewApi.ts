import axios from "../utils/axiosConfig";
import type { StoreAlert } from "./alertStore";

// Mirrors server/src/services/studentOverview.service.ts.

export const PASS_MARK = 50;

export type TaskKind = "assignment" | "quiz";
export type TaskState =
  | "in_progress"
  | "due_today"
  | "due_soon"
  | "upcoming"
  | "not_open"
  | "submitted"
  | "graded"
  | "missed";

export interface StudentTask {
  id: number;
  kind: TaskKind;
  title: string;
  subject_id: number;
  subject_code: string | null;
  subject_name: string;
  state: TaskState;
  quiz_type: string | null;
  opens_at: string | null;
  due_at: string | null;
  countdown_to: string | null;
  countdown_label: "time_left" | "due" | "opens" | null;
  max_score: number | null;
  question_count: number | null;
  duration_minutes: number | null;
  attempts_used: number;
  max_attempts: number | null;
  can_retake: boolean;
  has_draft: boolean;
  submitted_at: string | null;
  is_late: boolean;
  score_pct: number | null;
  score_display: string | null;
  passed: boolean | null;
  has_feedback: boolean;
  graded_at: string | null;
  is_new: boolean;
  /** Teacher made it publicly accessible; only these raise reminders. */
  is_public?: boolean;
  action: { label: string; url: string } | null;
}

export interface StudentReminder {
  id: string;
  severity: "critical" | "warning" | "info" | "success";
  title: string;
  message: string;
  countdown_to: string | null;
  subject_id: number | null;
  action?: { label: string; url: string };
}

export interface StudentSubjectSummary {
  subject_id: number;
  subject_name: string;
  subject_code: string | null;
  total: number;
  todo: number;
  due_soon: number;
  missed: number;
  awaiting: number;
  graded: number;
  completion: number | null;
  recent_average: number | null;
  next_task: { title: string; kind: TaskKind; due_at: string; url: string | null } | null;
}

export interface StudentOverview {
  generated_at: string;
  academic_term_id: number | null;
  summary: {
    subjects: number;
    todo: number;
    in_progress: number;
    due_today: number;
    due_this_week: number;
    not_open: number;
    awaiting_grade: number;
    graded: number;
    missed: number;
    drafts: number;
    completion_rate: number | null;
    on_time_rate: number | null;
    recent_average: number | null;
    new_results: number;
    next_deadline: string | null;
  };
  tasks: StudentTask[];
  subjects: StudentSubjectSummary[];
  reminders: StudentReminder[];
}

const EMPTY_SUMMARY: StudentOverview["summary"] = {
  subjects: 0, todo: 0, in_progress: 0, due_today: 0, due_this_week: 0, not_open: 0, awaiting_grade: 0,
  graded: 0, missed: 0, drafts: 0, completion_rate: null, on_time_rate: null, recent_average: null,
  new_results: 0, next_deadline: null,
};

export async function getStudentOverview(): Promise<StudentOverview> {
  const res = await axios.get("/dashboard/student/overview");
  const d = (res.data?.data ?? {}) as Partial<StudentOverview>;
  // Tolerate a partial payload (older server, proxy error page) instead of crashing the page.
  return {
    generated_at: d.generated_at ?? new Date().toISOString(),
    academic_term_id: d.academic_term_id ?? null,
    summary: { ...EMPTY_SUMMARY, ...(d.summary ?? {}) },
    tasks: Array.isArray(d.tasks) ? d.tasks : [],
    subjects: Array.isArray(d.subjects) ? d.subjects : [],
    reminders: Array.isArray(d.reminders) ? d.reminders : [],
  };
}

/**
 * For a student, a new mark, a quiz about to open and newly posted work are
 * worth a badge even though they aren't warnings.
 */
export function reminderToAlert(r: StudentReminder): StoreAlert {
  const notify =
    r.severity === "critical" ||
    r.severity === "warning" ||
    r.id.startsWith("result-") ||
    r.id.startsWith("opens-") ||
    r.id === "new-work";
  return { ...r, notify: r.id === "all-clear" ? false : notify };
}

export const loadStudentAlerts = async (): Promise<StoreAlert[]> =>
  (await getStudentOverview()).reminders.map(reminderToAlert);

export const subjectLabel = (s: { subject_code: string | null; subject_name: string }) =>
  s.subject_code || s.subject_name;

export const TODO_STATES: TaskState[] = ["in_progress", "due_today", "due_soon", "upcoming"];

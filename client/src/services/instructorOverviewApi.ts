import axios from "../utils/axiosConfig";

// Mirrors server/src/services/instructorOverview.service.ts.

export const PASS_MARK = 50;

export type SubjectHealth = "on_track" | "watch" | "at_risk" | "no_data";
export type AlertSeverity = "critical" | "warning" | "info" | "success";
export type AssessmentKind = "assignment" | "quiz";

export interface AssessmentSummary {
  id: number;
  kind: AssessmentKind;
  title: string;
  subject_id: number;
  subject_code: string | null;
  subject_name: string;
  status: string;
  quiz_type: string | null;
  due_at: string | null;
  is_closed: boolean;
  submitted: number;
  expected: number | null;
  participation: number | null;
  pending: number;
  graded: number;
  late: number;
  avg_score: number | null;
  pass_rate: number | null;
  url: string;
}

export interface SubjectSummary {
  subject_id: number;
  subject_name: string;
  subject_code: string | null;
  class_groups: string[];
  /** Filled for school-wide (admin) views. */
  teachers?: string[];
  students: number | null;
  assignments: number;
  quizzes: number;
  published: number;
  drafts: number;
  submissions: number;
  pending: number;
  overdue_pending: number;
  graded: number;
  avg_score: number | null;
  pass_rate: number | null;
  participation: number | null;
  late_rate: number | null;
  missing: number;
  at_risk: number;
  next_due: { title: string; kind: AssessmentKind; due_at: string; url: string } | null;
  last_activity_at: string | null;
  health: SubjectHealth;
  health_reasons: string[];
}

export interface StudentSummary {
  mis_user_id: number | null;
  local_id: number | null;
  name: string;
  class_group_name: string | null;
  avg_score: number | null;
  graded_count: number;
  missing: number;
  subjects: string[];
  reasons: string[];
  url: string | null;
}

export interface GradingQueueItem {
  id: number;
  kind: AssessmentKind;
  title: string;
  subject_id: number;
  subject_code: string | null;
  subject_name: string;
  pending: number;
  oldest_at: string | null;
  waiting_days: number;
  url: string;
}

export interface DashboardAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  subject_id: number | null;
  action?: { label: string; url: string };
}

export interface OverviewTotals {
  subjects: number;
  class_groups: number;
  students: number | null;
  assessments: number;
  assignments: number;
  quizzes: number;
  published: number;
  drafts: number;
  submissions: number;
  pending_grading: number;
  overdue_grading: number;
  graded: number;
  avg_score: number | null;
  pass_rate: number | null;
  participation: number | null;
  late_rate: number | null;
  at_risk_students: number;
  missing_work: number;
  due_next_7_days: number;
  live_proctoring: number;
  stale_proctoring: number;
  flagged_sessions: number;
  submissions_this_week: number;
  submissions_last_week: number;
  new_submissions_24h: number;
  graded_this_week: number;
  graded_last_week: number;
}

export interface InstructorOverview {
  generated_at: string;
  academic_term_id: number | null;
  rosters_available: boolean;
  scope?: string;
  totals: OverviewTotals;
  subjects: SubjectSummary[];
  trend: Array<{ week_start: string; submissions: number; graded: number; avg_score: number | null }>;
  distribution: Array<{ band: string; count: number }>;
  grading_queue: GradingQueueItem[];
  upcoming: AssessmentSummary[];
  assessments: AssessmentSummary[];
  students: { at_risk: StudentSummary[]; top: StudentSummary[] };
  alerts: DashboardAlert[];
}

/**
 * `fresh` skips the server's ~60s per-user cache (which exists so the top-bar
 * bell can poll cheaply); the dashboard's Refresh button uses it.
 */
export async function getInstructorOverview(
  subjectId?: number | null,
  opts: { fresh?: boolean } = {},
): Promise<InstructorOverview> {
  const params: Record<string, string | number> = {};
  if (subjectId) params.subjectId = subjectId;
  if (opts.fresh) params.fresh = 1;
  const res = await axios.get("/dashboard/instructor/overview", { params });
  return res.data.data;
}

/** "WEB · Web UI" style label, falling back to whichever part exists. */
export const subjectLabel = (s: { subject_code: string | null; subject_name: string }) =>
  s.subject_code || s.subject_name;

/** One CSV per dashboard view: subjects, then the students needing support. */
export function overviewToCsv(o: InstructorOverview): string {
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const row = (xs: unknown[]) => xs.map(esc).join(",");
  const lines = [
    row(["Subject code", "Subject", "Teachers", "Status", "Students", "Assignments", "Quizzes", "Submissions", "To grade", "Class average %", "Pass rate %", "Participation %", "Missing", "Needs support"]),
    ...o.subjects.map((s) =>
      row([s.subject_code, s.subject_name, (s.teachers ?? []).join("; "), s.health, s.students, s.assignments, s.quizzes, s.submissions, s.pending, s.avg_score, s.pass_rate, s.participation, s.missing, s.at_risk]),
    ),
    "",
    row(["Student", "Class", "Average %", "Graded items", "Missing", "Subjects", "Reasons"]),
    ...o.students.at_risk.map((s) =>
      row([s.name, s.class_group_name, s.avg_score, s.graded_count, s.missing, s.subjects.join(" "), s.reasons.join("; ")]),
    ),
  ];
  return lines.join("\n");
}

/** Loader for the top-bar bell. */
export const loadInstructorAlerts = async () => (await getInstructorOverview(null)).alerts;

import axios from "../utils/axiosConfig";
import type { DashboardAlert, OverviewTotals, SubjectHealth, SubjectSummary } from "./instructorOverviewApi";

// Mirrors server/src/services/adminReports.service.ts
// (GET /api/dashboard/admin/{subjects,students,insights}).

export interface ClassGroupRef {
  id: number;
  name: string;
  grade_name: string | null;
  program_name: string | null;
}

export interface SubjectRef {
  id: number;
  name: string;
  code: string | null;
}

export interface Paged<T> {
  rows: T[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface AdminSubjectRow extends SubjectSummary {
  teachers: string[];
  teacher_list: Array<{ mis_user_id: number; name: string }>;
  class_group_list: ClassGroupRef[];
  programmes: string[];
  report_card: { mapped: boolean; mapped_items: number };
}

export type SubjectFlag = "unmapped" | "no_work" | "no_teacher" | "grading_overdue";
export type SubjectSort =
  | "name"
  | "health"
  | "avg_score"
  | "pass_rate"
  | "participation"
  | "pending"
  | "overdue_pending"
  | "at_risk"
  | "students"
  | "assessments"
  | "last_activity";

export interface AdminSubjectsQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  health?: SubjectHealth;
  programme?: string;
  classGroupId?: number;
  teacherId?: number;
  flag?: SubjectFlag;
  sort?: SubjectSort;
  dir?: "asc" | "desc";
}

export interface AdminSubjectsResponse extends Paged<AdminSubjectRow> {
  health_counts: Record<SubjectHealth, number>;
  facets: {
    programmes: string[];
    class_groups: ClassGroupRef[];
    teachers: Array<{ mis_user_id: number; name: string }>;
  };
  totals: OverviewTotals;
  rosters_available: boolean;
  generated_at: string;
}

export type PerformanceStatus = "excelling" | "on_track" | "needs_attention" | "at_risk" | "no_marks";
export type RankKind = "assignment" | "quiz" | "recorded";

export interface AdminStudentRow {
  key: string;
  mis_user_id: number | null;
  local_id: number | null;
  name: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  username: string | null;
  gender: string | null;
  registration_number: string | null;
  class_group: ClassGroupRef | null;
  subjects: SubjectRef[];
  average: number | null;
  rank: number | null;
  ranked_of: number;
  status: PerformanceStatus;
  marked_items: number;
  subjects_marked: number;
  by_kind: Partial<Record<RankKind, number>>;
  subject_scores: Array<SubjectRef & { score: number }>;
  weakest: (SubjectRef & { score: number }) | null;
  missing: number;
  reasons: string[];
}

export type StudentSort = "name" | "average" | "rank" | "missing" | "class_group" | "marked_items";

export interface AdminStudentsQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  classGroupId?: number;
  subjectId?: number;
  programme?: string;
  status?: PerformanceStatus;
  attention?: boolean;
  gender?: string;
  sort?: StudentSort;
  dir?: "asc" | "desc";
}

export interface AdminStudentsResponse extends Paged<AdminStudentRow> {
  status_counts: Record<PerformanceStatus, number>;
  summary: { students: number; with_marks: number; average: number | null; needing_support: number; missing_work: number };
  facets: {
    class_groups: Array<ClassGroupRef & { students: number }>;
    programmes: string[];
    subjects: SubjectRef[];
    unassigned: number;
  };
  rosters_available: boolean;
  generated_at: string;
}

export type TeacherStatus = "active" | "behind" | "inactive";

export interface TeacherRow {
  mis_user_id: number;
  name: string;
  subjects: SubjectRef[];
  class_groups: number;
  assessments: number;
  published: number;
  drafts: number;
  submissions: number;
  pending: number;
  overdue_pending: number;
  avg_score: number | null;
  participation: number | null;
  at_risk_subjects: number;
  unmapped_subjects: number;
  last_activity_at: string | null;
  status: TeacherStatus;
  flags: string[];
}

export interface ClassGroupRow extends ClassGroupRef {
  students: number;
  with_marks: number;
  average: number | null;
  pass_rate: number | null;
  at_risk: number;
  excelling: number;
  missing: number;
  subjects: number;
}

export interface AdminInsights {
  generated_at: string;
  rosters_available: boolean;
  school: {
    subjects: number;
    subjects_with_work: number;
    class_groups: number;
    teachers: number;
    students: number;
    students_with_marks: number;
    average: number | null;
    pass_rate: number | null;
    needing_support: number;
    excelling: number;
    report_cards_mapped: number;
    report_cards_approved: number;
  };
  teachers: TeacherRow[];
  class_groups: ClassGroupRow[];
  programmes: Array<{ name: string; class_groups: number; students: number; with_marks: number; average: number | null; at_risk: number }>;
  coverage: {
    no_published_work: Array<SubjectRef & { teachers: string[] }>;
    no_teacher: SubjectRef[];
    unmapped: Array<SubjectRef & { teachers: string[]; published: number }>;
    students_without_marks: number;
  };
  report_cards: {
    term: string | null;
    academic_year: string | null;
    cards: { draft: number; saved: number; approved: number; total: number };
    subjects_mapped: number;
    subjects_total: number;
  };
  decisions: DashboardAlert[];
}

export interface Period {
  term?: string;
  academic_year?: string;
}

/** Drop empty values so the URL and the server see only real filters. */
function clean(params: Record<string, unknown>) {
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "" || v === false) continue;
    out[k] = v === true ? 1 : (v as string | number);
  }
  return out;
}

export async function getAdminSubjects(q: AdminSubjectsQuery, period: Period = {}, fresh = false): Promise<AdminSubjectsResponse> {
  const res = await axios.get("/dashboard/admin/subjects", { params: clean({ ...q, ...period, fresh: fresh ? 1 : undefined }) });
  return res.data.data;
}

export async function getAdminStudents(q: AdminStudentsQuery, period: Period = {}, fresh = false): Promise<AdminStudentsResponse> {
  const res = await axios.get("/dashboard/admin/students", { params: clean({ ...q, ...period, fresh: fresh ? 1 : undefined }) });
  return res.data.data;
}

export async function getAdminInsights(period: Period = {}, fresh = false): Promise<AdminInsights> {
  const res = await axios.get("/dashboard/admin/insights", { params: clean({ ...period, fresh: fresh ? 1 : undefined }) });
  return res.data.data;
}

export const STATUS_META: Record<PerformanceStatus, { label: string; cls: string; dot: string }> = {
  excelling: { label: "Excelling", cls: "bg-blue-50 text-blue-700 dark:bg-blue-900/25 dark:text-blue-300", dot: "bg-blue-600" },
  on_track: { label: "On track", cls: "bg-sky-50 text-sky-700 dark:bg-sky-900/25 dark:text-sky-300", dot: "bg-sky-500" },
  needs_attention: { label: "Needs attention", cls: "bg-amber-50 text-amber-700 dark:bg-amber-900/25 dark:text-amber-300", dot: "bg-amber-500" },
  at_risk: { label: "At risk", cls: "bg-red-50 text-red-700 dark:bg-red-900/25 dark:text-red-300", dot: "bg-red-600" },
  no_marks: { label: "No marks yet", cls: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400", dot: "bg-gray-400" },
};

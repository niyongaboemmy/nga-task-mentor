import api from "../utils/axiosConfig";
import type { SubmissionItemInterface } from "../components/Assignments/SubmissionMarking";

export interface SubmissionListItem extends SubmissionItemInterface {
  assignment?: {
    id: string;
    title: string;
    course_id: string;
  };
}

export interface SubmissionListFilters {
  course_id?: string | number;
  assignment_id?: string | number;
  student_id?: string | number;
  status?: string;
}

/** One quiz or assignment, with the submission stats for its detail view. */
export interface GroupedAssessment {
  id: number;
  type: "assignment" | "quiz";
  subject_id: number;
  title: string;
  status: string;
  max_score: number | null;
  submission_count: number;
  graded_count: number;
  pending_count: number;
  avg_percentage: number | null;
  last_submission_at: string | null;
  /** student view only */
  my_status: string | null;
  my_grade_display: string | null;
  my_percentage: number | null;
  detail_url: string;
}

export interface GroupedSubmissionsSubject {
  subject_id: number;
  subject_name: string;
  subject_code: string | null;
  assessment_count: number;
  submission_total: number;
  graded_total: number;
  pending_total: number;
  assignments: { count: number; has_more: boolean; items: GroupedAssessment[] };
  quizzes: { count: number; has_more: boolean; items: GroupedAssessment[] };
}

export interface GroupedSubmissionsData {
  scope: "all" | "assigned" | "enrolled" | "none";
  can_view_all: boolean;
  can_grade: boolean;
  subjects: GroupedSubmissionsSubject[];
  all_subjects: { id: number; name: string; code: string | null }[];
  status_values: string[];
  totals: { subjects: number; submissions: number; assessments_on_page: number };
  pagination: { page: number; page_size: number; total_pages: number };
}

export interface GroupedSubmissionsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  type?: "assignment" | "quiz" | "all" | "";
  status?: string;
  subjectId?: number | "";
}

export class SubmissionsApiService {
  static async getGrouped(
    params: GroupedSubmissionsParams = {},
  ): Promise<GroupedSubmissionsData> {
    const query: Record<string, string> = {};
    if (params.page) query.page = String(params.page);
    if (params.pageSize) query.pageSize = String(params.pageSize);
    if (params.search) query.search = params.search;
    if (params.type && params.type !== "all") query.type = params.type;
    if (params.status && params.status !== "all") query.status = params.status;
    if (params.subjectId) query.subjectId = String(params.subjectId);
    const response = await api.get("/submissions/grouped", { params: query });
    return response.data.data;
  }

  static async getSubmissions(
    filters: SubmissionListFilters = {},
  ): Promise<{ success: boolean; count: number; data: SubmissionListItem[] }> {
    const response = await api.get("/submissions", { params: filters });
    return response.data;
  }

  static async getSubmission(
    id: string | number,
  ): Promise<{ success: boolean; data: SubmissionListItem }> {
    const response = await api.get(`/submissions/${id}`);
    return response.data;
  }

  static async gradeSubmission(
    id: string | number,
    payload: {
      score: number;
      maxScore?: number;
      feedback?: string;
      rubricScores?: Record<number, number>;
    },
  ): Promise<{ success: boolean; message: string; data: SubmissionListItem }> {
    const response = await api.patch(`/submissions/${id}/grade`, payload);
    return response.data;
  }

  static async addComment(
    id: string | number,
    content: string,
  ): Promise<{ success: boolean; data: SubmissionListItem }> {
    const response = await api.post(`/submissions/${id}/comments`, { content });
    return response.data;
  }
}

export default SubmissionsApiService;

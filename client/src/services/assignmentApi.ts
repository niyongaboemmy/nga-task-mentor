import axios from "../utils/axiosConfig";

export type AssignmentStatus = "draft" | "published" | "completed" | "removed";

export interface GroupedAssignment {
  id: number;
  title: string;
  due_date: string;
  max_score: number | string;
  submission_type: string;
  status: AssignmentStatus;
  course_id: number;
  creator: { id: number; first_name: string; last_name: string } | null;
  /** instructor / admin view */
  submission_count?: number;
  graded_count?: number;
  /** student view */
  my_submission?: { status: string; grade: string | null } | null;
}

export interface GroupedSubject {
  subject_id: number;
  subject_name: string;
  subject_code: string | null;
  assignment_count: number;
  published_count: number;
  draft_count: number;
  has_more: boolean;
  assignments: GroupedAssignment[];
}

export interface GroupedAssignmentsResponse {
  success: boolean;
  data: {
    scope: "all" | "assigned" | "enrolled" | "none";
    can_manage: boolean;
    subjects: GroupedSubject[];
    all_subjects: { id: number; name: string; code: string | null }[];
    totals: { subjects: number; assignments: number };
    pagination: { page: number; page_size: number; total_pages: number };
  };
}

export interface GroupedAssignmentsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  subjectId?: number | "";
}

export const AssignmentApiService = {
  async getGrouped(
    params: GroupedAssignmentsParams = {},
  ): Promise<GroupedAssignmentsResponse["data"]> {
    const query: Record<string, string> = {};
    if (params.page) query.page = String(params.page);
    if (params.pageSize) query.pageSize = String(params.pageSize);
    if (params.search) query.search = params.search;
    if (params.status && params.status !== "all") query.status = params.status;
    if (params.subjectId) query.subjectId = String(params.subjectId);
    const res = await axios.get<GroupedAssignmentsResponse>(
      "/assignments/grouped",
      { params: query },
    );
    return res.data.data;
  },

  async setStatus(assignmentId: number | string, status: AssignmentStatus) {
    const res = await axios.patch(`/assignments/${assignmentId}/status`, {
      status,
    });
    return res.data;
  },
};

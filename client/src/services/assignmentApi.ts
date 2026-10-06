import axios from "../utils/axiosConfig";

export type AssignmentStatus = "draft" | "published" | "completed" | "removed";

/** A student's own standing on an assignment (server utils/assignmentListState). */
export type StudentAssignmentState = "todo" | "submitted" | "graded" | "missed";

export interface ListedAssignment {
  id: number;
  title: string;
  due_date: string;
  created_at: string | null;
  max_score: number | string;
  submission_type: string;
  status: AssignmentStatus;
  course_id: number;
  subject_name: string;
  subject_code: string | null;
  creator: { id: number; first_name: string; last_name: string } | null;
  created_by?: number;
  /** creator or super admin: may edit / change status / grade */
  can_manage?: boolean;
  /** instructor / admin view */
  submission_count?: number;
  graded_count?: number;
  /** student view */
  my_state?: StudentAssignmentState;
  my_submission?: { status: string; grade: string | null } | null;
}

export interface AssignmentListResponse {
  success: boolean;
  data: {
    scope: "all" | "assigned" | "enrolled" | "none";
    can_manage: boolean;
    items: ListedAssignment[];
    /** Students: how many assignments are in each of their states (before the status filter). */
    counts: Partial<Record<StudentAssignmentState, number>>;
    subjects: { id: number; name: string; code: string | null }[];
    pagination: { page: number; page_size: number; total: number; total_pages: number };
  };
}

export interface AssignmentListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  subjectId?: number | "";
}

export const AssignmentApiService = {
  async list(params: AssignmentListParams = {}): Promise<AssignmentListResponse["data"]> {
    const query: Record<string, string> = {};
    if (params.page) query.page = String(params.page);
    if (params.pageSize) query.pageSize = String(params.pageSize);
    if (params.search) query.search = params.search;
    if (params.status && params.status !== "all") query.status = params.status;
    if (params.subjectId) query.subjectId = String(params.subjectId);
    const res = await axios.get<AssignmentListResponse>("/assignments/list", { params: query });
    return res.data.data;
  },

  /** Every assignment matching the filters, page by page (for whole-term views such as Grades). */
  async listAll(params: Omit<AssignmentListParams, "page" | "pageSize"> = {}): Promise<ListedAssignment[]> {
    const all: ListedAssignment[] = [];
    for (let page = 1; ; page++) {
      const data = await AssignmentApiService.list({ ...params, page, pageSize: 50 });
      all.push(...data.items);
      if (page >= data.pagination.total_pages) return all;
    }
  },

  async setStatus(assignmentId: number | string, status: AssignmentStatus) {
    const res = await axios.patch(`/assignments/${assignmentId}/status`, {
      status,
    });
    return res.data;
  },
};

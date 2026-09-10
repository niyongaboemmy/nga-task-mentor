import axios from "../utils/axiosConfig";

export type QuizStatus = "draft" | "published" | "completed";
export type QuizType = "Assessment" | "Homework" | "Quiz" | "Exam";

export interface GroupedQuiz {
  id: number;
  title: string;
  description: string;
  type: QuizType;
  status: QuizStatus;
  course_id: number;
  created_by: number;
  is_public: boolean;
  start_date: string | null;
  end_date: string | null;
  created_at: string | null;
  total_questions: number;
  total_points: number;
  submission_count: number;
  graded_count: number;
  creator: { id: number; first_name: string; last_name: string } | null;
  can_edit: boolean;
  is_own: boolean;
}

export interface GroupedQuizSubject {
  subject_id: number;
  subject_name: string;
  subject_code: string | null;
  quiz_count: number;
  published_count: number;
  draft_count: number;
  has_more: boolean;
  quizzes: GroupedQuiz[];
}

export interface GroupedQuizzesData {
  scope: "all" | "assigned" | "enrolled" | "none";
  can_create: boolean;
  can_edit: boolean;
  subjects: GroupedQuizSubject[];
  all_subjects: { id: number; name: string; code: string | null }[];
  totals: { subjects: number; quizzes: number };
  pagination: { page: number; page_size: number; total_pages: number };
}

export interface GroupedQuizzesParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  type?: string;
  subjectId?: number | "";
}

export const QuizGroupedApiService = {
  async getGrouped(
    params: GroupedQuizzesParams = {},
  ): Promise<GroupedQuizzesData> {
    const query: Record<string, string> = {};
    if (params.page) query.page = String(params.page);
    if (params.pageSize) query.pageSize = String(params.pageSize);
    if (params.search) query.search = params.search;
    if (params.status && params.status !== "all") query.status = params.status;
    if (params.type && params.type !== "all") query.type = params.type;
    if (params.subjectId) query.subjectId = String(params.subjectId);
    const res = await axios.get("/quizzes/grouped", { params: query });
    return res.data.data;
  },
};

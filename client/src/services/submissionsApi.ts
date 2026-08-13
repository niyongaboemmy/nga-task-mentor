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

export class SubmissionsApiService {
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

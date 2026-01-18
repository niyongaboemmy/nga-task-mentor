import type { UserFullData } from "./user.types";

export interface Course {
  id: number;
  title: string;
  code: string;
  description?: string;
  credits?: number;
  start_date?: string | null;
  end_date?: string | null;
  is_active?: boolean;
  max_students?: number;
  instructor_id?: number | null;
  created_at?: string;
  updated_at?: string;
  instructor?: {
    first_name: string;
    last_name: string;
  } | null;
  enrolledStudents?: UserFullData[];
  statistics?: {
    assignments: {
      total: number;
      by_status: {
        draft: number;
        published: number;
        completed: number;
        removed: number;
      };
      total_submissions: number;
      average_submissions_per_assignment: number;
    };
    quizzes: {
      total: number;
      by_status: { draft: number; published: number; completed: number };
      by_type: { practice: number; graded: number; exam: number };
      total_submissions: number;
      average_score: number;
      pass_rate: number;
    };
  };
}

export interface CreateCourseRequest {
  title: string;
  description?: string;
  code: string;
  credits?: number;
  start_date?: string;
  end_date?: string;
  max_students?: number;
}

export interface UpdateCourseRequest extends Partial<CreateCourseRequest> {}

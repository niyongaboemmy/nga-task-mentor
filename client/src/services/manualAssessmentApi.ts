import axios from "../utils/axiosConfig";

export interface ManualAssessment {
  id: number;
  course_id: number;
  title: string;
  max_score: number;
  term: string;
  academic_year: string;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface ManualAssessmentScore {
  id: number;
  manual_assessment_id: number;
  student_id: number;
  score: number;
}

export interface CreateManualAssessmentPayload {
  course_id: number;
  title: string;
  max_score: number;
  term: string;
  academic_year: string;
}

export interface UpsertScoresPayload {
  scores: Array<{ student_id: number; score: number }>;
}

export class ManualAssessmentApiService {
  static async create(payload: CreateManualAssessmentPayload): Promise<{ success: boolean; data: ManualAssessment }> {
    const res = await axios.post("/manual-assessments", payload);
    return res.data;
  }

  static async list(params: {
    course_id: number;
    term?: string;
    academic_year?: string;
  }): Promise<{ success: boolean; data: ManualAssessment[] }> {
    const res = await axios.get("/manual-assessments", { params });
    return res.data;
  }

  static async update(
    id: number,
    payload: { title?: string; max_score?: number },
  ): Promise<{ success: boolean; data: ManualAssessment }> {
    const res = await axios.patch(`/manual-assessments/${id}`, payload);
    return res.data;
  }

  static async delete(id: number): Promise<{ success: boolean; message: string }> {
    const res = await axios.delete(`/manual-assessments/${id}`);
    return res.data;
  }

  static async getScores(id: number): Promise<{ success: boolean; data: ManualAssessmentScore[] }> {
    const res = await axios.get(`/manual-assessments/${id}/scores`);
    return res.data;
  }

  static async upsertScores(
    id: number,
    payload: UpsertScoresPayload,
  ): Promise<{ success: boolean; message: string; data: { saved: number } }> {
    const res = await axios.post(`/manual-assessments/${id}/scores`, payload);
    return res.data;
  }
}

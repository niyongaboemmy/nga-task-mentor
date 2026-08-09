import axios from "../utils/axiosConfig";

export const ASSESSMENT_TYPE_LABELS: Record<string, string> = {
  class_work:     "Class Work",
  group_work:     "Group Work",
  homework:       "Homework",
  midterm:        "Midterm",
  participation:  "Participation",
  ca_end_of_term: "CA End Of Term Exam",
};

export const ASSESSMENT_TYPES = Object.keys(ASSESSMENT_TYPE_LABELS) as AssessmentType[];

export type AssessmentType =
  | "class_work"
  | "group_work"
  | "homework"
  | "midterm"
  | "participation"
  | "ca_end_of_term";

export interface ManualAssessment {
  id: number;
  course_id: number;
  title: string;
  assessment_type: AssessmentType | null;
  assessment_number: number | null;
  assessment_date: string | null;
  add_to_final_grade: boolean;
  max_score: number;
  term: string;
  academic_year: string;
  created_by: number | null;
  created_at: string;
  updated_at: string;
  /** Only present when fetched with with_counts=true */
  recorded_count?: number;
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
  assessment_type?: AssessmentType | null;
  assessment_number?: number | null;
  assessment_date?: string | null;
  add_to_final_grade?: boolean;
  max_score: number;
  term: string;
  academic_year: string;
}

export interface UpdateManualAssessmentPayload {
  title?: string;
  assessment_type?: AssessmentType | null;
  assessment_number?: number | null;
  assessment_date?: string | null;
  add_to_final_grade?: boolean;
  max_score?: number;
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
    course_id?: number;
    course_ids?: number[];
    term?: string;
    academic_year?: string;
    with_counts?: boolean;
  }): Promise<{ success: boolean; data: ManualAssessment[] }> {
    const query: Record<string, string> = {};
    if (params.course_id)   query.course_id   = String(params.course_id);
    if (params.course_ids?.length) query.course_ids = params.course_ids.join(",");
    if (params.term)         query.term         = params.term;
    if (params.academic_year) query.academic_year = params.academic_year;
    if (params.with_counts)  query.with_counts  = "true";
    const res = await axios.get("/manual-assessments", { params: query });
    return res.data;
  }

  static async update(
    id: number,
    payload: UpdateManualAssessmentPayload,
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

  /** Display label for an assessment: e.g. "Midterm 1" */
  static getTypeLabel(a: ManualAssessment): string {
    const typeLabel = a.assessment_type ? ASSESSMENT_TYPE_LABELS[a.assessment_type] : a.title;
    if (a.assessment_number) return `${typeLabel} ${a.assessment_number}`;
    return typeLabel;
  }
}

import axios from "../utils/axiosConfig";

export type AssessmentCategory = "CW" | "HW" | "MD" | "EOT";
export type AssessmentType = "quiz" | "assignment";
export type AttributeRating = "Excellent" | "Very good" | "Good";

export interface AssessmentItem {
  subject_id: number;
  assessment_type: AssessmentType;
  assessment_id: number;
  category: AssessmentCategory;
}

export interface AttributeItem {
  attribute_name: string;
  rating: AttributeRating;
}

export interface BuilderSavePayload {
  student_id: number;
  term: string;
  academic_year: string;
  assessments: AssessmentItem[];
}

export interface AttributesSavePayload {
  student_id: number;
  term: string;
  academic_year: string;
  class_teacher_comment?: string | null;
  attendance_present: number;
  attendance_absent: number;
  attendance_late: number;
  attributes: AttributeItem[];
}

export interface BuilderSaveResponse {
  success: boolean;
  message: string;
  data: {
    report_card_id: number;
    mappings_count: number;
    assessments: AssessmentItem[];
  };
}

export interface AttributesSaveResponse {
  success: boolean;
  message: string;
  data: {
    report_card_id: number;
    class_teacher_comment: string | null;
    attendance: { present: number; absent: number; late: number };
    attributes: AttributeItem[];
  };
}

// ─── Read-side types (GET /report-cards/student/:studentId) ──────────────────

export interface CategoryResult {
  scaled_score: number;
  weight: number;
  avg_percentage: number;
  assessments: Array<{
    assessment_id: number;
    assessment_type: string;
    raw_score: number;
    max_score: number;
    percentage: number;
  }>;
}

export interface SubjectGrade {
  subject_id: number;
  categories: Partial<Record<AssessmentCategory, CategoryResult>>;
  total_score: number;
}

export interface ReportCardMeta {
  id: number;
  uuid: string;
  student_id: number;
  term: string;
  academic_year: string;
  class_teacher_comment: string | null;
  attendance: {
    present: number;
    absent: number;
    late: number;
    total_days: number;
  };
}

export interface ReportCardData {
  report_card: ReportCardMeta;
  grades: SubjectGrade[];
  attributes: AttributeItem[];
}

export interface ReportCardResponse {
  success: boolean;
  data: ReportCardData;
}

// ─── Helper: letter grade from total score ───────────────────────────────────

export function scoreToLetterGrade(score: number): { letter: string; remark: string } {
  if (score >= 90) return { letter: "A", remark: "Distinction" };
  if (score >= 75) return { letter: "B", remark: "Merit" };
  if (score >= 60) return { letter: "C", remark: "Credit" };
  if (score >= 45) return { letter: "D", remark: "Pass" };
  return { letter: "F", remark: "Fail" };
}

export class ReportCardApiService {
  static async saveBuilder(payload: BuilderSavePayload): Promise<BuilderSaveResponse> {
    const response = await axios.post("/report-cards/builder/save", payload);
    return response.data;
  }

  static async saveAttributes(payload: AttributesSavePayload): Promise<AttributesSaveResponse> {
    const response = await axios.post("/report-cards/attributes/save", payload);
    return response.data;
  }

  static async getStudentReportCard(
    studentId: number,
    params?: { term?: string; academic_year?: string },
  ): Promise<ReportCardResponse> {
    const response = await axios.get(`/report-cards/student/${studentId}`, { params });
    return response.data;
  }

  static async generatePdf(reportCardId: number): Promise<Blob> {
    const response = await axios.post(
      "/report-cards/generate-pdf",
      { report_card_id: reportCardId },
      { responseType: "blob" },
    );
    return response.data;
  }
}

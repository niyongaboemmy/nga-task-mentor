import axios from "../utils/axiosConfig";

export type AssessmentCategory = "CW" | "HW" | "MD" | "EOT";
export type AssessmentType = "quiz" | "assignment" | "manual";
export type AttributeRating = "Excellent" | "Very good" | "Good";
export type ReportCardStatus = "draft" | "saved" | "approved";

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
    status: ReportCardStatus;
    is_new: boolean;
    subject_mappings_saved: number;
    total_subjects_mapped: number;
    total_assessments_mapped: number;
  };
}

export interface AttributesSaveResponse {
  success: boolean;
  message: string;
  data: {
    report_card_id: number;
    status: ReportCardStatus;
    class_teacher_comment: string | null;
    attendance: { present: number; absent: number; late: number };
    attributes: AttributeItem[];
  };
}

// ─── Overview (per course, batch of students) ─────────────────────────────────

export interface StudentReportCardStatus {
  student_id: number;
  report_card_id: number | null;
  status: ReportCardStatus | null;
  subjects_mapped: number;
  has_attributes: boolean;
  updated_at: string | null;
}

export interface CourseOverviewResponse {
  success: boolean;
  data: StudentReportCardStatus[];
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
  status: ReportCardStatus;
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
  // Maps subject_id -> display name, resolved server-side from MIS.
  subject_names?: Record<number, string>;
  // Raw assessment mappings — used by the builder to pre-populate its state
  raw_assessments: AssessmentItem[];
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

// ─── Status display helpers ──────────────────────────────────────────────────

export const STATUS_META: Record<
  ReportCardStatus,
  { label: string; color: string; bg: string; border: string; dot: string }
> = {
  draft: {
    label: "Draft",
    color: "text-amber-700 dark:text-amber-300",
    bg: "bg-amber-100 dark:bg-amber-900/30",
    border: "border-amber-300 dark:border-amber-600",
    dot: "bg-amber-400",
  },
  saved: {
    label: "Saved",
    color: "text-blue-700 dark:text-blue-300",
    bg: "bg-blue-100 dark:bg-blue-900/30",
    border: "border-blue-300 dark:border-blue-600",
    dot: "bg-blue-400",
  },
  approved: {
    label: "Approved",
    color: "text-emerald-700 dark:text-emerald-300",
    bg: "bg-emerald-100 dark:bg-emerald-900/30",
    border: "border-emerald-300 dark:border-emerald-600",
    dot: "bg-emerald-400",
  },
};

// ─── Annual (combined-terms) summary ──────────────────────────────────────────
// Read-only, computed on demand from the term report cards that already
// exist — there is no stored "annual" record.

export interface AnnualTermContribution {
  term: string;
  total_score: number;
}

export interface AnnualSubjectGrade {
  subject_id: number;
  annual_score: number;
  contributing_terms: AnnualTermContribution[];
}

export interface AnnualPerTerm {
  term: string;
  status: ReportCardStatus;
  attendance: { present: number; absent: number; late: number };
  attributes: AttributeItem[];
  grades: SubjectGrade[];
}

export interface AnnualReportCardData {
  student_id: number;
  academic_year: string;
  annual_grades: AnnualSubjectGrade[];
  subject_names?: Record<number, string>;
  per_term: AnnualPerTerm[];
  missing_terms: string[];
}

export interface AnnualReportCardResponse {
  success: boolean;
  data: AnnualReportCardData;
}

// ─── Admin cross-course reporting ─────────────────────────────────────────────

export interface AdminReportCardStudent {
  report_card_id: number;
  student_id: number;
  uuid: string;
  status: ReportCardStatus;
  name: string;
}

export interface AdminReportCardStudentsResponse {
  success: boolean;
  data: AdminReportCardStudent[];
  term: string;
  academic_year: string;
}

export interface AdminReportCardSummary {
  term: string;
  academic_year: string;
  total_report_cards: number;
  truncated: boolean;
  status_counts: { draft: number; saved: number; approved: number };
  overall_average: number | null;
  category_averages: Record<AssessmentCategory, number | null>;
  subject_averages: Array<{
    subject_id: number;
    subject_name: string;
    average_score: number;
    student_count: number;
  }>;
}

export interface AdminReportCardSummaryResponse {
  success: boolean;
  data: AdminReportCardSummary;
}

// ─── API service ──────────────────────────────────────────────────────────────

export class ReportCardApiService {
  static async saveBuilder(payload: BuilderSavePayload): Promise<BuilderSaveResponse> {
    const response = await axios.post("/report-cards/builder/save", payload);
    return response.data;
  }

  static async saveAttributes(payload: AttributesSavePayload): Promise<AttributesSaveResponse> {
    const response = await axios.post("/report-cards/attributes/save", payload);
    return response.data;
  }

  // Batch status overview for a list of student IDs in a given term/year.
  static async getCourseOverview(params: {
    term: string;
    academic_year: string;
    student_ids: number[];
  }): Promise<CourseOverviewResponse> {
    const response = await axios.get("/report-cards/overview", {
      params: {
        term: params.term,
        academic_year: params.academic_year,
        student_ids: params.student_ids.join(","),
      },
    });
    return response.data;
  }

  // Instructors: draft ↔ saved.  Admins: any → any (including approved).
  static async updateStatus(
    reportCardId: number,
    status: ReportCardStatus,
  ): Promise<{ success: boolean; data: { report_card_id: number; status: ReportCardStatus } }> {
    const response = await axios.patch(`/report-cards/${reportCardId}/status`, { status });
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

  static async getAnnualReportCard(
    studentId: number,
    params: { academic_year: string; academic_year_id?: number },
  ): Promise<AnnualReportCardResponse> {
    const response = await axios.get(`/report-cards/annual/${studentId}`, { params });
    return response.data;
  }

  static async generateAnnualPdf(params: {
    student_id: number;
    academic_year: string;
    academic_year_id?: number;
  }): Promise<Blob> {
    const response = await axios.post("/report-cards/annual/generate-pdf", params, {
      responseType: "blob",
    });
    return response.data;
  }

  // Admin: every report card for a term/year, sourced from the local DB.
  static async listAdminStudents(params: {
    term: string;
    academic_year: string;
  }): Promise<AdminReportCardStudentsResponse> {
    const response = await axios.get("/report-cards/admin/students", { params });
    return response.data;
  }

  // Admin: status counts + per-category + per-subject averages for a term/year.
  static async getAdminSummary(params: {
    term: string;
    academic_year: string;
  }): Promise<AdminReportCardSummaryResponse> {
    const response = await axios.get("/report-cards/admin/summary", { params });
    return response.data;
  }
}

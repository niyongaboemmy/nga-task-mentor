import axios from "../utils/axiosConfig";

export interface HubSubject {
  id: number;
  name: string;
  code: string | null;
}

export interface SubjectBankStats {
  subject_id: number;
  subject_name: string;
  subject_code: string | null;
  total: number;
  mine: number;
  easy: number;
  medium: number;
  difficult: number;
  no_difficulty: number;
  with_explanation: number;
  blooms_classified: number;
  higher_order: number;
  sow_linked: number;
  topics_covered: number;
  used_in_quizzes: number;
  added_7d: number;
  added_30d: number;
  last_added_at: string | null;
  health_score: number;
}

export type BankTotals = Omit<SubjectBankStats, "subject_id" | "subject_name" | "subject_code">;

export type AlertSeverity = "critical" | "warning" | "info" | "success";

export interface BankAlert {
  id: string;
  severity: AlertSeverity;
  subject_id: number | null;
  title: string;
  message: string;
}

export interface QuestionBankOverview {
  generated_at: string;
  subject_id: number | null;
  available_subjects: HubSubject[];
  totals: BankTotals;
  subjects: SubjectBankStats[];
  by_type: { type: string; count: number }[];
  by_blooms: { level_id: number | null; name: string; level_order: number | null; count: number }[];
  top_topics: { title: string; count: number }[];
  most_used: { id: number; subject_id: number; question_text: string; question_type: string; uses: number }[];
  trend: { week_start: string; count: number }[];
  alerts: BankAlert[];
}

export const QuestionBankHubApiService = {
  async getOverview(subjectId?: number | null): Promise<QuestionBankOverview> {
    const res = await axios.get("/question-bank/overview", {
      params: subjectId ? { subjectId } : {},
    });
    return res.data.data;
  },
};

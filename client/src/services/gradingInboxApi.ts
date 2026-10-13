import api from "../utils/axiosConfig";

/** To grade (GET /dashboard/instructor/grading-inbox). */
export interface GradingInboxItem {
  id: number;
  kind: "assignment" | "quiz" | string;
  title: string;
  subject: { id: number; name: string; code: string | null };
  to_grade: number;
  late: number;
  due_at: string | null;
  waiting_days: number;
  oldest_at: string | null;
  code: boolean;
  grade_url: string;
}

export interface GradingInbox {
  items: GradingInboxItem[];
  total_to_grade: number;
  generated_at: string;
}

export async function fetchGradingInbox(fresh = false): Promise<GradingInbox> {
  const res = await api.get("/dashboard/instructor/grading-inbox", { params: fresh ? { fresh: 1 } : undefined });
  return res.data.data as GradingInbox;
}

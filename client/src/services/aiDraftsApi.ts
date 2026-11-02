import api from "../utils/axiosConfig";

/**
 * AI drafts saved by the person's own Claude / ChatGPT through the NGA connector
 * (server: integration/mcpTools.ts, GET/PATCH /api/ai/drafts). Drafts only: the teacher
 * confirms each one here (adds the questions, loads the rubric, uses the feedback).
 */

export type AiDraftKind = "questions" | "rubric" | "feedback";
export type AiDraftStatus = "draft" | "applied" | "discarded";

export interface AiDraft {
  id: number;
  kind: AiDraftKind;
  course_id: number | null;
  assignment_id: number | null;
  submission_id: number | null;
  title: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the shape depends on `kind`
  payload: any;
  status: AiDraftStatus;
  source: string;
  created_at: string;
}

export async function listAiDrafts(filter: { kind?: AiDraftKind; submission_id?: number | string; assignment_id?: number | string } = {}): Promise<AiDraft[]> {
  const res = await api.get("/ai/drafts", { params: filter });
  return (res.data?.data as AiDraft[]) ?? [];
}

export async function getAiDraft(id: number | string): Promise<AiDraft> {
  const res = await api.get(`/ai/drafts/${id}`);
  return res.data.data as AiDraft;
}

export async function setAiDraftStatus(id: number, status: "applied" | "discarded"): Promise<void> {
  await api.patch(`/ai/drafts/${id}`, { status });
}

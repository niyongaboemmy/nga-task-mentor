import axios from "../utils/axiosConfig";
import type { QuestionType, DifficultyLevel } from "../types/quiz.types";

// AI Question Generator: prepare a source (upload or MIS resources) once, then
// run generation batches against its context_id. Nothing is saved until the
// teacher confirms through QuestionBankApiService.bulkCreateCourseQuestions.

export type AIProviderName = "gemini" | "groq" | "glm" | "openai";

export interface AIProviderInfo {
  name: AIProviderName;
  label: string;
  model: string;
  configured: boolean;
  cooling_down: boolean;
  order: number | null;
}

export type AISourceKind =
  | "competency"
  | "sow_entry"
  | "lesson_plan"
  | "lesson_note"
  | "material"
  | "elearning_item";

export interface AISourceItem {
  kind: AISourceKind;
  id: string;
  title: string;
  subtitle?: string;
  week?: string | null;
  meta?: string[];
  chars_estimate?: number;
  supported: boolean;
  reason?: string;
}

export type AISourceGroupKey =
  | "curriculum"
  | "weeks"
  | "lesson_plans"
  | "notes"
  | "materials"
  | "elearning";

export interface AISourceGroup {
  key: AISourceGroupKey;
  label: string;
  status: "ok" | "unavailable";
  message?: string;
  items: AISourceItem[];
}

export interface AISourcesResponse {
  scope: {
    subject_name: string | null;
    class_group_id: number | null;
    academic_term_id: number | null;
    class_groups: { id: number; name: string }[];
  };
  groups: AISourceGroup[];
}

export interface AIPreparedContext {
  context_id: string;
  origin: "document" | "resources";
  label: string;
  char_count: number;
  truncated: boolean;
  parts: { kind: string; id: string; title: string; chars: number }[];
  preview: string;
  expires_in_seconds: number;
  missing?: { kind: string; id: string; reason: string }[];
}

export interface AIPlanItem {
  question_type: QuestionType;
  EASY: number;
  MEDIUM: number;
  DIFFICULT: number;
}

export interface AIGeneratedQuestion {
  question_type: QuestionType;
  question_text: string;
  question_data: Record<string, unknown>;
  correct_answer?: unknown;
  explanation?: string;
  difficulty_level: DifficultyLevel;
  tags?: string[];
  time_limit_seconds?: number;
}

export interface AIBatchResult {
  data: AIGeneratedQuestion[];
  meta: {
    requested: number;
    returned: number;
    skipped: { question_type: string; reason: string }[];
    provider_used: string;
    provider_requested: string | null;
    fell_back: boolean;
    duration_ms: number;
    context_id: string;
  };
}

const root = (courseId: number) => `/courses/${courseId}/question-bank/ai`;

export const AIQuestionGenerationApi = {
  async providers(courseId: number) {
    const res = await axios.get(`${root(courseId)}/providers`);
    return res.data.data as { providers: AIProviderInfo[]; any_available: boolean };
  },

  async sources(courseId: number, params: { class_group_id?: number } = {}) {
    const res = await axios.get(`${root(courseId)}/sources`, { params, timeout: 60_000 });
    return res.data.data as AISourcesResponse;
  },

  async prepareDocument(courseId: number, file: File, signal?: AbortSignal) {
    const form = new FormData();
    form.append("file", file);
    const res = await axios.post(`${root(courseId)}/prepare/document`, form, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 120_000,
      signal,
    });
    return res.data.data as AIPreparedContext;
  },

  async prepareResources(
    courseId: number,
    body: { sources: { kind: AISourceKind; id: string }[]; class_group_id?: number },
    signal?: AbortSignal,
  ) {
    const res = await axios.post(`${root(courseId)}/prepare/resources`, body, {
      timeout: 120_000,
      signal,
    });
    return res.data.data as AIPreparedContext;
  },

  async generate(
    courseId: number,
    body: {
      context_id: string;
      plan: AIPlanItem[];
      additional_context?: string;
      provider?: AIProviderName | null;
      avoid_questions?: string[];
    },
    signal?: AbortSignal,
  ) {
    const res = await axios.post(`${root(courseId)}/generate`, body, {
      timeout: 180_000,
      signal,
    });
    return res.data as AIBatchResult;
  },
};

interface HttpishError {
  code?: string;
  name?: string;
  message?: string;
  response?: { status?: number; data?: { message?: string; code?: string } };
}

/** Best human message out of an axios error from these endpoints. */
export function aiErrorMessage(e: unknown, fallback = "Something went wrong. Please try again."): string {
  const err = e as HttpishError | undefined;
  if (err?.code === "ERR_CANCELED" || err?.name === "CanceledError") return "Cancelled";
  if (err?.code === "ECONNABORTED") return "The AI took too long to answer. Try fewer questions per run.";
  return err?.response?.data?.message || err?.message || fallback;
}

export const httpStatus = (e: unknown) => (e as HttpishError | undefined)?.response?.status;

export const isContextExpired = (e: unknown) =>
  httpStatus(e) === 410 || (e as HttpishError | undefined)?.response?.data?.code === "CONTEXT_EXPIRED";

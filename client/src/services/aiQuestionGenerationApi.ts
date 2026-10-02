import axios from "../utils/axiosConfig";
import type { QuestionType, DifficultyLevel } from "../types/quiz.types";

// AI Question Generator: prepare a source (upload or MIS resources) once, then
// run generation batches against its context_id. Nothing is saved until the
// teacher confirms through QuestionBankApiService.bulkCreateCourseQuestions.

export type AIProviderName = "gemini" | "groq" | "glm" | "openai" | "deepseek";

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
  /** Bloom's level 1-6, already aligned to the difficulty by the server. */
  blooms_level?: number | null;
  blooms_taxonomy_level_id?: number | null;
  blooms_level_name?: string | null;
  blooms_adjusted?: boolean;
}

export interface AIBloomLevel {
  id: number;
  name: string;
  level_order: number;
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
    blooms_adjusted?: number;
    blooms_levels?: AIBloomLevel[];
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

  /**
   * Runs one batch as a server-side job and polls until it finishes. The AI
   * provider chain can outlast the reverse proxy's 60 s read timeout, so the
   * request that starts the job returns at once (202 + job_id). A non-2xx
   * final state rejects like an axios error, so callers see the same shape
   * (e.g. 410 CONTEXT_EXPIRED) either way.
   */
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
    opts: { pollMs?: number; maxWaitMs?: number } = {},
  ): Promise<AIBatchResult> {
    const pollMs = opts.pollMs ?? 2000;
    const deadline = Date.now() + (opts.maxWaitMs ?? 6 * 60_000);
    const start = await axios.post(`${root(courseId)}/generate`, { ...body, async: true }, { timeout: 30_000, signal });
    if (start.status !== 202 || !start.data?.job_id) return start.data as AIBatchResult;

    const jobUrl = `${root(courseId)}/jobs/${start.data.job_id}`;
    let blips = 0;
    for (;;) {
      await wait(pollMs, signal);
      if (Date.now() > deadline) {
        throw Object.assign(new Error("The AI is taking unusually long. Try fewer questions, or another AI engine."), { code: "ECONNABORTED" });
      }
      try {
        const res = await axios.get(jobUrl, { timeout: 30_000, signal });
        blips = 0;
        if (res.data?.state === "running") continue;
        return res.data as AIBatchResult;
      } catch (err) {
        const e = err as HttpishError;
        // A dropped poll (no response at all) is retried a few times; real answers are not.
        if (!e?.response && e?.name !== "CanceledError" && e?.code !== "ERR_CANCELED" && ++blips <= 5) continue;
        throw err;
      }
    }
  },
};

function wait(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(Object.assign(new Error("canceled"), { name: "CanceledError", code: "ERR_CANCELED" }));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(Object.assign(new Error("canceled"), { name: "CanceledError", code: "ERR_CANCELED" }));
      },
      { once: true },
    );
  });
}

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
  if (err?.code === "ECONNABORTED") return err?.message && !/timeout of/i.test(err.message) ? err.message : "The AI took too long to answer. Try fewer questions per run.";
  if (!err?.response && /network error/i.test(err?.message || "")) return "Lost connection to the server. Check your internet and try again.";
  return err?.response?.data?.message || err?.message || fallback;
}

export const httpStatus = (e: unknown) => (e as HttpishError | undefined)?.response?.status;

export const isContextExpired = (e: unknown) =>
  httpStatus(e) === 410 || (e as HttpishError | undefined)?.response?.data?.code === "CONTEXT_EXPIRED";

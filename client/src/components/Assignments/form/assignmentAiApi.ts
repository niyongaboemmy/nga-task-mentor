import api, { isAxiosError } from "../../../utils/axiosConfig";
import type { AiAnswer } from "../../../services/myAiApi";
import type { RubricCriterion } from "../AssignmentCard";

export interface GeneratedRubric {
  criteria: RubricCriterion[];
  source: "description" | "generated";
  total: number;
  note: string;
  provider_used: string;
  /** What answered (My AI). */
  ai?: AiAnswer | null;
}

export async function generateRubric(params: {
  title: string;
  description: string;
  max_score: number;
  criteria_count?: number | null;
  instructions?: string;
  /** My AI: a one-off choice from AiSourceControl ("" = the person's default). */
  aiRoute?: string;
}): Promise<GeneratedRubric> {
  try {
    // AI providers can take a while on free tiers.
    const res = await api.post("/assignments/ai/rubric", params, { timeout: 120_000 });
    return res.data.data;
  } catch (err) {
    const ax = isAxiosError(err) ? err : null;
    throw new Error(
      ax?.response?.data?.message ||
        (ax?.code === "ECONNABORTED" ? "The AI took too long to answer. Try again." : "Could not generate the rubric."),
    );
  }
}

import OpenAI from "openai";
import { AIProvider, GenerateJSONParams } from "./types";
import { matchesSchema } from "./schemaValidator";

// Ported from nga_central_mis/backend/src/services/aiProviders/glmProvider.ts
const isConfigured = () => !!process.env.GLM_API_KEY;

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.GLM_API_KEY,
      baseURL: "https://api.z.ai/api/paas/v4",
      timeout: 150_000,
    });
  }
  return client;
}

export const glmProvider: AIProvider = {
  name: "glm",
  isConfigured,
  // GLM's json_object mode guarantees valid JSON, not schema-matching JSON (no
  // constrained decoding) — the schema is only conveyed via the prompt, so the
  // response must be checked against it after the fact (see matchesSchema below).
  supportsStrictSchema: false,

  async generateJSON<T = any>(params: GenerateJSONParams): Promise<T> {
    const model = process.env.GLM_MODEL || "glm-4.5-flash";

    const completion = await getClient().chat.completions.create({
      model,
      thinking: { type: "disabled" },
      ...(params.maxOutputTokens ? { max_tokens: params.maxOutputTokens } : {}),
      messages: [
        {
          role: "system",
          content: `Respond with ONLY a single JSON object matching this JSON Schema — no markdown fences, no commentary, no explanation:\n${JSON.stringify(params.schema)}`,
        },
        { role: "user", content: params.prompt },
      ],
      response_format: { type: "json_object" },
    } as any);

    const text = completion.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(text) as T;

    if (!matchesSchema(parsed, params.schema)) {
      throw new Error("GLM response did not match the expected schema");
    }

    return parsed;
  },

  async generateText(prompt: string, maxOutputTokens?: number): Promise<string> {
    const model = process.env.GLM_MODEL || "glm-4.5-flash";
    const completion = await getClient().chat.completions.create({
      model,
      thinking: { type: "disabled" },
      ...(maxOutputTokens ? { max_tokens: maxOutputTokens } : {}),
      messages: [{ role: "user", content: prompt }],
    } as any);
    return completion.choices[0]?.message?.content || "";
  },
};

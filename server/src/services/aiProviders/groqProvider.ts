import OpenAI from "openai";
import { AIProvider, GenerateJSONParams } from "./types";
import { toStrictJsonSchema } from "./strictJsonSchema";

// Ported from nga_central_mis/backend/src/services/aiProviders/groqProvider.ts
const isConfigured = () => !!process.env.GROQ_API_KEY;

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
      timeout: 60_000,
    });
  }
  return client;
}

export const groqProvider: AIProvider = {
  name: "groq",
  isConfigured,
  supportsStrictSchema: true,

  async generateJSON<T = any>(params: GenerateJSONParams): Promise<T> {
    const model = process.env.GROQ_MODEL || "openai/gpt-oss-20b";

    const completion = await getClient().chat.completions.create({
      model,
      messages: [{ role: "user", content: params.prompt }],
      // gpt-oss models spend part of the completion budget on internal reasoning tokens
      // before the actual JSON — reasoning_effort:"low" keeps more of that budget for
      // the actual content. Free-tier Groq accounts also cap tokens-per-minute fairly
      // low, so this stays capped rather than always maxing out maxOutputTokens.
      max_completion_tokens: Math.min(params.maxOutputTokens ?? 3000, 6000),
      reasoning_effort: "low",
      response_format: {
        type: "json_schema",
        json_schema: {
          name: params.schemaName || "response",
          strict: true,
          schema: toStrictJsonSchema(params.schema),
        },
      } as any,
    } as any);

    const text = completion.choices[0]?.message?.content || "{}";
    return JSON.parse(text) as T;
  },

  async generateText(prompt: string, maxOutputTokens?: number): Promise<string> {
    const model = process.env.GROQ_MODEL || "openai/gpt-oss-20b";
    const completion = await getClient().chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
      max_completion_tokens: Math.min(maxOutputTokens ?? 3000, 6000),
      reasoning_effort: "low",
    } as any);
    return completion.choices[0]?.message?.content || "";
  },
};

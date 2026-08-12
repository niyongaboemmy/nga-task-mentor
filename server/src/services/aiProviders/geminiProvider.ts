import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { AIProvider, GenerateJSONParams, JSONSchema } from "./types";

// Ported from nga_central_mis/backend/src/services/aiProviders/geminiProvider.ts,
// adapted to the @google/generative-ai SDK already used elsewhere in this app
// (rather than @google/genai, to avoid adding a second Gemini client dependency).
const isConfigured = () =>
  !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "your_gemini_api_key_here";

const GEMINI_TYPE_MAP: Record<JSONSchema["type"], SchemaType> = {
  object: SchemaType.OBJECT,
  string: SchemaType.STRING,
  array: SchemaType.ARRAY,
  number: SchemaType.NUMBER,
  boolean: SchemaType.BOOLEAN,
};

function toGeminiSchema(schema: JSONSchema): any {
  const out: any = { type: GEMINI_TYPE_MAP[schema.type] };
  if (schema.description) out.description = schema.description;
  if (schema.properties) {
    out.properties = {};
    for (const [key, value] of Object.entries(schema.properties)) {
      out.properties[key] = toGeminiSchema(value);
    }
  }
  if (schema.items) out.items = toGeminiSchema(schema.items);
  if (schema.required) out.required = schema.required;
  return out;
}

const getClient = () => new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const getModelName = () => process.env.GEMINI_MODEL || "gemini-2.5-flash";

export const geminiProvider: AIProvider = {
  name: "gemini",
  isConfigured,
  supportsStrictSchema: true,

  async generateJSON<T = any>(params: GenerateJSONParams): Promise<T> {
    const model = getClient().getGenerativeModel({
      model: getModelName(),
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: toGeminiSchema(params.schema),
        ...(params.maxOutputTokens ? { maxOutputTokens: params.maxOutputTokens } : {}),
      },
    });
    const result = await model.generateContent(params.prompt);
    return JSON.parse(result.response.text() || "{}") as T;
  },

  async generateText(prompt: string, maxOutputTokens?: number): Promise<string> {
    const model = getClient().getGenerativeModel({
      model: getModelName(),
      ...(maxOutputTokens ? { generationConfig: { maxOutputTokens } } : {}),
    });
    const result = await model.generateContent(prompt);
    return result.response.text() || "";
  },
};

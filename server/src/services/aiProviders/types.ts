// Plain JSON-Schema (subset) shared across all AI providers, so callers describe the
// shape they want once and each provider adapter translates it into whatever request
// format that vendor needs (Gemini's responseSchema, OpenAI-style json_schema, etc).
// Ported from nga_central_mis/backend/src/services/aiProviders.
export type JSONSchemaType = "object" | "string" | "array" | "number" | "boolean";

export interface JSONSchema {
  type: JSONSchemaType;
  description?: string;
  properties?: Record<string, JSONSchema>;
  items?: JSONSchema;
  required?: string[];
}

export interface GenerateJSONParams {
  prompt: string;
  schema: JSONSchema;
  /** Short machine name for the schema (used by providers that require a json_schema "name", e.g. Groq/OpenAI). */
  schemaName?: string;
  /** Output token budget hint — providers default this low, raise it for larger content. */
  maxOutputTokens?: number;
}

export interface AIProvider {
  name: string;
  /** Whether this provider has the env vars it needs (an API key, etc). */
  isConfigured(): boolean;
  /**
   * true only for providers that guarantee the response matches `schema` via constrained
   * decoding. false for providers that only guarantee valid JSON (e.g. GLM's json_object
   * mode) — those need a runtime shape check on the response, see schemaValidator.ts.
   */
  supportsStrictSchema: boolean;
  generateJSON<T = any>(params: GenerateJSONParams): Promise<T>;
  /**
   * Plain-text completion, for operations whose output shape is too polymorphic to
   * describe as a fixed JSON Schema (e.g. quiz questions generated from a document,
   * where question_data/correct_answer differ per question type). Callers parse the
   * result themselves (see generateFreeformJSON in generate.ts for the JSON case).
   */
  generateText(prompt: string, maxOutputTokens?: number): Promise<string>;
}

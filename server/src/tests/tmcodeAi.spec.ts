/**
 * TMCode AI's routing and quota (tmcode/ai/service.ts): Free uses OpenRouter's free models,
 * Auto picks free tiers with requests left (OpenRouter's real counter, kept in reserve for chat
 * only), a chosen model must be free, and completions come back clean.
 */
import { AiError, cleanCompletion, plan, resetAiUsage, userLimit } from "../tmcode/ai/service";

const env = { ...process.env };
let remaining = 46;

beforeEach(() => {
  resetAiUsage();
  process.env = { ...env, OPENROUTER_API_KEY: "or", GROQ_API_KEY: "gq", GEMINI_API_KEY: "", GLM_API_KEY: "", OPENROUTER_MODELS: "nvidia/nemotron-3-super-120b-a12b:free,openrouter/free,some/paid-model" };
  remaining = 46;
  global.fetch = jest.fn(async () => ({ json: async () => ({ data: { free_model_daily_requests: { used: 50 - remaining, limit: 50, remaining } } }) })) as never;
});
afterAll(() => {
  process.env = env;
});

describe("TMCode AI plan", () => {
  it("Free (default) uses OpenRouter's free models only, the paid id dropped", async () => {
    const steps = await plan("chat", "free");
    expect(steps).toHaveLength(1);
    expect(steps[0].provider).toBe("openrouter");
    expect([steps[0].model, ...(steps[0].fallbacks ?? [])]).toEqual(["nvidia/nemotron-3-super-120b-a12b:free", "openrouter/free"]);
  });

  it("Auto prefers the other free tiers and keeps OpenRouter for chat; inline completions never use it", async () => {
    expect((await plan("chat", "auto")).map((s) => s.provider)).toEqual(["groq", "openrouter"]);
    expect((await plan("complete", "auto")).map((s) => s.provider)).toEqual(["groq"]);
    // Free mode's inline completions go through Auto's fast models too (the shared pool is for chat).
    expect((await plan("complete", "free")).map((s) => s.provider)).toEqual(["groq"]);
  });

  it("Auto leaves OpenRouter out when the school's shared free requests are nearly gone", async () => {
    remaining = 8;
    expect((await plan("chat", "auto")).map((s) => s.provider)).toEqual(["groq"]);
  });

  it("a chosen model must be free and available", async () => {
    expect(await plan("chat", "groq/openai/gpt-oss-20b")).toEqual([{ provider: "groq", model: "openai/gpt-oss-20b" }]);
    await expect(plan("chat", "openrouter/some/paid-model")).rejects.toMatchObject({ code: "MODEL_NOT_FREE" });
    await expect(plan("chat", "gemini/gemini-2.5-flash")).rejects.toBeInstanceOf(AiError);
  });

  it("each student has a daily allowance", () => {
    expect(userLimit("chat")).toBe(40);
    process.env.TMCODE_AI_CHAT_PER_DAY = "5";
    expect(userLimit("chat")).toBe(5);
  });
});

describe("cleanCompletion", () => {
  it("drops fences and echoes of the code around the cursor", () => {
    expect(cleanCompletion("```js\na + b;\n```", "  return ", "\n}")).toBe("a + b;");
    expect(cleanCompletion("  return a + b;", "function f() {\n  return ", "")).toBe("a + b;");
  });
});

/**
 * TMCode AI's paid tiers and AI grading, without the database (GRADING_PREMIUM_CONTRACTS.md):
 * mode parsing, premium models from the env, the premium allowance, BYOK keys used for the
 * request only and scrubbed from every error, the free-only guard kept for free modes only,
 * the premium entitlement rule, and the grading draft's JSON extraction and clamping.
 */
const create = jest.fn();
const OpenAIMock = jest.fn().mockImplementation(() => ({ chat: { completions: { create } } }));
jest.mock("openai", () => OpenAIMock);

import {
  paidFailure,
  paidStep,
  parseMode,
  premiumModels,
  premiumUsed,
  resetAiUsage,
  scrubSecrets,
  streamChat,
  complete,
  userUsed,
  AiError,
} from "../tmcode/ai/service";
import { effectiveEntitlement } from "../services/aiEntitlements";
import { extractJson, normalizeDraft, snap } from "../tmcode/ai/grading";
import { draftFiles, DRAFT_MAX_FILES } from "../controllers/tmcodeGradingAi.controller";
import { buildMessages } from "../controllers/tmcodeAi.controller";
import { resetAiPolicyCache, setAiPolicyForTests } from "../services/aiPolicy";
import { AI_POLICY_DEFAULT } from "../vendor/nga-access";

const KEY = "sk-ant-user-secret-key-0123456789";
const env = { ...process.env };

beforeAll(() => setAiPolicyForTests({ ...AI_POLICY_DEFAULT, v: 1, enabled: true }));
afterAll(() => {
  resetAiPolicyCache();
  process.env = env;
});
beforeEach(() => {
  resetAiUsage();
  create.mockReset();
  OpenAIMock.mockClear();
  process.env = {
    ...env,
    OPENROUTER_API_KEY: "or",
    GROQ_API_KEY: "gq",
    GEMINI_API_KEY: "",
    GLM_API_KEY: "",
    OPENAI_API_KEY: "",
    ANTHROPIC_API_KEY: "",
    DEEPSEEK_API_KEY: "",
    TMCODE_AI_PREMIUM_MODELS: "openai/gpt-4.1, anthropic/claude-sonnet-4-5, openrouter/anthropic/claude-sonnet-4.5, nope/x",
    TMCODE_AI_PREMIUM_OPENAI_KEY: "sk-school-openai-0123456789",
    TMCODE_AI_PREMIUM_PER_DAY: "",
  };
  global.fetch = jest.fn(async () => ({ json: async () => ({ data: { free_model_daily_requests: { used: 4, limit: 50, remaining: 46 } } }) })) as never;
});

async function* chunks(list: unknown[]) {
  for (const c of list) yield c;
}
const signal = () => new AbortController().signal;

describe("modes", () => {
  it("parses free, premium and byok modes", () => {
    expect(parseMode("free")).toEqual({ tier: "free", mode: "free" });
    expect(parseMode("groq/openai/gpt-oss-20b")).toEqual({ tier: "free", mode: "groq/openai/gpt-oss-20b" });
    expect(parseMode("premium:openai/gpt-4.1")).toEqual({ tier: "premium", provider: "openai", model: "gpt-4.1" });
    expect(parseMode("byok:openrouter/anthropic/claude-sonnet-4.5")).toEqual({ tier: "byok", provider: "openrouter", model: "anthropic/claude-sonnet-4.5" });
    expect(parseMode("byok:")).toMatchObject({ tier: "byok", provider: "" });
  });

  it("offers only premium models whose provider has a key (school key, else the provider's usual one)", () => {
    expect(premiumModels().map((m) => m.id)).toEqual(["premium:openai/gpt-4.1", "premium:openrouter/anthropic/claude-sonnet-4.5"]);
    process.env.ANTHROPIC_API_KEY = "sk-ant-school-0123456789";
    expect(premiumModels().map((m) => m.id)).toContain("premium:anthropic/claude-sonnet-4-5");
    expect(premiumModels()[0]).toEqual({ id: "premium:openai/gpt-4.1", label: "gpt-4.1", provider: "openai", providerLabel: "OpenAI" });
  });

  it("a paid step needs what the caller allowed", () => {
    expect(() => paidStep("premium:openai/gpt-4.1", undefined)).toThrow(expect.objectContaining({ code: "PREMIUM_REQUIRED", status: 403 }));
    expect(() => paidStep("premium:openai/unknown", { tier: "premium", limit: 5 })).toThrow(expect.objectContaining({ code: "MODEL_UNKNOWN" }));
    expect(() => paidStep("byok:anthropic/claude-sonnet-4-5", undefined)).toThrow(expect.objectContaining({ code: "BYOK_KEY_REQUIRED" }));
    expect(() => paidStep("byok:anthropic/claude-sonnet-4-5", { tier: "byok", provider: "openai", key: KEY })).toThrow(expect.objectContaining({ code: "BYOK_KEY_REQUIRED" }));
    expect(paidStep("byok:anthropic/claude-sonnet-4-5", { tier: "byok", provider: "anthropic", key: KEY })).toMatchObject({ tier: "byok", provider: "anthropic", model: "claude-sonnet-4-5" });
  });
});

describe("BYOK keys", () => {
  it("scrubs the key and anything key-like", () => {
    expect(scrubSecrets(`bad key ${KEY} here`, KEY)).toBe("bad key *** here");
    expect(scrubSecrets("Incorrect API key provided: sk-proj-abcdefghijklmnop")).toBe("Incorrect API key provided: ***");
    expect(scrubSecrets("key AIzaSyA0123456789abcdefghijklmnop")).toBe("key ***");
    expect(scrubSecrets("Authorization: Bearer abc.def-123456789")).toBe("Authorization: Bearer ***");
  });

  it("a provider's refusal is BYOK_REJECTED, the key never in the message", () => {
    const e = paidFailure({ status: 401, message: `401 Incorrect API key provided: ${KEY}` }, { tier: "byok", provider: "anthropic", key: KEY });
    expect(e).toBeInstanceOf(AiError);
    expect(e.code).toBe("BYOK_REJECTED");
    expect(e.message).not.toContain(KEY);
    expect(e.message).toMatch(/refused your API key/);
    expect(paidFailure({ status: 429, message: "quota" }, { tier: "byok", provider: "openai", key: KEY }).code).toBe("BYOK_REJECTED");
    expect(paidFailure({ status: 500 }, { tier: "byok", provider: "openai", key: KEY }).code).toBe("PROVIDER_FAILED");
  });

  it("streams with the user's key and provider endpoint, counts nothing on the free allowances, logs nothing", async () => {
    const logs = [jest.spyOn(console, "error").mockImplementation(() => {}), jest.spyOn(console, "log").mockImplementation(() => {}), jest.spyOn(console, "warn").mockImplementation(() => {})];
    create.mockResolvedValueOnce(chunks([{ model: "claude-sonnet-4-5", choices: [{ delta: { content: "Hi" } }] }]));
    let text = "";
    const r = await streamChat(9, "byok:anthropic/claude-sonnet-4-5", [{ role: "user", content: "x" }], () => {}, (t) => (text += t), signal(), undefined, { access: { tier: "byok", provider: "anthropic", key: KEY } });
    expect(r).toEqual({ provider: "anthropic", model: "claude-sonnet-4-5", tier: "byok" });
    expect(text).toBe("Hi");
    expect(OpenAIMock).toHaveBeenLastCalledWith(expect.objectContaining({ apiKey: KEY, baseURL: "https://api.anthropic.com/v1/" }));
    expect(userUsed(9, "chat")).toBe(0);

    create.mockRejectedValueOnce(Object.assign(new Error(`401 invalid x-api-key ${KEY}`), { status: 401 }));
    const err = await streamChat(9, "byok:anthropic/claude-sonnet-4-5", [{ role: "user", content: "x" }], () => {}, () => {}, signal(), undefined, { access: { tier: "byok", provider: "anthropic", key: KEY } }).catch((e) => e);
    expect(err).toMatchObject({ code: "BYOK_REJECTED" });
    expect(err.message).not.toContain(KEY);
    for (const spy of logs) for (const call of spy.mock.calls) expect(JSON.stringify(call)).not.toContain(KEY);
    logs.forEach((s) => s.mockRestore());
  });

  it("completions use the user's key too", async () => {
    create.mockResolvedValueOnce({ choices: [{ message: { content: "a + b;" } }] });
    const r = await complete(9, "byok:openai/gpt-4.1-mini", { prefix: "return ", suffix: "", language: "js", path: "a.js" }, signal(), { access: { tier: "byok", provider: "openai", key: KEY } });
    expect(r).toMatchObject({ text: "a + b;", provider: "openai", tier: "byok" });
    expect(OpenAIMock).toHaveBeenLastCalledWith(expect.objectContaining({ apiKey: KEY, baseURL: "https://api.openai.com/v1" }));
  });
});

describe("premium", () => {
  it("bypasses the free-only guard, and counts against the user's premium allowance", async () => {
    create.mockResolvedValue(chunks([{ model: "anthropic/claude-sonnet-4.5", usage: { cost: 0.01 }, choices: [{ delta: { content: "ok" } }] }]));
    const access = { tier: "premium" as const, limit: 1 };
    const r = await streamChat(11, "premium:openrouter/anthropic/claude-sonnet-4.5", [{ role: "user", content: "x" }], () => {}, () => {}, signal(), undefined, { access });
    expect(r).toEqual({ provider: "openrouter", model: "anthropic/claude-sonnet-4.5", tier: "premium" });
    expect(premiumUsed(11)).toBe(1);
    expect(userUsed(11, "chat")).toBe(0);
    await expect(streamChat(11, "premium:openrouter/anthropic/claude-sonnet-4.5", [{ role: "user", content: "x" }], () => {}, () => {}, signal(), undefined, { access })).rejects.toMatchObject({ code: "PREMIUM_QUOTA", status: 429 });
  });

  it("the free modes keep the free-only guard", async () => {
    create.mockResolvedValue(chunks([{ model: "some/paid-model", choices: [{ delta: { content: "x" } }] }]));
    await expect(streamChat(12, "free", [{ role: "user", content: "x" }], () => {}, () => {}, signal())).rejects.toMatchObject({ code: "NOT_FREE" });
  });

  it("premium completions go to the free Auto models", async () => {
    create.mockResolvedValueOnce({ choices: [{ message: { content: "1;" } }] });
    const r = await complete(13, "premium:openai/gpt-4.1", { prefix: "x = ", suffix: "", language: "js", path: "a.js" }, signal(), { access: { tier: "premium", limit: 5 } });
    expect(r).toMatchObject({ provider: "groq", tier: "free" });
    expect(premiumUsed(13)).toBe(0);
  });

  it("entitlement: the role permission or a granted row; the row's limit, else the env default", () => {
    expect(effectiveEntitlement(false, null)).toEqual({ entitled: false, via: null, limit: 50 });
    expect(effectiveEntitlement(true, null)).toEqual({ entitled: true, via: "role", limit: 50 });
    expect(effectiveEntitlement(false, { premium: true, daily_limit: 7 } as any)).toEqual({ entitled: true, via: "grant", limit: 7 });
    expect(effectiveEntitlement(false, { premium: false, daily_limit: 7 } as any).entitled).toBe(false);
    process.env.TMCODE_AI_PREMIUM_PER_DAY = "20";
    expect(effectiveEntitlement(true, { premium: false, daily_limit: null } as any)).toEqual({ entitled: true, via: "role", limit: 20 });
  });
});

describe("grading chat purpose", () => {
  const input = (purpose?: string) =>
    ({
      mode: "free",
      messages: [{ role: "user", content: "grade it" }],
      context: { purpose, grading: { activity_title: "Flexbox page", brief: "<p>Build a <strong>flex</strong> layout</p>", rubric: [{ index: 0, criteria: "Layout", max_score: 4 }], student_name: "Ada" } },
    }) as any;

  it("staff get the teacher's grading prompt with the rubric; anyone else the student tutor", () => {
    const staff = buildMessages(input("grading"), true)[0].content as string;
    expect(staff).toMatch(/helping a TEACHER/);
    expect(staff).toMatch(/propose_grade/);
    expect(staff).toMatch(/0\. Layout \(max 4\)/);
    expect(staff).toMatch(/Build a flex layout/);
    const student = buildMessages(input("grading"), false)[0].content as string;
    expect(student).not.toMatch(/TEACHER/);
    expect(student).toMatch(/Help the student learn/);
    expect(buildMessages(input(undefined), true)[0].content).toMatch(/Help the student learn/);
  });
});

describe("grading draft JSON", () => {
  const rubric = [
    { index: 0, criteria: "Layout", max_score: 4 },
    { index: 1, criteria: "Code quality", max_score: 3 },
  ];

  it("extracts the JSON from fences, prose and trailing commas", () => {
    expect(extractJson('```json\n{"a": 1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Here is the draft: {"a": {"b": "}"}, "c": [1,2,],} Hope it helps')).toEqual({ a: { b: "}" }, c: [1, 2] });
    expect(extractJson("no json at all")).toBeNull();
  });

  it("clamps to each criterion's max in half points, fills missing criteria, ignores the overall score with a rubric", () => {
    const d = normalizeDraft(
      { rubric_scores: [{ index: 0, score: 9, comment: "src/app.css:3" }, { index: 1, score: "1.3" }], score: 99, feedback: "Good work", teacher_notes: "Check tests", confidence: "HIGH" },
      rubric,
      7,
    )!;
    expect(d.rubric_scores).toEqual([
      { index: 0, score: 4, comment: "src/app.css:3" },
      { index: 1, score: 1.5, comment: "" },
    ]);
    expect(d.score).toBeNull();
    expect(d.confidence).toBe("high");
    expect(normalizeDraft({ rubric_scores: [{ score: -2, comment: "x" }], feedback: "f" }, rubric, 7)!.rubric_scores[0].score).toBe(0);
    expect(normalizeDraft({ rubric_scores: [{ score: 3 }], feedback: "f" }, rubric, 7)!.warnings[0]).toMatch(/no score for 1 criterion/);
  });

  it("uses the overall score without a rubric; refuses an empty answer", () => {
    expect(normalizeDraft({ score: 12.74, feedback: "ok", off_topic: true }, [], 10)).toMatchObject({ score: 10, rubric_scores: [], warnings: ["The AI thinks this work may not answer the brief."] });
    expect(normalizeDraft({ overall_score: 6.2, feedback: "ok" }, [], 10)!.score).toBe(6);
    expect(normalizeDraft({}, rubric, 7)).toBeNull();
    expect(normalizeDraft("nope", rubric, 7)).toBeNull();
    expect(snap(2.26, 3)).toBe(2.5);
  });

  it("reads text files only, within the caps (no dependencies, no binaries)", async () => {
    const entries = [
      { path: "node_modules/x/index.js", sha256: "a", size: 10 },
      { path: "logo.png", sha256: "b", size: 10 },
      { path: "README.md", sha256: "c", size: 10 },
      { path: "src/app.js", sha256: "d", size: 10 },
      { path: "data.bin.txt", sha256: "e", size: 10 },
      { path: "big.js", sha256: "f", size: 150 * 1024 },
      ...Array.from({ length: 70 }, (_, i) => ({ path: `src/m${String(i).padStart(2, "0")}.py`, sha256: `m${i}`, size: 10 })),
    ];
    const read = async (sha: string) => (sha === "e" ? Buffer.from([0, 1, 2]) : Buffer.from(`content ${sha}`));
    const r = await draftFiles(entries, read);
    expect(r.files.length).toBe(DRAFT_MAX_FILES);
    expect(r.files[0].path).toBe("src/app.js");
    expect(r.files.map((f) => f.path)).not.toContain("node_modules/x/index.js");
    expect(r.files.map((f) => f.path)).not.toContain("logo.png");
    expect(r.files.map((f) => f.path)).not.toContain("big.js");
    expect(r.skipped).toBe(entries.length - DRAFT_MAX_FILES);
  });
});

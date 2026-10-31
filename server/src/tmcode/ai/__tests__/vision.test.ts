import { canSeeImages, hasImages, visionSteps, type ChatMessage } from "../service";
import { ChatSchema, MAX_CHAT_IMAGES } from "../../../controllers/tmcodeAi.controller";

const png = "data:image/png;base64,iVBORw0KGgo=";

describe("TMCode AI: questions with images", () => {
  afterEach(() => {
    delete process.env.TMCODE_AI_VISION_MODELS;
  });

  it("knows which models read images", () => {
    expect(canSeeImages("gemini", "gemini-2.5-flash")).toBe(true);
    expect(canSeeImages("openrouter", "google/gemma-3-27b-it:free")).toBe(true);
    expect(canSeeImages("openrouter", "meta-llama/llama-4-maverick:free")).toBe(true);
    expect(canSeeImages("openrouter", "qwen/qwen2.5-vl-72b-instruct:free")).toBe(true);
    expect(canSeeImages("anthropic", "claude-sonnet-4-5")).toBe(true);
    expect(canSeeImages("openai", "o3")).toBe(true);
    expect(canSeeImages("groq", "openai/gpt-oss-20b")).toBe(false);
    expect(canSeeImages("glm", "glm-4.5-flash")).toBe(false);
    expect(canSeeImages("openrouter", "deepseek/deepseek-r1:free")).toBe(false);
    expect(canSeeImages("openrouter", "meta-llama/llama-3.3-70b-instruct:free")).toBe(false);
    process.env.TMCODE_AI_VISION_MODELS = "glm/glm-4.5-flash, some-model";
    expect(canSeeImages("glm", "glm-4.5-flash")).toBe(true);
    expect(canSeeImages("x", "some-model")).toBe(true);
  });

  it("finds images in messages", () => {
    const text: ChatMessage[] = [{ role: "user", content: "hi" }];
    const withImage: ChatMessage[] = [{ role: "user", content: [{ type: "text", text: "what is this?" }, { type: "image_url", image_url: { url: png } }] }];
    expect(hasImages(text)).toBe(false);
    expect(hasImages(withImage)).toBe(true);
  });

  it("keeps only the steps (and fallbacks) that read images", () => {
    const steps = [
      { provider: "groq", model: "openai/gpt-oss-20b" },
      { provider: "openrouter", model: "deepseek/deepseek-r1:free", fallbacks: ["google/gemma-3-27b-it:free", "mistralai/mistral-7b:free"] },
      { provider: "gemini", model: "gemini-2.5-flash" },
    ];
    expect(visionSteps(steps)).toEqual([
      { provider: "openrouter", model: "google/gemma-3-27b-it:free", fallbacks: [] },
      { provider: "gemini", model: "gemini-2.5-flash" },
    ]);
    expect(visionSteps([{ provider: "groq", model: "openai/gpt-oss-20b" }])).toEqual([]);
  });

  it("accepts text and image parts, up to the image limit, data: URLs only", () => {
    const ask = (content: unknown) => ChatSchema.safeParse({ messages: [{ role: "user", content }] }).success;
    expect(ask("plain text")).toBe(true);
    expect(ask([{ type: "text", text: "look" }, { type: "image_url", image_url: { url: png } }])).toBe(true);
    expect(ask([{ type: "image_url", image_url: { url: "https://evil.example/x.png" } }])).toBe(false);
    expect(ask([{ type: "image_url", image_url: { url: "data:image/svg+xml;base64,PHN2Zz4=" } }])).toBe(false);
    const many = Array.from({ length: MAX_CHAT_IMAGES + 1 }, () => ({ type: "image_url", image_url: { url: png } }));
    expect(ask(many)).toBe(false);
    expect(ask(many.slice(0, MAX_CHAT_IMAGES))).toBe(true);
  });
});

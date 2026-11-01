const create = jest.fn();
const OpenAIMock = jest.fn().mockImplementation(() => ({ chat: { completions: { create } } }));
jest.mock("openai", () => OpenAIMock);

import { PAID_PROVIDERS, verifyOwnKey } from "../service";
import { buildMessages, ChatSchema, TERMINAL_SYSTEM } from "../../../controllers/tmcodeAi.controller";

const KEY = "sk-ant-user-terminal-0123456789abcdef";

describe("TMCode AI in the terminal", () => {
  it("answers terminal questions with the terminal prompt (JSON commands), never for agents", () => {
    const input = ChatSchema.parse({ messages: [{ role: "user", content: "list big files" }], context: { purpose: "terminal" } });
    const [system] = buildMessages(input);
    expect(system).toMatchObject({ role: "system" });
    expect(system.content).toContain(TERMINAL_SYSTEM);
    expect(TERMINAL_SYSTEM).toContain('"risk"');
    // A student can ask for it too (it isn't a staff-only purpose like grading).
    expect(buildMessages(input, false)[0].content).toContain("integrated terminal");
    const agent = ChatSchema.parse({ messages: [{ role: "user", content: "x" }], context: { purpose: "terminal" }, agent: { mode: "plan", step: 0, tools: [] } });
    expect(buildMessages(agent)[0].content).not.toContain(TERMINAL_SYSTEM);
  });
});

describe("Test key (own API keys)", () => {
  beforeEach(() => {
    create.mockReset();
    OpenAIMock.mockClear();
  });

  it("asks the provider for one tiny answer with the user's key, on the cheap check model unless one is named", async () => {
    create.mockResolvedValueOnce({ model: "claude-haiku-5-5" });
    await expect(verifyOwnKey("anthropic", KEY, undefined)).resolves.toEqual({ provider: "anthropic", model: "claude-haiku-5-5" });
    expect(OpenAIMock).toHaveBeenLastCalledWith(expect.objectContaining({ apiKey: KEY, baseURL: PAID_PROVIDERS.anthropic.baseURL }));
    expect(create.mock.calls[0][0]).toMatchObject({ model: PAID_PROVIDERS.anthropic.check, max_tokens: 16 });
    create.mockResolvedValueOnce({});
    await expect(verifyOwnKey("openai", KEY, "gpt-4.1")).resolves.toEqual({ provider: "openai", model: "gpt-4.1" });
  });

  it("turns a refusal into BYOK_REJECTED without the key in the words", async () => {
    create.mockRejectedValueOnce(Object.assign(new Error(`401 invalid x-api-key: ${KEY}`), { status: 401 }));
    const err = await verifyOwnKey("anthropic", KEY, undefined).catch((e) => e);
    expect(err.code).toBe("BYOK_REJECTED");
    expect(err.message).toContain("refused your API key");
    expect(err.message).not.toContain(KEY);
    create.mockRejectedValueOnce(Object.assign(new Error("model not found"), { status: 404 }));
    expect((await verifyOwnKey("openai", KEY, "gpt-9").catch((e) => e)).message).toContain("doesn't know that model");
  });

  it("suggests current Claude models", () => {
    expect(PAID_PROVIDERS.anthropic.suggested).toEqual(["claude-sonnet-5-5", "claude-haiku-5-5", "claude-opus-5-5"]);
  });
});

describe("answer in my language (H3)", () => {
  it("asks the model to reply in the chosen language", () => {
    const input = ChatSchema.parse({ messages: [{ role: "user", content: "hi" }], context: { reply_language: "Kinyarwanda" } });
    expect(buildMessages(input)[0].content).toContain("Reply in Kinyarwanda. Keep English programming keywords");
    expect(ChatSchema.safeParse({ messages: [{ role: "user", content: "hi" }], context: { reply_language: "Klingon" } }).success).toBe(false);
  });
});

describe("Industrial · Guided scaffolds (A6, E7)", () => {
  it("agents explain each step and leave TODO(you) gaps; plain chat and Learning don't", () => {
    const agent = { mode: "edit" as const, step: 0, tools: [] };
    const guided = ChatSchema.parse({ messages: [{ role: "user", content: "build it" }], agent, context: { scaffolds: true } });
    expect(buildMessages(guided)[0].content).toContain("TODO(you)");
    const chatOnly = ChatSchema.parse({ messages: [{ role: "user", content: "hi" }], context: { scaffolds: true } });
    expect(buildMessages(chatOnly)[0].content).not.toContain("TODO(you)");
  });
});

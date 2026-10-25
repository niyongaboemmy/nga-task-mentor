/**
 * TMCode AI's agent (tmcode/ai/service.ts): its routing (the best free tool-caller first), its own
 * daily step allowance, and tool calls rebuilt from the pieces providers stream.
 */
const create = jest.fn();
jest.mock("openai", () => jest.fn().mockImplementation(() => ({ chat: { completions: { create } } })));

import { plan, resetAiUsage, streamChat, userLimit, userUsed } from "../tmcode/ai/service";
import { resetAiPolicyCache, setAiPolicyForTests } from "../services/aiPolicy";
import { AI_POLICY_DEFAULT } from "../vendor/nga-access";

// AI usage control: these tests exercise AI with the school's AI policy switched on.
beforeAll(() => setAiPolicyForTests({ ...AI_POLICY_DEFAULT, v: 1, enabled: true }));
afterAll(() => resetAiPolicyCache());

const env = { ...process.env };
beforeEach(() => {
  resetAiUsage();
  create.mockReset();
  process.env = { ...env, OPENROUTER_API_KEY: "or", GROQ_API_KEY: "gq", GEMINI_API_KEY: "", GLM_API_KEY: "" };
  global.fetch = jest.fn(async () => ({ json: async () => ({ data: { free_model_daily_requests: { used: 4, limit: 50, remaining: 46 } } }) })) as never;
});
afterAll(() => {
  process.env = env;
});

async function* chunks(list: unknown[]) {
  for (const c of list) yield c;
}

it("Auto sends agents to Groq's gpt-oss-120b first, OpenRouter's shared pool last", async () => {
  const steps = await plan("agent", "auto");
  expect(steps.map((s) => [s.provider, s.model])).toEqual([
    ["groq", "openai/gpt-oss-120b"],
    ["openrouter", "nvidia/nemotron-3-super-120b-a12b:free"],
  ]);
  expect(userLimit("agent")).toBe(300);
});

it("rebuilds streamed tool calls; the first step is a question, the next ones agent steps", async () => {
  create.mockResolvedValueOnce(
    chunks([
      { model: "openai/gpt-oss-120b", choices: [{ delta: { tool_calls: [{ index: 0, id: "fc_1", function: { name: "edit_", arguments: "" } }] } }] },
      { choices: [{ delta: { tool_calls: [{ index: 0, function: { name: "file", arguments: '{"path":"app.js",' } }] } }] },
      { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '"old_text":"a","new_text":"b"}' } }] } }] },
    ]),
  );
  const tools = [{ type: "function" as const, function: { name: "edit_file" } }];
  const r = await streamChat(7, "auto", [{ role: "user", content: "rename" }], () => {}, () => {}, new AbortController().signal, { tools, step: 0 });
  expect(r.tool_calls).toEqual([{ id: "fc_1", type: "function", function: { name: "edit_file", arguments: '{"path":"app.js","old_text":"a","new_text":"b"}' } }]);
  expect(create.mock.calls[0][0]).toMatchObject({ model: "openai/gpt-oss-120b", tools, tool_choice: "auto" });
  expect(userUsed(7, "chat")).toBe(1);

  create.mockResolvedValueOnce(chunks([{ model: "openai/gpt-oss-120b", choices: [{ delta: { content: "Done." } }] }]));
  let text = "";
  const r2 = await streamChat(7, "auto", [{ role: "user", content: "rename" }], () => {}, (t) => (text += t), new AbortController().signal, { tools, step: 1 });
  expect(text).toBe("Done.");
  expect(r2.tool_calls).toBeUndefined();
  expect(userUsed(7, "chat")).toBe(1);
  expect(userUsed(7, "agent")).toBe(1);
});

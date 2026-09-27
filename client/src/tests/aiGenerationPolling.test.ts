import { describe, it, expect, vi, beforeEach } from "vitest";

const { post, get } = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn() }));
vi.mock("../utils/axiosConfig", () => ({ default: { post, get } }));

import { AIQuestionGenerationApi, aiErrorMessage } from "../services/aiQuestionGenerationApi";

const body = { context_id: "c", plan: [{ question_type: "true_false" as const, EASY: 1, MEDIUM: 0, DIFFICULT: 0 }] };
const result = { success: true, data: [{ question_text: "Q" }], meta: { returned: 1 }, state: "done" };
const fast = { pollMs: 1 };

beforeEach(() => {
  post.mockReset();
  get.mockReset();
});

describe("AIQuestionGenerationApi.generate (background job + polling)", () => {
  it("starts an async job and polls until it's done", async () => {
    post.mockResolvedValue({ status: 202, data: { job_id: "j1" } });
    get.mockResolvedValueOnce({ data: { state: "running" } }).mockResolvedValueOnce({ data: result });
    const res = await AIQuestionGenerationApi.generate(9, body, undefined, fast);
    expect(post.mock.calls[0][1]).toMatchObject({ async: true, context_id: "c" });
    expect(get).toHaveBeenCalledWith("/courses/9/question-bank/ai/jobs/j1", expect.anything());
    expect(res.data).toHaveLength(1);
  });

  it("rides out a dropped poll but surfaces a real error answer", async () => {
    post.mockResolvedValue({ status: 202, data: { job_id: "j1" } });
    get
      .mockRejectedValueOnce(Object.assign(new Error("Network Error"), { code: "ERR_NETWORK" }))
      .mockResolvedValueOnce({ data: result });
    await expect(AIQuestionGenerationApi.generate(9, body, undefined, fast)).resolves.toMatchObject({ success: true });

    const gone = Object.assign(new Error("x"), { response: { status: 410, data: { code: "CONTEXT_EXPIRED" } } });
    get.mockRejectedValueOnce(gone);
    await expect(AIQuestionGenerationApi.generate(9, body, undefined, fast)).rejects.toBe(gone);
  });

  it("stops polling when cancelled", async () => {
    post.mockResolvedValue({ status: 202, data: { job_id: "j1" } });
    get.mockResolvedValue({ data: { state: "running" } });
    const ctrl = new AbortController();
    const p = AIQuestionGenerationApi.generate(9, body, ctrl.signal, { pollMs: 20 });
    setTimeout(() => ctrl.abort(), 5);
    const err = await p.catch((e) => e);
    expect(aiErrorMessage(err)).toBe("Cancelled");
  });

  it("gives up with a clear message instead of spinning forever", async () => {
    post.mockResolvedValue({ status: 202, data: { job_id: "j1" } });
    get.mockResolvedValue({ data: { state: "running" } });
    const err = await AIQuestionGenerationApi.generate(9, body, undefined, { pollMs: 5, maxWaitMs: 12 }).catch((e) => e);
    expect(aiErrorMessage(err)).toMatch(/taking unusually long/);
  });

  it("explains a lost connection in plain words", () => {
    expect(aiErrorMessage(new Error("Network Error"))).toBe("Lost connection to the server. Check your internet and try again.");
  });
});

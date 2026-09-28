import type { AIProvider } from "../types";

// The real cooldown bookkeeping, but a scripted provider list.
const providers: AIProvider[] = [];
jest.mock("../registry", () => {
  const actual = jest.requireActual("../registry");
  return {
    ...actual,
    orderedProviders: (order?: string[]) =>
      order ? order.map((n) => providers.find((p) => p.name === n)!).filter(Boolean) : providers,
  };
});

import { generateFreeformJSON } from "../generate";
import { isCoolingDown } from "../registry";

const fake = (name: string, reply: () => Promise<string>): AIProvider => ({
  name,
  isConfigured: () => true,
  supportsStrictSchema: false,
  generateJSON: jest.fn(),
  generateText: jest.fn(reply),
});
const err = (message: string, status?: number) => Object.assign(new Error(message), { status });

beforeEach(() => {
  providers.length = 0;
});

describe("provider fallback", () => {
  it("moves to the next AI when one hits its quota, and parks it", async () => {
    providers.push(
      fake("fq1", () => Promise.reject(err("429 RESOURCE_EXHAUSTED: quota exceeded", 429))),
      fake("fq2", () => Promise.resolve('[{"q":1}]')),
    );
    const res = await generateFreeformJSON("p");
    expect(res).toEqual({ data: [{ q: 1 }], providerUsed: "fq2" });
    expect(isCoolingDown("fq1")).toBe(true);
  });

  it("skips a dead key / empty billing, bad JSON and timeouts until one answers", async () => {
    providers.push(
      fake("fd1", () => Promise.reject(err("401 Invalid API Key", 401))),
      fake("fd2", () => Promise.reject(err("429 You have no credits remaining", 429))),
      fake("fd3", () => Promise.resolve("sorry, not JSON")),
      fake("fd4", () => Promise.reject(err("Request timed out."))),
      fake("fd5", () => Promise.resolve('```json\n[{"q":2}]\n```')),
    );
    const res = await generateFreeformJSON("p");
    expect(res.providerUsed).toBe("fd5");
    expect(isCoolingDown("fd1")).toBe(true);
    expect(isCoolingDown("fd2")).toBe(true);
    expect(isCoolingDown("fd3")).toBe(false); // a bad reply isn't a reason to park it
  });

  it("does not call a parked provider again", async () => {
    const p1 = fake("fp1", () => Promise.reject(err("429 quota", 429)));
    const p2 = fake("fp2", () => Promise.resolve("[]"));
    providers.push(p1, p2);
    await generateFreeformJSON("p");
    await generateFreeformJSON("p");
    expect(p1.generateText).toHaveBeenCalledTimes(1);
    expect(p2.generateText).toHaveBeenCalledTimes(2);
  });

  it("tries the preferred provider first but still falls back", async () => {
    providers.push(
      fake("fa", () => Promise.resolve('[{"from":"a"}]')),
      fake("fb", () => Promise.reject(err("429 rate limit", 429))),
    );
    const res = await generateFreeformJSON("p", undefined, { providerOrder: ["fb", "fa"] });
    expect(res.providerUsed).toBe("fa");
  });

  it("gives a friendly message when every AI is out of quota", async () => {
    providers.push(fake("fz1", () => Promise.reject(err("429 quota exceeded", 429))));
    await expect(generateFreeformJSON("p")).rejects.toThrow(/temporarily rate-limited/);
  });
});

import { parseLenientJson } from "../generate";
import { isDeadProviderError, isQuotaError } from "../errors";

describe("parseLenientJson", () => {
  it("parses clean JSON and fenced JSON", () => {
    expect(parseLenientJson('[{"a":1}]')).toEqual([{ a: 1 }]);
    expect(parseLenientJson('```json\n[{"a":1}]\n```')).toEqual([{ a: 1 }]);
  });

  it("salvages complete questions from a reply cut off mid-object", () => {
    const truncated =
      '[{"question_text":"One {with braces}","n":1},{"question_text":"Two \\"quoted\\"","n":2},{"question_text":"Thr';
    expect(parseLenientJson(truncated)).toEqual([
      { question_text: "One {with braces}", n: 1 },
      { question_text: 'Two "quoted"', n: 2 },
    ]);
  });

  it("skips one malformed element but keeps the rest", () => {
    const bad = '[{"n":1},{"n": 2 "oops": 3},{"n":3}]';
    expect(parseLenientJson(bad)).toEqual([{ n: 1 }, { n: 3 }]);
  });

  it("still fails loudly when nothing is usable", () => {
    expect(() => parseLenientJson("sorry, I can't")).toThrow("AI response was not valid JSON");
  });
});

describe("provider error classification", () => {
  it("treats bad keys and empty billing as dead, rate limits as temporary", () => {
    expect(isDeadProviderError(Object.assign(new Error("401 Invalid API Key"), { status: 401 }))).toBe(true);
    expect(isDeadProviderError(new Error("429 You have no credits remaining. Add credits to continue"))).toBe(true);
    expect(isDeadProviderError(new Error("429 Rate limit reached, retry in 20s"))).toBe(false);
    expect(isQuotaError(new Error("429 Rate limit reached"))).toBe(true);
  });
});

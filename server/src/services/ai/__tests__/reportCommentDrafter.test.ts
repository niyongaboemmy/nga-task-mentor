jest.mock("../../aiProviders", () => ({ generateStructuredContent: jest.fn() }));
import { generateStructuredContent } from "../../aiProviders";
import { band, buildCommentPrompt, cleanComment, draftComment, NAME_TOKEN } from "../reportCommentDrafter";

const ai = generateStructuredContent as jest.Mock;
const input = {
  term: "Term 1",
  academicYear: "2026-2027",
  subjects: [{ name: "Mathematics", score: 82 }, { name: "English", score: 54 }, { name: "Biology", score: null }],
  attributes: [{ attribute_name: "Punctuality", rating: "Excellent" }],
  attendance: "present" as const,
};

describe("report comment drafter", () => {
  beforeEach(() => ai.mockReset());

  it("bands totals like teachers do", () => {
    expect([band(85), band(72), band(64), band(51), band(30)]).toEqual(["excellent", "very good", "good", "fair", "needs support"]);
  });

  it("builds a prompt with results (best first), ratings and the name token, no real name", () => {
    const p = buildCommentPrompt({ ...input, tone: "encouraging" });
    expect(p.indexOf("Mathematics: 82/100 (excellent)")).toBeLessThan(p.indexOf("English: 54/100 (fair)"));
    expect(p).not.toContain("Biology");
    expect(p).toContain("AVERAGE: 68/100");
    expect(p).toContain("Punctuality: Excellent");
    expect(p).toContain(NAME_TOKEN);
    expect(buildCommentPrompt({ ...input, subjects: [], tone: "balanced" })).toContain("no marks recorded yet");
  });

  it("normalises name placeholders and whitespace", () => {
    expect(cleanComment("  {name} has   worked hard.\n[Student's name] should read more. ")).toBe("[NAME] has worked hard. [NAME] should read more.");
  });

  it("returns the cleaned comment and refuses when there is nothing to go on", async () => {
    ai.mockResolvedValue({ providerUsed: "glm", data: { comment: "[student name] shows real strength in Mathematics and should now practise English reading daily." } });
    const d = await draftComment(input);
    expect(d).toEqual({ comment: "[NAME] shows real strength in Mathematics and should now practise English reading daily.", provider_used: "glm" });
    ai.mockClear();
    await expect(draftComment({ ...input, subjects: [], attributes: [] })).rejects.toMatchObject({ statusCode: 400 });
    expect(ai).not.toHaveBeenCalled();
    ai.mockResolvedValue({ providerUsed: "glm", data: { comment: "Good." } });
    await expect(draftComment(input)).rejects.toMatchObject({ statusCode: 502 });
    ai.mockRejectedValue(new Error("busy"));
    await expect(draftComment(input)).rejects.toMatchObject({ statusCode: 503 });
  });
});

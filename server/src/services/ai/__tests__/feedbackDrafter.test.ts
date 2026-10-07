jest.mock("../../aiProviders", () => ({ generateStructuredContent: jest.fn() }));
import { generateStructuredContent } from "../../aiProviders";
import { buildFeedbackPrompt, draftFeedback, snap, workText, WORK_BUDGET } from "../feedbackDrafter";

const ai = generateStructuredContent as jest.Mock;
const rubric = [
  { criteria: "Understanding", description: "Explains photosynthesis correctly", max_score: 6 },
  { criteria: "Presentation", max_score: 4 },
];
const base = { title: "Photosynthesis", description: "<p>Explain photosynthesis.</p>", maxScore: 10, rubric, text: "<p>Plants use light to make glucose.</p>", files: [], unread: [] };

describe("feedback drafter", () => {
  beforeEach(() => ai.mockReset());

  it("snaps scores to half marks within the maximum", () => {
    expect(snap(4.3, 6)).toBe(4.5);
    expect(snap(9, 6)).toBe(6);
    expect(snap(-2, 6)).toBe(0);
    expect(snap("x", 6)).toBe(0);
  });

  it("joins the typed answer and readable files within budget", () => {
    const w = workText("<p>Hello</p>", [{ name: "essay.pdf", text: "Body" }, { name: "empty.docx", text: "  " }]);
    expect(w.text).toBe('TYPED ANSWER:\nHello\n\nFILE "essay.pdf":\nBody');
    expect(workText("x".repeat(WORK_BUDGET + 10), []).truncated).toBe(true);
  });

  it("never puts the student's name in the prompt and asks for 'you' feedback", () => {
    const p = buildFeedbackPrompt({ title: "T", description: "D", maxScore: 10, rubric, work: "W", truncated: false, tone: "encouraging" });
    expect(p).toContain("0. Understanding (max 6): Explains photosynthesis correctly");
    expect(p).toContain("Warm and encouraging");
    expect(p).not.toMatch(/student name/i);
  });

  it("turns the AI reply into rubric_scores that can't exceed the maxima", async () => {
    ai.mockResolvedValue({
      providerUsed: "groq",
      data: {
        criteria: [
          { index: 1, score: 9, comment: "Neat" },
          { index: 0, score: 4.2, comment: "Mentions light and glucose, not chlorophyll" },
        ],
        overall_score: 99,
        feedback: "You explained the main idea clearly.",
        strengths: ["Clear", "Concise", "Accurate", "Extra"],
        next_steps: ["Mention chlorophyll"],
        confidence: "high",
        off_topic: false,
      },
    });
    const d = await draftFeedback(base);
    expect(d.rubric_scores).toEqual({ 0: 4, 1: 4 });
    expect(d.score).toBe(8);
    expect(d.criteria[0]).toMatchObject({ criteria: "Understanding", score: 4, max_score: 6 });
    expect(d.strengths).toHaveLength(3);
    expect(d.provider_used).toBe("groq");
    expect(d.warnings).toEqual([]);
  });

  it("uses one overall score without a rubric, and warns about unread files and off-topic work", async () => {
    ai.mockResolvedValue({ providerUsed: "gemini", data: { criteria: [], overall_score: 7.3, feedback: "Good start.", strengths: [], next_steps: [], confidence: "weird", off_topic: true } });
    const d = await draftFeedback({ ...base, rubric: [], unread: ["photo.jpg"] });
    expect(d.score).toBe(7.5);
    expect(d.rubric_scores).toEqual({});
    expect(d.confidence).toBe("medium");
    expect(d.warnings.join(" ")).toMatch(/photo\.jpg/);
    expect(d.warnings.join(" ")).toMatch(/may not answer/);
  });

  it("refuses empty work without calling the AI, and maps provider failures to 503", async () => {
    await expect(draftFeedback({ ...base, text: "", unread: ["scan.png"] })).rejects.toMatchObject({ statusCode: 400 });
    expect(ai).not.toHaveBeenCalled();
    ai.mockRejectedValue(new Error("All AI providers are busy"));
    await expect(draftFeedback(base)).rejects.toMatchObject({ statusCode: 503, message: "All AI providers are busy" });
  });
});

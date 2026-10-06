import { distributeMarks, buildRubricPrompt } from "../rubricGenerator";

const sum = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) * 100) / 100;

describe("distributeMarks", () => {
  it("keeps marks the description already gave when they add up", () => {
    expect(distributeMarks([4, 3, 3], 10)).toEqual([4, 3, 3]);
  });

  it("rescales weights that add up to something else (e.g. percentages)", () => {
    const marks = distributeMarks([40, 30, 20, 10], 10);
    expect(marks).toEqual([4, 3, 2, 1]);
  });

  it("always adds up to exactly the maximum, in whole marks", () => {
    for (const total of [7, 10, 13, 20, 25, 50, 100]) {
      const marks = distributeMarks([3, 3, 3], total);
      expect(sum(marks)).toBe(total);
      marks.forEach((m) => expect(Number.isInteger(m)).toBe(true));
    }
  });

  it("gives every criterion at least one mark when the total allows", () => {
    const marks = distributeMarks([100, 1, 1, 1], 10);
    expect(sum(marks)).toBe(10);
    marks.forEach((m) => expect(m).toBeGreaterThanOrEqual(1));
  });

  it("falls back to an even split for missing or bad weights", () => {
    expect(distributeMarks([NaN, 0, -2, NaN, 0], 10)).toEqual([2, 2, 2, 2, 2]);
  });

  it("uses half marks when there are fewer marks than criteria", () => {
    const marks = distributeMarks([1, 1, 1, 1], 2);
    expect(marks).toEqual([0.5, 0.5, 0.5, 0.5]);
  });

  it("puts a fractional total's remainder on the largest criterion", () => {
    const marks = distributeMarks([2, 1, 1], 7.5);
    expect(sum(marks)).toBe(7.5);
    expect(marks[0]).toBe(Math.max(...marks));
  });

  it("handles empty input", () => {
    expect(distributeMarks([], 10)).toEqual([]);
  });
});

describe("buildRubricPrompt", () => {
  it("asks for the teacher's own criteria and the exact total", () => {
    const prompt = buildRubricPrompt({ title: "UI task", text: "Rubric: Layout 4, Colors 3", maxScore: 10, criteriaCount: 4 });
    expect(prompt).toContain("TOTAL MARKS: 10");
    expect(prompt).toContain("exactly 4 criteria");
    expect(prompt).toContain("Rubric: Layout 4, Colors 3");
  });
});

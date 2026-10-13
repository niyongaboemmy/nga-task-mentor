import { assignmentMaxPoints } from "../maxPoints";

describe("assignmentMaxPoints", () => {
  it("uses the assignment's max score", () => {
    expect(assignmentMaxPoints(20, [])).toBe(20);
  });
  it("falls back to the criteria's sum, then 100 (one final grade)", () => {
    expect(assignmentMaxPoints(0, [{ max_score: 12 }, { max_score: 8 }])).toBe(20);
    expect(assignmentMaxPoints(0, [])).toBe(100);
    expect(assignmentMaxPoints(NaN, [])).toBe(100);
  });
});

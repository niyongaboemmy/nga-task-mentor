import { studentRubricScores, submissionWindow, typedRubric } from "../brief";

const rubric = typedRubric([
  { criteria: "Layout", max_score: 4 },
  { criteria: "Layout and spacing", max_score: 3, description: "Gaps" },
]);

describe("typedRubric", () => {
  it("types the stored rubric (JSON text or array) and drops junk", () => {
    expect(rubric).toEqual([
      { criteria: "Layout", description: null, max_score: 4 },
      { criteria: "Layout and spacing", description: "Gaps", max_score: 3 },
    ]);
    expect(typedRubric(JSON.stringify([{ criteria: " A ", max_score: "2" }, { criteria: "" }, null]))).toEqual([
      { criteria: "A", description: null, max_score: 2 },
    ]);
    expect(typedRubric("not json")).toEqual([]);
    expect(typedRubric(null)).toEqual([]);
    expect(typedRubric({ criteria: "x" })).toEqual([]);
  });
});

describe("studentRubricScores", () => {
  const feedback = "Well done\n\nCriteria notes:\n• Layout and spacing: Tighten the gaps\n• Layout: Good";
  it("is null until the work is graded", () => {
    expect(studentRubricScores(null, rubric)).toBeNull();
    expect(studentRubricScores({ status: "submitted", rubric_scores: { 0: 4 }, feedback }, rubric)).toBeNull();
  });
  it("gives each scored criterion with its note from the feedback", () => {
    expect(studentRubricScores({ status: "graded", rubric_scores: '{"0":4,"1":2}', feedback }, rubric)).toEqual([
      { index: 0, score: 4, comment: "Good" },
      { index: 1, score: 2, comment: "Tighten the gaps" },
    ]);
    expect(studentRubricScores({ status: "graded", rubric_scores: { 1: 3 }, feedback: "Fine" }, rubric)).toEqual([
      { index: 1, score: 3, comment: null },
    ]);
  });
  it("is null when the grade didn't use the rubric", () => {
    expect(studentRubricScores({ status: "graded", rubric_scores: null, feedback }, rubric)).toBeNull();
    expect(studentRubricScores({ status: "graded", rubric_scores: {}, feedback }, rubric)).toBeNull();
  });
});

describe("submissionWindow", () => {
  it("takes late work until the teacher closes the assignment", () => {
    expect(submissionWindow("published")).toEqual({ accepts_submissions: true, late_policy: "until_closed", accepts_late_until: null });
    expect(submissionWindow("completed").accepts_submissions).toBe(false);
    expect(submissionWindow("draft").accepts_submissions).toBe(false);
  });
});

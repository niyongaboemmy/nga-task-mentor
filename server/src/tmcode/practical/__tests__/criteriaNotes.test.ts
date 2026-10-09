import { composeFeedback, overallFeedback, parseCriteriaNotes, rubricScoresWithComments } from "../criteriaNotes";

const RUBRIC = [{ criteria: "Layout" }, { criteria: "Layout and spacing" }, { criteria: "Styling" }];

describe("criteria notes in the feedback", () => {
  it("round-trips the notes through the composed feedback", () => {
    const scores = [
      { index: 0, score: 2, comment: "Header is off" },
      { index: 1, score: 1, comment: "Too tight\nespecially on mobile" },
      { index: 2, score: 3, comment: null },
    ];
    const text = composeFeedback("Good work", RUBRIC, scores);
    expect(text).toBe("Good work\n\nCriteria notes:\n• Layout: Header is off\n• Layout and spacing: Too tight\nespecially on mobile");
    const notes = parseCriteriaNotes(text, RUBRIC);
    expect([...notes.entries()]).toEqual([
      [0, "Header is off"],
      [1, "Too tight\nespecially on mobile"],
    ]);
    expect(overallFeedback(text)).toBe("Good work");
  });

  it("doesn't repeat an old notes block that came back in the feedback", () => {
    const text = composeFeedback("Fine\n\nCriteria notes:\n• Layout: old", RUBRIC, [{ index: 0, score: 1, comment: "new" }]);
    expect(text).toBe("Fine\n\nCriteria notes:\n• Layout: new");
  });

  it("notes only, and criteria no longer in the rubric", () => {
    const text = composeFeedback("", [], [{ index: 3, score: 1, comment: "gone" }]);
    expect(text).toBe("Criteria notes:\n• Criterion 4: gone");
    expect(parseCriteriaNotes(text, []).get(3)).toBe("gone");
    expect(parseCriteriaNotes("No notes here", RUBRIC).size).toBe(0);
    expect(parseCriteriaNotes(null, RUBRIC).size).toBe(0);
  });
});

describe("rubricScoresWithComments", () => {
  const feedback = "Ok\n\nCriteria notes:\n• Styling: Clean CSS";

  it("turns the stored index→score map into { index, score, comment } with the parsed notes", () => {
    expect(rubricScoresWithComments({ 2: 3, 0: 1 }, feedback, RUBRIC)).toEqual([
      { index: 0, score: 1, comment: null },
      { index: 2, score: 3, comment: "Clean CSS" },
    ]);
    expect(rubricScoresWithComments('{"0":1}', null, RUBRIC)).toEqual([{ index: 0, score: 1, comment: null }]);
  });

  it("keeps stored comments (quiz practicals) and fills the missing ones", () => {
    expect(
      rubricScoresWithComments([{ index: 0, score: 1, comment: "Neat" }, { index: 2, score: 3 }], feedback, RUBRIC),
    ).toEqual([
      { index: 0, score: 1, comment: "Neat" },
      { index: 2, score: 3, comment: "Clean CSS" },
    ]);
  });

  it("is null without scores", () => {
    expect(rubricScoresWithComments(null, feedback, RUBRIC)).toBeNull();
    expect(rubricScoresWithComments("not json", feedback, RUBRIC)).toBeNull();
  });
});

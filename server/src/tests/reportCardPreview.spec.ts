import { buildProvisionalCard, suggestedCategory } from "../services/reportCardPreview.service";

/** Provisional report card rules (GET /api/report-cards/preview/:studentId). */

describe("suggestedCategory", () => {
  it("places recorded marks by their type", () => {
    expect(suggestedCategory("class_work")).toBe("CW");
    expect(suggestedCategory("group_work")).toBe("CW");
    expect(suggestedCategory("participation")).toBe("CW");
    expect(suggestedCategory("homework")).toBe("HW");
    expect(suggestedCategory("midterm")).toBe("MD");
    expect(suggestedCategory("ca_end_of_term")).toBe("EOT");
    expect(suggestedCategory(null)).toBeNull();
    expect(suggestedCategory("something_else")).toBeNull();
  });
});

describe("buildProvisionalCard", () => {
  const scores = new Map([
    ["quiz:1", { raw_score: 8, max_score: 10 }], // CW 80%
    ["manual:5", { raw_score: 30, max_score: 50 }], // MD 60%
    ["assignment:9", { raw_score: 5, max_score: 10 }], // other subject
  ]);

  const card = buildProvisionalCard(
    [
      {
        subject_id: 1,
        name: "Maths",
        source: "subject_mapping",
        items: [
          { assessment_type: "quiz", assessment_id: 1, category: "CW", title: "Quiz 1" },
          { assessment_type: "quiz", assessment_id: 2, category: "CW", title: "Quiz 2" },
          { assessment_type: "manual", assessment_id: 5, category: "MD", title: "Midterm" },
          { assessment_type: "manual", assessment_id: 6, category: "EOT", title: "Final exam" },
        ],
      },
      { subject_id: 2, name: "Physics", source: "none", items: [] },
      {
        subject_id: 3,
        name: "Chemistry",
        source: "suggested",
        items: [{ assessment_type: "manual", assessment_id: 7, category: "HW", title: "HW 1" }],
      },
    ],
    scores,
  );

  it("grades only recorded marks and lists what's pending", () => {
    const maths = card.subjects[0];
    // CW: only quiz 1 recorded (80% of 15 = 12). MD: 60% of 25 = 15. EOT pending.
    expect(card.grades).toHaveLength(1);
    expect(card.grades[0].total_score).toBe(27);
    expect(maths).toMatchObject({
      expected: 4,
      recorded: 2,
      completeness: 50,
      weight_covered: 40,
      total_so_far: 27,
      running_percentage: 67.5,
      source: "subject_mapping",
    });
    expect(maths.categories).toEqual({
      CW: { expected: 2, recorded: 1, weight: 15 },
      MD: { expected: 1, recorded: 1, weight: 25 },
      EOT: { expected: 1, recorded: 0, weight: 50 },
    });
    expect(maths.pending).toEqual([
      { title: "Quiz 2", kind: "quiz", category: "CW" },
      { title: "Final exam", kind: "manual", category: "EOT" },
    ]);
  });

  it("keeps subjects with nothing mapped or nothing recorded, without a grade", () => {
    expect(card.subjects[1]).toMatchObject({ expected: 0, recorded: 0, completeness: null, total_so_far: null, running_percentage: null });
    expect(card.subjects[2]).toMatchObject({ expected: 1, recorded: 0, completeness: 0, total_so_far: null });
  });

  it("summarises the whole card", () => {
    expect(card.overall).toEqual({
      subjects: 3,
      subjects_with_marks: 1,
      expected: 5,
      recorded: 2,
      completeness: 40,
      average_so_far: 27,
      running_average: 67.5,
    });
  });

  it("matches the official grading when every mark is in", () => {
    const full = buildProvisionalCard(
      [
        {
          subject_id: 1,
          name: "Maths",
          source: "report_card",
          items: [
            { assessment_type: "manual", assessment_id: 1, category: "CW", title: "a" },
            { assessment_type: "manual", assessment_id: 2, category: "HW", title: "b" },
            { assessment_type: "manual", assessment_id: 3, category: "MD", title: "c" },
            { assessment_type: "manual", assessment_id: 4, category: "EOT", title: "d" },
          ],
        },
      ],
      new Map([1, 2, 3, 4].map((id) => [`manual:${id}`, { raw_score: 7, max_score: 10 }])),
    );
    expect(full.subjects[0]).toMatchObject({ completeness: 100, weight_covered: 100, total_so_far: 70, running_percentage: 70 });
  });
});

import { buildMarksAttention, marksAttentionAlerts } from "../marksAttention";

const subjects = [
  { id: 1, name: "Web Application Development", code: "SPEWJ302", students: 18 },
  { id: 2, name: "Web3 Applications", code: null, students: null }, // rosters unavailable
];
const a = (o: Partial<Parameters<typeof buildMarksAttention>[0]["assessments"][number]>) => ({
  kind: "manual" as const,
  id: 1,
  title: "Class Work 1",
  subject_id: 1,
  at: "2026-10-01T00:00:00.000Z",
  closed: true,
  recorded: 18,
  ...o,
});

describe("marks attention", () => {
  it("flags marks not mapped and closed assessments with missing marks, unmapped first", () => {
    const m = buildMarksAttention({
      term: "Term 1",
      academic_year: "2026 - 2027",
      subjects,
      mapped: new Set(["manual:2", "quiz:5"]),
      assessments: [
        a({ id: 1, title: "Class Work 1" }), // marks, unmapped
        a({ id: 2, title: "Midterm 1", recorded: 16 }), // mapped, 2 missing
        a({ kind: "quiz", id: 5, title: "Quiz open", closed: false, recorded: 3 }), // mapped, still open: fine
        a({ kind: "assignment", id: 7, title: "No marks yet", recorded: 0, closed: false }), // nothing to map yet
        a({ kind: "assignment", id: 8, title: "Web3 task", subject_id: 2, recorded: 4 }), // unknown roster: unmapped only
      ],
    });
    expect(m.items.map((i) => [i.title, i.unmapped, i.missing])).toEqual([
      ["Class Work 1", true, 0],
      ["Web3 task", true, 0],
      ["Midterm 1", false, 2],
    ]);
    expect(m.totals).toEqual({ unmapped: 2, incomplete: 1, missing_marks: 2 });
    expect(m.subjects).toEqual([
      { subject_id: 1, name: "Web Application Development", code: "SPEWJ302", unmapped: 1, incomplete: 1 },
      { subject_id: 2, name: "Web3 Applications", code: null, unmapped: 1, incomplete: 0 },
    ]);
    expect(m.items[0].url).toBe("/grades/subjects/1");
  });

  it("turns it into bell alerts that link to the filtered Grades page, and notify again when it gets worse", () => {
    const m = buildMarksAttention({
      term: "Term 1",
      academic_year: "2026 - 2027",
      subjects,
      mapped: new Set(),
      assessments: [a({ id: 1, recorded: 15 })],
    });
    const alerts = marksAttentionAlerts(m);
    expect(alerts.map((x) => x.action?.url)).toEqual(["/grades?attention=unmapped", "/grades?attention=missing"]);
    expect(alerts[0].title).toBe("1 assessment with marks not mapped");
    expect(alerts[0].message).toContain("SPEWJ302 (1)");
    expect(alerts[1].message).toContain('3 marks not recorded, e.g. "Class Work 1" (15/18)');
    const worse = marksAttentionAlerts(buildMarksAttention({ term: "Term 1", academic_year: "x", subjects, mapped: new Set(), assessments: [a({ id: 1, recorded: 12 })] }));
    expect(worse[1].id).not.toBe(alerts[1].id);
  });

  it("says nothing when everything is mapped and complete", () => {
    const m = buildMarksAttention({ term: "Term 1", academic_year: "x", subjects, mapped: new Set(["manual:1"]), assessments: [a({ id: 1 })] });
    expect(m.items).toEqual([]);
    expect(marksAttentionAlerts(m)).toEqual([]);
  });
});

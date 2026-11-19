import { computeSchoolAnalytics, distribution, normalizeGender, statOf, type AnalyticsRow } from "../reportAnalytics.service";
import { NGA_GRADING_BANDS } from "../tenantSettings";

const bands = [...NGA_GRADING_BANDS];
const att = { present: 50, absent: 0, late: 0, excused: 0, sick: 0 };
let id = 0;
const row = (o: Partial<AnalyticsRow> & { subjects: Record<number, number> }): AnalyticsRow => {
  const totals = Object.values(o.subjects);
  id += 1;
  return {
    card_id: id,
    student_id: o.student_id ?? id,
    name: o.name ?? `S${id}`,
    registration_number: null,
    gender: o.gender ?? "unknown",
    class_group_id: o.class_group_id ?? 1,
    class_name: o.class_name ?? "G10 A",
    program_name: null,
    term: o.term ?? "Term 2",
    status: "published",
    subjects: o.subjects,
    average: totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : null,
    attendance: o.attendance ?? att,
  };
};

const opts = {
  pass_mark: 50,
  bands,
  subject_names: { 1: "Maths", 2: "Physics" },
  term: "Term 2",
  term_order: ["Term 1", "Term 2", "Term 3"],
};

describe("school analytics", () => {
  it("normalises gender spellings", () => {
    expect(["F", "female", "Girl", "gore"].map(normalizeGender)).toEqual(["female", "female", "female", "female"]);
    expect(["M", "Male"].map(normalizeGender)).toEqual(["male", "male"]);
    expect([null, "", "x"].map(normalizeGender)).toEqual(["unknown", "unknown", "unknown"]);
  });

  it("computes stats with null (not 0) when there is nothing", () => {
    expect(statOf([], 50)).toMatchObject({ n: 0, mean: null, pass_rate: null });
    expect(statOf([40, 60, 80], 50)).toMatchObject({ n: 3, mean: 60, median: 60, min: 40, max: 80, pass_rate: 66.7 });
  });

  it("counts a grade distribution on the school's bands", () => {
    const d = distribution([95, 85, 85, 10], bands);
    expect(d.find((b) => b.letter === "A*")!.count).toBe(1);
    expect(d.find((b) => b.letter === "A")!.count).toBe(2);
    expect(d.find((b) => b.letter === "U")!.count).toBe(1);
  });

  it("breaks performance down by gender with the gap (girls minus boys)", () => {
    const rows = [
      row({ gender: "female", subjects: { 1: 80, 2: 70 } }),
      row({ gender: "female", subjects: { 1: 60, 2: 60 } }),
      row({ gender: "male", subjects: { 1: 50, 2: 40 } }),
      row({ gender: "unknown", subjects: { 1: 90 } }),
    ];
    const a = computeSchoolAnalytics(rows, opts);
    expect(a.gender.overall.female.mean).toBe(67.5);
    expect(a.gender.overall.male.mean).toBe(45);
    expect(a.gender.gap).toBe(22.5);
    expect(a.gender.unknown_count).toBe(1);
    const maths = a.gender.subjects.find((s) => s.subject_id === 1)!;
    expect(maths.female.mean).toBe(70);
    expect(maths.male.mean).toBe(50);
    expect(maths.gap).toBe(20);
  });

  it("builds a broadsheet ranked by average within each class", () => {
    const rows = [
      row({ class_group_id: 1, class_name: "A", subjects: { 1: 60 } }),
      row({ class_group_id: 1, class_name: "A", subjects: { 1: 90 } }),
      row({ class_group_id: 2, class_name: "B", subjects: { 1: 70 } }),
    ];
    const a = computeSchoolAnalytics(rows, opts);
    const top = a.broadsheet.students.filter((s) => s.class_name === "A");
    expect(top.map((s) => [s.average, s.position, s.position_of])).toEqual([
      [90, 1, 2],
      [60, 2, 2],
    ]);
    expect(a.broadsheet.students.find((s) => s.class_name === "B")!.position).toBe(1);
    expect(a.performance.classes.map((c) => c.name)).toEqual(["A", "B"]);
  });

  it("tracks term-over-term change and flags drops as at-risk", () => {
    const rows = [
      row({ student_id: 100, term: "Term 1", subjects: { 1: 80 } }),
      row({ student_id: 100, term: "Term 2", subjects: { 1: 60 } }),
      row({ student_id: 200, term: "Term 1", subjects: { 1: 40 } }),
      row({ student_id: 200, term: "Term 2", subjects: { 1: 45, 2: 30 }, attendance: { present: 30, absent: 20, late: 0, excused: 0, sick: 0 } }),
    ];
    const a = computeSchoolAnalytics(rows, opts);
    expect(a.trends.terms).toEqual(["Term 1", "Term 2"]);
    expect(a.trends.previous_term).toBe("Term 1");
    expect(a.trends.improvement.map((i) => [i.student_id, i.change])).toEqual([
      [200, -2.5],
      [100, -20],
    ]);
    const risky = a.at_risk.find((r) => r.student_id === 200)!;
    expect(risky.reasons.join(" | ")).toMatch(/below the pass mark/);
    expect(risky.reasons.join(" | ")).toMatch(/Failed 2 subjects/);
    expect(risky.reasons.join(" | ")).toMatch(/Attendance 60%/);
    expect(a.at_risk.find((r) => r.student_id === 100)!.reasons.join(" ")).toMatch(/Dropped 20 points/);
  });
});

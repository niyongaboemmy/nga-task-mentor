import { describe, it, expect } from "vitest";
import {
  EMPTY_FILTERS,
  activeFilterCount,
  filterStudents,
  filtersFromParams,
  sortStudents,
  subjectStatsFor,
  summarise,
  writeFilters,
  type BroadsheetStudent,
} from "../components/SchoolReports/broadsheetFilters";

const st = (over: Partial<BroadsheetStudent>): BroadsheetStudent => ({
  student_id: 1,
  name: "Student",
  registration_number: null,
  gender: "female",
  class_name: "Year 1 A",
  status: "approved",
  subjects: {},
  total: 0,
  average: null,
  grade: null,
  position: null,
  position_of: null,
  passed: 0,
  failed: 0,
  attendance_rate: null,
  ...over,
});

const A = st({ student_id: 1, name: "Ana", registration_number: "R-01", subjects: { 1: 90, 2: 40 }, average: 65, grade: "B", position: 2, failed: 1, attendance_rate: 80 });
const B = st({ student_id: 2, name: "Ben", gender: "male", class_name: "Year 1 B", status: "draft", subjects: { 1: 95 }, average: 95, grade: "A", position: 1, attendance_rate: 98 });
const C = st({ student_id: 3, name: "Cleo", subjects: { 1: 30, 2: 35 }, average: 32.5, grade: "F", position: 3, failed: 2 });
const all = [A, B, C];
const f = (patch: Partial<typeof EMPTY_FILTERS>) => filterStudents(all, { ...EMPTY_FILTERS, ...patch }, 50).map((s) => s.name);

describe("broadsheet filters", () => {
  it("search matches name or registration number", () => {
    expect(f({ q: "r-01" })).toEqual(["Ana"]);
    expect(f({ q: "BEN" })).toEqual(["Ben"]);
  });

  it("result, gender, grade, status and class", () => {
    expect(f({ result: "passed_all" })).toEqual(["Ben"]);
    expect(f({ result: "failed_any" })).toEqual(["Ana", "Cleo"]);
    expect(f({ result: "failed_2" })).toEqual(["Cleo"]);
    expect(f({ result: "below_pass" })).toEqual(["Cleo"]);
    expect(f({ gender: "male" })).toEqual(["Ben"]);
    expect(f({ grades: ["A", "F"] })).toEqual(["Ben", "Cleo"]);
    expect(f({ statuses: ["draft"] })).toEqual(["Ben"]);
    expect(f({ classes: ["Year 1 A"] })).toEqual(["Ana", "Cleo"]);
  });

  it("average range, attendance and failing a subject (no mark is not a fail)", () => {
    expect(f({ minAvg: 60, maxAvg: 90 })).toEqual(["Ana"]);
    expect(f({ attendanceBelow: 85 })).toEqual(["Ana"]); // Cleo has no attendance: not counted as low
    expect(f({ failingSubject: 2 })).toEqual(["Ana", "Cleo"]); // Ben has no mark in subject 2
  });

  it("sorts with missing values last in both directions", () => {
    expect(sortStudents(all, "subject:2", "desc").map((s) => s.name)).toEqual(["Ana", "Cleo", "Ben"]);
    expect(sortStudents(all, "subject:2", "asc").map((s) => s.name)).toEqual(["Cleo", "Ana", "Ben"]);
    expect(sortStudents(all, "position", "asc").map((s) => s.name)).toEqual(["Ben", "Ana", "Cleo"]);
  });

  it("summarises and recomputes subject stats over the rows shown", () => {
    const s = summarise(all, 50);
    expect(s.top?.name).toBe("Ben");
    expect(s.passRate).toBeCloseTo(66.67, 1);
    expect(s.failingAny).toBe(2);
    expect(subjectStatsFor([A, C], [2], 50)[0]).toEqual({ subject_id: 2, mean: 37.5, max: 40, min: 35, pass_rate: 0 });
  });

  it("round-trips through the URL and counts active filters", () => {
    const filters = { ...EMPTY_FILTERS, q: "ana", gender: "female" as const, grades: ["A", "B"], minAvg: 40, failingSubject: 2 };
    const p = writeFilters(new URLSearchParams("tab=broadsheet"), filters);
    expect(p.get("tab")).toBe("broadsheet");
    expect(filtersFromParams(p)).toEqual(filters);
    expect(activeFilterCount(filters)).toBe(5);
    expect(writeFilters(p, EMPTY_FILTERS).toString()).toBe("tab=broadsheet");
  });
});

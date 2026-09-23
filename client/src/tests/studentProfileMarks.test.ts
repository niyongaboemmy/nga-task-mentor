import { describe, it, expect } from "vitest";
import {
  recordedLabel,
  summariseMarks,
  type MarkInput,
  type RecordedRow,
} from "../services/studentProfileApi";

const mark = (over: Partial<MarkInput>): MarkInput => ({
  courseKey: "MAT",
  kind: "recorded",
  marked: false,
  percentage: null,
  ...over,
});

describe("summariseMarks", () => {
  it("averages assignments, quizzes and recorded marks together", () => {
    const summary = summariseMarks([
      mark({ kind: "assignment", marked: true, percentage: 60 }),
      mark({ kind: "quiz", marked: true, percentage: 90 }),
      mark({ kind: "recorded", marked: true, percentage: 30 }),
    ]);
    expect(summary.overallAverage).toBe(60);
    expect(summary.markedCount).toBe(3);
    expect(summary.pendingCount).toBe(0);
  });

  it("never counts un-marked work as a zero", () => {
    const summary = summariseMarks([
      mark({ kind: "recorded", marked: true, percentage: 80 }),
      mark({ kind: "recorded" }), // teacher hasn't entered it
      mark({ kind: "assignment" }), // not submitted / not graded
      mark({ kind: "quiz" }), // never attempted
    ]);
    expect(summary.overallAverage).toBe(80);
    expect(summary.markedCount).toBe(1);
    expect(summary.pendingCount).toBe(3);
    expect(summary.totalCount).toBe(4);
  });

  it("returns null — not 0 — when nothing has been marked anywhere", () => {
    const summary = summariseMarks([mark({}), mark({ kind: "quiz" })]);
    expect(summary.overallAverage).toBeNull();
    expect(summary.markedCount).toBe(0);
  });

  it("handles a student with no markable work at all", () => {
    const summary = summariseMarks([]);
    expect(summary.overallAverage).toBeNull();
    expect(summary.totalCount).toBe(0);
    expect(summary.byCourse).toEqual({});
  });

  it("tallies each kind per subject and averages that subject alone", () => {
    const summary = summariseMarks([
      mark({ courseKey: "MAT", kind: "assignment", marked: true, percentage: 70 }),
      mark({ courseKey: "MAT", kind: "recorded", marked: true, percentage: 50 }),
      mark({ courseKey: "MAT", kind: "recorded" }),
      mark({ courseKey: "ENG", kind: "quiz", marked: true, percentage: 40 }),
      mark({ courseKey: "PHY", kind: "recorded" }),
    ]);

    expect(summary.byCourse.MAT.average).toBe(60);
    expect(summary.byCourse.MAT.recorded).toEqual({ marked: 1, total: 2 });
    expect(summary.byCourse.MAT.assignments).toEqual({ marked: 1, total: 1 });
    expect(summary.byCourse.ENG.average).toBe(40);
    // A subject whose only assessment is unmarked has no average of its own.
    expect(summary.byCourse.PHY.average).toBeNull();
    expect(summary.byCourse.PHY.totalCount).toBe(1);
  });
});

describe("recordedLabel", () => {
  const row = (over: Partial<RecordedRow>): RecordedRow => ({
    assessment_id: 1,
    title: "Raw title",
    assessment_type: null,
    assessment_number: null,
    assessment_date: null,
    counts_to_final: true,
    max_score: 20,
    recorded: false,
    score: null,
    percentage: null,
    ...over,
  });

  it("names a typed mark by its type and number", () => {
    expect(recordedLabel(row({ assessment_type: "midterm", assessment_number: 1 }))).toBe(
      "Midterm 1",
    );
    expect(recordedLabel(row({ assessment_type: "ca_end_of_term" }))).toBe(
      "CA End Of Term Exam",
    );
  });

  it("falls back to the title for an untyped or unknown type", () => {
    expect(recordedLabel(row({}))).toBe("Raw title");
    expect(recordedLabel(row({ assessment_type: "MD" }))).toBe("Raw title");
  });
});

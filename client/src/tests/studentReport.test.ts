import { describe, it, expect } from "vitest";
import {
  buildStudentOverview,
  itemLabel,
  itemPercentage,
  type SubjectItem,
  type SubjectRow,
} from "../services/studentReportApi";

// These pin the two rules the student report depends on: only marked work is
// averaged, and a subject with nothing marked has no grade rather than 0%.

const item = (over: Partial<SubjectItem>): SubjectItem => ({
  kind: "manual",
  id: 1,
  title: "Item",
  maxScore: 10,
  score: null,
  marked: false,
  submitted: false,
  date: null,
  overdue: false,
  countsToFinal: true,
  ...over,
});

const subject = (over: Partial<SubjectRow>): SubjectRow => {
  const items = over.items ?? [];
  const marked = items.filter((i) => i.marked);
  const max = marked.reduce((a, i) => a + i.maxScore, 0);
  const earned = marked.reduce((a, i) => a + (i.score ?? 0), 0);
  return {
    courseId: 1,
    courseName: "Subject",
    code: "SUB",
    totalMaxPoints: max,
    totalPointsEarned: earned,
    percentage: max > 0 ? Math.round((earned / max) * 10000) / 100 : 0,
    status: marked.length === 0 ? "No Grade" : earned / max >= 0.5 ? "Passing" : "Failing",
    items,
    markedCount: marked.length,
    pendingCount: items.length - marked.length,
    overdueCount: items.filter((i) => i.overdue).length,
    totalAssignments: items.filter((i) => i.kind === "assignment").length,
    totalQuizzes: items.filter((i) => i.kind === "quiz").length,
    totalAssessments: items.filter((i) => i.kind === "manual").length,
    assessmentsRecorded: items.filter((i) => i.kind === "manual" && i.marked).length,
    ...over,
  };
};

describe("buildStudentOverview", () => {
  it("averages only the subjects that have marks", () => {
    const overview = buildStudentOverview([
      subject({ courseId: 1, code: "MAT", items: [item({ marked: true, score: 8 })] }),
      subject({ courseId: 2, code: "ENG", items: [item({ marked: true, score: 4 })] }),
      // Nothing marked: must not be averaged in as a zero.
      subject({ courseId: 3, code: "PHY", items: [item({}), item({ kind: "quiz" })] }),
      // Nothing set at all.
      subject({ courseId: 4, code: "CHE", items: [] }),
    ]);

    expect(overview.overallAverage).toBe(60); // (80 + 40) / 2
    expect(overview.graded.map((s) => s.code)).toEqual(["MAT", "ENG"]);
    expect(overview.subjectsWithoutMarks).toBe(2);
    expect(overview.subjects.find((s) => s.code === "PHY")?.band).toBeNull();
  });

  it("reports progress over markable work, not over subjects", () => {
    const overview = buildStudentOverview([
      subject({ items: [item({ marked: true, score: 5 }), item({ id: 2 })] }),
      subject({ courseId: 2, items: [item({ id: 3 }), item({ id: 4 })] }),
    ]);
    expect(overview.markedCount).toBe(1);
    expect(overview.pendingCount).toBe(3);
    expect(overview.progress).toBe(25);
  });

  it("recommends the failing subjects first, naming each one", () => {
    const overview = buildStudentOverview([
      subject({ courseId: 7, courseName: "Physics", code: "PHY", items: [item({ marked: true, score: 3 })] }),
      subject({ courseId: 8, courseName: "History", code: "HIS", items: [item({ marked: true, score: 9 })] }),
    ]);

    const first = overview.recommendations[0];
    expect(first.tone).toBe("serious");
    expect(first.title).toContain("Physics");
    expect(first.courseId).toBe(7);
    // And something to keep doing.
    expect(overview.recommendations.some((r) => r.tone === "good")).toBe(true);
  });

  it("flags overdue work separately from work that is merely unmarked", () => {
    const overview = buildStudentOverview([
      subject({
        courseId: 3,
        code: "BIO",
        items: [
          item({ kind: "assignment", id: 1, overdue: true }),
          item({ kind: "manual", id: 2 }),
          item({ kind: "manual", id: 3, marked: true, score: 9 }),
        ],
      }),
    ]);

    expect(overview.overdueCount).toBe(1);
    const overdue = overview.recommendations.find((r) => r.id === "overdue");
    expect(overdue?.tone).toBe("serious");
    const pending = overview.recommendations.find((r) => r.id === "pending");
    expect(pending?.tone).toBe("info");
    expect(pending?.title).toContain("2 assessments not marked yet");
  });

  it("says so plainly when everything is on track", () => {
    const overview = buildStudentOverview([
      subject({ courseId: 1, items: [item({ marked: true, score: 7 })] }),
    ]);
    expect(overview.recommendations.some((r) => r.id === "strength")).toBe(true);
    expect(overview.recommendations.every((r) => r.tone !== "serious")).toBe(true);
  });

  it("handles a student with no enrolments at all", () => {
    const overview = buildStudentOverview([]);
    expect(overview.overallAverage).toBe(0);
    expect(overview.progress).toBe(0);
    expect(overview.recommendations).toEqual([]);
  });
});

describe("item helpers", () => {
  it("labels a typed manual mark by its type and number", () => {
    expect(
      itemLabel(item({ assessmentType: "midterm", assessmentNumber: 1, title: "raw" })),
    ).toBe("Midterm 1");
    expect(itemLabel(item({ kind: "quiz", title: "Unit quiz" }))).toBe("Unit quiz");
  });

  it("gives a percentage only for marked items", () => {
    expect(itemPercentage(item({ marked: true, score: 7, maxScore: 10 }))).toBe(70);
    expect(itemPercentage(item({ marked: false, score: null }))).toBeNull();
  });
});

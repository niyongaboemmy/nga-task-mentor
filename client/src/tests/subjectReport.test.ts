import { describe, it, expect } from "vitest";
import {
  bandOf,
  buildSubjectReport,
  type SubjectGradesPayload,
} from "../services/subjectReportApi";

// The subject assessment report is derived entirely from GET /courses/:id/grades,
// so these tests pin the derivation rather than the rendering: a wrong class
// average here would be wrong on every card, chart and export at once.

const payload: SubjectGradesPayload = {
  course_id: 101,
  quizzes: [{ id: 7, title: "Unit quiz", max_score: 20, date: "2026-09-01" }],
  assignments: [{ id: 3, title: "Portfolio", max_score: 10, date: "2026-09-10" }],
  assessments: [
    {
      id: 5,
      title: "Mid-term",
      max_score: 100,
      assessment_type: "midterm",
      assessment_number: 1,
      assessment_date: "2026-09-20",
      counts_to_final: true,
    },
  ],
  students: [
    {
      // Marked on everything: 15/20, "8/10" (string form), 90/100.
      student: { id: 1, name: "Ada", email: "ada@example.com" },
      quizzes: [{ quiz_id: 7, score: 15, submitted: true, max_score: 20 }],
      assignments: [{ assignment_id: 3, grade: "8/10", submitted: true, max_score: 10 }],
      assessments: [{ assessment_id: 5, score: 90, recorded: true, max_score: 100 }],
      summary: {
        total_points_earned: 113,
        total_max_points: 130,
        total_percentage: 86.9,
        assignment_percentage: 80,
        quiz_percentage: 75,
        assessment_percentage: 90,
      },
    },
    {
      // Only the manual mark, and it's a fail.
      student: { id: 2, name: "Grace", email: "grace@example.com" },
      quizzes: [{ quiz_id: 7, score: null, submitted: false, max_score: 20 }],
      assignments: [{ assignment_id: 3, grade: null, submitted: false, max_score: 10 }],
      assessments: [{ assessment_id: 5, score: 40, recorded: true, max_score: 100 }],
      summary: {
        total_points_earned: 40,
        total_max_points: 130,
        total_percentage: 30.8,
        assignment_percentage: 0,
        quiz_percentage: 0,
        assessment_percentage: 40,
      },
    },
    {
      // Nothing marked at all — must not be counted as a 0%.
      student: { id: 3, name: "Linus", email: "linus@example.com" },
      quizzes: [{ quiz_id: 7, score: null, submitted: false, max_score: 20 }],
      assignments: [{ assignment_id: 3, grade: null, submitted: false, max_score: 10 }],
      assessments: [{ assessment_id: 5, score: null, recorded: false, max_score: 100 }],
      summary: {
        total_points_earned: 0,
        total_max_points: 130,
        total_percentage: 0,
        assignment_percentage: 0,
        quiz_percentage: 0,
        assessment_percentage: 0,
      },
    },
  ],
};

describe("buildSubjectReport", () => {
  const report = buildSubjectReport(payload);

  it("folds quizzes, assignments and recorded marks into one assessment list", () => {
    expect(report.assessments.map((a) => a.key)).toEqual([
      "quiz-7",
      "assignment-3",
      "manual-5",
    ]);
    // The manual assessment's label comes from its type + number, not its title.
    expect(report.assessments[2].title).toBe("Midterm 1");
  });

  it("averages each assessment over the students who actually have a mark", () => {
    const [quiz, assignment, manual] = report.assessments;
    expect(quiz.averagePct).toBe(75); // 15/20, one marked student
    expect(quiz.markedCount).toBe(1);
    expect(assignment.averagePct).toBe(80); // "8/10" parsed
    expect(manual.averagePct).toBe(65); // (90 + 40) / 2
    expect(manual.markedCount).toBe(2);
    expect(manual.failingCount).toBe(1);
  });

  it("excludes students with no marks from the class average and bands", () => {
    // (86.9 + 30.8) / 2 — Linus is "no data", not a zero.
    expect(report.classAverage).toBe(58.9);
    expect(report.passRate).toBe(50);
    expect(report.atRiskCount).toBe(1);
    expect(report.bandCounts.excellent).toBe(1);
    expect(report.bandCounts.at_risk).toBe(1);
    expect(report.students.find((s) => s.name === "Linus")?.markedCount).toBe(0);
  });

  it("counts every cell still waiting on a mark", () => {
    // Quiz: 2 missing, assignment: 2 missing, manual: 1 missing.
    expect(report.outstandingMarks).toBe(5);
    expect(report.unmarkedAssessments).toHaveLength(0);
  });

  it("orders the timeline oldest first and skips unmarked assessments", () => {
    expect(report.timeline.map((a) => a.key)).toEqual([
      "quiz-7",
      "assignment-3",
      "manual-5",
    ]);
  });

  it("reports an empty subject without dividing by zero", () => {
    const empty = buildSubjectReport({
      course_id: 1,
      students: [],
      assignments: [],
      quizzes: [],
      assessments: [],
    });
    expect(empty.classAverage).toBe(0);
    expect(empty.passRate).toBe(0);
    expect(empty.outstandingMarks).toBe(0);
    expect(empty.medianPct).toBe(0);
  });
});

describe("bandOf", () => {
  it("maps a percentage onto the band that drives every chart color", () => {
    expect(bandOf(92)).toBe("excellent");
    expect(bandOf(80)).toBe("excellent");
    expect(bandOf(79.9)).toBe("good");
    expect(bandOf(50)).toBe("fair");
    expect(bandOf(49.9)).toBe("at_risk");
    expect(bandOf(0)).toBe("at_risk");
  });
});

import { describe, it, expect } from "vitest";
import {
  parseGrade,
  relativeDays,
  statusLabel,
  toAssignmentItem,
  toMarkInputs,
  toQuizItem,
  toRecordedItems,
  type RawStudentAssignment,
  type RawStudentQuiz,
} from "../services/studentActivity";
import { summariseMarks } from "../services/studentProfileApi";
import { computeStanding, subjectStandings, type StandingPayload } from "../services/studentStandingApi";
import { buildInsights } from "../services/studentInsights";

const NOW = new Date("2026-09-27T12:00:00Z").getTime();
const DAY = 86_400_000;
const iso = (offsetDays: number) => new Date(NOW + offsetDays * DAY).toISOString();

const assignment = (over: Partial<RawStudentAssignment> = {}): RawStudentAssignment => ({
  id: 1,
  title: "Lab",
  course_id: 10,
  max_score: 20,
  due_date: iso(7),
  submissions: [],
  subject: null,
  ...over,
});

const quiz = (over: Partial<RawStudentQuiz> = {}): RawStudentQuiz => ({
  id: 2,
  title: "Quiz",
  course_id: 10,
  passing_score: 60,
  quizSubmissions: [],
  subject: null,
  ...over,
});

describe("parseGrade", () => {
  it("reads score/max against its own max, not the assignment's", () => {
    expect(parseGrade("8/10", 20)).toEqual({ score: 8, max: 10 });
  });
  it("falls back to the assignment max for a bare score", () => {
    expect(parseGrade("15", 20)).toEqual({ score: 15, max: 20 });
  });
  it("rejects empty and unusable grades", () => {
    expect(parseGrade(null, 20)).toBeNull();
    expect(parseGrade("x/10", 20)).toBeNull();
    expect(parseGrade("5/0", 20)).toBeNull();
  });
});

describe("assignment status", () => {
  it("marks a graded submission with its real percentage", () => {
    const item = toAssignmentItem(
      assignment({ submissions: [{ id: 1, grade: "8/10", status: "graded", submitted_at: iso(-1) }] }),
      NOW,
    );
    expect(item).toMatchObject({ status: "graded", score: 8, maxScore: 10, percentage: 80, passed: true });
  });

  it("treats a draft as nothing handed in", () => {
    const item = toAssignmentItem(
      assignment({ due_date: iso(-2), submissions: [{ id: 1, grade: "10/10", status: "draft", submitted_at: null }] }),
      NOW,
    );
    expect(item.status).toBe("overdue");
    expect(item.percentage).toBeNull();
  });

  it("is awaiting marking once handed in without a grade", () => {
    const item = toAssignmentItem(
      assignment({ submissions: [{ id: 1, grade: null, status: "submitted", submitted_at: iso(-1) }] }),
      NOW,
    );
    expect(item.status).toBe("awaiting");
  });

  it("is due soon inside the window and open beyond it", () => {
    expect(toAssignmentItem(assignment({ due_date: iso(2) }), NOW).status).toBe("due_soon");
    expect(toAssignmentItem(assignment({ due_date: iso(10) }), NOW).status).toBe("open");
  });
});

describe("quiz status", () => {
  it("takes the best completed attempt and ignores one in progress", () => {
    const item = toQuizItem(
      quiz({
        quizSubmissions: [
          { id: 1, total_score: "9.00", percentage: "45", passed: false, status: "completed", attempt_number: 1, completed_at: iso(-3) },
          { id: 2, total_score: "10.00", percentage: "50", passed: false, status: "completed", attempt_number: 2, completed_at: iso(-2) },
          { id: 3, total_score: "20.00", percentage: "100", passed: true, status: "in_progress", attempt_number: 3, completed_at: null },
        ],
      }),
      NOW,
    );
    expect(item).toMatchObject({ status: "graded", percentage: 50, passed: false, attempts: 2, submissionId: 2 });
    expect(statusLabel(item)).toBe("Failed");
  });

  it("is in progress, upcoming or missed without a completed attempt", () => {
    expect(
      toQuizItem(
        quiz({ quizSubmissions: [{ id: 1, total_score: 0, percentage: 0, passed: false, status: "in_progress", attempt_number: 1, completed_at: null }] }),
        NOW,
      ).status,
    ).toBe("in_progress");
    expect(toQuizItem(quiz({ start_date: iso(1), end_date: iso(3) }), NOW).status).toBe("upcoming");
    const missed = toQuizItem(quiz({ start_date: iso(-5), end_date: iso(-1) }), NOW);
    expect(missed.status).toBe("overdue");
    expect(statusLabel(missed)).toBe("Missed");
  });
});

describe("recorded marks", () => {
  it("keeps not-in-final-grade marks visible but out of the average", () => {
    const items = toRecordedItems([
      {
        course_id: 10,
        subject_name: "Maths",
        subject_code: "MAT",
        recorded_count: 2,
        pending_count: 0,
        assessments: [
          { assessment_id: 1, title: "CW", assessment_type: null, assessment_number: null, assessment_date: null, counts_to_final: true, max_score: 10, recorded: true, score: 6, percentage: 60 },
          { assessment_id: 2, title: "Practice", assessment_type: null, assessment_number: null, assessment_date: null, counts_to_final: false, max_score: 10, recorded: true, score: 10, percentage: 100 },
        ],
      },
    ]);
    const summary = summariseMarks(toMarkInputs(items));
    expect(summary.overallAverage).toBe(60);
    expect(summary.markedCount).toBe(2);
  });
});

describe("summariseMarks across subjects", () => {
  it("weighs every subject the same in the overall average", () => {
    const summary = summariseMarks([
      // MAT: many high quiz marks; ENG: one low mark.
      ...Array.from({ length: 9 }, () => ({ courseKey: "MAT", kind: "quiz" as const, marked: true, percentage: 90 })),
      { courseKey: "ENG", kind: "recorded" as const, marked: true, percentage: 40 },
    ]);
    // Pooled items would give 85; per subject it's (90 + 40) / 2.
    expect(summary.overallAverage).toBe(65);
  });
});

describe("relativeDays", () => {
  it("phrases day offsets", () => {
    expect(relativeDays(iso(0), NOW)).toBe("today");
    expect(relativeDays(iso(1), NOW)).toBe("tomorrow");
    expect(relativeDays(iso(-3), NOW)).toBe("3 days ago");
    expect(relativeDays(null, NOW)).toBeNull();
  });
});

// ─── Standing ─────────────────────────────────────────────────────────────────

const payload: StandingPayload = {
  me: "me",
  subjects: [
    { course_id: "10", subject_name: "Maths", subject_code: "MAT", roster_size: 4, roster_available: true },
    { course_id: "20", subject_name: "English", subject_code: "ENG", roster_size: 3, roster_available: true },
  ],
  members: [
    // me: Maths 80 (quiz), English 40 (recorded) → overall 60
    { key: "me", scores: { "10": { quiz: [80, 1] }, "20": { recorded: [40, 1] } } },
    // a: Maths 70 (assignment ×2: 60, 80), English 90 → overall 80
    { key: "a", scores: { "10": { assignment: [140, 2] }, "20": { recorded: [90, 1] } } },
    // b: Maths 60 only → overall 60 (ties with me)
    { key: "b", scores: { "10": { quiz: [60, 1] } } },
    // c: nothing marked → unranked
    { key: "c", scores: {} },
  ],
};

describe("computeStanding", () => {
  it("ranks across subjects on the mean of subject scores, sharing ties", () => {
    const r = computeStanding(payload, null, "all");
    expect(r.score).toBe(60);
    expect(r.rank).toBe(2);
    expect(r.rankedCount).toBe(3);
    expect(r.cohortSize).toBe(4);
    expect(r.scores).toEqual([80, 60, 60]);
    expect(r.classAverage).toBe(66.7);
    expect(r.median).toBe(60);
  });

  it("ranks within one subject", () => {
    const r = computeStanding(payload, "10", "all");
    expect(r.score).toBe(80);
    expect(r.rank).toBe(1);
    expect(r.topPercent).toBe(33);
    expect(r.cohortSize).toBe(4);
  });

  it("ranks within one kind of work", () => {
    const quizzes = computeStanding(payload, null, "quiz");
    expect(quizzes.scores).toEqual([80, 60]);
    expect(quizzes.rank).toBe(1);
    const assignments = computeStanding(payload, null, "assignment");
    // The student has no assignment marks: not ranked, but the class still is.
    expect(assignments.rank).toBeNull();
    expect(assignments.rankedCount).toBe(1);
  });

  it("gives every subject its own standing", () => {
    const all = subjectStandings(payload, "all");
    expect(all["20"]).toMatchObject({ rank: 2, rankedCount: 2, classAverage: 65 });
  });
});

// ─── Insights ─────────────────────────────────────────────────────────────────

describe("buildInsights", () => {
  const subjects = [
    { courseId: "10", name: "Maths", code: "MAT" },
    { courseId: "20", name: "English", code: "ENG" },
  ];

  it("leads with at-risk subjects and overdue work, pointing at where to act", () => {
    const items = [
      toAssignmentItem(assignment({ id: 1, course_id: 20, due_date: iso(-2) }), NOW),
      ...toRecordedItems([
        {
          course_id: 20,
          subject_name: "English",
          subject_code: "ENG",
          recorded_count: 1,
          pending_count: 0,
          assessments: [
            { assessment_id: 9, title: "CW", assessment_type: null, assessment_number: null, assessment_date: null, counts_to_final: true, max_score: 10, recorded: true, score: 4, percentage: 40 },
          ],
        },
      ]),
      toQuizItem(
        quiz({
          course_id: 10,
          quizSubmissions: [{ id: 1, total_score: 9, percentage: 90, passed: true, status: "completed", attempt_number: 1, completed_at: iso(-1) }],
        }),
        NOW,
      ),
    ];
    const summary = summariseMarks(toMarkInputs(items));
    const insights = buildInsights({
      items,
      subjects,
      summary,
      standing: computeStanding(payload, null, "all"),
      subjectStanding: subjectStandings(payload, "all"),
    });

    expect(insights[0]).toMatchObject({
      id: "at-risk",
      tone: "danger",
      title: "At risk in English (40%)",
      target: { type: "subject", courseId: "20" },
    });
    expect(insights[0].detail).toContain("Ranked 2 of 2");
    expect(insights.find((i) => i.id === "overdue")).toMatchObject({
      title: "1 overdue assignment",
      target: { type: "tab", tab: "assignment", status: "attention" },
    });
    expect(insights.find((i) => i.id === "strength")?.title).toBe("Strongest in Maths (90%)");
    expect(insights.some((i) => i.id === "on-track")).toBe(false);
  });

  it("reports a downward trend once there are enough dated marks", () => {
    const marks = [90, 85, 88, 80, 40, 45, 42];
    const items = marks.map((pct, i) =>
      toAssignmentItem(
        assignment({
          id: i + 1,
          due_date: iso(-30 + i),
          submissions: [{ id: i + 1, grade: `${pct}/100`, status: "graded", submitted_at: iso(-30 + i) }],
        }),
        NOW,
      ),
    );
    const insights = buildInsights({
      items,
      subjects,
      summary: summariseMarks(toMarkInputs(items)),
      standing: null,
      subjectStanding: null,
    });
    expect(insights.find((i) => i.id === "trend")).toMatchObject({ tone: "warning", title: "Trending down" });
  });
});

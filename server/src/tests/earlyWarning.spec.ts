/**
 * Early-warning metrics (services/earlyWarning.service.ts): pure functions
 * over loaded rows, no DB.
 */
import {
  buildSignals,
  chunk,
  computeStudentMetrics,
  kigaliDate,
  StudentWorkInput,
} from "../services/earlyWarning.service";

const NOW = new Date("2026-10-07T16:45:00Z"); // 18:45 in Kigali
const DAY = 86_400_000;
const ago = (days: number) => new Date(NOW.getTime() - days * DAY);
const S = 501;

const asg = (id: number, due: Date | null, extra: Record<string, any> = {}) => ({
  id, title: `A${id}`, course_id: S, status: "published", due_date: due, max_score: 20, ...extra,
});
const quiz = (id: number, close: Date | null, extra: Record<string, any> = {}) => ({
  id, title: `Q${id}`, course_id: S, status: "published", start_date: null, end_date: close, ...extra,
});
const sub = (assignment_id: number, status: string, extra: Record<string, any> = {}) => ({
  id: assignment_id * 10, assignment_id, status, grade: null, submitted_at: ago(20), updated_at: ago(20), ...extra,
});
const att = (quiz_id: number, extra: Record<string, any> = {}) => ({
  id: quiz_id * 10, quiz_id, status: "completed", grade_status: "auto_graded", percentage: 80,
  completed_at: ago(2), graded_at: ago(2), attempt_number: 1, ...extra,
});

const run = (over: Partial<StudentWorkInput>) =>
  computeStudentMetrics({ now: NOW, subjectIds: [S], assignments: [], quizzes: [], submissions: [], attempts: [], ...over });

describe("computeStudentMetrics: due and missed (last 14 days)", () => {
  it("counts work due in (now-14d, now]; boundaries and the future are excluded", () => {
    const m = run({
      assignments: [
        asg(1, ago(1)), // due, missed
        asg(2, new Date(NOW.getTime() - 14 * DAY + 60_000)), // just inside
        asg(3, ago(14)), // exactly 14 days ago: outside
        asg(4, ago(20)), // outside
        asg(5, new Date(NOW.getTime() + 3600_000)), // future
        asg(6, null), // no due date
      ],
    });
    expect(m.due_14d).toBe(2);
    expect(m.missed_14d).toBe(2);
  });

  it("a hand-in is not missed; a draft is", () => {
    const m = run({
      assignments: [asg(1, ago(2)), asg(2, ago(3)), asg(3, ago(4))],
      submissions: [
        sub(1, "submitted", { submitted_at: ago(2.5) }),
        sub(2, "draft"),
        sub(3, "graded", { grade: "10/20", updated_at: ago(1) }),
      ],
    });
    expect(m).toMatchObject({ due_14d: 3, missed_14d: 1 });
  });

  it("quizzes: closed with no finished attempt is missed; a finished attempt (even ungraded) is not", () => {
    const m = run({
      quizzes: [quiz(1, ago(1)), quiz(2, ago(2)), quiz(3, ago(3)), quiz(4, ago(5))],
      attempts: [
        att(2, { grade_status: "pending", graded_at: null }),
        att(3, { status: "in_progress", grade_status: "pending", completed_at: null, graded_at: null, end_time: ago(3) }),
        att(4, { percentage: 40 }),
      ],
    });
    expect(m.due_14d).toBe(4);
    expect(m.missed_14d).toBe(2); // quiz 1 (nothing) and quiz 3 (abandoned attempt)
  });

  it("ignores tasks outside the student's subjects and unpublished tasks", () => {
    const m = run({
      assignments: [asg(1, ago(1), { course_id: 999 }), asg(2, ago(1), { status: "draft" }), asg(3, ago(1), { status: "completed" })],
    });
    expect(m).toMatchObject({ due_14d: 1, missed_14d: 1 }); // a completed (closed) assignment still counts
  });
});

describe("computeStudentMetrics: marks", () => {
  it("parses x/y grades, bare grades against max_score, and uses the best graded quiz attempt", () => {
    const m = run({
      assignments: [asg(1, ago(40)), asg(2, ago(40), { max_score: 50 })],
      submissions: [
        sub(1, "graded", { grade: "15/20", updated_at: ago(3) }), // 75
        sub(2, "graded", { grade: "20", updated_at: ago(4) }), // 20/50 = 40
      ],
      quizzes: [quiz(7, ago(10))],
      attempts: [att(7, { id: 71, percentage: 30 }), att(7, { id: 72, percentage: 65, attempt_number: 2 })], // best 65
    });
    expect(m.avg_pct_30d).toBe(60); // (75 + 40 + 65) / 3
    expect(m.failed_30d).toBe(1); // the 40%
    expect(m.avg_pct_prev_30d).toBeNull();
  });

  it("splits current and previous 30-day windows on graded time", () => {
    const m = run({
      assignments: [asg(1, ago(70)), asg(2, ago(70)), asg(3, ago(70)), asg(4, ago(70))],
      submissions: [
        sub(1, "graded", { grade: "18/20", updated_at: ago(29.9) }), // current: 90
        sub(2, "graded", { grade: "8/20", updated_at: ago(30) }), // exactly 30d: previous 40
        sub(3, "graded", { grade: "16/20", updated_at: ago(59) }), // previous 80
        sub(4, "graded", { grade: "2/20", updated_at: ago(61) }), // too old
      ],
    });
    expect(m).toEqual({ due_14d: 0, missed_14d: 0, avg_pct_30d: 90, avg_pct_prev_30d: 60, failed_30d: 0 });
  });

  it("unreadable grades, ungraded hand-ins and pending quiz attempts give no mark (null averages)", () => {
    const m = run({
      assignments: [asg(1, ago(40), { max_score: null }), asg(2, ago(40))],
      submissions: [sub(1, "graded", { grade: "great", updated_at: ago(2) }), sub(2, "submitted")],
      quizzes: [quiz(3, ago(40))],
      attempts: [att(3, { grade_status: "pending" })],
    });
    expect(m).toEqual({ due_14d: 0, missed_14d: 0, avg_pct_30d: null, avg_pct_prev_30d: null, failed_30d: 0 });
  });

  it("a quiz without graded_at uses completed_at; rounding to one decimal", () => {
    const m = run({
      quizzes: [quiz(1, ago(40)), quiz(2, ago(40)), quiz(3, ago(40))],
      attempts: [
        att(1, { percentage: 33.33, graded_at: null, completed_at: ago(5) }),
        att(2, { percentage: 33.33 }),
        att(3, { percentage: 33.34 }),
      ],
    });
    expect(m.avg_pct_30d).toBe(33.3);
    expect(m.failed_30d).toBe(3);
  });
});

describe("buildSignals", () => {
  const rows = {
    assignments: [asg(1, ago(1)), asg(2, ago(40), { course_id: 777 })],
    quizzes: [],
    submissions: [
      { ...sub(1, "submitted"), student_id: 11 },
      { ...sub(2, "graded", { grade: "5/20", updated_at: ago(3) }), student_id: 12 },
    ],
    attempts: [],
  };

  it("keys by MIS id, reads rows by the linked local id, and drops students with nothing to report", () => {
    const out = buildSignals(NOW, [
      { mis_user_id: 9001, local_user_id: 11, subject_ids: [S] }, // handed in
      { mis_user_id: 9002, local_user_id: null, subject_ids: [S] }, // no account: missed
      { mis_user_id: 9003, local_user_id: 12, subject_ids: [777] }, // a low mark only
      { mis_user_id: 9004, local_user_id: 13, subject_ids: [888] }, // nothing at all
      { mis_user_id: 9001, local_user_id: 11, subject_ids: [S] }, // duplicate
      { mis_user_id: 0, local_user_id: 11, subject_ids: [S] }, // no MIS id
    ], rows as any);
    expect(out).toEqual([
      { student_id: 9001, metrics: { due_14d: 1, missed_14d: 0, avg_pct_30d: null, avg_pct_prev_30d: null, failed_30d: 0 } },
      { student_id: 9002, metrics: { due_14d: 1, missed_14d: 1, avg_pct_30d: null, avg_pct_prev_30d: null, failed_30d: 0 } },
      { student_id: 9003, metrics: { due_14d: 0, missed_14d: 0, avg_pct_30d: 25, avg_pct_prev_30d: null, failed_30d: 1 } },
    ]);
  });
});

describe("helpers", () => {
  it("kigaliDate rolls over at 22:00 UTC", () => {
    expect(kigaliDate(new Date("2026-10-07T21:59:00Z"))).toBe("2026-10-07");
    expect(kigaliDate(new Date("2026-10-07T22:00:00Z"))).toBe("2026-10-08");
  });
  it("chunk splits into batches of 1000 by default", () => {
    expect(chunk(Array.from({ length: 2001 }, (_, i) => i)).map((c) => c.length)).toEqual([1000, 1000, 1]);
    expect(chunk([])).toEqual([]);
  });
});

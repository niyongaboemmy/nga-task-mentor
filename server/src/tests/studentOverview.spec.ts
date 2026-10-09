import { buildStudentOverview, relTime, StudentOverviewInput } from "../services/studentOverview.service";

/** Pure logic behind GET /api/dashboard/student/overview. Clock: 2026-09-23 12:00 UTC. */

const NOW = new Date("2026-09-23T12:00:00Z");
const at = (hours: number) => new Date(NOW.getTime() + hours * 3600000);
const days = (n: number) => at(n * 24);

function input(over: Partial<StudentOverviewInput> = {}): StudentOverviewInput {
  return {
    now: NOW,
    academic_term_id: 3,
    subjects: [
      { id: 1, name: "Web UI", code: "WEB" },
      { id: 2, name: "JavaScript", code: "JS" },
    ],
    assignments: [
      { id: 10, title: "Landing page", course_id: 1, status: "published", due_date: at(5), max_score: 20 }, // due today
      { id: 11, title: "Forms", course_id: 1, status: "published", due_date: days(2), max_score: 10, created_at: days(-1) }, // due soon, new
      { id: 12, title: "Portfolio", course_id: 1, status: "published", due_date: days(10), max_score: 10 }, // upcoming, draft
      { id: 13, title: "CSS lab", course_id: 1, status: "published", due_date: days(-2), max_score: 20 }, // missed
      { id: 14, title: "HTML basics", course_id: 1, status: "published", due_date: days(-5), max_score: 20 }, // graded
      { id: 15, title: "Wireframe", course_id: 1, status: "published", due_date: days(-1), max_score: 20 }, // submitted
      { id: 16, title: "Old draft", course_id: 1, status: "draft", due_date: days(3), max_score: 20 }, // not visible
      { id: 99, title: "Other class", course_id: 42, status: "published", due_date: days(1), max_score: 20 },
    ],
    quizzes: [
      { id: 20, title: "JS basics", course_id: 2, status: "published", is_public: true, type: "Quiz", end_date: days(1.5), max_attempts: 2 }, // running
      { id: 21, title: "Loops", course_id: 2, status: "published", is_public: true, type: "Exam", start_date: days(1), end_date: days(2) }, // opens tomorrow
      { id: 22, title: "Arrays", course_id: 2, status: "published", is_public: true, end_date: days(4), max_attempts: 3 }, // failed, retake
      { id: 23, title: "Closures", course_id: 2, status: "published", is_public: true, end_date: days(-3) }, // missed
      { id: 24, title: "Timed", course_id: 2, status: "published", is_public: true, time_limit: 30, end_date: days(6) }, // upcoming
    ],
    quizStats: [
      { quiz_id: 21, question_count: 12, total_points: 24, total_seconds: 1500 },
      { quiz_id: 24, question_count: 5, total_points: 10, total_seconds: 0 },
    ],
    submissions: [
      { id: 1, assignment_id: 12, status: "draft", updated_at: days(-1) },
      { id: 2, assignment_id: 14, status: "graded", grade: "16/20", feedback: "<p>Nice</p>", submitted_at: days(-6), updated_at: days(-2) },
      { id: 3, assignment_id: 15, status: "late", is_late: true, submitted_at: days(-1), updated_at: days(-1) },
    ],
    attempts: [
      { id: 1, quiz_id: 20, status: "in_progress", grade_status: "pending", started_at: at(-0.2), end_time: at(0.3) },
      { id: 2, quiz_id: 22, status: "completed", grade_status: "auto_graded", percentage: "30.00", total_score: 3, max_score: 10, passed: false, completed_at: days(-1), graded_at: days(-1) },
    ],
    ...over,
  };
}

const o = buildStudentOverview(input());
const task = (kind: string, id: number) => o.tasks.find((t) => t.kind === kind && t.id === id)!;

describe("student overview: task states", () => {
  it("keeps only published work in the student's own subjects", () => {
    expect(o.tasks.find((t) => t.id === 99)).toBeUndefined();
    expect(o.tasks.find((t) => t.id === 16)).toBeUndefined();
  });

  it("classifies assignments by deadline and submission", () => {
    expect(task("assignment", 10).state).toBe("due_today");
    expect(task("assignment", 11).state).toBe("due_soon");
    expect(task("assignment", 12)).toMatchObject({ state: "upcoming", has_draft: true, action: { label: "Finish & submit" } });
    expect(task("assignment", 13)).toMatchObject({ state: "missed", countdown_to: null });
    expect(task("assignment", 15)).toMatchObject({ state: "submitted", is_late: true });
  });

  it("reads grades against their own max and flags feedback", () => {
    expect(task("assignment", 14)).toMatchObject({
      state: "graded", score_pct: 80, score_display: "16/20", passed: true, has_feedback: true,
      action: { label: "View feedback", url: "/assignments/14" },
    });
  });

  it("gives a running quiz a live countdown to the attempt's end", () => {
    expect(task("quiz", 20)).toMatchObject({
      state: "in_progress", countdown_label: "time_left", countdown_to: at(0.3).toISOString(),
      action: { label: "Resume", url: "/quizzes/20/take" },
    });
  });

  it("never lets an attempt's countdown outlive the quiz", () => {
    const n = buildStudentOverview(input({
      quizzes: [{ id: 20, title: "JS basics", course_id: 2, status: "published", end_date: at(0.1) }],
      attempts: [{ id: 1, quiz_id: 20, status: "in_progress", grade_status: "pending", end_time: at(1) }],
    }));
    expect(n.tasks.find((t) => t.kind === "quiz")!.countdown_to).toBe(at(0.1).toISOString());
  });

  it("treats an expired, unfinished attempt as missed", () => {
    const n = buildStudentOverview(input({
      quizzes: [{ id: 20, title: "JS basics", course_id: 2, status: "published", end_date: days(-1) }],
      attempts: [{ id: 1, quiz_id: 20, status: "in_progress", grade_status: "pending", end_time: days(-1) }],
    }));
    expect(n.tasks.find((t) => t.kind === "quiz")!.state).toBe("missed");
  });

  it("counts down to a quiz that hasn't opened, with its length", () => {
    expect(task("quiz", 21)).toMatchObject({
      state: "not_open", countdown_label: "opens", opens_at: days(1).toISOString(),
      question_count: 12, duration_minutes: 25, max_score: 24,
    });
    // a quiz-level time limit wins over the per-question sum
    expect(task("quiz", 24).duration_minutes).toBe(30);
  });

  it("offers a retake while attempts remain and the quiz is open", () => {
    expect(task("quiz", 22)).toMatchObject({
      state: "graded", score_pct: 30, passed: false, can_retake: true, attempts_used: 1,
      action: { label: "Retake", url: "/quizzes/22/take" },
    });
    expect(task("quiz", 23).state).toBe("missed");
  });

  it("reads MySQL's 0/1 `passed` as a boolean (raw rows), so the retake reminder still fires", () => {
    const base = input();
    const raw = buildStudentOverview({
      ...base,
      attempts: base.attempts.map((a) => (a.passed === false ? { ...a, passed: 0 } : a.passed === true ? { ...a, passed: 1 } : a)),
    });
    expect(raw.tasks.find((t) => t.kind === "quiz" && t.id === 22)).toMatchObject({ passed: false, can_retake: true });
    expect(raw.reminders.map((r) => r.id)).toContain("retake-22");
  });

  it("orders the list by urgency", () => {
    const order = o.tasks.map((t) => t.state);
    expect(order.indexOf("in_progress")).toBe(0);
    expect(order.indexOf("due_today")).toBeLessThan(order.indexOf("due_soon"));
    expect(order.lastIndexOf("missed")).toBe(order.length - 1);
  });

  it("drops missed work older than 30 days from the list", () => {
    const n = buildStudentOverview(input({
      assignments: [{ id: 1, title: "Ancient", course_id: 1, status: "published", due_date: days(-45), max_score: 10 }],
      quizzes: [], submissions: [], attempts: [],
    }));
    expect(n.tasks).toHaveLength(0);
  });
});

describe("student overview: summary", () => {
  it("counts what's on the student's plate", () => {
    expect(o.summary).toMatchObject({
      subjects: 2, in_progress: 1, due_today: 1, not_open: 1, awaiting_grade: 1, graded: 2, missed: 2, drafts: 1,
    });
    expect(o.summary.todo).toBe(5); // running quiz, due today, due soon, portfolio, timed quiz
    expect(o.summary.due_this_week).toBe(4); // portfolio (10 days) is outside
    expect(o.summary.next_deadline).toBe(at(0.3).toISOString());
  });

  it("measures completion and punctuality", () => {
    // closed or handed in: CSS lab (missed), HTML basics, Wireframe, Arrays, Closures (missed) -> 3/5
    expect(o.summary.completion_rate).toBe(60);
    // assignments handed in: HTML basics (on time), Wireframe (late)
    expect(o.summary.on_time_rate).toBe(50);
    expect(o.summary.recent_average).toBe(55); // (80 + 30) / 2
  });

  it("summarises each subject", () => {
    const web = o.subjects.find((s) => s.subject_id === 1)!;
    expect(web).toMatchObject({ todo: 3, due_soon: 2, missed: 1, awaiting: 1, graded: 1, recent_average: 80 });
    expect(web.next_task?.title).toBe("Landing page");
  });
});

describe("student overview: reminders", () => {
  const ids = o.reminders.map((r) => r.id);

  it("puts a running quiz first with its countdown", () => {
    expect(o.reminders[0]).toMatchObject({
      id: "running-20", severity: "critical", countdown_to: at(0.3).toISOString(),
      action: { label: "Resume" },
    });
    expect(o.reminders[0].message).toMatch(/ends in 18 min/);
  });

  it("warns about work due today, stating late work isn't accepted", () => {
    const r = o.reminders.find((x) => x.id === "due-today-assignment-10")!;
    expect(r.severity).toBe("critical");
    expect(r.title).toBe("Assignment due in 5h: Landing page");
    expect(r.message).toMatch(/Late submissions are not accepted/);
  });

  it("covers drafts, due-soon, missed, retakes, openings, results and new work", () => {
    expect(ids).toEqual(expect.arrayContaining([
      "drafts", "due-soon-assignment-11", "missed", "retake-22", "opens-21", "result-assignment-14", "new-work",
    ]));
    expect(o.reminders.find((x) => x.id === "opens-21")!.title).toBe("Exam opens in 1 day: Loops");
    expect(o.reminders.find((x) => x.id === "result-assignment-14")!.message).toMatch(/left feedback/);
    expect(o.reminders.find((x) => x.id === "missed")!.message).toMatch(/Talk to your teacher/);
  });

  it("keeps the most urgent first", () => {
    const rank = { critical: 0, warning: 1, info: 2, success: 3 } as const;
    const r = o.reminders.map((x) => rank[x.severity]);
    expect(r).toEqual([...r].sort((a, b) => a - b));
  });

  it("caps item reminders and rolls up the rest", () => {
    const many = Array.from({ length: 5 }, (_, i) => ({
      id: 30 + i, title: `Task ${i}`, course_id: 1, status: "published", due_date: at(2 + i), max_score: 10,
    }));
    const n = buildStudentOverview(input({ assignments: many, quizzes: [], submissions: [], attempts: [] }));
    expect(n.reminders.filter((r) => r.id.startsWith("due-today-assignment-"))).toHaveLength(3);
    expect(n.reminders.find((r) => r.id === "due-today-more")?.title).toBe("2 more tasks due in the next 24 hours");
  });

  it("raises reminders only for publicly accessible quizzes, but still lists private ones", () => {
    const priv = (q: StudentOverviewInput["quizzes"][number]) => ({ ...q, is_public: false });
    const n = buildStudentOverview(input({ quizzes: input().quizzes.map(priv) }));
    expect(n.reminders.map((r) => r.id)).not.toEqual(expect.arrayContaining(["running-20"]));
    expect(n.reminders.some((r) => /^(running|retake|opens)-2\d$/.test(r.id))).toBe(false);
    expect(n.reminders.find((r) => r.id === "due-today-assignment-10")).toBeDefined();
    expect(n.tasks.find((t) => t.kind === "quiz" && t.id === 20)).toMatchObject({ state: "in_progress", is_public: false });
    expect(task("quiz", 20).is_public).toBe(true);
    expect(task("assignment", 10).is_public).toBe(true);
  });

  it("drops a private quiz's result and new-quiz reminders, and the coming-up count", () => {
    const quiz = { id: 40, title: "Hidden", course_id: 2, status: "published", end_date: days(9), created_at: days(-1) };
    const graded = { id: 41, title: "Marked", course_id: 2, status: "published", end_date: days(-1) };
    const attempts = [{
      id: 9, quiz_id: 41, status: "completed", grade_status: "graded", percentage: "100.00",
      total_score: 10, max_score: 10, passed: true, completed_at: days(-2), graded_at: days(-1),
    }];
    const base = { assignments: [], submissions: [], attempts };
    const pub = buildStudentOverview(input({ ...base, quizzes: [quiz, graded].map((q) => ({ ...q, is_public: true })) }));
    expect(pub.reminders.map((r) => r.id)).toEqual(expect.arrayContaining(["result-quiz-41"]));
    expect(pub.reminders.some((r) => /new/.test(r.id))).toBe(true);

    const hidden = buildStudentOverview(input({ ...base, quizzes: [quiz, graded] }));
    expect(hidden.reminders).toEqual([expect.objectContaining({ id: "all-clear" })]);
    expect(hidden.reminders[0].message).not.toMatch(/coming up later/);
    expect(hidden.tasks).toHaveLength(2);
  });

  it("says all is well when nothing is pressing", () => {
    const n = buildStudentOverview(input({
      assignments: [{ id: 1, title: "Essay", course_id: 1, status: "published", due_date: days(9), max_score: 10 }],
      quizzes: [], submissions: [], attempts: [],
    }));
    expect(n.reminders).toEqual([expect.objectContaining({ id: "all-clear", severity: "success" })]);
    expect(n.reminders[0].message).toBe("Nothing due in the next 3 days. 1 task coming up later.");
  });
});

describe("relTime", () => {
  it("formats short and long spans", () => {
    const now = NOW.getTime();
    expect(relTime(at(0.25), now)).toBe("in 15 min");
    expect(relTime(at(2.5), now)).toBe("in 2h 30m");
    expect(relTime(at(10), now)).toBe("in 10h");
    expect(relTime(days(3), now)).toBe("in 3 days");
    expect(relTime(days(-1), now)).toBe("1 day ago");
  });
});

import {
  alertTargets,
  bandOf,
  buildInstructorOverview,
  OverviewInput,
  overviewAlertTargets,
  weekStart,
} from "../services/instructorOverview.service";

/**
 * The pure analytics behind GET /api/dashboard/instructor/overview. Fixed
 * clock: Wednesday 2026-09-23 12:00 UTC.
 */

const NOW = new Date("2026-09-23T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86400000);
const daysAhead = (n: number) => new Date(NOW.getTime() + n * 86400000);

function baseInput(overrides: Partial<OverviewInput> = {}): OverviewInput {
  return {
    now: NOW,
    academic_term_id: 7,
    subjects: [
      { id: 1, name: "Web UI", code: "WEB", class_groups: ["L5 SOD A"] },
      { id: 2, name: "JavaScript", code: "JS", class_groups: ["L5 SOD A"] },
      { id: 3, name: "Web3", code: "W3", class_groups: [] },
    ],
    rosters: new Map([
      [1, [
        { mis_user_id: 101, name: "Ada One", class_group_name: "L5 SOD A" },
        { mis_user_id: 102, name: "Bo Two", class_group_name: "L5 SOD A" },
        { mis_user_id: 103, name: "Cy Three", class_group_name: "L5 SOD A" },
        { mis_user_id: 104, name: "Di Four", class_group_name: "L5 SOD A" },
      ]],
      [2, [
        { mis_user_id: 101, name: "Ada One", class_group_name: "L5 SOD A" },
        { mis_user_id: 102, name: "Bo Two", class_group_name: "L5 SOD A" },
      ]],
      [3, []],
    ]),
    assignments: [
      // closed, 3 of 4 submitted
      { id: 10, title: "Landing page", course_id: 1, status: "published", due_date: daysAgo(5), max_score: 20 },
      // due tomorrow, 1 of 4 submitted
      { id: 11, title: "Forms", course_id: 1, status: "published", due_date: daysAhead(1), max_score: 10 },
      { id: 12, title: "Draft idea", course_id: 1, status: "draft", due_date: daysAhead(20), max_score: 10 },
      { id: 13, title: "Removed", course_id: 1, status: "removed", due_date: daysAgo(3), max_score: 10 },
      // subject not in scope: must be ignored
      { id: 99, title: "Other teacher", course_id: 42, status: "published", due_date: daysAgo(1), max_score: 10 },
    ],
    quizzes: [
      { id: 20, title: "JS basics", course_id: 2, status: "published", type: "Quiz", end_date: daysAgo(2) },
    ],
    submissions: [
      { id: 1, assignment_id: 10, student_id: 1, status: "graded", grade: "18/20", submitted_at: daysAgo(6), updated_at: daysAgo(4) },
      { id: 2, assignment_id: 10, student_id: 2, status: "graded", grade: "6/20", submitted_at: daysAgo(6), updated_at: daysAgo(4) },
      // waiting 9 days -> overdue grading
      { id: 3, assignment_id: 10, student_id: 3, status: "late", is_late: true, submitted_at: daysAgo(9), updated_at: daysAgo(9) },
      { id: 4, assignment_id: 11, student_id: 1, status: "submitted", submitted_at: daysAgo(1), updated_at: daysAgo(1) },
      { id: 5, assignment_id: 11, student_id: 2, status: "draft", submitted_at: null, updated_at: daysAgo(1) },
      { id: 6, assignment_id: 99, student_id: 1, status: "submitted", submitted_at: daysAgo(1) },
    ],
    quizSubmissions: [
      // two attempts: best graded one counts (90)
      { id: 1, quiz_id: 20, student_id: 1, status: "completed", grade_status: "auto_graded", percentage: "60.00", completed_at: daysAgo(3) },
      { id: 2, quiz_id: 20, student_id: 1, status: "completed", grade_status: "auto_graded", percentage: "90.00", completed_at: daysAgo(3) },
      { id: 3, quiz_id: 20, student_id: 2, status: "in_progress", grade_status: "pending", percentage: 0, completed_at: null },
    ],
    proctoring: [
      { id: 1, quiz_id: 20, status: "active", is_connected: true, last_connection_time: new Date(NOW.getTime() - 60000) },
      { id: 2, quiz_id: 20, status: "active", is_connected: false, last_connection_time: daysAgo(30) },
      { id: 3, quiz_id: 20, status: "completed", flags_count: 2 },
      { id: 4, quiz_id: 999, status: "active", is_connected: true, last_connection_time: NOW },
    ],
    users: [
      { id: 1, first_name: "Ada", last_name: "One", mis_user_id: 101 },
      { id: 2, first_name: "Bo", last_name: "Two", mis_user_id: 102 },
      { id: 3, first_name: "Cy", last_name: "Three", mis_user_id: 103 },
    ],
    ...overrides,
  };
}

describe("instructor overview analytics", () => {
  const o = buildInstructorOverview(baseInput());
  const web = o.subjects.find((s) => s.subject_id === 1)!;
  const js = o.subjects.find((s) => s.subject_id === 2)!;
  const w3 = o.subjects.find((s) => s.subject_id === 3)!;

  it("counts only in-scope, non-removed assessments", () => {
    expect(o.totals.assessments).toBe(4); // 10, 11, 12, 20
    expect(o.totals.drafts).toBe(1);
    expect(o.totals.published).toBe(3);
    expect(o.assessments.find((a) => a.id === 99)).toBeUndefined();
  });

  it("ignores drafts and unfinished quiz attempts as submissions", () => {
    const forms = o.assessments.find((a) => a.id === 11)!;
    expect(forms.submitted).toBe(1);
    expect(forms.participation).toBe(25);
    const quiz = o.assessments.find((a) => a.kind === "quiz")!;
    expect(quiz.submitted).toBe(1);
  });

  it("reads assignment grades against their own max and quizzes by best attempt", () => {
    const landing = o.assessments.find((a) => a.id === 10)!;
    expect(landing.avg_score).toBe(60); // (90 + 30) / 2
    expect(landing.pass_rate).toBe(50);
    expect(o.assessments.find((a) => a.kind === "quiz")!.avg_score).toBe(90);
  });

  it("measures participation on closed work against the roster", () => {
    // Landing page: 3 of 4 submitted (closed); Forms is still open.
    expect(web.participation).toBe(75);
    // JS quiz: 1 of 2
    expect(js.participation).toBe(50);
    expect(web.missing).toBe(1); // Di Four missed the landing page
  });

  it("flags overdue grading and builds the queue oldest first", () => {
    expect(o.totals.pending_grading).toBe(2);
    expect(o.totals.overdue_grading).toBe(1);
    expect(o.grading_queue[0]).toMatchObject({ id: 10, kind: "assignment", waiting_days: 9 });
    expect(o.alerts[0]).toMatchObject({ id: "grading-overdue", severity: "critical" });
  });

  it("computes class averages from per-student averages", () => {
    expect(web.avg_score).toBe(60); // Ada 90, Bo 30
    expect(js.avg_score).toBe(90);
    expect(o.totals.avg_score).toBe(75); // mean of subject averages
  });

  it("marks empty subjects as no_data and raises an info alert", () => {
    expect(w3.health).toBe("no_data");
    expect(o.alerts.some((a) => a.id === "subjects-empty")).toBe(true);
  });

  it("lists students who need support with reasons", () => {
    const bo = o.students.at_risk.find((s) => s.mis_user_id === 102)!;
    expect(bo.reasons.join(" ")).toMatch(/Average 30%/);
    expect(bo.url).toBe("/students/102");
    expect(o.students.top.every((s) => (s.avg_score ?? 0) >= 50)).toBe(true);
  });

  it("separates genuinely live proctoring from stale sessions", () => {
    expect(o.totals.live_proctoring).toBe(1);
    expect(o.totals.stale_proctoring).toBe(1);
    expect(o.totals.flagged_sessions).toBe(1);
  });

  it("warns about a deadline closing soon with low participation", () => {
    expect(o.upcoming.map((u) => u.id)).toEqual([11]);
    expect(o.totals.due_next_7_days).toBe(1);
    expect(o.alerts.some((a) => a.id === "due-low-assignment-11")).toBe(true);
  });

  it("buckets the weekly trend and score distribution", () => {
    expect(o.trend).toHaveLength(10);
    expect(o.trend[9].week_start).toBe(weekStart(NOW).toISOString());
    const total = o.trend.reduce((n, w) => n + w.submissions, 0);
    expect(total).toBe(6); // 4 assignment submissions + 2 finished quiz attempts
    expect(o.distribution.reduce((n, b) => n + b.count, 0)).toBe(3);
    expect(bandOf(30)).toBe("0-39");
    expect(bandOf(100)).toBe("90-100");
  });

  it("degrades gracefully without rosters", () => {
    const n = buildInstructorOverview(baseInput({ rosters: null }));
    expect(n.rosters_available).toBe(false);
    expect(n.totals.students).toBeNull();
    expect(n.subjects[0].participation).toBeNull();
    expect(n.totals.missing_work).toBe(0);
  });

  it("returns an all-clear when nothing needs action", () => {
    const n = buildInstructorOverview(
      baseInput({
        subjects: [{ id: 1, name: "Web UI", code: "WEB", class_groups: [] }],
        rosters: null,
        assignments: [{ id: 10, title: "A", course_id: 1, status: "published", due_date: daysAgo(2), max_score: 10 }],
        quizzes: [],
        submissions: [{ id: 1, assignment_id: 10, student_id: 1, status: "graded", grade: "8/10", submitted_at: daysAgo(3), updated_at: daysAgo(2) }],
        quizSubmissions: [],
        proctoring: [],
      }),
    );
    expect(n.alerts).toEqual([expect.objectContaining({ id: "all-clear", severity: "success" })]);
  });

  it("counts a student at risk only in the subjects where the problem is", () => {
    // Di (104) is in both subjects: misses two closed Web UI assignments but
    // does the JS quiz and passes it. Di is at risk overall (2 missing) and
    // must count against Web UI only.
    const input = baseInput();
    input.rosters!.get(2)!.push({ mis_user_id: 104, name: "Di Four", class_group_name: "L5 SOD A" });
    input.users.push({ id: 4, first_name: "Di", last_name: "Four", mis_user_id: 104 });
    input.assignments.push({ id: 14, title: "Old lab", course_id: 1, status: "published", due_date: daysAgo(10), max_score: 10 });
    input.quizSubmissions.push({ id: 9, quiz_id: 20, student_id: 4, status: "completed", grade_status: "auto_graded", percentage: 80, completed_at: daysAgo(3) });
    const n = buildInstructorOverview(input);
    const di = n.students.at_risk.find((s) => s.mis_user_id === 104)!;
    expect(di.missing).toBe(2);
    expect(di.subjects).toEqual(expect.arrayContaining(["WEB", "JS"]));
    const js = n.subjects.find((s) => s.subject_id === 2)!;
    // Bo (102) missed the JS quiz and Old lab (2 missing, one of them in JS)
    // so he counts in JS; Di only missed Web UI work and must not.
    expect(js.at_risk).toBe(1);
    expect(n.subjects.find((s) => s.subject_id === 1)!.at_risk).toBeGreaterThanOrEqual(2); // Bo (failing) + Di
  });

  describe("important notifications", () => {
    it("reports new submissions from the last 24 hours", () => {
      const a = o.alerts.find((x) => x.id === "new-submissions")!;
      expect(a.title).toBe("1 new submission in the last 24 hours");
      expect(o.totals.new_submissions_24h).toBe(1);
    });

    it("flags a just-closed assessment that many students didn't submit", () => {
      const n = buildInstructorOverview(
        baseInput({
          assignments: [{ id: 30, title: "Portfolio", course_id: 1, status: "published", due_date: daysAgo(2), max_score: 10 }],
          submissions: [{ id: 1, assignment_id: 30, student_id: 1, status: "graded", grade: "9/10", submitted_at: daysAgo(3), updated_at: daysAgo(1) }],
          quizzes: [],
          quizSubmissions: [],
        }),
      );
      const a = n.alerts.find((x) => x.id === "closed-missing-assignment-30")!;
      expect(a.severity).toBe("warning");
      expect(a.title).toBe('3 students didn\'t submit "Portfolio"');
      expect(a.message).toMatch(/closed 2 days ago/);
    });

    it("warns when a class struggled on a graded assessment", () => {
      const subs = [1, 2, 3].map((sid, i) => ({
        id: i + 1, assignment_id: 31, student_id: sid, status: "graded", grade: `${3 + i}/10`, submitted_at: daysAgo(4), updated_at: daysAgo(3),
      }));
      const n = buildInstructorOverview(
        baseInput({
          assignments: [{ id: 31, title: "Loops test", course_id: 1, status: "published", due_date: daysAgo(3), max_score: 10 }],
          submissions: subs,
          quizzes: [],
          quizSubmissions: [],
        }),
      );
      const a = n.alerts.find((x) => x.id === "low-score-assignment-31")!;
      expect(a.title).toBe('Class struggled on "Loops test": average 40%');
      expect(a.action?.url).toBe("/assignments/31");
    });

    it("reminds about work due within 24 hours", () => {
      const n = buildInstructorOverview(
        baseInput({
          rosters: null,
          assignments: [{ id: 32, title: "Reflection", course_id: 1, status: "published", due_date: new Date(NOW.getTime() + 5 * 3600000), max_score: 10 }],
          submissions: [],
          quizzes: [],
          quizSubmissions: [],
        }),
      );
      expect(n.alerts.find((x) => x.id === "due-24h")?.title).toBe('"Reflection" is due in 5h');
    });

    it("announces students taking a proctored quiz right now", () => {
      expect(o.alerts.find((x) => x.id === "proctoring-live")?.title).toBe("1 student taking a proctored quiz now");
    });

    it("caps per-assessment alerts and rolls up the rest", () => {
      const many = Array.from({ length: 5 }, (_, i) => ({
        id: 40 + i, title: `Lab ${i}`, course_id: 1, status: "published", due_date: daysAgo(1 + i * 0.1), max_score: 10,
      }));
      const n = buildInstructorOverview(baseInput({ assignments: many, submissions: [], quizzes: [], quizSubmissions: [] }));
      expect(n.alerts.filter((x) => x.id.startsWith("closed-missing-assignment-"))).toHaveLength(3);
      expect(n.alerts.find((x) => x.id === "closed-missing-more")?.title).toBe("2 more assessments closed with low submissions");
    });

    it("keeps urgent items first", () => {
      const order = { critical: 0, warning: 1, info: 2, success: 3 } as const;
      const ranks = o.alerts.map((a) => order[a.severity]);
      expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    });

    it("exposes the targets behind its alerts (the MIS Home summary's source), consistent with the alert ids", () => {
      const t = overviewAlertTargets(o)!;
      expect(t).not.toBeNull();
      const ids = new Set(o.alerts.map((a) => a.id));
      for (const s of t.atRiskSubjects) expect(ids.has(`subject-risk-${s.subject_id}`)).toBe(true);
      for (const u of t.lowClosing.slice(0, 3)) expect(ids.has(`due-low-${u.kind}-${u.id}`)).toBe(true);
      for (const a of t.closedMissing.slice(0, 3)) expect(ids.has(`closed-missing-${a.kind}-${a.id}`)).toBe(true);
      for (const a of t.lowScores.slice(0, 3)) expect(ids.has(`low-score-${a.kind}-${a.id}`)).toBe(true);
      expect(ids.has("subjects-empty")).toBe(t.emptySubjects.length > 0);
      // Same rules from the (capped) response lists when no stash exists.
      expect(overviewAlertTargets({ ...o })).toBeNull();
      expect(alertTargets({ ...o, nowMs: NOW.getTime() }).atRiskSubjects).toEqual(t.atRiskSubjects);
    });
  });
});

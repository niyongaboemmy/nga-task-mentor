import {
  buildStaffView,
  buildStudentSummary,
  buildStudentView,
  buildSuggestions,
  collectMarks,
  collectPending,
  manualScoreResolver,
  MIN_COHORT_FOR_AGGREGATES,
  performanceStatus,
  rankStudents,
  type Mark,
  type MarkSources,
} from "../overallRanking";

const empty = (over: Partial<MarkSources> = {}): MarkSources => ({
  assignments: [],
  submissions: [],
  quizzes: [],
  quizSubmissions: [],
  manual: [],
  manualScores: [],
  localUsers: [],
  ...over,
});

const mark = (key: string, course: string, pct: number, kind: Mark["kind"] = "assignment", id = 1): Mark => ({
  key,
  course_id: course,
  kind,
  item_id: id,
  title: `${kind} ${id}`,
  pct,
  date: null,
});

const stu = (misId: number) => ({ id: misId + 1000, mis_user_id: misId });

describe("collectMarks", () => {
  it("skips drafts and ungraded work, keeps the best graded submission", () => {
    const marks = collectMarks(
      empty({
        assignments: [{ id: 1, course_id: 10, title: "Essay", max_score: 20 }],
        submissions: [
          { assignment_id: 1, grade: "18/20", status: "draft", student_id: 1001, student: stu(1) },
          { assignment_id: 1, grade: null, status: "submitted", student_id: 1002, student: stu(2) },
          { assignment_id: 1, grade: "10/20", status: "graded", student_id: 1003, student: stu(3) },
          { assignment_id: 1, grade: "15/20", status: "resubmitted", student_id: 1003, student: stu(3) },
        ],
      }),
    );
    expect(marks).toEqual([expect.objectContaining({ key: "m3", course_id: "10", kind: "assignment", pct: 75 })]);
  });

  it("reads a bare grade against the assignment's max score", () => {
    const [m] = collectMarks(
      empty({
        assignments: [{ id: 1, course_id: 10, title: "Lab", max_score: 40 }],
        submissions: [{ assignment_id: 1, grade: "30", status: "graded", student_id: 5, student: { id: 5, mis_user_id: null } }],
      }),
    );
    expect(m).toMatchObject({ key: "l5", pct: 75 });
  });

  it("counts a quiz's best completed attempt, comparing scores numerically", () => {
    const marks = collectMarks(
      empty({
        quizzes: [{ id: 7, course_id: 10, title: "Q1" }],
        quizSubmissions: [
          { quiz_id: 7, percentage: "90.00", total_score: "9.00", student_id: 1001, student: stu(1) },
          { quiz_id: 7, percentage: "100.00", total_score: "10.00", student_id: 1001, student: stu(1) },
          { quiz_id: 7, percentage: "40.00", total_score: "4.00", student_id: 1002, student: stu(2) },
        ],
      }),
    );
    expect(marks.map((m) => [m.key, m.pct]).sort()).toEqual([["m1", 100], ["m2", 40]]);
  });

  it("leaves out recorded marks that don't count to the final grade", () => {
    const marks = collectMarks(
      empty({
        manual: [
          { id: 1, course_id: 10, title: "CAT", counts_to_final: true, max_score: 50, date: null },
          { id: 2, course_id: 10, title: "Practice", counts_to_final: false, max_score: 50, date: null },
        ],
        manualScores: [
          { manual_assessment_id: 1, student_id: 1, score: 25 },
          { manual_assessment_id: 2, student_id: 1, score: 50 },
        ],
      }),
    );
    expect(marks).toEqual([expect.objectContaining({ key: "m1", kind: "recorded", pct: 50 })]);
  });

  it("resolves a recorded-mark id to a local account only when that account has no MIS id", () => {
    const resolve = manualScoreResolver([
      { id: 5, mis_user_id: null },
      { id: 6, mis_user_id: 77 },
    ]);
    expect(resolve(5)).toBe("l5");
    expect(resolve(77)).toBe("m77");
    expect(resolve(6)).toBe("m6"); // local 6 has a MIS id, so a bare 6 is a MIS id
    expect(manualScoreResolver([{ id: 5, mis_user_id: null }], [5])(5)).toBe("m5");
  });
});

describe("rankStudents", () => {
  it("ranks on the mean of subject averages and shares ranks on ties", () => {
    const marks = [
      // a: subject 1 → 100 (one item), subject 2 → 50  => 75
      mark("a", "1", 100),
      mark("a", "2", 50),
      // b: subject 1 → 80 (two items), subject 2 → 70 => 75 (tie with a)
      mark("b", "1", 70, "assignment", 1),
      mark("b", "1", 90, "quiz", 2),
      mark("b", "2", 70),
      // c: 60 everywhere
      mark("c", "1", 60),
    ];
    const ranked = rankStudents(marks, ["1", "2"], "all");
    expect(ranked.map((r) => [r.key, r.score, r.rank])).toEqual([
      ["b", 75, 1],
      ["a", 75, 1],
      ["c", 60, 3],
    ]);
  });

  it("filters by kind and by subject", () => {
    const marks = [mark("a", "1", 90, "quiz"), mark("a", "1", 10, "assignment"), mark("b", "2", 50, "quiz")];
    expect(rankStudents(marks, ["1"], "quiz").map((r) => [r.key, r.score])).toEqual([["a", 90]]);
    expect(rankStudents(marks, ["1", "2"], "assignment").map((r) => r.key)).toEqual(["a"]);
  });
});

describe("collectPending", () => {
  const now = new Date("2026-09-27T12:00:00Z");
  const src = {
    assignments: [
      { id: 1, course_id: 10, title: "Late", max_score: 10, due_date: "2026-09-20T00:00:00Z", status: "published" },
      { id: 2, course_id: 10, title: "Soon", max_score: 10, due_date: "2026-09-30T00:00:00Z", status: "published" },
      { id: 3, course_id: 10, title: "Done", max_score: 10, due_date: "2026-09-20T00:00:00Z", status: "published" },
      { id: 4, course_id: 10, title: "Waiting", max_score: 10, due_date: "2026-09-20T00:00:00Z", status: "published" },
      { id: 5, course_id: 10, title: "Closed", max_score: 10, due_date: "2026-09-20T00:00:00Z", status: "completed" },
      { id: 6, course_id: 99, title: "Other subject", max_score: 10, due_date: null, status: "published" },
    ],
    submissions: [
      { assignment_id: 3, grade: "8/10", status: "graded", student_id: 1, student: { id: 1, mis_user_id: 50 } },
      { assignment_id: 4, grade: null, status: "submitted", student_id: 1, student: { id: 1, mis_user_id: 50 } },
      // someone else's submission doesn't clear my item
      { assignment_id: 1, grade: "8/10", status: "graded", student_id: 2, student: { id: 2, mis_user_id: 51 } },
    ],
    quizzes: [
      { id: 1, course_id: 10, title: "Open quiz", status: "published", end_date: null },
      { id: 2, course_id: 10, title: "Taken", status: "published", end_date: null },
      { id: 3, course_id: 10, title: "Missed", status: "published", end_date: "2026-09-01T00:00:00Z" },
      { id: 4, course_id: 10, title: "Closing", status: "published", end_date: "2026-09-28T00:00:00Z" },
    ],
    quizSubmissions: [{ quiz_id: 2, percentage: 80, total_score: 8, student_id: 1, student: { id: 1, mis_user_id: 50 } }],
  };

  it("lists my outstanding work, most urgent first", () => {
    const pending = collectPending(src, { mis_user_id: 50, user_id: 1 }, ["10"], now);
    expect(pending.map((p) => [p.kind, p.title, p.status])).toEqual([
      ["assignment", "Late", "overdue"],
      ["quiz", "Closing", "due_soon"],
      ["assignment", "Soon", "due_soon"],
      ["quiz", "Missed", "missed"],
      ["quiz", "Open quiz", "open"],
      ["assignment", "Waiting", "awaiting_mark"],
    ]);
  });
});

describe("buildStudentView", () => {
  const subjects = [
    { course_id: "1", name: "Maths", code: "MAT" },
    { course_id: "2", name: "Physics", code: "PHY" },
  ];
  // Six students in Maths so aggregates are disclosed there; two in Physics.
  const cohort: Mark[] = [
    mark("me", "1", 40, "quiz", 1),
    mark("me", "1", 80, "assignment", 2),
    mark("s1", "1", 90),
    mark("s2", "1", 85),
    mark("s3", "1", 70),
    mark("s4", "1", 65),
    mark("s5", "1", 55),
    mark("me", "2", 90),
    mark("s1", "2", 95),
  ];

  const view = buildStudentView({ meKey: "me", subjects, marks: cohort, pending: [], kind: "all", subjectId: null });

  it("returns only my own position — no other student's key or score", () => {
    const json = JSON.stringify(view);
    for (const other of ["s1", "s2", "s3", "s4", "s5"]) expect(json).not.toContain(`"${other}"`);
    expect(view).not.toHaveProperty("rows");
    expect(view).not.toHaveProperty("members");
    expect(view.overall.rank).toBeGreaterThan(0);
    expect(view.overall.ranked_count).toBe(6);
  });

  it("ranks each subject and hides averages in cohorts under the minimum", () => {
    const maths = view.subjects.find((s) => s.course_id === "1")!;
    const physics = view.subjects.find((s) => s.course_id === "2")!;
    expect(maths).toMatchObject({ score: 60, rank: 5, ranked_count: 6 });
    expect(maths.class_average).not.toBeNull();
    expect(physics).toMatchObject({ score: 90, rank: 2, ranked_count: 2, class_average: null, gap: null });
    expect(view.privacy.aggregates_hidden).toBe(true);
    expect(MIN_COHORT_FOR_AGGREGATES).toBe(5);
  });

  it("surfaces my weakest items and a kind that holds a subject back", () => {
    const maths = view.subjects.find((s) => s.course_id === "1")!;
    expect(maths.weakest).toEqual([{ kind: "quiz", item_id: 1, title: "quiz 1", pct: 40 }]);
    expect(view.suggestions.some((s) => s.id === "skill-1-quiz")).toBe(true);
  });

  it("scopes to one subject when asked", () => {
    const one = buildStudentView({ meKey: "me", subjects, marks: cohort, pending: [], kind: "all", subjectId: "2" });
    expect(one.subjects.map((s) => s.course_id)).toEqual(["2"]);
    expect(one.overall).toMatchObject({ rank: 2, ranked_count: 2, class_average: null, points_to_next: null });
  });

  it("is unranked with a getting-started suggestion when nothing is marked", () => {
    const none = buildStudentView({ meKey: "me", subjects, marks: cohort.filter((m) => m.key !== "me"), pending: [], kind: "all", subjectId: null });
    expect(none.overall).toMatchObject({ rank: null, score: null, status: "no_marks" });
    expect(none.suggestions.map((s) => s.id)).toContain("get-started");
  });
});

describe("buildSuggestions", () => {
  const base = {
    course_id: "1",
    name: "Maths",
    code: null,
    rank: 3,
    ranked_count: 10,
    by_kind: {},
    marked_items: 3,
    pending_count: 0,
    weakest: [{ kind: "quiz" as const, item_id: 9, title: "Fractions", pct: 30 }],
  };
  const overall = {
    rank: 3, ranked_count: 10, score: 45, band: "Top quarter", top_percent: 30,
    class_average: 60, points_to_next: 2.5, marked_items: 3, status: "at_risk" as const,
  };

  it("puts deadlines and at-risk subjects first and links to the work", () => {
    const suggestions = buildSuggestions(
      [{ ...base, score: 45, class_average: 60, gap: -15, status: performanceStatus(45, -15) }],
      [{ kind: "assignment", course_id: "1", item_id: 4, title: "Essay", due_date: null, status: "overdue" }],
      overall,
    );
    expect(suggestions[0]).toMatchObject({ id: "overdue-4", priority: "high", action: { href: "/assignments/4" } });
    expect(suggestions[1]).toMatchObject({ id: "risk-1", priority: "high" });
    expect(suggestions[1].detail).toContain("Fractions");
    expect(suggestions.map((s) => s.id)).toContain("next-place");
  });

  it("flags a subject below the class average even when it passes", () => {
    const suggestions = buildSuggestions(
      [{ ...base, score: 68, class_average: 78, gap: -10, status: performanceStatus(68, -10), weakest: [] }],
      [],
      { ...overall, score: 68 },
    );
    expect(suggestions[0]).toMatchObject({ id: "gap-1", priority: "medium" });
  });
});

describe("buildStaffView", () => {
  const subjects = [
    { course_id: "1", name: "Maths", code: null },
    { course_id: "2", name: "Physics", code: null },
  ];
  const roster = [
    { key: "m1", mis_user_id: 1, name: "Alice A", class_group_id: 100, class_group_name: "S4 A" },
    { key: "m2", mis_user_id: 2, name: "Bob B", class_group_id: 100, class_group_name: "S4 A" },
    { key: "m3", mis_user_id: 3, name: "Cleo C", class_group_id: 200, class_group_name: "S4 B" },
    { key: "m4", mis_user_id: 4, name: "Dan D", class_group_id: 200, class_group_name: "S4 B" },
  ];
  const marks = [mark("m1", "1", 60), mark("m2", "1", 80), mark("m3", "1", 90), mark("m3", "2", 40), mark("l9", "2", 70)];

  it("returns a named leaderboard and lists rostered students with no marks", () => {
    const view = buildStaffView({
      subjects, marks, roster,
      fallbackNames: new Map([["l9", { name: "Local Only", mis_user_id: null }]]),
      kind: "all", subjectId: null, classGroupId: null,
    });
    expect(view.rows.map((r) => [r.rank, r.name, r.score])).toEqual([
      [1, "Bob B", 80],
      [2, "Local Only", 70],
      [3, "Cleo C", 65],
      [4, "Alice A", 60],
    ]);
    expect(view.unranked.map((u) => u.name)).toEqual(["Dan D"]);
    expect(view.class_groups).toEqual([{ id: 100, name: "S4 A" }, { id: 200, name: "S4 B" }]);
    expect(view.summary.distribution).toEqual({ excelling: 1, on_track: 2, needs_attention: 1, at_risk: 0 });
  });

  it("re-ranks within a class group", () => {
    const view = buildStaffView({
      subjects, marks, roster, fallbackNames: new Map(), kind: "all", subjectId: "1", classGroupId: 200,
    });
    expect(view.rows.map((r) => [r.rank, r.name])).toEqual([[1, "Cleo C"]]);
    expect(view.unranked.map((u) => u.name)).toEqual(["Dan D"]);
    expect(view.subjects.map((s) => s.course_id)).toEqual(["1"]);
  });
});

describe("buildStudentSummary", () => {
  const subjects = [
    { course_id: "1", name: "Maths", code: null },
    { course_id: "2", name: "Physics", code: null },
    { course_id: "3", name: "Chemistry", code: null },
  ];
  const cohort: Mark[] = [
    mark("me", "1", 30), mark("me", "2", 45), mark("me", "3", 90),
    ...["a", "b", "c", "d", "e"].flatMap((k, i) => [mark(k, "1", 60 + i * 5), mark(k, "2", 70), mark(k, "3", 70)]),
  ];
  const view = buildStudentView({
    meKey: "me", subjects, marks: cohort, kind: "all", subjectId: null,
    pending: [
      { kind: "assignment", course_id: "1", item_id: 7, title: "Late", due_date: null, status: "overdue" },
      { kind: "quiz", course_id: "2", item_id: 8, title: "Open", due_date: null, status: "open" },
    ],
  });
  const summary = buildStudentSummary(view);

  it("matches the full view's numbers", () => {
    expect(summary).toMatchObject({
      view: "student_summary",
      rank: view.overall.rank,
      ranked_count: 6,
      score: view.overall.score,
      class_average: view.overall.class_average,
      status: view.overall.status,
      subject_count: 3,
      overdue_count: 1,
    });
    expect(summary.gap).toBeCloseTo(view.overall.score! - view.overall.class_average!, 1);
  });

  it("lists at-risk subjects weakest first and the most urgent suggestion", () => {
    expect(summary.at_risk_subjects).toEqual([
      { course_id: "1", name: "Maths", score: 30 },
      { course_id: "2", name: "Physics", score: 45 },
    ]);
    expect(summary.at_risk_count).toBe(2);
    expect(summary.top_suggestion).toMatchObject({ id: "overdue-7", priority: "high" });
  });

  it("carries nothing about other students", () => {
    const json = JSON.stringify(summary);
    for (const k of ["a", "b", "c", "d", "e"]) expect(json).not.toContain(`"${k}"`);
  });
});

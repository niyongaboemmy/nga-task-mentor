import { rankingSubjectMark, subjectIsMapped, weightedSubjectMark, type WeightingContext } from "../services/marksWeighting";
import { gradingOf } from "../services/reportCardBuilders";
import { buildInstructorOverview, type OverviewInput } from "../services/instructorOverview.service";
import { buildProvisionalCard } from "../services/reportCardPreview.service";
import { rankStudents, type Mark } from "../utils/overallRanking";
import { buildStandingPayload } from "../utils/studentStanding";

/**
 * Every report built from marks weighs a subject the report card's way when
 * the subject maps its work this term: mapped category, kinds of work inside
 * it (class work 30 / homework 20 / quizzes 50 here), the builder's weights.
 * Unmapped subjects keep their old rule.
 */

const SUBJECT = 5;
const tvet = gradingOf({ builder: "tvet", category_weights: { CW: 15, HW: 10, MD: 25, EOT: 50 } });

function ctx(overrides: Partial<WeightingContext> = {}): WeightingContext {
  return {
    grading: tvet,
    mapping: new Map([
      [`${SUBJECT}:manual:1`, "FA"], // class work
      [`${SUBJECT}:manual:2`, "FA"], // homework
      [`${SUBJECT}:quiz:3`, "FA"],
    ]),
    config: { default: { FA: { class_work: 30, homework: 20, quiz: 50 } }, subjects: {} },
    term: "Term 1",
    academicYear: "2026-2027",
    ...overrides,
  };
}

// class work 80, homework 40, quiz 60 -> 24 + 8 + 30 = 62 (plain mean would be 60)
const items = [
  { type: "manual" as const, id: 1, component: "class_work", raw: 8, max: 10 },
  { type: "manual" as const, id: 2, component: "homework", raw: 4, max: 10 },
  { type: "quiz" as const, id: 3, component: "quiz", raw: 6, max: 10 },
];

describe("weightedSubjectMark", () => {
  it("weighs kinds of work inside the mapped category", () => {
    expect(weightedSubjectMark(ctx(), SUBJECT, items)).toEqual({ percentage: 62, counted: 3 });
  });

  it("leaves unmapped work out, as the card does", () => {
    const extra = [...items, { type: "assignment" as const, id: 99, component: "assignment", raw: 0, max: 10 }];
    expect(weightedSubjectMark(ctx(), SUBJECT, extra)?.percentage).toBe(62);
  });

  it("is null for a subject that maps nothing (callers keep their own rule)", () => {
    expect(weightedSubjectMark(ctx({ mapping: new Map() }), SUBJECT, items)).toBeNull();
    expect(subjectIsMapped(ctx(), SUBJECT)).toBe(true);
    expect(subjectIsMapped(ctx(), 6)).toBe(false);
  });

  it("a subject's own weights win over the school's", () => {
    const c = ctx({ config: { default: { FA: { class_work: 30, homework: 20, quiz: 50 } }, subjects: { [SUBJECT]: { FA: { class_work: 100 } } } } });
    expect(weightedSubjectMark(c, SUBJECT, items)?.percentage).toBe(80); // only class work weighted
  });
});

describe("rankings", () => {
  const mark = (key: string, kind: Mark["kind"], item_id: number, pct: number, component?: string): Mark => ({
    key, course_id: String(SUBJECT), kind, item_id, title: `#${item_id}`, pct, date: null, component,
  });
  const marks = [
    mark("m1", "recorded", 1, 80, "class_work"),
    mark("m1", "recorded", 2, 40, "homework"),
    mark("m1", "quiz", 3, 60),
  ];

  it("ranks on the weighted subject score for all work", () => {
    const [r] = rankStudents(marks, [String(SUBJECT)], "all", rankingSubjectMark(ctx()));
    expect(r.score).toBe(62);
  });

  it("keeps the plain mean for a kind filter, and without mapping", () => {
    expect(rankStudents(marks, [String(SUBJECT)], "recorded", rankingSubjectMark(ctx()))[0].score).toBe(60);
    expect(rankingSubjectMark(ctx({ mapping: new Map() }))).toBeUndefined();
    expect(rankStudents(marks, [String(SUBJECT)], "all")[0].score).toBe(60);
  });
});

describe("class standing", () => {
  it("sends each member's weighted subject score next to the tallies", () => {
    const c = ctx();
    const payload = buildStandingPayload({
      target: { mis_user_id: 101, user_id: 1 },
      subjects: [{ course_id: SUBJECT, subject_name: "Networks", subject_code: "NET", roster: [101] }],
      localIdByMisId: new Map([[101, 1]]),
      assignments: [],
      submissions: [],
      quizzes: [{ id: 3, course_id: SUBJECT }],
      quizSubmissions: [{ quiz_id: 3, percentage: 60, total_score: 6, student_id: 1, student: { id: 1, mis_user_id: 101 } }],
      recorded: [
        { id: 1, assessment_type: "class_work", course_id: SUBJECT, counts_to_final: true, max_score: 10, percentageFor: () => 80 },
        { id: 2, assessment_type: "homework", course_id: SUBJECT, counts_to_final: true, max_score: 10, percentageFor: () => 40 },
      ],
      subjectMark: (courseId, xs) =>
        weightedSubjectMark(c, Number(courseId), xs.map((i) => ({ type: i.type, id: i.id, component: i.component, raw: i.pct, max: 100 })))?.percentage ?? null,
      random: () => 0,
    });
    const me = payload.members.find((m) => m.key === "me")!;
    expect(me.weighted).toEqual({ [String(SUBJECT)]: 62 });
    expect(me.scores[String(SUBJECT)].recorded).toEqual([120, 2]);
  });
});

describe("provisional report card", () => {
  it("weighs kinds of work like the card", () => {
    const card = buildProvisionalCard(
      [{
        subject_id: SUBJECT,
        name: "Networks",
        source: "subject_mapping",
        items: [
          { assessment_type: "manual", assessment_id: 1, category: "FA", title: "CW", component: "class_work" },
          { assessment_type: "manual", assessment_id: 2, category: "FA", title: "HW", component: "homework" },
          { assessment_type: "quiz", assessment_id: 3, category: "FA", title: "Quiz", component: "quiz" },
        ],
      }],
      new Map([
        ["manual:1", { raw_score: 8, max_score: 10 }],
        ["manual:2", { raw_score: 4, max_score: 10 }],
        ["quiz:3", { raw_score: 6, max_score: 10 }],
      ]),
      tvet.weights,
      () => ({ FA: { class_work: 30, homework: 20, quiz: 50 } }),
    );
    expect(card.subjects[0].running_percentage).toBe(62);
  });
});

describe("teacher and school overview", () => {
  const input = (subjectMark?: OverviewInput["subjectMark"]): OverviewInput => ({
    now: new Date("2026-09-23T12:00:00Z"),
    academic_term_id: 1,
    subjects: [{ id: SUBJECT, name: "Networks", code: "NET", class_groups: ["Year 1 A"] }],
    rosters: new Map([[SUBJECT, [{ mis_user_id: 101, name: "Test Student", class_group_name: "Year 1 A" }]]]),
    assignments: [],
    quizzes: [{ id: 3, title: "Quiz", course_id: SUBJECT, status: "published", end_date: new Date("2026-09-20T00:00:00Z") }],
    submissions: [],
    quizSubmissions: [{ id: 1, quiz_id: 3, student_id: 1, status: "completed", grade_status: "auto_graded", percentage: 60, completed_at: new Date("2026-09-20T00:00:00Z") }],
    proctoring: [],
    users: [{ id: 1, first_name: "Test", last_name: "Student", mis_user_id: 101 }],
    manualScores: [
      { subject_id: SUBJECT, assessment_id: 1, component: "class_work", mis_user_id: 101, pct: 80 },
      { subject_id: SUBJECT, assessment_id: 2, component: "homework", mis_user_id: 101, pct: 40 },
    ],
    subjectMark,
  });

  it("weighs the student's and class's subject mark, teacher-recorded marks included", () => {
    const c = ctx();
    const o = buildInstructorOverview(
      input((sid, xs) => weightedSubjectMark(c, sid, xs.map((i) => ({ type: i.type, id: i.id, component: i.component, raw: i.pct, max: 100 })))?.percentage ?? null),
    );
    expect(o.subjects[0].avg_score).toBe(62);
  });

  it("without weighting: the mean of the online work, as before", () => {
    expect(buildInstructorOverview(input()).subjects[0].avg_score).toBe(60);
  });
});

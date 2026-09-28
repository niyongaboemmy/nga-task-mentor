import {
  buildAdminInsights,
  buildStudentRows,
  buildSubjectRows,
  paginate,
  queryStudents,
  querySubjects,
  studentFacets,
  subjectFacets,
} from "../services/adminReports.service";
import { buildInstructorOverview, type OverviewInput } from "../services/instructorOverview.service";
import { rankStudents, type Mark } from "../utils/overallRanking";
import type { SchoolDirectory } from "../services/schoolDirectory";

/**
 * Pure logic behind GET /api/dashboard/admin/{subjects,students,insights}.
 * A two-class school: Maths + Physics taught to S1 A by Teacher T1, English
 * taught to S2 B by T2 (with nothing published), Art with no teacher at all.
 */

const NOW = new Date("2026-09-23T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86400000);

const directory: SchoolDirectory = {
  academic_year_id: 7,
  class_groups: [
    { id: 10, name: "S1 A", grade_name: "S1", program_name: "O-Level" },
    { id: 20, name: "S2 B", grade_name: "S2", program_name: "A-Level" },
  ],
  students: [
    { mis_user_id: 101, first_name: "Ada", last_name: "One", name: "Ada One", email: "ada@x.rw", username: "ada", gender: "FEMALE", registration_number: "R101", class_group_id: 10 },
    { mis_user_id: 102, first_name: "Bo", last_name: "Two", name: "Bo Two", email: "bo@x.rw", username: "bo", gender: "MALE", registration_number: "R102", class_group_id: 10 },
    { mis_user_id: 103, first_name: "Cy", last_name: "Three", name: "Cy Three", email: null, username: "cy", gender: "MALE", registration_number: null, class_group_id: 10 },
    { mis_user_id: 201, first_name: "Di", last_name: "Four", name: "Di Four", email: "di@x.rw", username: "di", gender: "FEMALE", registration_number: "R201", class_group_id: 20 },
  ],
  rosters_complete: true,
  assignments_available: true,
  subject_class_groups: new Map([
    [1, [10]],
    [2, [10]],
    [3, [20]],
  ]),
  subject_teachers: new Map([
    [1, [{ mis_user_id: 900, name: "T1 Teacher" }]],
    [2, [{ mis_user_id: 900, name: "T1 Teacher" }]],
    [3, [{ mis_user_id: 901, name: "T2 Teacher" }]],
  ]),
  class_group_subjects: new Map([
    [10, [1, 2]],
    [20, [3]],
  ]),
  rosters: new Map([
    [10, [101, 102, 103]],
    [20, [201]],
  ]),
};

const subjects = [
  { id: 1, name: "Maths", code: "MAT" },
  { id: 2, name: "Physics", code: "PHY" },
  { id: 3, name: "English", code: "ENG" },
  { id: 4, name: "Art", code: "ART" },
];

function overviewInput(): OverviewInput {
  const roster = (ids: number[], group: string) =>
    ids.map((id) => ({ mis_user_id: id, name: directory.students.find((s) => s.mis_user_id === id)!.name, class_group_name: group }));
  return {
    now: NOW,
    academic_term_id: 7,
    subjects: subjects.map((s) => ({
      id: s.id,
      name: s.name,
      code: s.code,
      class_groups: s.id === 3 ? ["S2 B"] : s.id === 4 ? [] : ["S1 A"],
      teachers: (directory.subject_teachers.get(s.id) ?? []).map((t) => t.name),
    })),
    rosters: new Map([
      [1, roster([101, 102, 103], "S1 A")],
      [2, roster([101, 102, 103], "S1 A")],
      [3, roster([201], "S2 B")],
      [4, []],
    ]),
    assignments: [
      { id: 1, title: "Algebra", course_id: 1, status: "published", due_date: daysAgo(10), max_score: 10 },
      { id: 2, title: "Motion", course_id: 2, status: "published", due_date: daysAgo(5), max_score: 10 },
      { id: 3, title: "Essay draft", course_id: 3, status: "draft", due_date: null, max_score: 10 },
    ],
    quizzes: [],
    submissions: [
      { id: 1, assignment_id: 1, student_id: 1, status: "graded", grade: "9/10", submitted_at: daysAgo(11) },
      { id: 2, assignment_id: 1, student_id: 2, status: "graded", grade: "3/10", submitted_at: daysAgo(11) },
      // Waiting 12 days for a grade -> overdue grading for T1.
      { id: 3, assignment_id: 2, student_id: 1, status: "submitted", submitted_at: daysAgo(12) },
    ],
    quizSubmissions: [],
    proctoring: [],
    users: [
      { id: 1, first_name: "Ada", last_name: "One", mis_user_id: 101 },
      { id: 2, first_name: "Bo", last_name: "Two", mis_user_id: 102 },
    ],
    include_all_students: true,
  };
}

const mark = (key: string, course: number, pct: number, kind: Mark["kind"] = "assignment"): Mark =>
  ({ key, course_id: String(course), kind, item_id: Math.round(pct), pct, title: "x", at: null } as unknown as Mark);

function build() {
  const overview = buildInstructorOverview(overviewInput());
  const subjectRows = buildSubjectRows(overview.subjects, directory, new Map([[1, 3]]));
  const marks = [
    mark("m101", 1, 90),
    mark("m101", 1, 70, "recorded"),
    mark("m102", 1, 30),
    // A student who left the roster but still has a mark.
    mark("m555", 2, 60),
  ];
  const ranked = rankStudents(marks, subjects.map((s) => String(s.id)), "all");
  const studentRows = buildStudentRows({
    directory,
    subjects,
    ranked,
    overviewStudents: overview.students.all ?? [],
    fallbackNames: new Map([["m555", { name: "Gone Student", mis_user_id: 555, local_id: 55 }]]),
  });
  return { overview, subjectRows, studentRows };
}

describe("paginate", () => {
  it("clamps the page and size", () => {
    const rows = Array.from({ length: 45 }, (_, i) => i);
    expect(paginate(rows, 3, 20)).toMatchObject({ rows: [40, 41, 42, 43, 44], page: 3, total: 45, total_pages: 3 });
    expect(paginate(rows, 99, 20).page).toBe(3);
    expect(paginate(rows, 0, 500).page_size).toBe(100);
    expect(paginate([], 1, 20)).toMatchObject({ rows: [], page: 1, total_pages: 1 });
  });
});

describe("subject rows", () => {
  it("joins teachers, class groups, programmes and report-card mapping", () => {
    const { subjectRows } = build();
    const maths = subjectRows.find((r) => r.subject_id === 1)!;
    expect(maths.teacher_list).toEqual([{ mis_user_id: 900, name: "T1 Teacher" }]);
    expect(maths.teachers).toEqual(["T1 Teacher"]);
    expect(maths.class_group_list.map((g) => g.name)).toEqual(["S1 A"]);
    expect(maths.programmes).toEqual(["O-Level"]);
    expect(maths.report_card).toEqual({ mapped: true, mapped_items: 3 });
    expect(maths.students).toBe(3);
    expect(subjectRows.find((r) => r.subject_id === 4)!.teacher_list).toEqual([]);
  });

  it("filters, counts health without the health filter, sorts and pages", () => {
    const { subjectRows } = build();
    const all = querySubjects(subjectRows, {});
    expect(all.page.total).toBe(4);
    const counts = Object.values(all.health_counts).reduce((a, b) => a + b, 0);
    expect(counts).toBe(4);

    expect(querySubjects(subjectRows, { search: "t1 teach" }).page.rows.map((r) => r.subject_id).sort()).toEqual([1, 2]);
    expect(querySubjects(subjectRows, { programme: "A-Level" }).page.rows.map((r) => r.subject_id)).toEqual([3]);
    expect(querySubjects(subjectRows, { classGroupId: 10 }).page.total).toBe(2);
    expect(querySubjects(subjectRows, { teacherId: 901 }).page.rows[0].subject_id).toBe(3);
    expect(querySubjects(subjectRows, { flag: "unmapped" }).page.total).toBe(3);
    expect(querySubjects(subjectRows, { flag: "no_teacher" }).page.rows.map((r) => r.subject_id)).toEqual([4]);
    expect(querySubjects(subjectRows, { flag: "no_work" }).page.rows.map((r) => r.subject_id).sort()).toEqual([3, 4]);
    expect(querySubjects(subjectRows, { flag: "grading_overdue" }).page.rows.map((r) => r.subject_id)).toEqual([2]);

    const byName = querySubjects(subjectRows, { sort: "name", dir: "desc" }).page.rows.map((r) => r.subject_name);
    expect(byName).toEqual(["Physics", "Maths", "English", "Art"]);
    // Nulls sort last in both directions.
    const byAvgAsc = querySubjects(subjectRows, { sort: "avg_score", dir: "asc" }).page.rows;
    const byAvgDesc = querySubjects(subjectRows, { sort: "avg_score", dir: "desc" }).page.rows;
    expect(byAvgAsc[0].avg_score).not.toBeNull();
    expect(byAvgDesc[0].avg_score).not.toBeNull();
    expect(byAvgAsc[byAvgAsc.length - 1].avg_score).toBeNull();

    const paged = querySubjects(subjectRows, { sort: "name", pageSize: 3, page: 2 });
    expect(paged.page.rows.map((r) => r.subject_name)).toEqual(["Physics"]);
    expect(paged.page.total_pages).toBe(2);
  });

  it("builds facets from every row", () => {
    const { subjectRows } = build();
    const f = subjectFacets(subjectRows);
    expect(f.programmes).toEqual(["A-Level", "O-Level"]);
    expect(f.class_groups.map((g) => g.id)).toEqual([10, 20]);
    expect(f.teachers.map((t) => t.mis_user_id)).toEqual([900, 901]);
  });
});

describe("student rows", () => {
  it("lists every roster student plus marked students off the roster", () => {
    const { studentRows } = build();
    expect(studentRows.map((r) => r.key)).toEqual(["m101", "m102", "m103", "m201", "m555"]);

    const ada = studentRows[0];
    expect(ada).toMatchObject({
      mis_user_id: 101,
      name: "Ada One",
      email: "ada@x.rw",
      registration_number: "R101",
      class_group: { id: 10, name: "S1 A", program_name: "O-Level" },
      average: 80,
      rank: 1,
      status: "excelling",
      marked_items: 2,
      subjects_marked: 1,
    });
    expect(ada.subjects.map((s) => s.code)).toEqual(["MAT", "PHY"]);
    expect(ada.by_kind).toEqual({ assignment: 90, recorded: 70 });
    expect(ada.weakest).toMatchObject({ id: 1, score: 80 });

    const bo = studentRows[1];
    expect(bo).toMatchObject({ average: 30, status: "at_risk" });
    expect(bo.reasons).toContain("Average 30%");

    // Cy has no marks and missed the closed Maths + Physics work.
    const cy = studentRows[2];
    expect(cy).toMatchObject({ average: null, status: "no_marks", rank: null, missing: 2 });
    expect(cy.reasons).toContain("2 missing submissions");

    const gone = studentRows[4];
    expect(gone).toMatchObject({ name: "Gone Student", class_group: null, local_id: 55, average: 60 });
    expect(gone.subjects.map((s) => s.id)).toEqual([2]);
  });

  it("filters by search, class, programme, subject, status, attention and gender", () => {
    const { studentRows } = build();
    const keys = (q: Parameters<typeof queryStudents>[1]) => queryStudents(studentRows, q).page.rows.map((r) => r.key);
    expect(keys({ search: "R201" })).toEqual(["m201"]);
    expect(keys({ search: "bo@x" })).toEqual(["m102"]);
    expect(keys({ classGroupId: 20 })).toEqual(["m201"]);
    expect(keys({ programme: "O-Level" })).toEqual(["m101", "m102", "m103"]);
    expect(keys({ subjectId: 3 })).toEqual(["m201"]);
    expect(keys({ status: "no_marks" })).toEqual(["m103", "m201"]);
    expect(keys({ attention: true })).toEqual(["m102", "m103"]);
    expect(keys({ gender: "F" })).toEqual(["m101", "m201"]);
    expect(keys({ sort: "average", dir: "desc" })).toEqual(["m101", "m555", "m102", "m103", "m201"]);
  });

  it("summarises the filtered set and counts statuses before the status filter", () => {
    const { studentRows } = build();
    const r = queryStudents(studentRows, { status: "at_risk" });
    expect(r.page.total).toBe(1);
    expect(r.status_counts).toEqual({ excelling: 1, on_track: 0, needs_attention: 1, at_risk: 1, no_marks: 2 });
    expect(r.summary).toEqual({ students: 5, with_marks: 3, average: 56.7, needing_support: 2, missing_work: 3 }); // Cy 2 + Bo 1 (Motion)
    const f = studentFacets(studentRows, subjects);
    expect(f.class_groups.map((g) => [g.id, g.students])).toEqual([[10, 3], [20, 1]]);
    expect(f.unassigned).toBe(1);
  });
});

describe("school insights", () => {
  it("rolls subjects up to teachers and students up to classes, and lists decisions", () => {
    const { overview, subjectRows, studentRows } = build();
    const insights = buildAdminInsights({
      now: NOW,
      overview,
      subjectRows,
      studentRows,
      directory,
      reportCards: { term: "Term 1", academic_year: "2026", cards: { draft: 2, saved: 1, approved: 1, total: 4 } },
    });

    const t1 = insights.teachers.find((t) => t.mis_user_id === 900)!;
    const t2 = insights.teachers.find((t) => t.mis_user_id === 901)!;
    expect(t2).toMatchObject({ status: "inactive", published: 0, drafts: 1 });
    expect(t1).toMatchObject({ status: "behind", published: 2, pending: 1, overdue_pending: 1, class_groups: 1, unmapped_subjects: 1 });
    expect(t1.subjects.map((s) => s.code)).toEqual(["MAT", "PHY"]);
    // Inactive teachers first.
    expect(insights.teachers[0].mis_user_id).toBe(901);

    const s1a = insights.class_groups.find((g) => g.id === 10)!;
    expect(s1a).toMatchObject({ students: 3, with_marks: 2, average: 55, pass_rate: 50, at_risk: 2, excelling: 1 });
    expect(insights.programmes.find((p) => p.name === "O-Level")).toMatchObject({ students: 3, average: 55 });

    expect(insights.coverage.no_teacher.map((s) => s.id)).toEqual([4]);
    expect(insights.coverage.no_published_work.map((s) => s.id)).toEqual([3]);
    expect(insights.coverage.unmapped.map((s) => s.id)).toEqual([2, 3]);
    expect(insights.coverage.students_without_marks).toBe(2);

    expect(insights.school).toMatchObject({ subjects: 4, subjects_with_work: 2, teachers: 2, students: 5, students_with_marks: 3, report_cards_mapped: 1, report_cards_approved: 1 });
    expect(insights.report_cards).toMatchObject({ subjects_mapped: 1, subjects_total: 4, cards: { total: 4 } });

    const ids = insights.decisions.map((d) => d.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "admin-teachers-inactive",
        "admin-grading-overdue",
        "admin-report-cards-unmapped",
        "admin-students-support",
        "admin-subjects-no-teacher",
      ]),
    );
    expect(insights.decisions.find((d) => d.id === "admin-grading-overdue")!.action!.url).toBe("/courses?flag=grading_overdue");
  });

  it("doesn't claim subjects lack a teacher when the assignment list failed", () => {
    const { overview, subjectRows, studentRows } = build();
    const insights = buildAdminInsights({
      now: NOW,
      overview,
      subjectRows,
      studentRows,
      directory: { ...directory, assignments_available: false },
      reportCards: { term: null, academic_year: null, cards: { draft: 0, saved: 0, approved: 0, total: 0 } },
    });
    expect(insights.coverage.no_teacher).toEqual([]);
    expect(insights.decisions.map((d) => d.id)).not.toContain("admin-subjects-no-teacher");
  });
});

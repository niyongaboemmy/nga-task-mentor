import request from "supertest";
import axios from "axios";
import crypto from "crypto";
import {
  buildTestApp,
  ensureModelsRegistered,
  findSeededUserByRole,
  signTokenFor,
} from "./testApp";
import { sequelize } from "../config/database";
import {
  Assignment,
  ManualAssessment,
  ManualAssessmentScore,
  Submission,
  SubjectAssessmentMapping,
} from "../models";
import { clearInstructorOverviewCache } from "../controllers/instructorOverview.controller";
import { clearAdminReportsCache } from "../controllers/adminReports.controller";
import { clearSchoolDirectoryCache } from "../services/schoolDirectory";

/**
 * GET /api/dashboard/admin/{subjects,students,insights} against the real dev
 * DB and middleware chain, with MIS mocked: a subject catalogue of two
 * subjects, one class group of two students, one teacher assignment. The
 * roster student maps to the seeded local student (so their submission must
 * be found through the local id). Fixtures use ids no real subject has and
 * are removed afterwards. Run with --runInBand.
 */

jest.mock("axios", () => {
  const actual = jest.requireActual("axios");
  return { __esModule: true, ...actual, default: { ...actual.default, get: jest.fn() } };
});
const mockedGet = axios.get as jest.Mock;

const RUN = crypto.randomBytes(3).toString("hex");
const SUBJ_A = 990301; // taught to the class, has work
const SUBJ_B = 990302; // in the catalogue, nobody teaches it
const CLASS_GROUP = 990399;
const OTHER_STUDENT = 990911;
const TERM = `Adm Term ${RUN}`;
const YEAR = `Adm Year ${RUN}`;
const MIS_HEADER = { "x-mis-token": "test-mis-token" };

let app: ReturnType<typeof buildTestApp>;
let adminToken: string;
let instructorToken: string;
let studentToken: string;
let studentMisId: number;
const assignmentIds: number[] = [];
const manualIds: number[] = [];

function mockMis(opts: { rosterFails?: boolean } = {}) {
  mockedGet.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.endsWith("/academics/subjects")) {
      return {
        data: {
          success: true,
          data: [
            { subject_id: SUBJ_A, name: `Admin Maths ${RUN}`, code: "AMA" },
            { subject_id: SUBJ_B, name: `Admin Art ${RUN}`, code: "AAR" },
          ],
        },
      };
    }
    if (u.endsWith("/academics/class-groups")) {
      return {
        data: { success: true, data: [{ class_group_id: CLASS_GROUP, name: `Adm S5 ${RUN}`, grade_name: "S5", program_name: "Sciences" }] },
      };
    }
    if (u.endsWith("/academics/teacher-assignments")) {
      return {
        data: {
          success: true,
          data: [{ user_id: 990801, teacher_name: "Tess Teacher", subject_id: SUBJ_A, class_group_id: CLASS_GROUP }],
        },
      };
    }
    if (u.endsWith(`/academics/class-groups/${CLASS_GROUP}/students`)) {
      if (opts.rosterFails) throw new Error("MIS down");
      return {
        data: {
          success: true,
          data: [
            { user_id: studentMisId, first_name: "Jane", last_name: "Roster", email: "jane@x.rw", username: "jane", gender: "FEMALE" },
            { user_id: OTHER_STUDENT, first_name: "Omar", last_name: "Other", email: "omar@x.rw", username: "omar", gender: "MALE" },
          ],
        },
      };
    }
    return { data: { success: true, data: [] } };
  });
}

const get = (path: string, token = adminToken) =>
  request(app)
    .get(`/api/dashboard/admin/${path}${path.includes("?") ? "&" : "?"}term=${encodeURIComponent(TERM)}&academic_year=${encodeURIComponent(YEAR)}`)
    .set("Authorization", `Bearer ${token}`)
    .set(MIS_HEADER);

beforeAll(async () => {
  await ensureModelsRegistered();
  app = buildTestApp();
  const admin = await findSeededUserByRole("admin");
  const instructor = await findSeededUserByRole("instructor");
  const student = await findSeededUserByRole("student");
  adminToken = signTokenFor(admin.id);
  instructorToken = signTokenFor(instructor.id);
  studentToken = signTokenFor(student.id);
  if (!student.mis_user_id) throw new Error("The seeded student needs a mis_user_id for this spec");
  studentMisId = Number(student.mis_user_id);

  const past = new Date(Date.now() - 3 * 86400000);
  const a = await Assignment.create({
    title: `Admin algebra ${RUN}`,
    description: "admin reports fixture",
    due_date: past,
    max_score: 20,
    submission_type: "text",
    course_id: SUBJ_A,
    academic_term_id: null,
    created_by: instructor.id,
    status: "published",
  } as any);
  assignmentIds.push(a.id!);
  await Submission.create({
    assignment_id: a.id!,
    student_id: student.id, // local id; the roster knows them by MIS id
    status: "graded",
    grade: "15/20",
    text_submission: "x",
    is_late: false,
    submitted_at: past,
  } as any);

  const m = await ManualAssessment.create({
    course_id: SUBJ_A,
    title: `Admin midterm ${RUN}`,
    assessment_type: "midterm",
    max_score: 100,
    term: TERM,
    academic_year: YEAR,
    add_to_final_grade: true,
  } as any);
  manualIds.push(m.id!);
  await ManualAssessmentScore.create({ manual_assessment_id: m.id!, student_id: OTHER_STUDENT, score: 40 } as any);
  await SubjectAssessmentMapping.create({
    subject_id: SUBJ_A,
    term: TERM,
    academic_year: YEAR,
    assessment_type: "manual",
    assessment_id: m.id!,
    category: "MD",
  } as any);
});

afterAll(async () => {
  await SubjectAssessmentMapping.destroy({ where: { subject_id: [SUBJ_A, SUBJ_B], term: TERM } });
  if (manualIds.length) {
    await ManualAssessmentScore.destroy({ where: { manual_assessment_id: manualIds } });
    await ManualAssessment.destroy({ where: { id: manualIds } });
  }
  if (assignmentIds.length) {
    await Submission.destroy({ where: { assignment_id: assignmentIds } });
    await Assignment.destroy({ where: { id: assignmentIds } });
  }
  await sequelize.close();
});

beforeEach(() => {
  clearInstructorOverviewCache();
  clearAdminReportsCache();
  clearSchoolDirectoryCache();
  mockMis();
});

describe("admin reports access", () => {
  it("refuses teachers and students", async () => {
    for (const path of ["subjects", "students", "insights"]) {
      expect((await get(path, instructorToken)).status).toBe(403);
      expect((await get(path, studentToken)).status).toBe(403);
    }
  });

  it("rejects bad filters with 400", async () => {
    expect((await get("subjects?sort=nope")).status).toBe(400);
    expect((await get("students?status=great")).status).toBe(400);
    expect((await get("students?pageSize=5000")).status).toBe(400);
  });
});

describe("GET /api/dashboard/admin/subjects", () => {
  it("lists every catalogue subject with teachers, classes, participation and report-card mapping", async () => {
    const res = await get("subjects?sort=name");
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.total).toBe(2);
    const a = d.rows.find((r: any) => r.subject_id === SUBJ_A);
    const b = d.rows.find((r: any) => r.subject_id === SUBJ_B);
    expect(a).toMatchObject({
      teachers: ["Tess Teacher"],
      class_groups: [`Adm S5 ${RUN}`],
      programmes: ["Sciences"],
      students: 2,
      published: 1,
      submissions: 1,
      participation: 50,
      avg_score: 75,
      report_card: { mapped: true, mapped_items: 1 },
    });
    expect(b).toMatchObject({ teacher_list: [], students: 0, report_card: { mapped: false } });
    expect(d.rosters_available).toBe(true);
    expect(d.facets.teachers).toEqual([{ mis_user_id: 990801, name: "Tess Teacher" }]);
  });

  it("pages, searches and filters by flag and teacher", async () => {
    const page2 = await get("subjects?sort=name&pageSize=1&page=2");
    expect(page2.body.data).toMatchObject({ page: 2, total: 2, total_pages: 2 });
    expect(page2.body.data.rows[0].subject_id).toBe(SUBJ_A);
    expect((await get("subjects?search=tess")).body.data.rows.map((r: any) => r.subject_id)).toEqual([SUBJ_A]);
    expect((await get("subjects?flag=no_teacher")).body.data.rows.map((r: any) => r.subject_id)).toEqual([SUBJ_B]);
    expect((await get("subjects?teacherId=990801")).body.data.total).toBe(1);
  });

  it("still answers without rosters, with participation unknown", async () => {
    mockMis({ rosterFails: true });
    const res = await get("subjects");
    expect(res.status).toBe(200);
    expect(res.body.data.rosters_available).toBe(false);
    expect(res.body.data.rows.find((r: any) => r.subject_id === SUBJ_A).participation).toBeNull();
  });
});

describe("GET /api/dashboard/admin/students", () => {
  it("lists the roster with averages from online work and recorded marks", async () => {
    const res = await get("students?sort=name");
    expect(res.status).toBe(200);
    const d = res.body.data;
    const jane = d.rows.find((r: any) => r.mis_user_id === studentMisId);
    const omar = d.rows.find((r: any) => r.mis_user_id === OTHER_STUDENT);
    expect(jane).toMatchObject({
      name: "Jane Roster",
      email: "jane@x.rw",
      class_group: { id: CLASS_GROUP, program_name: "Sciences" },
      average: 75,
      status: "on_track",
      rank: 1,
      missing: 0,
    });
    expect(jane.subjects.map((s: any) => s.id)).toEqual([SUBJ_A]);
    // Omar: 40 on the recorded midterm, and never turned in the closed assignment.
    expect(omar).toMatchObject({ average: 40, status: "at_risk", rank: 2, missing: 1 });
    expect(omar.by_kind).toEqual({ recorded: 40 });
    expect(d.summary).toMatchObject({ with_marks: 2, average: 57.5, needing_support: 1 });
    expect(d.facets.class_groups).toEqual([expect.objectContaining({ id: CLASS_GROUP, students: 2 })]);
  });

  it("filters and pages server-side", async () => {
    const byStatus = await get("students?status=at_risk");
    expect(byStatus.body.data.rows.map((r: any) => r.mis_user_id)).toEqual([OTHER_STUDENT]);
    expect(byStatus.body.data.status_counts.on_track).toBe(1);
    expect((await get("students?search=omar@")).body.data.total).toBe(1);
    expect((await get(`students?classGroupId=${CLASS_GROUP}&pageSize=1&sort=average&dir=desc`)).body.data).toMatchObject({
      total: 2,
      total_pages: 2,
      rows: [expect.objectContaining({ mis_user_id: studentMisId })],
    });
    expect((await get("students?attention=1")).body.data.total).toBe(1);
  });
});

describe("GET /api/dashboard/admin/insights", () => {
  it("rolls the school up by teacher, class and programme", async () => {
    const res = await get("insights");
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.teachers).toEqual([expect.objectContaining({ mis_user_id: 990801, published: 1, class_groups: 1 })]);
    expect(d.class_groups).toEqual([expect.objectContaining({ id: CLASS_GROUP, students: 2, average: 57.5, at_risk: 1 })]);
    expect(d.programmes).toEqual([expect.objectContaining({ name: "Sciences", students: 2 })]);
    expect(d.coverage.no_teacher.map((s: any) => s.id)).toEqual([SUBJ_B]);
    expect(d.report_cards).toMatchObject({ term: TERM, academic_year: YEAR, subjects_mapped: 1, subjects_total: 2 });
    expect(d.decisions.map((x: any) => x.id)).toEqual(expect.arrayContaining(["admin-subjects-no-teacher", "admin-students-support"]));
  });
});

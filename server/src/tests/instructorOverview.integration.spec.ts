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
import { Assignment, Submission } from "../models";
import { clearInstructorOverviewCache } from "../controllers/instructorOverview.controller";

/**
 * GET /api/dashboard/instructor/overview against the real dev DB and
 * middleware chain, with MIS (assigned subjects + class-group rosters)
 * mocked. Fixtures use subject ids no real subject has and are removed
 * afterwards. Run with --runInBand.
 */

jest.mock("axios", () => {
  const actual = jest.requireActual("axios");
  return { __esModule: true, ...actual, default: { ...actual.default, get: jest.fn() } };
});
const mockedGet = axios.get as jest.Mock;

const RUN = crypto.randomBytes(3).toString("hex");
const SUBJ_A = 990201; // taught
const SUBJ_B = 990202; // taught, empty
const SUBJ_C = 990203; // NOT taught -- must never leak
const CLASS_GROUP = 990299;
const MIS_HEADER = { "x-mis-token": "test-mis-token" };

let app: ReturnType<typeof buildTestApp>;
let instructorToken: string;
let studentToken: string;
let studentMisId: number;
const assignmentIds: number[] = [];

function mockMis(taught: number[]) {
  mockedGet.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes("/academics/my-assigned-subjects")) {
      return {
        data: {
          success: true,
          data: taught.map((id) => ({
            subject_id: id,
            subject_name: `Dash Subject ${id}`,
            subject_code: `DSH${id}`,
            grades: [{ class_group_id: CLASS_GROUP, class_group_name: "Dash Class", academic_year_id: 1 }],
          })),
        },
      };
    }
    if (u.includes(`/academics/class-groups/${CLASS_GROUP}/students`)) {
      return {
        data: {
          success: true,
          data: [
            { user_id: studentMisId, first_name: "Roster", last_name: "Student" },
            { user_id: 990901, first_name: "Missing", last_name: "Learner" },
          ],
        },
      };
    }
    return { data: { success: true, data: [] } };
  });
}

const get = (query = "", token = instructorToken) =>
  request(app)
    .get(`/api/dashboard/instructor/overview${query}${query ? "&" : "?"}fresh=1`)
    .set("Authorization", `Bearer ${token}`)
    .set(MIS_HEADER);

beforeAll(async () => {
  await ensureModelsRegistered();
  app = buildTestApp();
  const instructor = await findSeededUserByRole("instructor");
  const student = await findSeededUserByRole("student");
  instructorToken = signTokenFor(instructor.id);
  studentToken = signTokenFor(student.id);
  studentMisId = Number(student.mis_user_id ?? 990900);

  const past = new Date(Date.now() - 3 * 86400000);
  const make = async (course_id: number, title: string, extra: Record<string, any> = {}) => {
    const a = await Assignment.create({
      title: `${title} ${RUN}`,
      description: "dashboard fixture",
      due_date: past,
      max_score: 20,
      submission_type: "text",
      course_id,
      academic_term_id: null,
      created_by: instructor.id,
      status: "published",
      ...extra,
    } as any);
    assignmentIds.push(a.id!);
    return a;
  };
  const graded = await make(SUBJ_A, "Graded");
  const toGrade = await make(SUBJ_A, "To grade");
  await make(SUBJ_A, "Draft", { status: "draft", due_date: new Date(Date.now() + 5 * 86400000) });
  await make(SUBJ_C, "Foreign");

  await Submission.create({
    assignment_id: graded.id!,
    student_id: student.id,
    status: "graded",
    grade: "8/20",
    text_submission: "x",
    is_late: false,
    submitted_at: past,
  } as any);
  await Submission.create({
    assignment_id: toGrade.id!,
    student_id: student.id,
    status: "submitted",
    text_submission: "y",
    is_late: false,
    submitted_at: new Date(Date.now() - 10 * 86400000),
  } as any);
});

afterAll(async () => {
  if (assignmentIds.length) {
    await Submission.destroy({ where: { assignment_id: assignmentIds } });
    await Assignment.destroy({ where: { id: assignmentIds } });
  }
  await sequelize.close();
});

describe("GET /api/dashboard/instructor/overview", () => {
  beforeEach(() => clearInstructorOverviewCache());

  it("is refused to students", async () => {
    mockMis([SUBJ_A, SUBJ_B]);
    expect((await get("", studentToken)).status).toBe(403);
  });

  it("summarises only the teacher's subjects", async () => {
    mockMis([SUBJ_A, SUBJ_B]);
    const res = await get();
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.subjects.map((s: any) => s.subject_id).sort()).toEqual([SUBJ_A, SUBJ_B]);
    expect(JSON.stringify(d)).not.toContain(`Foreign ${RUN}`);

    const a = d.subjects.find((s: any) => s.subject_id === SUBJ_A);
    expect(a).toMatchObject({ assignments: 3, published: 2, drafts: 1, submissions: 2, pending: 1, overdue_pending: 1, students: 2 });
    expect(a.avg_score).toBe(40);
    // 2 closed assessments x 2 roster students = 4 expected, 2 submitted.
    expect(a.participation).toBe(50);
    expect(a.health).toBe("at_risk");
    expect(d.subjects.find((s: any) => s.subject_id === SUBJ_B).health).toBe("no_data");

    expect(d.rosters_available).toBe(true);
    expect(d.totals.pending_grading).toBe(1);
    expect(d.grading_queue[0]).toMatchObject({ kind: "assignment", pending: 1 });
    expect(d.alerts[0].severity).toBe("critical");
    expect(d.students.at_risk.map((s: any) => s.mis_user_id)).toEqual(expect.arrayContaining([990901]));
  });

  it("narrows to one subject and 404s on a subject the teacher doesn't teach", async () => {
    mockMis([SUBJ_A, SUBJ_B]);
    const one = await get(`?subjectId=${SUBJ_B}`);
    expect(one.status).toBe(200);
    expect(one.body.data.subjects).toHaveLength(1);
    expect(one.body.data.totals.submissions).toBe(0);
    expect((await get(`?subjectId=${SUBJ_C}`)).status).toBe(404);
  });

  it("still answers when MIS rosters are unavailable", async () => {
    mockedGet.mockImplementation(async (url: string) => {
      if (String(url).includes("/class-groups/")) throw new Error("MIS down");
      if (String(url).includes("/academics/my-assigned-subjects")) {
        return { data: { success: true, data: [{ subject_id: SUBJ_A, subject_name: "A", grades: [{ class_group_id: CLASS_GROUP + 1 }] }] } };
      }
      return { data: { success: true, data: [] } };
    });
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.body.data.rosters_available).toBe(false);
    expect(res.body.data.subjects[0].participation).toBeNull();
  });

  it("reuses a recent overview for polling and bypasses it with fresh=1", async () => {
    mockMis([SUBJ_A, SUBJ_B]);
    const poll = () =>
      request(app)
        .get("/api/dashboard/instructor/overview")
        .set("Authorization", `Bearer ${instructorToken}`)
        .set(MIS_HEADER);
    const first = await poll();
    expect(first.status).toBe(200);
    const extra = await Assignment.create({
      title: `Cache probe ${RUN}`, description: "x", due_date: new Date(Date.now() + 86400000), max_score: 10,
      submission_type: "text", course_id: SUBJ_B, academic_term_id: null, created_by: null, status: "published",
    } as any);
    assignmentIds.push(extra.id!);
    const cached = await poll();
    expect(cached.body.data.generated_at).toBe(first.body.data.generated_at);
    const fresh = await get();
    expect(fresh.body.data.subjects.find((s: any) => s.subject_id === SUBJ_B).published).toBe(1);
  });
});

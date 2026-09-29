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
import { Assignment, Permission, Role, RolePermission, Submission, User } from "../models";

/**
 * GET /api/rankings against the real dev DB and middleware chain, with MIS
 * mocked. Proves the access rules: a student only ever gets their own
 * position, never another student's name or score; a subject outside the
 * caller's scope is a 403; staff get a named leaderboard. Fixtures use subject
 * ids no real subject has and are removed afterwards. Run with --runInBand.
 */

jest.mock("axios", () => {
  const actual = jest.requireActual("axios");
  return { __esModule: true, ...actual, default: { ...actual.default, get: jest.fn() } };
});
const mockedGet = axios.get as jest.Mock;

const RUN = crypto.randomBytes(3).toString("hex");
const SUBJ_A = 990201; // the student's and the teacher's
const SUBJ_B = 990202; // nobody's here — must never be reachable
const MIS_HEADER = { "x-mis-token": "test-mis-token" };

let app: ReturnType<typeof buildTestApp>;
let student: User;
let classmate: User;
let studentToken: string;
let instructorToken: string;
let assignmentId: number | null = null;
const submissionIds: number[] = [];

function mockMis() {
  mockedGet.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes("/enrolled-subjects")) {
      return { data: { success: true, data: [{ subject_id: SUBJ_A, subject_name: `Rank Subject ${RUN}`, subject_code: "RNK" }] } };
    }
    if (u.includes("/academics/my-assigned-subjects")) {
      return { data: { success: true, data: [{ id: SUBJ_A, name: `Rank Subject ${RUN}`, code: "RNK" }] } };
    }
    if (u.includes(`/academics/subjects/${SUBJ_A}/terms/`)) {
      return {
        data: {
          success: true,
          data: [
            { user_id: student.mis_user_id, first_name: "Jane", last_name: "Student", class_group_id: 1, class_group_name: "S4 A" },
            { user_id: classmate.mis_user_id, first_name: "Classmate", last_name: RUN, class_group_id: 1, class_group_name: "S4 A" },
          ],
        },
      };
    }
    return { data: { success: true, data: [] } };
  });
}

const get = (query = "", token = studentToken) =>
  request(app).get(`/api/rankings${query}`).set("Authorization", `Bearer ${token}`).set(MIS_HEADER);

beforeAll(async () => {
  await ensureModelsRegistered();
  app = buildTestApp();
  student = await findSeededUserByRole("student");
  if (!student.mis_user_id) throw new Error("The seeded student needs a mis_user_id for this spec");
  const instructor = await findSeededUserByRole("instructor");
  studentToken = signTokenFor(student.id);
  instructorToken = signTokenFor(instructor.id);

  // A second "student" is any other local account with a MIS id; the ranking
  // only cares about marks, not the role.
  classmate =
    (await User.findOne({ where: { mis_user_id: 990299 } })) ??
    (await User.create({
      email: `rank.classmate.${RUN}@local.test`,
      password: "MIS_AUTH",
      first_name: "Classmate",
      last_name: RUN,
      role: "student",
      role_id: student.role_id,
      mis_user_id: 990299,
    } as any));

  const assignment = await Assignment.create({
    title: `Rank essay ${RUN}`,
    description: "ranking spec",
    due_date: new Date(Date.now() - 86400000),
    max_score: 10,
    submission_type: "text",
    course_id: SUBJ_A,
    created_by: instructor.id,
    status: "published",
  } as any);
  assignmentId = assignment.id!;

  for (const [who, grade] of [[student, "6/10"], [classmate, "9/10"]] as const) {
    const sub = await Submission.create({
      assignment_id: assignment.id,
      student_id: who.id,
      status: "graded",
      grade,
      is_late: false,
      text_submission: "x",
    } as any);
    submissionIds.push(sub.id!);
  }
});

beforeEach(() => {
  mockedGet.mockReset();
  mockMis();
});

// Roles with the ranking switched off (cloned from student / instructor minus
// one key), and one user on each; removed in afterAll.
const tempRoleIds: number[] = [];
const tempUserIds: number[] = [];

async function userWithRoleMinus(base: "student" | "instructor", minus: string, misId: number) {
  const baseRole = await Role.findOne({ where: { name: base }, include: [Permission] });
  const role = await Role.create({ name: `Rank ${base} no-${minus} ${RUN}`, is_system: false } as any);
  tempRoleIds.push(role.id);
  const keep = (baseRole?.permissions ?? []).filter((p) => p.key !== minus);
  await RolePermission.bulkCreate(keep.map((p) => ({ role_id: role.id, permission_id: p.id })) as any);
  const user = await User.create({
    email: `rank.${base}.${RUN}@local.test`,
    password: "MIS_AUTH",
    first_name: "Switched",
    last_name: "Off",
    role: base,
    role_id: role.id,
    mis_user_id: misId,
  } as any);
  tempUserIds.push(user.id);
  return signTokenFor(user.id);
}

afterAll(async () => {
  if (tempUserIds.length) await User.destroy({ where: { id: tempUserIds } });
  if (tempRoleIds.length) {
    await RolePermission.destroy({ where: { role_id: tempRoleIds } });
    await Role.destroy({ where: { id: tempRoleIds } });
  }
  if (submissionIds.length) await Submission.destroy({ where: { id: submissionIds } });
  if (assignmentId) await Assignment.destroy({ where: { id: assignmentId } });
  if (classmate?.email?.includes(RUN)) await classmate.destroy();
  await sequelize.close();
});

describe("GET /api/rankings — student", () => {
  it("returns only the student's own position", async () => {
    const res = await get();
    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.view).toBe("student");
    expect(data.overall).toMatchObject({ rank: 2, ranked_count: 2, score: 60 });
    // Two ranked students is under the disclosure minimum.
    expect(data.overall.class_average).toBeNull();
    expect(data.overall.points_to_next).toBeNull();
    expect(data).not.toHaveProperty("rows");
    const json = JSON.stringify(res.body);
    expect(json).not.toContain("Classmate");
    expect(json).not.toContain(String(classmate.mis_user_id));
    expect(json).not.toContain('"score":90');
    expect(data.available_subjects.map((s: any) => s.course_id)).toEqual([String(SUBJ_A)]);
  });

  it("ranks within a subject the student takes", async () => {
    const res = await get(`?subjectId=${SUBJ_A}&kind=assignment`);
    expect(res.status).toBe(200);
    expect(res.body.data.subjects).toHaveLength(1);
    expect(res.body.data.subjects[0]).toMatchObject({ course_id: String(SUBJ_A), rank: 2, score: 60 });
  });

  it("refuses a subject the student is not enrolled in", async () => {
    const res = await get(`?subjectId=${SUBJ_B}`);
    expect(res.status).toBe(403);
  });

  it("ignores a class-group filter rather than widening the view", async () => {
    const res = await get(`?classGroupId=1`);
    expect(res.status).toBe(200);
    expect(res.body.data.view).toBe("student");
    expect(JSON.stringify(res.body)).not.toContain("Classmate");
  });

  it("returns a compact overall summary for the top bar", async () => {
    // A subject filter is ignored: the chip always shows the overall standing.
    const res = await get(`?summary=1&subjectId=${SUBJ_B}&kind=quiz`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      view: "student_summary",
      rank: 2,
      ranked_count: 2,
      score: 60,
      class_average: null,
      gap: null,
      subject_count: 1,
    });
    expect(res.body.data).not.toHaveProperty("subjects");
    expect(JSON.stringify(res.body)).not.toContain("Classmate");
  });

  it("rejects malformed filters", async () => {
    expect((await get("?kind=everything")).status).toBe(400);
    expect((await get("?subjectId=abc")).status).toBe(400);
    expect((await get("?summary=maybe")).status).toBe(400);
  });

  it("requires authentication", async () => {
    const res = await request(app).get("/api/rankings");
    expect(res.status).toBe(401);
  });
});

describe("GET /api/rankings — teacher", () => {
  it("returns a named leaderboard for the teacher's subjects", async () => {
    const res = await get(`?subjectId=${SUBJ_A}`, instructorToken);
    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.view).toBe("staff");
    expect(data.rows.map((r: any) => [r.rank, r.name, r.score])).toEqual([
      [1, `Classmate ${RUN}`, 90],
      [2, "Jane Student", 60],
    ]);
    expect(data.class_groups).toEqual([{ id: 1, name: "S4 A" }]);
  });

  it("gets no summary: the top-bar chip is for students only", async () => {
    const res = await get("?summary=1", instructorToken);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ view: "none" });
    // Nothing was computed: no roster or catalogue call was made for it.
    expect(mockedGet.mock.calls.some(([url]) => String(url).includes("/students"))).toBe(false);
  });

  it("refuses a subject the teacher doesn't teach", async () => {
    const res = await get(`?subjectId=${SUBJ_B}`, instructorToken);
    expect(res.status).toBe(403);
  });
});

describe("GET /api/rankings — switched off in Roles & Permissions", () => {
  let studentOff: string;
  let teacherOff: string;

  beforeAll(async () => {
    studentOff = await userWithRoleMinus("student", "RANKINGS_VIEW_OWN", 990297);
    teacherOff = await userWithRoleMinus("instructor", "RANKINGS_VIEW_ALL", 990296);
  });

  it("refuses a student's own position without RANKINGS_VIEW_OWN", async () => {
    expect((await get("", studentOff)).status).toBe(403);
    expect((await get(`?subjectId=${SUBJ_A}`, studentOff)).status).toBe(403);
  });

  it("refuses the top-bar summary too (the client doesn't ask without the key)", async () => {
    const res = await get("?summary=1", studentOff);
    expect(res.status).toBe(403);
    expect(res.body.data).toBeUndefined();
  });

  it("refuses the leaderboard without RANKINGS_VIEW_ALL", async () => {
    const res = await get(`?subjectId=${SUBJ_A}`, teacherOff);
    expect(res.status).toBe(403);
    expect(JSON.stringify(res.body)).not.toContain("Classmate");
  });

  it("hides a student's class standing on the profile without RANKINGS_VIEW_ALL", async () => {
    const res = await request(app)
      .get(`/api/users/${student.mis_user_id}/standing`)
      .set("Authorization", `Bearer ${teacherOff}`)
      .set(MIS_HEADER);
    expect(res.status).toBe(403);
  });
});

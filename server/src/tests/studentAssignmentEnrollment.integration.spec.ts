import request from "supertest";
import axios from "axios";
import crypto from "crypto";
import { Op } from "sequelize";
import { buildTestApp, ensureModelsRegistered, findSeededUserByRole, signTokenFor } from "./testApp";
import { Assignment, Role, Submission, User } from "../models";

/**
 * A student only opens and hands in assignments of subjects they are enrolled
 * in (MIS enrolled-subjects, which MIS limits to subjects taught to the
 * student's class). 2026-11-22: students moved to another class kept a stale
 * enrollment, saw the old subject's assignment and submitted. Real dev DB,
 * MIS mocked, fixture MIS ids no real user has. Run with --runInBand.
 */

jest.mock("axios", () => {
  const actual = jest.requireActual("axios");
  return { __esModule: true, ...actual, default: { ...actual.default, get: jest.fn() } };
});
const mockedGet = axios.get as jest.Mock;

const RUN = crypto.randomBytes(3).toString("hex");
const SUBJ = 990951;
const OTHER_SUBJ = 990952;
const MIS_STUDENT = 990961;
const MIS_HEADER = { "x-mis-token": "test-mis-token" };
jest.setTimeout(60_000);

let app: ReturnType<typeof buildTestApp>;
let student: User;
let assignmentId: number;
let enrolled: number[] = [];

beforeAll(async () => {
  await ensureModelsRegistered();
  app = buildTestApp();
  const admin = await findSeededUserByRole("admin");
  await User.destroy({ where: { mis_user_id: { [Op.between]: [990961, 990969] } } as any });
  const studentRole = await Role.findOne({ where: { name: "student" } });
  student = await User.create({
    email: `sae.${RUN}@local.test`,
    password: "MIS_AUTH",
    first_name: "SAE",
    last_name: RUN,
    role: "student",
    role_id: studentRole?.id ?? null,
    mis_user_id: MIS_STUDENT,
    mis_status: "ACTIVE",
  } as any);
  const a = await Assignment.create({
    title: `Enrollment guard ${RUN}`,
    description: "studentAssignmentEnrollment.integration.spec.ts",
    due_date: new Date(Date.now() + 7 * 86_400_000),
    max_score: 10,
    submission_type: "text",
    course_id: SUBJ,
    created_by: admin.id,
    status: "published",
  } as any);
  assignmentId = a.id;

  mockedGet.mockImplementation(async (url: string) => {
    if (String(url).includes(`/academics/students/${MIS_STUDENT}/enrolled-subjects`)) {
      return {
        data: {
          success: true,
          data: enrolled.map((id) => ({ subject_id: id, subject_name: `S${id}`, subject_code: `C${id}` })),
        },
      };
    }
    return { data: { success: true, data: [] } };
  });
});

afterEach(async () => {
  await Submission.destroy({ where: { assignment_id: assignmentId } });
});

afterAll(async () => {
  if (assignmentId) await Assignment.destroy({ where: { id: assignmentId } });
  await User.destroy({ where: { mis_user_id: { [Op.between]: [990961, 990969] } } as any });
});

const auth = (r: request.Test) =>
  r.set("Authorization", `Bearer ${signTokenFor(student.id)}`).set(MIS_HEADER);
const view = async () => {
  const r = await auth(request(app).get(`/api/assignments/${assignmentId}`));
  if (r.status !== 200 && r.status !== 403) console.log("VIEW", assignmentId, r.status, JSON.stringify(r.body), await Assignment.count({ where: { id: assignmentId } }));
  return r;
};
const submit = async () => {
  const r = await auth(request(app).post(`/api/assignments/${assignmentId}/submit`)).send({ text_submission: "my answer" });
  if (![200, 201, 403].includes(r.status)) console.log("SUBMIT", assignmentId, r.status, JSON.stringify(r.body));
  return r;
};

it("a student not enrolled in the subject can neither open nor submit it", async () => {
  enrolled = [OTHER_SUBJ];
  expect((await view()).status).toBe(403);
  const denied = await submit();
  expect(denied.body.message).toMatch(/not enrolled/);
  expect(denied.status).toBe(403);
  expect(await Submission.count({ where: { assignment_id: assignmentId } })).toBe(0);
});

it("an enrolled student opens and submits it", async () => {
  enrolled = [SUBJ, OTHER_SUBJ];
  expect((await view()).status).toBe(200);
  const res = await submit();
  expect([200, 201]).toContain(res.status);
  expect(await Submission.count({ where: { assignment_id: assignmentId } })).toBe(1);
});

it("a student who already handed in work keeps viewing it after leaving the subject", async () => {
  enrolled = [SUBJ];
  await submit();
  enrolled = [OTHER_SUBJ];
  expect((await view()).status).toBe(200);
});

it("does not lock students out when MIS returns no subjects", async () => {
  enrolled = [];
  expect((await view()).status).toBe(200);
});

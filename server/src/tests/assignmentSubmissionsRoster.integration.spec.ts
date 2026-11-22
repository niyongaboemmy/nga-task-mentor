import request from "supertest";
import axios from "axios";
import crypto from "crypto";
import { Op } from "sequelize";
import { buildTestApp, ensureModelsRegistered, findSeededUserByRole, signTokenFor } from "./testApp";
import { Assignment, Submission, User } from "../models";

/**
 * An assignment's submissions page lists enrolled students only
 * (2026-11-22): a student moved to another class kept a stale MIS enrollment,
 * submitted, and showed up on the subject's assignment. The MIS subject roster
 * decides who is enrolled; inactive students' history stays listed; an empty
 * roster (MIS unreadable) hides nothing. Real dev DB, MIS mocked, fixture MIS
 * ids no real user has. Run with --runInBand.
 */

jest.mock("axios", () => {
  const actual = jest.requireActual("axios");
  return { __esModule: true, ...actual, default: { ...actual.default, get: jest.fn() } };
});
const mockedGet = axios.get as jest.Mock;

const RUN = crypto.randomBytes(3).toString("hex");
const SUBJ = 990901;
const TERM = 990902;
const MIS_ENROLLED = 990911; // on the roster, submitted
const MIS_MOVED = 990912; // stale enrollment: not on the roster, submitted
const MIS_INACTIVE = 990913; // left the school, submitted earlier
const MIS_PENDING = 990914; // on the roster, has not submitted
const MIS_HEADER = { "x-mis-token": "test-mis-token" };
jest.setTimeout(60_000);

let app: ReturnType<typeof buildTestApp>;
let admin: User;
let assignmentId: number;
let roster: any[] = [];

const mkStudent = (label: string, misId: number, status = "ACTIVE") =>
  User.create({
    email: `asr.${label}.${RUN}@local.test`,
    password: "MIS_AUTH",
    first_name: `ASR${label}`,
    last_name: RUN,
    role: "student",
    mis_user_id: misId,
    mis_status: status,
  } as any);

beforeAll(async () => {
  await ensureModelsRegistered();
  app = buildTestApp();
  admin = await findSeededUserByRole("admin");
  await User.destroy({ where: { mis_user_id: { [Op.between]: [990911, 990919] } } as any });

  const assignment = await Assignment.create({
    title: `Roster only ${RUN}`,
    description: "assignmentSubmissionsRoster.integration.spec.ts",
    due_date: new Date(Date.now() + 7 * 86_400_000),
    max_score: 10,
    submission_type: "text",
    course_id: SUBJ,
    academic_term_id: TERM,
    created_by: admin.id,
    status: "published",
  } as any);
  assignmentId = assignment.id;

  for (const [label, misId, status] of [
    ["enrolled", MIS_ENROLLED, "ACTIVE"],
    ["moved", MIS_MOVED, "ACTIVE"],
    ["inactive", MIS_INACTIVE, "INACTIVE"],
  ] as const) {
    const st = await mkStudent(label, misId, status);
    await Submission.create({
      assignment_id: assignmentId,
      student_id: st.id,
      status: "submitted",
      submitted_at: new Date(),
      text_submission: `answer ${label}`,
    } as any);
  }

  mockedGet.mockImplementation(async (url: string) => {
    if (String(url).includes(`/academics/subjects/${SUBJ}/terms/${TERM}/students`)) {
      return { data: { success: true, data: roster } };
    }
    return { data: { success: true, data: [] } };
  });
});

afterAll(async () => {
  if (assignmentId) {
    await Submission.destroy({ where: { assignment_id: assignmentId } });
    await Assignment.destroy({ where: { id: assignmentId } });
  }
  await User.destroy({ where: { mis_user_id: { [Op.between]: [990911, 990919] } } as any });
});

const list = async () => {
  const res = await request(app)
    .get(`/api/assignments/${assignmentId}/submissions`)
    .set("Authorization", `Bearer ${signTokenFor(admin.id)}`)
    .set(MIS_HEADER);
  expect(res.status).toBe(200);
  return res.body.data as any[];
};
const misIdsOf = (rows: any[]) =>
  rows.filter((r) => !r._isPlaceholder).map((r) => r.student?.mis_user_id);

it("lists enrolled students' work and leaves out a student not on the roster", async () => {
  roster = [
    { user_id: MIS_ENROLLED, first_name: "Enrolled", last_name: RUN },
    { user_id: MIS_PENDING, first_name: "Pending", last_name: RUN },
  ];
  const rows = await list();
  expect(misIdsOf(rows)).toEqual(expect.arrayContaining([MIS_ENROLLED, MIS_INACTIVE]));
  expect(misIdsOf(rows)).not.toContain(MIS_MOVED);
  const placeholders = rows.filter((r) => r._isPlaceholder).map((r) => String(r.student.id));
  expect(placeholders).toEqual([String(MIS_PENDING)]);
});

it("hides nothing when the roster comes back empty", async () => {
  roster = [];
  const rows = await list();
  expect(misIdsOf(rows)).toEqual(expect.arrayContaining([MIS_ENROLLED, MIS_MOVED, MIS_INACTIVE]));
});

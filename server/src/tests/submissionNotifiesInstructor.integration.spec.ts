import request from "supertest";
import axios from "axios";
import {
  buildTestApp,
  ensureModelsRegistered,
  findSeededUserByRole,
  signTokenFor,
} from "./testApp";
import { sequelize } from "../config/database";
import { Assignment, Submission } from "../models";
import fileServer from "../utils/fileServer";
import { clearInstructorOverviewCache } from "../controllers/instructorOverview.controller";

/**
 * A student's file submission reaches the teacher's dashboard and top-bar
 * bell ("n new submissions in the last 24 hours") on the very next poll,
 * even though the overview is cached for 60 s. Real dev DB, MIS + file-server
 * mocked. Run with --runInBand.
 */

jest.mock("axios", () => {
  const actual = jest.requireActual("axios");
  return { __esModule: true, ...actual, default: { ...actual.default, get: jest.fn() } };
});
const mockedGet = axios.get as jest.Mock;

const SUBJECT = 990311;
const MIS_HEADER = { "x-mis-token": "test-mis-token" };

let app: ReturnType<typeof buildTestApp>;
let instructorToken: string;
let studentToken: string;
let uploadSpy: jest.SpyInstance;
const assignmentIds: number[] = [];

// The bell polls without fresh=1, so this goes through the 60 s cache.
const overview = () =>
  request(app)
    .get(`/api/dashboard/instructor/overview?subjectId=${SUBJECT}`)
    .set("Authorization", `Bearer ${instructorToken}`)
    .set(MIS_HEADER);

beforeAll(async () => {
  await ensureModelsRegistered();
  app = buildTestApp();
  const instructor = await findSeededUserByRole("instructor");
  instructorToken = signTokenFor(instructor.id);
  studentToken = signTokenFor((await findSeededUserByRole("student")).id);
  mockedGet.mockImplementation(async (url: string) =>
    String(url).includes("/academics/my-assigned-subjects")
      ? { data: { success: true, data: [{ subject_id: SUBJECT, subject_name: "Bell subject", subject_code: "BELL", grades: [] }] } }
      : { data: { success: true, data: [] } },
  );
  const a = await Assignment.create({
    title: `Bell fixture ${Date.now()}`,
    description: "notification fixture",
    due_date: new Date(Date.now() + 2 * 86_400_000),
    max_score: 10,
    submission_type: "file",
    course_id: SUBJECT,
    academic_term_id: null,
    created_by: instructor.id,
    status: "published",
  } as any);
  assignmentIds.push(a.id!);
  clearInstructorOverviewCache();
  uploadSpy = jest.spyOn(fileServer, "uploadFile").mockResolvedValue(undefined);
});

afterAll(async () => {
  uploadSpy.mockRestore();
  await Submission.destroy({ where: { assignment_id: assignmentIds }, force: true } as any);
  await Assignment.destroy({ where: { id: assignmentIds }, force: true } as any);
  await sequelize.close();
});

it("shows the new submission in the teacher's alerts on the next (cached) poll", async () => {
  const before = await overview();
  expect(before.status).toBe(200);
  expect(before.body.data.totals.new_submissions_24h).toBe(0);
  expect(before.body.data.alerts.find((x: any) => x.id === "new-submissions")).toBeUndefined();

  const submit = await request(app)
    .post(`/api/assignments/${assignmentIds[0]}/submit`)
    .set("Authorization", `Bearer ${studentToken}`)
    .set(MIS_HEADER)
    .attach("file_submission", Buffer.from("%PDF-1.4 bell"), { filename: "answer.pdf", contentType: "application/pdf" });
  expect(submit.status).toBe(201);

  const after = await overview();
  expect(after.status).toBe(200);
  expect(after.body.data.totals.new_submissions_24h).toBe(1);
  expect(after.body.data.totals.pending_grading).toBeGreaterThanOrEqual(1);
  expect(after.body.data.alerts).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: "new-submissions",
        title: "1 new submission in the last 24 hours",
        action: expect.objectContaining({ url: "/submissions" }),
      }),
    ]),
  );
});

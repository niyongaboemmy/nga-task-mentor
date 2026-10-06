import request from "supertest";
import axios from "axios";
import crypto from "crypto";
import { buildTestApp, ensureModelsRegistered, findSeededUserByRole, signTokenFor } from "./testApp";
import { sequelize } from "../config/database";
import { Assignment, Submission, User } from "../models";

/**
 * GET /api/assignments/list (the /assignments page) and GET /api/assignments/:id
 * against the dev DB, MIS mocked. Fixture subject ids are fake; every row is
 * removed afterwards. Run with --runInBand.
 */

jest.mock("axios", () => {
  const actual = jest.requireActual("axios");
  return { __esModule: true, ...actual, default: { ...actual.default, get: jest.fn() } };
});
const mockedGet = axios.get as jest.Mock;
// Uploads go to the shared file-server; record them instead.
jest.mock("../utils/fileServer", () => ({ __esModule: true, default: { uploadFile: jest.fn().mockResolvedValue(undefined) } }));
import fileServer from "../utils/fileServer";

const RUN = crypto.randomBytes(3).toString("hex");
const SUBJ = 990701;
const OTHER = 990702; // the student is not enrolled here
const MIS_HEADER = { "x-mis-token": "test-mis-token" };

let app: ReturnType<typeof buildTestApp>;
let tokens: Record<"admin" | "instructor" | "student", string>;
const ids: Record<string, number> = {};
// The student scope needs a MIS id to ask MIS for enrolments; restored afterwards.
let restoreMisId: (() => Promise<unknown>) | null = null;

const get = (path: string, token: string) => request(app).get(path).set("Authorization", `Bearer ${token}`).set(MIS_HEADER);
const mineOnly = (res: request.Response) =>
  res.body.data.items.filter((a: any) => a.title.endsWith(RUN)).map((a: any) => a.title.replace(` ${RUN}`, ""));

beforeAll(async () => {
  await ensureModelsRegistered();
  app = buildTestApp();
  const [admin, instructor, student] = await Promise.all([
    findSeededUserByRole("admin"),
    findSeededUserByRole("instructor"),
    findSeededUserByRole("student"),
  ]);
  tokens = { admin: signTokenFor(admin.id), instructor: signTokenFor(instructor.id), student: signTokenFor(student.id) };
  if (!student.mis_user_id) {
    await User.update({ mis_user_id: 990799 } as any, { where: { id: student.id } });
    restoreMisId = () => User.update({ mis_user_id: null } as any, { where: { id: student.id } });
  }

  const subject = (id: number) => ({ id, name: `List subject ${id} ${RUN}`, code: `L${id}` });
  mockedGet.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes("/enrolled-subjects")) return { data: { success: true, data: [subject(SUBJ)] } };
    if (u.includes("/my-assigned-subjects")) return { data: { success: true, data: [subject(SUBJ), subject(OTHER)] } };
    if (u.endsWith("/academics/subjects")) return { data: { success: true, data: [subject(SUBJ), subject(OTHER)] } };
    return { data: { success: true, data: [] } };
  });

  const day = 86_400_000;
  // Created in this order, so newest-first is the reverse.
  const make = async (key: string, extra: Record<string, any>) => {
    const a = await Assignment.create({
      title: `${key} ${RUN}`, description: "list fixture", due_date: new Date(Date.now() + day), max_score: 10,
      submission_type: "text", course_id: SUBJ, academic_term_id: null, created_by: instructor.id, status: "published", ...extra,
    } as any);
    ids[key] = a.id!;
  };
  await make("Overdue", { due_date: new Date(Date.now() - day) });
  await make("Graded", {});
  await make("Draft", { status: "draft" });
  await make("Other class", { course_id: OTHER });
  await make("To do", { submission_type: "file" });
  await Submission.create({
    assignment_id: ids.Graded, student_id: student.id, status: "graded", grade: "8/10", text_submission: "x", is_late: false, submitted_at: new Date(),
  } as any);
});

afterAll(async () => {
  const all = Object.values(ids);
  await Submission.destroy({ where: { assignment_id: all } });
  await Assignment.destroy({ where: { id: all } });
  await restoreMisId?.();
  await sequelize.close();
});

describe("assignments list", () => {
  it("rejects an unauthenticated request", async () => {
    expect((await request(app).get("/api/assignments/list")).status).toBe(401);
  });

  it("gives a student their enrolled, visible work, newest first, with their own state", async () => {
    const res = await get("/api/assignments/list", tokens.student);
    expect(res.status).toBe(200);
    expect(res.body.data.scope).toBe("enrolled");
    expect(mineOnly(res)).toEqual(["To do", "Graded", "Overdue"]); // no draft, no other class
    const state = Object.fromEntries(res.body.data.items.map((a: any) => [a.title.replace(` ${RUN}`, ""), a.my_state]));
    expect(state).toMatchObject({ "To do": "todo", Graded: "graded", Overdue: "missed" });
    expect(res.body.data.counts).toMatchObject({ todo: 1, graded: 1, missed: 1, submitted: 0 });
  });

  it("filters a student by their own state, keeping the counts for the chips", async () => {
    const res = await get("/api/assignments/list?status=missed", tokens.student);
    expect(mineOnly(res)).toEqual(["Overdue"]);
    expect(res.body.data.counts.todo).toBe(1);
  });

  it("searches titles and subject names", async () => {
    expect(mineOnly(await get(`/api/assignments/list?search=${encodeURIComponent("graded " + RUN)}`, tokens.student))).toEqual(["Graded"]);
    expect(mineOnly(await get(`/api/assignments/list?search=${encodeURIComponent("List subject " + SUBJ)}`, tokens.student))).toHaveLength(3);
  });

  it("lets staff filter by stored status and see hand-in counts", async () => {
    const drafts = await get("/api/assignments/list?status=draft", tokens.instructor);
    expect(drafts.status).toBe(200);
    expect(mineOnly(drafts)).toEqual(["Draft"]);
    const all = await get(`/api/assignments/list?subjectId=${SUBJ}`, tokens.instructor);
    const graded = all.body.data.items.find((a: any) => a.id === ids.Graded);
    expect(graded).toMatchObject({ submission_count: 1, graded_count: 1, subject_code: `L${SUBJ}` });
  });

  it("pages without losing or repeating rows", async () => {
    const one = await get(`/api/assignments/list?subjectId=${SUBJ}&pageSize=2&page=1`, tokens.admin);
    const two = await get(`/api/assignments/list?subjectId=${SUBJ}&pageSize=2&page=2`, tokens.admin);
    expect(one.body.data.pagination).toMatchObject({ page: 1, page_size: 2 });
    const seen = [...one.body.data.items, ...two.body.data.items].map((a: any) => a.id);
    expect(new Set(seen).size).toBe(seen.length);
  });
});

describe("one assignment", () => {
  it("is not found for a student when it is a draft or another class's", async () => {
    expect((await get(`/api/assignments/${ids.Draft}`, tokens.student)).status).toBe(404);
    expect((await get(`/api/assignments/${ids["Other class"]}`, tokens.student)).status).toBe(404);
  });

  it("opens for a student when it is published in their subject, and for staff when a draft", async () => {
    expect((await get(`/api/assignments/${ids["To do"]}`, tokens.student)).status).toBe(200);
    expect((await get(`/api/assignments/${ids.Draft}`, tokens.instructor)).status).toBe(200);
  });
});

describe("handing in", () => {
  it("accepts a file on its own (uploads were silently refused since the file-server move)", async () => {
    const res = await request(app)
      .post(`/api/assignments/${ids["To do"]}/submit`)
      .set("Authorization", `Bearer ${tokens.student}`)
      .set(MIS_HEADER)
      .attach("file_submission", Buffer.from("%PDF-1.4 essay"), { filename: "essay.pdf", contentType: "application/pdf" });
    expect(res.status).toBe(201);
    const [file] = res.body.data.file_submissions;
    expect(file).toMatchObject({ originalname: "essay.pdf", mimetype: "application/pdf" });
    expect(file.path).toMatch(/^submissions\//);
    expect(fileServer.uploadFile).toHaveBeenCalledWith(expect.any(Buffer), file.path);
  });

  it("explains a missing part instead of failing with a server error", async () => {
    const res = await request(app)
      .post(`/api/assignments/${ids.Overdue}/submit`) // a text assignment
      .set("Authorization", `Bearer ${tokens.student}`)
      .set(MIS_HEADER)
      .attach("file_submission", Buffer.from("x"), { filename: "a.pdf", contentType: "application/pdf" });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("This assignment needs a written answer.");
  });
});

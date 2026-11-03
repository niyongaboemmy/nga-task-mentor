import request from "supertest";
import axios from "axios";
import {
  buildTestApp,
  ensureModelsRegistered,
  findSeededUserByRole,
  signTokenFor,
} from "./testApp";
import { sequelize } from "../config/database";
import { Quiz, QuizQuestion, QuestionBank } from "../models";
import QuizSubmission from "../models/QuizSubmission.model";

/**
 * Integration tests for quiz create / update / delete, run against the real
 * (dev) database through the real middleware chain. The MIS course lookup is
 * mocked so the suite doesn't depend on the MIS being up.
 *
 * These cover the failure modes that used to surface as an opaque 500:
 * invalid ENUM values ("practice", "archived"), out-of-range numbers, a
 * missing course id, and MIS being unreachable.
 */

jest.mock("axios", () => {
  const actual = jest.requireActual("axios");
  return { __esModule: true, ...actual, default: { ...actual.default, get: jest.fn() } };
});
const mockedGet = axios.get as jest.Mock;

const COURSE_ID = 4242;
const MIS_HEADER = { "x-mis-token": "test-mis-token" };

let app: ReturnType<typeof buildTestApp>;
let adminToken: string;
let studentToken: string;
let adminId: number;
let studentId: number;
const createdQuizIds: number[] = [];
const createdBankIds: number[] = [];

const validQuiz = {
  title: "Integration test quiz",
  description: "Created by quizCrud.integration.spec.ts",
  type: "Exam",
  instructions: "Answer everything",
  max_attempts: 2,
  passing_score: 55.5,
  show_results_immediately: false,
  randomize_questions: true,
  show_correct_answers: true,
  enable_automatic_grading: false,
  require_manual_grading: true,
  is_public: true,
  start_date: "2026-09-21T08:00:00.000Z",
  end_date: "2026-09-28T08:00:00.000Z",
};

function misCourseFound() {
  mockedGet.mockResolvedValue({
    data: { success: true, data: { id: COURSE_ID, name: "Maths" } },
  });
}

function post(body: any, token = adminToken) {
  return request(app)
    .post(`/api/courses/${COURSE_ID}/quizzes`)
    .set("Authorization", `Bearer ${token}`)
    .set(MIS_HEADER)
    .send(body);
}

beforeAll(async () => {
  await ensureModelsRegistered();
  app = buildTestApp();
  const admin = await findSeededUserByRole("admin");
  const student = await findSeededUserByRole("student");
  adminId = admin.id;
  studentId = student.id;
  adminToken = signTokenFor(admin.id);
  studentToken = signTokenFor(student.id);
});

beforeEach(() => {
  mockedGet.mockReset();
  misCourseFound();
});

afterAll(async () => {
  if (createdQuizIds.length) {
    await QuizSubmission.destroy({ where: { quiz_id: createdQuizIds } });
    await QuizQuestion.destroy({ where: { quiz_id: createdQuizIds } });
    await Quiz.scope("withDeleted").destroy({ where: { id: createdQuizIds } });
  }
  if (createdBankIds.length) {
    await QuestionBank.destroy({ where: { id: createdBankIds } });
  }
  await sequelize.close();
});

describe("POST /api/courses/:courseId/quizzes", () => {
  it("creates a quiz and persists every submitted field", async () => {
    const res = await post(validQuiz);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("Quiz created successfully");

    const q = res.body.data;
    createdQuizIds.push(q.id);
    expect(q).toMatchObject({
      title: validQuiz.title,
      description: validQuiz.description,
      type: "Exam",
      status: "draft",
      instructions: validQuiz.instructions,
      max_attempts: 2,
      show_results_immediately: false,
      randomize_questions: true,
      show_correct_answers: true,
      enable_automatic_grading: false,
      require_manual_grading: true,
      is_public: true,
      course_id: COURSE_ID,
      created_by: adminId,
    });
    expect(Number(q.passing_score)).toBe(55.5);
    expect(new Date(q.start_date).toISOString()).toBe(validQuiz.start_date);
    expect(new Date(q.end_date).toISOString()).toBe(validQuiz.end_date);
    expect(q.time_limit ?? null).toBeNull();
  });

  it("stores an optional overall duration (time_limit, minutes)", async () => {
    const res = await post({ ...validQuiz, time_limit: 90 });
    expect(res.status).toBe(201);
    createdQuizIds.push(res.body.data.id);
    expect(res.body.data.time_limit).toBe(90);
  });

  it("rejects an out-of-range duration with a field error", async () => {
    const res = await post({ ...validQuiz, time_limit: 0 });
    expect(res.status).toBe(400);
    expect(res.body.errors.map((e: any) => e.field)).toContain("time_limit");
  });

  it("returns 400 (not 500) with field errors for the legacy 'practice' type", async () => {
    const res = await post({ ...validQuiz, type: "practice" });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errors).toEqual([
      expect.objectContaining({ field: "type" }),
    ]);
    expect(res.body.message).toMatch(/Quiz type must be one of/);
  });

  it("returns 400 with every offending field listed", async () => {
    const res = await post({
      ...validQuiz,
      title: "",
      passing_score: 150,
      max_attempts: 0,
      start_date: "2026-09-28T08:00:00Z",
      end_date: "2026-09-21T08:00:00Z",
    });
    expect(res.status).toBe(400);
    const fields = res.body.errors.map((e: any) => e.field);
    expect(fields).toEqual(
      expect.arrayContaining(["title", "passing_score", "max_attempts", "end_date"]),
    );
  });

  it("returns 400 when title/description are missing entirely", async () => {
    const res = await post({});
    expect(res.status).toBe(400);
    const fields = res.body.errors.map((e: any) => e.field);
    expect(fields).toEqual(expect.arrayContaining(["title", "description"]));
  });

  it("returns 404 when MIS says the course does not exist", async () => {
    mockedGet.mockRejectedValue({
      isAxiosError: true,
      response: { status: 404, data: { success: false } },
    });
    const res = await post(validQuiz);
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Course not found");
  });

  it("returns 502 with a clear message when MIS is unreachable (was 'Course not found')", async () => {
    mockedGet.mockRejectedValue(new Error("connect ECONNREFUSED"));
    const res = await post(validQuiz);
    expect(res.status).toBe(502);
    expect(res.body.message).toMatch(/Could not verify the course/);
  });

  it("returns 400 for a non-numeric course id", async () => {
    const res = await request(app)
      .post(`/api/courses/not-a-number/quizzes`)
      .set("Authorization", `Bearer ${adminToken}`)
      .set(MIS_HEADER)
      .send(validQuiz);
    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual([
      expect.objectContaining({ field: "course_id" }),
    ]);
  });

  it("POST /api/quizzes takes the course id from the body instead of 500-ing", async () => {
    const res = await request(app)
      .post(`/api/quizzes`)
      .set("Authorization", `Bearer ${adminToken}`)
      .set(MIS_HEADER)
      .send({ ...validQuiz, course_id: COURSE_ID });
    expect(res.status).toBe(201);
    createdQuizIds.push(res.body.data.id);
    expect(res.body.data.course_id).toBe(COURSE_ID);

    const missing = await request(app)
      .post(`/api/quizzes`)
      .set("Authorization", `Bearer ${adminToken}`)
      .set(MIS_HEADER)
      .send(validQuiz);
    expect(missing.status).toBe(400);
    expect(missing.body.errors[0].field).toBe("course_id");
  });

  it("rejects a student (no QUIZZES_CREATE) with 403", async () => {
    const res = await post(validQuiz, studentToken);
    expect(res.status).toBe(403);
  });
});

describe("PUT /api/quizzes/:id", () => {
  let quizId: number;

  beforeAll(async () => {
    const res = await post(validQuiz);
    quizId = res.body.data.id;
    createdQuizIds.push(quizId);
  });

  const put = (body: any, id: number | string = quizId) =>
    request(app)
      .put(`/api/quizzes/${id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send(body);

  it("applies a partial update without clearing untouched fields", async () => {
    const res = await put({ title: "Renamed", passing_score: 70 });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Quiz updated successfully");
    expect(res.body.data.title).toBe("Renamed");
    expect(Number(res.body.data.passing_score)).toBe(70);
    // untouched
    expect(res.body.data.instructions).toBe(validQuiz.instructions);
    expect(res.body.data.max_attempts).toBe(2);
    expect(res.body.data.is_public).toBe(true);
    expect(res.body.data.start_date).not.toBeNull();
  });

  it("sets, keeps and clears the overall duration", async () => {
    const set = await put({ time_limit: 45 });
    expect(set.status).toBe(200);
    expect(set.body.data.time_limit).toBe(45);

    const untouched = await put({ title: "Still timed" });
    expect(untouched.body.data.time_limit).toBe(45);

    const cleared = await put({ time_limit: null });
    expect(cleared.status).toBe(200);
    expect(cleared.body.data.time_limit ?? null).toBeNull();
  });

  it("clears nullable fields when null is sent explicitly", async () => {
    const res = await put({
      instructions: null,
      max_attempts: null,
      passing_score: null,
      start_date: null,
      end_date: null,
    });
    expect(res.status).toBe(200);
    expect(res.body.data.instructions).toBeNull();
    expect(res.body.data.max_attempts).toBeNull();
    expect(res.body.data.passing_score).toBeNull();
    expect(res.body.data.start_date).toBeNull();
    expect(res.body.data.end_date).toBeNull();
  });

  it("returns 400 (not 500) for the legacy 'archived' status", async () => {
    const res = await put({ status: "archived" });
    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe("status");
  });

  it("validates the end date against the stored start date", async () => {
    await put({ start_date: "2026-10-01T08:00:00Z", end_date: null });
    const res = await put({ end_date: "2026-09-01T08:00:00Z" });
    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe("end_date");
  });

  it("refuses to publish a quiz with no questions, with a field error", async () => {
    const res = await put({ status: "published" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/no questions/);
    expect(res.body.errors[0].field).toBe("status");
  });

  it("publishes once the quiz has a question", async () => {
    const bank = await QuestionBank.create({
      course_id: COURSE_ID,
      question_type: "true_false",
      question_text: "Integration test question",
      question_data: {} as any,
      correct_answer: { answer: true } as any,
      created_by: adminId,
    } as any);
    createdBankIds.push(bank.id);
    await QuizQuestion.create({
      quiz_id: quizId,
      question_id: bank.id,
      points: 1,
      order: 1,
      time_limit_seconds: 60,
    } as any);

    const res = await put({ status: "published" });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("published");
  });

  it("returns 404 for an unknown quiz and 400 for a malformed id", async () => {
    expect((await put({ title: "x" }, 999999999)).status).toBe(404);
    expect((await put({ title: "x" }, "abc")).status).toBe(400);
  });

  it("forbids a student from updating", async () => {
    const res = await request(app)
      .put(`/api/quizzes/${quizId}`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ title: "hack" });
    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/quizzes/:id", () => {
  const del = (id: number) =>
    request(app).delete(`/api/quizzes/${id}`).set("Authorization", `Bearer ${adminToken}`);

  it("soft-deletes: the row is kept as 'deleted' and hidden from every read", async () => {
    const created = await post(validQuiz);
    const id = created.body.data.id;
    createdQuizIds.push(id);
    const res = await del(id);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Quiz deleted successfully");

    expect(await Quiz.findByPk(id)).toBeNull();
    expect(await Quiz.count({ where: { id } })).toBe(0);
    const kept = await Quiz.scope("withDeleted").findByPk(id);
    expect(kept?.status).toBe("deleted");
    expect(kept?.deleted_at).toBeInstanceOf(Date);
    expect(kept?.deleted_by).toBe(adminId);

    const get = await request(app).get(`/api/quizzes/${id}`).set("Authorization", `Bearer ${adminToken}`);
    expect(get.status).toBe(404);
    const list = await request(app)
      .get(`/api/courses/${COURSE_ID}/quizzes`)
      .set("Authorization", `Bearer ${adminToken}`)
      .set(MIS_HEADER);
    expect(list.status).toBe(200);
    expect((list.body.data as any[]).map((q) => q.id)).not.toContain(id);
    expect((await del(id)).status).toBe(404);
  });

  it("deletes a quiz that has submissions and keeps them, out of quiz-joined reads", async () => {
    const created = await post(validQuiz);
    const id = created.body.data.id;
    createdQuizIds.push(id);
    const sub = await QuizSubmission.create({
      quiz_id: id,
      student_id: studentId,
      status: "completed",
      started_at: new Date(),
      completed_at: new Date(),
      total_score: 5,
      max_score: 10,
      percentage: 50,
      time_taken: 60,
      passed: false,
      attempt_number: 1,
    } as any);

    expect((await del(id)).status).toBe(200);
    expect(await QuizSubmission.findByPk(sub.id)).not.toBeNull();
    const joined = await QuizSubmission.findAll({
      where: { id: sub.id },
      include: [{ model: Quiz, as: "quiz", attributes: ["id"] }],
    });
    expect(joined).toHaveLength(0);
  });

  it("returns 404 / 400 for unknown / malformed ids", async () => {
    const notFound = await request(app)
      .delete(`/api/quizzes/999999999`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(notFound.status).toBe(404);
    const bad = await request(app)
      .delete(`/api/quizzes/abc`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(bad.status).toBe(400);
  });
});

import request from "supertest";
import {
  buildTestApp,
  ensureModelsRegistered,
  findSeededUserByRole,
  signTokenFor,
} from "./testApp";
import { sequelize } from "../config/database";
import {
  Quiz,
  QuizQuestion,
  QuestionBank,
  QuizAttempt,
  QuizSubmission,
  ProctoringSettings,
} from "../models";
import { sebConfigKeyHash } from "../utils/lockdown";

/**
 * TM-FIX-5 part B: `lockdown_browser` = Safe Exam Browser required, checked
 * on the server with the SEB Config Key hash (dev DB, real routes).
 */

const COURSE_ID = 4246;
const CONFIG_KEY = "a".repeat(64);
// What nginx forwards in production; the hash covers the URL SEB requested.
const PUBLIC_HOST = "taskmentor-api.amashuri.com";

let app: ReturnType<typeof buildTestApp>;
let studentToken: string;
let adminToken: string;
let adminId: number;
const quizIds: number[] = [];
const bankIds: number[] = [];

beforeAll(async () => {
  await ensureModelsRegistered();
  app = buildTestApp();
  const admin = await findSeededUserByRole("admin");
  const student = await findSeededUserByRole("student");
  adminId = admin.id;
  adminToken = signTokenFor(admin.id);
  studentToken = signTokenFor(student.id);
});

afterAll(async () => {
  if (quizIds.length) {
    await ProctoringSettings.destroy({ where: { quiz_id: quizIds } });
    await QuizAttempt.destroy({ where: { quiz_id: quizIds } });
    await QuizSubmission.destroy({ where: { quiz_id: quizIds } });
    await QuizQuestion.destroy({ where: { quiz_id: quizIds } });
    await Quiz.destroy({ where: { id: quizIds } });
  }
  if (bankIds.length) await QuestionBank.destroy({ where: { id: bankIds } });
  await sequelize.close();
});

async function makeLockdownQuiz(settings: Record<string, any> = {}) {
  const quiz = await Quiz.create({
    title: "Lockdown spec",
    description: "lockdown.integration.spec.ts",
    course_id: COURSE_ID,
    created_by: adminId,
    status: "published",
    type: "Exam",
    show_results_immediately: true,
  } as any);
  quizIds.push(quiz.id);
  const bank = await QuestionBank.create({
    course_id: COURSE_ID,
    question_type: "single_choice",
    question_text: "Pick B",
    question_data: { options: ["A", "B"], correct_option_index: 1 } as any,
    correct_answer: { correct_option_index: 1 } as any,
    created_by: adminId,
  } as any);
  bankIds.push(bank.id);
  const question = await QuizQuestion.create({
    quiz_id: quiz.id,
    question_id: bank.id,
    points: 1,
    order: 1,
  } as any);
  await ProctoringSettings.create({
    quiz_id: quiz.id,
    enabled: true,
    lockdown_browser: true,
    seb_config_key: CONFIG_KEY,
    ...settings,
  } as any);
  return { quiz, question };
}

/** A request as SEB sends it through the reverse proxy. */
function viaSeb(r: request.Test, path: string, key: string | null = CONFIG_KEY) {
  r.set("Authorization", `Bearer ${studentToken}`)
    .set("X-Forwarded-Proto", "https")
    .set("X-Forwarded-Host", PUBLIC_HOST);
  if (key) {
    r.set("X-SafeExamBrowser-ConfigKeyHash", sebConfigKeyHash(`https://${PUBLIC_HOST}${path}`, key));
  }
  return r;
}

const asStudent = (r: request.Test) => r.set("Authorization", `Bearer ${studentToken}`);

describe("lockdown_browser requires Safe Exam Browser", () => {
  it("409 LOCKDOWN_REQUIRED without the SEB header, 201 with a valid one", async () => {
    const { quiz } = await makeLockdownQuiz();
    const plain = await asStudent(request(app).post("/api/quizzes/submissions")).send({
      quiz_id: quiz.id,
    });
    expect(plain.status).toBe(409);
    expect(plain.body.code).toBe("LOCKDOWN_REQUIRED");
    expect(await QuizSubmission.count({ where: { quiz_id: quiz.id } })).toBe(0);

    const seb = await viaSeb(
      request(app).post("/api/quizzes/submissions"),
      "/api/quizzes/submissions",
    ).send({ quiz_id: quiz.id });
    expect(seb.status).toBe(201);
  });

  it("a hash made with another configuration (or for another URL) is refused", async () => {
    const { quiz } = await makeLockdownQuiz();
    const wrongKey = await viaSeb(
      request(app).post("/api/quizzes/submissions"),
      "/api/quizzes/submissions",
      "b".repeat(64),
    ).send({ quiz_id: quiz.id });
    expect(wrongKey.status).toBe(409);

    const wrongUrl = await viaSeb(
      request(app).post("/api/quizzes/submissions"),
      "/api/quizzes/other",
    ).send({ quiz_id: quiz.id });
    expect(wrongUrl.status).toBe(409);
  });

  it("answers for an attempt are refused when they don't come from SEB", async () => {
    const { quiz, question } = await makeLockdownQuiz();
    const sub = (
      await viaSeb(request(app).post("/api/quizzes/submissions"), "/api/quizzes/submissions").send({
        quiz_id: quiz.id,
      })
    ).body.data;
    const path = `/api/quizzes/attempts/${sub.id}/questions/${question.id}/answer`;

    const plain = await asStudent(request(app).post(path)).send({
      answer_data: { selected_option_index: 1 },
    });
    expect(plain.status).toBe(409);
    expect(plain.body.code).toBe("LOCKDOWN_REQUIRED");

    const seb = await viaSeb(request(app).post(path), path).send({
      answer_data: { selected_option_index: 1 },
    });
    expect(seb.status).toBe(201);
  });

  it("with no Config Key set, the quiz can't be started (misconfigured, not open)", async () => {
    const { quiz } = await makeLockdownQuiz({ seb_config_key: null });
    const res = await viaSeb(
      request(app).post("/api/quizzes/submissions"),
      "/api/quizzes/submissions",
    ).send({ quiz_id: quiz.id });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/configuration key hasn't been set/);
  });

  it("only applies while proctoring is enabled", async () => {
    const { quiz } = await makeLockdownQuiz({ enabled: false });
    const res = await asStudent(request(app).post("/api/quizzes/submissions")).send({
      quiz_id: quiz.id,
    });
    expect(res.status).toBe(201);
  });

  it("students never see the Config Key; managers do", async () => {
    const { quiz } = await makeLockdownQuiz();
    const path = `/api/proctoring/quizzes/${quiz.id}/proctoring-settings`;
    const student = await asStudent(request(app).get(path));
    expect(student.status).toBe(200);
    expect(student.body.data.seb_config_key).toBeUndefined();
    expect(student.body.data.seb_config_key_set).toBe(true);
    const admin = await request(app).get(path).set("Authorization", `Bearer ${adminToken}`);
    expect(admin.body.data.seb_config_key).toBe(CONFIG_KEY);
  });

  it("rejects a malformed Config Key on save", async () => {
    const { quiz } = await makeLockdownQuiz();
    const res = await request(app)
      .put(`/api/proctoring/quizzes/${quiz.id}/proctoring-settings`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ seb_config_key: "not-a-key" });
    expect(res.status).toBe(400);
  });
});

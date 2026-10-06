import request from "supertest";
import {
  buildTestApp,
  ensureModelsRegistered,
  findSeededUserByRole,
  signTokenFor,
} from "./testApp";
import { sequelize } from "../config/database";
import { Judge0Service } from "../services/Judge0Service";
import { codeRunLimiter } from "../middleware/rateLimiter.middleware";
import {
  Quiz,
  QuizQuestion,
  QuestionBank,
  QuizAttempt,
  QuizSubmission,
} from "../models";

/**
 * "Run" / "Run tests" for code questions against the dev DB. The judge is
 * stubbed: nothing here reaches Judge0.
 */

let app: ReturnType<typeof buildTestApp>;
let adminToken: string;
let adminId: number;
let studentToken: string;
let studentId: number;
const quizIds: number[] = [];
const bankIds: number[] = [];
const COURSE_ID = 4245;

const judgeOk = (stdout: string) => ({
  stdout,
  stderr: null,
  compile_output: null,
  message: null,
  time: "0.01",
  memory: 100,
  token: "t",
  status: { id: 3, description: "Accepted" },
});

beforeAll(async () => {
  await ensureModelsRegistered();
  app = buildTestApp();
  const admin = await findSeededUserByRole("admin");
  const student = await findSeededUserByRole("student");
  adminId = admin.id;
  adminToken = signTokenFor(admin.id);
  studentId = student.id;
  studentToken = signTokenFor(student.id);
});

beforeEach(() => {
  codeRunLimiter.resetKey(`code-run:${studentId}`);
  codeRunLimiter.resetKey(`code-run:${adminId}`);
});

afterEach(() => jest.restoreAllMocks());

afterAll(async () => {
  if (quizIds.length) {
    await QuizAttempt.destroy({ where: { quiz_id: quizIds } });
    await QuizSubmission.destroy({ where: { quiz_id: quizIds } });
    await QuizQuestion.destroy({ where: { quiz_id: quizIds } });
    await Quiz.destroy({ where: { id: quizIds } });
  }
  if (bankIds.length) await QuestionBank.destroy({ where: { id: bankIds } });
  await sequelize.close();
});

const asStudent = (r: request.Test) => r.set("Authorization", `Bearer ${studentToken}`);

/** A published quiz with one python question: one visible and one hidden test. */
async function makeCodingQuiz() {
  const quiz = await Quiz.create({
    title: "Code run spec",
    description: "codeRun.integration.spec.ts",
    course_id: COURSE_ID,
    created_by: adminId,
    status: "published",
    type: "Quiz",
    show_results_immediately: true,
    enable_automatic_grading: true,
    require_manual_grading: false,
  } as any);
  quizIds.push(quiz.id);
  const bank = await QuestionBank.create({
    course_id: COURSE_ID,
    question_type: "coding",
    question_text: "Add two numbers",
    question_data: {
      language: "python",
      test_cases: [
        { id: "v1", input: "1 2", expected_output: "3", is_hidden: false, points: 1 },
        { id: "h1", input: "HIDDEN-IN", expected_output: "HIDDEN-OUT", is_hidden: true, points: 1 },
      ],
    } as any,
    created_by: adminId,
  } as any);
  bankIds.push(bank.id);
  const question = await QuizQuestion.create({
    quiz_id: quiz.id,
    question_id: bank.id,
    points: 2,
    order: 1,
  } as any);
  return { quiz, question };
}

const startAttempt = (quizId: number) =>
  asStudent(request(app).post("/api/quizzes/submissions")).send({ quiz_id: quizId });

const runAsStudent = (questionId: number, body: Record<string, any>) =>
  asStudent(request(app).post(`/api/quizzes/questions/${questionId}/run-code`)).send(body);

const asAdmin = (r: request.Test) => r.set("Authorization", `Bearer ${adminToken}`);

describe("languages (TM-FIX-4)", () => {
  it("GET /quizzes/code-languages lists judge runtimes and web preview languages", async () => {
    const res = await asAdmin(request(app).get("/api/quizzes/code-languages"));
    expect(res.status).toBe(200);
    const keys = res.body.data.judge.map((l: any) => l.key);
    expect(keys).toEqual(expect.arrayContaining(["python", "javascript", "java", "cpp"]));
    expect(res.body.data.web_preview).toContain("html");
  });

  it("refuses to run an unsupported language with 400 UNSUPPORTED_LANGUAGE", async () => {
    const run = jest.spyOn(Judge0Service, "runSingle").mockResolvedValue(judgeOk("1") as any);
    const res = await asAdmin(request(app).post("/api/quizzes/preview-run")).send({
      code: "SELECT 1;",
      language: "sql",
      test_cases: [{ id: "t", input: "", expected_output: "1" }],
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("UNSUPPORTED_LANGUAGE");
    expect(run).not.toHaveBeenCalled();
  });
});

describe("server-owned test cases (TM-FIX-3)", () => {
  const CODE = { code: "print(sum(map(int, input().split())))", language: "python" };

  it("a student's own test_cases are ignored: the question's visible tests run", async () => {
    const run = jest.spyOn(Judge0Service, "runSingle").mockResolvedValue(judgeOk("3") as any);
    const { quiz, question } = await makeCodingQuiz();
    await startAttempt(quiz.id);

    const res = await runAsStudent(question.id, {
      ...CODE,
      test_cases: [{ id: "x", input: "STUDENT-PROBE", expected_output: "?", is_hidden: false }],
    });
    expect(res.status).toBe(200);
    expect(run).toHaveBeenCalledTimes(1);
    expect(run.mock.calls[0][2]).toBe("1 2");
    expect(JSON.stringify(run.mock.calls)).not.toContain("STUDENT-PROBE");
    expect(res.body.data.results).toHaveLength(1);
    expect(res.body.data.results[0]).toMatchObject({ testCaseId: "v1", passed: true });
    expect(JSON.stringify(res.body)).not.toContain("HIDDEN-");
  });

  it("run_tests never creates or changes a graded answer", async () => {
    jest.spyOn(Judge0Service, "runSingle").mockResolvedValue(judgeOk("3") as any);
    const { quiz, question } = await makeCodingQuiz();
    const sub = (await startAttempt(quiz.id)).body.data;
    const res = await runAsStudent(question.id, { ...CODE, run_tests: true });
    expect(res.status).toBe(200);
    expect(await QuizAttempt.count({ where: { submission_id: sub.id } })).toBe(0);
  });

  it("403 for a student without an attempt in progress on the question's quiz", async () => {
    const run = jest.spyOn(Judge0Service, "runSingle").mockResolvedValue(judgeOk("3") as any);
    const { question } = await makeCodingQuiz();
    const res = await runAsStudent(question.id, { ...CODE, run_tests: true });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("NOT_ATTEMPTING");
    expect(run).not.toHaveBeenCalled();
  });

  it("students can't use the author preview run (their own test data)", async () => {
    const res = await asStudent(request(app).post("/api/quizzes/preview-run")).send({
      ...CODE,
      test_cases: [{ id: "x", input: "probe", expected_output: "?" }],
    });
    expect(res.status).toBe(403);
  });

  it("authors run every test of the question, hidden ones included", async () => {
    jest.spyOn(Judge0Service, "runSingle").mockResolvedValue(judgeOk("3") as any);
    const { question } = await makeCodingQuiz();
    const res = await asAdmin(
      request(app).post(`/api/quizzes/questions/${question.id}/run-code`),
    ).send({ ...CODE, run_tests: true });
    expect(res.status).toBe(200);
    expect(res.body.data.results).toHaveLength(2);
    expect(res.body.data.results[1]).toMatchObject({ is_hidden: true, input: "HIDDEN-IN" });
  });

  it("stdin over 64 KB is refused with 413", async () => {
    const run = jest.spyOn(Judge0Service, "runSingle").mockResolvedValue(judgeOk("") as any);
    const { quiz, question } = await makeCodingQuiz();
    await startAttempt(quiz.id);
    const res = await runAsStudent(question.id, { ...CODE, stdin: "x".repeat(64 * 1024 + 1) });
    expect(res.status).toBe(413);
    expect(res.body.code).toBe("INPUT_TOO_LARGE");
    expect(run).not.toHaveBeenCalled();
  });

  it("a language the question doesn't allow is refused", async () => {
    const { quiz, question } = await makeCodingQuiz();
    await startAttempt(quiz.id);
    const res = await runAsStudent(question.id, { code: "console.log(1)", language: "javascript" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("LANGUAGE_NOT_ALLOWED");
  });

  it("rate limit: the 11th run in a minute gets 429", async () => {
    jest.spyOn(Judge0Service, "runSingle").mockResolvedValue(judgeOk("3") as any);
    const { quiz, question } = await makeCodingQuiz();
    await startAttempt(quiz.id);
    for (let i = 0; i < 10; i++) {
      expect((await runAsStudent(question.id, { ...CODE, stdin: "1 2" })).status).toBe(200);
    }
    const res = await runAsStudent(question.id, { ...CODE, stdin: "1 2" });
    expect(res.status).toBe(429);
    expect(res.body.code).toBe("RATE_LIMITED");
  });
});

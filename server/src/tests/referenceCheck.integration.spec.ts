import request from "supertest";
import { buildTestApp, ensureModelsRegistered, findSeededUserByRole, signTokenFor } from "./testApp";
import { sequelize } from "../config/database";
import { Judge0Service, JudgeUnavailableError } from "../services/Judge0Service";
import { Quiz, QuizQuestion, QuestionBank } from "../models";

/**
 * Publishing a quiz checks every coding question's reference solution
 * against its own tests (CODE_RUNNER_PLAN.md §7.3). The judge is stubbed.
 */

let app: ReturnType<typeof buildTestApp>;
let adminToken: string;
let adminId: number;
const quizIds: number[] = [];
const bankIds: number[] = [];
const COURSE_ID = 4246;
const ENV = { ...process.env };

const judge = (stdout: string) => ({ stdout, stderr: null, compile_output: null, message: null, time: "0.01", memory: 100, token: "t", status: { id: 3, description: "Accepted" } });

beforeAll(async () => {
  await ensureModelsRegistered();
  app = buildTestApp();
  const admin = await findSeededUserByRole("admin");
  adminId = admin.id;
  adminToken = signTokenFor(admin.id);
  process.env.CODERUNNER_ENGINE = "judge0";
  process.env.JUDGE0_URL = process.env.JUDGE0_URL || "http://127.0.0.1:9";
});
afterEach(() => jest.restoreAllMocks());
afterAll(async () => {
  process.env = ENV;
  if (quizIds.length) {
    await QuizQuestion.destroy({ where: { quiz_id: quizIds } });
    await Quiz.destroy({ where: { id: quizIds } });
  }
  if (bankIds.length) await QuestionBank.destroy({ where: { id: bankIds } });
  await sequelize.close();
});

async function draftQuiz(questionData: Record<string, unknown>) {
  const quiz = await Quiz.create({ title: "Reference check spec", description: "referenceCheck.integration.spec.ts", course_id: COURSE_ID, created_by: adminId, status: "draft", type: "Quiz" } as any);
  quizIds.push(quiz.id);
  const bank = await QuestionBank.create({ course_id: COURSE_ID, question_type: "coding", question_text: "<p>Add two numbers</p>", question_data: questionData as any, created_by: adminId } as any);
  bankIds.push(bank.id);
  await QuizQuestion.create({ quiz_id: quiz.id, question_id: bank.id, points: 2, order: 1 } as any);
  return quiz;
}

const publish = (id: number) => request(app).put(`/api/quizzes/${id}`).set("Authorization", `Bearer ${adminToken}`).send({ status: "published" });
const question = (extra: Record<string, unknown> = {}) => ({
  language: "python",
  reference_solution: "print(sum(map(int, input().split())))",
  test_cases: [
    { id: "t1", input: "1 2", expected_output: "3", is_hidden: false, points: 1 },
    { id: "t2", input: "5 5", expected_output: "11", is_hidden: true, points: 1 },
  ],
  ...extra,
});

describe("publishing checks reference solutions", () => {
  it("blocks a quiz whose reference solution fails one of its tests, and says which", async () => {
    const quiz = await draftQuiz(question());
    jest.spyOn(Judge0Service, "runSingle").mockImplementation(async (_l: any, _c: any, stdin: any) => judge(String(stdin) === "1 2" ? "3" : "10") as any);
    const res = await publish(quiz.id);
    expect(res.status).toBe(422);
    expect(res.body.code).toBe("REFERENCE_SOLUTION_FAILS");
    expect(res.body.errors[0].message).toMatch(/Question 1 \(Add two numbers\): 1 test fail \(t2\)/);
    expect(res.body.data.failures[0].failed_tests[0]).toMatchObject({ id: "t2", expected: "11", got: "10" });
    expect((await Quiz.findByPk(quiz.id))!.status).toBe("draft");
  });

  it("publishes when the reference solution passes every test", async () => {
    const quiz = await draftQuiz(question({ test_cases: [{ id: "t1", input: "1 2", expected_output: "3", is_hidden: false, points: 1 }] }));
    jest.spyOn(Judge0Service, "runSingle").mockResolvedValue(judge("3") as any);
    const res = await publish(quiz.id);
    expect(res.status).toBe(200);
    expect((await Quiz.findByPk(quiz.id))!.status).toBe("published");
  });

  it("doesn't check questions without a reference solution", async () => {
    const quiz = await draftQuiz(question({ reference_solution: "" }));
    const run = jest.spyOn(Judge0Service, "runSingle");
    expect((await publish(quiz.id)).status).toBe(200);
    expect(run).not.toHaveBeenCalled();
  });

  it("never blocks publishing because the runner is down", async () => {
    const quiz = await draftQuiz(question());
    jest.spyOn(Judge0Service, "runSingle").mockRejectedValue(new JudgeUnavailableError("down"));
    expect((await publish(quiz.id)).status).toBe(200);
  });
});

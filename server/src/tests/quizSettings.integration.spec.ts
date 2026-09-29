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
} from "../models";

/**
 * Each quiz setting, as the student experiences it (dev DB, real routes):
 * answers never leak while taking, drafts/windows/attempt limits are enforced,
 * randomized order is stable per attempt, and the result settings decide
 * exactly what comes back after submitting.
 */

const COURSE_ID = 4244;

let app: ReturnType<typeof buildTestApp>;
let studentToken: string;
let adminToken: string;
let adminId: number;
const quizIds: number[] = [];
const bankIds: number[] = [];

async function makeQuiz(overrides: Record<string, any> = {}, questionCount = 3) {
  const quiz = await Quiz.create({
    title: "Settings spec",
    description: "quizSettings.integration.spec.ts",
    course_id: COURSE_ID,
    created_by: adminId,
    status: "published",
    type: "Quiz",
    show_results_immediately: true,
    show_correct_answers: false,
    enable_automatic_grading: true,
    require_manual_grading: false,
    ...overrides,
  } as any);
  quizIds.push(quiz.id);
  const questions: QuizQuestion[] = [];
  for (let i = 0; i < questionCount; i++) {
    const bank = await QuestionBank.create({
      course_id: COURSE_ID,
      question_type: "single_choice",
      question_text: `Settings Q${i + 1}`,
      question_data: { options: ["wrong", "right"], correct_option_index: 1 } as any,
      correct_answer: { correct_option_index: 1 } as any,
      explanation: "Because B is right",
      created_by: adminId,
      time_limit_seconds: 60,
    } as any);
    bankIds.push(bank.id);
    questions.push(
      await QuizQuestion.create({
        quiz_id: quiz.id,
        question_id: bank.id,
        points: 1,
        order: i + 1,
        time_limit_seconds: 60,
      } as any),
    );
  }
  return { quiz, questions };
}

const asStudent = (r: request.Test) => r.set("Authorization", `Bearer ${studentToken}`);
const getQuiz = (id: number) => asStudent(request(app).get(`/api/quizzes/${id}`));
const start = (id: number) =>
  asStudent(request(app).post(`/api/quizzes/submissions`)).send({ quiz_id: id });
const save = (sub: number, q: number, answer: any) =>
  asStudent(request(app).post(`/api/quizzes/attempts/${sub}/questions/${q}/answer`)).send({
    answer_data: answer,
    time_taken: 3,
  });
const submit = (id: number, answers: any[]) =>
  asStudent(request(app).post(`/api/quizzes/${id}/submit`)).send({ answers, time_taken: 30 });
const results = (id: number) => asStudent(request(app).get(`/api/quizzes/${id}/results`));

const RIGHT = { selected_option_index: 1 };
const WRONG = { selected_option_index: 0 };

async function takeAndSubmit(quizId: number, qs: QuizQuestion[], answers: any[]) {
  const sub = (await start(quizId)).body.data;
  const res = await submit(
    quizId,
    qs.map((q, i) => ({ question_id: q.id, answer: answers[i] })),
  );
  return { sub, res };
}

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
    await QuizAttempt.destroy({ where: { quiz_id: quizIds } });
    await QuizSubmission.destroy({ where: { quiz_id: quizIds } });
    await QuizQuestion.destroy({ where: { quiz_id: quizIds } });
    await Quiz.destroy({ where: { id: quizIds } });
  }
  if (bankIds.length) await QuestionBank.destroy({ where: { id: bankIds } });
  await sequelize.close();
});

describe("taking view (GET /quizzes/:id as a student)", () => {
  it("never includes correct answers or explanations", async () => {
    const { quiz } = await makeQuiz();
    const res = await getQuiz(quiz.id);
    expect(res.status).toBe(200);
    const body = JSON.stringify(res.body.data.questions);
    expect(body).not.toContain("correct_option_index");
    expect(body).not.toContain("Because B is right");
    expect(res.body.data.questions[0].questionBank.question_data.options).toEqual([
      "wrong",
      "right",
    ]);
    expect(res.body.data.questions[0].questionBank.correct_answer).toBeUndefined();
    expect(res.body.data.question_count).toBe(3);
    expect(res.body.data.total_points).toBe(3);
  });

  it("hides drafts from students", async () => {
    const { quiz } = await makeQuiz({ status: "draft", is_public: true });
    expect((await getQuiz(quiz.id)).status).toBe(403);
  });

  it("keeps the authored order, or a stable random order per attempt when randomize_questions is on", async () => {
    const plain = await makeQuiz({}, 6);
    const plainIds = (await getQuiz(plain.quiz.id)).body.data.questions.map((q: any) => q.id);
    expect(plainIds).toEqual(plain.questions.map((q) => q.id));

    const rnd = await makeQuiz({ randomize_questions: true }, 6);
    const a = (await getQuiz(rnd.quiz.id)).body.data.questions.map((q: any) => q.id);
    const b = (await getQuiz(rnd.quiz.id)).body.data.questions.map((q: any) => q.id);
    expect(a).toEqual(b); // stable across reloads
    expect([...a].sort()).toEqual(rnd.questions.map((q) => q.id).sort());
  });

  it("reports the availability window and refuses to start outside it", async () => {
    const future = new Date(Date.now() + 86_400_000);
    const { quiz } = await makeQuiz({ start_date: future });
    const view = (await getQuiz(quiz.id)).body.data;
    expect(view.student_state.availability.state).toBe("not_open");
    expect(view.student_state.can_start).toBe(false);
    expect(view.student_state.blocked_reason).toMatch(/opens/);
    expect(view.questions).toEqual([]);

    const res = await start(quiz.id);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("QUIZ_NOT_AVAILABLE");
  });

  it("does not reveal correctness when an answer is saved mid-quiz", async () => {
    const { quiz, questions } = await makeQuiz();
    const sub = (await start(quiz.id)).body.data;
    const res = await save(sub.id, questions[0].id, RIGHT);
    expect(res.status).toBe(201);
    expect(res.body.data.grading_result).toEqual({
      is_correct: null,
      points_earned: null,
      feedback: "Answer saved",
    });
  });
});

describe("max_attempts", () => {
  it("1 attempt: a second start is refused and the quiz view becomes the results", async () => {
    const { quiz, questions } = await makeQuiz({ max_attempts: 1 });
    await takeAndSubmit(quiz.id, questions, [RIGHT, RIGHT, WRONG]);

    const again = await start(quiz.id);
    expect(again.status).toBe(409);
    expect(again.body.code).toBe("MAX_ATTEMPTS_REACHED");

    const view = (await getQuiz(quiz.id)).body.data;
    expect(view.quiz_completed).toBe(true);
    expect(view.student_state.attempts).toMatchObject({ attempts_used: 1, attempts_left: 0 });
  });

  it("2 attempts: the student can take it again, with a new attempt number", async () => {
    const { quiz, questions } = await makeQuiz({ max_attempts: 2 });
    await takeAndSubmit(quiz.id, questions, [WRONG, WRONG, WRONG]);

    const view = (await getQuiz(quiz.id)).body.data;
    expect(view.quiz_completed).toBeUndefined();
    expect(view.student_state.attempts).toMatchObject({
      attempts_used: 1,
      attempts_left: 1,
      current_attempt_number: 2,
      can_start_new_attempt: true,
    });
    const second = await start(quiz.id);
    expect(second.status).toBe(201);
    expect(second.body.data.attempt_number).toBe(2);
  });
});

describe("result settings", () => {
  it("defaults: results and score right away, correct answers hidden", async () => {
    const { quiz, questions } = await makeQuiz();
    const { res } = await takeAndSubmit(quiz.id, questions, [RIGHT, RIGHT, WRONG]);
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ results_available: true, final_score: 2 });

    const r = (await results(quiz.id)).body.data;
    expect(r.results_available).toBe(true);
    expect(r.final_score).toBe(2);
    expect(r.results.every((x: any) => x.correct_answer === null && x.explanation === null)).toBe(true);
    expect(JSON.stringify(r.results)).not.toContain("correct_option_index");
    expect(r.results.map((x: any) => x.is_correct).sort()).toEqual([false, true, true]);
    expect(r.time_taken).toBe(30); // seconds, as the client sent — not ms
  });

  it("show_correct_answers: correct answers and explanations are included", async () => {
    const { quiz, questions } = await makeQuiz({ show_correct_answers: true });
    await takeAndSubmit(quiz.id, questions, [RIGHT, WRONG, WRONG]);
    const r = (await results(quiz.id)).body.data;
    expect(r.results[0].explanation).toBe("Because B is right");
    expect(r.results[0].question_data.correct_option_index).toBe(1);
  });

  it("show_results_immediately off: nothing (not even the score) until graded", async () => {
    const { quiz, questions } = await makeQuiz({ show_results_immediately: false });
    const { res } = await takeAndSubmit(quiz.id, questions, [RIGHT, RIGHT, RIGHT]);
    expect(res.body.data.final_score).toBeUndefined();

    const r = (await results(quiz.id)).body.data;
    expect(r.results_available).toBe(false);
    expect(r.final_score).toBeUndefined();
    expect(r.percentage).toBeUndefined();
    expect(r.message).toMatch(/after your instructor reviews/);
  });

  it("require_manual_grading: answers visible, score hidden until the instructor grades, then shown", async () => {
    const { quiz, questions } = await makeQuiz({ require_manual_grading: true });
    const { sub } = await takeAndSubmit(quiz.id, questions, [RIGHT, WRONG, WRONG]);

    let r = (await results(quiz.id)).body.data;
    expect(r.results_available).toBe(true);
    expect(r.final_score).toBeNull();
    expect(r.results.every((x: any) => x.points_earned === null)).toBe(true);
    // The automatic grade is still computed as the instructor's starting point.
    const stored = await QuizSubmission.findByPk(sub.id);
    expect(Number(stored?.total_score)).toBe(1);
    expect(stored?.grade_status).toBe("pending");

    const grade = await request(app)
      .post(`/api/quizzes/submissions/${sub.id}/grade`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ grades: { [questions[1].id]: 1 }, feedback: "Good reasoning" });
    expect(grade.status).toBe(200);

    r = (await results(quiz.id)).body.data;
    expect(r.final_score).toBe(2);
    expect(r.feedback).toBe("Good reasoning");
  });

  it("enable_automatic_grading off ('show grades immediately' unchecked): graded but hidden", async () => {
    const { quiz, questions } = await makeQuiz({ enable_automatic_grading: false });
    const { sub } = await takeAndSubmit(quiz.id, questions, [RIGHT, RIGHT, RIGHT]);
    const r = (await results(quiz.id)).body.data;
    expect(r.final_score).toBeNull();
    const stored = await QuizSubmission.findByPk(sub.id);
    expect(Number(stored?.total_score)).toBe(3);
  });

  it("passing_score 0 means everyone passes (not the 60% default)", async () => {
    const { quiz, questions } = await makeQuiz({ passing_score: 0 });
    await takeAndSubmit(quiz.id, questions, [WRONG, WRONG, WRONG]);
    const r = (await results(quiz.id)).body.data;
    expect(r.passed).toBe(true);
    expect(r.passing_score).toBe(0);
  });
});


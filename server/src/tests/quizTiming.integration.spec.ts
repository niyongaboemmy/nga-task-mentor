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
 * Overall quiz duration (quizzes.time_limit) end to end, against the dev DB:
 * the server owns the attempt deadline, answers saved before it are never
 * lost, and nothing can be changed after it.
 */

const COURSE_ID = 4243;

let app: ReturnType<typeof buildTestApp>;
let studentToken: string;
let adminId: number;
const quizIds: number[] = [];
const bankIds: number[] = [];

async function makeQuiz(timeLimit: number | null, questionCount = 2) {
  const quiz = await Quiz.create({
    title: `Timing spec ${timeLimit ?? "untimed"}`,
    description: "quizTiming.integration.spec.ts",
    course_id: COURSE_ID,
    created_by: adminId,
    status: "published",
    type: "Quiz",
    time_limit: timeLimit ?? undefined,
    enable_automatic_grading: true,
    require_manual_grading: false,
  } as any);
  quizIds.push(quiz.id);

  const questions: QuizQuestion[] = [];
  for (let i = 0; i < questionCount; i++) {
    const bank = await QuestionBank.create({
      course_id: COURSE_ID,
      question_type: "true_false",
      question_text: `Timing spec Q${i + 1}`,
      question_data: {} as any,
      correct_answer: { answer: true } as any,
      created_by: adminId,
      time_limit_seconds: 10,
    } as any);
    bankIds.push(bank.id);
    questions.push(
      await QuizQuestion.create({
        quiz_id: quiz.id,
        question_id: bank.id,
        points: 1,
        order: i + 1,
        time_limit_seconds: 10,
      } as any),
    );
  }
  return { quiz, questions };
}

const auth = (r: request.Test) => r.set("Authorization", `Bearer ${studentToken}`);

const start = (quizId: number) =>
  auth(request(app).post(`/api/quizzes/submissions`)).send({
    quiz_id: quizId,
    status: "in_progress",
    // A client-supplied start must not move the deadline.
    started_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  });

const saveAnswer = (submissionId: number, questionId: number, answer: any, timeTaken = 1) =>
  auth(
    request(app).post(
      `/api/quizzes/attempts/${submissionId}/questions/${questionId}/answer`,
    ),
  ).send({ answer_data: answer, time_taken: timeTaken });

const submit = (quizId: number, answers: any[]) =>
  auth(request(app).post(`/api/quizzes/${quizId}/submit`)).send({
    quiz_id: quizId,
    answers,
    time_taken: 10,
  });

async function expire(submissionId: number, secondsAgo: number) {
  await QuizSubmission.update(
    { end_time: new Date(Date.now() - secondsAgo * 1000) },
    { where: { id: submissionId } },
  );
}

beforeAll(async () => {
  await ensureModelsRegistered();
  app = buildTestApp();
  const admin = await findSeededUserByRole("admin");
  const student = await findSeededUserByRole("student");
  adminId = admin.id;
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

describe("timed quiz attempt", () => {
  it("fixes the deadline on the server from time_limit, ignoring the client's started_at", async () => {
    const { quiz } = await makeQuiz(20);
    const before = Date.now();
    const res = await start(quiz.id);
    expect(res.status).toBe(201);

    const { end_time, time_limit, time_remaining_seconds } = res.body.data;
    expect(time_limit).toBe(20);
    const endMs = new Date(end_time).getTime();
    expect(endMs).toBeGreaterThanOrEqual(before + 20 * 60_000 - 2000);
    expect(endMs).toBeLessThanOrEqual(Date.now() + 20 * 60_000 + 2000);
    expect(time_remaining_seconds).toBeGreaterThan(20 * 60 - 5);
    expect(time_remaining_seconds).toBeLessThanOrEqual(20 * 60);
  });

  it("does not time out a question on its own duration when an overall duration is set", async () => {
    const { quiz, questions } = await makeQuiz(20);
    const sub = (await start(quiz.id)).body.data;
    // 120s on a question whose own limit is 10s.
    const res = await saveAnswer(sub.id, questions[0].id, { answer: true }, 120);
    expect(res.status).toBe(201);
    const attempt = await QuizAttempt.findOne({
      where: { submission_id: sub.id, question_id: questions[0].id },
    });
    expect(attempt?.status).toBe("completed");
  });

  it("lets the student change an answer (go back) and resume with saved answers + remaining time", async () => {
    const { quiz, questions } = await makeQuiz(15);
    const sub = (await start(quiz.id)).body.data;

    await saveAnswer(sub.id, questions[0].id, { answer: false });
    await saveAnswer(sub.id, questions[1].id, { answer: true });
    // Revisit Q1 and change it.
    expect((await saveAnswer(sub.id, questions[0].id, { answer: true })).status).toBe(201);
    expect(await QuizAttempt.count({ where: { submission_id: sub.id } })).toBe(2);

    // Resuming (another tab / device) returns the same attempt.
    const again = await start(quiz.id);
    expect(again.status).toBe(200);
    expect(again.body.data.id).toBe(sub.id);
    expect(again.body.data.time_remaining_seconds).toBeGreaterThan(0);

    const list = await auth(
      request(app).get(`/api/quizzes/submissions?quiz_id=${quiz.id}&status=in_progress`),
    );
    expect(list.status).toBe(200);
    const resumed = list.body.data[0];
    expect(resumed.time_remaining_seconds).toBeGreaterThan(0);
    const byQ = Object.fromEntries(
      resumed.answers.map((a: any) => [a.question_id, a.answer_data]),
    );
    expect(byQ[questions[0].id]).toEqual({ answer: true });
    expect(byQ[questions[1].id]).toEqual({ answer: true });
  });

  it("grades the client's answers when the auto-submit lands within the grace period", async () => {
    const { quiz, questions } = await makeQuiz(10);
    const sub = (await start(quiz.id)).body.data;
    await expire(sub.id, 5); // deadline passed 5s ago, inside the 30s grace

    const res = await submit(quiz.id, [
      { question_id: questions[0].id, answer: { answer: true } },
      { question_id: questions[1].id, answer: { answer: false } },
    ]);
    expect(res.status).toBe(201);
    expect(res.body.data.answers).toHaveLength(2);
    const fresh = await QuizSubmission.findByPk(sub.id);
    expect(fresh?.status).toBe("completed");
  });

  it("after the grace period, submits with the answers saved before the deadline instead of discarding the attempt", async () => {
    const { quiz, questions } = await makeQuiz(10);
    const sub = (await start(quiz.id)).body.data;
    await saveAnswer(sub.id, questions[0].id, { answer: true });
    await expire(sub.id, 120);

    // Changing answers is refused once time is up...
    const late = await saveAnswer(sub.id, questions[1].id, { answer: true });
    expect(late.status).toBe(409);
    expect(late.body.code).toBe("ATTEMPT_TIME_EXPIRED");

    // ...and the final submit closes the attempt with what was saved.
    const res = await submit(quiz.id, [
      { question_id: questions[0].id, answer: { answer: false } },
      { question_id: questions[1].id, answer: { answer: true } },
    ]);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      submission_id: sub.id,
      answered: 1,
      max_score: 2,
      timed_out: true,
    });

    const fresh = await QuizSubmission.findByPk(sub.id);
    expect(fresh?.status).toBe("completed");
    const attempts = await QuizAttempt.findAll({ where: { submission_id: sub.id } });
    expect(attempts).toHaveLength(1);
    expect(attempts[0].submitted_answer).toEqual({ answer: true });
    expect(Number(fresh?.total_score)).toBe(Number(attempts[0].points_earned));
  });

  it("finalizes an expired attempt found on resume and says so (409 ATTEMPT_TIME_EXPIRED)", async () => {
    const { quiz, questions } = await makeQuiz(10);
    const sub = (await start(quiz.id)).body.data;
    await saveAnswer(sub.id, questions[0].id, { answer: true });
    await expire(sub.id, 600);

    const res = await start(quiz.id);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("ATTEMPT_TIME_EXPIRED");
    expect(res.body.data.submission_id).toBe(sub.id);
    expect((await QuizSubmission.findByPk(sub.id))?.status).toBe("completed");
    expect(await QuizAttempt.count({ where: { submission_id: sub.id } })).toBe(1);
  });
});

describe("untimed quiz attempt (per-question durations)", () => {
  it("has no deadline and still enforces each question's own duration", async () => {
    const { quiz, questions } = await makeQuiz(null);
    const res = await start(quiz.id);
    expect(res.status).toBe(201);
    expect(res.body.data.end_time ?? null).toBeNull();
    expect(res.body.data.time_remaining_seconds).toBeNull();

    const slow = await saveAnswer(res.body.data.id, questions[0].id, { answer: true }, 60);
    expect(slow.status).toBe(201);
    expect(slow.body.data.grading_result.feedback).toBe("Question timed out");
  });
});

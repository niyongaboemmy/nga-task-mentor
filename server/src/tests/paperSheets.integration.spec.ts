// Paper answer sheets (services/paperSheets.ts): spec without answers, scoring
// through the real grader, rescans update, stale sheets refused. Real dev DB.
//   cd server && TZ=UTC npx jest --runInBand src/tests/paperSheets.integration.spec.ts
import request from "supertest";
import { buildTestApp, ensureModelsRegistered, findSeededUserByRole, signTokenFor } from "./testApp";
import { sequelize } from "../config/database";
import { Quiz, QuizQuestion, QuestionBank, QuizSubmission, QuizAttempt } from "../models";
import { buildSpec, toAnswer, PAPER_FEEDBACK } from "../services/paperSheets";

let app: ReturnType<typeof buildTestApp>;
let teacher: string;
let studentToken: string;
let studentId: number;
let quizId: number;
const qq: number[] = [];
const bankIds: number[] = [];

beforeAll(async () => {
  await ensureModelsRegistered();
  app = buildTestApp();
  const instructor = await findSeededUserByRole("instructor");
  const student = await findSeededUserByRole("student");
  teacher = signTokenFor(instructor.id);
  studentToken = signTokenFor(student.id);
  studentId = student.id;
  const quiz = await Quiz.create({
    title: "Paper sheet spec", description: "paperSheets.integration.spec.ts", course_id: 990477, created_by: instructor.id,
    status: "published", type: "Quiz", enable_automatic_grading: true, require_manual_grading: false, passing_score: 50,
  } as any);
  quizId = quiz.id;
  const make = async (question_type: string, question_data: any, points: number, order: number) => {
    const b = await QuestionBank.create({ course_id: 990477, question_type, question_text: `Q${order} ${question_type}`, question_data, created_by: instructor.id } as any);
    bankIds.push(b.id);
    const q = await QuizQuestion.create({ quiz_id: quizId, question_id: b.id, points, order } as any);
    qq.push(q.id);
  };
  await make("single_choice", { options: ["Kigali", "Huye", "Musanze", "Rubavu"], correct_option_index: 0 }, 2, 1);
  await make("true_false", { correct_answer: false }, 1, 2);
  await make("multiple_choice", { options: ["2", "3", "4", "5"], correct_option_indices: [0, 1, 3] }, 3, 3);
  await make("short_answer", { sample_answer: "photosynthesis" }, 4, 4);
});

afterAll(async () => {
  await QuizAttempt.destroy({ where: { quiz_id: quizId } as any });
  await QuizSubmission.destroy({ where: { quiz_id: quizId } as any });
  await QuizQuestion.destroy({ where: { quiz_id: quizId } as any });
  await Quiz.destroy({ where: { id: quizId } as any });
  await QuestionBank.destroy({ where: { id: bankIds } as any });
  await sequelize.close();
});

describe("paper answer sheets", () => {
  it("turns bubbles into answers the grader understands", () => {
    expect(toAnswer("single_choice", [2], 4)).toEqual({ selected_option_index: 2 });
    expect(toAnswer("single_choice", [1, 2], 4)).toBeNull(); // two bubbles on a one-answer question
    expect(toAnswer("single_choice", [], 4)).toBeNull();
    expect(toAnswer("true_false", [0], 2)).toEqual({ selected_answer: true });
    expect(toAnswer("true_false", [1], 2)).toEqual({ selected_answer: false });
    expect(toAnswer("multiple_choice", [3, 0, 0, 9], 4)).toEqual({ selected_option_indices: [0, 3] });
  });

  it("gives the sheet layout and key, never the answers; students can't have it", async () => {
    const r = await request(app).get(`/api/quizzes/${quizId}/paper-sheet`).set("Authorization", `Bearer ${teacher}`);
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ quizId, manual: [4], maxScore: 10 });
    expect(r.body.data.questions.map((q: any) => [q.number, q.type, q.options])).toEqual([[1, "single_choice", 4], [2, "true_false", 2], [3, "multiple_choice", 4]]);
    expect(JSON.stringify(r.body)).not.toMatch(/correct|Kigali/);
    expect((await request(app).get(`/api/quizzes/${quizId}/paper-sheet`).set("Authorization", `Bearer ${studentToken}`)).status).toBe(403);
  });

  it("scores a scanned sheet with the real grader and leaves the written question for the teacher", async () => {
    const key = (await request(app).get(`/api/quizzes/${quizId}/paper-sheet`).set("Authorization", `Bearer ${teacher}`)).body.data.key;
    const answers = { [qq[0]]: [0], [qq[1]]: [1], [qq[2]]: [0, 1, 3] }; // all correct
    const r = await request(app).post(`/api/quizzes/${quizId}/paper-results`).set("Authorization", `Bearer ${teacher}`).send({ key, results: [{ studentId, answers }] });
    expect(r.status).toBe(200);
    expect(r.body.data[0]).toMatchObject({ ok: true, studentId, score: 6, maxScore: 10, percentage: 60, updated: false });
    const sub: any = await QuizSubmission.findByPk(r.body.data[0].submissionId);
    expect(sub).toMatchObject({ status: "completed", grade_status: "pending", feedback: PAPER_FEEDBACK, passed: true });
    const attempts: any[] = await QuizAttempt.findAll({ where: { submission_id: sub.id } as any, order: [["question_id", "ASC"]] });
    expect(attempts.map((a) => [Number(a.points_earned), a.is_correct])).toEqual([[2, true], [1, true], [3, true], [0, null]]); // written: not marked yet
    expect(attempts[0].submitted_answer).toEqual({ selected_option_index: 0 });
  });

  it("a rescan updates the same submission and keeps the teacher's mark for the written question", async () => {
    const key = (await request(app).get(`/api/quizzes/${quizId}/paper-sheet`).set("Authorization", `Bearer ${teacher}`)).body.data.key;
    const sub: any = await QuizSubmission.findOne({ where: { quiz_id: quizId, student_id: studentId } as any });
    await QuizAttempt.update({ points_earned: 3 } as any, { where: { submission_id: sub.id, question_id: qq[3] } as any });
    const answers = { [qq[0]]: [1], [qq[1]]: [1], [qq[2]]: [0, 1] }; // wrong, right, partial
    const r = await request(app).post(`/api/quizzes/${quizId}/paper-results`).set("Authorization", `Bearer ${teacher}`).send({ key, results: [{ studentId, answers }] });
    expect(r.body.data[0]).toMatchObject({ ok: true, submissionId: sub.id, updated: true });
    expect(r.body.data[0].score).toBeGreaterThanOrEqual(1 + 3); // T/F + kept written mark (+ any partial credit)
    expect(await QuizSubmission.count({ where: { quiz_id: quizId, student_id: studentId } as any })).toBe(1);
  });

  it("refuses sheets printed before the quiz changed, and unknown students per row", async () => {
    const stale = await request(app).post(`/api/quizzes/${quizId}/paper-results`).set("Authorization", `Bearer ${teacher}`).send({ key: "0000000000", results: [{ studentId, answers: {} }] });
    expect(stale.status).toBe(409);
    const key = (await request(app).get(`/api/quizzes/${quizId}/paper-sheet`).set("Authorization", `Bearer ${teacher}`)).body.data.key;
    const r = await request(app).post(`/api/quizzes/${quizId}/paper-results`).set("Authorization", `Bearer ${teacher}`).send({ key, results: [{ studentId: 999999999, answers: {} }] });
    expect(r.body.data[0]).toMatchObject({ ok: false });
    // The key follows the questions: a new order means a new key.
    const a = buildSpec({ id: 1 }, [{ id: 10, order: 1, points: 1, questionBank: { question_type: "true_false" } }, { id: 11, order: 2, points: 1, questionBank: { question_type: "true_false" } }]);
    const b = buildSpec({ id: 1 }, [{ id: 10, order: 2, points: 1, questionBank: { question_type: "true_false" } }, { id: 11, order: 1, points: 1, questionBank: { question_type: "true_false" } }]);
    expect(a.key).not.toBe(b.key);
  });
});

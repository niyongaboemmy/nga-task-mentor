import request from "supertest";
import axios from "axios";
import crypto from "crypto";
import { buildTestApp, ensureModelsRegistered, findSeededUserByRole, signTokenFor } from "./testApp";
import { sequelize } from "../config/database";
import { Assignment, Quiz, QuizSubmission, Submission } from "../models";

/**
 * GET /api/dashboard/student/overview against the real dev DB and middleware,
 * with the MIS enrolment call mocked. Fixture subject ids are fake and every
 * row is removed afterwards. Run with --runInBand.
 */

jest.mock("axios", () => {
  const actual = jest.requireActual("axios");
  return { __esModule: true, ...actual, default: { ...actual.default, get: jest.fn() } };
});
const mockedGet = axios.get as jest.Mock;

const RUN = crypto.randomBytes(3).toString("hex");
const SUBJ_A = 990301; // enrolled
const SUBJ_X = 990309; // not enrolled -- must never appear
const MIS_HEADER = { "x-mis-token": "test-mis-token" };

let app: ReturnType<typeof buildTestApp>;
let studentToken: string;
let instructorToken: string;
let studentId: number;
let otherId: number;
const assignmentIds: number[] = [];
const quizIds: number[] = [];

function enrolIn(ids: number[]) {
  mockedGet.mockImplementation(async (url: string) => {
    if (String(url).includes("/enrolled-subjects")) {
      return { data: { success: true, data: ids.map((id) => ({ id, name: `Student Subject ${id}`, code: `STU${id}` })) } };
    }
    return { data: { success: true, data: [] } };
  });
}

const get = (token = studentToken) =>
  request(app).get("/api/dashboard/student/overview").set("Authorization", `Bearer ${token}`).set(MIS_HEADER);

beforeAll(async () => {
  await ensureModelsRegistered();
  app = buildTestApp();
  const student = await findSeededUserByRole("student");
  const instructor = await findSeededUserByRole("instructor");
  studentId = student.id;
  otherId = instructor.id; // stands in for "another student"
  studentToken = signTokenFor(student.id);
  instructorToken = signTokenFor(instructor.id);

  const hours = (h: number) => new Date(Date.now() + h * 3600000);
  const mk = async (course_id: number, title: string, due: Date, extra: Record<string, any> = {}) => {
    const a = await Assignment.create({
      title: `${title} ${RUN}`, description: "fixture", due_date: due, max_score: 20, submission_type: "text",
      course_id, academic_term_id: null, created_by: instructor.id, status: "published", ...extra,
    } as any);
    assignmentIds.push(a.id!);
    return a;
  };
  const dueToday = await mk(SUBJ_A, "Due today", hours(5));
  const graded = await mk(SUBJ_A, "Graded", hours(-72));
  await mk(SUBJ_X, "Foreign", hours(5));

  // Another user's submission to the due-today task must not mark it handed in.
  await Submission.create({ assignment_id: dueToday.id!, student_id: otherId, status: "submitted", text_submission: "x", is_late: false, submitted_at: new Date() } as any);
  await Submission.create({ assignment_id: graded.id!, student_id: studentId, status: "graded", grade: "15/20", feedback: "Good", text_submission: "y", is_late: false, submitted_at: hours(-80) } as any);

  const quiz = await Quiz.create({
    title: `Running ${RUN}`, description: "fixture", status: "published", type: "Quiz", course_id: SUBJ_A,
    academic_term_id: null, created_by: instructor.id, end_date: hours(24), show_results_immediately: true,
    randomize_questions: false, show_correct_answers: false, enable_automatic_grading: true, require_manual_grading: false,
  } as any);
  quizIds.push(quiz.id!);
  await QuizSubmission.create({
    quiz_id: quiz.id!, student_id: studentId, total_score: 0, max_score: 10, percentage: 0, status: "in_progress",
    grade_status: "pending", time_taken: 0, started_at: new Date(), end_time: hours(0.5), passed: false, attempt_number: 1,
  } as any);
});

afterAll(async () => {
  if (quizIds.length) {
    await QuizSubmission.destroy({ where: { quiz_id: quizIds } });
    await Quiz.destroy({ where: { id: quizIds } });
  }
  if (assignmentIds.length) {
    await Submission.destroy({ where: { assignment_id: assignmentIds } });
    await Assignment.destroy({ where: { id: assignmentIds } });
  }
  await sequelize.close();
});

describe("GET /api/dashboard/student/overview", () => {
  it("returns the student's own tasks, states and reminders", async () => {
    enrolIn([SUBJ_A]);
    const res = await get();
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(JSON.stringify(d)).not.toContain(`Foreign ${RUN}`);
    const mine = d.tasks.filter((t: any) => String(t.title).endsWith(RUN));
    const byTitle = (p: string) => mine.find((t: any) => t.title.startsWith(p));
    expect(byTitle("Running").state).toBe("in_progress");
    expect(byTitle("Due today").state).toBe("due_today"); // other user's submission ignored
    expect(byTitle("Graded")).toMatchObject({ state: "graded", score_pct: 75, has_feedback: true });
    expect(d.reminders[0]).toMatchObject({ severity: "critical", action: { label: "Resume" } });
    expect(d.subjects.map((s: any) => s.subject_id)).toEqual([SUBJ_A]);
  });

  it("returns nothing when the student isn't enrolled anywhere", async () => {
    enrolIn([]);
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.body.data.tasks).toEqual([]);
  });

  it("is refused to instructors (no student dashboard permission)", async () => {
    enrolIn([SUBJ_A]);
    expect((await get(instructorToken)).status).toBe(403);
  });
});

/**
 * Learning outcomes on tasks and the evidence pushed to the MIS competency map
 * (services/competencyEvidence.ts, routes/competency.ts) against the real dev DB.
 * MIS HTTP is replaced through setReminderTransport. Run with --runInBand:
 *   cd server && TZ=UTC npx jest --runInBand src/tests/competencyEvidence.integration.spec.ts
 */
import crypto from "crypto";
import request from "supertest";
import { buildTestApp, ensureModelsRegistered, findSeededUserByRole, signTokenFor } from "./testApp";
import { sequelize } from "../config/database";
import { Assignment, Quiz, QuizSubmission, Submission, User } from "../models";
import { ReminderRequest, setReminderTransport } from "../services/reminderSync";
import {
  buildEvidenceTask,
  clearCurriculumCache,
  flushCompetencyQueue,
  forgetTaggedCache,
  registerCompetencyHooks,
} from "../services/competencyEvidence";

const RUN = crypto.randomBytes(3).toString("hex");
const SUBJ = 990801;
const MIS_A = 990811;
const MIS_B = 990812;
const OUTCOMES = [
  { competency_id: 71, element_number: 1, title: "Apply networking basics", criteria: [
    { criteria_id: 701, criteria_number: "1.1", description: "Identify network types" },
    { criteria_id: 702, criteria_number: "1.2", description: "Draw a topology" },
  ] },
  { competency_id: 72, element_number: 2, title: "Configure a router", criteria: [{ criteria_id: 703, criteria_number: "2.1", description: "Set interface addresses" }] },
];

let app: ReturnType<typeof buildTestApp>;
let teacher: string;
let studentToken: string;
let quizId: number;
let assignmentId: number;
const userIds: number[] = [];
let calls: ReminderRequest[] = [];
const savedEnv = { ...process.env };

const evidencePuts = () => calls.filter((c) => c.method === "PUT" && c.url.endsWith("/competency/evidence"));

beforeAll(async () => {
  process.env.NGA_MIS_BASE_URL = "http://mis.test";
  process.env.SSO_CLIENT_ID = "taskmentor_app";
  process.env.SSO_CLIENT_SECRET = "secret";
  setReminderTransport(async (req) => {
    calls.push(req);
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === `/competency/curriculum/${SUBJ}`) return { status: 200, body: { success: true, data: { subject_id: SUBJ, outcomes: OUTCOMES } } };
    if (req.method === "PUT" && url.pathname === "/competency/evidence") return { status: 200, body: { success: true, data: { tasks: (req.body as any).tasks.length } } };
    return { status: 404, body: null };
  });
  await ensureModelsRegistered();
  app = buildTestApp();
  const instructor = await findSeededUserByRole("instructor");
  const student = await findSeededUserByRole("student");
  teacher = signTokenFor(instructor.id);
  studentToken = signTokenFor(student.id);
  const mk = async (tag: string, mis: number) => {
    const u = await User.create({ email: `ce.${tag}.${RUN}@local.test`, password: "MIS_AUTH", first_name: "CE", last_name: tag, role: "student", role_id: student.role_id, mis_user_id: mis } as any);
    userIds.push(u.id);
    return u.id;
  };
  const a = await mk("a", MIS_A);
  const b = await mk("b", MIS_B);
  const quiz = await Quiz.create({ title: `CE quiz ${RUN}`, description: "competency spec", status: "published", type: "Quiz", course_id: SUBJ, academic_term_id: null, created_by: instructor.id, is_public: true } as any);
  quizId = quiz.id!;
  const sub = (student_id: number, pct: number, grade_status: string, attempt: number) =>
    QuizSubmission.create({ quiz_id: quizId, student_id, status: "completed", grade_status, total_score: pct, max_score: 100, percentage: pct, passed: pct >= 50, attempt_number: attempt, started_at: new Date(), completed_at: new Date(), time_taken: 60 } as any);
  await sub(a, 55, "graded", 1);
  await sub(a, 80, "auto_graded", 2); // best graded attempt
  await sub(b, 100, "pending", 1); // not marked yet: not evidence
  const asg = await Assignment.create({ title: `CE essay ${RUN}`, description: "competency spec", due_date: new Date(), max_score: 10, submission_type: "text", course_id: SUBJ, academic_term_id: null, created_by: instructor.id, status: "published" } as any);
  assignmentId = asg.id!;
  await Submission.create({ assignment_id: assignmentId, student_id: b, status: "graded", grade: "7/10", text_submission: "x", is_late: false, submitted_at: new Date() } as any);
  await Submission.create({ assignment_id: assignmentId, student_id: a, status: "submitted", text_submission: "y", is_late: false, submitted_at: new Date() } as any);
});

afterAll(async () => {
  setReminderTransport(null);
  process.env = savedEnv;
  await sequelize.query("DELETE FROM task_criteria WHERE (task_type = 'quiz' AND task_id = ?) OR (task_type = 'assignment' AND task_id = ?)", { replacements: [quizId, assignmentId] });
  await QuizSubmission.destroy({ where: { quiz_id: quizId } as any });
  await Submission.destroy({ where: { assignment_id: assignmentId } as any });
  await Quiz.destroy({ where: { id: quizId } as any });
  await Assignment.destroy({ where: { id: assignmentId } as any });
  await User.destroy({ where: { id: userIds } as any });
  await sequelize.close();
});

beforeEach(async () => {
  await flushCompetencyQueue(); // nothing left over from the previous test
  calls = [];
  clearCurriculumCache();
});

describe("tagging tasks with learning outcomes", () => {
  it("gives teachers the subject's outcomes from MIS; students can't", async () => {
    const r = await request(app).get(`/api/competency/curriculum/${SUBJ}`).set("Authorization", `Bearer ${teacher}`);
    expect(r.status).toBe(200);
    expect(r.body.data.outcomes.map((o: any) => o.title)).toEqual(["Apply networking basics", "Configure a router"]);
    expect(calls[0].headers.Authorization).toMatch(/^Basic /);
    expect((await request(app).get(`/api/competency/curriculum/${SUBJ}`).set("Authorization", `Bearer ${studentToken}`)).status).toBe(403);
  });

  it("stores the chosen criteria with their text, refuses criteria of another subject", async () => {
    const bad = await request(app).put(`/api/competency/tasks/quiz/${quizId}`).set("Authorization", `Bearer ${teacher}`).send({ criteria_ids: [701, 999] });
    expect(bad.status).toBe(400);
    const r = await request(app).put(`/api/competency/tasks/quiz/${quizId}`).set("Authorization", `Bearer ${teacher}`).send({ criteria_ids: [703, 701] });
    expect(r.status).toBe(200);
    expect(r.body.data.criteria.map((c: any) => [c.criteria_number, c.outcome_title])).toEqual([["1.1", "Apply networking basics"], ["2.1", "Configure a router"]]);
    const g = await request(app).get(`/api/competency/tasks/quiz/${quizId}`).set("Authorization", `Bearer ${teacher}`);
    expect(g.body.data).toMatchObject({ subject_id: SUBJ, can_edit: true });
    expect(g.body.data.criteria).toHaveLength(2);
    expect((await request(app).get(`/api/competency/tasks/quiz/${quizId}`).set("Authorization", `Bearer ${studentToken}`)).status).toBe(403);
    expect((await request(app).get(`/api/competency/tasks/essay/1`).set("Authorization", `Bearer ${teacher}`)).status).toBe(400);
  });
});

describe("evidence for MIS", () => {
  it("a quiz sends each linked student's best graded attempt, not unmarked ones", async () => {
    const t = await buildEvidenceTask({ type: "quiz", id: quizId });
    expect(t).toMatchObject({ source_type: "quiz", source_ref: quizId, subject_id: SUBJ, criteria_ids: expect.arrayContaining([701, 703]) });
    expect(t!.results).toEqual([expect.objectContaining({ student_id: MIS_A, score_pct: 80 })]);
  });

  it("an assignment sends graded submissions as a percentage", async () => {
    const t = await buildEvidenceTask({ type: "assignment", id: assignmentId });
    expect(t!.results).toEqual([expect.objectContaining({ student_id: MIS_B, score_pct: 70 })]);
    expect(t!.criteria_ids).toEqual([]);
  });

  it("tagging pushes the task; untagging pushes it with no criteria so MIS clears it", async () => {
    await request(app).put(`/api/competency/tasks/assignment/${assignmentId}`).set("Authorization", `Bearer ${teacher}`).send({ criteria_ids: [702] });
    await flushCompetencyQueue();
    expect(evidencePuts()).toHaveLength(1);
    expect((evidencePuts()[0].body as any).tasks[0]).toMatchObject({ source_type: "assignment", source_ref: assignmentId, criteria_ids: [702], results: [expect.objectContaining({ student_id: MIS_B, score_pct: 70 })] });
    calls = [];
    await request(app).put(`/api/competency/tasks/assignment/${assignmentId}`).set("Authorization", `Bearer ${teacher}`).send({ criteria_ids: [] });
    await flushCompetencyQueue();
    expect((evidencePuts()[0].body as any).tasks[0]).toMatchObject({ source_ref: assignmentId, criteria_ids: [] });
  });

  it("a new grade on a tagged task is pushed; an untagged task isn't", async () => {
    registerCompetencyHooks();
    forgetTaggedCache();
    const a = userIds[0];
    await Submission.update({ status: "graded", grade: "9/10" } as any, { where: { assignment_id: assignmentId, student_id: a } as any, individualHooks: true });
    await new Promise((r) => setTimeout(r, 50));
    await flushCompetencyQueue();
    expect(evidencePuts()).toHaveLength(0); // the assignment is untagged now

    const sub: any = await QuizSubmission.findOne({ where: { quiz_id: quizId, grade_status: "pending" } as any });
    await sub.update({ grade_status: "graded", percentage: 90 });
    await new Promise((r) => setTimeout(r, 50));
    await flushCompetencyQueue();
    const sent = (evidencePuts()[0].body as any).tasks[0];
    expect(sent.source_ref).toBe(quizId);
    expect(sent.results.map((x: any) => [x.student_id, x.score_pct]).sort()).toEqual([[MIS_A, 80], [MIS_B, 90]]);
  });
});

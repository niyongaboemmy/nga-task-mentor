import crypto from "crypto";
import request from "supertest";
import { buildTestApp, ensureModelsRegistered, findSeededUserByRole, signTokenFor } from "./testApp";
import { sequelize } from "../config/database";
import {
  Assignment,
  Permission,
  Project,
  ProjectActivityLink,
  QuestionBank,
  Quiz,
  QuizQuestion,
  Role,
  TmcodeSession,
  User,
} from "../models";
import { aiService } from "../services/ai/aiService";
import { resetAiPolicyCache, setAiPolicyForTests } from "../services/aiPolicy";
import { AI_POLICY_DEFAULT, type AiPolicy } from "../vendor/nga-access";
import { forAssignment, forProject, forQuestion, forQuiz } from "../utils/aiContext";
import { examAiMode } from "../tmcode/policy";
import * as reminders from "../services/reminderSync";

/**
 * AI usage control in Task Mentor (AI_USAGE_CONTROL_PLAN.md §5, §9) against
 * the dev DB: who is a learner in an item, the student hint route, GET
 * /api/ai/access, TMCode AI with a project of an assignment, and saving the
 * teacher's ai_mode. The MIS policy is pinned with setAiPolicyForTests.
 */

jest.setTimeout(20_000);
const COURSE_ID = 4251;
const ON: AiPolicy = { ...AI_POLICY_DEFAULT, v: 7, enabled: true };
const OFF: AiPolicy = { ...AI_POLICY_DEFAULT, v: 8, enabled: false };

let app: ReturnType<typeof buildTestApp>;
let admin: User;
let teacher: User;
let student: User;
const tok = (u: User) => `Bearer ${signTokenFor(u.id)}`;
const quizIds: number[] = [];
const bankIds: number[] = [];
const assignmentIds: number[] = [];
const projectIds: number[] = [];

/** req.user as protect() builds it, for calling the resolvers directly. */
async function reqFor(u: User): Promise<any> {
  const full = await User.findByPk(u.id, { include: [{ model: Role, include: [Permission] }] });
  const keys = ((full as any)?.roleRecord?.permissions ?? []).map((p: any) => p.key);
  return { user: { id: u.id, permissions: new Set(keys), mis_user_id: u.mis_user_id }, headers: {}, cookies: {} };
}

async function makeQuiz(aiMode: "off" | "hints" | "full") {
  const quiz = await Quiz.create({
    title: "AI usage control spec",
    description: "aiUsageControl.integration.spec.ts",
    course_id: COURSE_ID,
    created_by: teacher.id,
    status: "published",
    type: "Quiz",
    ai_mode: aiMode,
  } as any);
  quizIds.push(quiz.id);
  const bank = await QuestionBank.create({
    course_id: COURSE_ID,
    question_type: "coding",
    question_text: "Add two numbers",
    question_data: { language: "python", test_cases: [] } as any,
    created_by: teacher.id,
  } as any);
  bankIds.push(bank.id);
  const question = await QuizQuestion.create({ quiz_id: quiz.id, question_id: bank.id, points: 2, order: 1 } as any);
  return { quiz, question };
}

async function makeAssignment(aiMode: "off" | "hints" | "full") {
  const a = await Assignment.create({
    title: `AI spec ${crypto.randomBytes(3).toString("hex")}`,
    description: "aiUsageControl.integration.spec.ts",
    due_date: new Date(Date.now() + 7 * 86_400_000),
    max_score: 10,
    submission_type: "both",
    course_id: COURSE_ID,
    created_by: teacher.id,
    status: "published",
    ai_mode: aiMode,
  } as any);
  assignmentIds.push(a.id);
  return a;
}

async function makeProject(owner: User, extra: Record<string, unknown> = {}) {
  const slug = `ai-spec-${crypto.randomBytes(5).toString("hex")}`;
  const p = await Project.create({ owner_id: owner.id, name: slug, slug, language: "python", kind: "tm", ...extra } as any);
  projectIds.push(p.id);
  return p;
}

beforeAll(async () => {
  await ensureModelsRegistered();
  app = buildTestApp();
  admin = await findSeededUserByRole("admin");
  teacher = await findSeededUserByRole("instructor");
  student = await findSeededUserByRole("student");
});

beforeEach(() => {
  setAiPolicyForTests(ON);
  jest.spyOn(reminders, "syncAssignment").mockResolvedValue(undefined as any);
  jest.spyOn(reminders, "syncQuiz").mockResolvedValue(undefined as any);
});

afterEach(() => jest.restoreAllMocks());

afterAll(async () => {
  resetAiPolicyCache();
  if (projectIds.length) {
    await ProjectActivityLink.destroy({ where: { project_id: projectIds } });
    await Project.destroy({ where: { id: projectIds } });
  }
  if (quizIds.length) {
    await QuizQuestion.destroy({ where: { quiz_id: quizIds } });
    await Quiz.destroy({ where: { id: quizIds } });
  }
  if (bankIds.length) await QuestionBank.destroy({ where: { id: bankIds } });
  if (assignmentIds.length) await Assignment.destroy({ where: { id: assignmentIds } });
  await sequelize.close();
});

describe("aiContext: only a learner is in an item", () => {
  it("a student is in the quiz (with its ai_mode); its creator and a MANAGE_ANY admin are not", async () => {
    const { quiz, question } = await makeQuiz("hints");
    expect(await forQuiz(await reqFor(student), quiz.id)).toEqual({ kind: "quiz", id: quiz.id, aiMode: "hints", examActive: false });
    expect(await forQuestion(await reqFor(student), question.id)).toMatchObject({ kind: "quiz", id: quiz.id });
    expect(await forQuiz(await reqFor(teacher), quiz.id)).toBeNull();
    // (the dev DB's admin role may predate QUIZZES_MANAGE_ANY: grant it on the request)
    const superAdmin = await reqFor(admin);
    superAdmin.user.permissions.add("QUIZZES_MANAGE_ANY");
    expect(await forQuiz(superAdmin, quiz.id)).toBeNull();
  });

  it("assignments the same way; unknown items are null", async () => {
    const a = await makeAssignment("full");
    expect(await forAssignment(await reqFor(student), a.id)).toMatchObject({ kind: "assignment", id: a.id, aiMode: "full" });
    expect(await forAssignment(await reqFor(teacher), a.id)).toBeNull();
    expect(await forAssignment(await reqFor(admin), a.id)).toBeNull();
    expect(await forAssignment(await reqFor(student), 999_999_999)).toBeNull();
  });

  it("a project: its assignment, else the strictest linked activity; not for a teacher reading it", async () => {
    const full = await makeAssignment("full");
    const own = await makeProject(student, { assignment_id: full.id });
    expect(await forProject(await reqFor(student), own.id)).toMatchObject({ kind: "assignment", id: full.id, aiMode: "full" });

    const { quiz } = await makeQuiz("off");
    const linked = await makeProject(student);
    await ProjectActivityLink.create({ project_id: linked.id, activity_type: "assignment", activity_id: full.id, linked_by: student.id } as any);
    await ProjectActivityLink.create({ project_id: linked.id, activity_type: "quiz", activity_id: quiz.id, linked_by: student.id } as any);
    expect(await forProject(await reqFor(student), linked.id)).toMatchObject({ kind: "quiz", id: quiz.id, aiMode: "off" });

    expect(await forProject(await reqFor(student), (await makeProject(student)).id)).toBeNull();
    expect(await forProject(await reqFor(admin), own.id)).toBeNull();
  });
});

describe("POST /api/quizzes/questions/:id/ai-hint (student)", () => {
  const hint = (questionId: number) =>
    request(app).post(`/api/quizzes/questions/${questionId}/ai-hint`).set("Authorization", tok(student)).send({ code: "print(1)", language: "python" });

  it("quiz off → 403 TEACHER_OFF; hints → 200; full → 200", async () => {
    const spy = jest.spyOn(aiService, "getSocraticHint").mockResolvedValue("Think about the input." as any);
    const off = await makeQuiz("off");
    const res = await hint(off.question.id);
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ success: false, code: "AI_DISABLED", reason: "TEACHER_OFF" });
    expect(typeof res.body.message).toBe("string");
    expect(spy).not.toHaveBeenCalled();

    const hints = await makeQuiz("hints");
    const ok = await hint(hints.question.id);
    expect(ok.status).toBe(200);
    expect(ok.body.data.hint).toBe("Think about the input.");
    expect((await hint((await makeQuiz("full")).question.id)).status).toBe(200);
  });

  it("the school's master switch off → 403 GLOBAL_OFF, even where the teacher allows it", async () => {
    setAiPolicyForTests(OFF);
    const { question } = await makeQuiz("full");
    const res = await hint(question.id);
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ code: "AI_DISABLED", reason: "GLOBAL_OFF" });
  });

  it("no policy from MIS fails closed; assessments locked → ASSESSMENT_LOCKED", async () => {
    const { question } = await makeQuiz("full");
    setAiPolicyForTests(null);
    expect((await hint(question.id)).body.reason).toBe("GLOBAL_OFF");
    setAiPolicyForTests({ ...ON, assessments: "always_off" });
    expect((await hint(question.id)).body.reason).toBe("ASSESSMENT_LOCKED");
  });
});

describe("teacher AI routes (author)", () => {
  it("AI_USE decides outside items: an instructor passes the gate, the master switch stops it", async () => {
    const body = { title: "Essay", description: "Write about loops", max_score: 10 };
    jest.spyOn(require("../services/ai/rubricGenerator"), "generateRubric").mockResolvedValue({ criteria: [] } as any);
    const ok = await request(app).post("/api/assignments/ai/rubric").set("Authorization", tok(teacher)).send(body);
    expect(ok.status).not.toBe(403);
    setAiPolicyForTests(OFF);
    const off = await request(app).post("/api/assignments/ai/rubric").set("Authorization", tok(teacher)).send(body);
    expect(off.status).toBe(403);
    expect(off.body).toMatchObject({ code: "AI_DISABLED", reason: "GLOBAL_OFF" });
  });
});

describe("GET /api/ai/access and /api/ai/policy", () => {
  const access = (u: User, q: string) => request(app).get(`/api/ai/access?${q}`).set("Authorization", tok(u));

  it("tells a student what is allowed in each item, and the role default outside", async () => {
    const hints = await makeQuiz("hints");
    let res = await access(student, `quiz=${hints.quiz.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ allowed: true, reason: "HINTS_ONLY", mode: "hints", features: { assist: false, complete: false, hint: true } });

    const full = await makeAssignment("full");
    res = await access(student, `assignment=${full.id}`);
    expect(res.body.data).toMatchObject({ allowed: true, reason: "ALLOWED_BY_TEACHER", mode: "full", features: { assist: true, complete: true, hint: true } });

    res = await access(student, "");
    expect(res.body.data).toMatchObject({ allowed: false, reason: "ROLE_OFF", mode: null });

    // the quiz's creator is not "in" it: the role (AI_USE) decides
    res = await access(teacher, `quiz=${hints.quiz.id}`);
    expect(res.body.data).toMatchObject({ allowed: true, reason: "ALLOWED_BY_ROLE", mode: null });
  });

  it("policy summary: item modes in force unless assessments are locked", async () => {
    let res = await request(app).get("/api/ai/policy").set("Authorization", tok(teacher));
    expect(res.body.data).toMatchObject({ enabled: true, itemModes: true, hasAiUse: true, author: { allowed: true } });
    setAiPolicyForTests({ ...ON, assessments: "always_off" });
    res = await request(app).get("/api/ai/policy").set("Authorization", tok(teacher));
    expect(res.body.data.itemModes).toBe(false);
    setAiPolicyForTests(OFF);
    res = await request(app).get("/api/ai/policy").set("Authorization", tok(student));
    expect(res.body.data).toMatchObject({ enabled: false, itemModes: false, hasAiUse: false, author: { allowed: false, reason: "GLOBAL_OFF" } });
  });
});

describe("TMCode AI with project_id", () => {
  const chat = (u: User, body: Record<string, unknown>) =>
    request(app).post("/api/tmcode/ai/chat").set("Authorization", tok(u)).send({ messages: [{ role: "user", content: "hi" }], ...body });

  it("a student's project of a 'full' assignment: status allowed and chat accepted, without AI_USE", async () => {
    const a = await makeAssignment("full");
    const p = await makeProject(student, { assignment_id: a.id });
    const status = await request(app).get(`/api/tmcode/ai/status?project_id=${p.id}`).set("Authorization", tok(student));
    expect(status.status).toBe(200);
    expect(status.body).toMatchObject({ allowed: true, reason: "ALLOWED_BY_TEACHER", mode: "full", features: { assist: true, complete: true }, thirdPartyExtensions: false });
    expect(typeof status.body.message).toBe("string");
    const res = await chat(student, { project_id: p.id });
    expect(res.status).toBe(201);
    expect(typeof res.body.id).toBe("string");
  });

  it("the master switch off → 403 AI_DISABLED GLOBAL_OFF (status still answers)", async () => {
    const a = await makeAssignment("full");
    const p = await makeProject(student, { assignment_id: a.id });
    setAiPolicyForTests(OFF);
    const res = await chat(student, { project_id: p.id });
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ error_code: "AI_DISABLED", code: "AI_DISABLED", reason: "GLOBAL_OFF" });
    const status = await request(app).get(`/api/tmcode/ai/status?project_id=${p.id}`).set("Authorization", tok(student));
    expect(status.status).toBe(200);
    expect(status.body).toMatchObject({ allowed: false, reason: "GLOBAL_OFF", enabled: false });
  });

  it("hints-only and no project: a student is refused; a teacher without a project is allowed by role", async () => {
    const a = await makeAssignment("hints");
    const p = await makeProject(student, { assignment_id: a.id });
    expect((await chat(student, { project_id: p.id })).body.reason).toBe("HINTS_ONLY");
    expect((await chat(student, {})).body.reason).toBe("ROLE_OFF");
    expect((await chat(teacher, {})).status).toBe(201);
    const complete = await request(app).post("/api/tmcode/ai/complete").set("Authorization", tok(student)).send({ prefix: "x", project_id: p.id });
    expect(complete.status).toBe(403);
    expect(complete.body.reason).toBe("HINTS_ONLY");
  });

  it("an open exam is the context: its quiz's ai_mode applies (off → EXAM_ACTIVE)", async () => {
    const { quiz } = await makeQuiz("off");
    jest.spyOn(TmcodeSession, "findOne").mockResolvedValue({ id: "s", quiz_id: quiz.id } as any);
    const res = await chat(student, {});
    expect(res.status).toBe(403);
    expect(res.body.reason).toBe("EXAM_ACTIVE");
    const status = await request(app).get("/api/tmcode/ai/status").set("Authorization", tok(student));
    expect(status.body).toMatchObject({ exam: true, allowed: false, reason: "EXAM_ACTIVE", mode: "off" });
  });
});

describe("exam package policy.ai", () => {
  it("is the quiz's ai_mode, and off while the school refuses AI in assessments", async () => {
    const { quiz } = await makeQuiz("hints");
    expect(await examAiMode(quiz.id)).toBe("hints");
    setAiPolicyForTests({ ...ON, assessments: "always_off" });
    expect(await examAiMode(quiz.id)).toBe("off");
    setAiPolicyForTests({ ...ON, apps: { ...ON.apps, tmcode: false } });
    expect(await examAiMode(quiz.id)).toBe("off");
    setAiPolicyForTests(OFF);
    expect(await examAiMode(quiz.id)).toBe("off");
  });
});

describe("saving the teacher's ai_mode", () => {
  it("PUT /api/quizzes/:id stores ai_mode (creator) and refuses a bad value", async () => {
    const { quiz } = await makeQuiz("off");
    const res = await request(app).put(`/api/quizzes/${quiz.id}`).set("Authorization", tok(teacher)).send({ ai_mode: "full" });
    expect(res.status).toBe(200);
    expect(res.body.data.ai_mode).toBe("full");
    const bad = await request(app).put(`/api/quizzes/${quiz.id}`).set("Authorization", tok(teacher)).send({ ai_mode: "everything" });
    expect(bad.status).toBe(400);
    expect((await Quiz.findByPk(quiz.id))!.ai_mode).toBe("full");
  });

  it("PUT /api/assignments/:id stores ai_mode (validated by hand) and an admin may override", async () => {
    const a = await makeAssignment("off");
    const res = await request(app).put(`/api/assignments/${a.id}`).set("Authorization", tok(teacher)).send({ ai_mode: "hints" });
    expect(res.status).toBe(200);
    expect(res.body.data.ai_mode).toBe("hints");
    const bad = await request(app).put(`/api/assignments/${a.id}`).set("Authorization", tok(teacher)).send({ ai_mode: "lots" });
    expect(bad.status).toBe(400);
    const byAdmin = await request(app).put(`/api/assignments/${a.id}`).set("Authorization", tok(admin)).send({ ai_mode: "off" });
    expect(byAdmin.status).toBe(200);
    expect((await Assignment.findByPk(a.id))!.ai_mode).toBe("off");
  });
});

import crypto from "crypto";
import request from "supertest";
import { buildTestApp, ensureModelsRegistered, findSeededUserByRole, signTokenFor } from "./testApp";
import { sequelize } from "../config/database";
import { Assignment, Project, ProjectEvent, User } from "../models";
import { resetAiPolicyCache, setAiPolicyForTests } from "../services/aiPolicy";
import { AI_POLICY_DEFAULT, type AiPolicy } from "../vendor/nga-access";
import * as aiService from "../tmcode/ai/service";
import * as coderunner from "../services/coderunner";
import { resetAllowances } from "../tmcode/ai/learning";
import { resetInterpreterUsage } from "../tmcode/ai/interpreter";
import * as reminders from "../services/reminderSync";

/**
 * The request interpreter's endpoints (nga-tmcode reports/TMCode prompt interpreter layer.md)
 * against the dev DB: /status says the interpreter's arm, stage and the Prompt Problem (hidden
 * examples withheld); /ai/interpret gives Industrial a card and Learning the coach, refuses exams
 * and the teacher's "off"; Prompt Problems are checked on the code runner; metrics are staff-only.
 */

jest.setTimeout(20_000);
const COURSE_ID = 4251;
const ON: AiPolicy = { ...AI_POLICY_DEFAULT, v: 9, enabled: true };

let app: ReturnType<typeof buildTestApp>;
let teacher: User;
let student: User;
const tok = (u: User) => `Bearer ${signTokenFor(u.id)}`;
const assignmentIds: number[] = [];
const projectIds: number[] = [];

async function makeAssignment(aiMode: "off" | "hints" | "full", extra: Record<string, unknown> = {}) {
  const a = await Assignment.create({
    title: `Interpreter spec ${crypto.randomBytes(3).toString("hex")}`,
    description: "tmcodeInterpreter.integration.spec.ts",
    due_date: new Date(Date.now() + 7 * 86_400_000),
    max_score: 10,
    submission_type: "both",
    course_id: COURSE_ID,
    created_by: teacher.id,
    status: "published",
    ai_mode: aiMode,
    ...extra,
  } as any);
  assignmentIds.push(a.id);
  return a;
}

async function projectFor(a: Assignment) {
  const slug = `interp-${crypto.randomBytes(5).toString("hex")}`;
  const p = await Project.create({ owner_id: student.id, name: slug, slug, language: "python", kind: "tm", assignment_id: a.id } as any);
  projectIds.push(p.id);
  return p;
}

const status = (u: User, projectId: number) => request(app).get(`/api/tmcode/ai/status?project_id=${projectId}`).set("Authorization", tok(u));
const interpret = (u: User, body: Record<string, unknown>) => request(app).post("/api/tmcode/ai/interpret").set("Authorization", tok(u)).send(body);

const CARD = JSON.stringify({ spec_en: "Write is_even(n) that returns True for even numbers.", task_type: "add-feature", requirements: [{ text: "is_even returns True for even numbers", quote: "is_even" }], targets: ["solution.py"], restated: "You want is_even." });

beforeAll(async () => {
  await ensureModelsRegistered();
  app = buildTestApp();
  teacher = await findSeededUserByRole("instructor");
  student = await findSeededUserByRole("student");
});

beforeEach(() => {
  setAiPolicyForTests(ON);
  resetAllowances();
  resetInterpreterUsage();
  process.env.GROQ_API_KEY = process.env.GROQ_API_KEY || "gsk_test";
  process.env.TMCODE_INTERPRETER_HOLDOUT_PCT = "0";
  jest.spyOn(reminders, "syncAssignment").mockResolvedValue(undefined as any);
});

afterEach(() => jest.restoreAllMocks());

afterAll(async () => {
  resetAiPolicyCache();
  if (projectIds.length) {
    await ProjectEvent.destroy({ where: { project_id: projectIds } });
    await Project.destroy({ where: { id: projectIds } });
  }
  if (assignmentIds.length) await Assignment.destroy({ where: { id: assignmentIds } });
  await sequelize.close();
});

describe("/status carries the interpreter", () => {
  it("arm, stage, raw-prompt visibility and the Prompt Problem without its hidden examples", async () => {
    const a = await makeAssignment("full", { ai_help: { interpreter: "hint", show_prompts: true, prompt_problem: { language: "python", examples: [{ input: "is_even(4)", output: "True" }], hidden: [{ input: "is_even(7)", output: "False" }] } } });
    const res = await status(student, (await projectFor(a)).id);
    expect(res.body.interpreter).toMatchObject({ arm: "card", stage: "hint", show_prompts: true, prompt_problem: { language: "python", entry: "solution.py", examples: [{ input: "is_even(4)", output: "True" }], hidden_count: 1 } });
    expect(JSON.stringify(res.body)).not.toMatch(/is_even\(7\)/);
  });
  it("exam (AI off): not available", async () => {
    const res = await status(student, (await projectFor(await makeAssignment("off"))).id);
    expect(res.body.interpreter.available).toBe(false);
  });
});

describe("POST /ai/interpret", () => {
  it("Industrial: a validated card from the pinned route", async () => {
    const spy = jest.spyOn(aiService, "jsonCompletion").mockResolvedValue({ text: CARD, provider: "groq", model: "openai/gpt-oss-20b", tier: "free" });
    const p = await projectFor(await makeAssignment("full"));
    const res = await interpret(student, { text: "write is_even(n)", project_id: p.id, paths: ["solution.py"] });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ kind: "card", provider: "groq", arm: "card", stage: "auto", card: { original: "write is_even(n)", targets: ["solution.py"], task_type: "add-feature" } });
    // The model saw the words and the paths, not the user's name.
    expect(String(spy.mock.calls[0][1][1].content)).toMatch(/<<<REQUEST>>>\nwrite is_even\(n\)/);
  });
  it("Learning: the coach (first pass free, the next ones on the same draft spend a question)", async () => {
    jest.spyOn(aiService, "jsonCompletion").mockResolvedValue({ text: JSON.stringify({ missing: [{ id: "example", question: "What should is_even(0) give?" }], segments: [{ text: "write is_even", kind: "goal" }] }), provider: "groq", model: "m", tier: "free" });
    const p = await projectFor(await makeAssignment("hints", { ai_help: { allowance: { max: 3, regain_minutes: 30 } } }));
    const first = await interpret(student, { text: "write is_even", project_id: p.id, draft_id: "d1" });
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ kind: "coach", coach: { missing: [{ id: "example" }] }, allowance: { left: 3 } });
    const again = await interpret(student, { text: "write is_even please", project_id: p.id, draft_id: "d1" });
    expect(again.body.allowance.left).toBe(2);
  });
  it("the teacher's off switch and exams refuse", async () => {
    const off = await interpret(student, { text: "write is_even", project_id: (await projectFor(await makeAssignment("full", { ai_help: { interpreter: "off" } }))).id });
    expect(off.status).toBe(403);
    expect(off.body.code).toBe("INTERPRETER_OFF");
    const exam = await interpret(student, { text: "write is_even", project_id: (await projectFor(await makeAssignment("off"))).id });
    expect(exam.status).toBe(403);
    expect(exam.body.code).toBe("LAYER_EXAM");
  });
  it("an unusable answer: INTERPRETER_INVALID (the app sends the words as they are)", async () => {
    jest.spyOn(aiService, "jsonCompletion").mockResolvedValue({ text: "sorry", provider: "groq", model: "m", tier: "free" });
    const res = await interpret(student, { text: "write is_even", project_id: (await projectFor(await makeAssignment("full"))).id });
    expect(res.status).toBe(502);
    expect(res.body.code).toBe("INTERPRETER_INVALID");
  });
  it("a daily cap", async () => {
    process.env.TMCODE_AI_INTERPRET_PER_DAY = "1";
    jest.spyOn(aiService, "jsonCompletion").mockResolvedValue({ text: CARD, provider: "groq", model: "m", tier: "free" });
    const p = await projectFor(await makeAssignment("full"));
    expect((await interpret(student, { text: "a b c", project_id: p.id })).status).toBe(200);
    expect((await interpret(student, { text: "a b c", project_id: p.id })).body.code).toBe("INTERPRET_QUOTA");
    delete process.env.TMCODE_AI_INTERPRET_PER_DAY;
  });
});

describe("Prompt Problems", () => {
  it("checks the AI's code on the runner; hidden examples only as a count", async () => {
    jest.spyOn(coderunner, "getCodeRunner").mockReturnValue({
      run: async (req: any) => ({ engine: "t", compile: null, tests: req.tests.map((t: any) => ({ id: t.id, verdict: "OK", passed: true, stdout: /\b(4|8)\b/.test(t.input) ? "True" : "False", stderr: null, time_ms: 1, memory_kb: 1 })) }),
    } as any);
    const a = await makeAssignment("full", { ai_help: { prompt_problem: { language: "python", examples: [{ input: "is_even(4)", output: "True" }], hidden: [{ input: "is_even(8)", output: "True" }, { input: "is_even(3)", output: "False" }] } } });
    const res = await request(app).post("/api/tmcode/ai/prompt-problem/check").set("Authorization", tok(student)).send({ project_id: (await projectFor(a)).id, code: "def is_even(n): return n % 2 == 0" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ passed: 3, total: 3, hidden: { passed: 2, total: 2 } });
    expect(JSON.stringify(res.body)).not.toMatch(/is_even\(8\)/);
  });
  it("not a Prompt Problem: 404", async () => {
    const res = await request(app).post("/api/tmcode/ai/prompt-problem/check").set("Authorization", tok(student)).send({ project_id: (await projectFor(await makeAssignment("full"))).id, code: "x" });
    expect(res.status).toBe(404);
  });
});

describe("metrics (Q14 online)", () => {
  it("staff only; per arm from the uploaded activity", async () => {
    const p = await projectFor(await makeAssignment("full"));
    await ProjectEvent.create({
      project_id: p.id,
      user_id: student.id,
      type: "activity",
      data: { batch: `spec-${crypto.randomBytes(4).toString("hex")}`, events: [{ kind: "ai", action: "intent", t: Date.now(), data: { arm: "card", outcome: "accepted", ms: 900, completeness: 0.5, language: "en", stage: "full" } }, { kind: "ai", action: "chat", t: Date.now(), data: { arm: "card" } }] },
      created_at: new Date(),
    } as any);
    expect((await request(app).get("/api/tmcode/ai/interpret/metrics").set("Authorization", tok(student))).status).toBe(403);
    const res = await request(app).get("/api/tmcode/ai/interpret/metrics?days=1").set("Authorization", tok(teacher));
    expect(res.status).toBe(200);
    expect(res.body.arms.card.cards).toBeGreaterThanOrEqual(1);
    expect(res.body.arms.card.outcomes.accepted).toBeGreaterThanOrEqual(1);
  });
});

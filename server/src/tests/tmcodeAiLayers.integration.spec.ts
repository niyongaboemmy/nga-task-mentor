import crypto from "crypto";
import request from "supertest";
import { buildTestApp, ensureModelsRegistered, findSeededUserByRole, signTokenFor } from "./testApp";
import { sequelize } from "../config/database";
import { Assignment, Project, User } from "../models";
import { resetAiPolicyCache, setAiPolicyForTests } from "../services/aiPolicy";
import { AI_POLICY_DEFAULT, type AiPolicy } from "../vendor/nga-access";
import * as aiService from "../tmcode/ai/service";
import { resetAllowances, resetSigningKey } from "../tmcode/ai/learning";
import * as reminders from "../services/reminderSync";

/**
 * TMCode AI layers in Task Mentor (nga-tmcode reports/TMCode vibe coding proposal 2026.md §8)
 * against the dev DB: /status names the layer and the Learning knobs; a Learning chat gets the
 * tutor prompt and read-only tools, its stream passes the code filter, it spends the allowance;
 * Industrial · Open via the teacher's own-tools toggle; the signed sticky layer.
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
    title: `AI layers spec ${crypto.randomBytes(3).toString("hex")}`,
    description: "tmcodeAiLayers.integration.spec.ts",
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
  const slug = `ai-layers-${crypto.randomBytes(5).toString("hex")}`;
  const p = await Project.create({ owner_id: student.id, name: slug, slug, language: "python", kind: "tm", assignment_id: a.id } as any);
  projectIds.push(p.id);
  return p;
}

const status = (u: User, projectId: number) => request(app).get(`/api/tmcode/ai/status?project_id=${projectId}`).set("Authorization", tok(u));
const ask = (u: User, body: Record<string, unknown>) => request(app).post("/api/tmcode/ai/chat").set("Authorization", tok(u)).send({ messages: [{ role: "user", content: "fix my loop" }], ...body });

/** The SSE events of a chat's stream. */
async function streamOf(u: User, id: string) {
  const res = await request(app).get(`/api/tmcode/ai/chat/${id}/stream`).set("Authorization", tok(u)).buffer(true).parse((r, cb) => {
    let text = "";
    r.setEncoding("utf8");
    r.on("data", (c: string) => (text += c));
    r.on("end", () => cb(null, text));
  });
  const events: { event: string; data: any }[] = [];
  for (const block of String(res.body).split("\n\n")) {
    const ev = block.match(/^event: (.+)$/m)?.[1];
    const data = block.match(/^data: (.+)$/m)?.[1];
    if (ev && data) events.push({ event: ev, data: JSON.parse(data) });
  }
  return events;
}

beforeAll(async () => {
  await ensureModelsRegistered();
  app = buildTestApp();
  teacher = await findSeededUserByRole("instructor");
  student = await findSeededUserByRole("student");
});

beforeEach(() => {
  setAiPolicyForTests(ON);
  resetAllowances();
  jest.spyOn(reminders, "syncAssignment").mockResolvedValue(undefined as any);
});

afterEach(() => {
  jest.restoreAllMocks();
  delete process.env.TMCODE_LAYER_SIGNING_KEY;
  resetSigningKey();
});

afterAll(async () => {
  resetAiPolicyCache();
  if (projectIds.length) await Project.destroy({ where: { id: projectIds } });
  if (assignmentIds.length) await Assignment.destroy({ where: { id: assignmentIds } });
  await sequelize.close();
});

describe("/api/tmcode/ai/status names the layer", () => {
  it("hints → Learning: the tutor on, suggestions off, the teacher's knobs and the allowance", async () => {
    const a = await makeAssignment("hints", { ai_help: { strength: "hints", pseudo: false, allowance: { max: 4, regain_minutes: 2 } } });
    const res = await status(student, (await projectFor(a)).id);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      allowed: true,
      layer: "learning",
      mode: "hints",
      features: { assist: true, complete: false },
      thirdPartyExtensions: false,
      own_tools: false,
      learning: { strength: "hints", pseudo: false, syntax: false, allowance: { max: 4, regain_minutes: 2, left: 4, next_in_s: null } },
    });
  });

  it("full → Industrial; the teacher's own-tools toggle opens third-party tools (Industrial · Open)", async () => {
    const guided = await status(student, (await projectFor(await makeAssignment("full"))).id);
    expect(guided.body).toMatchObject({ layer: "industrial", own_tools: false, thirdPartyExtensions: false });
    const open = await status(student, (await projectFor(await makeAssignment("full", { ai_own_tools: true }))).id);
    expect(open.body).toMatchObject({ layer: "industrial", own_tools: true, thirdPartyExtensions: true });
  });

  it("off → exam (no AI)", async () => {
    const res = await status(student, (await projectFor(await makeAssignment("off"))).id);
    expect(res.body).toMatchObject({ allowed: false, layer: "exam", reason: "TEACHER_OFF" });
  });

  it("signs the project's layer when a key is set (A9), and only for an item's project", async () => {
    const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
    process.env.TMCODE_LAYER_SIGNING_KEY = privateKey.export({ format: "der", type: "pkcs8" }).toString("base64");
    resetSigningKey();
    const p = await projectFor(await makeAssignment("hints"));
    const t = (await status(student, p.id)).body.layer_token;
    expect(crypto.verify(null, Buffer.from(t.claims, "ascii"), publicKey, Buffer.from(t.sig, "base64url"))).toBe(true);
    expect(JSON.parse(Buffer.from(t.claims, "base64url").toString())).toMatchObject({ project_id: p.id, ai_mode: "hints" });
    expect((await request(app).get("/api/tmcode/ai/status").set("Authorization", tok(teacher))).body.layer_token).toBeNull();
  });
});

describe("a Learning chat", () => {
  it("gets the tutor prompt and read-only tools, and its answer passes the filter", async () => {
    const seen: { messages: any[]; tools: string[] }[] = [];
    jest.spyOn(aiService, "streamChat").mockImplementation(async (_u, _m, messages, onMeta, onDelta, _s, agent) => {
      seen.push({ messages, tools: (agent?.tools ?? []).map((t) => t.function.name) });
      onMeta({ provider: "groq", model: "m", tier: "free" } as any);
      for (const piece of ["Try this:\n```py", "thon\nbiggest = n\n", "```\nWhat does `biggest` hold", " after the loop?"]) onDelta(piece);
      return { provider: "groq", model: "m", tier: "free", tool_calls: [{ id: "1", type: "function", function: { name: "write_file", arguments: "{}" } }] } as any;
    });
    const p = await projectFor(await makeAssignment("hints"));
    const tools = ["list_files", "read_file", "edit_file", "write_file", "run_command"].map((name) => ({ type: "function", function: { name } }));
    const asked = await ask(student, { project_id: p.id, agent: { mode: "auto", step: 0, tools }, context: { fileText: "biggest = numbers[0]" } });
    expect(asked.status).toBe(201);
    const events = await streamOf(student, asked.body.id);
    expect(seen[0].tools).toEqual(["list_files", "read_file"]);
    expect(seen[0].messages[0].content).toMatch(/LEARNING layer/);
    const shown = events.filter((e) => e.event === "delta").map((e) => e.data.text).join("");
    expect(shown).not.toMatch(/biggest = n/);
    expect(shown).toMatch(/TMCode removed 1 line of code/);
    expect(shown).toMatch(/What does `biggest` hold after the loop\?/);
    const done = events.find((e) => e.event === "done")!.data;
    expect(done).toMatchObject({ layer: "learning", filtered: { removed: 1 } });
    expect(done.tool_calls).toBeUndefined();
  });

  it("an Industrial chat is not filtered", async () => {
    jest.spyOn(aiService, "streamChat").mockImplementation(async (_u, _m, _msgs, _meta, onDelta) => {
      onDelta("```py\nbiggest = n\n```");
      return { provider: "groq", model: "m", tier: "free" } as any;
    });
    const p = await projectFor(await makeAssignment("full"));
    const asked = await ask(student, { project_id: p.id });
    const events = await streamOf(student, asked.body.id);
    expect(events.filter((e) => e.event === "delta").map((e) => e.data.text).join("")).toContain("biggest = n");
  });

  it("spends the item's allowance: 429 LEARNING_ALLOWANCE when it runs out; agent steps don't spend", async () => {
    const p = await projectFor(await makeAssignment("hints", { ai_help: { allowance: { max: 2, regain_minutes: 5 } } }));
    expect((await ask(student, { project_id: p.id })).status).toBe(201);
    expect((await ask(student, { project_id: p.id, agent: { mode: "manual", step: 1, tools: [] } })).status).toBe(201);
    expect((await ask(student, { project_id: p.id })).status).toBe(201);
    const out = await ask(student, { project_id: p.id });
    expect(out.status).toBe(429);
    expect(out.body).toMatchObject({ code: "LEARNING_ALLOWANCE", allowance: { left: 0, max: 2 } });
    expect(out.body.message).toMatch(/comes back in/);
  });
});

describe("saving the Learning knobs and the own-tools toggle", () => {
  it("PUT /api/assignments/:id stores ai_help (normalised) and ai_own_tools from a form", async () => {
    const a = await makeAssignment("hints");
    const res = await request(app)
      .put(`/api/assignments/${a.id}`)
      .set("Authorization", tok(teacher))
      .field("ai_help", JSON.stringify({ strength: "hints", allowance: { max: 999 } }))
      .field("ai_own_tools", "true");
    expect(res.status).toBe(200);
    await a.reload();
    expect(a.ai_help).toEqual({ strength: "hints", pseudo: true, syntax: false, allowance: { max: 100, regain_minutes: 3 } });
    expect(a.ai_own_tools).toBe(true);
  });
});

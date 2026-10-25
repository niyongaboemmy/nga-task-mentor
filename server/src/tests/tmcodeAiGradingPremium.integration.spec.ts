/**
 * Premium AI, own keys (BYOK), the staff switch and AI grading drafts against the dev DB
 * (GRADING_PREMIUM_CONTRACTS.md). Every AI provider is mocked (no real calls).
 */
const create = jest.fn();
const OpenAIMock = jest.fn().mockImplementation(() => ({ chat: { completions: { create } } }));
jest.mock("openai", () => OpenAIMock);

import crypto from "crypto";
import zlib from "zlib";
import request from "supertest";
import { buildTestApp, ensureModelsRegistered, findSeededUserByRole, signTokenFor } from "./testApp";
import { sequelize } from "../config/database";
import { AiEntitlement, AppSetting, Assignment, Project, ProjectActivityLink, ProjectBlob, ProjectRevision, Submission, User } from "../models";
import { resetAiPolicyCache, setAiPolicyForTests } from "../services/aiPolicy";
import { BYOK_SETTING, resetByokCacheForTests } from "../services/aiEntitlements";
import { resetAiUsage } from "../tmcode/ai/service";
import * as aiLive from "../services/aiLive";
import * as reminders from "../services/reminderSync";
import { AI_POLICY_DEFAULT, type AiPolicy } from "../vendor/nga-access";

jest.setTimeout(30_000);
const COURSE_ID = 4251;
const ON: AiPolicy = { ...AI_POLICY_DEFAULT, v: 9, enabled: true, thirdPartyExtensions: false, thirdPartyExtensionsStaff: true };
const KEY = "sk-ant-user-integration-0123456789abcdef";
const SCHOOL_KEY = "sk-school-openai-0123456789abcdef";

let app: ReturnType<typeof buildTestApp>;
let admin: User;
let teacher: User;
let student: User;
const tok = (u: User) => `Bearer ${signTokenFor(u.id)}`;
const env = { ...process.env };
const assignmentIds: number[] = [];
const projectIds: number[] = [];
const blobShas: string[] = [];
let entitlementBefore: AiEntitlement | null = null;
let byokSettingBefore: AppSetting | null = null;

async function* chunks(list: unknown[]) {
  for (const c of list) yield c;
}
const answer = (model: string, text: string) => chunks([{ model, choices: [{ delta: { content: text } }] }]);

/** SSE events of a finished stream. */
function events(text: string) {
  return text
    .split("\n\n")
    .filter((b) => b.startsWith("event:"))
    .map((b) => {
      const [e, d] = b.split("\n");
      return { event: e.slice(7), data: JSON.parse(d.slice(6)) };
    });
}

async function chatAndStream(u: User, body: Record<string, unknown>) {
  const res = await request(app).post("/api/tmcode/ai/chat").set("Authorization", tok(u)).send({ messages: [{ role: "user", content: "hi" }], ...body });
  if (res.status !== 201) return { res, stream: null };
  const stream = await request(app).get(`/api/tmcode/ai/chat/${res.body.id}/stream`).set("Authorization", tok(u));
  return { res, stream };
}

beforeAll(async () => {
  await ensureModelsRegistered();
  app = buildTestApp();
  admin = await findSeededUserByRole("admin");
  teacher = await findSeededUserByRole("instructor");
  student = await findSeededUserByRole("student");
  entitlementBefore = await AiEntitlement.findByPk(teacher.id);
  byokSettingBefore = await AppSetting.findByPk(BYOK_SETTING);
  await AiEntitlement.destroy({ where: { user_id: teacher.id } });
  await AppSetting.destroy({ where: { key: BYOK_SETTING } });
});

beforeEach(() => {
  setAiPolicyForTests(ON);
  resetAiUsage();
  resetByokCacheForTests();
  create.mockReset();
  OpenAIMock.mockClear();
  process.env = {
    ...env,
    OPENROUTER_API_KEY: "or",
    GROQ_API_KEY: "gq",
    GEMINI_API_KEY: "",
    GLM_API_KEY: "",
    TMCODE_AI_PREMIUM_MODELS: "openai/gpt-4.1",
    TMCODE_AI_PREMIUM_OPENAI_KEY: SCHOOL_KEY,
  };
  global.fetch = jest.fn(async () => ({ json: async () => ({ data: { free_model_daily_requests: { used: 4, limit: 50, remaining: 46 } } }) })) as never;
  jest.spyOn(reminders, "syncAssignment").mockResolvedValue(undefined as any);
});
afterEach(() => jest.restoreAllMocks());

afterAll(async () => {
  process.env = env;
  resetAiPolicyCache();
  await AiEntitlement.destroy({ where: { user_id: teacher.id } });
  if (entitlementBefore) await AiEntitlement.create(entitlementBefore.get({ plain: true }) as any);
  await AppSetting.destroy({ where: { key: BYOK_SETTING } });
  if (byokSettingBefore) await AppSetting.create(byokSettingBefore.get({ plain: true }) as any);
  if (projectIds.length) {
    await ProjectActivityLink.destroy({ where: { project_id: projectIds } });
    await ProjectRevision.destroy({ where: { project_id: projectIds } });
    await Project.destroy({ where: { id: projectIds } });
  }
  if (blobShas.length) await ProjectBlob.destroy({ where: { sha256: blobShas } });
  if (assignmentIds.length) {
    await Submission.destroy({ where: { assignment_id: assignmentIds } });
    await Assignment.destroy({ where: { id: assignmentIds } });
  }
  await sequelize.close();
});

describe("GET /api/tmcode/ai/status: staff switch and tiers", () => {
  it("a teacher is staff: the staff switch decides third-party tools; tiers and BYOK providers listed", async () => {
    const res = await request(app).get("/api/tmcode/ai/status").set("Authorization", tok(teacher));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ allowed: true, staff: true, thirdPartyExtensions: true, tiers: { free: true, premium: false, byok: true }, premium_models: [], premium_you: null });
    expect(res.body.byok_providers.map((p: any) => p.id)).toEqual(["openai", "anthropic", "gemini", "openrouter", "groq", "deepseek"]);
    expect(res.body.byok_providers[0].suggested_models.length).toBeGreaterThan(0);

    setAiPolicyForTests({ ...ON, thirdPartyExtensionsStaff: false, thirdPartyExtensions: true });
    const off = await request(app).get("/api/tmcode/ai/status").set("Authorization", tok(teacher));
    expect(off.body).toMatchObject({ staff: true, thirdPartyExtensions: false });
  });

  it("a student is not staff: the students' switch decides", async () => {
    const res = await request(app).get("/api/tmcode/ai/status").set("Authorization", tok(student));
    expect(res.body).toMatchObject({ staff: false, thirdPartyExtensions: false });
    // (no AI_USE outside an item: assist is refused, so the switch can't turn it on either)
    setAiPolicyForTests({ ...ON, thirdPartyExtensions: true, thirdPartyExtensionsStaff: false });
    const again = await request(app).get("/api/tmcode/ai/status").set("Authorization", tok(student));
    expect(again.body.staff).toBe(false);
    expect(again.body.thirdPartyExtensions).toBe(again.body.allowed);
  });
});

describe("premium", () => {
  it("is refused without an entitlement, then allowed once the admin grants it", async () => {
    const before = await chatAndStream(teacher, { mode: "premium:openai/gpt-4.1" });
    expect(before.res.status).toBe(403);
    expect(before.res.body).toMatchObject({ code: "PREMIUM_REQUIRED" });

    const publish = jest.spyOn(aiLive, "publishAiChange");
    const grant = await request(app).put(`/api/admin/ai/entitlements/${teacher.id}`).set("Authorization", tok(admin)).send({ daily_limit: 2, note: "grading pilot" });
    expect(grant.status).toBe(200);
    expect(grant.body.data.user).toMatchObject({ user_id: teacher.id, premium: true, entitled: true, via: "grant", daily_limit: 2, effective_limit: 2, note: "grading pilot", granted_by: { id: admin.id } });
    expect(publish).toHaveBeenCalledWith({ cause: "access" });

    const status = await request(app).get("/api/tmcode/ai/status").set("Authorization", tok(teacher));
    expect(status.body).toMatchObject({ tiers: { premium: true }, premium_you: { used: 0, limit: 2 } });
    expect(status.body.premium_models).toEqual([{ id: "premium:openai/gpt-4.1", label: "gpt-4.1", provider: "openai", providerLabel: "OpenAI" }]);

    create.mockResolvedValueOnce(answer("gpt-4.1", "Premium answer"));
    const after = await chatAndStream(teacher, { mode: "premium:openai/gpt-4.1" });
    expect(after.res.status).toBe(201);
    const ev = events(after.stream!.text);
    expect(ev.find((e) => e.event === "meta")!.data).toEqual({ provider: "openai", model: "gpt-4.1", tier: "premium" });
    expect(ev.find((e) => e.event === "done")!.data).toMatchObject({ tier: "premium", premium_you: { used: 1, limit: 2 } });
    expect(OpenAIMock).toHaveBeenLastCalledWith(expect.objectContaining({ apiKey: SCHOOL_KEY, baseURL: "https://api.openai.com/v1" }));
    expect(create.mock.calls[0][0]).toMatchObject({ model: "gpt-4.1", stream: true });

    const list = await request(app).get("/api/admin/ai/entitlements").set("Authorization", tok(admin));
    expect(list.status).toBe(200);
    expect(list.body.data.users.find((u: any) => u.user_id === teacher.id)).toMatchObject({ used_today: 1 });

    const revoke = await request(app).delete(`/api/admin/ai/entitlements/${teacher.id}`).set("Authorization", tok(admin));
    expect(revoke.body.data).toMatchObject({ ok: true, removed: true });
    expect((await chatAndStream(teacher, { mode: "premium:openai/gpt-4.1" })).res.body.code).toBe("PREMIUM_REQUIRED");
  });
});

describe("BYOK", () => {
  it("reaches the provider with the user's key; the key is never echoed or logged", async () => {
    const logs = [jest.spyOn(console, "error"), jest.spyOn(console, "log"), jest.spyOn(console, "warn")].map((s) => s.mockImplementation(() => {}));
    create.mockResolvedValueOnce(answer("claude-sonnet-4-5", "Own key answer"));
    const ok = await chatAndStream(teacher, { mode: "byok:anthropic/claude-sonnet-4-5", byok: { provider: "anthropic", key: KEY } });
    expect(ok.res.status).toBe(201);
    expect(JSON.stringify(ok.res.body)).not.toContain(KEY);
    expect(ok.stream!.text).not.toContain(KEY);
    expect(events(ok.stream!.text).find((e) => e.event === "done")!.data).toMatchObject({ provider: "anthropic", tier: "byok" });
    expect(OpenAIMock).toHaveBeenLastCalledWith(expect.objectContaining({ apiKey: KEY, baseURL: "https://api.anthropic.com/v1/" }));

    create.mockRejectedValueOnce(Object.assign(new Error(`401 invalid x-api-key: ${KEY}`), { status: 401 }));
    const bad = await chatAndStream(teacher, { mode: "byok:anthropic/claude-sonnet-4-5", byok: { provider: "anthropic", key: KEY } });
    const err = events(bad.stream!.text).find((e) => e.event === "error")!.data;
    expect(err.code).toBe("BYOK_REJECTED");
    expect(bad.stream!.text).not.toContain(KEY);
    for (const spy of logs) for (const call of spy.mock.calls) expect(JSON.stringify(call)).not.toContain(KEY);

    const noKey = await chatAndStream(teacher, { mode: "byok:anthropic/claude-sonnet-4-5" });
    expect(noKey.res.status).toBe(400);
    expect(noKey.res.body.code).toBe("BYOK_KEY_REQUIRED");
  });

  it("the school can switch own keys off (admin setting)", async () => {
    const off = await request(app).put("/api/admin/ai/settings").set("Authorization", tok(admin)).send({ allow_byok: false });
    expect(off.status).toBe(200);
    expect(off.body.data).toMatchObject({ allow_byok: false, premium_models: [{ id: "premium:openai/gpt-4.1" }] });
    const refused = await chatAndStream(teacher, { mode: "byok:openai/gpt-4.1", byok: { provider: "openai", key: KEY } });
    expect(refused.res.status).toBe(403);
    expect(refused.res.body.code).toBe("BYOK_DISABLED");
    expect((await request(app).get("/api/tmcode/ai/status").set("Authorization", tok(teacher))).body.tiers.byok).toBe(false);
    const on = await request(app).put("/api/admin/ai/settings").set("Authorization", tok(admin)).send({ allow_byok: true });
    expect(on.body.data.allow_byok).toBe(true);
  });
});

describe("admin endpoints", () => {
  it("need AI_SETTINGS_MANAGE", async () => {
    for (const u of [teacher, student]) {
      expect((await request(app).get("/api/admin/ai/settings").set("Authorization", tok(u))).status).toBe(403);
      expect((await request(app).put(`/api/admin/ai/entitlements/${u.id}`).set("Authorization", tok(u)).send({})).status).toBe(403);
    }
    expect((await request(app).get("/api/admin/ai/settings")).status).toBe(401);
    const res = await request(app).get("/api/admin/ai/settings").set("Authorization", tok(admin));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ allow_byok: true, premium_default_limit: 50 });
  });

  it("validate input and find people", async () => {
    expect((await request(app).put(`/api/admin/ai/entitlements/${teacher.id}`).set("Authorization", tok(admin)).send({ daily_limit: 0 })).status).toBe(400);
    expect((await request(app).put("/api/admin/ai/entitlements/999999999").set("Authorization", tok(admin)).send({})).status).toBe(404);
    expect((await request(app).put("/api/admin/ai/settings").set("Authorization", tok(admin)).send({ allow_byok: "yes" })).status).toBe(400);
    const found = await request(app).get(`/api/admin/ai/users?q=${encodeURIComponent(teacher.email.slice(0, 6))}`).set("Authorization", tok(admin));
    expect(found.status).toBe(200);
    expect(found.body.data.users.some((u: any) => u.id === teacher.id)).toBe(true);
  });
});

describe("POST /api/tmcode/grading/:type/:id/students/:sid/ai-draft", () => {
  async function setup() {
    const a = await Assignment.create({
      title: `AI draft spec ${crypto.randomBytes(3).toString("hex")}`,
      description: "<p>Build a page with a <strong>flex</strong> layout.</p>",
      due_date: new Date(Date.now() + 7 * 86_400_000),
      max_score: 7,
      submission_type: "project",
      course_id: COURSE_ID,
      created_by: teacher.id,
      status: "published",
      rubric: ([
        { criteria: "Layout", description: "Uses flexbox", max_score: 4 },
        { criteria: "Code quality", max_score: 3 },
      ]) as any,
    } as any);
    assignmentIds.push(a.id);
    const slug = `ai-draft-${crypto.randomBytes(5).toString("hex")}`;
    const p = await Project.create({ owner_id: student.id, name: slug, slug, language: "web", kind: "tm", assignment_id: a.id } as any);
    projectIds.push(p.id);
    const files = [
      { path: "index.html", text: "<div class=\"row\"><p>Hi</p></div>\n" },
      { path: "style.css", text: ".row { display: flex; }\n" },
      { path: "node_modules/x/index.js", text: "module.exports = 1;\n" },
    ];
    const manifest = [];
    for (const f of files) {
      const buf = Buffer.from(f.text + slug);
      const sha = crypto.createHash("sha256").update(buf).digest("hex");
      blobShas.push(sha);
      await ProjectBlob.create({ sha256: sha, size: buf.length, storage: "db", data_gz: zlib.gzipSync(buf) } as any);
      manifest.push({ path: f.path, sha256: sha, size: buf.length });
    }
    const rev = await ProjectRevision.create({ project_id: p.id, number: 1, author_id: student.id, manifest_gz: zlib.gzipSync(Buffer.from(JSON.stringify(manifest))), file_count: manifest.length, size_bytes: 100, source: "submit" } as any);
    await p.update({ head_revision_id: rev.id } as any);
    await ProjectActivityLink.create({ project_id: p.id, activity_type: "assignment", activity_id: a.id, linked_by: student.id, revision_id: rev.id, status: "submitted", submitted_at: new Date() } as any);
    return a;
  }

  it("returns a clamped draft from the mocked provider and saves nothing", async () => {
    const a = await setup();
    const json = JSON.stringify({
      rubric_scores: [
        { index: 0, score: 6, comment: "style.css:1 uses display:flex" },
        { index: 1, score: 2.3, comment: "index.html:1 is tidy" },
      ],
      score: 9,
      feedback: "You used flexbox well.",
      teacher_notes: "No tests were run.",
      confidence: "medium",
    });
    create.mockResolvedValueOnce(answer("groq-model", `Sure! \`\`\`json\n${json}\n\`\`\``));
    const res = await request(app)
      .post(`/api/tmcode/grading/assignment/${a.id}/students/${student.id}/ai-draft`)
      .set("Authorization", tok(teacher))
      .send({ mode: "auto", instructions: "Focus on the layout", tests: { passed: 2, failed: 1, total: 3, summary: "1 failing: header" } });
    expect(res.status).toBe(200);
    expect(res.body.draft).toMatchObject({
      rubric_scores: [
        { index: 0, score: 4, comment: "style.css:1 uses display:flex" },
        { index: 1, score: 2.5, comment: "index.html:1 is tidy" },
      ],
      score: null,
      feedback: "You used flexbox well.",
      teacher_notes: "No tests were run.",
      confidence: "medium",
      by: "TMCode AI · groq-model",
      model: "groq-model",
      tier: "free",
    });
    expect(Array.isArray(res.body.draft.warnings)).toBe(true);
    const prompt = create.mock.calls[0][0].messages.map((m: any) => m.content).join("\n");
    expect(prompt).toMatch(/Focus on the layout/);
    expect(prompt).toMatch(/2 passed, 1 failed, 3 in all/);
    expect(prompt).toMatch(/FILE style.css/);
    expect(prompt).not.toMatch(/node_modules/);
    expect(prompt).toMatch(/0\. Layout \(max 4\)/);
    // Nothing saved: no submission, the project still submitted.
    expect(await Submission.count({ where: { assignment_id: a.id } })).toBe(0);
    expect((await Project.findOne({ where: { assignment_id: a.id } }))!.status).not.toBe("graded");
  });

  it("refuses students, unusable answers, and premium without an entitlement", async () => {
    const a = await setup();
    const url = `/api/tmcode/grading/assignment/${a.id}/students/${student.id}/ai-draft`;
    expect((await request(app).post(url).set("Authorization", tok(student)).send({})).status).toBe(403);
    create.mockResolvedValueOnce(answer("m", "I can't grade this."));
    const bad = await request(app).post(url).set("Authorization", tok(teacher)).send({ mode: "auto" });
    expect(bad.status).toBe(502);
    expect(bad.body.code).toBe("AI_BAD_DRAFT");
    const premium = await request(app).post(url).set("Authorization", tok(teacher)).send({ mode: "premium:openai/gpt-4.1" });
    expect(premium.status).toBe(403);
    expect(premium.body.code).toBe("PREMIUM_REQUIRED");
    setAiPolicyForTests({ ...ON, enabled: false });
    const off = await request(app).post(url).set("Authorization", tok(teacher)).send({});
    expect(off.status).toBe(403);
    expect(off.body).toMatchObject({ code: "AI_DISABLED" });
  });
});

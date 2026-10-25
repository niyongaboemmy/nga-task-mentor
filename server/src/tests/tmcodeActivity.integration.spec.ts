import http from "http";
import crypto from "crypto";
import request from "supertest";
import { buildTestApp, ensureModelsRegistered, findSeededUserByRole, signTokenFor } from "./testApp";
import { Project, ProjectEvent, Role, User } from "../models";
import { sequelize } from "../config/database";

/**
 * TMCode's activity log on Task Mentor (tmcodeActivity.controller.ts): the owner uploads batches
 * (stored once per batch id), other students can't, the owner and admins read it with a summary
 * of AI use and pastes, and the batches stay out of the project's timeline.
 */

let app: http.Server;
let student: User;
let student2: User;
let admin: User;
const tok = (u: User) => `Bearer ${signTokenFor(u.id)}`;
const projectIds: number[] = [];

beforeAll(async () => {
  await ensureModelsRegistered();
  app = http.createServer(buildTestApp());
  await new Promise<void>((r) => app.listen(0, "127.0.0.1", () => r()));
  student = await findSeededUserByRole("student");
  admin = await findSeededUserByRole("admin");
  const studentRole = await Role.findOne({ where: { name: "student" } });
  student2 = (await User.findAll({ where: { role_id: studentRole!.id }, order: [["id", "ASC"]], limit: 2 }))[1];
  process.env.PROJECTS_MAX_PER_USER = "1000";
});

afterAll(async () => {
  if (projectIds.length) {
    await ProjectEvent.destroy({ where: { project_id: projectIds } });
    await Project.destroy({ where: { id: projectIds } });
  }
  await new Promise((r) => app.close(r));
  await sequelize.close();
});

const t0 = Date.UTC(2026, 9, 14, 8, 0, 0);
const events = [
  { t: t0, kind: "file", action: "create", path: "app.js", text: "Created file app.js", actor: { type: "you" } },
  { t: t0 + 1000, kind: "clipboard", action: "paste", path: "app.js", text: "Pasted 3 lines into app.js (from outside TMCode)", data: { origin: "outside", chars: 40 }, actor: { type: "you" } },
  { t: t0 + 2000, kind: "ai", action: "chat", text: 'Asked TMCode AI: "Find the bug"', actor: { type: "you" }, ai: { by: "TMCode AI", how: "question asked in the chat" } },
  { t: t0 + 3000, kind: "ai", action: "suggestion", path: "app.js", text: "Accepted a suggestion from Claude Code (1 line, 6 characters)", data: { chars: 6 }, actor: { type: "extension", id: "anthropic.claude-code", name: "Claude Code", ai: true }, ai: { by: "Claude Code", how: "inline suggestion accepted" } },
  { t: t0 + 4000, kind: "clipboard", action: "paste", path: "app.js", text: "Pasted 2 lines into app.js (from TMCode AI's answer)", data: { origin: "ai" }, actor: { type: "you" }, ai: { by: "TMCode AI", how: "pasted text copied from the AI's answer" } },
];

it("the owner uploads activity once per batch; others can't; the log reads back with an AI summary", async () => {
  const create = await request(app).post("/api/tmcode/projects").set("Authorization", tok(student)).send({ name: `Act ${crypto.randomBytes(4).toString("hex")}`, language: "javascript" });
  expect(create.status).toBe(201);
  const id = create.body.project.id;
  projectIds.push(id);

  const batch = crypto.randomUUID();
  const up = await request(app).post(`/api/tmcode/projects/${id}/activity`).set("Authorization", tok(student)).send({ batch, events });
  expect(up.status).toBe(201);
  // A retry of the same batch is stored once.
  expect((await request(app).post(`/api/tmcode/projects/${id}/activity`).set("Authorization", tok(student)).send({ batch, events })).status).toBe(201);
  // Another student can't write to it (nor see it).
  expect((await request(app).post(`/api/tmcode/projects/${id}/activity`).set("Authorization", tok(student2)).send({ batch: crypto.randomUUID(), events })).status).toBe(404);
  // Invalid events are refused.
  expect((await request(app).post(`/api/tmcode/projects/${id}/activity`).set("Authorization", tok(student)).send({ batch: crypto.randomUUID(), events: [{ t: 1, kind: "nope" }] })).status).toBe(400);

  for (const who of [student, admin]) {
    const res = await request(app).get(`/api/tmcode/projects/${id}/activity`).set("Authorization", tok(who));
    expect(res.status).toBe(200);
    expect(res.body.events).toHaveLength(5);
    expect(res.body.events[0].text).toContain("from TMCode AI's answer");
    expect(res.body.summary).toMatchObject({ total: 5, ai_events: 3, pastes_outside: 1, pastes_from_ai: 1, ai_chars: 6 });
    expect(res.body.summary.ai_tools).toEqual([
      { by: "TMCode AI", count: 2 },
      { by: "Claude Code", count: 1 },
    ]);
  }

  // The batches never show in the project's timeline.
  const detail = await request(app).get(`/api/tmcode/projects/${id}`).set("Authorization", tok(student));
  expect(detail.status).toBe(200);
  expect(JSON.stringify(detail.body)).not.toContain('"type":"activity"');
});

it("the summary covers the whole log, not just the page of events shown", async () => {
  const create = await request(app).post("/api/tmcode/projects").set("Authorization", tok(student)).send({ name: `Act ${crypto.randomBytes(4).toString("hex")}`, language: "javascript" });
  const id = create.body.project.id;
  projectIds.push(id);
  // 205 batches of one copy each: more than the 200 batches one page reads.
  for (let i = 0; i < 205; i++) {
    const r = await request(app)
      .post(`/api/tmcode/projects/${id}/activity`)
      .set("Authorization", tok(student))
      .send({ batch: crypto.randomUUID(), events: [{ t: t0 + i, kind: "clipboard", action: "copy", text: "Copied 1 line in app.js", data: { chars: 5 }, actor: { type: "you" } }] });
    expect(r.status).toBe(201);
  }
  const res = await request(app).get(`/api/tmcode/projects/${id}/activity`).set("Authorization", tok(admin));
  expect(res.status).toBe(200);
  expect(res.body.events).toHaveLength(200);
  expect(res.body.next_before).not.toBeNull();
  expect(res.body.summary).toMatchObject({ total: 205, copies: 205 });
  const older = await request(app).get(`/api/tmcode/projects/${id}/activity`).query({ before: res.body.next_before }).set("Authorization", tok(admin));
  expect(older.body.events).toHaveLength(5);
  expect(older.body.summary.copies).toBe(205);
}, 60_000);

import http from "http";
import zlib from "zlib";
import crypto from "crypto";
import request from "supertest";
import { buildTestApp, ensureModelsRegistered, findSeededUserByRole, signTokenFor } from "./testApp";
import { sequelize } from "../config/database";
import {
  Assignment,
  AssignmentTmcode,
  Project,
  ProjectActivityLink,
  ProjectBlob,
  ProjectEvent,
  ProjectMember,
  ProjectPresence,
  ProjectRevision,
  Role,
  User,
} from "../models";
import * as scoped from "../utils/scopedSubjects";
import * as mis from "../utils/misUtils";
import { projectsBus } from "../tmcode/projects/bus";
import { resetPresenceTracking } from "../tmcode/projects/presence";
import { workState } from "../tmcode/assignments/state";

/**
 * TMCode practicals (ASSIGNMENTS_PLAN.md "API") against the dev DB: the
 * teacher's TMCode settings, the idempotent Start seeded from starter files,
 * enrolment and teaching scopes, read-only completed assignments, the
 * workspaces view and share_presence. MIS is stubbed (getScopedSubjects,
 * the roster, the term).
 */

const COURSE_ID = 4247;
const OTHER_COURSE = 999_992;
const ENV = { ...process.env };
jest.setTimeout(20_000);

let app: http.Server;
let student: User;
let student2: User;
let teacher: User;
const tok = (u: User) => `Bearer ${signTokenFor(u.id)}`;

const projectIds = new Set<number>();
const blobShas = new Set<string>();
const assignmentIds: number[] = [];
const scopes = new Map<number, { scope: any; subjects: Array<{ id: number; name: string; code: null }> }>();
const programming = [{ id: COURSE_ID, name: "Programming", code: null }];

const blob = (content: string) => {
  const raw = Buffer.from(content);
  const sha = crypto.createHash("sha256").update(raw).digest("hex");
  blobShas.add(sha);
  return { raw, sha, gz: zlib.gzipSync(raw), size: raw.length };
};
const unique = (label: string) => `${label} ${Date.now()} ${crypto.randomBytes(4).toString("hex")}`;

async function createProject(u: User, body: Record<string, unknown> = {}) {
  const res = await request(app)
    .post("/api/tmcode/projects")
    .set("Authorization", tok(u))
    .send({ name: unique("Proj"), language: "python", ...body });
  expect(res.status).toBe(201);
  projectIds.add(res.body.project.id);
  return res.body.project;
}

async function saveFiles(u: User, projectId: number, base: number | null, files: Array<{ path: string; b: ReturnType<typeof blob> }>) {
  for (const f of files) {
    const up = await request(app)
      .put(`/api/tmcode/projects/${projectId}/blobs/${f.b.sha}`)
      .set("Authorization", tok(u))
      .set("Content-Type", "application/gzip")
      .send(f.b.gz);
    expect([200, 201]).toContain(up.status);
  }
  return request(app)
    .post(`/api/tmcode/projects/${projectId}/revisions`)
    .set("Authorization", tok(u))
    .send({ base_revision_id: base, message: "save", files: files.map((f) => ({ path: f.path, sha256: f.b.sha, size: f.b.size })) });
}

async function createAssignment(extra: Record<string, unknown> = {}) {
  const a = await Assignment.create({
    title: unique("Practical"),
    description: "<p>Write <b>fizzbuzz</b></p>",
    due_date: new Date(Date.now() + 7 * 86_400_000),
    max_score: 20,
    submission_type: "both",
    course_id: COURSE_ID,
    created_by: teacher.id,
    status: "published",
    ...extra,
  } as any);
  assignmentIds.push(a.id);
  return a;
}

const start = (u: User, id: number) =>
  request(app).post(`/api/tmcode/assignments/${id}/start`).set("Authorization", tok(u));

beforeAll(async () => {
  await ensureModelsRegistered();
  app = http.createServer(buildTestApp());
  await new Promise<void>((r) => app.listen(0, "127.0.0.1", () => r()));
  student = await findSeededUserByRole("student");
  teacher = await findSeededUserByRole("instructor");
  const studentRole = await Role.findOne({ where: { name: "student" } });
  student2 = (await User.findAll({ where: { role_id: studentRole!.id }, order: [["id", "ASC"]], limit: 2 }))[1];
  expect(student2).toBeDefined();
  process.env.PROJECTS_MAX_PER_USER = "1000";
});

beforeEach(() => {
  jest.spyOn(scoped, "getScopedSubjects").mockImplementation(async (req: any) => {
    return scopes.get(Number(req.user?.id)) ?? { scope: "none", subjects: [] };
  });
  jest.spyOn(mis, "getCurrentTermId").mockResolvedValue(null);
  jest.spyOn(mis, "fetchEnrolledStudents").mockImplementation(async () => [
    { id: student.mis_user_id, first_name: student.first_name, last_name: student.last_name, email: student.email },
    { id: student2.mis_user_id, first_name: student2.first_name, last_name: student2.last_name, email: student2.email },
    { id: 777_000_001, first_name: "Never", last_name: "Signed-in", email: "never@test.nga" },
  ]);
  scopes.set(student.id, { scope: "enrolled", subjects: programming });
  scopes.set(student2.id, { scope: "enrolled", subjects: programming });
  scopes.set(teacher.id, { scope: "assigned", subjects: programming });
});

afterEach(() => {
  jest.restoreAllMocks();
  resetPresenceTracking();
  process.env = { ...ENV, PROJECTS_MAX_PER_USER: "1000" };
});

afterAll(async () => {
  process.env = ENV;
  projectsBus.clear();
  // Workspaces made by Start aren't returned by createProject.
  if (assignmentIds.length) {
    (await Project.findAll({ where: { assignment_id: assignmentIds }, attributes: ["id"] })).forEach((p) => projectIds.add(p.id));
  }
  const ids = [...projectIds];
  if (ids.length) {
    const where = { project_id: ids };
    await ProjectEvent.destroy({ where });
    await ProjectActivityLink.destroy({ where });
    await ProjectPresence.destroy({ where });
    await ProjectMember.destroy({ where });
    await ProjectRevision.destroy({ where });
    await Project.destroy({ where: { id: ids } });
  }
  if (blobShas.size) await ProjectBlob.destroy({ where: { sha256: [...blobShas] } });
  if (assignmentIds.length) {
    await sequelize.query("DELETE FROM submissions WHERE assignment_id IN (?)", { replacements: [assignmentIds] });
    await Assignment.destroy({ where: { id: assignmentIds } });
  }
  await new Promise((r) => app.close(r));
  await sequelize.close();
});

describe("workState", () => {
  it("maps workspace, link and submission to one state", () => {
    expect(workState({})).toBe("not_started");
    expect(workState({ project: { id: 1 } })).toBe("in_progress");
    expect(workState({ project: { id: 1 }, link: { status: "linked" } })).toBe("in_progress");
    expect(workState({ project: { id: 1 }, link: { status: "submitted" } })).toBe("submitted");
    expect(workState({ submission: { status: "resubmitted" } })).toBe("submitted");
    expect(workState({ submission: { status: "draft" } })).toBe("not_started");
    expect(workState({ link: { status: "submitted" }, submission: { status: "graded", grade: "18" } })).toBe("graded");
  });
});

describe("TMCode practicals", () => {
  let starter: any;
  let starterRev: any;
  let practical: Assignment;
  const main = blob(`print("starter") # ${Date.now()}`);
  const readme = blob(`# Brief ${Date.now()}`);

  beforeAll(async () => {
    // jest.spyOn in beforeEach isn't active yet in beforeAll.
    const spy = jest.spyOn(scoped, "getScopedSubjects").mockResolvedValue({ scope: "assigned", subjects: programming } as any);
    starter = await createProject(teacher, { name: unique("Starter") });
    const saved = await saveFiles(teacher, starter.id, null, [
      { path: "main.py", b: main },
      { path: "README.md", b: readme },
    ]);
    expect(saved.status).toBe(201);
    starterRev = saved.body.revision;
    practical = await createAssignment();
    spy.mockRestore();
  });

  it("lets the creator turn TMCode on with a starter, and refuses others", async () => {
    const put = (u: User, body: object) =>
      request(app).put(`/api/tmcode/assignments/${practical.id}/tmcode`).set("Authorization", tok(u)).send(body);

    const bad = await put(teacher, { kind: "practical", starter_project_id: 999_999_999 });
    expect(bad.status).toBe(422);
    expect(bad.body.error_code).toBe("STARTER_NOT_FOUND");

    const studentTry = await put(student, { kind: "practical" });
    expect(studentTry.status).toBe(403);

    const res = await put(teacher, {
      kind: "practical",
      language: "python",
      starter_project_id: starter.id,
      starter_revision_id: null,
      instructions: "Run main.py first.",
    });
    expect(res.status).toBe(200);
    expect(res.body.assignment).toMatchObject({
      id: practical.id,
      kind: "practical",
      language: "python",
      status: "published",
      points: 20,
      read_only: false,
      instructions: "Run main.py first.",
      my: null,
      starter: { project_id: starter.id, revision_id: starterRev.id, file_count: 2 },
      teaching: { started: 0, submitted: 0, graded: 0 },
    });
    expect((await Assignment.findByPk(practical.id))!.submission_type).toBe("project");

    // The web form reads the settings back from GET /api/assignments/:id.
    const web = await request(app).get(`/api/assignments/${practical.id}`).set("Authorization", tok(teacher));
    expect(web.body.data.tmcode).toMatchObject({ kind: "practical", starter_project_id: starter.id });
  });

  it("lists it for an enrolled student with my.state not_started, and the brief", async () => {
    const list = await request(app).get("/api/tmcode/assignments?scope=student").set("Authorization", tok(student));
    expect(list.status).toBe(200);
    const row = list.body.assignments.find((a: any) => a.id === practical.id);
    expect(row).toMatchObject({
      kind: "practical",
      course_id: COURSE_ID,
      course_name: "Programming",
      status: "published",
      late: false,
      read_only: false,
      my: { project_id: null, link_id: null, state: "not_started", grade: null, max_points: 20 },
    });
    expect(row.teaching).toBeUndefined();

    const one = await request(app).get(`/api/tmcode/assignments/${practical.id}`).set("Authorization", tok(student));
    expect(one.status).toBe(200);
    expect(one.body.assignment).toMatchObject({
      description_html: expect.stringContaining("fizzbuzz"),
      instructions: "Run main.py first.",
      starter: { file_count: 2 },
      attachments: [],
      rubric: [],
    });
  });

  it("keeps drafts and other courses out of the student's scope (403 NOT_ENROLLED)", async () => {
    const draft = await createAssignment({ status: "draft" });
    await AssignmentTmcode.update({ tmcode_kind: "case_study" }, { where: { id: draft.id } });
    const other = await createAssignment({ course_id: OTHER_COURSE });
    await AssignmentTmcode.update({ tmcode_kind: "practical" }, { where: { id: other.id } });

    const list = await request(app).get("/api/tmcode/assignments").set("Authorization", tok(student));
    const ids = list.body.assignments.map((a: any) => a.id);
    expect(ids).toContain(practical.id);
    expect(ids).not.toContain(draft.id);
    expect(ids).not.toContain(other.id);

    expect((await request(app).get(`/api/tmcode/assignments/${draft.id}`).set("Authorization", tok(student))).status).toBe(404);
    const outside = await request(app).get(`/api/tmcode/assignments/${other.id}`).set("Authorization", tok(student));
    expect(outside.status).toBe(403);
    expect(outside.body.error_code).toBe("NOT_ENROLLED");
    const startOutside = await start(student, other.id);
    expect(startOutside.status).toBe(403);
    expect(startOutside.body.error_code).toBe("NOT_ENROLLED");

    // Not enrolled anywhere -> nothing listed.
    scopes.set(student.id, { scope: "enrolled", subjects: [] });
    const none = await request(app).get("/api/tmcode/assignments").set("Authorization", tok(student));
    expect(none.body.assignments).toEqual([]);
  });

  it("starts once: seeds revision 1 from the starter and links it; later calls return the same project", async () => {
    const first = await start(student, practical.id);
    expect(first.status).toBe(201);
    expect(first.body.created).toBe(true);
    const p = first.body.project;
    expect(p).toMatchObject({
      kind: "tm",
      visibility: "course",
      language: "python",
      my_role: "owner",
      share_presence: true,
      read_only: false,
      file_count: 2,
      assignment: { id: practical.id, title: practical.title, status: "published", kind: "practical" },
      head: { number: 1, file_count: 2 },
      can: { save: true, share_presence: false },
    });
    expect(p.links).toEqual([expect.objectContaining({ activity_type: "assignment", activity_id: practical.id, status: "linked" })]);

    // Same files as the starter, and the student may pull its blobs.
    const manifest = await request(app).get(`/api/tmcode/projects/${p.id}/revisions/head/manifest`).set("Authorization", tok(student));
    expect(manifest.body.files.map((f: any) => [f.path, f.sha256])).toEqual([
      ["README.md", readme.sha],
      ["main.py", main.sha],
    ]);
    const got = await request(app).get(`/api/tmcode/projects/${p.id}/blobs/${main.sha}`).set("Authorization", tok(student));
    expect(got.status).toBe(200);

    const again = await start(student, practical.id);
    expect(again.status).toBe(200);
    expect(again.body.created).toBe(false);
    expect(again.body.project.id).toBe(p.id);
    expect(await Project.count({ where: { owner_id: student.id, assignment_id: practical.id } })).toBe(1);
    expect(await ProjectRevision.count({ where: { project_id: p.id } })).toBe(1);

    // The workspace shows on the projects list with its assignment badge.
    const list = await request(app).get("/api/tmcode/projects?scope=mine").set("Authorization", tok(student));
    expect(list.body.projects.find((x: any) => x.id === p.id)).toMatchObject({
      assignment: { id: practical.id, kind: "practical" },
      read_only: false,
      share_presence: true,
    });

    const link = await request(app).get(`/api/tmcode/assignments/${practical.id}/open-link`).set("Authorization", tok(student));
    expect(link.body.deeplink).toMatch(new RegExp(`^tmcode://assignment\\?id=${practical.id}&api=http`));

    const mine = await request(app).get(`/api/tmcode/assignments/${practical.id}`).set("Authorization", tok(student));
    expect(mine.body.assignment.my).toMatchObject({ project_id: p.id, link_id: p.links[0].id, state: "in_progress" });
  });

  it("locks Share live status on while the assignment is open", async () => {
    const ws = await Project.findOne({ where: { owner_id: student.id, assignment_id: practical.id } });
    const res = await request(app)
      .patch(`/api/tmcode/projects/${ws!.id}`)
      .set("Authorization", tok(student))
      .send({ share_presence: false });
    expect(res.status).toBe(409);
    expect(res.body.error_code).toBe("PRESENCE_LOCKED");
  });

  it("submits, then counts it for the teacher (teaching scope and workspaces)", async () => {
    const ws = (await Project.findOne({ where: { owner_id: student.id, assignment_id: practical.id } }))!;
    const edited = blob(`print("mine") # ${Date.now()}`);
    const saved = await saveFiles(student, ws.id, ws.head_revision_id!, [
      { path: "README.md", b: readme },
      { path: "main.py", b: edited },
    ]);
    expect(saved.status).toBe(201);
    const link = (await ProjectActivityLink.findOne({ where: { project_id: ws.id } }))!;
    const sub = await request(app)
      .post(`/api/tmcode/projects/${ws.id}/links/${link.id}/submit`)
      .set("Authorization", tok(student));
    expect(sub.status).toBe(200);

    const teaching = await request(app)
      .get("/api/tmcode/assignments?scope=teaching")
      .set("Authorization", tok(teacher))
      .set("X-MIS-Token", "mis.jwt");
    expect(teaching.status).toBe(200);
    const row = teaching.body.assignments.find((a: any) => a.id === practical.id);
    expect(row).toMatchObject({ my: null, teaching: { students: 3, started: 1, submitted: 1, graded: 0 } });

    const studentTeaching = await request(app).get("/api/tmcode/assignments?scope=teaching").set("Authorization", tok(student));
    expect(studentTeaching.status).toBe(403);

    // MIS token header: the roster comes from MIS.
    const ws2 = await request(app)
      .get(`/api/tmcode/assignments/${practical.id}/workspaces`)
      .set("Authorization", tok(teacher))
      .set("X-MIS-Token", "mis.jwt");
    expect(ws2.status).toBe(200);
    expect(ws2.body.counts).toMatchObject({ students: 3, started: 1, submitted: 1, graded: 0 });
    const mineRow = ws2.body.workspaces.find((w: any) => w.user.id === student.id);
    expect(mineRow).toMatchObject({
      project_id: ws.id,
      link_id: link.id,
      state: "submitted",
      revision_number: 2,
      presence: { shared: true, online: false },
      max_points: 20,
    });
    expect(mineRow.revision_id).toEqual(expect.any(Number));
    const never = ws2.body.workspaces.find((w: any) => w.user.mis_user_id === 777_000_001);
    expect(never).toMatchObject({ user: { id: null, name: "Never Signed-in" }, state: "not_started", project_id: null, presence: null });

    // The teacher reads the submitted revision.
    const file = await request(app)
      .get(`/api/tmcode/projects/${ws.id}/files/main.py?rev=${mineRow.revision_id}`)
      .set("Authorization", tok(teacher));
    expect(file.status).toBe(200);
    expect(file.text).toContain("mine");

    expect(
      (await request(app).get(`/api/tmcode/assignments/${practical.id}/workspaces`).set("Authorization", tok(student))).status,
    ).toBe(403);
  });

  it("makes a completed assignment read-only: no start, save or submit", async () => {
    await Assignment.update({ status: "completed" }, { where: { id: practical.id } });
    const ws = (await Project.findOne({ where: { owner_id: student.id, assignment_id: practical.id } }))!;

    const save = await saveFiles(student, ws.id, ws.head_revision_id!, [{ path: "late.py", b: blob(`late ${Date.now()}`) }]);
    expect(save.status).toBe(409);
    expect(save.body.error_code).toBe("ASSIGNMENT_READ_ONLY");

    const link = (await ProjectActivityLink.findOne({ where: { project_id: ws.id } }))!;
    const sub = await request(app).post(`/api/tmcode/projects/${ws.id}/links/${link.id}/submit`).set("Authorization", tok(student));
    expect(sub.status).toBe(409);
    expect(sub.body.error_code).toBe("ASSIGNMENT_COMPLETED");

    // Started before: Start still opens it (read-only); never started: refused.
    const again = await start(student, practical.id);
    expect(again.status).toBe(200);
    expect(again.body.project).toMatchObject({ read_only: true, can: { save: false }, assignment: { status: "completed" } });
    const late = await start(student2, practical.id);
    expect(late.status).toBe(409);
    expect(late.body.error_code).toBe("ASSIGNMENT_COMPLETED");

    const row = (await request(app).get("/api/tmcode/assignments").set("Authorization", tok(student))).body.assignments.find(
      (a: any) => a.id === practical.id,
    );
    expect(row).toMatchObject({ status: "completed", read_only: true, my: { state: "submitted" } });

    // Sharing may be turned off once the assignment is closed.
    const off = await request(app).patch(`/api/tmcode/projects/${ws.id}`).set("Authorization", tok(student)).send({ share_presence: false });
    expect(off.status).toBe(200);
    expect(off.body.project.share_presence).toBe(false);
  });
});

describe("share_presence", () => {
  let assignment: Assignment;
  beforeAll(async () => {
    assignment = await createAssignment({ submission_type: "project" });
  });

  async function openStream(path: string, u: User) {
    const port = (app.address() as any).port;
    const req = http.get({ host: "127.0.0.1", port, path, headers: { Authorization: tok(u) } });
    const res: http.IncomingMessage = await new Promise((resolve) => req.on("response", resolve));
    let text = "";
    res.setEncoding("utf8");
    res.on("data", (c: string) => (text += c));
    const waitFor = async (needle: string) => {
      const until = Date.now() + 5000;
      while (!text.includes(needle)) {
        if (Date.now() > until) throw new Error(`timed out waiting for ${needle}`);
        await new Promise((r) => setTimeout(r, 20));
      }
    };
    const close = async () => {
      req.destroy();
      await new Promise((r) => setTimeout(r, 100));
    };
    return { waitFor, close, text: () => text };
  }

  const beat = (u: User, projectId: number, device: string) =>
    request(app)
      .put(`/api/tmcode/projects/${projectId}/presence`)
      .set("Authorization", tok(u))
      .send({ device_id: device, state: { file: "a.py" } });

  it("hides presence from the monitor and teacher views, but keeps it for the owner", async () => {
    const shared = await createProject(student2);
    const hidden = await createProject(student);
    for (const [u, p] of [
      [student2, shared],
      [student, hidden],
    ] as const) {
      const link = await request(app)
        .post(`/api/tmcode/projects/${p.id}/links`)
        .set("Authorization", tok(u))
        .send({ activity_type: "assignment", activity_id: assignment.id });
      expect(link.status).toBe(201);
    }
    const off = await request(app).patch(`/api/tmcode/projects/${hidden.id}`).set("Authorization", tok(student)).send({ share_presence: false });
    expect(off.status).toBe(200);
    expect(off.body.project.share_presence).toBe(false);

    const s = await openStream("/api/tmcode/monitor/live", teacher);
    try {
      await s.waitFor("event: hello");
      const own = await beat(student, hidden.id, "private-dev");
      expect(own.status).toBe(200);
      expect(own.body.presence[0]).toMatchObject({ device_id: "private-dev", online: true });
      await beat(student2, shared.id, "public-dev");
      await s.waitFor('"device_id":"public-dev"');
      expect(s.text()).not.toContain("private-dev");
    } finally {
      await s.close();
    }

    // A new monitor's hello doesn't list it either.
    const s2 = await openStream("/api/tmcode/monitor/live", teacher);
    try {
      await s2.waitFor("event: hello");
      expect(s2.text()).toContain("public-dev");
      expect(s2.text()).not.toContain("private-dev");
    } finally {
      await s2.close();
    }

    const asTeacher = await request(app).get(`/api/tmcode/projects/${hidden.id}`).set("Authorization", tok(teacher));
    expect(asTeacher.status).toBe(200);
    expect(asTeacher.body.project.presence).toEqual([]);
    expect(asTeacher.body.project.presence_summary.online).toBe(false);
    const asOwner = await request(app).get(`/api/tmcode/projects/${hidden.id}`).set("Authorization", tok(student));
    expect(asOwner.body.project.presence_summary.online).toBe(true);

    const activity = await request(app)
      .get(`/api/tmcode/activities/assignment/${assignment.id}/projects`)
      .set("Authorization", tok(teacher));
    const hiddenRow = activity.body.projects.find((r: any) => r.project.id === hidden.id);
    expect(hiddenRow.project.share_presence).toBe(false);
    expect(hiddenRow.presence.online).toBe(false);
    expect(activity.body.projects.find((r: any) => r.project.id === shared.id).presence.online).toBe(true);

    await AssignmentTmcode.update({ tmcode_kind: "practical" }, { where: { id: assignment.id } });
    const ws = await request(app).get(`/api/tmcode/assignments/${assignment.id}/workspaces`).set("Authorization", tok(teacher));
    expect(ws.body.workspaces.find((w: any) => w.project_id === hidden.id).presence).toEqual({
      shared: false,
      online: false,
      devices_online: 0,
      last_seen_at: null,
      file: null,
      dirty: 0,
    });
    expect(ws.body.workspaces.find((w: any) => w.project_id === shared.id).presence).toMatchObject({ shared: true, online: true });
  });

  it("takes a live project off the monitors when sharing is turned off", async () => {
    const p = await createProject(student2);
    const other = await createAssignment({ submission_type: "project" });
    const link = await request(app)
      .post(`/api/tmcode/projects/${p.id}/links`)
      .set("Authorization", tok(student2))
      .send({ activity_type: "assignment", activity_id: other.id });
    expect(link.status).toBe(201);
    const s = await openStream("/api/tmcode/monitor/live", teacher);
    try {
      await s.waitFor("event: hello");
      await beat(student2, p.id, "going-private");
      await s.waitFor('"device_id":"going-private"');
      const off = await request(app).patch(`/api/tmcode/projects/${p.id}`).set("Authorization", tok(student2)).send({ share_presence: false });
      expect(off.status).toBe(200);
      await s.waitFor('"withdrawn":true');
    } finally {
      await s.close();
    }
  });
});

describe("the student's receipts: is_late, returns, withdrawing after the due date", () => {
  let a: Assignment;
  let wsId: number;
  let linkId: number;
  let head: number;
  const mine = async () =>
    (await request(app).get(`/api/tmcode/assignments/${a.id}`).set("Authorization", tok(student))).body.assignment;
  const submit = () =>
    request(app).post(`/api/tmcode/projects/${wsId}/links/${linkId}/submit`).set("Authorization", tok(student));
  const withdraw = () => request(app).post(`/api/tmcode/projects/${wsId}/withdraw`).set("Authorization", tok(student));

  beforeAll(async () => {
    const spy = jest.spyOn(scoped, "getScopedSubjects").mockResolvedValue({ scope: "assigned", subjects: programming } as any);
    a = await createAssignment();
    spy.mockRestore();
  });

  it("hands in on time: my.is_late false; nothing returned", async () => {
    const on = await request(app)
      .put(`/api/tmcode/assignments/${a.id}/tmcode`)
      .set("Authorization", tok(teacher))
      .send({ kind: "practical", language: "python" });
    expect(on.status).toBe(200);
    const started = await start(student, a.id);
    expect([200, 201]).toContain(started.status);
    wsId = started.body.project.id;
    projectIds.add(wsId);
    linkId = started.body.project.links[0].id;
    expect((await mine()).my).toMatchObject({ state: "in_progress", is_late: null, returned_at: null, returned_message: null });

    const saved = await saveFiles(student, wsId, (await Project.findByPk(wsId))!.head_revision_id ?? null, [{ path: "main.py", b: blob(`print(1) # ${Date.now()}`) }]);
    expect(saved.status).toBe(201);
    head = saved.body.revision.id;
    expect((await submit()).status).toBe(200);
    expect((await mine()).my).toMatchObject({ state: "submitted", is_late: false, returned_at: null });
  });

  it("shows the teacher's Return for changes until the student hands in again", async () => {
    const r = await request(app).post(`/api/tmcode/projects/${wsId}/return`).set("Authorization", tok(teacher)).send({ message: "Handle empty input" });
    expect(r.status).toBe(200);
    const back = (await mine()).my;
    expect(back).toMatchObject({ state: "in_progress", is_late: null, returned_message: "Handle empty input" });
    expect(new Date(back.returned_at).getTime()).toBeGreaterThan(Date.now() - 60_000);
    // The list carries it too.
    const listed = (await request(app).get("/api/tmcode/assignments").set("Authorization", tok(student))).body.assignments.find(
      (x: any) => x.id === a.id,
    );
    expect(listed.my).toMatchObject({ returned_message: "Handle empty input" });

    expect((await submit()).status).toBe(200);
    expect((await mine()).my).toMatchObject({ state: "submitted", is_late: false, returned_at: null, returned_message: null });
  });

  it("after the due date: withdraw warns, the same version stays on time, a changed one is late", async () => {
    await Assignment.update({ due_date: new Date(Date.now() - 3_600_000) }, { where: { id: a.id } });
    const before = await mine();
    expect(before.late).toBe(true); // the assignment is past due…
    expect(before.my.is_late).toBe(false); // …but this work was handed in on time

    const w = await withdraw();
    expect(w.status).toBe(200);
    expect(w.body.will_be_late).toBe(true);
    expect((await submit()).status).toBe(200);
    expect((await mine()).my).toMatchObject({ state: "submitted", is_late: false });

    expect((await withdraw()).status).toBe(200);
    const changed = await saveFiles(student, wsId, head, [{ path: "main.py", b: blob(`print(2) # ${Date.now()}`) }]);
    expect(changed.status).toBe(201);
    const late = await submit();
    expect(late.status).toBe(200);
    expect(late.body.submission).toMatchObject({ is_late: true });
    expect((await mine()).my).toMatchObject({ state: "submitted", is_late: true });
  });
});

describe("how it's graded: typed rubric, per-criterion scores once graded, one cutoff", () => {
  const RUBRIC = [
    { criteria: "Correct output", max_score: 6, description: "All cases print the right thing" },
    { criteria: "Readable code", max_score: 4 },
  ];
  let a: Assignment;
  const mine = async () =>
    (await request(app).get(`/api/tmcode/assignments/${a.id}`).set("Authorization", tok(student))).body.assignment;

  beforeAll(async () => {
    const spy = jest.spyOn(scoped, "getScopedSubjects").mockResolvedValue({ scope: "assigned", subjects: programming } as any);
    a = await createAssignment({ max_score: 10, rubric: RUBRIC });
    spy.mockRestore();
  });

  it("sends the rubric typed, the cutoff, and no scores before grading", async () => {
    const on = await request(app)
      .put(`/api/tmcode/assignments/${a.id}/tmcode`)
      .set("Authorization", tok(teacher))
      .send({ kind: "practical", language: "python" });
    expect(on.status).toBe(200);
    const detail = await mine();
    expect(detail.rubric).toEqual([
      { criteria: "Correct output", description: "All cases print the right thing", max_score: 6 },
      { criteria: "Readable code", description: null, max_score: 4 },
    ]);
    expect(detail).toMatchObject({ accepts_submissions: true, late_policy: "until_closed", accepts_late_until: null });
    expect(detail.my.rubric_scores).toBeNull();
    const listed = (await request(app).get("/api/tmcode/assignments").set("Authorization", tok(student))).body.assignments.find(
      (x: any) => x.id === a.id,
    );
    expect(listed).toMatchObject({ accepts_submissions: true, late_policy: "until_closed", accepts_late_until: null });
    expect(listed.my.rubric_scores).toBeNull();
  });

  it("shows the student each criterion's score and note only once graded", async () => {
    const started = await start(student, a.id);
    expect([200, 201]).toContain(started.status);
    const wsId = started.body.project.id;
    projectIds.add(wsId);
    const linkId = started.body.project.links[0].id;
    const saved = await saveFiles(student, wsId, (await Project.findByPk(wsId))!.head_revision_id ?? null, [
      { path: "main.py", b: blob(`print(3) # ${Date.now()}`) },
    ]);
    expect(saved.status).toBe(201);
    const sub = await request(app).post(`/api/tmcode/projects/${wsId}/links/${linkId}/submit`).set("Authorization", tok(student));
    expect(sub.status).toBe(200);
    expect((await mine()).my).toMatchObject({ state: "submitted", grade: null, feedback: null, rubric_scores: null });

    const graded = await request(app)
      .put(`/api/tmcode/grading/assignment/${a.id}/students/${student.id}`)
      .set("Authorization", tok(teacher))
      .send({ rubric_scores: [{ index: 0, score: 5, comment: "Misses the empty case" }, { index: 1, score: 4 }], feedback: "Nice work" });
    expect(graded.status).toBe(200);
    const my = (await mine()).my;
    expect(my).toMatchObject({ state: "graded", grade: 9, max_points: 10 });
    expect(my.rubric_scores).toEqual([
      { index: 0, score: 5, comment: "Misses the empty case" },
      { index: 1, score: 4, comment: null },
    ]);
    expect(my.feedback).toContain("Nice work");

    // Another student never sees them.
    const other = (await request(app).get(`/api/tmcode/assignments/${a.id}`).set("Authorization", tok(student2))).body.assignment;
    expect(other.my.rubric_scores).toBeNull();
  });

  it("stops accepting work once the teacher closes it", async () => {
    await Assignment.update({ status: "completed" }, { where: { id: a.id } });
    expect(await mine()).toMatchObject({ accepts_submissions: false, read_only: true, accepts_late_until: null });
  });
});

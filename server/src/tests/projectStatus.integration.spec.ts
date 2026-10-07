import http from "http";
import zlib from "zlib";
import crypto from "crypto";
import request from "supertest";
import { buildTestApp, ensureModelsRegistered, findSeededUserByRole, signTokenFor } from "./testApp";
import { sequelize } from "../config/database";
import {
  Assignment,
  Project,
  ProjectActivityLink,
  ProjectBlob,
  ProjectEvent,
  ProjectMember,
  ProjectPresence,
  ProjectRevision,
  User,
} from "../models";
import * as scoped from "../utils/scopedSubjects";
import * as mis from "../utils/misUtils";
import { projectsBus } from "../tmcode/projects/bus";

/**
 * Project status lifecycle (draft -> submitted -> graded, removed) against the
 * dev DB: creating a project for an assignment, submit locks saving, withdraw
 * and teacher return reopen it, grading sets graded, soft remove / restore /
 * delete for good, and the list's status filter and counts. MIS is stubbed.
 */

const COURSE_ID = 4248;
jest.setTimeout(20_000);

let app: http.Server;
let student: User;
let teacher: User;
const tok = (u: User) => `Bearer ${signTokenFor(u.id)}`;
const projectIds = new Set<number>();
const blobShas = new Set<string>();
const assignmentIds: number[] = [];
const programming = [{ id: COURSE_ID, name: "Programming", code: null }];
const unique = (label: string) => `${label} ${Date.now()} ${crypto.randomBytes(4).toString("hex")}`;

const blob = (content: string) => {
  const raw = Buffer.from(content);
  const sha = crypto.createHash("sha256").update(raw).digest("hex");
  blobShas.add(sha);
  return { sha, gz: zlib.gzipSync(raw), size: raw.length };
};

async function save(u: User, projectId: number, content: string, base: number | null) {
  const b = blob(content);
  await request(app)
    .put(`/api/tmcode/projects/${projectId}/blobs/${b.sha}`)
    .set("Authorization", tok(u))
    .set("Content-Type", "application/gzip")
    .send(b.gz);
  return request(app)
    .post(`/api/tmcode/projects/${projectId}/revisions`)
    .set("Authorization", tok(u))
    .send({ base_revision_id: base, message: "save", files: [{ path: "main.py", sha256: b.sha, size: b.size }] });
}

async function projectAssignment(extra: Record<string, unknown> = {}) {
  const a = await Assignment.create({
    title: unique("Project task"),
    description: "<p>Build it</p>",
    due_date: new Date(Date.now() + 7 * 86_400_000),
    max_score: 20,
    submission_type: "project",
    course_id: COURSE_ID,
    created_by: teacher.id,
    status: "published",
    ...extra,
  } as any);
  assignmentIds.push(a.id);
  return a;
}

const api = (u: User) => ({
  get: (path: string) => request(app).get(`/api/tmcode${path}`).set("Authorization", tok(u)),
  post: (path: string, body: object = {}) => request(app).post(`/api/tmcode${path}`).set("Authorization", tok(u)).send(body),
  del: (path: string) => request(app).delete(`/api/tmcode${path}`).set("Authorization", tok(u)),
});

beforeAll(async () => {
  await ensureModelsRegistered();
  app = http.createServer(buildTestApp());
  await new Promise<void>((r) => app.listen(0, "127.0.0.1", () => r()));
  student = await findSeededUserByRole("student");
  teacher = await findSeededUserByRole("instructor");
  process.env.PROJECTS_MAX_PER_USER = "1000";
});

beforeEach(() => {
  jest.spyOn(scoped, "getScopedSubjects").mockImplementation(async (req: any) =>
    Number(req.user?.id) === student.id
      ? ({ scope: "enrolled", subjects: programming } as any)
      : ({ scope: "assigned", subjects: programming } as any),
  );
  jest.spyOn(mis, "getCurrentTermId").mockResolvedValue(null);
  jest.spyOn(mis, "fetchEnrolledStudents").mockResolvedValue([] as any);
});

afterEach(() => jest.restoreAllMocks());

afterAll(async () => {
  projectsBus.clear();
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

describe("project status lifecycle", () => {
  it("creates a project for an assignment, linked and in draft", async () => {
    const a = await projectAssignment();
    const res = await api(student).post("/projects", { name: unique("Calc"), language: "python", assignment_id: a.id });
    expect(res.status).toBe(201);
    projectIds.add(res.body.project.id);
    expect(res.body.project.status).toBe("draft");
    expect(res.body.project.assignment_id ?? res.body.project.assignment?.id).toBe(a.id);
    const links = await ProjectActivityLink.findAll({ where: { project_id: res.body.project.id } });
    expect(links.map((l) => [l.activity_type, l.activity_id, l.status])).toEqual([["assignment", a.id, "linked"]]);

    // one project per assignment
    const again = await api(student).post("/projects", { name: unique("Second"), assignment_id: a.id });
    expect(again.status).toBe(409);
    expect(JSON.stringify(again.body)).toContain("ALREADY_LINKED");
  });

  it("refuses assignments that don't take a project, or are closed", async () => {
    const files = await projectAssignment({ submission_type: "file" });
    const r1 = await api(student).post("/projects", { name: unique("X"), assignment_id: files.id });
    expect(r1.status).toBe(422);
    const draft = await projectAssignment({ status: "draft" });
    const r2 = await api(student).post("/projects", { name: unique("Y"), assignment_id: draft.id });
    expect(r2.status).toBe(409);
  });

  let assignment: Assignment;
  let projectId: number;
  let head: number;

  it("submit hands it in and locks saving; withdraw reopens it", async () => {
    assignment = await projectAssignment();
    const created = await api(student).post("/projects", { name: unique("Game"), assignment_id: assignment.id });
    projectId = created.body.project.id;
    projectIds.add(projectId);

    // nothing saved yet -> nothing to submit
    const empty = await api(student).post(`/projects/${projectId}/submit`);
    expect(empty.status).toBe(422);

    const saved = await save(student, projectId, "print('v1')", null);
    expect(saved.status).toBe(201);
    head = saved.body.revision.id;

    const sub = await api(student).post(`/projects/${projectId}/submit`);
    expect(sub.status).toBe(200);
    expect(sub.body.project_status).toBe("submitted");
    const [row] = await sequelize.query<{ status: string }>(
      "SELECT status FROM submissions WHERE assignment_id = ? AND student_id = ?",
      { replacements: [assignment.id, student.id], type: "SELECT" as any },
    );
    expect(row.status).toBe("submitted");

    const locked = await save(student, projectId, "print('v2')", head);
    expect(locked.status).toBe(409);
    expect(JSON.stringify(locked.body)).toContain("PROJECT_LOCKED");

    // can't remove submitted work
    expect((await api(student).del(`/projects/${projectId}`)).status).toBe(409);

    const w = await api(student).post(`/projects/${projectId}/withdraw`);
    expect(w.status).toBe(200);
    expect(w.body.status).toBe("draft");
    // TMCode reads the project in the GET /projects/:id shape
    expect(w.body.project).toMatchObject({ id: projectId, status: "draft" });
    expect(Array.isArray(w.body.project.links)).toBe(true);
    const [after] = await sequelize.query<{ status: string }>(
      "SELECT status FROM submissions WHERE assignment_id = ? AND student_id = ?",
      { replacements: [assignment.id, student.id], type: "SELECT" as any },
    );
    expect(after.status).toBe("draft");
    const v2 = await save(student, projectId, "print('v2')", head);
    expect(v2.status).toBe(201);
    head = v2.body.revision.id;
  });

  it("submitting through the link route (what TMCode uses) sets submitted and locks too", async () => {
    const link = await ProjectActivityLink.findOne({ where: { project_id: projectId, activity_type: "assignment" } });
    const sub = await api(student).post(`/projects/${projectId}/links/${link!.id}/submit`);
    expect(sub.status).toBe(200);
    expect(sub.body.project_status).toBe("submitted");
    expect((await Project.findByPk(projectId))!.status).toBe("submitted");
    const locked = await save(student, projectId, "print('v3')", head);
    expect(locked.status).toBe(409);
    expect(locked.body.message ?? JSON.stringify(locked.body)).toMatch(/Withdraw the submission/);
    expect((await api(student).post(`/projects/${projectId}/withdraw`)).body.project.status).toBe("draft");
  });

  it("a teacher can return a submission for changes, with a message", async () => {
    expect((await api(student).post(`/projects/${projectId}/submit`)).body.project_status).toBe("submitted");
    const r = await api(teacher).post(`/projects/${projectId}/return`, { message: "Add input validation" });
    expect(r.status).toBe(200);
    expect(r.body.status).toBe("draft");
    const ev = await ProjectEvent.findOne({ where: { project_id: projectId, type: "returned" } });
    expect(ev?.data).toMatchObject({ message: "Add input validation" });
    // a student can't use the teacher route
    expect((await api(student).post(`/projects/${projectId}/return`)).status).toBe(403);
  });

  it("grading the submission makes the project graded and locked for good", async () => {
    await api(student).post(`/projects/${projectId}/submit`);
    const [row] = await sequelize.query<{ id: number }>(
      "SELECT id FROM submissions WHERE assignment_id = ? AND student_id = ?",
      { replacements: [assignment.id, student.id], type: "SELECT" as any },
    );
    const g = await request(app)
      .patch(`/api/submissions/${row.id}/grade`)
      .set("Authorization", tok(teacher))
      .send({ score: 17, maxScore: 20, feedback: "Good" });
    expect(g.status).toBe(200);
    const p = await Project.findByPk(projectId);
    expect(p!.status).toBe("graded");

    expect((await api(student).post(`/projects/${projectId}/withdraw`)).status).toBe(409);
    expect((await api(teacher).post(`/projects/${projectId}/return`)).status).toBe(409);
    const locked = await save(student, projectId, "print('v3')", head);
    expect(JSON.stringify(locked.body)).toContain("PROJECT_GRADED");
  });

  it("remove is a soft delete: hidden, restorable, then deletable for good", async () => {
    const created = await api(student).post("/projects", { name: unique("Scratch") });
    const id = created.body.project.id;
    projectIds.add(id);

    // deleting for good needs a removed project first
    expect((await api(student).del(`/projects/${id}?permanent=1`)).status).toBe(409);
    const rm = await api(student).del(`/projects/${id}`);
    expect(rm.status).toBe(200);
    expect(rm.body.status).toBe("removed");

    const active = await api(student).get("/projects?scope=mine");
    expect(active.body.projects.some((p: any) => p.id === id)).toBe(false);
    expect(active.body.stats.by_status.removed).toBeGreaterThanOrEqual(1);
    const removed = await api(student).get("/projects?scope=mine&status=removed");
    expect(removed.body.projects.map((p: any) => p.id)).toContain(id);

    // removed projects can't be saved to
    const s = await save(student, id, "x = 1", null);
    expect(JSON.stringify(s.body)).toContain("PROJECT_REMOVED");

    const back = await api(student).post(`/projects/${id}/restore`);
    expect(back.body.status).toBe("draft");
    await api(student).del(`/projects/${id}`);
    expect((await api(student).del(`/projects/${id}?permanent=1`)).status).toBe(200);
    expect(await Project.findByPk(id)).toBeNull();
    projectIds.delete(id);
  });

  it("filters the list by status", async () => {
    const graded = await api(student).get("/projects?scope=mine&status=graded");
    expect(graded.body.projects.map((p: any) => p.id)).toContain(projectId);
    expect(graded.body.projects.every((p: any) => p.status === "graded")).toBe(true);
  });
});

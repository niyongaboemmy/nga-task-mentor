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
  Submission,
  User,
} from "../models";
import * as scoped from "../utils/scopedSubjects";
import * as mis from "../utils/misUtils";
import { projectsBus } from "../tmcode/projects/bus";

/**
 * A teacher marks a student's assignment as submitted on their behalf
 * (POST /api/assignments/:id/students/:studentId/mark-submitted), so work
 * that was never handed in can be graded: saved TMCode work is frozen as the
 * student's submit would, a draft row becomes submitted, and with nothing at
 * all a placeholder submission row is created. Dev DB, MIS stubbed.
 */

const COURSE_ID = 4249;
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

async function save(u: User, projectId: number, content: string) {
  const raw = Buffer.from(content);
  const sha = crypto.createHash("sha256").update(raw).digest("hex");
  blobShas.add(sha);
  await request(app)
    .put(`/api/tmcode/projects/${projectId}/blobs/${sha}`)
    .set("Authorization", tok(u))
    .set("Content-Type", "application/gzip")
    .send(zlib.gzipSync(raw));
  return request(app)
    .post(`/api/tmcode/projects/${projectId}/revisions`)
    .set("Authorization", tok(u))
    .send({ base_revision_id: null, message: "save", files: [{ path: "main.py", sha256: sha, size: raw.length }] });
}

async function makeAssignment(extra: Record<string, unknown> = {}) {
  const a = await Assignment.create({
    title: unique("Mark submitted"),
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

const mark = (u: User, assignmentId: number, studentId = student.id) =>
  request(app).post(`/api/assignments/${assignmentId}/students/${studentId}/mark-submitted`).set("Authorization", tok(u));
const roster = (assignmentId: number, query = "") =>
  request(app).get(`/api/tmcode/grading/assignment/${assignmentId}${query}`).set("Authorization", tok(teacher));
const rowOf = (res: request.Response) => (res.body.rows as any[]).find((r) => r.student?.id === student.id);

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

describe("mark submitted for a student", () => {
  it("creates a placeholder submission for a student with nothing, then grading works", async () => {
    const a = await makeAssignment();

    // Not listed until asked for; then listed as not started.
    expect(rowOf(await roster(a.id))).toBeUndefined();
    expect(rowOf(await roster(a.id, `?student_id=${student.id}`))?.state).toBe("not_started");

    const res = await mark(teacher, a.id);
    expect(res.status).toBe(200);
    expect(res.body.data.source).toBe("placeholder");
    const sub = await Submission.findOne({ where: { assignment_id: a.id, student_id: student.id } });
    expect(sub?.status).toBe("submitted");
    expect(Number(sub?.submitted_by)).toBe(teacher.id);
    expect(rowOf(await roster(a.id))?.state).toBe("submitted");

    const graded = await request(app)
      .put(`/api/tmcode/grading/assignment/${a.id}/students/${student.id}`)
      .set("Authorization", tok(teacher))
      .send({ score: 12, feedback: "Checked on paper" });
    expect(graded.status).toBe(200);
    expect((await sub!.reload()).status).toBe("graded");
    expect(sub!.grade).toBe("12/20");

    // Already graded: nothing to mark.
    expect((await mark(teacher, a.id)).body.code).toBe("ALREADY_GRADED");
  });

  it("hands in a working student's latest saved project, frozen on the link", async () => {
    const a = await makeAssignment();
    const created = await request(app)
      .post("/api/tmcode/projects")
      .set("Authorization", tok(student))
      .send({ name: unique("Calc"), language: "python", assignment_id: a.id });
    expect(created.status).toBe(201);
    const projectId = created.body.project.id;
    projectIds.add(projectId);
    expect((await save(student, projectId, "print('hi')")).status).toBe(201);
    expect(rowOf(await roster(a.id))?.state).toBe("in_progress");

    const res = await mark(teacher, a.id);
    expect(res.status).toBe(200);
    expect(res.body.data.source).toBe("project");

    const project = await Project.findByPk(projectId);
    const link = await ProjectActivityLink.findOne({ where: { project_id: projectId } });
    expect(link?.status).toBe("submitted");
    expect(link?.revision_id).toBe(project?.head_revision_id);
    const sub = await Submission.findOne({ where: { assignment_id: a.id, student_id: student.id } });
    expect(sub?.status).toBe("submitted");
    expect(Number(sub?.submitted_by)).toBe(teacher.id);
    const row = rowOf(await roster(a.id));
    expect(row?.state).toBe("submitted");
    expect(row?.link?.revision_id).toBe(project?.head_revision_id);

    expect((await mark(teacher, a.id)).status).toBe(409);
  });

  it("turns a draft into a submission; students can't use it", async () => {
    const a = await makeAssignment({ submission_type: "text" });
    await Submission.create({
      assignment_id: a.id,
      student_id: student.id,
      submitted_by: student.id,
      status: "draft",
      text_submission: "half done",
      submitted_at: new Date(),
    } as any);

    expect((await mark(student, a.id)).status).toBe(403);

    const res = await mark(teacher, a.id);
    expect(res.status).toBe(200);
    expect(res.body.data.source).toBe("draft");
    const sub = await Submission.findOne({ where: { assignment_id: a.id, student_id: student.id } });
    expect(sub?.status).toBe("submitted");
    expect(sub?.text_submission).toBe("half done");

    const again = await mark(teacher, a.id);
    expect(again.status).toBe(409);
    expect(again.body.code).toBe("ALREADY_SUBMITTED");
  });
});

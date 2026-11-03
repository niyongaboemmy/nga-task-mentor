import http from "http";
import crypto from "crypto";
import request from "supertest";
import { buildTestApp, ensureModelsRegistered, findSeededUserByRole, signTokenFor } from "./testApp";
import { sequelize } from "../config/database";
import { Assignment, Submission, User } from "../models";
import * as scoped from "../utils/scopedSubjects";
import * as mis from "../utils/misUtils";
import { loadStudentScores } from "../utils/reportCardScores";

/**
 * An assignment's marks status (counted / part_of) against the dev DB: the
 * quick PATCH, the edit form's PUT, the "part_of" list filter and what the
 * student's list returns, and report cards skipping a part_of assignment's
 * marks. Totals elsewhere are covered by the overview unit specs.
 */

const COURSE_ID = 4250;
jest.setTimeout(20_000);

let app: http.Server;
let student: User;
let teacher: User;
const tok = (u: User) => `Bearer ${signTokenFor(u.id)}`;
const assignmentIds: number[] = [];
const subjects = [{ id: COURSE_ID, name: "Programming", code: "PRG" }];
const unique = (label: string) => `${label} ${Date.now()} ${crypto.randomBytes(4).toString("hex")}`;

async function makeAssignment(extra: Record<string, unknown> = {}) {
  const a = await Assignment.create({
    title: unique("Section C"),
    description: "<p>Practical part</p>",
    due_date: new Date(Date.now() + 7 * 86_400_000),
    max_score: 20,
    submission_type: "text",
    course_id: COURSE_ID,
    created_by: teacher.id,
    status: "published",
    ...extra,
  } as any);
  assignmentIds.push(a.id);
  return a;
}

const patch = (u: User, id: number, body: object) =>
  request(app).patch(`/api/assignments/${id}/marks-scope`).set("Authorization", tok(u)).send(body);

beforeAll(async () => {
  await ensureModelsRegistered();
  app = http.createServer(buildTestApp());
  await new Promise<void>((r) => app.listen(0, "127.0.0.1", () => r()));
  student = await findSeededUserByRole("student");
  teacher = await findSeededUserByRole("instructor");
});

beforeEach(() => {
  jest.spyOn(scoped, "getScopedSubjects").mockImplementation(async (req: any) =>
    Number(req.user?.id) === student.id
      ? ({ scope: "enrolled", subjects } as any)
      : ({ scope: "assigned", subjects } as any),
  );
  jest.spyOn(mis, "getCurrentTermId").mockResolvedValue(null);
});

afterEach(() => jest.restoreAllMocks());

afterAll(async () => {
  if (assignmentIds.length) {
    await sequelize.query("DELETE FROM submissions WHERE assignment_id IN (?)", { replacements: [assignmentIds] });
    await Assignment.destroy({ where: { id: assignmentIds } });
  }
  await new Promise((r) => app.close(r));
  await sequelize.close();
});

describe("assignment marks status", () => {
  it("defaults to counted", async () => {
    const a = await makeAssignment();
    expect((await a.reload()).marks_scope).toBe("counted");
    expect(a.part_of_title).toBeNull();
  });

  it("the creator switches it to part of another assessment and back; others can't", async () => {
    const a = await makeAssignment();
    const res = await patch(teacher, a.id, { marks_scope: "part_of", part_of_title: "  Term exam, Section C  " });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ marks_scope: "part_of", part_of_title: "Term exam, Section C" });

    expect((await patch(student, a.id, { marks_scope: "counted" })).status).toBe(403);
    const bad = await patch(teacher, a.id, { marks_scope: "ignored" });
    expect(bad.status).toBe(400);
    expect(bad.body.errors[0].field).toBe("marks_scope");

    // Counted again: the "part of" title is cleared.
    const back = await patch(teacher, a.id, { marks_scope: "counted", part_of_title: "stale" });
    expect(back.body.data).toMatchObject({ marks_scope: "counted", part_of_title: null });
  });

  it("the edit form's PUT saves it with the rest", async () => {
    const a = await makeAssignment();
    const res = await request(app)
      .put(`/api/assignments/${a.id}`)
      .set("Authorization", tok(teacher))
      .field("title", a.title)
      .field("marks_scope", "part_of")
      .field("part_of_title", "Mock exam");
    expect(res.status).toBe(200);
    await a.reload();
    expect([a.marks_scope, a.part_of_title]).toEqual(["part_of", "Mock exam"]);
  });

  it("the list filters on it, and a student's list carries it with their mark", async () => {
    const a = await makeAssignment({ marks_scope: "part_of", part_of_title: "Final exam" });
    const counted = await makeAssignment();
    await Submission.create({
      assignment_id: a.id,
      student_id: student.id,
      submitted_by: student.id,
      status: "graded",
      grade: "15/20",
      submitted_at: new Date(),
    } as any);

    const staff = await request(app).get("/api/assignments/grouped?status=part_of").set("Authorization", tok(teacher));
    expect(staff.status).toBe(200);
    const listed = staff.body.data.subjects.flatMap((s: any) => s.assignments.map((x: any) => x.id));
    expect(listed).toContain(a.id);
    expect(listed).not.toContain(counted.id);

    const mine = await request(app).get("/api/assignments/grouped").set("Authorization", tok(student));
    const row = mine.body.data.subjects.flatMap((s: any) => s.assignments).find((x: any) => x.id === a.id);
    expect(row).toMatchObject({ marks_scope: "part_of", part_of_title: "Final exam", my_submission: { grade: "15/20" } });
  });

  it("report cards skip a part_of assignment's marks", async () => {
    const part = await makeAssignment({ marks_scope: "part_of" });
    const counted = await makeAssignment();
    for (const a of [part, counted]) {
      await Submission.create({
        assignment_id: a.id,
        student_id: student.id,
        submitted_by: student.id,
        status: "graded",
        grade: "10/20",
        submitted_at: new Date(),
      } as any);
    }
    const scores = await loadStudentScores({ localIds: [student.id], manualIds: [student.id] }, [
      { assessment_type: "assignment", assessment_id: part.id },
      { assessment_type: "assignment", assessment_id: counted.id },
    ]);
    expect(scores.has(`assignment:${part.id}`)).toBe(false);
    expect(scores.get(`assignment:${counted.id}`)).toMatchObject({ raw_score: 10, max_score: 20 });
  });
});

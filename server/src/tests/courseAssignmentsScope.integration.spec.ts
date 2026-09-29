import request from "supertest";
import axios from "axios";
import crypto from "crypto";
import { buildTestApp, ensureModelsRegistered, findSeededUserByRole, signTokenFor } from "./testApp";
import { sequelize } from "../config/database";
import { Assignment } from "../models";

/**
 * The course page's Assignments tab badge (GET /api/courses/:id statistics)
 * and the list behind it (GET /api/courses/:id/assignments) must agree: same
 * term, same visibility per role. Before, the badge counted every term and
 * every status, so a tab could say "1" and open empty. Dev DB, MIS mocked.
 * Run with --runInBand.
 */

jest.mock("axios", () => {
  const actual = jest.requireActual("axios");
  return { __esModule: true, ...actual, default: { ...actual.default, get: jest.fn() } };
});
const mockedGet = axios.get as jest.Mock;

const RUN = crypto.randomBytes(3).toString("hex");
const SUBJ = 990501;
const TERM = 990601;
const OTHER_TERM = 990602;
const MIS_HEADER = { "x-mis-token": "test-mis-token" };

let app: ReturnType<typeof buildTestApp>;
let tokens: Record<"admin" | "instructor" | "student", string>;
const ids: number[] = [];

const get = (path: string, token: string) =>
  request(app).get(`${path}${path.includes("?") ? "&" : "?"}academic_term_id=${TERM}&academicTermId=${TERM}`).set("Authorization", `Bearer ${token}`).set(MIS_HEADER);

beforeAll(async () => {
  await ensureModelsRegistered();
  app = buildTestApp();
  const [admin, instructor, student] = await Promise.all([
    findSeededUserByRole("admin"),
    findSeededUserByRole("instructor"),
    findSeededUserByRole("student"),
  ]);
  tokens = { admin: signTokenFor(admin.id), instructor: signTokenFor(instructor.id), student: signTokenFor(student.id) };
  mockedGet.mockImplementation(async (url: string) => {
    if (String(url).includes(`/academics/subjects/${SUBJ}`) && !String(url).includes("/terms/")) {
      return { data: { success: true, data: { subject_id: SUBJ, name: `Scope subject ${RUN}`, code: "SCP" } } };
    }
    return { data: { success: true, data: [] } };
  });
  const make = async (title: string, status: string, term: number | null) => {
    const a = await Assignment.create({
      title: `${title} ${RUN}`, description: "scope fixture", due_date: new Date(Date.now() + 86400000), max_score: 10,
      submission_type: "text", course_id: SUBJ, academic_term_id: term, created_by: instructor.id, status,
    } as any);
    ids.push(a.id!);
  };
  await make("Published", "published", TERM);
  await make("Draft", "draft", TERM);
  await make("Legacy no term", "completed", null);
  await make("Removed", "removed", TERM);
  await make("Other term", "published", OTHER_TERM);
});

afterAll(async () => {
  await Assignment.destroy({ where: { id: ids } });
  await sequelize.close();
});

const titles = (res: request.Response) => res.body.data.map((a: any) => a.title.replace(` ${RUN}`, "")).sort();

describe("course Assignments tab: badge and list agree", () => {
  it("staff see this term's work, drafts included, and the badge matches (removed not counted)", async () => {
    for (const role of ["admin", "instructor"] as const) {
      const list = await get(`/api/courses/${SUBJ}/assignments`, tokens[role]);
      expect(list.status).toBe(200);
      expect(titles(list)).toEqual(["Draft", "Legacy no term", "Published", "Removed"]);
      const course = await get(`/api/courses/${SUBJ}`, tokens[role]);
      expect(course.status).toBe(200);
      const stats = course.body.data.statistics.assignments;
      // Removed is listed (behind its own filter on the client) but not counted.
      expect(stats.total).toBe(3);
      expect(stats.by_status).toMatchObject({ published: 1, draft: 1, completed: 1, removed: 1 });
    }
  });

  it("students never receive drafts or removed work, and their badge counts what they can open", async () => {
    const list = await get(`/api/courses/${SUBJ}/assignments`, tokens.student);
    expect(list.status).toBe(200);
    expect(titles(list)).toEqual(["Legacy no term", "Published"]);
    const course = await get(`/api/courses/${SUBJ}`, tokens.student);
    expect(course.status).toBe(200);
    expect(course.body.data.statistics.assignments.total).toBe(2);
  });

  it("another term's work is neither listed nor counted", async () => {
    const list = await get(`/api/courses/${SUBJ}/assignments`, tokens.admin);
    expect(titles(list)).not.toContain("Other term");
  });
});

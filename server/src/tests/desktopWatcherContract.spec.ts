// Contract with NGA Desktop (nga-desktop src-tauri/src/bridge.js WATCHERS): if this fails,
// update the desktop watcher in the same release.
//
// The desktop app intercepts the web app's own polls of
//   GET /api/dashboard/student/overview     -> json.data.reminders[]
//   GET /api/dashboard/instructor/overview  -> json.data.alerts[]
// and raises an OS notification for items that are critical/warning, `notify: true`,
// or have ids "new-work" / "result-*" / "opens-*" (never "all-clear"). It reads `id`,
// `title`, `message`, `severity`, optional `notify` and optional `action.url`.
//
// Runs against the real dev DB and middleware chain (like the *.integration.spec.ts
// files), with MIS mocked; every fixture row is removed afterwards. Run with
//   cd server && TZ=UTC npx jest --runInBand src/tests/desktopWatcherContract.spec.ts
import request from "supertest";
import axios from "axios";
import crypto from "crypto";
import { buildTestApp, ensureModelsRegistered, findSeededUserByRole, signTokenFor } from "./testApp";
import { sequelize } from "../config/database";
import { Assignment, Submission } from "../models";
import { clearInstructorOverviewCache } from "../controllers/instructorOverview.controller";

jest.mock("axios", () => {
  const actual = jest.requireActual("axios");
  return { __esModule: true, ...actual, default: { ...actual.default, get: jest.fn() } };
});
const mockedGet = axios.get as jest.Mock;

// Copied verbatim from bridge.js WATCHERS.taskmentor[0].match.
const TM_WATCHER_MATCH = /\/dashboard\/(student|instructor)\/overview/;
// The paths the client polls (client/src/services/{student,instructor}OverviewApi.ts,
// axios baseURL ends in /api).
const STUDENT_PATH = "/api/dashboard/student/overview";
const INSTRUCTOR_PATH = "/api/dashboard/instructor/overview";

const RUN = crypto.randomBytes(3).toString("hex");
const SUBJ = 990401;
const CLASS_GROUP = 990499;
const MIS_HEADER = { "x-mis-token": "test-mis-token" };
const SEVERITIES = ["critical", "warning", "info", "success"];

let app: ReturnType<typeof buildTestApp>;
let studentToken: string;
let instructorToken: string;
let studentMisId: number;
const assignmentIds: number[] = [];

function mockMis() {
  mockedGet.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes("/enrolled-subjects")) {
      return { data: { success: true, data: [{ id: SUBJ, name: `Contract Subject ${SUBJ}`, code: `CON${SUBJ}` }] } };
    }
    if (u.includes("/academics/my-assigned-subjects")) {
      return {
        data: {
          success: true,
          data: [{
            subject_id: SUBJ, subject_name: `Contract Subject ${SUBJ}`, subject_code: `CON${SUBJ}`,
            grades: [{ class_group_id: CLASS_GROUP, class_group_name: "Contract Class", academic_year_id: 1 }],
          }],
        },
      };
    }
    if (u.includes(`/academics/class-groups/${CLASS_GROUP}/students`)) {
      return { data: { success: true, data: [{ user_id: studentMisId, first_name: "Roster", last_name: "Student" }] } };
    }
    return { data: { success: true, data: [] } };
  });
}

/** Mirror of WATCHERS.taskmentor[0].pick in bridge.js. */
function bridgePick(j: any) {
  const str = (v: unknown) => (v == null ? "" : String(v));
  const d = (j && j.data) || {};
  return (d.reminders || d.alerts || [])
    .filter((a: any) => {
      if (!a || a.id === "all-clear" || a.notify === false) return false;
      return a.notify === true || a.severity === "critical" || a.severity === "warning" ||
        /^(result-|opens-)/.test(a.id) || a.id === "new-work";
    })
    .map((a: any) => ({ id: "a" + a.id, title: str(a.title), body: str(a.message), link: a.action && a.action.url, unread: true, at: NaN }));
}

/** Presence and types of exactly the fields the watcher reads. */
function expectWatcherItemShape(a: any) {
  expect(typeof a.id).toBe("string");
  expect(a.id.length).toBeGreaterThan(0);
  expect(typeof a.title).toBe("string");
  expect(a.title.length).toBeGreaterThan(0);
  expect(typeof a.message).toBe("string");
  expect(SEVERITIES).toContain(a.severity);
  if (a.notify !== undefined) expect(typeof a.notify).toBe("boolean");
  if (a.action != null) {
    expect(typeof a.action).toBe("object");
    expect(typeof a.action.url).toBe("string");
    expect(a.action.url.length).toBeGreaterThan(0);
  }
}

beforeAll(async () => {
  await ensureModelsRegistered();
  app = buildTestApp();
  const student = await findSeededUserByRole("student");
  const instructor = await findSeededUserByRole("instructor");
  studentToken = signTokenFor(student.id);
  instructorToken = signTokenFor(instructor.id);
  studentMisId = Number(student.mis_user_id ?? 990900);

  const hours = (h: number) => new Date(Date.now() + h * 3600000);
  const mk = async (title: string, due: Date) => {
    const a = await Assignment.create({
      title: `${title} ${RUN}`, description: "desktop contract fixture", due_date: due, max_score: 20,
      submission_type: "text", course_id: SUBJ, academic_term_id: null, created_by: instructor.id, status: "published",
    } as any);
    assignmentIds.push(a.id!);
    return a;
  };
  // Student: due today (critical), freshly graded (result-*), newly posted later work (new-work).
  await mk("Due today", hours(5));
  const graded = await mk("Graded", hours(-72));
  await mk("Posted later", hours(24 * 10));
  await Submission.create({
    assignment_id: graded.id!, student_id: student.id, status: "graded", grade: "15/20", feedback: "Good",
    text_submission: "y", is_late: false, submitted_at: hours(-80),
  } as any);
  // Instructor: a submission waiting 10 days for grading (critical "grading-overdue" with a URL).
  const toGrade = await mk("To grade", hours(-24 * 11));
  await Submission.create({
    assignment_id: toGrade.id!, student_id: student.id, status: "submitted", text_submission: "z",
    is_late: false, submitted_at: hours(-24 * 10),
  } as any);
});

afterAll(async () => {
  if (assignmentIds.length) {
    await Submission.destroy({ where: { assignment_id: assignmentIds } });
    await Assignment.destroy({ where: { id: assignmentIds } });
  }
  await sequelize.close();
});

describe("NGA Desktop watcher contract: Task Mentor dashboards", () => {
  beforeEach(() => {
    clearInstructorOverviewCache();
    mockMis();
  });

  it("the paths the web app polls are the ones the watcher matches", () => {
    expect(TM_WATCHER_MATCH.test(STUDENT_PATH)).toBe(true);
    expect(TM_WATCHER_MATCH.test(INSTRUCTOR_PATH)).toBe(true);
    expect(TM_WATCHER_MATCH.test(`${INSTRUCTOR_PATH}?subjectId=${SUBJ}&fresh=1`)).toBe(true);
    // The admin dashboard is not watched.
    expect(TM_WATCHER_MATCH.test("/api/dashboard/admin/overview")).toBe(false);
  });

  it("student overview returns data.reminders[] with the fields the watcher reads", async () => {
    const res = await request(app).get(STUDENT_PATH).set("Authorization", `Bearer ${studentToken}`).set(MIS_HEADER);
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(Array.isArray(d.reminders)).toBe(true);
    expect(d.reminders.length).toBeGreaterThan(0);
    d.reminders.forEach(expectWatcherItemShape);

    const mine = d.reminders.filter((r: any) => JSON.stringify(r).includes(RUN));
    const dueToday = mine.find((r: any) => r.severity === "critical" && r.id.startsWith("due-today-"));
    expect(dueToday).toBeTruthy();
    expect(typeof dueToday.action?.url).toBe("string");
    expect(mine.find((r: any) => r.id.startsWith("result-"))).toBeTruthy();
    expect(d.reminders.find((r: any) => r.id === "new-work")).toBeTruthy();

    const picked = bridgePick(res.body);
    const ids = picked.map((p: any) => p.id);
    expect(ids).toContain("a" + dueToday.id);
    expect(ids).toContain("anew-work");
    expect(ids.some((id: string) => id.startsWith("aresult-"))).toBe(true);
    expect(ids).not.toContain("aall-clear");
    const p = picked.find((x: any) => x.id === "a" + dueToday.id);
    expect(p.title).toContain(`Due today ${RUN}`);
    expect(p.body).not.toBe("");
    expect(typeof p.link).toBe("string");
  });

  it("instructor overview returns data.alerts[] (and no data.reminders) with the fields the watcher reads", async () => {
    const res = await request(app)
      .get(`${INSTRUCTOR_PATH}?fresh=1`)
      .set("Authorization", `Bearer ${instructorToken}`)
      .set(MIS_HEADER);
    expect(res.status).toBe(200);
    const d = res.body.data;
    // The watcher reads `d.reminders || d.alerts`: a reminders key here would shadow alerts.
    expect(d.reminders).toBeUndefined();
    expect(Array.isArray(d.alerts)).toBe(true);
    expect(d.alerts.length).toBeGreaterThan(0);
    d.alerts.forEach(expectWatcherItemShape);

    const overdue = d.alerts.find((a: any) => a.id === "grading-overdue");
    expect(overdue).toBeTruthy();
    expect(overdue.severity).toBe("critical");
    expect(typeof overdue.action?.url).toBe("string");

    const picked = bridgePick(res.body);
    const p = picked.find((x: any) => x.id === "agrading-overdue");
    expect(p).toBeTruthy();
    expect(p.title).not.toBe("");
    expect(p.body).not.toBe("");
    expect(p.link).toBe(overdue.action.url);
    expect(picked.map((x: any) => x.id)).not.toContain("aall-clear");
  });
});

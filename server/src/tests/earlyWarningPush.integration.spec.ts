/**
 * Early-warning push (services/earlyWarningPush.ts) against the real dev DB:
 * fixture users, assignments, submissions, quizzes and attempts are created
 * and removed afterwards. MIS HTTP is replaced through setReminderTransport
 * (the shared MIS service transport). Run with --runInBand.
 */
import crypto from "crypto";
import { ensureModelsRegistered, findSeededUserByRole } from "./testApp";
import { sequelize } from "../config/database";
import { Assignment, Quiz, QuizSubmission, Submission, User } from "../models";
import { ReminderRequest, setReminderTransport } from "../services/reminderSync";
import {
  clearJobRun,
  earlyWarningDisabledReason,
  getLastSuccess,
  nextRunAt,
  relevantYearIds,
  rosterFromPeople,
  runEarlyWarningPush,
} from "../services/earlyWarningPush";
import { kigaliDate } from "../services/earlyWarning.service";

const RUN = crypto.randomBytes(3).toString("hex");
const SUBJ = 990701; // enrolled this year
const SUBJ_OLD = 990709; // enrolled only in an old year: must not count
const MIS_A = 990711; // linked by users.mis_user_id
const MIS_B = 990712; // local account linked only by email
const MIS_C = 990713; // no Task Mentor account at all
const MIS_TEACHER = 990714;
const MIS_INACTIVE = 990715;
const FILLER_FROM = 9_800_000; // 1200 more students, so the push needs two batches
const FILLERS = 1200;
const DAY = 86_400_000;

const now = new Date();
const ago = (days: number) => new Date(now.getTime() - days * DAY);

const userIds: number[] = [];
const assignmentIds: number[] = [];
const quizIds: number[] = [];
let emailB: string;

const enrol = (subjectId: number, academicYearId = 5, status = "ACTIVE") => ({ subjectId, academicYearId, status });
const misUser = (id: number, extra: Record<string, any> = {}) => ({
  id,
  email: `ew.${id}.${RUN}@local.test`,
  status: "ACTIVE",
  profile: { userType: "STUDENT" },
  roles: [{ id: 5, name: "Student" }],
  subjectEnrollments: [enrol(SUBJ)],
  ...extra,
});

function people() {
  return [
    misUser(MIS_A, { subjectEnrollments: [enrol(SUBJ), enrol(SUBJ_OLD, 4)] }),
    misUser(MIS_B, { email: emailB.toUpperCase(), subjectEnrollments: [enrol(SUBJ), enrol(SUBJ_OLD, 4)] }),
    misUser(MIS_C),
    misUser(MIS_TEACHER, { profile: { userType: "TEACHER" }, roles: [{ id: 4, name: "Teacher" }] }),
    misUser(MIS_INACTIVE, { status: "INACTIVE" }),
    ...Array.from({ length: FILLERS }, (_, i) => misUser(FILLER_FROM + i)),
  ];
}

let calls: ReminderRequest[];
let putStatus = 200;
let peopleStatus = 200;

function installMis() {
  calls = [];
  setReminderTransport(async (req) => {
    calls.push(req);
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/integrations/sync/reference") {
      return {
        status: 200,
        body: {
          success: true,
          data: {
            academicYears: [
              { id: 4, startDate: "2024-01-08", endDate: "2024-11-29" },
              { id: 5, startDate: `${now.getUTCFullYear() - 1}-09-01`, endDate: `${now.getUTCFullYear() + 1}-07-31` },
            ],
          },
        },
      };
    }
    if (req.method === "GET" && url.pathname === "/integrations/sync/people") {
      if (peopleStatus !== 200) return { status: peopleStatus, body: { success: false } };
      const all = people();
      const cursor = Number(url.searchParams.get("cursor") || 0);
      const limit = Number(url.searchParams.get("limit"));
      const page = all.filter((u) => u.id > cursor).sort((a, b) => a.id - b.id).slice(0, limit === 2000 ? 700 : limit);
      const more = page.length && all.some((u) => u.id > page[page.length - 1].id);
      return { status: 200, body: { success: true, data: { users: page, pagination: { nextCursor: more ? page[page.length - 1].id : null } } } };
    }
    if (req.method === "PUT" && url.pathname === "/early-warning/signals") {
      const n = (req.body as any)?.students?.length ?? 0;
      return putStatus === 200
        ? { status: 200, body: { success: true, data: { saved: n, skipped: 0 } } }
        : { status: putStatus, body: { success: false, message: "nope" } };
    }
    return { status: 404, body: null };
  });
}

const puts = () => calls.filter((c) => c.method === "PUT");
const sentFor = (misId: number) =>
  puts().flatMap((c) => (c.body as any).students).find((s: any) => s.student_id === misId);

const savedEnv = { ...process.env };

beforeAll(async () => {
  await ensureModelsRegistered();
  const student = await findSeededUserByRole("student");
  const instructor = await findSeededUserByRole("instructor");
  const mkUser = async (tag: string, misId: number | null) => {
    const u = await User.create({
      email: `ew.${tag}.${RUN}@local.test`, password: "MIS_AUTH", first_name: "EW", last_name: tag,
      role: "student", role_id: student.role_id, mis_user_id: misId,
    } as any);
    userIds.push(u.id);
    return u;
  };
  const a = await mkUser("a", MIS_A);
  const b = await mkUser("b", null);
  emailB = b.email;

  const mkAssignment = async (title: string, course_id: number, due: Date) => {
    const row = await Assignment.create({
      title: `EW ${title} ${RUN}`, description: "early warning spec", due_date: due, max_score: 20,
      submission_type: "text", course_id, academic_term_id: null, created_by: instructor.id, status: "published",
    } as any);
    assignmentIds.push(row.id!);
    return row;
  };
  const recent = await mkAssignment("recent", SUBJ, ago(2));
  const old = await mkAssignment("old", SUBJ, ago(40));
  await mkAssignment("old-year subject", SUBJ_OLD, ago(1));

  // A handed in the recent one; B didn't. A's old essay was marked 3 days ago.
  await Submission.create({ assignment_id: recent.id!, student_id: a.id, status: "submitted", text_submission: "x", is_late: false, submitted_at: ago(2.5) } as any);
  const graded = await Submission.create({ assignment_id: old.id!, student_id: a.id, status: "graded", grade: "8/20", text_submission: "y", is_late: false, submitted_at: ago(41) } as any);
  await sequelize.query("UPDATE submissions SET updated_at = ? WHERE id = ?", { replacements: [ago(3), graded.id] });

  const q = await Quiz.create({
    title: `EW quiz ${RUN}`, description: "early warning spec", status: "published", type: "Quiz", course_id: SUBJ,
    academic_term_id: null, created_by: instructor.id, end_date: ago(1), is_public: true,
  } as any);
  quizIds.push(q.id!);
  // B finished it with 90%; A never opened it.
  await QuizSubmission.create({
    quiz_id: q.id!, student_id: b.id, total_score: 9, max_score: 10, percentage: 90, status: "completed",
    grade_status: "auto_graded", time_taken: 300, started_at: ago(1.2), completed_at: ago(1.1), graded_at: ago(1.1),
    passed: true, attempt_number: 1,
  } as any);
});

beforeEach(async () => {
  process.env.NGA_MIS_BASE_URL = "https://mis.example.test/";
  process.env.SSO_CLIENT_ID = "taskmentor_app";
  process.env.SSO_CLIENT_SECRET = "s3cret";
  delete process.env.EARLY_WARNING_PUSH;
  putStatus = 200;
  peopleStatus = 200;
  installMis();
  await clearJobRun();
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  setReminderTransport(null);
  process.env = { ...savedEnv };
  jest.restoreAllMocks();
});

afterAll(async () => {
  await clearJobRun();
  if (quizIds.length) {
    await QuizSubmission.destroy({ where: { quiz_id: quizIds } });
    await Quiz.destroy({ where: { id: quizIds } });
  }
  if (assignmentIds.length) {
    await Submission.destroy({ where: { assignment_id: assignmentIds } });
    await Assignment.destroy({ where: { id: assignmentIds } });
  }
  if (userIds.length) await User.destroy({ where: { id: userIds } });
  await sequelize.close();
});

describe("runEarlyWarningPush", () => {
  it("reads the roster, computes metrics from the DB and PUTs them in batches with Basic auth", async () => {
    const summary = await runEarlyWarningPush(now);
    // Only students with a Task Mentor account are sent (fillers and MIS_C have none);
    // splitting into batches of 1000 is covered by the chunk() unit test.
    expect(summary).toMatchObject({ ok: true, roster: 3 + FILLERS, linked: 2, sent: 2, batches: 1, failed_batches: 0 });

    // Roster paging: reference once, people until nextCursor is null.
    const gets = calls.filter((c) => c.method === "GET").map((c) => new URL(c.url).pathname);
    expect(gets[0]).toBe("/integrations/sync/reference");
    expect(gets.filter((p) => p === "/integrations/sync/people").length).toBe(2);

    const expectedAuth = `Basic ${Buffer.from("taskmentor_app:s3cret").toString("base64")}`;
    for (const c of calls) expect(c.headers.Authorization).toBe(expectedAuth);

    const p = puts();
    expect(p.map((c) => c.url)).toEqual(["https://mis.example.test/early-warning/signals"]);
    expect(p.map((c) => (c.body as any).students.length)).toEqual([2]);
    for (const c of p) {
      expect(c.headers["Content-Type"]).toBe("application/json");
      expect(Object.keys(c.body as any).sort()).toEqual(["as_of", "students"]);
      expect((c.body as any).as_of).toBe(kigaliDate(now));
    }

    // A: recent essay handed in, quiz missed; 8/20 marked 3 days ago (40% = a fail).
    expect(sentFor(MIS_A)).toEqual({
      student_id: MIS_A,
      metrics: { due_14d: 2, missed_14d: 1, avg_pct_30d: 40, avg_pct_prev_30d: null, failed_30d: 1 },
    });
    // B (linked by email, case-insensitive): essay missed, quiz done at 90%.
    expect(sentFor(MIS_B)).toEqual({
      student_id: MIS_B,
      metrics: { due_14d: 2, missed_14d: 1, avg_pct_30d: 90, avg_pct_prev_30d: null, failed_30d: 0 },
    });
    // C never signed in: both missed. The old-year subject never counts.
    // No Task Mentor account: not sent (MIS shows "no data" rather than a false "all missed").
    expect(sentFor(MIS_C)).toBeUndefined();
    expect(sentFor(MIS_TEACHER)).toBeUndefined();
    expect(sentFor(MIS_INACTIVE)).toBeUndefined();
    // No names or emails leave the app.
    expect(JSON.stringify(p.map((c) => c.body))).not.toContain("@local.test");

    const last = await getLastSuccess();
    expect(last).toBe(now.getTime());
  });

  it("sends nothing when the roster can't be read, and records no success", async () => {
    peopleStatus = 500;
    const summary = await runEarlyWarningPush(now);
    expect(summary).toMatchObject({ ok: false, skipped: "error" });
    expect(puts()).toHaveLength(0);
    expect(await getLastSuccess()).toBeNull();
  });

  it("a refused batch is reported, not thrown, and is not a success", async () => {
    putStatus = 400;
    const summary = await runEarlyWarningPush(now);
    expect(summary).toMatchObject({ ok: false, batches: 1, failed_batches: 1 });
    expect(await getLastSuccess()).toBeNull();
  });

  it("is off with EARLY_WARNING_PUSH=0 or without credentials", async () => {
    process.env.EARLY_WARNING_PUSH = "0";
    expect(await runEarlyWarningPush(now)).toMatchObject({ skipped: "EARLY_WARNING_PUSH=0" });
    expect(calls).toHaveLength(0);
    delete process.env.EARLY_WARNING_PUSH;
    delete process.env.SSO_CLIENT_SECRET;
    expect(earlyWarningDisabledReason()).toMatch(/SSO_CLIENT/);
    process.env.SSO_CLIENT_SECRET = "s3cret";
    process.env.NGA_MIS_BASE_URL = "";
    expect(earlyWarningDisabledReason()).toMatch(/NGA_MIS_BASE_URL/);
  });
});

describe("roster and schedule helpers", () => {
  it("relevantYearIds keeps years overlapping the last 60 days; null when undated", () => {
    const at = new Date("2026-10-07T12:00:00Z");
    expect([...relevantYearIds([
      { id: 1, startDate: "2025-09-01", endDate: "2026-07-31" }, // ended > 60 days ago
      { id: 2, startDate: "2025-09-01", endDate: "2026-08-20" }, // ended within 60 days
      { id: 3, startDate: "2026-09-01", endDate: "2027-07-31" }, // current
      { id: 4, startDate: "2026-11-01", endDate: "2027-07-31" }, // not started
    ], at)!]).toEqual([2, 3]);
    expect(relevantYearIds([{ id: 1 }], at)).toBeNull();
  });

  it("rosterFromPeople keeps active students with active enrolments only", () => {
    const out = rosterFromPeople([
      misUser(1, { subjectEnrollments: [enrol(10), enrol(11, 5, "DROPPED"), enrol(12, 4)] }),
      misUser(2, { subjectEnrollments: [] }),
      misUser(3, { profile: { userType: null }, roles: [{ name: "student" }] }),
      misUser(4, { status: "SUSPENDED" }),
    ], new Set([5]));
    expect(out.map((s) => [s.mis_user_id, s.subject_ids])).toEqual([[1, [10]], [3, [SUBJ]]]);
  });

  it("nextRunAt is the next 18:45 Africa/Kigali (16:45 UTC)", () => {
    expect(nextRunAt(new Date("2026-10-07T10:00:00Z"), { h: 18, m: 45 }).toISOString()).toBe("2026-10-07T16:45:00.000Z");
    expect(nextRunAt(new Date("2026-10-07T16:45:00Z"), { h: 18, m: 45 }).toISOString()).toBe("2026-10-08T16:45:00.000Z");
    expect(nextRunAt(new Date("2026-10-07T23:30:00Z"), { h: 18, m: 45 }).toISOString()).toBe("2026-10-08T16:45:00.000Z");
  });
});

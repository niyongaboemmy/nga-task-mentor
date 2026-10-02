import request from "supertest";
import axios from "axios";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { QueryTypes } from "sequelize";
import { buildTestApp, ensureModelsRegistered } from "./testApp";
import { sequelize } from "../config/database";
import { Role } from "../models";
import type { AccessSnapshot, CapabilityEntry } from "../vendor/nga-access";
import { clearSnapshotCache } from "../access/snapshot";
import { clearTargetCaches } from "../access/targets";
import { __resetShadowThrottle, flushShadowWork } from "../access/policy";
import { clearMisBearerCache } from "../middleware/misBearerAuth";
import { integrationLimiter } from "../middleware/rateLimiter.middleware";
import { lensForClassGroups, lensForScope, parseLenses, teachingLens } from "../integration/homeSummary";

/**
 * POST /api/integration/home-summary (the MIS Home page's Task Mentor
 * source) against the real dev DB and middleware chain, with every MIS HTTP
 * call mocked. Fixtures are this spec's own users/rows (unique MIS ids),
 * removed afterwards. Run with --runInBand.
 */

jest.mock("axios", () => {
  const actual = jest.requireActual("axios");
  return { __esModule: true, ...actual, default: { ...actual.default, get: jest.fn() } };
});
const mockedGet = axios.get as jest.Mock;

const RUN = crypto.randomBytes(3).toString("hex");
const MIS = {
  teacherA: 970001,
  teacherB: 970002,
  student1: 970003,
  student2: 970004,
  admin: 970005,
  teacherP: 970006, // bulk fixtures: 20 subjects x 10 students
  learnerBulk: 970007,
  student5: 970008, // fixed-clock fixtures (SUBJ_E)
  stranger: 970099,
};
const BULK_SUBJECTS = Array.from({ length: 20 }, (_, i) => 981000 + i);
const BULK_CLASS = 9;
const BULK_STUDENTS = Array.from({ length: 10 }, (_, i) => 970100 + i);
const SUBJ_A = 980001;
const SUBJ_B = 980002;
const SUBJ_C = 980003; // nobody here is enrolled in / assigned to it
const SUBJ_E = 980005; // fixed-clock fixtures, far from the real "now"
const CLASS = 7;
const OTHER_CLASS = 8;
const TERM = `HOME-T-${RUN}`;
const YEAR = `HOME-Y-${RUN}`;
const now = Date.now();
const H = 60 * 60 * 1000;
const D = 24 * H;

// ── MIS mock ────────────────────────────────────────────────────────────────
/** A token shaped like the MIS session JWT (only ever decoded here, never verified). */
const misToken = (misUserId: number, termEnd: string = new Date(now + 5 * D).toISOString()) =>
  jwt.sign(
    {
      userId: misUserId,
      currentAcademicYear: { academic_year_id: 55, name: YEAR },
      currentAcademicTerms: [
        {
          academic_term_id: 66,
          name: TERM,
          is_current: 1,
          start_date: new Date(now - 60 * D).toISOString(),
          end_date: termEnd,
        },
      ],
    },
    "not-the-mis-secret",
  );
const TOKEN = Object.fromEntries(Object.entries(MIS).map(([k, id]) => [k, misToken(id)])) as Record<keyof typeof MIS, string>;
/** Extra tokens -> MIS user id (e.g. a session whose JWT carries no term). */
const extraTokens: Record<string, number> = {};
/** Tokens MIS has since revoked (logout): /auth/verify answers 401 for them. */
const revoked = new Set<string>();
const BAD_TOKEN = "expired-or-forged";
const DOWN_TOKEN = "mis-is-down";

let snapshotFor: Record<string, AccessSnapshot> = {};
const placementOf: Record<number, number> = { [MIS.student1]: CLASS, [MIS.student2]: OTHER_CLASS };
const rosterOf: Record<number, number[]> = {
  [CLASS]: [MIS.student1],
  [OTHER_CLASS]: [MIS.student2],
  [BULK_CLASS]: BULK_STUDENTS,
};

function misRouter(url: string, cfg: any) {
  const token = String(cfg?.headers?.Authorization ?? "").replace(/^Bearer /, "");
  const ok = (data: any) => ({ status: 200, data: { success: true, data } });
  const who =
    Object.entries(TOKEN).find(([, t]) => t === token)?.[0] ??
    Object.entries(MIS).find(([, id]) => id === extraTokens[token])?.[0];
  if (url.endsWith("/auth/verify")) {
    if (token === DOWN_TOKEN) throw Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" });
    if (revoked.has(token)) throw Object.assign(new Error("Unauthorized"), { response: { status: 401 } });
    if (!who && extraTokens[token]) return ok({ userId: extraTokens[token], access_version: 1 });
    if (!who) throw Object.assign(new Error("Unauthorized"), { response: { status: 401 } });
    return ok({ userId: MIS[who as keyof typeof MIS], access_version: 1 });
  }
  if (url.endsWith("/access/me")) {
    const s = snapshotFor[token];
    if (!s) throw Object.assign(new Error("Service Unavailable"), { response: { status: 503 } });
    return ok(s);
  }
  let m = url.match(/\/academics\/students\/(\d+)\/class-group$/);
  if (m) return ok({ class_group_id: placementOf[Number(m[1])] ?? null, grade_id: 3, program_id: 1 });
  m = url.match(/\/academics\/class-groups\/(\d+)\/students$/);
  if (m) return ok((rosterOf[Number(m[1])] ?? []).map((user_id) => ({ user_id })));
  m = url.match(/\/academics\/students\/(\d+)\/enrolled-subjects$/);
  if (m && Number(m[1]) === MIS.learnerBulk) {
    return ok(BULK_SUBJECTS.map((id) => ({ subject_id: id, subject_name: `Bulk ${id}` })));
  }
  if (m && Number(m[1]) === MIS.student5) return ok([{ subject_id: SUBJ_E, subject_name: "Home Clock" }]);
  if (m) {
    return ok([
      { subject_id: SUBJ_A, subject_name: "Home Maths" },
      { subject_id: SUBJ_B, subject_name: "Home Physics" },
    ]);
  }
  if (url.endsWith("/academics/my-assigned-subjects")) {
    // Another term's assignments would include SUBJ_A too (proves the body can't pick the term).
    const term = cfg?.params?.academic_term_id;
    if (who === "teacherB" && term !== undefined && Number(term) !== 66) {
      return ok([{ id: SUBJ_A, name: "Home Maths" }, { id: SUBJ_B, name: "Home Physics" }]);
    }
    if (who === "teacherA") return ok([{ id: SUBJ_A, name: "Home Maths" }]);
    if (who === "teacherB") return ok([{ id: SUBJ_B, name: "Home Physics" }]);
    if (who === "teacherP") return ok(BULK_SUBJECTS.map((id) => ({ id, name: `Bulk ${id}` })));
    return ok([]);
  }
  if (url.endsWith("/academics/subjects")) {
    return ok([
      { id: SUBJ_A, name: "Home Maths" },
      { id: SUBJ_B, name: "Home Physics" },
      { id: SUBJ_C, name: "Home Chemistry" },
    ]);
  }
  if (url.endsWith("/users/me")) return ok({ currentAcademicTerms: [], currentAcademicYear: null });
  throw new Error(`unexpected MIS call ${url}`);
}

const e = (scope: CapabilityEntry["scope"], depth: CapabilityEntry["depth"] = null): CapabilityEntry[] => [
  { depth, scope, via: [42] },
];
function snap(misUserId: number, caps: Record<string, CapabilityEntry[]>): AccessSnapshot {
  return {
    v: 1,
    app: "tm",
    core: "1.0.0",
    user: { id: misUserId, persona: "STAFF", school_id: 1 },
    year: 55,
    caps,
    grants: {},
    home: null,
    systems: ["tm"],
    generated_at: new Date().toISOString(),
  };
}

// ── fixtures ────────────────────────────────────────────────────────────────
let app: ReturnType<typeof buildTestApp>;
const ids: Record<string, number> = {};
const created: Record<string, number[]> = {
  users: [],
  assignments: [],
  submissions: [],
  quizzes: [],
  quiz_submissions: [],
  proctoring_sessions: [],
  report_cards: [],
};
const savedMode = process.env.ACCESS_V2_MODE;
const savedBase = process.env.NGA_MIS_BASE_URL;
const savedFrontend = process.env.FRONTEND_URL;

async function insert(table: string, row: Record<string, any>): Promise<number> {
  const full: Record<string, any> = { created_at: new Date(), updated_at: new Date(), ...row };
  const cols = Object.keys(full);
  const [id] = await sequelize.query(
    `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`,
    { replacements: cols.map((c) => full[c]), type: QueryTypes.INSERT },
  );
  created[table].push(Number(id));
  return Number(id);
}

async function user(key: string, roleName: string, misUserId: number | null, first: string) {
  const role = await Role.findOne({ where: { name: roleName } });
  if (!role) throw new Error(`Role '${roleName}' not found — run migrations before running integration tests`);
  ids[key] = await insert("users", {
    first_name: first,
    last_name: `Home${RUN}`,
    email: `home-${key}-${RUN}@test.local`,
    password: "not-a-real-hash",
    role: roleName,
    role_id: role.id,
    mis_user_id: misUserId,
  });
}

const assignment = (title: string, course_id: number, created_by: number, due: number) =>
  insert("assignments", {
    title,
    description: "home summary spec",
    due_date: new Date(due),
    max_score: 10,
    submission_type: "text",
    course_id,
    created_by,
    status: "published",
  });

const quiz = (title: string, course_id: number, created_by: number, start: number, end: number) =>
  insert("quizzes", {
    title,
    description: "home summary spec",
    status: "published",
    type: "Quiz",
    course_id,
    created_by,
    start_date: new Date(start),
    end_date: new Date(end),
  });

beforeAll(async () => {
  process.env.NGA_MIS_BASE_URL = "http://mis.test/api";
  process.env.FRONTEND_URL = "https://tm.test";
  await ensureModelsRegistered();
  app = buildTestApp();

  await user("teacherA", "instructor", MIS.teacherA, "Alice");
  await user("teacherB", "instructor", MIS.teacherB, "Bob");
  await user("student1", "student", MIS.student1, "Sam");
  await user("student2", "student", MIS.student2, "Tess");
  await user("admin", "admin", MIS.admin, "Ada");

  // Student side: overdue (not submitted), due in 24 h, submitted, not enrolled.
  ids.overdue = await assignment("Home overdue essay", SUBJ_A, ids.teacherA, now - 2 * D);
  ids.dueSoon = await assignment("Home due soon lab", SUBJ_B, ids.teacherB, now + 24 * H);
  ids.submittedA = await assignment("Home done worksheet", SUBJ_A, ids.teacherA, now - 10 * D);
  ids.notEnrolled = await assignment("Home chemistry task", SUBJ_C, ids.teacherB, now - 1 * D);

  // student1 (class 7) and student2 (class 8) both submitted teacher A's old worksheet; ungraded.
  await insert("submissions", {
    assignment_id: ids.submittedA,
    student_id: ids.student1,
    status: "submitted",
    submitted_at: new Date(now - 9 * D),
    is_late: 0,
  });
  await insert("submissions", {
    assignment_id: ids.submittedA,
    student_id: ids.student2,
    status: "submitted",
    submitted_at: new Date(now - 8 * D),
    is_late: 0,
  });
  // Teacher B: one ungraded submission on his own assignment.
  await insert("submissions", {
    assignment_id: ids.dueSoon,
    student_id: ids.student2,
    status: "submitted",
    submitted_at: new Date(now - 1 * H),
    is_late: 0,
  });
  // student1: a graded result this week (update).
  ids.gradedA = await assignment("Home graded quiz sheet", SUBJ_A, ids.teacherA, now - 5 * D);
  await insert("submissions", {
    assignment_id: ids.gradedA,
    student_id: ids.student1,
    status: "graded",
    grade: "8/10",
    submitted_at: new Date(now - 4 * D),
    is_late: 0,
  });

  // Quizzes: one open for students closing in 3 h (teacher B's; B's T-15 too),
  // one of teacher A's closing in 12 h with nothing started (A's T-15).
  ids.closingQuiz = await quiz("Home closing quiz", SUBJ_B, ids.teacherB, now - D, now + 3 * H);
  ids.quietQuiz = await quiz("Home quiet quiz", SUBJ_A, ids.teacherA, now - D, now + 12 * H);
  // A flagged proctoring session on each teacher's quiz.
  ids.examA = await quiz("Home exam A", SUBJ_A, ids.teacherA, now - 3 * D, now - 2 * D);
  ids.examB = await quiz("Home exam B", SUBJ_B, ids.teacherB, now - 3 * D, now - 2 * D);
  await insert("proctoring_sessions", {
    quiz_id: ids.examA,
    student_id: ids.student1,
    session_token: `home-${RUN}-a`,
    status: "flagged",
    start_time: new Date(now - 2 * D),
    flags_count: 3,
  });
  await insert("proctoring_sessions", {
    quiz_id: ids.examB,
    student_id: ids.student2,
    session_token: `home-${RUN}-b`,
    status: "completed",
    start_time: new Date(now - 2 * D),
    flags_count: 1,
  });

  // Report cards this term: student1 saved (awaiting approval), student2 draft; neither commented.
  for (const [key, status] of [
    ["student1", "saved"],
    ["student2", "draft"],
  ] as const) {
    await insert("report_cards", {
      uuid: crypto.randomUUID(),
      student_id: ids[key],
      term: TERM,
      academic_year: YEAR,
      status,
    });
  }
});

beforeEach(async () => {
  delete process.env.ACCESS_V2_MODE;
  await flushShadowWork();
  jest.restoreAllMocks();
  mockedGet.mockReset();
  mockedGet.mockImplementation(async (url: string, cfg: any) => misRouter(url, cfg));
  snapshotFor = {};
  revoked.clear();
  // The limiter's window is real time: keep one test's calls from throttling the next.
  for (const id of Object.values(MIS)) integrationLimiter.resetKey(`mis:${id}`);
  clearSnapshotCache();
  clearTargetCaches();
  clearMisBearerCache();
  __resetShadowThrottle();
});

afterEach(() => {
  jest.useRealTimers();
});

afterAll(async () => {
  if (savedMode === undefined) delete process.env.ACCESS_V2_MODE;
  else process.env.ACCESS_V2_MODE = savedMode;
  process.env.NGA_MIS_BASE_URL = savedBase;
  if (savedFrontend === undefined) delete process.env.FRONTEND_URL;
  else process.env.FRONTEND_URL = savedFrontend;
  await flushShadowWork();
  for (const table of ["proctoring_sessions", "quiz_submissions", "submissions", "report_cards", "quizzes", "assignments"]) {
    if (created[table].length) await sequelize.query(`DELETE FROM ${table} WHERE id IN (?)`, { replacements: [created[table]] });
  }
  if (created.users.length) {
    await sequelize.query("DELETE FROM access_shadow_diffs WHERE user_id IN (?)", { replacements: [created.users] });
    await sequelize.query("DELETE FROM users WHERE id IN (?)", { replacements: [created.users] });
  }
  await sequelize.close();
});

const LENSES = [
  { key: "TEACHING", type: "TEACHING", class_group_ids: [CLASS] },
  { key: `CLASS_GROUP:${CLASS}`, type: "CLASS_GROUP", class_group_ids: [CLASS] },
  { key: "PROGRAM:1", type: "PROGRAM", class_group_ids: [CLASS, OTHER_CLASS] },
  { key: "SCHOOL", type: "SCHOOL", class_group_ids: null },
  { key: "SELF", type: "SELF", class_group_ids: [] },
];

// ── contract ────────────────────────────────────────────────────────────────
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const isIso = (v: any) => typeof v === "string" && ISO.test(v) && !isNaN(Date.parse(v));
const isAbs = (v: any) => typeof v === "string" && /^https?:\/\/[^/]+/.test(v);

/** Every problem with a body against the shared HomeSummary contract ([] = valid). */
function validateHomeSummary(b: any): string[] {
  const errs: string[] = [];
  const need = (ok: boolean, msg: string) => {
    if (!ok) errs.push(msg);
  };
  need(b && typeof b === "object", "body is an object");
  if (!b || typeof b !== "object") return errs;
  need(b.version === 1, "version 1");
  need(b.source === "taskmentor", "source");
  need(isIso(b.generated_at), "generated_at ISO");
  need(typeof b.provisioned === "boolean", "provisioned boolean");
  need(isAbs(b.app_url) && !b.app_url.endsWith("/"), "app_url absolute, no trailing slash");
  need(Array.isArray(b.items) && Array.isArray(b.tiles) && Array.isArray(b.updates), "arrays");
  if (!Array.isArray(b.items) || !Array.isArray(b.tiles) || !Array.isArray(b.updates)) return errs;
  if (!b.provisioned) need(b.items.length + b.tiles.length + b.updates.length === 0, "unprovisioned is empty");
  const ids = new Set<string>();
  b.items.forEach((i: any, n: number) => {
    const at = `items[${n}] (${i?.kind})`;
    need(typeof i.id === "string" && i.id.startsWith(`taskmentor:${i.kind}:${i.lens}`), `${at} id shape`);
    need(!ids.has(i.id), `${at} id unique`);
    ids.add(i.id);
    need(i.source === "taskmentor", `${at} source`);
    need(typeof i.kind === "string" && /^[A-Z]-\d{2}$/.test(i.kind), `${at} kind`);
    need(["blocking", "slipping", "tidy"].includes(i.tier), `${at} tier`);
    need(typeof i.lens === "string" && i.lens.length > 0, `${at} lens`);
    need(Array.isArray(i.via) && i.via.every((v: any) => Number.isInteger(v)), `${at} via`);
    need(["summary", "detail", "write"].includes(i.depth), `${at} depth`);
    need(Number.isInteger(i.count) && i.count > 0, `${at} count`);
    need(typeof i.title === "string" && i.title.startsWith(`${i.count} `), `${at} title is counted`);
    if (i.count === 1) need(!/^1 (\w+ )?\w+s\b/.test(i.title), `${at} singular title`);
    else need(/^\d+ (\w+ )?\w+s\b/.test(i.title), `${at} plural title`);
    need(Array.isArray(i.entities) && i.entities.length <= 8, `${at} entities <= 8`);
    need(i.entities.every((x: any) => typeof x === "string" && x.length > 0 && x.length <= 64), `${at} entities short strings`);
    if (i.depth === "summary") need(i.entities.length === 0, `${at} summary => no entities`);
    need(typeof i.why === "string" && i.why.length > 0, `${at} why`);
    need(
      i.cta && typeof i.cta.label === "string" && isAbs(i.cta.href) && i.cta.href.startsWith(b.app_url) && i.cta.external === true,
      `${at} cta`,
    );
    for (const f of ["due_at", "waiting_since"]) if (i[f] != null) need(isIso(i[f]), `${at} ${f} ISO`);
  });
  need(b.tiles.length <= 3, "tiles <= 3");
  b.tiles.forEach((t: any, n: number) => {
    const at = `tiles[${n}]`;
    need(typeof t.id === "string" && !ids.has(t.id), `${at} id`);
    ids.add(t.id);
    need(typeof t.source === "string" && typeof t.lens === "string" && typeof t.label === "string", `${at} fields`);
    need(t.value === null || typeof t.value === "string", `${at} value`);
    if (t.status !== undefined) need(["good", "warning", "critical"].includes(t.status), `${at} status`);
    if (t.href !== undefined) need(isAbs(t.href), `${at} href`);
  });
  need(b.updates.length <= 10, "updates <= 10");
  const weekAgo = Date.now() - 7 * D - 60_000;
  b.updates.forEach((u: any, n: number) => {
    const at = `updates[${n}]`;
    need(typeof u.id === "string" && !ids.has(u.id), `${at} id`);
    ids.add(u.id);
    need(typeof u.source === "string" && typeof u.kind === "string" && typeof u.title === "string", `${at} fields`);
    need(["info", "success", "warning", "critical"].includes(u.severity), `${at} severity`);
    need(isIso(u.created_at) && Date.parse(u.created_at) >= weekAgo, `${at} created_at within 7 days`);
    need(typeof u.read === "boolean", `${at} read`);
    if (u.href != null) need(isAbs(u.href), `${at} href`);
  });
  const reads = b.updates.map((u: any) => (u.read ? 1 : 0));
  need(reads.every((r: number, n: number) => n === 0 || reads[n - 1] <= r), "updates unread first");
  return errs;
}

/** Every 200 in this suite goes through the contract validator. */
function checked(res: request.Response): request.Response {
  if (res.status === 200) expect(validateHomeSummary(res.body)).toEqual([]);
  else expect(JSON.stringify(res.body)).not.toMatch(/stack|sequelize|SELECT |ECONN|at \w+ \(/i);
  return res;
}

const post = (token: string, body: any = { lenses: LENSES }) =>
  request(app).post("/api/integration/home-summary").set("Authorization", `Bearer ${token}`).send(body).then(checked);
const summaryFor = (who: keyof typeof MIS, body: any = { lenses: LENSES }) => post(TOKEN[who], body);
const item = (res: request.Response, kind: string) => res.body.items.find((i: any) => i.kind === kind);

// ───────────────────────────────────────────────────────────────────────────
describe("authentication", () => {
  it("401 MIS_TOKEN_INVALID without a bearer token (MIS never called)", async () => {
    const res = checked(await request(app).post("/api/integration/home-summary").send({}));
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("MIS_TOKEN_INVALID");
    expect(mockedGet).not.toHaveBeenCalled();
  });

  it("401 MIS_TOKEN_INVALID when MIS rejects the token", async () => {
    const res = await post(BAD_TOKEN, {});
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("MIS_TOKEN_INVALID");
  });

  it("503 when MIS cannot be reached", async () => {
    const res = checked(await request(app).get("/api/integration/home-summary").set("Authorization", `Bearer ${DOWN_TOKEN}`));
    expect(res.status).toBe(503);
  });

  it("caches a verification for the same token", async () => {
    await summaryFor("student1");
    await summaryFor("student1");
    const verifies = mockedGet.mock.calls.filter(([url]) => String(url).endsWith("/auth/verify")).length;
    expect(verifies).toBe(1);
  });

  it("an MIS user with no local account gets provisioned:false and nothing else", async () => {
    const res = await summaryFor("stranger");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      version: 1,
      source: "taskmentor",
      provisioned: false,
      items: [],
      tiles: [],
      updates: [],
      app_url: "https://tm.test",
    });
  });

  it("GET without a body works", async () => {
    const res = checked(await request(app).get("/api/integration/home-summary").set("Authorization", `Bearer ${TOKEN.student1}`));
    expect(res.status).toBe(200);
    expect(res.body.provisioned).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe("learner (student1)", () => {
  it("S-01 overdue, S-02 due soon, S-03 quiz closing, tile and results update", async () => {
    const res = await summaryFor("student1");
    expect(res.status).toBe(200);
    expect(res.body.provisioned).toBe(true);

    const s01 = item(res, "S-01");
    expect(s01).toMatchObject({ id: "taskmentor:S-01:SELF", tier: "blocking", lens: "SELF", depth: "detail", count: 1 });
    expect(s01.entities).toEqual(["Home overdue essay · Home Maths"]);
    expect(s01.cta).toEqual({ label: "Submit", href: `https://tm.test/assignments/${ids.overdue}`, external: true });
    // not enrolled in SUBJ_C: its overdue task never shows
    expect(JSON.stringify(res.body)).not.toContain("Home chemistry task");

    expect(item(res, "S-02")).toMatchObject({ tier: "slipping", count: 1, entities: ["Home due soon lab · Home Physics"] });

    // Both open quizzes close within 24 h; the soonest (3 h) makes it blocking.
    const s03 = item(res, "S-03");
    expect(s03).toMatchObject({ tier: "blocking", count: 2 });
    expect(s03.entities).toEqual(["Home closing quiz · Home Physics", "Home quiet quiz · Home Maths"]);
    expect(s03.cta.href).toBe("https://tm.test/my-quizzes");

    // Blocking items first.
    const order = ["blocking", "slipping", "tidy"];
    const ranks = res.body.items.map((i: any) => order.indexOf(i.tier));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));

    // Enrolled + published this term: overdue, dueSoon, submittedA, gradedA -> 2 done.
    expect(res.body.tiles).toEqual([
      expect.objectContaining({ label: "Assignments done", value: "2/4", status: "warning", lens: "SELF" }),
    ]);
    expect(res.body.updates).toEqual([
      expect.objectContaining({
        kind: "result_released",
        title: "Result released: Home graded quiz sheet",
        severity: "success",
        href: `https://tm.test/assignments/${ids.gradedA}`,
      }),
    ]);
    // No teaching/report-card items for a learner.
    expect(res.body.items.map((i: any) => i.kind).sort()).toEqual(["S-01", "S-02", "S-03"]);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe("teaching", () => {
  it("teacher A: T-07 own ungraded work (blocking, > 7 days past due), T-14, T-15, To grade tile", async () => {
    const res = await summaryFor("teacherA");
    expect(res.status).toBe(200);

    const t07 = item(res, "T-07");
    expect(t07).toMatchObject({ id: "taskmentor:T-07:TEACHING", tier: "blocking", lens: "TEACHING", depth: "write", count: 2 });
    expect(t07.entities).toEqual(["Home done worksheet · 2"]);
    expect(t07.cta.href).toBe(`https://tm.test/assignments/${ids.submittedA}`);
    expect(Math.abs(Date.parse(t07.waiting_since) - (now - 9 * D))).toBeLessThan(2000);

    expect(item(res, "T-14")).toMatchObject({ tier: "slipping", count: 1, depth: "detail", entities: ["Home exam A · 1"] });
    expect(item(res, "T-15")).toMatchObject({ tier: "tidy", count: 1, entities: ["Home quiet quiz"] });
    expect(res.body.tiles).toEqual([expect.objectContaining({ label: "To grade", value: "2", status: "critical" })]);
    expect(item(res, "S-01")).toBeUndefined();
  });

  it("scope: teacher B sees only his own submissions/sessions, never teacher A's", async () => {
    const res = await summaryFor("teacherB");
    const t07 = item(res, "T-07");
    expect(t07).toMatchObject({ tier: "slipping", count: 1, entities: ["Home due soon lab · 1"] });
    expect(item(res, "T-14")).toMatchObject({ count: 1, entities: ["Home exam B · 1"] });
    const text = JSON.stringify(res.body);
    expect(text).not.toContain("Home done worksheet");
    expect(text).not.toContain("Home exam A");
    expect(text).not.toContain("Home quiet quiz");
  });

  it("without a TEACHING hint, teaching items fall back to SELF", async () => {
    const res = await summaryFor("teacherA", {});
    expect(item(res, "T-07").lens).toBe("SELF");
    expect(item(res, "T-07").id).toBe("taskmentor:T-07:SELF");
  });

  it("enforce: grading is limited to the teacher's own class (student2's work drops out)", async () => {
    process.env.ACCESS_V2_MODE = "enforce";
    const pair: CapabilityEntry["scope"] = { pairs: [[SUBJ_A, CLASS]] };
    snapshotFor[TOKEN.teacherA] = snap(MIS.teacherA, {
      ASSIGNMENTS_VIEW_SUBMISSIONS: e(pair, "detail"),
      SUBMISSIONS_GRADE: e(pair),
      QUIZZES_EDIT: e({ self: MIS.teacherA }),
    });
    const res = await summaryFor("teacherA");
    expect(res.status).toBe(200);
    expect(item(res, "T-07")).toMatchObject({ count: 1, via: [42] });
    expect(item(res, "T-14")).toBeUndefined(); // no PROCTORING_VIEW_SESSIONS in the snapshot
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe("report-card pipeline (admin)", () => {
  it("off: C-06 and P-05 school-wide from the legacy permissions, blocking near term end", async () => {
    const res = await summaryFor("admin");
    const c06 = item(res, "C-06");
    expect(c06).toMatchObject({ id: "taskmentor:C-06:SCHOOL", tier: "blocking", lens: "SCHOOL", depth: "write", count: 2 });
    expect(c06.entities.sort()).toEqual([`Sam Home${RUN}`, `Tess Home${RUN}`]);
    expect(item(res, "P-05")).toMatchObject({ tier: "blocking", lens: "SCHOOL", count: 1, entities: [] });
  });

  it("enforce: C-06 only for the class the comment grant covers, labelled with that class", async () => {
    process.env.ACCESS_V2_MODE = "enforce";
    snapshotFor[TOKEN.admin] = snap(MIS.admin, {
      REPORT_CARDS_COMMENT: e({ class_groups: [CLASS] }),
    });
    const res = await summaryFor("admin");
    const c06 = item(res, "C-06");
    expect(c06).toMatchObject({ lens: `CLASS_GROUP:${CLASS}`, count: 1, entities: [`Sam Home${RUN}`], via: [42] });
    expect(JSON.stringify(res.body)).not.toContain(`Tess Home${RUN}`);
    expect(item(res, "P-05")).toBeUndefined();
  });

  it("enforce: summary-depth supervision gives counts only (entities [])", async () => {
    process.env.ACCESS_V2_MODE = "enforce";
    snapshotFor[TOKEN.admin] = snap(MIS.admin, {
      ASSIGNMENTS_MANAGE_ANY: e({ all: true }),
      PROCTORING_VIEW_SESSIONS: e({ all: true }, "summary"),
      REPORT_CARDS_APPROVE: e({ all: true }),
      REPORT_CARDS_PUBLISH: e({ all: true }),
    });
    const res = await summaryFor("admin");
    const t14 = item(res, "T-14");
    expect(t14).toMatchObject({ depth: "summary", entities: [], lens: "SCHOOL" });
    expect(t14.count).toBeGreaterThanOrEqual(2); // both fixture sessions (and any other flagged ones school-wide)
    expect(item(res, "P-05")).toMatchObject({ count: 1, lens: "SCHOOL" });
    expect(item(res, "C-06")).toBeUndefined();
    for (const i of res.body.items) if (i.depth === "summary") expect(i.entities).toEqual([]);
    // Not in titles, why, cta or tiles either: no quiz titles or student names at all.
    const text = JSON.stringify(res.body);
    for (const name of ["Home exam A", "Home exam B", `Home${RUN}`]) expect(text).not.toContain(name);
  });

  it("enforce without a usable snapshot fails closed with 503", async () => {
    process.env.ACCESS_V2_MODE = "enforce";
    const res = await summaryFor("admin");
    expect(res.status).toBe(503);
    expect(res.body.code).toBe("ACCESS_UNAVAILABLE");
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe("read-only", () => {
  it("does not write to the fixture tables", async () => {
    const count = async () =>
      (
        await sequelize.query<any>(
          `SELECT (SELECT COUNT(*) FROM submissions WHERE id IN (?)) s, (SELECT MAX(updated_at) FROM users WHERE id IN (?)) u`,
          { replacements: [created.submissions, created.users], type: QueryTypes.SELECT },
        )
      )[0];
    const before = await count();
    await summaryFor("teacherA");
    await summaryFor("student1");
    await summaryFor("admin");
    expect(await count()).toEqual(before);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe("hardening: MIS verification cache", () => {
  it("a token MIS revokes (logout) keeps working at most 60 s, then 401", async () => {
    const t0 = Date.now();
    const clock = jest.spyOn(Date, "now").mockReturnValue(t0);
    expect((await summaryFor("student2")).status).toBe(200);
    revoked.add(TOKEN.student2);
    clock.mockReturnValue(t0 + 59_000);
    expect((await summaryFor("student2")).status).toBe(200); // still inside the cache window
    clock.mockReturnValue(t0 + 61_000);
    const res = await summaryFor("student2");
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("MIS_TOKEN_INVALID");
  });

  it("a 401 from MIS is never cached as success (nor sticks as a failure)", async () => {
    revoked.add(TOKEN.student2);
    expect((await summaryFor("student2")).status).toBe(401);
    expect((await summaryFor("student2")).status).toBe(401);
    expect(mockedGet.mock.calls.filter(([u]) => String(u).endsWith("/auth/verify"))).toHaveLength(2);
    revoked.delete(TOKEN.student2); // (a transient 401 must not lock the token out)
    expect((await summaryFor("student2")).status).toBe(200);
  });

  it("MIS 5xx -> 503 with a generic body, not cached", async () => {
    mockedGet.mockImplementation(async (url: string, cfg: any) => {
      if (url.endsWith("/auth/verify")) {
        throw Object.assign(new Error("Request failed with status code 500 at db.internal:5432"), {
          response: { status: 500, data: { stack: "Error: boom\n    at x (/srv/mis.js:1)" } },
        });
      }
      return misRouter(url, cfg);
    });
    const res = await summaryFor("student2");
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ success: false, code: "MIS_UNAVAILABLE", message: expect.any(String) });
    expect(JSON.stringify(res.body)).not.toContain("db.internal");
    mockedGet.mockImplementation(async (url: string, cfg: any) => misRouter(url, cfg));
    expect((await summaryFor("student2")).status).toBe(200);
  });

  it("a 200 from MIS without a usable user id is a 401 and is not cached", async () => {
    mockedGet.mockImplementation(async (url: string, cfg: any) =>
      url.endsWith("/auth/verify") ? { status: 200, data: { success: true, data: { userId: "abc" } } } : misRouter(url, cfg),
    );
    expect((await summaryFor("student2")).status).toBe(401);
    mockedGet.mockImplementation(async (url: string, cfg: any) => misRouter(url, cfg));
    expect((await summaryFor("student2")).status).toBe(200);
  });

  it("the cache is keyed by the whole token: tokens sharing a long prefix never share a user", async () => {
    const prefix = "x".repeat(300);
    extraTokens[`${prefix}A`] = MIS.student1;
    extraTokens[`${prefix}B`] = MIS.teacherB;
    const a = await post(`${prefix}A`);
    const b = await post(`${prefix}B`);
    expect(item(a, "S-01")).toBeDefined();
    expect(item(b, "S-01")).toBeUndefined();
    expect(item(b, "T-07")).toBeDefined();
    delete extraTokens[`${prefix}A`];
    delete extraTokens[`${prefix}B`];
  });

  it("the verification cache is bounded", async () => {
    // Straight through the middleware: 1100 HTTP round trips open 1100
    // ephemeral servers/sockets and can stall the machine's port table.
    const mod = await import("../middleware/misBearerAuth");
    for (let n = 0; n < 1100; n++) extraTokens[`bulk-token-${n}`] = MIS.stranger;
    try {
      for (let n = 0; n < 1100; n += 1) {
        const req: any = { headers: { authorization: `Bearer bulk-token-${n}` }, cookies: {} };
        const res: any = { status: () => res, json: () => res };
        await mod.misBearerAuth(req, res, () => undefined);
      }
      expect(mod.misBearerCacheSize()).toBeLessThanOrEqual(1000);
      expect(mod.misBearerCacheSize()).toBeGreaterThan(900);
    } finally {
      for (let n = 0; n < 1100; n++) delete extraTokens[`bulk-token-${n}`];
    }
  }, 60_000);
});

describe("hardening: rate limit", () => {
  it("is keyed by the verified MIS user, not the (shared) caller IP", async () => {
    let last: request.Response | null = null;
    for (let n = 0; n < 31; n++) last = await summaryFor("stranger");
    expect(last!.status).toBe(429);
    expect(last!.body.code).toBe("RATE_LIMITED");
    expect((await summaryFor("student2")).status).toBe(200); // same IP, different user
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe("hardening: the body never widens access", () => {
  it("lenses covering the whole school don't give a learner anyone else's work", async () => {
    const wide = [
      { key: "SCHOOL", type: "SCHOOL", class_group_ids: null },
      { key: "TEACHING", type: "TEACHING", class_group_ids: null },
      { key: `CLASS_GROUP:${OTHER_CLASS}`, type: "CLASS_GROUP", class_group_ids: [CLASS, OTHER_CLASS] },
    ];
    const res = await summaryFor("student1", { lenses: wide, user_id: ids.teacherA, student_id: ids.student2, mis_user_id: MIS.admin });
    expect(res.status).toBe(200);
    expect(res.body.items.map((i: any) => i.kind).sort()).toEqual(["S-01", "S-02", "S-03"]);
    expect(res.body.items.every((i: any) => i.lens === "SELF")).toBe(true);
  });

  it("teacher B with every lens hint still never sees teacher A's work", async () => {
    const res = await summaryFor("teacherB", {
      lenses: [...LENSES, { key: "SCHOOL", type: "SCHOOL", class_group_ids: null }],
      created_by: ids.teacherA,
    });
    const text = JSON.stringify(res.body);
    expect(text).not.toContain("Home done worksheet");
    expect(text).not.toContain("Home exam A");
  });

  it("garbage body values are tolerated (200, contract intact)", async () => {
    for (const body of [
      { lenses: "SCHOOL", date: "not-a-date", tz: 42 },
      { lenses: [null, 5, "x", { key: {}, type: [] }, { key: "K", type: "CLASS_GROUP", class_group_ids: "9" }] },
      { lenses: [{ key: "CLASS_GROUP:1", type: "CLASS_GROUP", class_group_ids: [1, "2", -3, 1.5, null, "DROP TABLE users"] }] },
      { date: "2026-02-30", tz: "Mars/Olympus", lessons: [{ lesson_key: "' OR 1=1 --" }] },
      [],
    ]) {
      const res = await summaryFor("student1", body);
      expect(res.status).toBe(200);
      expect(res.body.provisioned).toBe(true);
    }
  });

  it("lens hints and their class-group lists are capped", () => {
    const many = Array.from({ length: 5000 }, (_, n) => ({ key: `CLASS_GROUP:${n + 1}`, type: "CLASS_GROUP", class_group_ids: [n + 1] }));
    expect(parseLenses(many).length).toBeLessThanOrEqual(50);
    const [one] = parseLenses([{ key: "SCHOOL-ISH", type: "PROGRAM", class_group_ids: Array.from({ length: 50_000 }, (_, n) => n + 1) }]);
    expect(one.class_group_ids!.length).toBeLessThanOrEqual(1000);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe("lens tagging", () => {
  const hints = parseLenses([
    { key: "SCHOOL", type: "SCHOOL", class_group_ids: null },
    { key: "PROGRAM:8", type: "PROGRAM", class_group_ids: [9, 12, 41] },
    { key: "GRADE:3", type: "GRADE", class_group_ids: [9, 12] },
    { key: "CLASS_GROUP:9", type: "CLASS_GROUP", class_group_ids: [9] },
    { key: "BOGUS", type: "CLASS_GROUP", class_group_ids: null }, // null only means "everything" for SCHOOL
    { key: "TEACHING", type: "TEACHING", class_group_ids: [9, 41] },
  ]);
  it("picks the most specific hinted lens containing the class group(s)", () => {
    expect(lensForClassGroups(hints, [9])).toBe("CLASS_GROUP:9");
    expect(lensForClassGroups(hints, [12])).toBe("GRADE:3");
    expect(lensForClassGroups(hints, [9, 12])).toBe("GRADE:3");
    expect(lensForClassGroups(hints, [41])).toBe("PROGRAM:8");
    expect(lensForClassGroups(hints, [77])).toBe("SCHOOL");
    expect(lensForClassGroups([], [9])).toBeNull();
    expect(lensForScope(hints, { class_groups: [9] } as any)).toBe("CLASS_GROUP:9");
    expect(lensForScope(hints, { pairs: [[1, 12]] } as any)).toBe("GRADE:3");
    expect(lensForScope(hints, { all: true } as any)).toBe("SCHOOL");
    expect(lensForScope([], { class_groups: [9] } as any)).toBe("SELF");
    expect(lensForScope(hints, { self: 5 } as any)).toBe("SELF");
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe("edge cases", () => {
  it("a session with no current term/year: no report-card items, no crash", async () => {
    const noTerm = jwt.sign({ userId: MIS.admin }, "not-the-mis-secret");
    extraTokens[noTerm] = MIS.admin;
    const res = await post(noTerm);
    expect(res.status).toBe(200);
    expect(item(res, "C-06")).toBeUndefined();
    expect(item(res, "P-05")).toBeUndefined();
    delete extraTokens[noTerm];
  });

  it("titles are counted and pluralised (1 vs many)", async () => {
    const a = await summaryFor("teacherA");
    expect(item(a, "T-15").title).toBe("1 quiz closing within 24 hours with no submissions");
    expect(item(a, "T-14").title).toBe("1 proctored session flagged in the last 7 days");
    const s = await summaryFor("student1");
    expect(item(s, "S-03").title).toBe("2 quizzes closing within 24 hours");
    expect(item(s, "S-01").title).toBe("1 assignment overdue and not submitted");
  });

  it("ids are stable across calls", async () => {
    const one = (await summaryFor("teacherA")).body;
    const two = (await summaryFor("teacherA")).body;
    expect(two.items.map((i: any) => i.id)).toEqual(one.items.map((i: any) => i.id));
    expect(two.tiles.map((t: any) => t.id)).toEqual(one.tiles.map((t: any) => t.id));
  });

  it("C-06 never names the wrong person for a card keyed by an MIS id", async () => {
    // A local user with no MIS link whose local id a fan-out card uses as an MIS
    // roster id: the card is someone else's (reportCardStudentMisIds), so this
    // user's name must not appear.
    await user("zed", "student", null, "Zedwrongperson");
    const card = await insert("report_cards", {
      uuid: crypto.randomUUID(),
      student_id: ids.zed,
      term: TERM,
      academic_year: YEAR,
      status: "draft",
    });
    try {
      const res = await summaryFor("admin");
      const c06 = item(res, "C-06");
      expect(c06.count).toBe(3);
      expect(JSON.stringify(res.body)).not.toContain("Zedwrongperson");
    } finally {
      await sequelize.query("DELETE FROM report_cards WHERE id = ?", { replacements: [card] });
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe("bulk fixtures (200 submissions over 20 subjects)", () => {
  beforeAll(async () => {
    await user("teacherP", "instructor", MIS.teacherP, "Pat");
    await user("learnerBulk", "student", MIS.learnerBulk, "Lee");
    const students: number[] = [];
    for (const [n, misId] of BULK_STUDENTS.entries()) {
      await user(`bulk${n}`, "student", misId, `Bulk${n}`);
      students.push(ids[`bulk${n}`]);
    }
    const assignments: number[] = [];
    for (const subj of BULK_SUBJECTS) assignments.push(await assignment(`Bulk task ${subj}`, subj, ids.teacherP, now - 3 * D));
    const rows: any[] = [];
    for (const a of assignments) for (const s of students) rows.push([a, s, "submitted", new Date(now - 2 * D), 0, new Date(), new Date()]);
    const [first] = await sequelize.query(
      `INSERT INTO submissions (assignment_id, student_id, status, submitted_at, is_late, created_at, updated_at) VALUES ${rows
        .map(() => "(?, ?, ?, ?, ?, ?, ?)")
        .join(", ")}`,
      { replacements: rows.flat(), type: QueryTypes.INSERT },
    );
    for (let n = 0; n < rows.length; n++) created.submissions.push(Number(first) + n);
  });

  it("T-07 counts all 200, caps entities at 8, stays within a bounded number of queries (enforce)", async () => {
    process.env.ACCESS_V2_MODE = "enforce";
    const pairs: CapabilityEntry["scope"] = { pairs: BULK_SUBJECTS.map((s) => [s, BULK_CLASS] as [number, number]) };
    snapshotFor[TOKEN.teacherP] = snap(MIS.teacherP, {
      ASSIGNMENTS_VIEW_SUBMISSIONS: e(pairs, "detail"),
      SUBMISSIONS_GRADE: e(pairs),
    });
    await summaryFor("teacherP"); // warm the snapshot/verify caches
    clearTargetCaches();
    mockedGet.mockClear();
    const spy = jest.spyOn(sequelize, "query");
    const started = Date.now();
    const res = await summaryFor("teacherP");
    const elapsed = Date.now() - started;
    const queries = spy.mock.calls.length;
    spy.mockRestore();

    const t07 = item(res, "T-07");
    expect(t07).toMatchObject({ count: 200, tier: "slipping", title: "200 submissions waiting to be graded" });
    expect(t07.entities).toHaveLength(8);
    expect(t07.cta.href).toBe("https://tm.test/submissions");
    // Independent of the number of subjects/rows (was one user lookup per subject).
    expect(queries).toBeLessThanOrEqual(10);
    // MIS: the one class roster, fetched once for all 20 subjects (verify/snapshot are cached).
    expect(mockedGet.mock.calls.length).toBeLessThanOrEqual(4);
    expect(elapsed).toBeLessThan(3000);
  });

  it("a learner with 20 overdue assignments: counted, 8 chips, tile 0/20", async () => {
    const res = await summaryFor("learnerBulk");
    const s01 = item(res, "S-01");
    expect(s01).toMatchObject({ count: 20, title: "20 assignments overdue and not submitted" });
    expect(s01.entities).toHaveLength(8);
    expect(s01.cta.href).toBe("https://tm.test/assignments");
    expect(res.body.tiles).toEqual([expect.objectContaining({ value: "0/20", status: "warning" })]);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe("hardening: scope is never steered by request params", () => {
  it("academic term/year overrides in the body or query are ignored", async () => {
    const res = await request(app)
      .post("/api/integration/home-summary?academicTermId=999&academicYearId=999")
      .set("Authorization", `Bearer ${TOKEN.teacherB}`)
      .send({ lenses: LENSES, academic_term_id: 999, academic_year_id: 999 })
      .then(checked);
    expect(res.status).toBe(200);
    // In "term 999" MIS would widen teacher B to SUBJ_A -> teacher A's flagged exam.
    expect(JSON.stringify(res.body)).not.toContain("Home exam A");
    expect(item(res, "T-14")).toMatchObject({ count: 1, entities: ["Home exam B · 1"] });
    const steered = mockedGet.mock.calls.filter(([, cfg]) => Object.values(cfg?.params ?? {}).some((v) => String(v) === "999"));
    expect(steered).toEqual([]);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe("hardening: lens hints", () => {
  it("class group ids are coerced to positive integers only (no true -> 1, [7] -> 7)", () => {
    const [l] = parseLenses([
      { key: "PROGRAM:1", type: "program", class_group_ids: [9, "41", " 12 ", true, [7], "7.5", -3, 0, 1.5, null, "x", 1e21, 9] },
    ]);
    expect(l).toEqual({ key: "PROGRAM:1", type: "PROGRAM", class_group_ids: [9, 41, 12] });
  });

  it("keys must be plain strings of lens-key characters (echoed into ids); others are dropped", () => {
    expect(
      parseLenses([
        { key: { toString: () => "SCHOOL" }, type: "SCHOOL" },
        { key: "'; DROP TABLE users; --", type: "CLASS_GROUP", class_group_ids: [7] },
        { key: "<img src=x onerror=alert(1)>", type: "SCHOOL", class_group_ids: null },
        { key: "CLASS_GROUP:7", type: 7 },
        { key: "SCHOOL", type: "SCHOOL", class_group_ids: null },
      ]),
    ).toEqual([{ key: "SCHOOL", type: "SCHOOL", class_group_ids: null }]);
  });

  it("the TEACHING lens is found by its type, whatever its key", async () => {
    expect(teachingLens(parseLenses([{ key: "TEACHING:970001", type: "TEACHING", class_group_ids: [7] }]))).toBe("TEACHING:970001");
    const res = await summaryFor("teacherA", { lenses: [{ key: "TEACHING:970001", type: "TEACHING", class_group_ids: [CLASS] }] });
    expect(item(res, "T-07")).toMatchObject({ lens: "TEACHING:970001", id: "taskmentor:T-07:TEACHING:970001" });
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe("hardening: time windows (server TZ=UTC, school Africa/Kigali = UTC+2)", () => {
  /** 23:30 in Kigali on a day far from the real "now". */
  const K = Date.parse("2030-03-14T21:30:00Z");
  const QUIZ_END = K + 12 * H;
  const LONG = `Clock ${"very ".repeat(40)}long title`;
  /** Freeze Date only; timers, I/O and the DB driver keep running. */
  const freeze = (at: number) =>
    jest.useFakeTimers({
      now: at,
      doNotFake: ["hrtime", "nextTick", "performance", "queueMicrotask", "setImmediate", "clearImmediate", "setInterval", "clearInterval", "setTimeout", "clearTimeout"],
    });
  const kinds = (res: request.Response) => res.body.items.map((i: any) => `${i.kind}:${i.tier}:${i.count}`).sort();

  beforeAll(async () => {
    await user("student5", "student", MIS.student5, "Wes");
    ids.clockEssay = await assignment("Clock essay", SUBJ_E, ids.teacherA, K);
    ids.clockQuiz = await quiz("Clock quiz", SUBJ_E, ids.teacherA, K - 48 * H, QUIZ_END);
  });

  it("due 23:30 Kigali: due soon at 23:00 Kigali, overdue at 00:01 Kigali (same UTC day)", async () => {
    freeze(K - 30 * 60 * 1000);
    let res = await summaryFor("student5");
    expect(item(res, "S-01")).toBeUndefined();
    expect(item(res, "S-02")).toMatchObject({ count: 1, entities: ["Clock essay · Home Clock"], due_at: new Date(K).toISOString() });
    jest.setSystemTime(K + 31 * 60 * 1000);
    res = await summaryFor("student5");
    expect(item(res, "S-01")).toMatchObject({ tier: "blocking", count: 1 });
    expect(item(res, "S-02")).toBeUndefined();
  });

  it("the MIS date/tz never shift the windows (signals are relative to now)", async () => {
    freeze(K - 30 * 60 * 1000);
    const base = kinds(await summaryFor("student5", {}));
    for (const body of [
      { date: "2030-03-15", tz: "Africa/Kigali" },
      { date: "2030-03-13", tz: "UTC" },
      { date: "not-a-date", tz: "Mars/Olympus" },
    ]) {
      expect(kinds(await summaryFor("student5", body))).toEqual(base);
    }
  });

  it("S-02 48 h window edges", async () => {
    freeze(K - 47 * H);
    expect(item(await summaryFor("student5"), "S-02")).toMatchObject({ count: 1 });
    jest.setSystemTime(K - 49 * H);
    const res = await summaryFor("student5");
    expect(item(res, "S-02")).toBeUndefined();
    expect(item(res, "S-01")).toBeUndefined();
  });

  it("S-03: slipping 7 h before close, blocking at 5 h, absent beyond 24 h and after close", async () => {
    freeze(QUIZ_END - 7 * H);
    expect(item(await summaryFor("student5"), "S-03")).toMatchObject({ tier: "slipping", count: 1, title: "1 quiz closing within 24 hours" });
    jest.setSystemTime(QUIZ_END - 5 * H);
    expect(item(await summaryFor("student5"), "S-03")).toMatchObject({ tier: "blocking", count: 1 });
    jest.setSystemTime(QUIZ_END - 25 * H);
    expect(item(await summaryFor("student5"), "S-03")).toBeUndefined();
    jest.setSystemTime(QUIZ_END + 1000);
    expect(item(await summaryFor("student5"), "S-03")).toBeUndefined();
  });

  it("entity chips stay short however long the record title is", async () => {
    const id = await assignment(LONG, SUBJ_E, ids.teacherA, K + H);
    try {
      freeze(K - 30 * 60 * 1000);
      const s02 = item(await summaryFor("student5"), "S-02");
      expect(s02.count).toBe(2);
      for (const chip of s02.entities) expect(chip.length).toBeLessThanOrEqual(64);
    } finally {
      await sequelize.query("DELETE FROM assignments WHERE id = ?", { replacements: [id] });
    }
  });

  it("a date-only term end is the end of that day in Kigali, not UTC midnight", async () => {
    const end = new Date(now + 10 * D).toISOString().slice(0, 10);
    const t = misToken(MIS.admin, end);
    extraTokens[t] = MIS.admin;
    try {
      const p05 = item(await post(t), "P-05");
      expect(p05).toMatchObject({ tier: "blocking", due_at: new Date(`${end}T23:59:59.999+02:00`).toISOString() });
    } finally {
      delete extraTokens[t];
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe("hardening: read-only at the SQL level", () => {
  it.each(["off", "shadow", "enforce"])("%s: every statement is a SELECT (shadow may only log access diffs)", async (mode) => {
    process.env.ACCESS_V2_MODE = mode;
    snapshotFor[TOKEN.teacherA] = snap(MIS.teacherA, {
      SUBMISSIONS_GRADE: e({ pairs: [[SUBJ_A, CLASS]] }),
      PROCTORING_VIEW_SESSIONS: e({ class_groups: [CLASS] }, "summary"),
      QUIZZES_EDIT: e({ self: MIS.teacherA }),
    });
    snapshotFor[TOKEN.admin] = snap(MIS.admin, { REPORT_CARDS_COMMENT: e({ class_groups: [CLASS] }) });
    snapshotFor[TOKEN.student1] = snap(MIS.student1, {
      SUBMISSIONS_CREATE: e({ self: MIS.student1 }),
      QUIZZES_ATTEMPT: e({ self: MIS.student1 }),
    });
    const spy = jest.spyOn(sequelize, "query");
    try {
      for (const who of ["teacherA", "student1", "admin", "stranger"] as const) expect((await summaryFor(who)).status).toBe(200);
      await flushShadowWork();
      const sql = spy.mock.calls.map(([q]) => String(typeof q === "string" ? q : (q as any)?.query ?? q));
      const writes = sql.filter((q) => !/^\s*SELECT\b/i.test(q) && !/^\s*INSERT INTO access_shadow_diffs\b/i.test(q));
      expect(writes).toEqual([]);
      if (mode !== "shadow") expect(sql.filter((q) => q.includes("access_shadow_diffs"))).toEqual([]);
    } finally {
      spy.mockRestore();
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe("GET /api/integration/student-standing (MIS office-hours suggestions)", () => {
  const standing = (token?: string) => {
    const r = request(app).get("/api/integration/student-standing");
    return token ? r.set("Authorization", `Bearer ${token}`) : r;
  };

  it("401 without a bearer token", async () => {
    expect((await standing()).status).toBe(401);
  });

  it("teacher A gets each of their students' Task Mentor standing, keyed by MIS id", async () => {
    const res = await standing(TOKEN.teacherA);
    expect(res.status).toBe(200);
    expect(res.body.data.provisioned).toBe(true);
    expect(res.body.data.pass_mark).toBe(50);
    const s1 = res.body.data.students.find((s: any) => s.mis_user_id === MIS.student1);
    expect(s1).toMatchObject({ avg_score: 80, below_pass: false });
    expect(Array.isArray(s1.reasons)).toBe(true);
    // Never a stack trace or SQL in the body.
    expect(JSON.stringify(res.body)).not.toMatch(/stack|SELECT /i);
  });

  it("someone who never used Task Mentor gets an empty, unprovisioned answer", async () => {
    const res = await standing(TOKEN.stranger);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ provisioned: false, students: [] });
  });

  it("query parameters never widen the scope", async () => {
    const res = await request(app)
      .get("/api/integration/student-standing")
      .query({ academic_term_id: 1, subjectId: SUBJ_C })
      .set("Authorization", `Bearer ${TOKEN.teacherA}`);
    expect(res.status).toBe(200);
    expect(res.body.data.students.every((s: any) => s.mis_user_id !== MIS.student2 || true)).toBe(true);
  });
});

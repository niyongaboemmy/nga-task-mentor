import request from "supertest";
import axios from "axios";
import crypto from "crypto";
import { QueryTypes } from "sequelize";
import { buildTestApp, ensureModelsRegistered } from "./testApp";
import { sequelize } from "../config/database";
import { Role, QuestionBank, Submission } from "../models";
import { AiDraft } from "../models/AiDraft.model";
import { clearMisBearerCache } from "../middleware/misBearerAuth";
import { integrationLimiter } from "../middleware/rateLimiter.middleware";
import { resetAiPolicyCache, setAiPolicyForTests } from "../services/aiPolicy";
import { __setMisPermissionsFetcher } from "../services/aiHandoff";
import { AI_POLICY_DEFAULT } from "../vendor/nga-access";
import { paginate, RESULT_BUDGET_BYTES, TOOL_NAMES } from "../integration/mcpTools";

/**
 * NGA connector tools (EXTERNAL_AI_CONTRACT.md §2): GET /api/integration/mcp/tools and
 * POST /api/integration/mcp/call with the person's MIS token (misBearerAuth), real dev DB.
 * The MIS (verify, assigned subjects, /users/me permissions) is mocked.
 */

jest.mock("axios", () => {
  const actual = jest.requireActual("axios");
  return { __esModule: true, ...actual, default: { ...actual.default, get: jest.fn() } };
});
const mockedGet = axios.get as jest.Mock;

const RUN = crypto.randomBytes(3).toString("hex");
const SLOT = (parseInt(RUN, 16) % 4000) * 10;
const MIS = { teacher: 7_100_000 + SLOT + 1, other: 7_100_000 + SLOT + 2, student: 7_100_000 + SLOT + 3 };
const SUBJ = 7_200_000 + SLOT + 1;
const OTHER_SUBJ = 7_200_000 + SLOT + 2;
const TOKEN = { teacher: `tok-t-${RUN}`, other: `tok-o-${RUN}`, student: `tok-s-${RUN}` };
const PUPIL_FIRST = `Kalisa${RUN}`;

type Ext = { connector: boolean; handoff: boolean; pupilNames: "never" | "with_consent" };
const policy = (external: Partial<Ext> = {}) =>
  setAiPolicyForTests({
    ...AI_POLICY_DEFAULT,
    v: 1,
    enabled: true,
    external: { connector: true, handoff: true, pupilNames: "with_consent", ...external },
  } as any);

let app: ReturnType<typeof buildTestApp>;
const ids: Record<string, number> = {};
const created: Record<string, number[]> = { users: [], assignments: [], submissions: [], question_bank: [], quizzes: [] };
let externalFor: Record<string, string[]> = {};
const savedBase = process.env.NGA_MIS_BASE_URL;
const savedMode = process.env.ACCESS_V2_MODE;

async function insert(table: string, row: Record<string, any>): Promise<number> {
  const full: Record<string, any> = { created_at: new Date(), updated_at: new Date(), ...row };
  const cols = Object.keys(full);
  const [id] = await sequelize.query(`INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`, {
    replacements: cols.map((c) => full[c]),
    type: QueryTypes.INSERT,
  });
  created[table].push(Number(id));
  return Number(id);
}

async function user(key: keyof typeof MIS, roleName: string, first: string) {
  const role = await Role.findOne({ where: { name: roleName } });
  if (!role) throw new Error(`Role '${roleName}' not found -- run migrations first`);
  ids[key] = await insert("users", {
    first_name: first,
    last_name: `Mcp${RUN}`,
    email: `mcp-${key}-${RUN}@test.local`,
    password: "not-a-real-hash",
    role: roleName,
    role_id: role.id,
    mis_user_id: MIS[key],
  });
}

function misRouter(url: string, cfg: any) {
  const token = String(cfg?.headers?.Authorization ?? "").replace(/^Bearer /, "");
  const who = (Object.entries(TOKEN).find(([, t]) => t === token)?.[0] ?? null) as keyof typeof MIS | null;
  const ok = (data: any) => ({ status: 200, data: { success: true, data } });
  if (url.endsWith("/auth/verify")) {
    if (!who) throw Object.assign(new Error("Unauthorized"), { response: { status: 401 } });
    return ok({ userId: MIS[who], access_version: 1 });
  }
  if (url.endsWith("/academics/my-assigned-subjects")) {
    if (who === "teacher") return ok([{ id: SUBJ, name: "Mcp Biology", code: "BIO" }]);
    if (who === "other") return ok([{ id: OTHER_SUBJ, name: "Mcp History" }]);
    return ok([]);
  }
  if (url.endsWith("/users/me")) return ok({ currentAcademicTerms: [], currentAcademicYear: null, permissions: [] });
  return ok([]);
}

const tools = (who: keyof typeof TOKEN) =>
  request(app).get("/api/integration/mcp/tools").set("Authorization", `Bearer ${TOKEN[who]}`);
const call = (who: keyof typeof TOKEN, name: string, args: object = {}, consent?: object) =>
  request(app)
    .post("/api/integration/mcp/call")
    .set("Authorization", `Bearer ${TOKEN[who]}`)
    .send({ name, arguments: args, ...(consent ? { consent } : {}) });

beforeAll(async () => {
  process.env.NGA_MIS_BASE_URL = "http://mis.test/api";
  process.env.ACCESS_V2_MODE = "off";
  await ensureModelsRegistered();
  await AiDraft.sync();
  app = buildTestApp();
  await user("teacher", "instructor", "Tina");
  await user("other", "instructor", "Omar");
  await user("student", "student", PUPIL_FIRST);
  ids.assignment = await insert("assignments", {
    title: `Cells ${RUN}`,
    description: "Explain the cell",
    due_date: new Date(Date.now() + 86_400_000),
    max_score: 20,
    submission_type: "text",
    course_id: SUBJ,
    created_by: ids.teacher,
    status: "published",
    rubric: JSON.stringify([{ criteria: "Accuracy", max_score: 20 }]),
  });
  ids.submission = await insert("submissions", {
    assignment_id: ids.assignment,
    student_id: ids.student,
    status: "submitted",
    submitted_at: new Date(),
    is_late: 0,
    text_submission: `My name is ${PUPIL_FIRST}. A cell is the smallest unit of life. Mail me at kid@home.rw`,
  });
  ids.question = await insert("question_bank", {
    course_id: SUBJ,
    question_type: "single_choice",
    question_text: `What is the powerhouse of the cell ${RUN}?`,
    question_data: JSON.stringify({ options: ["Mitochondria", "Nucleus"], correct_option_index: 0 }),
    created_by: ids.teacher,
    difficulty_level: "EASY",
  });
  await insert("question_bank", {
    course_id: OTHER_SUBJ,
    question_type: "single_choice",
    question_text: `Who built the wall ${RUN}?`,
    question_data: JSON.stringify({ options: ["A", "B"], correct_option_index: 0 }),
    created_by: ids.other,
    difficulty_level: "EASY",
  });
});

beforeEach(() => {
  policy();
  externalFor = { [MIS.teacher]: ["AI_EXTERNAL_CONNECT"], [MIS.other]: [], [MIS.student]: ["AI_EXTERNAL_CONNECT"] };
  // The person's MIS permission list, keyed by the MIS token they came with.
  __setMisPermissionsFetcher(async (token) => {
    const who = Object.entries(TOKEN).find(([, t]) => t === token)?.[0] as keyof typeof MIS;
    return who ? externalFor[MIS[who]] ?? [] : [];
  });
  mockedGet.mockReset();
  mockedGet.mockImplementation(async (url: string, cfg: any) => misRouter(url, cfg));
  clearMisBearerCache();
  for (const id of Object.values(MIS)) integrationLimiter.resetKey(`mis:${id}`);
});

afterAll(async () => {
  __setMisPermissionsFetcher(null);
  resetAiPolicyCache();
  process.env.NGA_MIS_BASE_URL = savedBase;
  if (savedMode === undefined) delete process.env.ACCESS_V2_MODE;
  else process.env.ACCESS_V2_MODE = savedMode;
  await AiDraft.destroy({ where: { user_id: [ids.teacher, ids.other, ids.student].filter(Boolean) } });
  await sequelize.query("DELETE FROM tmcode_sessions WHERE user_id = ?", { replacements: [ids.student ?? 0] }).catch(() => undefined);
  for (const table of ["question_bank", "submissions", "quizzes", "assignments", "users"]) {
    if (created[table].length) await sequelize.query(`DELETE FROM ${table} WHERE id IN (?)`, { replacements: [created[table]] });
  }
  await sequelize.close();
});

describe("GET /mcp/tools", () => {
  it("is [] while the school's connector switch is off, and the call is EXTERNAL_OFF", async () => {
    policy({ connector: false });
    const res = await tools("teacher");
    expect(res.status).toBe(200);
    expect(res.body.tools).toEqual([]);
    const c = await call("teacher", "tm_list_my_courses");
    expect(c.status).toBe(403);
    expect(c.body.code).toBe("EXTERNAL_OFF");
  });

  it("lists every Task Mentor tool for a teacher with AI_EXTERNAL_CONNECT", async () => {
    const res = await tools("teacher");
    expect(res.status).toBe(200);
    const names = res.body.tools.map((t: any) => t.name).sort();
    expect(names).toEqual([...TOOL_NAMES].sort());
    const subs = res.body.tools.find((t: any) => t.name === "tm_list_submissions_to_grade");
    expect(subs).toMatchObject({ kind: "read", pupilData: true, inputSchema: { type: "object" } });
    expect(res.body.tools.find((t: any) => t.name === "tm_draft_feedback")).toMatchObject({ kind: "draft", pupilData: true });
  });

  it("is [] without AI_EXTERNAL_CONNECT, and for a student whatever their list says", async () => {
    expect((await tools("other")).body.tools).toEqual([]);
    expect((await tools("student")).body.tools).toEqual([]);
    const c = await call("student", "tm_list_my_courses");
    expect(c.status).toBe(403);
    expect(c.body.code).toBe("TOOL_FORBIDDEN");
  });

  it("rejects a missing or unknown MIS token", async () => {
    const res = await request(app).get("/api/integration/mcp/tools").set("Authorization", "Bearer nope");
    expect(res.status).toBe(401);
  });
});

describe("read tools", () => {
  it("tm_list_my_courses: the teacher's subjects with counts", async () => {
    const res = await call("teacher", "tm_list_my_courses");
    expect(res.status).toBe(200);
    expect(res.body.result.items).toEqual([
      expect.objectContaining({ course_id: SUBJ, name: "Mcp Biology", question_bank_count: 1, assignment_count: 1 }),
    ]);
    expect(res.body.summary).toMatch(/1 course/);
    expect(res.body.openUrl).toMatch(/\/courses$/);
  });

  it("tm_search_question_bank: only the subjects the teacher teaches, no answers", async () => {
    const res = await call("teacher", "tm_search_question_bank", { query: RUN });
    expect(res.status).toBe(200);
    expect(res.body.result.items).toHaveLength(1);
    expect(res.body.result.items[0]).toMatchObject({ id: ids.question, course_id: SUBJ, options: ["Mitochondria", "Nucleus"] });
    expect(JSON.stringify(res.body.result)).not.toContain("correct_option_index");
    const foreign = await call("teacher", "tm_search_question_bank", { course_id: OTHER_SUBJ });
    expect(foreign.status).toBe(403);
    expect(foreign.body.code).toBe("TOOL_FORBIDDEN");
    const bad = await call("teacher", "tm_search_question_bank", { course_id: "x" });
    expect(bad.status).toBe(400);
    expect(bad.body.code).toBe("BAD_ARGUMENTS");
  });

  it("tm_list_assignments: counts the submissions waiting for grading", async () => {
    const res = await call("teacher", "tm_list_assignments");
    expect(res.status).toBe(200);
    expect(res.body.result.items).toEqual([expect.objectContaining({ id: ids.assignment, has_rubric: true, waiting_for_grading: 1 })]);
  });

  it("an unknown tool is TOOL_UNKNOWN", async () => {
    const res = await call("teacher", "tm_delete_everything");
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("TOOL_UNKNOWN");
  });
});

describe("pupil data: tm_list_submissions_to_grade", () => {
  it('anonymises pupils as "Student N" and takes their name out of the text by default', async () => {
    const res = await call("teacher", "tm_list_submissions_to_grade");
    expect(res.status).toBe(200);
    const [row] = res.body.result.items;
    expect(row).toMatchObject({ submission_id: ids.submission, student: { label: "Student 1" }, max_score: 20 });
    expect(res.body.result.pupil_names).toBe(false);
    const text = JSON.stringify(res.body);
    expect(text).not.toContain(PUPIL_FIRST);
    expect(text).not.toContain("kid@home.rw");
    expect(row.text).toContain("[NAME]");
  });

  it("names pupils only with consent AND a with_consent policy", async () => {
    const named = await call("teacher", "tm_list_submissions_to_grade", {}, { pupilNames: true });
    expect(named.body.result.items[0].student).toEqual({ id: ids.student, name: `${PUPIL_FIRST} Mcp${RUN}` });
    expect(named.body.result.pupil_names).toBe(true);

    policy({ pupilNames: "never" });
    const never = await call("teacher", "tm_list_submissions_to_grade", {}, { pupilNames: true });
    expect(never.body.result.items[0].student).toEqual({ label: "Student 1" });
    expect(JSON.stringify(never.body)).not.toContain(PUPIL_FIRST);
  });

  it("never shows another teacher's submissions", async () => {
    externalFor[MIS.other] = ["AI_EXTERNAL_CONNECT"];
    const res = await call("other", "tm_list_submissions_to_grade");
    expect(res.status).toBe(200);
    expect(res.body.result.items).toEqual([]);
    const direct = await call("other", "tm_list_submissions_to_grade", { assignment_id: ids.assignment });
    expect(direct.status).toBe(403);
  });
});

describe("draft tools", () => {
  it("tm_add_questions_draft saves a draft and adds nothing to the bank", async () => {
    const before = await QuestionBank.count({ where: { course_id: SUBJ } });
    const res = await call("teacher", "tm_add_questions_draft", {
      course_id: SUBJ,
      questions: [
        {
          question_type: "single_choice",
          question_text: "Which organelle makes proteins?",
          question_data: { options: ["Ribosome", "Vacuole"], correct_option_index: 0 },
          difficulty_level: "EASY",
        },
        { question_type: "single_choice", question_text: "Broken", question_data: {} },
      ],
    });
    expect(res.status).toBe(200);
    expect(res.body.result).toMatchObject({ saved: 1, status: "draft" });
    expect(res.body.result.skipped).toHaveLength(1);
    expect(res.body.openUrl).toMatch(new RegExp(`/ai-drafts/${res.body.result.draft_id}$`));
    expect(await QuestionBank.count({ where: { course_id: SUBJ } })).toBe(before);
    const draft = await AiDraft.findByPk(res.body.result.draft_id);
    expect(draft).toMatchObject({ user_id: ids.teacher, kind: "questions", course_id: SUBJ, status: "draft" });

    const foreign = await call("teacher", "tm_add_questions_draft", { course_id: OTHER_SUBJ, questions: [{}] });
    expect(foreign.status).toBe(403);
  });

  it("tm_draft_rubric scales the marks to max_score and leaves the assignment alone", async () => {
    const res = await call("teacher", "tm_draft_rubric", {
      assignment_id: ids.assignment,
      criteria: [
        { criteria: "Accuracy", description: "Right facts", max_score: 3 },
        { criteria: "Diagram", max_score: 1 },
      ],
    });
    expect(res.status).toBe(200);
    expect(res.body.result.criteria.map((c: any) => c.max_score)).toEqual([15, 5]);
    const [row] = (await sequelize.query("SELECT rubric FROM assignments WHERE id = ?", { replacements: [ids.assignment], type: QueryTypes.SELECT })) as any[];
    expect(JSON.stringify(row.rubric)).toContain("Accuracy");
    expect(JSON.stringify(row.rubric)).not.toContain("Diagram");

    externalFor[MIS.other] = ["AI_EXTERNAL_CONNECT"];
    const notMine = await call("other", "tm_draft_rubric", { assignment_id: ids.assignment, criteria: [{ criteria: "X", max_score: 1 }] });
    expect(notMine.status).toBe(403);
  });

  it("tm_draft_feedback stores a private draft and never touches the submission", async () => {
    const res = await call("teacher", "tm_draft_feedback", {
      submission_id: ids.submission,
      feedback: "Good definition; add an example.",
      suggested_score: 15,
    });
    expect(res.status).toBe(200);
    expect(res.body.result).toMatchObject({ status: "draft", released: false, student: { label: "the student" } });
    const sub = await Submission.findByPk(ids.submission);
    expect(sub!.grade ?? null).toBeNull();
    expect(sub!.feedback ?? null).toBeNull();
    expect(sub!.status).toBe("submitted");
    const too = await call("teacher", "tm_draft_feedback", { submission_id: ids.submission, feedback: "x", suggested_score: 99 });
    expect(too.status).toBe(400);
  });

  it("refuses every tool while one of the teacher's TMCode exams is running (EXAM_ACTIVE)", async () => {
    const quizId = await insert("quizzes", {
      title: `Exam ${RUN}`,
      description: "exam",
      status: "published",
      type: "Quiz",
      course_id: SUBJ,
      created_by: ids.teacher,
    });
    try {
      await sequelize.query(
        `INSERT INTO tmcode_sessions (id, submission_id, quiz_id, user_id, device_id, mode, status, journal_nonce, last_seq, last_hmac, seb_verified, started_at, last_heartbeat)
         VALUES (?, 0, ?, ?, ?, 'secure', 'active', 'nonce', 0, '', 0, NOW(), NOW())`,
        { replacements: [crypto.randomUUID(), quizId, ids.student, crypto.randomUUID()] },
      );
      const res = await call("teacher", "tm_list_my_courses");
      expect(res.status).toBe(423);
      expect(res.body.code).toBe("EXAM_ACTIVE");
    } finally {
      await sequelize.query("DELETE FROM tmcode_sessions WHERE quiz_id = ?", { replacements: [quizId] });
    }
    expect((await call("teacher", "tm_list_my_courses")).status).toBe(200);
  });
});

describe("paginate", () => {
  it("pages with a cursor and keeps each page under the byte budget", () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({ i, blob: "x".repeat(5000) }));
    const first = paginate(rows, undefined, 100);
    expect(Buffer.byteLength(JSON.stringify(first))).toBeLessThanOrEqual(RESULT_BUDGET_BYTES + 200);
    expect(first.items.length).toBeLessThan(30);
    expect(first.next_cursor).toBe(String(first.items.length));
    const second = paginate(rows, first.next_cursor, 100);
    expect(second.items[0].i).toBe(first.items.length);
    expect(paginate(rows, "28", 5)).toMatchObject({ next_cursor: null, total: 30 });
  });
});

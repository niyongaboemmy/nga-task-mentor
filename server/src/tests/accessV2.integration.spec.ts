import request from "supertest";
import axios from "axios";
import { QueryTypes } from "sequelize";
import {
  buildTestApp,
  ensureModelsRegistered,
  findSeededUserByRole,
  signTokenFor,
} from "./testApp";
import { sequelize } from "../config/database";
import { ManualAssessment, ProctoringSession, Quiz, ReportCard, User } from "../models";
import type { AccessSnapshot, CapabilityEntry } from "../vendor/nga-access";
import { clearSnapshotCache } from "../access/snapshot";
import { clearTargetCaches } from "../access/targets";
import { __resetShadowThrottle, flushShadowWork } from "../access/policy";
import { getScopedSubjects } from "../utils/scopedSubjects";

/**
 * Access control v2 (Phase 5) against the real dev DB and the real
 * middleware chain, with every MIS HTTP call mocked (the MIS server is never
 * started). Run with --runInBand.
 *
 *   off      -> legacy behaviour, v2 never consulted
 *   shadow   -> legacy responses, disagreements counted in access_shadow_diffs
 *   enforce  -> v2 decides (report cards, proctoring, manual assessments,
 *               scoped subjects), fail closed without a snapshot
 */

jest.mock("axios", () => {
  const actual = jest.requireActual("axios");
  return { __esModule: true, ...actual, default: { ...actual.default, get: jest.fn() } };
});
const mockedGet = axios.get as jest.Mock;

const SUBJECT_A = 990001;
const SUBJECT_B = 990002;
const CLASS = 7;
const OTHER_CLASS = 8;
const TERM = "ACCESSV2-T1";
const YEAR = "ACCESSV2-Y";

// ── MIS mock ────────────────────────────────────────────────────────────────
let snapshotFor: Record<string, AccessSnapshot | "down"> = {};
let placementOf: Record<number, number | null> = {};
let rosterOf: Record<number, number[]> = {};

function misRouter(url: string, cfg: any) {
  const token = String(cfg?.headers?.Authorization ?? "").replace(/^Bearer /, "");
  const ok = (data: any) => ({ status: 200, data: { success: true, data } });
  if (url.endsWith("/access/me")) {
    const s = snapshotFor[token];
    if (!s || s === "down") throw Object.assign(new Error("Service Unavailable"), { response: { status: 503 } });
    return ok(s);
  }
  let m = url.match(/\/academics\/students\/(\d+)\/class-group$/);
  if (m) {
    const cg = placementOf[Number(m[1])];
    return ok(cg ? { class_group_id: cg, grade_id: 3, program_id: 1 } : null);
  }
  m = url.match(/\/academics\/class-groups\/(\d+)\/students$/);
  if (m) return ok((rosterOf[Number(m[1])] ?? []).map((user_id) => ({ user_id })));
  m = url.match(/\/academics\/students\/(\d+)\/enrolled-subjects$/);
  if (m) return ok([{ subject_id: SUBJECT_A, subject_name: "Access Maths" }]);
  if (url.endsWith("/academics/subjects") || url.endsWith("/academics/my-assigned-subjects")) {
    return ok([
      { id: SUBJECT_A, name: "Access Maths" },
      { id: SUBJECT_B, name: "Access Physics" },
    ]);
  }
  if (url.endsWith("/users/me")) return ok({ currentAcademicTerms: [], currentAcademicYear: null });
  throw new Error(`unexpected MIS call ${url}`);
}

const e = (scope: CapabilityEntry["scope"], depth: CapabilityEntry["depth"] = null): CapabilityEntry[] => [
  { depth, scope, via: [1] },
];
function snap(misUserId: number, caps: Record<string, CapabilityEntry[]>): AccessSnapshot {
  return {
    v: 1,
    app: "tm",
    core: "1.0.0",
    user: { id: misUserId, persona: "TEACHER", school_id: 1 },
    year: 5,
    caps,
    grants: {},
    home: null,
    systems: ["tm"],
    generated_at: new Date().toISOString(),
  };
}

const misAccessCalls = () => mockedGet.mock.calls.filter(([url]) => String(url).endsWith("/access/me")).length;

// ── fixtures ────────────────────────────────────────────────────────────────
let app: ReturnType<typeof buildTestApp>;
let instructor: User;
let student: User;
let instructorToken: string;
let studentToken: string;
let card: ReportCard;
let quiz: Quiz;
let session: ProctoringSession;
let assessA: ManualAssessment;
let assessB: ManualAssessment;
const startedAt = new Date(Date.now() - 1000);
const savedMode = process.env.ACCESS_V2_MODE;
const savedBase = process.env.NGA_MIS_BASE_URL;

const I_TOKEN = "mis-instructor";
const S_TOKEN = "mis-student";
const asInstructor = (r: request.Test) => r.set("Authorization", `Bearer ${instructorToken}`).set("x-mis-token", I_TOKEN);
const asStudent = (r: request.Test) => r.set("Authorization", `Bearer ${studentToken}`).set("x-mis-token", S_TOKEN);

async function diffRows(userId: number) {
  return sequelize.query<any>(
    "SELECT capability, route, legacy_allowed, v2_allowed, hits, sample_target FROM access_shadow_diffs WHERE user_id = ? AND first_seen >= ? ORDER BY id",
    { replacements: [userId, startedAt], type: QueryTypes.SELECT },
  );
}

beforeAll(async () => {
  process.env.NGA_MIS_BASE_URL = "http://mis.test/api";
  await ensureModelsRegistered();
  app = buildTestApp();
  const admin = await findSeededUserByRole("admin");
  instructor = await findSeededUserByRole("instructor");
  student = await findSeededUserByRole("student");
  if (!instructor.mis_user_id || !student.mis_user_id) {
    throw new Error("accessV2 spec needs the seeded instructor and student to have users.mis_user_id set");
  }
  instructorToken = signTokenFor(instructor.id);
  studentToken = signTokenFor(student.id);

  card = await ReportCard.create({
    student_id: student.id,
    term: TERM,
    academic_year: YEAR,
    status: "saved",
    attendance_present: 0,
    attendance_absent: 0,
    attendance_late: 0,
  } as any);
  quiz = await Quiz.create({
    title: "Access v2 proctoring quiz",
    description: "Created by accessV2.integration.spec.ts",
    instructions: "n/a",
    type: "Exam",
    course_id: SUBJECT_A,
    created_by: admin.id,
  } as any);
  session = await ProctoringSession.create({
    quiz_id: quiz.id,
    student_id: student.id,
    session_token: `accessv2-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    status: "active",
    start_time: new Date(),
  } as any);
  const base = { title: "Access v2 test", max_score: 20, term: TERM, academic_year: YEAR, created_by: admin.id };
  assessA = await ManualAssessment.create({ ...base, course_id: SUBJECT_A } as any);
  assessB = await ManualAssessment.create({ ...base, course_id: SUBJECT_B } as any);
});

beforeEach(async () => {
  await flushShadowWork();
  await sequelize.query("DELETE FROM access_shadow_diffs WHERE user_id IN (?, ?) AND first_seen >= ?", {
    replacements: [instructor.id, student.id, startedAt],
  });
  mockedGet.mockReset();
  mockedGet.mockImplementation(async (url: string, cfg: any) => misRouter(url, cfg));
  snapshotFor = {};
  placementOf = { [student.mis_user_id!]: CLASS };
  rosterOf = { [CLASS]: [student.mis_user_id!] };
  clearSnapshotCache();
  clearTargetCaches();
  __resetShadowThrottle();
});

afterAll(async () => {
  if (savedMode === undefined) delete process.env.ACCESS_V2_MODE;
  else process.env.ACCESS_V2_MODE = savedMode;
  process.env.NGA_MIS_BASE_URL = savedBase;
  await flushShadowWork();
  await sequelize.query("DELETE FROM report_card_attributes WHERE report_card_id = ?", { replacements: [card?.id ?? 0] });
  await ReportCard.destroy({ where: { term: TERM, academic_year: YEAR } });
  if (session) await ProctoringSession.destroy({ where: { id: session.id } });
  if (quiz) await Quiz.destroy({ where: { id: quiz.id } });
  await ManualAssessment.destroy({ where: { term: TERM, academic_year: YEAR } });
  await sequelize.query("DELETE FROM access_shadow_diffs WHERE user_id IN (?, ?) AND first_seen >= ?", {
    replacements: [instructor?.id ?? 0, student?.id ?? 0, startedAt],
  });
  await sequelize.close();
});

const cardUrl = () => `/api/report-cards/student/${student.id}?term=${TERM}&academic_year=${YEAR}`;

// ───────────────────────────────────────────────────────────────────────────
describe("ACCESS_V2_MODE=off (the default under test)", () => {
  beforeEach(() => {
    delete process.env.ACCESS_V2_MODE;
  });

  it("keeps legacy decisions and never asks MIS for a snapshot", async () => {
    snapshotFor[I_TOKEN] = snap(instructor.mis_user_id!, {}); // would deny everything
    const res = await asInstructor(request(app).get(cardUrl()));
    expect(res.status).toBe(200);
    expect(res.body.data.report_card.id).toBe(card.id);
    const list = await asInstructor(
      request(app).get(`/api/manual-assessments?course_ids=${SUBJECT_A},${SUBJECT_B}&term=${TERM}&academic_year=${YEAR}`),
    );
    expect(list.status).toBe(200);
    expect(list.body.data.map((a: any) => a.course_id).sort()).toEqual([SUBJECT_A, SUBJECT_B]);
    const s = await asInstructor(request(app).get(`/api/proctoring/sessions/${session.id}`));
    expect(s.status).toBe(200);
    await flushShadowWork();
    expect(misAccessCalls()).toBe(0);
    expect(await diffRows(instructor.id)).toHaveLength(0);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe("ACCESS_V2_MODE=shadow", () => {
  beforeEach(() => {
    process.env.ACCESS_V2_MODE = "shadow";
  });

  it("returns exactly the legacy response and records the disagreements", async () => {
    process.env.ACCESS_V2_MODE = "off";
    const legacy = await asInstructor(request(app).get(cardUrl()));
    process.env.ACCESS_V2_MODE = "shadow";

    snapshotFor[I_TOKEN] = snap(instructor.mis_user_id!, {}); // v2: nothing
    const res = await asInstructor(request(app).get(cardUrl()));
    expect(res.status).toBe(legacy.status);
    expect(res.body).toEqual(legacy.body);
    await flushShadowWork();

    const rows = await diffRows(instructor.id);
    const caps = rows.map((r: any) => r.capability);
    // the route guard ("held anywhere") and the scoped VIEW_ALL check
    expect(caps).toEqual(expect.arrayContaining(["REPORT_CARDS_VIEW_OWN|REPORT_CARDS_VIEW_ALL", "REPORT_CARDS_VIEW_ALL"]));
    for (const r of rows) {
      expect(Number(r.legacy_allowed)).toBe(1);
      expect(Number(r.v2_allowed)).toBe(0);
      expect(r.route).toContain("/api/report-cards/student/:studentId");
    }
  });

  it("throttles writes and counts repeats in hits", async () => {
    snapshotFor[I_TOKEN] = snap(instructor.mis_user_id!, {});
    await asInstructor(request(app).get(`/api/manual-assessments/${assessA.id}/scores`));
    await asInstructor(request(app).get(`/api/manual-assessments/${assessA.id}/scores`)); // throttled
    await flushShadowWork();
    const hits = async () =>
      (await diffRows(instructor.id)).find((r: any) => r.capability === "MANUAL_ASSESSMENTS_VIEW" && r.route.includes("/scores"))?.hits;
    const first = Number(await hits());
    __resetShadowThrottle();
    await asInstructor(request(app).get(`/api/manual-assessments/${assessA.id}/scores`));
    await flushShadowWork();
    expect(Number(await hits())).toBe(first + 1);
  });

  it("logs a list that v2 would narrow, without narrowing it", async () => {
    snapshotFor[I_TOKEN] = snap(instructor.mis_user_id!, {
      MANUAL_ASSESSMENTS_VIEW: e({ subjects: [SUBJECT_A] }, "detail"),
    });
    const res = await asInstructor(
      request(app).get(`/api/manual-assessments?course_ids=${SUBJECT_A},${SUBJECT_B}&term=${TERM}&academic_year=${YEAR}`),
    );
    expect(res.status).toBe(200);
    expect(res.body.data.map((a: any) => a.course_id).sort()).toEqual([SUBJECT_A, SUBJECT_B]);
    await flushShadowWork();
    const row = (await diffRows(instructor.id)).find(
      (r: any) => r.capability === "MANUAL_ASSESSMENTS_VIEW" && r.route === "GET /api/manual-assessments/",
    );
    expect(row).toBeDefined();
    expect(JSON.parse(row.sample_target).dropped).toEqual([SUBJECT_B]);
  });

  it("skips silently when the snapshot is unavailable", async () => {
    snapshotFor[I_TOKEN] = "down";
    const res = await asInstructor(request(app).get(cardUrl()));
    expect(res.status).toBe(200);
    await flushShadowWork();
    expect(misAccessCalls()).toBe(1); // one attempt, then the failure is remembered
    expect(await diffRows(instructor.id)).toHaveLength(0);
  });

  it("compares getScopedSubjects with the v2 subject set", async () => {
    snapshotFor[I_TOKEN] = snap(instructor.mis_user_id!, {
      ASSIGNMENTS_VIEW_SUBMISSIONS: e({ pairs: [[SUBJECT_B, CLASS]] }, "detail"),
    });
    const req: any = {
      method: "GET",
      baseUrl: "/api/assignments",
      path: "/grouped",
      user: { id: instructor.id, mis_user_id: instructor.mis_user_id, permissions: new Set(["ASSIGNMENTS_VIEW_SUBMISSIONS"]) },
      headers: { "x-mis-token": I_TOKEN },
      cookies: {},
      query: { academicTermId: "1" },
      body: {},
    };
    const out = await getScopedSubjects(req);
    expect(out.scope).toBe("assigned");
    expect(out.subjects.map((s) => s.id).sort()).toEqual([SUBJECT_A, SUBJECT_B]); // legacy answer
    await flushShadowWork();
    const row = (await diffRows(instructor.id)).find((r: any) => r.capability === "scopedSubjects:assigned");
    expect(row).toBeDefined();
    expect(Number(row.legacy_allowed)).toBe(1);
    expect(JSON.parse(row.sample_target).subjects).toEqual([SUBJECT_A]);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe("ACCESS_V2_MODE=enforce", () => {
  beforeEach(() => {
    process.env.ACCESS_V2_MODE = "enforce";
  });

  describe("report cards", () => {
    it("lets a class-scoped reader see a student of that class only", async () => {
      snapshotFor[I_TOKEN] = snap(instructor.mis_user_id!, {
        REPORT_CARDS_VIEW_ALL: e({ class_groups: [CLASS] }, "detail"),
      });
      expect((await asInstructor(request(app).get(cardUrl()))).status).toBe(200);

      clearTargetCaches();
      placementOf[student.mis_user_id!] = OTHER_CLASS;
      expect((await asInstructor(request(app).get(cardUrl()))).status).toBe(403);
    });

    it("does not let summary-only readers open a card", async () => {
      snapshotFor[I_TOKEN] = snap(instructor.mis_user_id!, {
        REPORT_CARDS_VIEW_ALL: e({ all: true }, "summary"),
      });
      expect((await asInstructor(request(app).get(cardUrl()))).status).toBe(403);
    });

    it("limits a student to their own (approved) card", async () => {
      await card.update({ status: "approved" });
      try {
        snapshotFor[S_TOKEN] = snap(student.mis_user_id!, {
          REPORT_CARDS_VIEW_OWN: e({ self: student.mis_user_id! }, "detail"),
        });
        expect((await asStudent(request(app).get(cardUrl()))).status).toBe(200);

        clearSnapshotCache();
        snapshotFor[S_TOKEN] = snap(student.mis_user_id!, {
          REPORT_CARDS_VIEW_OWN: e({ self: 99999999 }, "detail"), // someone else's SELF
        });
        expect((await asStudent(request(app).get(cardUrl()))).status).toBe(403);
      } finally {
        await card.update({ status: "saved" });
      }
    });

    it("needs APPROVE and PUBLISH over the student to approve (= publish)", async () => {
      snapshotFor[I_TOKEN] = snap(instructor.mis_user_id!, {
        REPORT_CARDS_APPROVE: e({ class_groups: [CLASS] }),
      });
      const patch = (status: string) =>
        asInstructor(request(app).patch(`/api/report-cards/${card.id}/status`).send({ status }));
      expect((await patch("approved")).status).toBe(403);

      clearSnapshotCache();
      snapshotFor[I_TOKEN] = snap(instructor.mis_user_id!, {
        REPORT_CARDS_APPROVE: e({ class_groups: [CLASS] }),
        REPORT_CARDS_PUBLISH: e({ class_groups: [OTHER_CLASS] }),
      });
      expect((await patch("approved")).status).toBe(403);

      clearSnapshotCache();
      snapshotFor[I_TOKEN] = snap(instructor.mis_user_id!, {
        REPORT_CARDS_APPROVE: e({ class_groups: [CLASS] }),
        REPORT_CARDS_PUBLISH: e({ class_groups: [CLASS] }),
      });
      expect((await patch("approved")).status).toBe(200);
      expect((await patch("saved")).status).toBe(200);
    });

    it("moves draft <-> saved with REPORT_CARDS_EDIT over the class", async () => {
      snapshotFor[I_TOKEN] = snap(instructor.mis_user_id!, { REPORT_CARDS_EDIT: e({ class_groups: [OTHER_CLASS] }) });
      const patch = () => asInstructor(request(app).patch(`/api/report-cards/${card.id}/status`).send({ status: "saved" }));
      expect((await patch()).status).toBe(403);
      clearSnapshotCache();
      snapshotFor[I_TOKEN] = snap(instructor.mis_user_id!, { REPORT_CARDS_EDIT: e({ class_groups: [CLASS] }) });
      expect((await patch()).status).toBe(200);
    });

    it("gates the class-teacher comment on REPORT_CARDS_COMMENT over the class group", async () => {
      const body = {
        student_id: student.id,
        term: TERM,
        academic_year: YEAR,
        class_teacher_comment: "Access v2 test comment",
        attributes: [{ attribute_name: "Punctuality", rating: "Good" }],
      };
      const save = () => asInstructor(request(app).post("/api/report-cards/attributes/save").send(body));

      snapshotFor[I_TOKEN] = snap(instructor.mis_user_id!, { REPORT_CARDS_EDIT: e({ all: true }) });
      expect((await save()).status).toBe(403); // marks entry is not the comment

      clearSnapshotCache();
      snapshotFor[I_TOKEN] = snap(instructor.mis_user_id!, { REPORT_CARDS_COMMENT: e({ class_groups: [OTHER_CLASS] }) });
      expect((await save()).status).toBe(403);

      clearSnapshotCache();
      snapshotFor[I_TOKEN] = snap(instructor.mis_user_id!, { REPORT_CARDS_COMMENT: e({ class_groups: [CLASS] }) });
      expect((await save()).status).toBe(200);
    });

    it("filters the overview list to students in scope", async () => {
      snapshotFor[I_TOKEN] = snap(instructor.mis_user_id!, {
        REPORT_CARDS_VIEW_ALL: e({ class_groups: [OTHER_CLASS] }, "detail"),
      });
      const res = await asInstructor(
        request(app).get(`/api/report-cards/overview?term=${TERM}&academic_year=${YEAR}&student_ids=${student.id}`),
      );
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);

      clearSnapshotCache();
      snapshotFor[I_TOKEN] = snap(instructor.mis_user_id!, {
        REPORT_CARDS_VIEW_ALL: e({ class_groups: [CLASS] }, "detail"),
      });
      const ok = await asInstructor(
        request(app).get(`/api/report-cards/overview?term=${TERM}&academic_year=${YEAR}&student_ids=${student.id}`),
      );
      expect(ok.body.data.map((r: any) => r.report_card_id)).toEqual([card.id]);
    });
    it("scopes the admin list and summary to students in scope", async () => {
      snapshotFor[I_TOKEN] = snap(instructor.mis_user_id!, {
        REPORT_CARDS_VIEW_ALL: e({ class_groups: [OTHER_CLASS] }, "summary"),
      });
      const q = `term=${TERM}&academic_year=${YEAR}`;
      expect((await asInstructor(request(app).get(`/api/report-cards/admin/students?${q}`))).body.data).toEqual([]);
      const sum = await asInstructor(request(app).get(`/api/report-cards/admin/summary?${q}`));
      expect(sum.status).toBe(200);
      expect(sum.body.data.total_report_cards).toBe(0);

      clearSnapshotCache();
      snapshotFor[I_TOKEN] = snap(instructor.mis_user_id!, {
        REPORT_CARDS_VIEW_ALL: e({ class_groups: [CLASS] }, "summary"),
      });
      // summary depth: aggregates yes, the named list no
      expect((await asInstructor(request(app).get(`/api/report-cards/admin/summary?${q}`))).body.data.total_report_cards).toBe(1);
      expect((await asInstructor(request(app).get(`/api/report-cards/admin/students?${q}`))).body.data).toEqual([]);
    });

    it("needs REPORT_CARDS_EDIT on the subject to save its mapping", async () => {
      snapshotFor[I_TOKEN] = snap(instructor.mis_user_id!, { REPORT_CARDS_EDIT: e({ pairs: [[SUBJECT_B, CLASS]] }) });
      const res = await asInstructor(
        request(app)
          .post("/api/report-cards/subject-mapping/save")
          .send({ subject_id: SUBJECT_A, term: TERM, academic_year: YEAR, assessments: [] }),
      );
      expect(res.status).toBe(403);
    });
  });

  describe("proctoring", () => {
    const view = () => asInstructor(request(app).get(`/api/proctoring/sessions/${session.id}`));

    it("scopes a session to the (subject, class) of its student", async () => {
      snapshotFor[I_TOKEN] = snap(instructor.mis_user_id!, {
        PROCTORING_VIEW_SESSIONS: e({ pairs: [[SUBJECT_A, CLASS]] }, "detail"),
      });
      expect((await view()).status).toBe(200);

      clearSnapshotCache();
      snapshotFor[I_TOKEN] = snap(instructor.mis_user_id!, {
        PROCTORING_VIEW_SESSIONS: e({ pairs: [[SUBJECT_A, OTHER_CLASS]] }, "detail"),
      });
      expect((await view()).status).toBe(403);

      clearSnapshotCache();
      snapshotFor[I_TOKEN] = snap(instructor.mis_user_id!, {
        PROCTORING_VIEW_SESSIONS: e({ subjects: [SUBJECT_B] }, "detail"),
      });
      expect((await view()).status).toBe(403);
    });

    it("lists only the quiz's sessions of students in scope", async () => {
      const caps = {
        PROCTORING_VIEW_SESSIONS: e({ pairs: [[SUBJECT_A, CLASS]] as [number, number][] }, "detail"),
        PROCTORING_VIEW_ANALYTICS: e({ pairs: [[SUBJECT_A, CLASS]] as [number, number][] }, "detail"),
      };
      snapshotFor[I_TOKEN] = snap(instructor.mis_user_id!, caps);
      const url = `/api/proctoring/quizzes/${quiz.id}/proctoring/sessions`;
      const res = await asInstructor(request(app).get(url));
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(1);

      clearTargetCaches();
      rosterOf[CLASS] = []; // the student is not in the teacher's class
      const narrowed = await asInstructor(request(app).get(url));
      expect(narrowed.status).toBe(200);
      expect(narrowed.body.count).toBe(0);
    });
  });

  describe("manual assessments", () => {
    it("scopes scores and lists to the subject", async () => {
      snapshotFor[I_TOKEN] = snap(instructor.mis_user_id!, {
        MANUAL_ASSESSMENTS_VIEW: e({ subjects: [SUBJECT_A] }, "detail"),
      });
      expect((await asInstructor(request(app).get(`/api/manual-assessments/${assessA.id}/scores`))).status).toBe(200);
      expect((await asInstructor(request(app).get(`/api/manual-assessments/${assessB.id}/scores`))).status).toBe(403);
      const list = await asInstructor(
        request(app).get(`/api/manual-assessments?course_ids=${SUBJECT_A},${SUBJECT_B}&term=${TERM}&academic_year=${YEAR}`),
      );
      expect(list.status).toBe(200);
      expect(list.body.data.map((a: any) => a.course_id)).toEqual([SUBJECT_A]);
    });

    it("refuses edits outside the subject", async () => {
      snapshotFor[I_TOKEN] = snap(instructor.mis_user_id!, {
        MANUAL_ASSESSMENTS_EDIT: e({ subjects: [SUBJECT_A] }),
      });
      const patch = (id: number) =>
        asInstructor(request(app).patch(`/api/manual-assessments/${id}`).send({ title: "Access v2 test" }));
      expect((await patch(assessA.id)).status).toBe(200);
      expect((await patch(assessB.id)).status).toBe(403);
    });

    it("fails closed (503) when no snapshot is available", async () => {
      snapshotFor[I_TOKEN] = "down";
      const res = await asInstructor(request(app).get(`/api/manual-assessments/${assessA.id}/scores`));
      expect(res.status).toBe(503);
    });
  });

  describe("getScopedSubjects", () => {
    const fakeReq = (misUserId: number, token: string): any => ({
      method: "GET",
      path: "/",
      user: { id: 1, mis_user_id: misUserId, permissions: new Set() },
      headers: { "x-mis-token": token },
      cookies: {},
      query: {},
      body: {},
    });

    it("uses the snapshot's subjects for staff", async () => {
      snapshotFor[I_TOKEN] = snap(instructor.mis_user_id!, {
        ASSIGNMENTS_VIEW_SUBMISSIONS: e({ pairs: [[SUBJECT_B, CLASS]] }, "detail"),
      });
      const out = await getScopedSubjects(fakeReq(instructor.mis_user_id!, I_TOKEN));
      expect(out).toEqual({ scope: "assigned", subjects: [{ id: SUBJECT_B, name: "Access Physics", code: null }] });
    });

    it("gives school-wide scope to an `all` grant and enrolment to SELF-only holders", async () => {
      snapshotFor[I_TOKEN] = snap(instructor.mis_user_id!, { ASSIGNMENTS_MANAGE_ANY: e({ all: true }) });
      expect((await getScopedSubjects(fakeReq(instructor.mis_user_id!, I_TOKEN))).scope).toBe("all");

      snapshotFor[S_TOKEN] = snap(student.mis_user_id!, { COURSES_VIEW: e({ self: student.mis_user_id! }, "detail") });
      const s = await getScopedSubjects(fakeReq(student.mis_user_id!, S_TOKEN));
      expect(s.scope).toBe("enrolled");
      expect(s.subjects.map((x) => x.id)).toEqual([SUBJECT_A]);
    });

    it("sees nothing without a snapshot", async () => {
      snapshotFor[I_TOKEN] = "down";
      expect(await getScopedSubjects(fakeReq(instructor.mis_user_id!, I_TOKEN))).toEqual({ scope: "none", subjects: [] });
    });
  });

  it("GET /api/access/me returns the snapshot", async () => {
    snapshotFor[I_TOKEN] = snap(instructor.mis_user_id!, { COURSES_VIEW: e({ subjects: [SUBJECT_A] }, "detail") });
    const res = await asInstructor(request(app).get("/api/access/me"));
    expect(res.status).toBe(200);
    expect(res.body.data.mode).toBe("enforce");
    expect(res.body.data.available).toBe(true);
    expect(res.body.data.snapshot.caps.COURSES_VIEW[0].scope.subjects).toEqual([SUBJECT_A]);
  });
});

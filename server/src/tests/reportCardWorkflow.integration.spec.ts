import request from "supertest";
import axios from "axios";
import crypto from "crypto";
import { buildTestApp, ensureModelsRegistered, findSeededUserByRole, signTokenFor } from "./testApp";
import { sequelize } from "../config/database";
import {
  ManualAssessment,
  ManualAssessmentScore,
  ReportCard,
  ReportCardAssessment,
  ReportCardAttribute,
  ReportCardSnapshot,
  ReportCardTransition,
  ReportCycle,
  ReportCycleSubjectSignoff,
  SubjectAssessmentMapping,
  User,
} from "../models";
import { verifyReportCard, } from "../controllers/reportCard.controller";
import { publishDueCards } from "../controllers/reportCardWorkflow.controller";
import { clearSchoolDirectoryCache } from "../services/schoolDirectory";
import { clearSubjectNameCache } from "../services/reportCardDocument";
import { clearReportAnalyticsCache } from "../controllers/reportAnalytics.controller";
import { NGA_ATTRIBUTES } from "../services/tenantSettings";

/**
 * The report card workflow end to end against the dev DB, MIS mocked:
 * draft -> (sign-off) -> reviewed -> approved (snapshot) -> published, the
 * edit lock, reopen + versioning, QR verification of a withdrawn version,
 * scheduled release, the workbench, history and the school reports.
 * Run with --runInBand.
 */

jest.mock("axios", () => {
  const actual = jest.requireActual("axios");
  return { __esModule: true, ...actual, default: { ...actual.default, get: jest.fn(), post: jest.fn() } };
});
// The file server is another service: keep uploads in memory.
const stored = new Map<string, Buffer>();
jest.mock("../utils/fileServer", () => ({
  __esModule: true,
  default: {
    uploadFile: jest.fn(async (buf: Buffer, path: string) => void stored.set(path, buf)),
    downloadToBuffer: jest.fn(async (path: string) => {
      const b = stored.get(path);
      if (!b) throw new Error("missing");
      return b;
    }),
    fileExists: jest.fn(async (p: string) => stored.has(p)),
    deleteFile: jest.fn(async (p: string) => void stored.delete(p)),
  },
}));

const mockedGet = axios.get as jest.Mock;
const RUN = crypto.randomBytes(3).toString("hex");
const TERM = `WF Term ${RUN}`;
const YEAR = `WF Year ${RUN}`;
const CG = 880000 + Math.floor(Math.random() * 9999);
const SUBJ = 991100 + Math.floor(Math.random() * 99);
const MIS_HEADER = { "x-mis-token": "test-mis-token" };

let app: ReturnType<typeof buildTestApp>;
let adminToken: string;
let studentToken: string;
let student: User;
let misId: number;
let assessmentId: number;
let cardId: number;

const auth = (r: request.Test, token = adminToken) => r.set("Authorization", `Bearer ${token}`).set(MIS_HEADER);
const transition = (action: string, extra: Record<string, unknown> = {}) =>
  auth(request(app).post("/api/report-cards/transition").send({ card_ids: [cardId], action, ...extra }));
const resultOf = (res: any) => res.body?.data?.results?.[0];
const q = `term=${encodeURIComponent(TERM)}&academic_year=${encodeURIComponent(YEAR)}`;
const attributesBody = () => ({
  student_id: misId,
  term: TERM,
  academic_year: YEAR,
  class_teacher_comment: "A steady, hard-working term.",
  attendance_present: 55,
  attendance_absent: 2,
  attendance_late: 3,
  attendance_excused: 1,
  attendance_sick: 0,
  attributes: NGA_ATTRIBUTES.map((a) => ({ attribute_name: a, rating: "Very good" })),
});
const setScore = (score: number) =>
  ManualAssessmentScore.update({ score }, { where: { manual_assessment_id: assessmentId, student_id: misId } });

beforeAll(async () => {
  process.env.NGA_MIS_BASE_URL = process.env.NGA_MIS_BASE_URL || "http://mis.test/api";
  await ensureModelsRegistered();
  app = buildTestApp();
  // The public verification route, as index.ts mounts it.
  app.get("/api/public/verify/report-card/:uuid", verifyReportCard);
  const admin = await findSeededUserByRole("admin");
  student = await findSeededUserByRole("student");
  if (!student.mis_user_id) throw new Error("The seeded student needs a mis_user_id for this spec");
  misId = Number(student.mis_user_id);
  adminToken = signTokenFor(admin.id);
  studentToken = signTokenFor(student.id);

  mockedGet.mockImplementation(async (url: string) => {
    const u = String(url);
    const ok = (data: any) => ({ data: { success: true, data } });
    if (u.endsWith("/users/me")) {
      return ok({
        currentAcademicYear: { academic_year_id: 77, name: YEAR },
        currentAcademicTerms: [{ academic_term_id: 5, name: TERM, is_current: true }],
      });
    }
    if (u.endsWith("/academics/years")) return ok([{ academic_year_id: 77, id: 77, name: YEAR }]);
    if (u.endsWith("/academics/terms")) return ok([{ academic_term_id: 5, id: 5, name: TERM }]);
    if (u.endsWith("/academics/class-groups")) {
      return ok([{ class_group_id: CG, name: `WF Class ${RUN}`, grade_name: "Grade 10", program_name: "SPES" }]);
    }
    if (u.endsWith("/academics/teacher-assignments")) {
      return ok([{ subject_id: SUBJ, class_group_id: CG, user_id: 424242, teacher_name: "Teacher Uwase", academic_year_id: 77 }]);
    }
    if (u.endsWith(`/academics/class-groups/${CG}/students`)) {
      return ok([
        { user_id: misId, first_name: "Aline", last_name: `Workflow ${RUN}`, gender: "F", registration_number: `REG-${RUN}`, status: "active" },
      ]);
    }
    if (u.match(/\/academics\/class-groups\/\d+\/students$/)) return ok([]);
    if (u.endsWith("/academics/subjects")) return ok([{ id: SUBJ, name: `WF Maths ${RUN}`, code: "SPEWM301_1789738744651" }]);
    if (u.includes(`/academics/subjects/${SUBJ}/terms/`)) return ok([{ id: misId, status: "active" }]);
    if (u.includes("/enrolled-subjects")) return ok([{ subject_id: SUBJ, subject_name: `WF Maths ${RUN}` }]);
    throw Object.assign(new Error(`unmocked ${u}`), { response: { status: 404 } });
  });

  const assessment = await ManualAssessment.create({
    course_id: SUBJ,
    title: `WF exam ${RUN}`,
    assessment_type: "end_of_term",
    max_score: 100,
    term: TERM,
    academic_year: YEAR,
    created_by: admin.id,
  } as any);
  assessmentId = assessment.id!;
  await ManualAssessmentScore.create({ manual_assessment_id: assessmentId, student_id: misId, score: 70 } as any);
  await SubjectAssessmentMapping.create({
    subject_id: SUBJ,
    term: TERM,
    academic_year: YEAR,
    assessment_type: "manual",
    assessment_id: assessmentId,
    category: "EOT",
    created_by: admin.id,
  } as any);
  const card = await ReportCard.create({
    student_id: misId,
    term: TERM,
    academic_year: YEAR,
    status: "draft",
    attendance_present: 0,
    attendance_absent: 0,
    attendance_late: 0,
  } as any);
  cardId = card.id!;
  await ReportCardAssessment.create({
    report_card_id: cardId,
    subject_id: SUBJ,
    assessment_type: "manual",
    assessment_id: assessmentId,
    category: "EOT",
  } as any);
});

beforeEach(() => {
  clearSchoolDirectoryCache();
  clearSubjectNameCache();
  clearReportAnalyticsCache();
});

afterAll(async () => {
  const cards = await ReportCard.findAll({ where: { term: TERM, academic_year: YEAR } });
  const ids = cards.map((c) => c.id!);
  if (ids.length) {
    await ReportCardTransition.destroy({ where: { report_card_id: ids } });
    await ReportCardSnapshot.destroy({ where: { report_card_id: ids } });
    await ReportCardAttribute.destroy({ where: { report_card_id: ids } });
    await ReportCardAssessment.destroy({ where: { report_card_id: ids } });
  }
  await ReportCard.destroy({ where: { term: TERM, academic_year: YEAR } });
  const cycles = await ReportCycle.findAll({ where: { term: TERM, academic_year: YEAR } });
  if (cycles.length) await ReportCycleSubjectSignoff.destroy({ where: { cycle_id: cycles.map((c) => c.id) } });
  await ReportCycle.destroy({ where: { term: TERM, academic_year: YEAR } });
  await SubjectAssessmentMapping.destroy({ where: { term: TERM, academic_year: YEAR } });
  await ManualAssessmentScore.destroy({ where: { manual_assessment_id: assessmentId } });
  await ManualAssessment.destroy({ where: { id: assessmentId } });
  await sequelize.close();
});

describe("report card workflow", () => {
  it("shows the class on the workbench with its blockers, restoring a subject mapping the card missed", async () => {
    // As if the fan-out never reached this student: the workbench copies the
    // subject's saved mapping onto the draft card.
    await ReportCardAssessment.destroy({ where: { report_card_id: cardId } });
    const res = await auth(request(app).get(`/api/report-cycles/workbench?class_group_id=${CG}&${q}`));
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.class_group.name).toBe(`WF Class ${RUN}`);
    expect(d.subjects).toEqual([
      expect.objectContaining({ subject_id: SUBJ, name: `WF Maths ${RUN}`, teachers: ["Teacher Uwase"], signoff: expect.objectContaining({ status: "open" }) }),
    ]);
    const me = d.students.find((s: any) => s.student_id === misId);
    expect(me.card).toMatchObject({ id: cardId, status: "draft", editable: true });
    expect(me.subjects[SUBJ].total).toBe(70); // 70% on the only assessed category (EOT): other categories have no marks, so they are left out
    expect(me.subjects[SUBJ].covered).toBe(50);
    expect(await ReportCardAssessment.count({ where: { report_card_id: cardId } })).toBe(1);
    expect(d.subjects[0]).toMatchObject({ mapped_cards: 1, total_cards: 1 });
    expect(me.blockers.map((b: any) => b.code)).toEqual(expect.arrayContaining(["SUBJECT_NOT_SUBMITTED", "NO_COMMENT", "ATTRIBUTES_INCOMPLETE"]));
    // The card is stamped with its class for cohort maths.
    expect((await ReportCard.findByPk(cardId))!.class_group_id).toBe(CG);
  });

  it("names the assessments behind a module's missing marks, with where to record them", async () => {
    const quiz = await ManualAssessment.create({
      course_id: SUBJ,
      title: `WF class test ${RUN}`,
      assessment_type: "class_work",
      max_score: 20,
      term: TERM,
      academic_year: YEAR,
      created_by: null,
    } as any);
    const row = await ReportCardAssessment.create({
      report_card_id: cardId,
      subject_id: SUBJ,
      assessment_type: "manual",
      assessment_id: quiz.id,
      category: "CW",
    } as any);
    try {
      const res = await auth(request(app).get(`/api/report-cycles/workbench?class_group_id=${CG}&${q}`));
      expect(res.status).toBe(200);
      const me = res.body.data.students.find((s: any) => s.student_id === misId);
      expect(me.subjects[SUBJ].missing).toBe(1);
      expect(me.subjects[SUBJ].missing_items).toEqual([
        { assessment_type: "manual", assessment_id: quiz.id, category: "CW", title: `WF class test ${RUN}`, href: `/courses/${SUBJ}/grades` },
      ]);
    } finally {
      await row.destroy();
      await quiz.destroy();
    }
  });

  it("prints the class's cards in one PDF: a ranking cover, then one page per card", async () => {
    const res = await auth(request(app).get(`/api/report-cycles/class-pdf?class_group_id=${CG}&${q}`))
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on("data", (c: Buffer) => chunks.push(c));
        r.on("end", () => cb(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
    expect(res.headers["content-disposition"]).toContain(`ReportCards-WF_Class_${RUN}`);
    const pdf = (res.body as Buffer).toString("latin1");
    expect(pdf.startsWith("%PDF")).toBe(true);
    expect((pdf.match(/\/Type \/Page[^s]/g) ?? []).length).toBe(2); // cover + 1 student
  });

  it("refuses a class PDF without the class and term", async () => {
    const res = await auth(request(app).get(`/api/report-cycles/class-pdf?${q}`));
    expect(res.status).toBe(400);
  });

  it("lists the class among the term's cycles", async () => {
    const res = await auth(request(app).get(`/api/report-cycles?${q}`));
    expect(res.status).toBe(200);
    expect(res.body.data.classes.find((c: any) => c.class_group_id === CG)).toMatchObject({ students: 1, subjects_total: 1 });
  });

  it("won't review an incomplete card", async () => {
    const res = await transition("review");
    expect(res.status).toBe(409);
    expect(resultOf(res)).toMatchObject({ ok: false, code: "NOT_READY" });
  });

  it("takes a subject teacher's sign-off once no mark is missing", async () => {
    const preview = await auth(request(app).get(`/api/report-cycles/signoff/preview?class_group_id=${CG}&subject_id=${SUBJ}&${q}`));
    expect(preview.status).toBe(200);
    expect(preview.body.data).toMatchObject({ status: "open", missing: [] });
    const res = await auth(
      request(app).post("/api/report-cycles/signoff").send({ class_group_id: CG, subject_id: SUBJ, term: TERM, academic_year: YEAR, action: "submit" }),
    );
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("submitted");
  });

  it("saves the class teacher's part with attendance in days, then reviews", async () => {
    const save = await auth(request(app).post("/api/report-cards/attributes/save").send(attributesBody()));
    expect(save.status).toBe(200);
    expect(save.body.data.attendance).toMatchObject({ present: 55, excused: 1, source: "manual" });
    const res = await transition("review");
    expect(res.status).toBe(200);
    expect(resultOf(res)).toMatchObject({ ok: true, status: "reviewed" });
  });

  it("locks a reviewed card against every write", async () => {
    const save = await auth(request(app).post("/api/report-cards/attributes/save").send(attributesBody()));
    expect(save.status).toBe(409);
    expect(save.body.code).toBe("CARD_LOCKED");
    const builder = await auth(
      request(app)
        .post("/api/report-cards/builder/save")
        .send({ student_id: misId, term: TERM, academic_year: YEAR, assessments: [] }),
    );
    expect(builder.status).toBe(409);
    const mapping = await auth(
      request(app)
        .post("/api/report-cards/subject-mapping/save")
        .send({ subject_id: SUBJ, term: TERM, academic_year: YEAR, assessments: [] }),
    );
    expect(mapping.status).toBe(200);
    expect(mapping.body.data.students_skipped_locked).toBe(1);
    expect(await ReportCardAssessment.count({ where: { report_card_id: cardId } })).toBe(1);
  });

  it("hides an unpublished card from the student", async () => {
    const res = await auth(request(app).get(`/api/report-cards/student/${misId}?${q}`), studentToken);
    expect(res.status).toBe(404);
  });

  it("freezes the card on approval: a later regrade doesn't change it", async () => {
    const res = await transition("approve");
    expect(resultOf(res)).toMatchObject({ ok: true, status: "approved" });
    const snap = await ReportCardSnapshot.findOne({ where: { report_card_id: cardId, version: 1 } });
    expect(snap).not.toBeNull();
    expect(snap!.pdf_sha256).toMatch(/^[0-9a-f]{64}$/);
    const doc = snap!.payload as any;
    expect(doc.student).toMatchObject({ name: `Aline Workflow ${RUN}`, registration_number: `REG-${RUN}`, class_name: `WF Class ${RUN}` });
    expect(doc.groups[0].subjects[0]).toMatchObject({ total: 70, teacher: "Teacher Uwase", class_average: 70 });
    // RTB: code (without MIS's uniqueness suffix), category, competence, rank in class.
    expect(doc.groups[0].name).toBe("Specific modules");
    expect(doc.groups[0].subjects[0]).toMatchObject({ code: "SPEWM301", category: "specific", threshold: 70, rank: 1, rank_of: 1 });
    expect(doc.summary.modules_competent + doc.summary.modules_nyc).toBe(1);
    expect(doc.summary).toMatchObject({ average: 70, position: 1, position_of: 1 });

    await setScore(30);
    const read = await auth(request(app).get(`/api/report-cards/student/${misId}?${q}`));
    expect(read.status).toBe(200);
    expect(read.body.data.document.groups[0].subjects[0].total).toBe(70);
    const diff = await auth(request(app).get(`/api/report-cards/${cardId}/diff`));
    expect(diff.body.data).toMatchObject({ frozen: true, version: 1 });
    expect(diff.body.data.changes[0]).toMatchObject({ subject_id: SUBJ, approved: 70, now: 30 });
  });

  it("publishes, and the student sees the frozen card", async () => {
    expect(resultOf(await transition("publish"))).toMatchObject({ ok: true, status: "published" });
    const res = await auth(request(app).get(`/api/report-cards/student/${misId}?${q}`), studentToken);
    expect(res.status).toBe(200);
    expect(res.body.data.report_card).toMatchObject({ status: "published", version: 1 });
    expect(res.body.data.document.groups[0].subjects[0].total).toBe(70);
    const pdf = await auth(request(app).post("/api/report-cards/generate-pdf").send({ report_card_id: cardId }), studentToken);
    expect(pdf.status).toBe(200);
    expect(pdf.headers["content-type"]).toContain("application/pdf");
    expect(pdf.headers["x-report-card-version"]).toBe("1");
  });

  it("verifies the issued version publicly", async () => {
    const card = (await ReportCard.findByPk(cardId))!;
    const res = await request(app).get(`/api/public/verify/report-card/${card.uuid}?v=1`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ verified: true, data: { version: 1, average_score: 70 } });
  });

  it("reopens only with a reason, and the old version stops verifying", async () => {
    expect(resultOf(await transition("reopen"))).toMatchObject({ ok: false, code: "REASON_REQUIRED" });
    expect(resultOf(await transition("reopen", { reason: "EOT mark corrected" }))).toMatchObject({ ok: true, status: "draft" });
    const card = (await ReportCard.findByPk(cardId))!;
    expect(card.returned_reason).toBe("EOT mark corrected");
    const v1 = await request(app).get(`/api/public/verify/report-card/${card.uuid}?v=1`);
    expect(v1.body).toMatchObject({ verified: false, superseded: true });
    // Editable again.
    expect((await auth(request(app).post("/api/report-cards/attributes/save").send(attributesBody()))).status).toBe(200);
  });

  it("re-approves as version 2 and releases on schedule", async () => {
    expect(resultOf(await transition("review"))).toMatchObject({ ok: true });
    expect(resultOf(await transition("approve"))).toMatchObject({ ok: true, status: "approved" });
    const card = (await ReportCard.findByPk(cardId))!;
    expect(card.version).toBe(2);
    const v2 = (await ReportCardSnapshot.findOne({ where: { report_card_id: cardId, version: 2 } }))!;
    expect((v2.payload as any).groups[0].subjects[0].total).toBe(30);

    const at = new Date(Date.now() + 3600_000).toISOString();
    const scheduled = await transition("publish", { publish_at: at });
    expect(resultOf(scheduled)).toMatchObject({ ok: true, status: "approved", scheduled_for: at });
    expect(await publishDueCards(new Date())).toBe(0);
    expect(await publishDueCards(new Date(Date.now() + 2 * 3600_000))).toBeGreaterThanOrEqual(1);
    expect((await ReportCard.findByPk(cardId))!.status).toBe("published");
  });

  it("keeps the whole story in the history", async () => {
    const res = await auth(request(app).get(`/api/report-cards/${cardId}/history`));
    expect(res.status).toBe(200);
    const actions = res.body.data.transitions.map((t: any) => t.action).reverse();
    expect(actions).toEqual(["review", "approve", "publish", "reopen", "review", "approve", "publish", "publish"]);
    expect(res.body.data.transitions.find((t: any) => t.action === "reopen").reason).toBe("EOT mark corrected");
    expect(res.body.data.versions.map((v: any) => [v.version, !!v.superseded_at])).toEqual([
      [2, false],
      [1, true],
    ]);
  });

  it("maps the legacy status endpoint onto the workflow", async () => {
    const res = await auth(request(app).patch(`/api/report-cards/${cardId}/status`).send({ status: "approved" }));
    expect(res.status).toBe(200); // published -> approved = unpublish
    expect((await ReportCard.findByPk(cardId))!.status).toBe("approved");
    const bad = await auth(request(app).patch(`/api/report-cards/${cardId}/status`).send({ status: "saved" }));
    expect(bad.status).toBe(409);
    expect(resultOf(await transition("publish"))).toMatchObject({ ok: true });
  });

  it("reports the issued card in the school reports, by gender", async () => {
    const res = await auth(request(app).get(`/api/reports/school?${q}&fresh=1`));
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.basis).toBe("issued");
    const me = d.broadsheet.students.find((s: any) => s.student_id === misId);
    expect(me).toMatchObject({ average: 30, gender: "female", position: 1 });
    expect(d.gender.overall.female.students).toBeGreaterThanOrEqual(1);
    expect(d.performance.subjects.find((s: any) => s.subject_id === SUBJ)).toMatchObject({ n: 1, mean: 30, pass_rate: 0 });
    expect(d.at_risk.find((s: any) => s.student_id === misId).reasons.join(" ")).toMatch(/below the pass mark/);
  });

  it("refuses the school reports to a student", async () => {
    const res = await auth(request(app).get(`/api/reports/school?${q}`), studentToken);
    expect(res.status).toBe(403);
  });
});

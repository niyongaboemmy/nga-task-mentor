import request from "supertest";
import axios from "axios";
import crypto from "crypto";
import {
  buildTestApp,
  ensureModelsRegistered,
  findSeededUserByRole,
  signTokenFor,
} from "./testApp";
import { sequelize } from "../config/database";
import {
  Assignment,
  ManualAssessment,
  ManualAssessmentScore,
  ReportCard,
  ReportCardAssessment,
  Submission,
  SubjectAssessmentMapping,
  User,
} from "../models";
import { loadStudentScores, resolveCardStudent } from "../utils/reportCardScores";

/**
 * GET /api/report-cards/preview/:studentId (provisional card) and the fix to
 * GET /api/report-cards/student/:studentId, against the real dev DB with MIS
 * mocked. The card is keyed on the student's MIS id while their submission is
 * stored under their local id — the official card used to miss it. Run with
 * --runInBand.
 */

jest.mock("axios", () => {
  const actual = jest.requireActual("axios");
  return { __esModule: true, ...actual, default: { ...actual.default, get: jest.fn() } };
});
const mockedGet = axios.get as jest.Mock;

const RUN = crypto.randomBytes(3).toString("hex");
const SUBJ_A = 990401; // subject-wide mapping: assignment (CW, graded) + exam (EOT, not recorded)
const SUBJ_B = 990402; // no mapping: a recorded midterm is suggested as MD
const SUBJ_C = 990403; // nothing at all
const TERM = `Prev Term ${RUN}`;
const YEAR = `Prev Year ${RUN}`;
const MIS_HEADER = { "x-mis-token": "test-mis-token" };

let app: ReturnType<typeof buildTestApp>;
let instructorToken: string;
let studentToken: string;
let student: User;
let misId: number;
let assignmentId: number;
const manualIds: number[] = [];
let decoy: User | null = null;
let decoyAssignmentId: number | null = null;

const q = `term=${encodeURIComponent(TERM)}&academic_year=${encodeURIComponent(YEAR)}`;
const get = (path: string, token = instructorToken) =>
  request(app).get(`/api/report-cards/${path}?${q}`).set("Authorization", `Bearer ${token}`).set(MIS_HEADER);

beforeAll(async () => {
  await ensureModelsRegistered();
  app = buildTestApp();
  const instructor = await findSeededUserByRole("instructor");
  student = await findSeededUserByRole("student");
  instructorToken = signTokenFor(instructor.id);
  studentToken = signTokenFor(student.id);
  if (!student.mis_user_id) throw new Error("The seeded student needs a mis_user_id for this spec");
  misId = Number(student.mis_user_id);

  mockedGet.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes(`/academics/students/${misId}/enrolled-subjects`)) {
      return {
        data: {
          success: true,
          data: [
            { subject_id: SUBJ_A, subject_name: `Prev Maths ${RUN}` },
            { subject_id: SUBJ_B, subject_name: `Prev Physics ${RUN}` },
            { subject_id: SUBJ_C, subject_name: `Prev Art ${RUN}` },
          ],
        },
      };
    }
    return { data: { success: true, data: [] } };
  });

  const a = await Assignment.create({
    title: `Prev algebra ${RUN}`,
    description: "preview fixture",
    due_date: new Date(Date.now() - 86400000),
    max_score: 10,
    submission_type: "text",
    course_id: SUBJ_A,
    academic_term_id: null,
    created_by: instructor.id,
    status: "published",
  } as any);
  assignmentId = a.id!;
  await Submission.create({
    assignment_id: assignmentId,
    student_id: student.id,
    status: "graded",
    grade: "8/10",
    text_submission: "x",
    is_late: false,
    submitted_at: new Date(),
  } as any);

  // A different local account whose PK equals the student's MIS id must never
  // lend them its marks (the old lookup did exactly that).
  const clash = await User.findByPk(misId);
  if (clash && clash.id !== student.id && Number(clash.mis_user_id) !== misId) {
    decoy = clash;
    const other = await Assignment.create({
      title: `Decoy ${RUN}`, description: "x", due_date: new Date(), max_score: 10, submission_type: "text",
      course_id: SUBJ_A, academic_term_id: null, created_by: instructor.id, status: "published",
    } as any);
    decoyAssignmentId = other.id!;
  }

  const exam = await ManualAssessment.create({
    course_id: SUBJ_A, title: `Prev exam ${RUN}`, assessment_type: "ca_end_of_term", max_score: 100, term: TERM, academic_year: YEAR,
  } as any);
  const mid = await ManualAssessment.create({
    course_id: SUBJ_B, title: `Prev midterm ${RUN}`, assessment_type: "midterm", max_score: 50, term: TERM, academic_year: YEAR,
  } as any);
  const notFinal = await ManualAssessment.create({
    course_id: SUBJ_B, title: `Prev practice ${RUN}`, assessment_type: "homework", max_score: 10, term: TERM, academic_year: YEAR,
    add_to_final_grade: false,
  } as any);
  manualIds.push(exam.id!, mid.id!, notFinal.id!);
  await ManualAssessmentScore.create({ manual_assessment_id: mid.id!, student_id: misId, score: 30 } as any);
  await ManualAssessmentScore.create({ manual_assessment_id: notFinal.id!, student_id: misId, score: 1 } as any);

  await SubjectAssessmentMapping.bulkCreate([
    { subject_id: SUBJ_A, term: TERM, academic_year: YEAR, assessment_type: "assignment", assessment_id: assignmentId, category: "CW" },
    { subject_id: SUBJ_A, term: TERM, academic_year: YEAR, assessment_type: "manual", assessment_id: exam.id!, category: "EOT" },
  ] as any);
});

afterAll(async () => {
  const cards = await ReportCard.findAll({ where: { term: TERM, academic_year: YEAR } });
  if (cards.length) await ReportCardAssessment.destroy({ where: { report_card_id: cards.map((c) => c.id) } });
  await ReportCard.destroy({ where: { term: TERM, academic_year: YEAR } });
  await SubjectAssessmentMapping.destroy({ where: { term: TERM, academic_year: YEAR } });
  await ManualAssessmentScore.destroy({ where: { manual_assessment_id: manualIds } });
  await ManualAssessment.destroy({ where: { id: manualIds } });
  const ids = [assignmentId, decoyAssignmentId].filter((x): x is number => x != null);
  await Submission.destroy({ where: { assignment_id: ids } });
  await Assignment.destroy({ where: { id: ids } });
  await sequelize.close();
});

describe("GET /api/report-cards/preview/:studentId", () => {
  it("is staff-only", async () => {
    expect((await get(`preview/${misId}`, studentToken)).status).toBe(403);
  });

  it("previews a card that doesn't exist yet, with pending marks", async () => {
    const res = await get(`preview/${misId}`);
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.report_card).toMatchObject({ id: null, student_id: misId, term: TERM, academic_year: YEAR, status: null });
    expect(d.preview.card_exists).toBe(false);

    const bySubject = Object.fromEntries(d.preview.subjects.map((s: any) => [s.subject_id, s]));
    // A: assignment 8/10 found through the local id -> CW 12; the exam is pending.
    expect(bySubject[SUBJ_A]).toMatchObject({
      source: "subject_mapping",
      expected: 2,
      recorded: 1,
      completeness: 50,
      total_so_far: 12,
      running_percentage: 80,
      pending_total: 1,
    });
    expect(bySubject[SUBJ_A].pending[0]).toMatchObject({ title: `Prev exam ${RUN}`, category: "EOT", kind: "manual" });
    // B: unmapped, the recorded midterm is suggested as MD (30/50 -> 15); the
    // practice mark excluded from the final grade is left out.
    expect(bySubject[SUBJ_B]).toMatchObject({ source: "suggested", expected: 1, recorded: 1, total_so_far: 15, running_percentage: 60 });
    expect(bySubject[SUBJ_C]).toMatchObject({ source: "none", expected: 0, total_so_far: null });

    expect(d.grades.map((g: any) => g.subject_id).sort()).toEqual([SUBJ_A, SUBJ_B]);
    expect(d.subject_names[SUBJ_C]).toBe(`Prev Art ${RUN}`);
    expect(d.preview.overall).toMatchObject({ subjects: 3, subjects_with_marks: 2, expected: 3, recorded: 2, running_average: 70 });
    if (decoy) expect(JSON.stringify(d)).not.toContain(`Decoy ${RUN}`);
  });

  it("prefers the student's own card mappings once the card exists", async () => {
    // Keyed on the local id, as the older builder saved cards (and as
    // report_cards.student_id's foreign key to users.id requires).
    const card = await ReportCard.create({
      student_id: student.id, term: TERM, academic_year: YEAR, status: "draft",
      attendance_present: 40, attendance_absent: 2, attendance_late: 1,
    } as any);
    await ReportCardAssessment.create({
      report_card_id: card.id!, subject_id: SUBJ_A, assessment_type: "assignment", assessment_id: assignmentId, category: "CW",
    } as any);

    const res = await get(`preview/${misId}`);
    const d = res.body.data;
    expect(d.preview.card_exists).toBe(true);
    expect(d.report_card).toMatchObject({ id: card.id, status: "draft", attendance: { present: 40, total_days: 43 } });
    const a = d.preview.subjects.find((s: any) => s.subject_id === SUBJ_A);
    expect(a).toMatchObject({ source: "report_card", expected: 1, recorded: 1, completeness: 100, total_so_far: 12 });

    const official = await get(`student/${student.id}`);
    expect(official.status).toBe(200);
    const grade = official.body.data.grades.find((g: any) => g.subject_id === SUBJ_A);
    expect(grade.categories.CW.scaled_score).toBe(12);
  });
});

describe("report-card score lookup (utils/reportCardScores)", () => {
  it("finds a MIS-keyed card's submissions through the linked local account", async () => {
    // The subject-mapping fan-out keys cards on the MIS id; the old lookup
    // searched submissions for student_id = MIS id and found nothing.
    const identity = await resolveCardStudent(misId);
    expect(identity.localIds).toContain(student.id);
    expect(identity.manualIds[0]).toBe(misId);
    const scores = await loadStudentScores(identity, [
      { assessment_type: "assignment", assessment_id: assignmentId },
      { assessment_type: "manual", assessment_id: manualIds[1] },
      { assessment_type: "manual", assessment_id: manualIds[0] },
    ]);
    expect(scores.get(`assignment:${assignmentId}`)).toEqual({ raw_score: 8, max_score: 10 });
    expect(scores.get(`manual:${manualIds[1]}`)).toEqual({ raw_score: 30, max_score: 50 });
    expect(scores.has(`manual:${manualIds[0]}`)).toBe(false);
  });

  it("reads a legacy local-keyed card's recorded marks under the MIS id too", async () => {
    const identity = await resolveCardStudent(student.id);
    expect(identity.localIds).toEqual([student.id]);
    expect(identity.manualIds).toEqual(expect.arrayContaining([student.id, misId]));
    const scores = await loadStudentScores(identity, [{ assessment_type: "manual", assessment_id: manualIds[1] }]);
    expect(scores.get(`manual:${manualIds[1]}`)).toEqual({ raw_score: 30, max_score: 50 });
  });

  it("has only recorded marks for a student with no local account", async () => {
    expect(await resolveCardStudent(990999123)).toEqual({ localIds: [], manualIds: [990999123] });
  });
});

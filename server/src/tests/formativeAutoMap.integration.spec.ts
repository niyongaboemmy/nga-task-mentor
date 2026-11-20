import crypto from "crypto";
import type { Request } from "express";
import { ensureModelsRegistered, findSeededUserByRole } from "./testApp";
import { ManualAssessment, ReportCard, ReportCardAssessment, SubjectAssessmentMapping } from "../models";
import * as tenantSettings from "../services/tenantSettings";
import { autoMapNewToFormative, mapUnmappedToFormative } from "../services/formativeAutoMap";

/**
 * TVET schools: new work is mapped to FA, and a backfill maps a term's
 * unmapped work to FA. Existing mappings keep their category; the draft
 * cards that hold the subject's mapping get the new rows. Run with --runInBand.
 */
const RUN = crypto.randomBytes(3).toString("hex");
const TERM = "Term 1";
const YEAR = `FA Year ${RUN}`;
const SUBJ = 993300 + Math.floor(Math.random() * 99);
const req = { headers: {} } as unknown as Request;
let builder: "normal" | "tvet" = "tvet";
let misId: number;
const manualIds: number[] = [];
let card: ReportCard;

const manual = async (title: string, extra: object = {}) => {
  const a = await ManualAssessment.create({ course_id: SUBJ, title: `${title} ${RUN}`, assessment_type: "class_work", max_score: 20, term: TERM, academic_year: YEAR, created_by: null, ...extra } as any);
  manualIds.push(a.id!);
  return a;
};

beforeAll(async () => {
  await ensureModelsRegistered();
  jest.spyOn(tenantSettings, "getReportCardScheme").mockImplementation(async () => ({ ...tenantSettings.DEFAULT_REPORT_CARD_SCHEME, builder }) as tenantSettings.ReportCardScheme);
  misId = Number((await findSeededUserByRole("student")).mis_user_id);
  card = await ReportCard.create({ student_id: misId, term: TERM, academic_year: YEAR, status: "draft", attendance_present: 0, attendance_absent: 0, attendance_late: 0 } as any);
});

afterAll(async () => {
  jest.restoreAllMocks();
  await ReportCardAssessment.destroy({ where: { report_card_id: card.id } });
  await ReportCard.destroy({ where: { id: card.id } });
  await SubjectAssessmentMapping.destroy({ where: { subject_id: SUBJ, academic_year: YEAR } });
  await ManualAssessment.destroy({ where: { id: manualIds } });
});

describe("FA by default on TVET schools", () => {
  it("maps a new manual assessment to FA, adds it to the draft cards holding the subject, and leaves Normal schools alone", async () => {
    // The card already holds this subject's mapping (one EOT row).
    const exam = await manual("Exam");
    await SubjectAssessmentMapping.create({ subject_id: SUBJ, term: TERM, academic_year: YEAR, assessment_type: "manual", assessment_id: exam.id, category: "CA" } as any);
    await ReportCardAssessment.create({ report_card_id: card.id, subject_id: SUBJ, assessment_type: "manual", assessment_id: exam.id, category: "CA" } as any);

    const quizLike = await manual("Class test");
    expect(await autoMapNewToFormative(req, { kind: "manual", id: quizLike.id!, subject_id: SUBJ, term: TERM, academic_year: YEAR })).toBe(true);
    const m = await SubjectAssessmentMapping.findOne({ where: { subject_id: SUBJ, academic_year: YEAR, assessment_id: quizLike.id } });
    expect(m?.category).toBe("FA");
    const row = await ReportCardAssessment.findOne({ where: { report_card_id: card.id, assessment_id: quizLike.id } });
    expect(row?.category).toBe("FA");
    // Already mapped: not touched (stays CA).
    expect(await autoMapNewToFormative(req, { kind: "manual", id: exam.id!, subject_id: SUBJ, term: TERM, academic_year: YEAR })).toBe(false);
    expect((await SubjectAssessmentMapping.findOne({ where: { subject_id: SUBJ, academic_year: YEAR, assessment_id: exam.id } }))?.category).toBe("CA");

    builder = "normal";
    const later = await manual("Normal school");
    expect(await autoMapNewToFormative(req, { kind: "manual", id: later.id!, subject_id: SUBJ, term: TERM, academic_year: YEAR })).toBe(false);
    builder = "tvet";
  });

  it("backfills a term's unmapped work to FA (dry run first), skipping work kept off the final grade", async () => {
    await manual("Homework");
    await manual("Practice", { add_to_final_grade: false });
    const dry = await mapUnmappedToFormative({ term: TERM, academicYear: YEAR, termId: null, dryRun: true });
    expect(dry.by_kind.manual).toBe(2); // "Normal school" + "Homework"; "Practice" doesn't count
    expect(dry.dry_run).toBe(true);
    expect(await SubjectAssessmentMapping.count({ where: { subject_id: SUBJ, academic_year: YEAR } })).toBe(2);
    const done = await mapUnmappedToFormative({ term: TERM, academicYear: YEAR, termId: null });
    expect(done.by_kind.manual).toBe(2);
    expect(done.cards_updated).toBe(1);
    expect(await SubjectAssessmentMapping.count({ where: { subject_id: SUBJ, academic_year: YEAR, category: "FA" } })).toBe(3);
    const again = await mapUnmappedToFormative({ term: TERM, academicYear: YEAR, termId: null, dryRun: true });
    expect(again.by_kind.manual).toBe(0);
  });
});

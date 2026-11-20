import crypto from "crypto";
import type { Request } from "express";
import { ensureModelsRegistered, findSeededUserByRole } from "./testApp";
import { ManualAssessment, ManualAssessmentScore, ReportCard, ReportCardAssessment, ReportCardSnapshot } from "../models";
import { buildCardDocuments } from "../services/reportCardDocument";
import * as tenantSettings from "../services/tenantSettings";

/**
 * The TVET builder's Term 3 card (RTB / CAMIS annual report) against the dev
 * DB: every component out of the module weight, each earlier term's columns,
 * the year (AT = sum of the term totals over their maxima), every term's
 * conduct and the automatic decision. A frozen earlier term counts with its
 * snapshot. The Normal builder renders no TVET block. Run with --runInBand.
 */

const RUN = crypto.randomBytes(3).toString("hex");
const YEAR = `AN Year ${RUN}`;
const SUBJ = 992200 + Math.floor(Math.random() * 99);
const CG = 870000 + Math.floor(Math.random() * 9999);
const req = { headers: {} } as unknown as Request; // no MIS token: names fall back, no directory

let misId: number;
const assessments: number[] = [];
const cardOf: Record<string, ReportCard> = {};

const scheme = (builder: "normal" | "tvet") =>
  ({
    ...tenantSettings.DEFAULT_REPORT_CARD_SCHEME,
    builder,
    tvet: { ...tenantSettings.DEFAULT_TVET_OPTIONS, district: "Gasabo", headmaster_name: "Head Teacher", module_weights: { [String(SUBJ)]: 80 } },
  }) as tenantSettings.ReportCardScheme;
let builder: "normal" | "tvet" = "tvet";

async function termCard(term: string, score: number, behaviour: number | null, status = "draft") {
  const a = await ManualAssessment.create({ course_id: SUBJ, title: `AN exam ${term} ${RUN}`, assessment_type: "end_of_term", max_score: 100, term, academic_year: YEAR, created_by: null } as any);
  assessments.push(a.id!);
  await ManualAssessmentScore.create({ manual_assessment_id: a.id, student_id: misId, score } as any);
  const card = await ReportCard.create({
    student_id: misId,
    term,
    academic_year: YEAR,
    class_group_id: CG,
    status,
    attendance_present: 0,
    attendance_absent: 0,
    attendance_late: 0,
    behaviour_mark: behaviour,
  } as any);
  await ReportCardAssessment.create({ report_card_id: card.id, subject_id: SUBJ, assessment_type: "manual", assessment_id: a.id, category: "EOT" } as any);
  cardOf[term] = card;
  return card;
}

/** An integrated assessment (IA) on the Term 3 card. */
async function integrated(card: ReportCard, score: number) {
  const a = await ManualAssessment.create({ course_id: SUBJ, title: `AN IA ${RUN}`, assessment_type: "practical", max_score: 100, term: card.term, academic_year: YEAR, created_by: null } as any);
  assessments.push(a.id!);
  await ManualAssessmentScore.create({ manual_assessment_id: a.id, student_id: misId, score } as any);
  await ReportCardAssessment.create({ report_card_id: card.id, subject_id: SUBJ, assessment_type: "manual", assessment_id: a.id, category: "IA" } as any);
}

beforeAll(async () => {
  await ensureModelsRegistered();
  const student = await findSeededUserByRole("student");
  if (!student.mis_user_id) throw new Error("The seeded student needs a mis_user_id for this spec");
  misId = Number(student.mis_user_id);
  await termCard("Term 1", 60, 35);
  await termCard("Term 2", 80, 38);
  const t3 = await termCard("Term 3", 70, 36);
  await integrated(t3, 90);
  jest.spyOn(tenantSettings, "getReportCardScheme").mockImplementation(async () => scheme(builder));
});

afterAll(async () => {
  jest.restoreAllMocks();
  const ids = Object.values(cardOf).map((c) => c.id!);
  await ReportCardSnapshot.destroy({ where: { report_card_id: ids } });
  await ReportCardAssessment.destroy({ where: { report_card_id: ids } });
  await ReportCard.destroy({ where: { id: ids } });
  await ManualAssessmentScore.destroy({ where: { manual_assessment_id: assessments } });
  await ManualAssessment.destroy({ where: { id: assessments } });
});

describe("TVET builder: Term 3 card (RTB / CAMIS annual report)", () => {
  const subjectOf = (doc: any) => doc.groups.flatMap((g: any) => g.subjects).find((x: any) => x.subject_id === SUBJ)!;

  it("shows every term out of the module weight, the year, conduct and the decision", async () => {
    builder = "tvet";
    const t3 = cardOf["Term 3"];
    const doc = (await buildCardDocuments(req, [t3], { cohort: [t3] })).get(t3.id!)!;
    expect(doc.builder).toBe("tvet");
    const s = subjectOf(doc);
    // Legacy EOT mappings count as CA; weight 80 (the school's override).
    expect(s.tvet.weight).toBe(80);
    expect(s.tvet.weight_source).toBe("school");
    expect(s.tvet.terms).toEqual([
      { fa: null, ia: null, ca: 48, to: 48, max: 80, pct: 60 },
      { fa: null, ia: null, ca: 64, to: 64, max: 80, pct: 80 },
      { fa: null, ia: 72, ca: 56, to: 128, max: 160, pct: 80 },
    ]);
    expect(s.tvet.annual).toEqual({ at: 240, max: 320, pct: 75, competent: true });
    expect(doc.tvet!.terms.map((t) => [t.term, t.totals.to, t.totals.pct, t.conduct, t.position])).toEqual([
      ["Term 1", 48, 60, 35, 1],
      ["Term 2", 64, 80, 38, 1],
      ["Term 3", 128, 80, 36, 1],
    ]);
    expect(doc.tvet!.annual).toEqual({ total: 240, max: 320, pct: 75, position: 1, position_of: 1, conduct: 36.33 });
    expect(doc.tvet!.final).toBe(true);
    expect(doc.tvet!.decision).toBe("Promoted");
    expect(doc.tvet!.school).toMatchObject({ district: "Gasabo", headmaster: "Head Teacher" });
    expect(doc.summary.average).toBe(80); // this term, weighted by learning hours
  });

  it("counts a frozen earlier term with its snapshot, and leaves the year off Terms 1 and 2", async () => {
    builder = "tvet";
    const t1 = cardOf["Term 1"];
    const t3 = cardOf["Term 3"];
    // Term 1 approved at 90% under the Normal builder (snapshot); its live score doesn't move the year.
    await t1.update({ status: "approved" });
    await ReportCardSnapshot.create({
      report_card_id: t1.id,
      version: 1,
      payload: { grades: [{ subject_id: SUBJ, categories: { EOT: { scaled_score: 45, weight: 50, avg_percentage: 90 } }, total_score: 90, points: 45, weight_covered: 50 }] },
      approved_at: new Date(),
    } as any);
    const doc = (await buildCardDocuments(req, [t3], { cohort: [t3] })).get(t3.id!)!;
    const s = subjectOf(doc);
    expect(s.tvet.terms[0]).toMatchObject({ ca: 72, to: 72 });
    expect(s.tvet.annual).toMatchObject({ at: 264, max: 320, pct: 82.5 });

    const t2 = cardOf["Term 2"];
    const t2doc = (await buildCardDocuments(req, [t2], { cohort: [t2] })).get(t2.id!)!;
    expect(t2doc.tvet!.final).toBe(false);
    expect(t2doc.tvet!.terms).toHaveLength(1);
    expect(t2doc.tvet!.annual).toBeNull();
    expect(subjectOf(t2doc).tvet.annual).toBeNull();
  });

  it("renders the Normal builder without the TVET block (IA isn't counted there)", async () => {
    builder = "normal";
    const t3 = cardOf["Term 3"];
    const doc = (await buildCardDocuments(req, [t3], { cohort: [t3] })).get(t3.id!)!;
    expect(doc.builder).toBe("normal");
    expect(doc.tvet).toBeUndefined();
    const s = subjectOf(doc);
    expect(s.tvet).toBeUndefined();
    expect(s.total).toBe(70); // EOT only; the IA mapping has no place in Normal
  });
});

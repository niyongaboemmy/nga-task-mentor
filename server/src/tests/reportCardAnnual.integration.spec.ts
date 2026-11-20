import crypto from "crypto";
import type { Request } from "express";
import { ensureModelsRegistered, findSeededUserByRole } from "./testApp";
import { ManualAssessment, ManualAssessmentScore, ReportCard, ReportCardAssessment, ReportCardSnapshot } from "../models";
import { buildCardDocuments } from "../services/reportCardDocument";

/**
 * The RTB / CAMIS Term 3 card against the dev DB: it carries the year —
 * each module's earlier terms, the annual total (average of the terms
 * assessed), the behaviour of every term, and the year's totals. A frozen
 * earlier term counts with its snapshot. Run with --runInBand.
 */

const RUN = crypto.randomBytes(3).toString("hex");
const YEAR = `AN Year ${RUN}`;
const SUBJ = 992200 + Math.floor(Math.random() * 99);
const CG = 870000 + Math.floor(Math.random() * 9999);
const req = { headers: {} } as unknown as Request; // no MIS token: names fall back, no directory

let misId: number;
const assessments: number[] = [];
const cardOf: Record<string, ReportCard> = {};

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

beforeAll(async () => {
  await ensureModelsRegistered();
  const student = await findSeededUserByRole("student");
  if (!student.mis_user_id) throw new Error("The seeded student needs a mis_user_id for this spec");
  misId = Number(student.mis_user_id);
  await termCard("Term 1", 60, 35);
  await termCard("Term 2", 80, 38);
  await termCard("Term 3", 70, 36);
});

afterAll(async () => {
  const ids = Object.values(cardOf).map((c) => c.id!);
  await ReportCardSnapshot.destroy({ where: { report_card_id: ids } });
  await ReportCardAssessment.destroy({ where: { report_card_id: ids } });
  await ReportCard.destroy({ where: { id: ids } });
  await ManualAssessmentScore.destroy({ where: { manual_assessment_id: assessments } });
  await ManualAssessment.destroy({ where: { id: assessments } });
});

describe("Term 3 card (RTB / CAMIS annual report)", () => {
  it("carries the earlier terms, the annual total, every term's behaviour and the year's totals", async () => {
    const t3 = cardOf["Term 3"];
    const doc = (await buildCardDocuments(req, [t3], { cohort: [t3] })).get(t3.id!)!;
    const s = doc.groups.flatMap((g) => g.subjects).find((x) => x.subject_id === SUBJ)!;
    expect(s.term_cell).toEqual({ term: "Term 3", fa: null, ia: null, ca: 35, total: 70 });
    expect(s.earlier_terms!.map((e) => [e.term, e.total])).toEqual([
      ["Term 1", 60],
      ["Term 2", 80],
    ]);
    expect(s.annual).toEqual({ total: 70, competent: expect.any(Boolean), terms_assessed: 3 });
    expect(doc.annual).toMatchObject({ terms: ["Term 1", "Term 2", "Term 3"], average: 70, position: 1, position_of: 1, total_marks: 70, total_max: 100 });
    expect(doc.behaviour).toEqual({
      mark: 36,
      max: 40,
      earlier: [
        { term: "Term 1", mark: 35 },
        { term: "Term 2", mark: 38 },
      ],
    });
  });

  it("counts a frozen earlier term with its snapshot, and leaves the year off Terms 1 and 2", async () => {
    const t1 = cardOf["Term 1"];
    const t3 = cardOf["Term 3"];
    // Term 1 approved at 90 (snapshot); its live score changing later doesn't move the year.
    await t1.update({ status: "approved" });
    await ReportCardSnapshot.create({
      report_card_id: t1.id,
      version: 1,
      payload: { grades: [{ subject_id: SUBJ, categories: { EOT: { scaled_score: 45 } }, total_score: 90, points: 45, weight_covered: 50 }] },
      approved_at: new Date(),
    } as any);
    const doc = (await buildCardDocuments(req, [t3], { cohort: [t3] })).get(t3.id!)!;
    const s = doc.groups.flatMap((g) => g.subjects).find((x) => x.subject_id === SUBJ)!;
    expect(s.earlier_terms![0].total).toBe(90);
    expect(s.annual!.total).toBe(80); // (90 + 80 + 70) / 3

    const t2doc = (await buildCardDocuments(req, [cardOf["Term 2"]], { cohort: [cardOf["Term 2"]] })).get(cardOf["Term 2"].id!)!;
    expect(t2doc.annual).toBeUndefined();
    expect(t2doc.groups.flatMap((g) => g.subjects)[0].earlier_terms).toBeUndefined();
  });
});

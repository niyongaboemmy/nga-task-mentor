import crypto from "crypto";
import { ensureModelsRegistered, findSeededUserByRole } from "./testApp";
import { ManualAssessment, ManualAssessmentScore, ReportCard, ReportCardAssessment } from "../models";
import * as tenantSettings from "../services/tenantSettings";
import * as cw from "../services/componentWeights";
import { computeCardGrades } from "../services/reportCardDocument";

/**
 * A card's FA weighs each kind of work as the subject (else the school) set:
 * class work, homework and a midterm averaged per kind, then combined.
 * Run with --runInBand.
 */
const RUN = crypto.randomBytes(3).toString("hex");
const SUBJ = 994400 + Math.floor(Math.random() * 99);
let card: ReportCard;
const manualIds: number[] = [];
let config: cw.ComponentWeightsConfig = { default: {}, subjects: {} };

beforeAll(async () => {
  await ensureModelsRegistered();
  jest.spyOn(tenantSettings, "getReportCardScheme").mockImplementation(async () => ({ ...tenantSettings.DEFAULT_REPORT_CARD_SCHEME, builder: "tvet" }) as tenantSettings.ReportCardScheme);
  jest.spyOn(cw, "getComponentWeights").mockImplementation(async () => config);
  const misId = Number((await findSeededUserByRole("student")).mis_user_id);
  card = await ReportCard.create({ student_id: misId, term: "Term 1", academic_year: `CW ${RUN}`, status: "draft", attendance_present: 0, attendance_absent: 0, attendance_late: 0 } as any);
  for (const [type, score, max] of [["class_work", 9, 10], ["class_work", 7, 10], ["homework", 4, 10], ["midterm", 60, 100]] as const) {
    const a = await ManualAssessment.create({ course_id: SUBJ, title: `${type} ${RUN}`, assessment_type: type, max_score: max, term: "Term 1", academic_year: `CW ${RUN}`, created_by: null } as any);
    manualIds.push(a.id!);
    await ManualAssessmentScore.create({ manual_assessment_id: a.id, student_id: misId, score } as any);
    await ReportCardAssessment.create({ report_card_id: card.id, subject_id: SUBJ, assessment_type: "manual", assessment_id: a.id, category: "FA" } as any);
  }
});

afterAll(async () => {
  jest.restoreAllMocks();
  await ReportCardAssessment.destroy({ where: { report_card_id: card.id } });
  await ReportCard.destroy({ where: { id: card.id } });
  await ManualAssessmentScore.destroy({ where: { manual_assessment_id: manualIds } });
  await ManualAssessment.destroy({ where: { id: manualIds } });
});

describe("component weights on a card", () => {
  it("averages FA equally without weights, by kind with the school's, and by the subject's own over the school's", async () => {
    const fa = async () => (await computeCardGrades(card)).grades.find((g) => g.subject_id === SUBJ)!.categories.FA!;
    expect((await fa()).avg_percentage).toBe(65);
    config = { default: { FA: { class_work: 30, homework: 20, midterm: 50 } }, subjects: {} };
    const school = await fa();
    expect(school.avg_percentage).toBe(62);
    expect(school.components?.map((c) => c.component)).toEqual(["midterm", "class_work", "homework"]);
    config = { ...config, subjects: { [String(SUBJ)]: { FA: { class_work: 50, homework: 50 } } } };
    const own = await fa();
    expect(own.avg_percentage).toBe(60); // 80*.5 + 40*.5
    expect(own.unweighted).toEqual(["midterm"]);
  });
});

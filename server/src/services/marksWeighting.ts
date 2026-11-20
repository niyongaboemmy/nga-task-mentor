import type { Request } from "express";
import { Op } from "sequelize";
import { resolveCurrentAcademicPeriodNames } from "../utils/misUtils";
import type { SubjectMarkFn } from "../utils/overallRanking";
import { SubjectAssessmentMapping } from "../models/SubjectAssessmentMapping.model";
import { calculateSubjectGrade, type AssessmentCategory, type AssessmentScore } from "./reportCardGrader.service";
import { effectiveCategory, gradingOf, type Grading } from "./reportCardBuilders";
import { getReportCardScheme } from "./tenantSettings";
import { getComponentWeights, weightsFor, type ComponentWeightsConfig } from "./componentWeights";

/**
 * A subject's mark the way the report card works it out, for every report
 * built from marks (grade sheet, student grades, teacher and school
 * overviews): each assessment counts in the category the subject maps it to
 * this term (in the school's builder); inside a category each kind of work
 * weighs what the subject (else the school) set; categories combine by the
 * builder's weights over the ones with marks. Work that isn't mapped doesn't
 * count, as on the card. A subject with nothing mapped (or marks only in
 * unmapped work) has no weighted mark: callers keep their own rule then.
 */

export interface WeightItem {
  type: "quiz" | "assignment" | "manual";
  id: number;
  /** Kind of work: quiz, assignment, class_work, homework, midterm... */
  component: string;
  raw: number;
  max: number;
}

export interface WeightingContext {
  grading: Grading;
  /** `${subject}:${type}:${id}` -> category it counts under. */
  mapping: Map<string, AssessmentCategory>;
  config: ComponentWeightsConfig;
  term: string | null;
  academicYear: string | null;
}

export async function loadWeightingContext(subjectIds: number[], term: string | null, academicYear: string | null): Promise<WeightingContext> {
  const [scheme, config] = await Promise.all([getReportCardScheme(), getComponentWeights()]);
  const grading = gradingOf(scheme);
  const mapping = new Map<string, AssessmentCategory>();
  if (term && academicYear && subjectIds.length) {
    const rows = await SubjectAssessmentMapping.findAll({
      where: { subject_id: { [Op.in]: subjectIds }, term, academic_year: academicYear },
      attributes: ["subject_id", "assessment_type", "assessment_id", "category"],
    });
    for (const r of rows) {
      const cat = effectiveCategory(grading.builder, r.category);
      if (cat) mapping.set(`${r.subject_id}:${r.assessment_type}:${r.assessment_id}`, cat);
    }
  }
  return { grading, mapping, config, term, academicYear };
}

/** True when the subject maps any work this term (so its weighted mark applies). */
export const subjectIsMapped = (ctx: WeightingContext, subjectId: number) => [...ctx.mapping.keys()].some((k) => k.startsWith(`${subjectId}:`));

/** The subject's weighted mark (0-100) over its mapped work with marks; null when there's none. */
export function weightedSubjectMark(ctx: WeightingContext, subjectId: number, items: WeightItem[]): { percentage: number; counted: number } | null {
  const scores: AssessmentScore[] = [];
  for (const it of items) {
    if (!(it.max > 0) || !Number.isFinite(it.raw)) continue;
    const category = ctx.mapping.get(`${subjectId}:${it.type}:${it.id}`);
    if (!category) continue;
    scores.push({ assessment_id: it.id, assessment_type: it.type, category, raw_score: it.raw, max_score: it.max, component: it.component });
  }
  if (!scores.length) return null;
  const g = calculateSubjectGrade(subjectId, scores, ctx.grading.weights, weightsFor(ctx.config, subjectId));
  return g.weight_covered > 0 ? { percentage: g.total_score, counted: scores.length } : null;
}

/** The context for this request's period: ?term=&academic_year= when both are given, else the current term. */
export async function loadWeightingForRequest(req: Request, subjectIds: number[]): Promise<WeightingContext> {
  try {
    const term = (req.query?.term as string) || null;
    const academicYear = (req.query?.academic_year as string) || null;
    const period = term && academicYear ? { term, academicYear } : await resolveCurrentAcademicPeriodNames(req);
    return await loadWeightingContext(subjectIds, period.term, period.academicYear);
  } catch (e: any) {
    // A report never fails over its weighting: without it, marks add up as before.
    console.warn("loadWeightingForRequest: falling back to unweighted marks:", e?.message);
    return { grading: gradingOf({ category_weights: {} }), mapping: new Map(), config: { default: {}, subjects: {} }, term: null, academicYear: null };
  }
}

/** Ranking marks (percentages) -> the subject's weighted score, for utils/overallRanking. */
export const rankingSubjectMark =
  (ctx: WeightingContext): SubjectMarkFn | undefined =>
    ctx.mapping.size
      ? (courseId, marks) =>
          weightedSubjectMark(
            ctx,
            Number(courseId),
            marks.map((m) => ({
              type: m.kind === "recorded" ? "manual" : m.kind,
              id: m.item_id,
              component: m.kind === "recorded" ? m.component ?? "manual" : m.kind,
              raw: m.pct,
              max: 100,
            })),
          )?.percentage ?? null
      : undefined;

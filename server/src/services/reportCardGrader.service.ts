import { cachedGradingBands, GradeBand, letterFor } from "./tenantSettings";
/**
 * Pure grade-calculation logic for the Report Card module.
 * No database access — all inputs are plain data objects so this is
 * trivially unit-testable without mocking Sequelize.
 *
 * Category weights (out of 100):
 *   CW  → 15
 *   HW  → 10
 *   MD  → 25
 *   EOT → 50
 */

/**
 * Normal builder: CW/HW/MD/EOT. TVET builder: FA (formative), CA
 * (comprehensive) and IA (integrated, Term 3). See reportCardBuilders.ts.
 */
export type AssessmentCategory = "CW" | "HW" | "MD" | "EOT" | "IA" | "FA" | "CA";

export const CATEGORY_WEIGHTS: Record<AssessmentCategory, number> = {
  CW: 15,
  HW: 10,
  MD: 25,
  EOT: 50,
  // TVET builder: equal-weight components (each shown out of the module weight).
  IA: 100,
  FA: 100,
  CA: 100,
};

export interface AssessmentScore {
  assessment_id: number;
  assessment_type: "quiz" | "assignment" | "manual";
  category: AssessmentCategory;
  /** Student's raw score (numerator) */
  raw_score: number;
  /** Maximum possible score for this assessment */
  max_score: number;
  /** What kind of work it is inside its category: quiz, assignment, class_work, homework, midterm... */
  component?: string;
}

/**
 * How much each kind of work weighs inside a category, e.g. FA = class work 30,
 * homework 20, quizzes 20, midterm 30. Relative numbers: they're scaled over
 * the kinds that have marks. Absent = every assessment in the category
 * counts the same (the plain average).
 */
export type ComponentWeights = Partial<Record<string, Record<string, number>>>;

export interface CategoryResult {
  /** Score scaled to the category weight (e.g. max 15 for CW) */
  scaled_score: number;
  /** The weight cap (15 / 10 / 25 / 50) */
  weight: number;
  /** Average percentage across all assessments in this category */
  avg_percentage: number;
  /**
   * With component weights: each kind of work's average and its share of the
   * category (weights scaled over the kinds with marks, so they add up to 100).
   */
  components?: Array<{ component: string; weight: number; share: number; avg_percentage: number; count: number }>;
  /** Kinds of work with marks here but no weight: they don't count in this category. */
  unweighted?: string[];
  /** Individual assessment details */
  assessments: Array<{
    assessment_id: number;
    assessment_type: "quiz" | "assignment" | "manual";
    raw_score: number;
    max_score: number;
    percentage: number;
  }>;
}

export interface SubjectGrade {
  subject_id: number;
  categories: Partial<Record<AssessmentCategory, CategoryResult>>;
  /**
   * The subject's mark out of 100, over the work that HAS marks: points earned
   * divided by the weight of the categories with at least one recorded mark.
   * A category with no marks yet (e.g. no EOT) is left out instead of counting
   * as zero, so 37 points out of the 50 assessed is 74, not 37.
   */
  total_score: number;
  /** Points earned: the sum of the categories' scaled scores (out of weight_covered). */
  points: number;
  /** Weight of the categories that have marks (100 when every category has marks). */
  weight_covered: number;
}

/**
 * Scale a percentage to a category's weight cap.
 * e.g. 80% in CW → 80 * 15 / 100 = 12.00
 */
export type CategoryWeights = Record<AssessmentCategory, number>;

export function scaleToCategory(
  percentage: number,
  category: AssessmentCategory,
  weights: CategoryWeights = CATEGORY_WEIGHTS,
): number {
  const weight = weights[category];
  return parseFloat(((percentage * weight) / 100).toFixed(2));
}

/**
 * Calculate the average percentage for a list of raw scores.
 * Returns 0 when the list is empty or all max_scores are 0.
 */
export function averagePercentage(scores: Array<{ raw_score: number; max_score: number }>): number {
  const valid = scores.filter((s) => s.max_score > 0);
  if (valid.length === 0) return 0;
  const sum = valid.reduce((acc, s) => acc + (s.raw_score / s.max_score) * 100, 0);
  return parseFloat((sum / valid.length).toFixed(4));
}

/**
 * Given a list of assessment scores for a single subject,
 * compute per-category results and the total scaled score.
 */
/**
 * A category's percentage. Without component weights: the plain average of
 * its assessments. With them: each kind of work is averaged first, and the
 * kinds are combined by their weights, scaled over the kinds that have marks
 * (a kind with no marks yet is left out, as a category with no marks is).
 * A kind with marks but no weight is reported and left out; if no kind with
 * marks has a weight, the plain average is used rather than nothing.
 */
export function categoryPercentage(
  items: Array<{ raw_score: number; max_score: number; component?: string }>,
  componentWeights?: Record<string, number>,
): { avg: number; components?: CategoryResult["components"]; unweighted?: string[] } {
  if (!componentWeights || Object.keys(componentWeights).length === 0) return { avg: averagePercentage(items) };
  const byComponent = new Map<string, typeof items>();
  for (const it of items) {
    const c = it.component ?? "other";
    byComponent.set(c, [...(byComponent.get(c) ?? []), it]);
  }
  const rows = [...byComponent.entries()].map(([component, list]) => ({
    component,
    weight: Math.max(0, Number(componentWeights[component] ?? 0) || 0),
    avg_percentage: averagePercentage(list),
    count: list.length,
  }));
  const unweighted = rows.filter((r) => r.weight === 0).map((r) => r.component);
  const total = rows.reduce((a, r) => a + r.weight, 0);
  if (total <= 0) return { avg: averagePercentage(items), unweighted };
  const avg = rows.reduce((a, r) => a + (r.avg_percentage * r.weight) / total, 0);
  return {
    avg: parseFloat(avg.toFixed(4)),
    components: rows
      .sort((a, b) => b.weight - a.weight || a.component.localeCompare(b.component))
      .map((r) => ({ ...r, share: parseFloat(((r.weight / total) * 100).toFixed(2)) })),
    ...(unweighted.length ? { unweighted } : {}),
  };
}

export function calculateSubjectGrade(
  subject_id: number,
  scores: AssessmentScore[],
  weights: CategoryWeights = CATEGORY_WEIGHTS,
  componentWeights?: ComponentWeights,
): SubjectGrade {
  const grouped: Partial<Record<AssessmentCategory, AssessmentScore[]>> = {};

  for (const score of scores) {
    if (!grouped[score.category]) grouped[score.category] = [];
    grouped[score.category]!.push(score);
  }

  const categories: Partial<Record<AssessmentCategory, CategoryResult>> = {};
  let points = 0;
  let weight_covered = 0;

  for (const cat of Object.keys(grouped) as AssessmentCategory[]) {
    const items = grouped[cat]!.filter((s) => s.max_score > 0);
    if (items.length === 0) continue; // nothing markable in this category: not assessed
    const { avg, components, unweighted } = categoryPercentage(items, componentWeights?.[cat]);
    const scaled = scaleToCategory(avg, cat, weights);
    points += scaled;
    weight_covered += weights[cat] ?? 0;

    categories[cat] = {
      scaled_score: scaled,
      weight: weights[cat],
      avg_percentage: avg,
      ...(components ? { components } : {}),
      ...(unweighted?.length ? { unweighted } : {}),
      assessments: items.map((s) => ({
        assessment_id: s.assessment_id,
        assessment_type: s.assessment_type,
        raw_score: s.raw_score,
        max_score: s.max_score,
        percentage: s.max_score > 0 ? parseFloat(((s.raw_score / s.max_score) * 100).toFixed(4)) : 0,
      })),
    };
  }

  const total_score = weight_covered > 0 ? (points / weight_covered) * 100 : 0;
  return {
    subject_id,
    categories,
    total_score: parseFloat(total_score.toFixed(2)),
    points: parseFloat(points.toFixed(2)),
    weight_covered,
  };
}

/**
 * Single source of truth for the letter-grade scale, shared by the on-screen
 * preview (client/src/services/reportCardApi.ts) and the downloaded PDF
 * (reportCardPdf.service.ts) — previously each hardcoded its own scale
 * (A>=90 vs A>=80, etc.), so a student's preview and PDF could disagree.
 */
export function scoreToLetterGrade(
  score: number,
  bands: readonly GradeBand[] = cachedGradingBands(),
): { letter: string; remark: string } {
  // The scale is a per-school setting (app_settings "grading.bands", TM-12);
  // the default is the scale above, A>=90 B>=75 C>=60 D>=45, else F.
  return letterFor(score, bands);
}

export interface AnnualTermContribution {
  term: string;
  total_score: number;
}

export interface AnnualSubjectGrade {
  subject_id: number;
  /** Simple average of this subject's total_score across the contributing terms. */
  annual_score: number;
  /** Which terms had data for this subject, and their individual totals. */
  contributing_terms: AnnualTermContribution[];
}

/**
 * Combine a subject's per-term totals into an annual (whole-year) score.
 * Equal-weight average across whichever terms have data — a term simply
 * absent from `termGrades` (no report card saved yet, or that subject
 * wasn't mapped in it) is excluded from the average rather than treated
 * as a zero, so a school mid-way through the year still gets a sensible
 * annual figure from the terms completed so far.
 */
export function combineAnnualSubjectGrades(
  subject_id: number,
  termGrades: Array<{ term: string; total_score: number }>,
): AnnualSubjectGrade {
  const contributing_terms = termGrades.map((t) => ({
    term: t.term,
    total_score: t.total_score,
  }));

  const annual_score =
    contributing_terms.length > 0
      ? parseFloat(
          (
            contributing_terms.reduce((sum, t) => sum + t.total_score, 0) /
            contributing_terms.length
          ).toFixed(2),
        )
      : 0;

  return { subject_id, annual_score, contributing_terms };
}

/**
 * Parse an assignment grade stored as "score/max_score" string.
 * Returns null when the grade is absent or cannot be parsed.
 */
export function parseAssignmentGrade(
  gradeString: string | null | undefined,
): { raw_score: number; max_score: number } | null {
  if (!gradeString) return null;
  const parts = gradeString.split("/");
  if (parts.length !== 2) return null;
  const raw_score = parseFloat(parts[0]);
  const max_score = parseFloat(parts[1]);
  if (isNaN(raw_score) || isNaN(max_score) || max_score <= 0) return null;
  return { raw_score, max_score };
}

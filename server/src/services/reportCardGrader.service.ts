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

export type AssessmentCategory = "CW" | "HW" | "MD" | "EOT";

export const CATEGORY_WEIGHTS: Record<AssessmentCategory, number> = {
  CW: 15,
  HW: 10,
  MD: 25,
  EOT: 50,
};

export interface AssessmentScore {
  assessment_id: number;
  assessment_type: "quiz" | "assignment" | "manual";
  category: AssessmentCategory;
  /** Student's raw score (numerator) */
  raw_score: number;
  /** Maximum possible score for this assessment */
  max_score: number;
}

export interface CategoryResult {
  /** Score scaled to the category weight (e.g. max 15 for CW) */
  scaled_score: number;
  /** The weight cap (15 / 10 / 25 / 50) */
  weight: number;
  /** Average percentage across all assessments in this category */
  avg_percentage: number;
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
  /** Sum of all scaled_scores (out of 100) */
  total_score: number;
}

/**
 * Scale a percentage to a category's weight cap.
 * e.g. 80% in CW → 80 * 15 / 100 = 12.00
 */
export function scaleToCategory(percentage: number, category: AssessmentCategory): number {
  const weight = CATEGORY_WEIGHTS[category];
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
export function calculateSubjectGrade(
  subject_id: number,
  scores: AssessmentScore[],
): SubjectGrade {
  const grouped: Partial<Record<AssessmentCategory, AssessmentScore[]>> = {};

  for (const score of scores) {
    if (!grouped[score.category]) grouped[score.category] = [];
    grouped[score.category]!.push(score);
  }

  const categories: Partial<Record<AssessmentCategory, CategoryResult>> = {};
  let total_score = 0;

  for (const cat of Object.keys(grouped) as AssessmentCategory[]) {
    const items = grouped[cat]!;
    const avg = averagePercentage(items);
    const scaled = scaleToCategory(avg, cat);
    total_score += scaled;

    categories[cat] = {
      scaled_score: scaled,
      weight: CATEGORY_WEIGHTS[cat],
      avg_percentage: avg,
      assessments: items.map((s) => ({
        assessment_id: s.assessment_id,
        assessment_type: s.assessment_type,
        raw_score: s.raw_score,
        max_score: s.max_score,
        percentage: s.max_score > 0 ? parseFloat(((s.raw_score / s.max_score) * 100).toFixed(4)) : 0,
      })),
    };
  }

  return {
    subject_id,
    categories,
    total_score: parseFloat(total_score.toFixed(2)),
  };
}

/**
 * Single source of truth for the letter-grade scale, shared by the on-screen
 * preview (client/src/services/reportCardApi.ts) and the downloaded PDF
 * (reportCardPdf.service.ts) — previously each hardcoded its own scale
 * (A>=90 vs A>=80, etc.), so a student's preview and PDF could disagree.
 */
export function scoreToLetterGrade(score: number): { letter: string; remark: string } {
  if (score >= 90) return { letter: "A", remark: "Distinction" };
  if (score >= 75) return { letter: "B", remark: "Merit" };
  if (score >= 60) return { letter: "C", remark: "Credit" };
  if (score >= 45) return { letter: "D", remark: "Pass" };
  return { letter: "F", remark: "Fail" };
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

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
  assessment_type: "quiz" | "assignment";
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
    assessment_type: "quiz" | "assignment";
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

import {
  CATEGORY_WEIGHTS,
  calculateSubjectGrade,
  type AssessmentCategory,
  type AssessmentScore,
  type SubjectGrade,
} from "./reportCardGrader.service";

/**
 * A provisional report card: what the student's card would show today, before
 * every mark is in and even before the card exists. Pure, so the rules below
 * are unit-tested.
 *
 * Which assessments count, per subject, first match wins:
 *   1. "report_card"    — the student's own card mappings (report_card_assessments)
 *   2. "subject_mapping" — the subject's saved CW/HW/MD/EOT mapping for the period
 *   3. "suggested"      — nothing mapped yet: recorded marks placed by their type
 *                          (class work -> CW, homework -> HW, midterm -> MD,
 *                          end-of-term -> EOT); quizzes/assignments can't be placed
 *   4. "none"           — nothing to show
 *
 * A category with no recorded mark is left out of the total (as the official
 * card does), so the total is "so far". `running_percentage` rescales the
 * categories that do have marks to 100, which is the fairer read while a
 * term is in progress.
 */

export type PreviewSource = "report_card" | "subject_mapping" | "suggested" | "none";
export type ItemKind = "quiz" | "assignment" | "manual";

export interface PreviewItem {
  assessment_type: ItemKind;
  assessment_id: number;
  category: AssessmentCategory;
  title: string;
}

export interface PreviewSubjectInput {
  subject_id: number;
  name: string;
  source: PreviewSource;
  items: PreviewItem[];
}

export interface PreviewSubject {
  subject_id: number;
  name: string;
  source: PreviewSource;
  expected: number;
  recorded: number;
  completeness: number | null;
  /** Sum of the weights of categories holding at least one mark. */
  weight_covered: number;
  total_so_far: number | null;
  running_percentage: number | null;
  categories: Partial<Record<AssessmentCategory, { expected: number; recorded: number; weight: number }>>;
  pending: Array<{ title: string; kind: ItemKind; category: AssessmentCategory }>;
}

export interface ProvisionalCard {
  grades: SubjectGrade[];
  subjects: PreviewSubject[];
  overall: {
    subjects: number;
    subjects_with_marks: number;
    expected: number;
    recorded: number;
    completeness: number | null;
    average_so_far: number | null;
    running_average: number | null;
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

const TYPE_CATEGORY: Record<string, AssessmentCategory> = {
  class_work: "CW",
  group_work: "CW",
  participation: "CW",
  homework: "HW",
  midterm: "MD",
  ca_end_of_term: "EOT",
};

/** Where a recorded mark of this type would sit on the card, if anywhere. */
export function suggestedCategory(assessmentType: string | null | undefined): AssessmentCategory | null {
  return assessmentType ? TYPE_CATEGORY[assessmentType] ?? null : null;
}

export function buildProvisionalCard(
  subjects: PreviewSubjectInput[],
  scores: Map<string, { raw_score: number; max_score: number }>,
): ProvisionalCard {
  const grades: SubjectGrade[] = [];
  const out: PreviewSubject[] = [];

  for (const s of subjects) {
    const recordedScores: AssessmentScore[] = [];
    const pending: PreviewSubject["pending"] = [];
    const categories: PreviewSubject["categories"] = {};
    for (const item of s.items) {
      const cat = (categories[item.category] ??= { expected: 0, recorded: 0, weight: CATEGORY_WEIGHTS[item.category] });
      cat.expected++;
      const score = scores.get(`${item.assessment_type}:${item.assessment_id}`);
      if (score) {
        cat.recorded++;
        recordedScores.push({
          assessment_id: item.assessment_id,
          assessment_type: item.assessment_type,
          category: item.category,
          raw_score: score.raw_score,
          max_score: score.max_score,
        });
      } else {
        pending.push({ title: item.title, kind: item.assessment_type, category: item.category });
      }
    }

    const grade = recordedScores.length ? calculateSubjectGrade(s.subject_id, recordedScores) : null;
    if (grade) grades.push(grade);
    const weightCovered = grade
      ? (Object.keys(grade.categories) as AssessmentCategory[]).reduce((n, c) => n + CATEGORY_WEIGHTS[c], 0)
      : 0;
    const expected = s.items.length;
    out.push({
      subject_id: s.subject_id,
      name: s.name,
      source: s.source,
      expected,
      recorded: recordedScores.length,
      completeness: expected ? round1((recordedScores.length / expected) * 100) : null,
      weight_covered: weightCovered,
      total_so_far: grade ? grade.total_score : null,
      running_percentage: grade && weightCovered > 0 ? round1((grade.total_score / weightCovered) * 100) : null,
      categories,
      pending,
    });
  }

  const withMarks = out.filter((s) => s.total_so_far != null);
  const expected = out.reduce((n, s) => n + s.expected, 0);
  const recorded = out.reduce((n, s) => n + s.recorded, 0);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const soFar = avg(withMarks.map((s) => s.total_so_far!));
  const running = avg(withMarks.map((s) => s.running_percentage!).filter((x) => x != null));
  return {
    grades,
    subjects: out,
    overall: {
      subjects: out.length,
      subjects_with_marks: withMarks.length,
      expected,
      recorded,
      completeness: expected ? round1((recorded / expected) * 100) : null,
      average_so_far: soFar == null ? null : round2(soFar),
      running_average: running == null ? null : round1(running),
    },
  };
}

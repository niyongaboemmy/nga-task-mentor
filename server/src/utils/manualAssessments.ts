import { Request } from "express";
import { Op } from "sequelize";
import { ManualAssessment } from "../models/ManualAssessment.model";
import { ManualAssessmentScore } from "../models/ManualAssessmentScore.model";
import { resolveCurrentAcademicPeriodNames } from "./misUtils";

/**
 * Teacher-recorded ("manual") assessments — class work, homework, midterms,
 * CA end-of-term exams… — for a set of courses, together with the scores of
 * the students we care about.
 *
 * These live outside the quiz/assignment tables but are just as much a part of
 * a student's grade, so every grade read-out has to fold them in.
 *
 * Two things to know:
 *  - `manual_assessments` rows are keyed on the free-text term / academic-year
 *    NAMES (not MIS ids), so the period is resolved to names the same way
 *    manualAssessment.controller.ts does — with an explicit `?term=` /
 *    `?academic_year=` override honored first.
 *  - `manual_assessment_scores.student_id` holds whichever id the roster the
 *    teacher typed against carried: the MIS user id for enrolled students, the
 *    local `users.id` for local-only ones. Callers therefore pass every id a
 *    student may be known by and we match on any of them.
 */
export const fetchManualAssessments = async (
  req: Request,
  courseIds: Array<number | string>,
  studentIds: Array<number | string>,
): Promise<{
  assessments: ManualAssessment[];
  /** manual_assessment_id -> student id -> score */
  scoresByAssessment: Map<number, Map<string, number>>;
}> => {
  const empty = { assessments: [], scoresByAssessment: new Map() };

  const numericCourseIds = courseIds.map(Number).filter((n) => !isNaN(n));
  if (numericCourseIds.length === 0) return empty;

  let term = (req.query.term as string) || undefined;
  let academicYear = (req.query.academic_year as string) || undefined;
  if (!term && !academicYear) {
    const current = await resolveCurrentAcademicPeriodNames(req);
    term = current.term ?? undefined;
    academicYear = current.academicYear ?? undefined;
  }

  const where: any = { course_id: { [Op.in]: numericCourseIds } };
  if (term) where.term = term;
  if (academicYear) where.academic_year = academicYear;

  const assessments = await ManualAssessment.findAll({
    where,
    order: [
      ["assessment_date", "ASC"],
      ["created_at", "ASC"],
    ],
  });

  const scoresByAssessment = new Map<number, Map<string, number>>();
  const numericStudentIds = studentIds.map(Number).filter((n) => !isNaN(n));

  if (assessments.length > 0 && numericStudentIds.length > 0) {
    const scores = await ManualAssessmentScore.findAll({
      where: {
        manual_assessment_id: { [Op.in]: assessments.map((a) => a.id) },
        student_id: { [Op.in]: Array.from(new Set(numericStudentIds)) },
      },
      attributes: ["manual_assessment_id", "student_id", "score"],
    });

    for (const s of scores) {
      let bucket = scoresByAssessment.get(s.manual_assessment_id);
      if (!bucket) {
        bucket = new Map<string, number>();
        scoresByAssessment.set(s.manual_assessment_id, bucket);
      }
      bucket.set(String(s.student_id), parseFloat(String(s.score)));
    }
  }

  return { assessments, scoresByAssessment };
};

/**
 * Shape one student's row for a single manual assessment. `ids` is every id
 * that student may have been recorded under (see fetchManualAssessments).
 */
export const buildManualAssessmentRow = (
  assessment: ManualAssessment,
  scoresByAssessment: Map<number, Map<string, number>>,
  ids: Array<number | string | null | undefined>,
) => {
  const bucket = scoresByAssessment.get(assessment.id);
  let score: number | null = null;
  if (bucket) {
    for (const id of ids) {
      if (id === null || id === undefined) continue;
      const found = bucket.get(String(id));
      if (found !== undefined) {
        score = found;
        break;
      }
    }
  }

  const maxScore = Number(assessment.max_score) || 0;

  return {
    assessment_id: assessment.id,
    title: assessment.title,
    assessment_type: assessment.assessment_type,
    assessment_number: assessment.assessment_number,
    assessment_date: assessment.assessment_date,
    counts_to_final: assessment.add_to_final_grade,
    max_score: maxScore,
    recorded: score !== null,
    score,
    percentage:
      score !== null && maxScore > 0
        ? Math.round((score / maxScore) * 10000) / 100
        : null,
  };
};

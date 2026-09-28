import { Request } from "express";
import { Op } from "sequelize";
import { Assignment, Quiz, QuizSubmission, Submission, User } from "../models";
import { fetchManualAssessments } from "./manualAssessments";
import type { MarkSources } from "./overallRanking";

// Shared by the Overall Ranking (controllers/ranking.controller.ts) and the
// admin students directory so both score a student from the same rows.

/** Assignments, quizzes and recorded marks for the courses, for everyone. */
export async function loadMarkSources(
  req: Request,
  courseIds: number[],
  termId: number | null,
  knownMisIds: number[] = [],
): Promise<MarkSources> {
  const termWhere = termId
    ? { [Op.or]: [{ academic_term_id: termId }, { academic_term_id: null }] }
    : {};

  const [assignments, quizzes] = await Promise.all([
    Assignment.findAll({
      where: {
        course_id: { [Op.in]: courseIds },
        status: { [Op.in]: ["published", "completed"] },
        ...termWhere,
      },
      attributes: ["id", "course_id", "title", "max_score", "due_date", "status"],
    }),
    Quiz.findAll({
      where: {
        course_id: { [Op.in]: courseIds },
        status: { [Op.in]: ["published", "completed"] },
        ...termWhere,
      },
      attributes: ["id", "course_id", "title", "status", "start_date", "end_date"],
    }),
  ]);

  const studentInclude = { model: User, as: "student", attributes: ["id", "mis_user_id"] };
  const [submissions, quizSubmissions, manual] = await Promise.all([
    assignments.length
      ? Submission.findAll({
          where: {
            assignment_id: { [Op.in]: assignments.map((a) => a.id!) },
            status: { [Op.ne]: "draft" },
          },
          attributes: ["assignment_id", "grade", "status", "student_id", "submitted_at"],
          include: [studentInclude],
        })
      : [],
    quizzes.length
      ? QuizSubmission.findAll({
          where: { quiz_id: { [Op.in]: quizzes.map((q) => q.id) }, status: "completed" },
          attributes: ["quiz_id", "percentage", "total_score", "student_id", "completed_at"],
          include: [studentInclude],
        })
      : [],
    fetchManualAssessments(req, courseIds, "all"),
  ]);

  const manualScores: MarkSources["manualScores"] = [];
  for (const [assessmentId, bucket] of manual.scoresByAssessment) {
    for (const [studentId, score] of bucket) {
      manualScores.push({ manual_assessment_id: assessmentId, student_id: Number(studentId), score });
    }
  }
  const scoreIds = Array.from(new Set(manualScores.map((s) => s.student_id)));
  const localUsers = scoreIds.length
    ? await User.findAll({
        where: {
          [Op.or]: [{ id: { [Op.in]: scoreIds } }, { mis_user_id: { [Op.in]: scoreIds } }],
        },
        attributes: ["id", "mis_user_id"],
      })
    : [];

  return {
    assignments: assignments.map((a: any) => a.toJSON()),
    submissions: submissions.map((s: any) => s.toJSON()),
    quizzes: quizzes.map((q: any) => q.toJSON()),
    quizSubmissions: quizSubmissions.map((s: any) => s.toJSON()),
    manual: manual.assessments.map((a) => ({
      id: a.id!,
      course_id: a.course_id,
      title: a.title,
      counts_to_final: a.add_to_final_grade !== false,
      max_score: Number(a.max_score) || 0,
      date: a.assessment_date ?? null,
    })),
    manualScores,
    localUsers: localUsers.map((u) => ({ id: u.id, mis_user_id: u.mis_user_id ?? null })),
    knownMisIds,
  };
}


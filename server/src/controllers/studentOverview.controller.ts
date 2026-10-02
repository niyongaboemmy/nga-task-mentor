import { Request, Response } from "express";
import { Op, fn, col } from "sequelize";
import { Assignment } from "../models/Assignment.model";
import { Submission } from "../models/Submission.model";
import { Quiz } from "../models/Quiz.model";
import { QuizQuestion } from "../models/QuizQuestion.model";
import { QuizSubmission } from "../models/QuizSubmission.model";
import { getScopedSubjects } from "../utils/scopedSubjects";
import { resolveAcademicTermId } from "../utils/misUtils";
import { sendControllerError } from "../utils/controllerErrors";
import { buildStudentOverview, QuizStatsRow } from "../services/studentOverview.service";

/**
 * GET /api/dashboard/student/overview
 *
 * The student's own work across their enrolled subjects this term: every
 * published assignment and quiz with its state and timing (running attempt,
 * due today, opens later, awaiting a mark, graded, missed) plus the reminders
 * built from them. Reminders only cover publicly accessible work: published
 * assignments and quizzes whose "publicly accessible" switch is on. Subjects come from getScopedSubjects (MIS enrolment), and
 * only the caller's own submissions/attempts are read.
 */
export const getStudentOverview = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user?.id);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const termId = await resolveAcademicTermId(req);
    const { subjects } = await getScopedSubjects(req);
    const ids = subjects.map((s) => s.id);
    const termWhere = termId ? { [Op.or]: [{ academic_term_id: termId }, { academic_term_id: null }] } : {};

    const [assignments, quizzes] = ids.length
      ? await Promise.all([
          Assignment.findAll({
            where: { course_id: { [Op.in]: ids }, status: { [Op.in]: ["published", "completed"] }, ...termWhere },
            attributes: ["id", "title", "course_id", "status", "due_date", "max_score", "submission_type", "created_at"],
            raw: true,
          }),
          Quiz.findAll({
            where: { course_id: { [Op.in]: ids }, status: { [Op.in]: ["published", "completed"] }, ...termWhere },
            attributes: [
              "id", "title", "course_id", "status", "type", "start_date", "end_date",
              "time_limit", "max_attempts", "passing_score", "is_public", "created_at",
            ],
            raw: true,
          }),
        ])
      : [[], []];

    const assignmentIds = assignments.map((a: any) => a.id);
    const quizIds = quizzes.map((q: any) => q.id);

    const [submissions, attempts, stats] = await Promise.all([
      assignmentIds.length
        ? Submission.findAll({
            where: { student_id: userId, assignment_id: { [Op.in]: assignmentIds } },
            attributes: ["id", "assignment_id", "status", "grade", "feedback", "is_late", "submitted_at", "updated_at"],
            raw: true,
          })
        : [],
      quizIds.length
        ? QuizSubmission.findAll({
            where: { student_id: userId, quiz_id: { [Op.in]: quizIds } },
            attributes: [
              "id", "quiz_id", "status", "grade_status", "percentage", "total_score", "max_score", "passed",
              "started_at", "end_time", "completed_at", "graded_at", "feedback", "attempt_number",
            ],
            raw: true,
          })
        : [],
      quizIds.length
        ? QuizQuestion.findAll({
            where: { quiz_id: { [Op.in]: quizIds } },
            attributes: [
              "quiz_id",
              [fn("COUNT", col("id")), "question_count"],
              [fn("SUM", col("points")), "total_points"],
              [fn("SUM", col("time_limit_seconds")), "total_seconds"],
            ],
            group: ["quiz_id"],
            raw: true,
          })
        : [],
    ]);

    const quizStats: QuizStatsRow[] = (stats as any[]).map((r) => ({
      quiz_id: Number(r.quiz_id),
      question_count: Number(r.question_count) || 0,
      total_points: Number(r.total_points) || 0,
      total_seconds: Number(r.total_seconds) || 0,
    }));

    const overview = buildStudentOverview({
      now: new Date(),
      academic_term_id: termId,
      subjects,
      assignments: assignments as any[],
      quizzes: quizzes as any[],
      quizStats,
      submissions: submissions as any[],
      attempts: attempts as any[],
    });
    return res.status(200).json({ success: true, data: overview });
  } catch (error) {
    return sendControllerError(res, error, "getStudentOverview");
  }
};

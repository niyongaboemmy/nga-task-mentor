import { Request } from "express";
import { Op, fn, col } from "sequelize";
import { Assignment } from "../models/Assignment.model";
import { Submission } from "../models/Submission.model";
import { Quiz } from "../models/Quiz.model";
import { QuizQuestion } from "../models/QuizQuestion.model";
import { QuizSubmission } from "../models/QuizSubmission.model";
import { getScopedSubjects, ScopedSubject, SubjectScope } from "../utils/scopedSubjects";
import { resolveAcademicTermId } from "../utils/misUtils";
import { buildStudentOverview, QuizStatsRow, StudentOverview, StudentOverviewInput } from "./studentOverview.service";

export interface LoadedStudentOverview {
  /** getScopedSubjects' scope: only "enrolled" means the caller is a learner. */
  scope: SubjectScope;
  /** The rows the overview was built from (only the caller's own work). */
  input: StudentOverviewInput;
  overview: StudentOverview;
}

/**
 * Loads the caller's own work across their enrolled subjects this term and
 * builds the student overview from it. The one loader behind both the student
 * dashboard (GET /api/dashboard/student/overview) and the MIS Home summary
 * (integration/homeSummary.ts), so both apply the same rules to the same rows.
 *
 * Subjects come from getScopedSubjects (MIS enrolment); only `userId`'s own
 * submissions and attempts are read. Read-only.
 */
export async function loadStudentOverview(
  req: Request,
  userId: number,
  opts: {
    now?: Date;
    /** Already-resolved getScopedSubjects / term id for this request (saves the MIS round trips). */
    scoped?: { scope: SubjectScope; subjects: ScopedSubject[] };
    termId?: number | null;
  } = {},
): Promise<LoadedStudentOverview> {
  const termId = opts.termId !== undefined ? opts.termId : await resolveAcademicTermId(req);
  const { scope, subjects } = opts.scoped ?? (await getScopedSubjects(req));
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

  const input: StudentOverviewInput = {
    now: opts.now ?? new Date(),
    academic_term_id: termId,
    subjects,
    assignments: assignments as any[],
    quizzes: quizzes as any[],
    quizStats,
    submissions: submissions as any[],
    attempts: attempts as any[],
  };
  return { scope, input, overview: buildStudentOverview(input) };
}

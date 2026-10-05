import { Request, Response } from "express";
import axios from "axios";
import { QuizQuestion, QuizAttempt, User, Quiz, QuestionBank } from "../models";
import QuizSubmission from "../models/QuizSubmission.model";
import ProctoringSession from "../models/ProctoringSession.model";
import ProctoringEvent from "../models/ProctoringEvent.model";
import { Op, Transaction } from "sequelize";
import { sequelize } from "../config/database";
import { QuestionValidator } from "../utils/questionValidation";
import {
  QuizGrader,
  AdvancedQuizGrader,
  isPendingGrade,
} from "../utils/quizGrader";
import { aiService } from "../services/ai/aiService";
import { Judge0Service } from "../services/Judge0Service";
import { getQuestionBankInclude } from "../utils/quizUtils";
import { isWebLanguage, WEB_PREVIEW_LANGUAGES } from "../utils/codeLanguages";

import { QuestionType, GradingResult } from "../types/quiz.types";
import type { QuizCreationAttributes } from "../models/Quiz.model";
import type {
  CreateQuizPayload,
  UpdateQuizPayload,
} from "../validations/quiz.validation";
import { sendControllerError } from "../utils/controllerErrors";
import {
  getMisToken,
  getCurrentTermId,
  resolveAcademicYearId,
  handleMisError,
} from "../utils/misUtils";
import { getScopedSubjects } from "../utils/scopedSubjects";
import { canManageQuiz } from "../utils/ownership";
import { canGradeQuiz } from "../utils/gradingAccess";
import {
  attemptSeed,
  buildStudentResults,
  gradeStatusOnSubmit,
  isPassed,
  quizAvailability,
  availabilityMessage,
  sanitizeQuestionForStudent,
  seededShuffle,
  studentAttemptSummary,
} from "../utils/quizStudentView";
import { studentMayTakeQuiz } from "../utils/studentEnrollment";
import { cancelQuiz, syncQuiz } from "../services/reminderSync";
import {
  SUBMIT_GRACE_SECONDS,
  computeAttemptEndTime,
  finalizeFromSavedAttempts,
  isPastDeadline,
  secondsRemaining,
} from "../utils/quizTiming";

// Deep equality comparison for objects

/**
 * The MIS subject ids the requesting instructor is assigned to teach for the
 * given term (any co-teacher of a subject is "assigned" to it). Used to widen
 * the quiz management list beyond just the quizzes an instructor personally
 * created. Returns [] on any MIS failure — the caller still falls back to
 * `created_by = self` so the instructor never loses sight of their own quizzes.
 */
async function getAssignedSubjectIds(
  req: Request,
  termId: number | null,
): Promise<number[]> {
  try {
    const token = getMisToken(req);
    if (!token) return [];
    const response = await axios.get(
      `${process.env.NGA_MIS_BASE_URL}/academics/my-assigned-subjects`,
      {
        headers: { Authorization: `Bearer ${token}` },
        params: termId ? { academic_term_id: termId } : {},
      },
    );
    if (!response.data?.success) return [];
    return (response.data.data || [])
      .map((s: any) => Number(s.id ?? s.subject_id))
      .filter((id: number) => !isNaN(id) && id > 0);
  } catch (error: any) {
    console.warn(
      "getAssignedSubjectIds: MIS my-assigned-subjects fetch failed:",
      error.message,
    );
    return [];
  }
}

// @desc    Get all quizzes for a course (or all quizzes if no course specified)
// @route   GET /api/courses/:courseId/quizzes
// @route   GET /api/quizzes (admin/instructor only)
// @access  Private (instructor, admin, enrolled students)
export const getQuizzes = async (req: Request, res: Response) => {
  try {
    const { courseId } = req.params;
    const whereClause: any = {};

    if (courseId) {
      whereClause.course_id = courseId;
    }

    // Scope to academic term: prefer explicit query param, fall back to current term from JWT
    const termIdParam = req.query.academic_term_id
      ? parseInt(req.query.academic_term_id as string)
      : null;
    const resolvedTermId = termIdParam ?? (await getCurrentTermId(req));

    // Scope the management list by capability:
    //  - no QUIZZES_EDIT (students / view-only roles) → only published quizzes
    //  - QUIZZES_EDIT but not QUIZZES_MANAGE_ANY (instructors) → quizzes they
    //    created OR that belong to a subject they're assigned to (so
    //    co-teachers of the same subject see each other's quizzes), never a
    //    subject they have no involvement with
    //  - QUIZZES_MANAGE_ANY (admins) → everything
    const canEditQuizzes = !!req.user?.permissions?.has("QUIZZES_EDIT");
    const canManageAnyQuiz = !!req.user?.permissions?.has("QUIZZES_MANAGE_ANY");
    if (!canEditQuizzes) {
      whereClause.status = "published";
    } else if (!canManageAnyQuiz) {
      const assignedCourseIds = await getAssignedSubjectIds(req, resolvedTermId);
      const ownershipScope: any[] = [{ created_by: req.user.id }];
      if (assignedCourseIds.length > 0) {
        ownershipScope.push({ course_id: { [Op.in]: assignedCourseIds } });
      }
      whereClause[Op.and] = [
        ...(whereClause[Op.and] || []),
        { [Op.or]: ownershipScope },
      ];
    }
    if (resolvedTermId) {
      whereClause[Op.and] = [
        ...(whereClause[Op.and] || []),
        {
          [Op.or]: [
            { academic_term_id: resolvedTermId },
            { academic_term_id: null },
          ],
        },
      ];
    }

    const quizzes = await Quiz.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: "quizCreator",
          attributes: ["id", "first_name", "last_name", "email"],
        },
        {
          model: QuizQuestion,
          attributes: ["id", "points", "order"],
          required: false,
        },
      ],
      order: [["created_at", "DESC"]],
    });

    // Add computed fields
    const quizzesWithStats = quizzes.map((quiz) => ({
      ...quiz.toJSON(),
      total_questions: quiz.questions?.length || 0,
      total_points:
        quiz.questions?.reduce((sum, q) => sum + Number(q.points), 0) || 0,
      is_available: quiz.is_available,
      is_public: quiz.is_public,
    }));

    res.status(200).json({
      success: true,
      count: quizzesWithStats.length,
      data: quizzesWithStats,
    });
  } catch (error) {
    console.error("Get quizzes error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Quizzes grouped by subject, role-scoped, paginated by subject.
//          Backs the redesigned /quizzes management page.
// @route   GET /api/quizzes/grouped
// @access  Private (QUIZZES_VIEW)
export const getGroupedQuizzes = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const pageSize = Math.min(
      24,
      Math.max(1, parseInt(String(req.query.pageSize ?? "8"), 10) || 8),
    );
    const search = String(req.query.search ?? "").trim().toLowerCase();
    const statusFilter = String(req.query.status ?? "").trim();
    const typeFilter = String(req.query.type ?? "").trim();
    const subjectIdParam = req.query.subjectId ? Number(req.query.subjectId) : null;

    const { scope, subjects } = await getScopedSubjects(req);
    if (scope === "none") {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized to view quizzes" });
    }

    let visibleSubjects = subjects;
    if (subjectIdParam != null && !isNaN(subjectIdParam)) {
      visibleSubjects = visibleSubjects.filter((s) => s.id === subjectIdParam);
    }

    const canEditQuizzes = !!req.user?.permissions?.has("QUIZZES_EDIT");
    const canManageAnyQuiz = !!req.user?.permissions?.has("QUIZZES_MANAGE_ANY");
    const canCreate = !!req.user?.permissions?.has("QUIZZES_CREATE");

    const resolvedTermId = req.query.academic_term_id
      ? parseInt(req.query.academic_term_id as string, 10)
      : await getCurrentTermId(req);
    const termAnd = resolvedTermId
      ? [
          {
            [Op.or]: [
              { academic_term_id: resolvedTermId },
              { academic_term_id: null },
            ],
          },
        ]
      : [];

    // Non-editors (students) only see published quizzes; instructors without
    // MANAGE_ANY are limited to their own + co-taught subjects (already scoped
    // by getScopedSubjects), managers see all.
    const baseAnd: any[] = [...termAnd];
    if (!canEditQuizzes) {
      baseAnd.push({ status: "published" });
    } else if (
      ["draft", "published", "completed"].includes(statusFilter)
    ) {
      baseAnd.push({ status: statusFilter });
    }
    if (["Assessment", "Homework", "Quiz", "Exam"].includes(typeFilter)) {
      baseAnd.push({ type: typeFilter });
    }
    if (search) {
      baseAnd.push({
        [Op.or]: [
          { title: { [Op.like]: `%${search}%` } },
          { description: { [Op.like]: `%${search}%` } },
        ],
      });
    }

    // Keep subjects whose name/code matches the search, or that have a matching quiz.
    if (search) {
      const nameHit = new Set(
        visibleSubjects
          .filter(
            (s) =>
              s.name.toLowerCase().includes(search) ||
              (s.code ?? "").toLowerCase().includes(search),
          )
          .map((s) => s.id),
      );
      let quizHit = new Set<number>();
      if (visibleSubjects.length > 0) {
        const rows = (await Quiz.findAll({
          where: {
            course_id: { [Op.in]: visibleSubjects.map((s) => s.id) },
            [Op.and]: baseAnd,
          },
          attributes: ["course_id"],
          group: ["course_id"],
          raw: true,
        })) as any[];
        quizHit = new Set(rows.map((r) => Number(r.course_id)));
      }
      visibleSubjects = visibleSubjects.filter(
        (s) => nameHit.has(s.id) || quizHit.has(s.id),
      );
    }
    visibleSubjects = visibleSubjects.sort((a, b) => a.name.localeCompare(b.name));

    const totalSubjects = visibleSubjects.length;
    const totalPages = Math.max(1, Math.ceil(totalSubjects / pageSize));
    const pageSubjects = visibleSubjects.slice(
      (page - 1) * pageSize,
      page * pageSize,
    );

    // Global count across every visible subject.
    const allIds = visibleSubjects.map((s) => s.id);
    let grandTotal = 0;
    if (allIds.length > 0) {
      grandTotal = await Quiz.count({
        where: { course_id: { [Op.in]: allIds }, [Op.and]: baseAnd },
      });
    }

    const PER_SUBJECT_CAP = 25;
    const bySubject = new Map<number, any[]>();

    if (pageSubjects.length > 0) {
      const quizzes = await Quiz.findAll({
        where: {
          course_id: { [Op.in]: pageSubjects.map((s) => s.id) },
          [Op.and]: baseAnd,
        },
        include: [
          {
            model: User,
            as: "quizCreator",
            attributes: ["id", "first_name", "last_name"],
          },
          { model: QuizQuestion, attributes: ["id", "points"], required: false },
        ],
        order: [["created_at", "DESC"]],
      });

      const quizIds = quizzes.map((q) => q.id);
      const subCounts = new Map<number, { total: number; graded: number }>();
      if (quizIds.length > 0) {
        const subRows = (await QuizSubmission.findAll({
          where: { quiz_id: { [Op.in]: quizIds }, status: "completed" },
          attributes: ["quiz_id", "grade_status"],
          raw: true,
        })) as any[];
        for (const r of subRows) {
          const c = subCounts.get(r.quiz_id) ?? { total: 0, graded: 0 };
          c.total += 1;
          if (["graded", "auto_graded"].includes(r.grade_status)) c.graded += 1;
          subCounts.set(r.quiz_id, c);
        }
      }

      for (const q of quizzes) {
        const list = bySubject.get(q.course_id!) ?? [];
        const questions = (q as any).questions ?? [];
        const sc = subCounts.get(q.id) ?? { total: 0, graded: 0 };
        list.push({
          id: q.id,
          title: q.title,
          description: q.description,
          type: q.type,
          status: q.status,
          course_id: q.course_id,
          created_by: q.created_by,
          is_public: q.is_public,
          start_date: q.start_date,
          end_date: q.end_date,
          created_at: q.createdAt,
          total_questions: questions.length,
          total_points: questions.reduce(
            (s: number, x: any) => s + Number(x.points || 0),
            0,
          ),
          submission_count: sc.total,
          graded_count: sc.graded,
          creator: (q as any).quizCreator ?? null,
          // Subjects are already scoped to what the caller teaches, so any
          // editor may manage quizzes within them (co-teacher model, matching
          // getQuizzes). is_own flags the ones they personally created.
          // Co-teachers see each other's quizzes but only the creator (or a
          // super admin) may edit them or change their status.
          can_edit: canEditQuizzes && canManageQuiz(req.user, q),
          is_own: q.created_by === req.user.id,
        });
        bySubject.set(q.course_id!, list);
      }
    }

    const data = pageSubjects.map((s) => {
      const all = bySubject.get(s.id) ?? [];
      return {
        subject_id: s.id,
        subject_name: s.name,
        subject_code: s.code,
        quiz_count: all.length,
        published_count: all.filter((q) => q.status === "published").length,
        draft_count: all.filter((q) => q.status === "draft").length,
        has_more: all.length > PER_SUBJECT_CAP,
        quizzes: all.slice(0, PER_SUBJECT_CAP),
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        scope,
        can_create: canCreate,
        can_edit: canEditQuizzes,
        subjects: data,
        all_subjects: subjects.map((s) => ({
          id: s.id,
          name: s.name,
          code: s.code,
        })),
        totals: { subjects: totalSubjects, quizzes: grandTotal },
        pagination: { page, page_size: pageSize, total_pages: totalPages },
      },
    });
  } catch (error) {
    console.error("Get grouped quizzes error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Get single quiz
// @route   GET /api/quizzes/:id
// @access  Private (instructor, admin, enrolled students)
export const getQuiz = async (req: Request, res: Response) => {
  try {
    // Students (no edit rights) get a separate, answer-free view.
    const isStudentView = !req.user.permissions?.has("QUIZZES_EDIT");

    const quiz = await Quiz.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: "quizCreator",
          attributes: ["id", "first_name", "last_name", "email"],
        },
        {
          model: QuizQuestion,
          include: [
            ...(isStudentView
              ? []
              : [
                  {
                    model: QuizAttempt,
                    where: { student_id: req.user.id },
                    required: false,
                    attributes: [
                      "id",
                      "submitted_answer",
                      "is_correct",
                      "points_earned",
                    ],
                  },
                ]),
            ...getQuestionBankInclude(),
          ],
        },
      ],
      // Nested `order` inside an include is ignored by Sequelize — order here.
      order: [[{ model: QuizQuestion, as: "questions" }, "order", "ASC"]],
    });

    if (!quiz) {
      return res
        .status(404)
        .json({ success: false, message: "Quiz not found" });
    }

    if (!isStudentView) {
      // can_manage drives the edit / status / grading controls on the detail page
      return res.status(200).json({
        success: true,
        data: {
          ...quiz.toJSON(),
          can_manage: canManageQuiz(req.user, quiz),
          // marking is wider than managing: any teacher of the quiz's subject
          can_grade:
            !!req.user?.permissions?.has("QUIZZES_GRADE") &&
            (await canGradeQuiz(req, quiz)),
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: await buildStudentQuizView(req, quiz),
    });
  } catch (error: any) {
    if (error?.status === 403) {
      return res.status(403).json({ success: false, message: error.message });
    }
    if (error?.response?.status === 401) {
      return handleMisError(error, res, "MIS session expired");
    }
    console.error("Get quiz error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * GET /quizzes/:id for a student. Drafts are never shown; when the student
 * can't (or no longer) take the quiz and has a finished attempt, their
 * results come back instead (`quiz_completed`), filtered by the quiz's
 * result settings. Otherwise the quiz comes back with:
 *  - questions without correct answers/explanations, in a per-attempt random
 *    order when `randomize_questions` is on;
 *  - `student_state`: availability window + attempt counts, so the page can
 *    explain why it can't start instead of failing on "Start".
 */
async function buildStudentQuizView(req: Request, quiz: Quiz) {
  if (!["published", "completed"].includes(quiz.status)) {
    const err: any = new Error("Quiz is not available");
    err.status = 403;
    throw err;
  }

  const [attempts, enrolled] = await Promise.all([
    studentAttemptSummary(quiz, req.user.id),
    studentMayTakeQuiz(req, quiz),
  ]);
  const availability = quizAvailability(quiz);

  const canStart =
    enrolled &&
    (attempts.in_progress_submission_id !== null ||
      (availability.state === "open" && attempts.can_start_new_attempt));

  const blocked_reason = !enrolled
    ? "You are not enrolled in this quiz's subject."
    : attempts.in_progress_submission_id !== null
      ? null
      : availability.state !== "open"
        ? availabilityMessage(availability)
        : !attempts.can_start_new_attempt
          ? `You have used all ${attempts.max_attempts} attempt${attempts.max_attempts === 1 ? "" : "s"} for this quiz.`
          : null;

  const student_state = {
    availability,
    attempts,
    enrolled,
    can_start: canStart,
    blocked_reason,
  };

  // Nothing left to take: show the latest results instead.
  if (!canStart && attempts.last_finished_submission_id) {
    const submission = await QuizSubmission.findByPk(
      attempts.last_finished_submission_id,
      {
        include: [
          {
            model: QuizAttempt,
            as: "attempts",
            include: [
              {
                model: QuizQuestion,
                as: "attemptQuestion",
                attributes: ["id", "points"],
                include: [
                  {
                    model: QuestionBank,
                    as: "questionBank",
                    attributes: [
                      "question_text",
                      "question_type",
                      "question_data",
                      "explanation",
                      "correct_answer",
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    );
    if (submission) {
      return {
        quiz_completed: true,
        ...buildStudentResults(submission, quiz),
        student_state,
      };
    }
  }

  const json: any = quiz.toJSON();
  const seed = attemptSeed(quiz.id, req.user.id, attempts.current_attempt_number);
  let questions: any[] = canStart
    ? (json.questions || []).map((q: any) => sanitizeQuestionForStudent(q, seed))
    : [];
  if (quiz.randomize_questions) questions = seededShuffle(questions, seed);

  return {
    ...json,
    questions,
    question_count: (json.questions || []).length,
    total_points: (json.questions || []).reduce(
      (sum: number, q: any) => sum + (Number(q.points) || 0),
      0,
    ),
    can_manage: false,
    student_state,
  };
}

// @desc    Create quiz
// @route   POST /api/courses/:courseId/quizzes
// @access  Private/Instructor/Admin
export const createQuiz = async (req: Request, res: Response) => {
  // The client hits POST /api/courses/:courseId/quizzes, but the same handler
  // is mounted at POST /api/quizzes where the course comes from the body.
  const rawCourseId = req.params.courseId ?? req.body?.course_id;
  const courseId = Number(rawCourseId);
  if (!Number.isInteger(courseId) || courseId <= 0) {
    return res.status(400).json({
      success: false,
      message: "A valid course id is required to create a quiz",
      errors: [{ field: "course_id", message: "A valid course id is required" }],
    });
  }

  // req.body has already been validated/sanitised by validateBody(createQuizSchema)
  const quizData: CreateQuizPayload = req.body;

  // Check that the course exists in MIS. Distinguish "not found" from "MIS is
  // unreachable / session expired" so the user gets an actionable message.
  const token = getMisToken(req);
  try {
    const courseResponse = await axios.get(
      `${process.env.NGA_MIS_BASE_URL}/academics/subjects/${courseId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!courseResponse.data?.success || !courseResponse.data?.data) {
      return res
        .status(404)
        .json({ success: false, message: "Course not found" });
    }
  } catch (courseError: any) {
    const status = courseError.response?.status;
    if (status === 401) {
      return handleMisError(courseError, res, "MIS session expired");
    }
    if (status === 404) {
      return res
        .status(404)
        .json({ success: false, message: "Course not found" });
    }
    if (status === 403) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this course",
      });
    }
    console.error("createQuiz: could not verify course with MIS:", courseError.message);
    return res.status(502).json({
      success: false,
      message:
        "Could not verify the course with the MIS. Please try again in a moment.",
    });
  }

  const transaction = await sequelize.transaction();
  try {
    const academicTermId = await getCurrentTermId(req);

    const quiz = await Quiz.create(
      {
        title: quizData.title,
        description: quizData.description,
        course_id: courseId,
        created_by: req.user.id,
        status: quizData.status,
        type: quizData.type,
        instructions: quizData.instructions ?? undefined,
        // Optional overall duration (minutes). Null = per-question timing.
        time_limit: quizData.time_limit ?? undefined,
        max_attempts: quizData.max_attempts ?? undefined,
        passing_score: quizData.passing_score ?? undefined,
        show_results_immediately: quizData.show_results_immediately,
        randomize_questions: quizData.randomize_questions,
        show_correct_answers: quizData.show_correct_answers,
        enable_automatic_grading: quizData.enable_automatic_grading,
        require_manual_grading: quizData.require_manual_grading,
        start_date: quizData.start_date
          ? new Date(quizData.start_date)
          : undefined,
        end_date: quizData.end_date ? new Date(quizData.end_date) : undefined,
        is_public: quizData.is_public,
        academic_term_id: academicTermId ?? null,
      },
      { transaction },
    );

    await transaction.commit();
    // Fire-and-forget: push open/close reminders to the MIS Reminder Hub.
    void syncQuiz(quiz.id);

    // Fetch the created quiz with associations
    const createdQuiz = await Quiz.findByPk(quiz.id, {
      include: [
        {
          model: User,
          as: "quizCreator",
          attributes: ["id", "first_name", "last_name", "email"],
        },
      ],
    });

    res.status(201).json({
      success: true,
      message: "Quiz created successfully",
      data: createdQuiz,
    });
  } catch (error) {
    await transaction.rollback();
    return sendControllerError(res, error, "creating the quiz");
  }
};

// @desc    Update quiz
// @route   PUT /api/quizzes/:id
// @access  Private/Instructor/Admin (quiz creator or course instructor)
export const updateQuiz = async (req: Request, res: Response) => {
  const quizId = Number(req.params.id);
  if (!Number.isInteger(quizId) || quizId <= 0) {
    return res
      .status(400)
      .json({ success: false, message: "A valid quiz id is required" });
  }

  // req.body has already been validated/sanitised by validateBody(updateQuizSchema)
  const updateData: UpdateQuizPayload = req.body;

  const transaction = await sequelize.transaction();
  try {
    const quiz = await Quiz.findByPk(quizId, { transaction });
    if (!quiz) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Quiz not found" });
    }

    // Check if user is quiz creator or admin
    if (!canManageQuiz(req.user, quiz)) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this quiz",
      });
    }

    // Don't allow status change to published if there are no questions
    if (updateData.status === "published" && quiz.status !== "published") {
      const questionCount = await QuizQuestion.count({
        where: { quiz_id: quiz.id },
        transaction,
      });

      if (questionCount === 0) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "Cannot publish a quiz that has no questions yet",
          errors: [
            {
              field: "status",
              message: "Add at least one question before publishing",
            },
          ],
        });
      }
    }

    // Cross-field check against the stored value when only one date is sent.
    const effectiveStart =
      updateData.start_date === undefined
        ? quiz.start_date ?? null
        : updateData.start_date
          ? new Date(updateData.start_date)
          : null;
    const effectiveEnd =
      updateData.end_date === undefined
        ? quiz.end_date ?? null
        : updateData.end_date
          ? new Date(updateData.end_date)
          : null;
    if (
      effectiveStart &&
      effectiveEnd &&
      effectiveEnd.getTime() <= effectiveStart.getTime()
    ) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "End date must be after the start date",
        errors: [
          { field: "end_date", message: "End date must be after the start date" },
        ],
      });
    }

    // Only touch the columns that were actually sent. Nullable fields are
    // cleared when the client explicitly sends null.
    const changes: Partial<QuizCreationAttributes> = {};
    if (updateData.title !== undefined) changes.title = updateData.title;
    if (updateData.description !== undefined)
      changes.description = updateData.description;
    if (updateData.status !== undefined) changes.status = updateData.status;
    if (updateData.type !== undefined) changes.type = updateData.type;
    if (updateData.instructions !== undefined)
      changes.instructions = updateData.instructions ?? (null as any);
    if (updateData.max_attempts !== undefined)
      changes.max_attempts = updateData.max_attempts ?? (null as any);
    if (updateData.passing_score !== undefined)
      changes.passing_score = updateData.passing_score ?? (null as any);
    if (updateData.time_limit !== undefined)
      changes.time_limit = updateData.time_limit ?? (null as any);
    if (updateData.show_results_immediately !== undefined)
      changes.show_results_immediately = updateData.show_results_immediately;
    if (updateData.randomize_questions !== undefined)
      changes.randomize_questions = updateData.randomize_questions;
    if (updateData.show_correct_answers !== undefined)
      changes.show_correct_answers = updateData.show_correct_answers;
    if (updateData.enable_automatic_grading !== undefined)
      changes.enable_automatic_grading = updateData.enable_automatic_grading;
    if (updateData.require_manual_grading !== undefined)
      changes.require_manual_grading = updateData.require_manual_grading;
    if (updateData.is_public !== undefined) changes.is_public = updateData.is_public;
    if (updateData.start_date !== undefined)
      changes.start_date = effectiveStart ?? (null as any);
    if (updateData.end_date !== undefined)
      changes.end_date = effectiveEnd ?? (null as any);

    await quiz.update(changes, { transaction });
    await transaction.commit();
    // Re-send (or cancel, e.g. back to draft) the MIS reminders.
    void syncQuiz(quiz.id);

    // Fetch updated quiz
    const updatedQuiz = await Quiz.findByPk(quiz.id, {
      include: [
        {
          model: User,
          as: "quizCreator",
          attributes: ["id", "first_name", "last_name", "email"],
        },
      ],
    });

    res.status(200).json({
      success: true,
      message: "Quiz updated successfully",
      data: updatedQuiz,
    });
  } catch (error) {
    await transaction.rollback();
    return sendControllerError(res, error, "updating the quiz");
  }
};

// @desc    Delete quiz
// @route   DELETE /api/quizzes/:id
// @access  Private/Instructor/Admin (quiz creator or course instructor)
export const deleteQuiz = async (req: Request, res: Response) => {
  const quizId = Number(req.params.id);
  if (!Number.isInteger(quizId) || quizId <= 0) {
    return res
      .status(400)
      .json({ success: false, message: "A valid quiz id is required" });
  }

  const transaction = await sequelize.transaction();
  try {
    const quiz = await Quiz.findByPk(quizId, { transaction });
    if (!quiz) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Quiz not found" });
    }

    // Check if user is quiz creator or admin
    if (!canManageQuiz(req.user, quiz)) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this quiz",
      });
    }

    // Check if there are any submissions
    const submissionCount = await QuizSubmission.count({
      where: { quiz_id: quiz.id },
      transaction,
    });

    if (submissionCount > 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Cannot delete this quiz: it already has ${submissionCount} submission${submissionCount === 1 ? "" : "s"}`,
      });
    }

    await quiz.destroy({ transaction });
    await transaction.commit();
    void cancelQuiz(quizId);

    res
      .status(200)
      .json({ success: true, message: "Quiz deleted successfully", data: {} });
  } catch (error) {
    await transaction.rollback();
    return sendControllerError(res, error, "deleting the quiz");
  }
};

// @desc    Get quiz statistics
// @route   GET /api/quizzes/:id/stats
// @access  Private/Instructor/Admin (quiz creator or course instructor)
export const getQuizStats = async (req: Request, res: Response) => {
  try {
    const quiz = await Quiz.findByPk(req.params.id);
    if (!quiz) {
      return res
        .status(404)
        .json({ success: false, message: "Quiz not found" });
    }

    // Check authorization
    if (!canManageQuiz(req.user, quiz)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view quiz statistics",
      });
    }

    // Get basic stats
    const [submissionStats, attemptStats] = await Promise.all([
      QuizSubmission.findAll({
        where: { quiz_id: quiz.id },
        attributes: [
          [sequelize.fn("COUNT", sequelize.col("id")), "total_submissions"],
          [sequelize.fn("AVG", sequelize.col("percentage")), "average_score"],
          [sequelize.fn("MAX", sequelize.col("percentage")), "highest_score"],
          [sequelize.fn("MIN", sequelize.col("percentage")), "lowest_score"],
          [sequelize.fn("SUM", sequelize.col("passed")), "passed_count"],
        ],
        raw: true,
      }),
      QuizAttempt.findAll({
        where: { quiz_id: quiz.id },
        attributes: [
          "question_id",
          [sequelize.fn("COUNT", sequelize.col("id")), "total_attempts"],
          [
            sequelize.fn("SUM", sequelize.col("is_correct")),
            "correct_attempts",
          ],
          [
            sequelize.fn("AVG", sequelize.col("points_earned")),
            "average_points",
          ],
        ],
        group: ["question_id"],
        raw: true,
      }),
    ]);

    const stats = submissionStats[0] as any;
    const questionStats = await Promise.all(
      attemptStats.map(async (attemptStat: any) => {
        const question = await QuizQuestion.findByPk(attemptStat.question_id);
        return {
          question_id: attemptStat.question_id,
          question_text:
            question?.questionBank?.question_text?.substring(0, 50) + "...",
          total_attempts: parseInt(attemptStat.total_attempts),
          correct_rate:
            attemptStat.total_attempts > 0
              ? (parseInt(attemptStat.correct_attempts) /
                  parseInt(attemptStat.total_attempts)) *
                100
              : 0,
          average_points: parseFloat(attemptStat.average_points) || 0,
        };
      }),
    );

    res.status(200).json({
      success: true,
      data: {
        total_submissions: parseInt(stats.total_submissions) || 0,
        average_score: parseFloat(stats.average_score) || 0,
        highest_score: parseFloat(stats.highest_score) || 0,
        lowest_score: parseFloat(stats.lowest_score) || 0,
        pass_rate:
          stats.total_submissions > 0
            ? (parseInt(stats.passed_count) /
                parseInt(stats.total_submissions)) *
              100
            : 0,
        question_stats: questionStats,
      },
    });
  } catch (error) {
    console.error("Get quiz stats error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @route   GET /api/quizzes/available
// @access  Private/Student
export const getAvailableQuizzes = async (req: Request, res: Response) => {
  try {
    if (!req.user.permissions?.has("QUIZZES_ATTEMPT")) {
      return res.status(403).json({
        success: false,
        message: "Only students can access available quizzes",
      });
    }

    // Get enrolled courses from NGA MIS API
    const token = getMisToken(req);
    let courseIds: number[] = [];

    if (token && req.user.mis_user_id) {
      try {
        // Without academic_year_id, MIS returns every enrollment the student
        // has ever had, across every year.
        const yearId = await resolveAcademicYearId(req);
        const enrolledResponse = await axios.get(
          `${process.env.NGA_MIS_BASE_URL}/academics/students/${req.user.mis_user_id}/enrolled-subjects`,
          {
            headers: { Authorization: `Bearer ${token}` },
            params: yearId ? { academic_year_id: yearId } : {},
          },
        );
        if (enrolledResponse.data?.success && enrolledResponse.data?.data) {
          courseIds = enrolledResponse.data.data.map(
            (subject: any) => subject.id,
          );
        }
      } catch (error: any) {
        if (error.response?.status === 401) {
          return handleMisError(error, res, "MIS session expired");
        }
        console.error("Failed to fetch enrolled courses from NGA MIS:", error);
      }
    }

    // Scope to current academic term
    const currentTermId = await getCurrentTermId(req);
    const termCondition = currentTermId
      ? [
          {
            [Op.or]: [
              { academic_term_id: currentTermId },
              { academic_term_id: null },
            ],
          },
        ]
      : [];

    const quizzes = await Quiz.findAll({
      where: {
        [Op.and]: [
          { status: "published" },
          {
            [Op.or]: [
              { is_public: true },
              { course_id: { [Op.in]: courseIds } },
            ],
          },
          ...termCondition,
        ],
      },
      include: [
        {
          model: QuizQuestion,
          attributes: ["id"],
          required: false,
        },
      ],
      order: [
        ["start_date", "ASC"],
        ["created_at", "DESC"],
      ],
    });

    console.log("Debug Available Quizzes:", {
      role: req.user.role,
      userId: req.user.id,
      enrolledCourseIds: courseIds,
      totalQuizzesFound: quizzes.length,
      quizzes: quizzes.map((q) => ({
        id: q.id,
        title: q.title,
        status: q.status,
        is_public: q.is_public,
        course_id: q.course_id,
        start_date: q.start_date,
        end_date: q.end_date,
      })),
    });

    // Filter quizzes based on date availability
    const now = new Date();
    const availableQuizzes = quizzes.filter((quiz) => {
      const startDate = quiz.start_date;
      const endDate = quiz.end_date;

      const isAfterStart = !startDate || new Date(startDate) <= now;
      const isBeforeEnd = !endDate || new Date(endDate) >= now;

      if (!isAfterStart || !isBeforeEnd) {
        console.log(
          `Quiz ${quiz.id} filtered out by date. SD: ${startDate}, ED: ${endDate}, Now: ${now}`,
        );
      }

      return isAfterStart && isBeforeEnd;
    });

    console.log(
      `Found ${availableQuizzes.length} available quizzes after date filtering`,
    );

    // If student, filter out completed quizzes but include in-progress ones with status
    let filteredQuizzes = availableQuizzes;
    let allSubmissions: any[] = [];
    if (!req.user.permissions?.has("QUIZZES_EDIT")) {
      // Get all submissions for this student (completed and in-progress)
      allSubmissions = await QuizSubmission.findAll({
        where: {
          student_id: req.user.id,
          status: { [Op.in]: ["completed", "in_progress"] },
        },
        attributes: ["quiz_id", "status"],
      });

      const completedQuizIds = allSubmissions
        .filter((sub: any) => sub.status === "completed")
        .map((sub: any) => sub.quiz_id);

      console.log(
        `Student ${req.user.id} has completed ${completedQuizIds.length} quizzes`,
      );

      // Filter out completed quizzes, but keep in-progress ones
      filteredQuizzes = availableQuizzes.filter(
        (quiz) => !completedQuizIds.includes(quiz.id),
      );
      console.log(
        `Found ${filteredQuizzes.length} available quizzes after filtering completed ones`,
      );
    }

    const quizzesWithStats = filteredQuizzes.map((quiz) => {
      const inProgressQuizIds =
        !req.user.permissions?.has("QUIZZES_EDIT")
          ? allSubmissions
              .filter((sub: any) => sub.status === "in_progress")
              .map((sub: any) => sub.quiz_id)
          : [];

      return {
        ...quiz.toJSON(),
        total_questions: quiz.questions?.length || 0,
        total_points:
          quiz.questions?.reduce((sum, q) => sum + Number(q.points), 0) || 0,
        is_available: quiz.is_available,
        is_public: quiz.is_public,
        studentStatus: inProgressQuizIds.includes(quiz.id)
          ? "in_progress"
          : "not_started",
      };
    });

    console.log(
      `Returning ${quizzesWithStats.length} available quizzes to student`,
    );

    res.status(200).json({
      success: true,
      count: quizzesWithStats.length,
      data: quizzesWithStats,
    });
  } catch (error) {
    console.error("Get available quizzes error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Helper function to calculate grade from percentage
const getGradeFromScore = (
  percentage: number,
  passingScore: number = 60,
): string => {
  const p = parseFloat(percentage as any);
  const ps = parseFloat(passingScore as any);

  if (p >= 90) return "A";
  if (p >= 80) return "B";
  if (p >= 70) return "C";
  if (p >= 50) return "D";

  // If the student has reached the passing score but percentage is low (e.g. passing score set to 40),
  // they should not get an "F".
  if (p >= ps) return "D";

  return "F";
};

// @desc    Get all public quizzes
// @route   GET /api/quizzes/public
// @access  Private (any authenticated user)
export const getPublicQuizzes = async (req: Request, res: Response) => {
  try {
    console.log("Starting getPublicQuizzes function");

    // Get public quizzes that are published and available
    const quizzes = await Quiz.findAll({
      where: {
        is_public: true,
        status: "published",
      },
      include: [
        {
          model: User,
          as: "quizCreator",
          attributes: ["id", "first_name", "last_name", "email"],
        },
        {
          model: QuizQuestion,
          attributes: ["id", "question_type", "points", "order"],
          required: false,
        },
      ],
      order: [["created_at", "DESC"]],
    });

    // Filter quizzes based on date availability
    const now = new Date();
    const availableQuizzes = quizzes.filter((quiz) => {
      const startDate = quiz.start_date;
      const endDate = quiz.end_date;

      const isAfterStart = !startDate || new Date(startDate) <= now;
      const isBeforeEnd = !endDate || new Date(endDate) >= now;

      return isAfterStart && isBeforeEnd;
    });

    // If student, filter out completed quizzes but include in-progress ones with status
    let filteredQuizzes = availableQuizzes;
    let allSubmissions: any[] = [];
    if (!req.user.permissions?.has("QUIZZES_EDIT")) {
      console.log("Filtering completed quizzes for student", req.user.id);
      // Get all submissions for this student (completed and in-progress)
      allSubmissions = await QuizSubmission.findAll({
        where: {
          student_id: req.user.id,
          status: { [Op.in]: ["completed", "in_progress"] },
        },
        attributes: ["quiz_id", "status"],
      });

      const completedQuizIds = allSubmissions
        .filter((sub: any) => sub.status === "completed")
        .map((sub: any) => sub.quiz_id);

      console.log(
        `Student ${req.user.id} has completed ${completedQuizIds.length} quizzes`,
      );

      filteredQuizzes = availableQuizzes.filter(
        (quiz) => !completedQuizIds.includes(quiz.id),
      );
    }

    // Add computed fields
    const quizzesWithStats = filteredQuizzes.map((quiz) => {
      const inProgressQuizIds =
        !req.user.permissions?.has("QUIZZES_EDIT")
          ? allSubmissions
              .filter((sub: any) => sub.status === "in_progress")
              .map((sub: any) => sub.quiz_id)
          : [];

      return {
        ...quiz.toJSON(),
        total_questions: quiz.questions?.length || 0,
        total_points:
          quiz.questions?.reduce((sum, q) => sum + Number(q.points), 0) || 0,
        is_available: quiz.is_available,
        is_public: quiz.is_public,
        studentStatus: inProgressQuizIds.includes(quiz.id)
          ? "in_progress"
          : "not_started",
      };
    });

    console.log(`Returning ${quizzesWithStats.length} public quizzes`);

    res.status(200).json({
      success: true,
      count: quizzesWithStats.length,
      data: quizzesWithStats,
    });
  } catch (error) {
    console.error("Get public quizzes error:", error);
    console.error("Error stack:", error instanceof Error ? error.stack : error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Submit quiz answers directly (for the new quiz taking system)
// @route   POST /api/quizzes/:id/submit
// @access  Private/Student
export const submitQuizAttempt = async (req: Request, res: Response) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { answers, time_taken } = req.body;

    if (!answers || !Array.isArray(answers)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Answers array is required",
      });
    }

    // Find the quiz
    const quiz = await Quiz.findByPk(id, { transaction });
    if (!quiz) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Quiz not found" });
    }

    // Check if quiz is available
    if (quiz.status !== "published") {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Quiz is not available for submission",
      });
    }

    // Check if student already has an in-progress submission
    const existingSubmission = await QuizSubmission.findOne({
      where: {
        quiz_id: id,
        student_id: req.user.id,
        status: "in_progress",
      },
      transaction,
    });

    const now = new Date();
    const quizClosed =
      !!quiz.end_date &&
      now.getTime() >
        new Date(quiz.end_date).getTime() + SUBMIT_GRACE_SECONDS * 1000;

    if (!existingSubmission) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: quizClosed
          ? "Quiz deadline has passed"
          : "No active quiz session found. Please start the quiz first.",
      });
    }

    // Time is up (attempt duration or the quiz window, beyond the grace
    // period): don't throw the attempt away — close it with the answers that
    // were saved on the server before the deadline.
    if (isPastDeadline(existingSubmission, now) || quizClosed) {
      const summary = await finalizeFromSavedAttempts(
        existingSubmission,
        quiz,
        transaction,
      );
      await transaction.commit();
      return res.status(200).json({
        success: true,
        message:
          "Time was up — your quiz was submitted with the answers saved before the deadline.",
        data: summary,
      });
    }

    // Use existing submission instead of creating new one
    const submission = existingSubmission;

    // Check if automatic grading is enabled for this quiz
    const enableAutoGrading = quiz.enable_automatic_grading !== false; // Default to true
    const requireManualGrading = quiz.require_manual_grading === true;

    // Get all questions for this quiz to calculate total max score and for grading
    const allQuizQuestions = await QuizQuestion.findAll({
      where: { quiz_id: id },
      include: getQuestionBankInclude(),
      transaction,
    });

    const calculatedMaxScore = allQuizQuestions.reduce(
      (sum, q) => sum + Number(q.points),
      0,
    );

    // Now calculate scores and create/update attempts
    let calculatedTotalScore = 0;
    // A code answer the judge couldn't grade leaves the attempt for review.
    let anyPendingReview = false;
    const results = [];

    // Get all attempts for this submission to calculate scores
    const allAttempts = await QuizAttempt.findAll({
      where: { submission_id: submission.id },
      transaction,
    });

    for (const answer of answers) {
      const question = allQuizQuestions.find(
        (q) => q.id === Number(answer.question_id),
      );

      if (!question) {
        continue; // Skip invalid questions or questions not in this quiz
      }

      const questionData = question.questionBank?.question_data as any;

      // Per-question timeout is enforced client-side via the countdown timer.
      // time_taken from the client is not reliable for server-side enforcement
      // (stale localStorage start times can produce wildly large values).
      // The overall quiz end_time is the authoritative server-side time limit.
      const questionTimedOut = false;

      // Scoring logic based on grading settings
      let isCorrect = false;
      let pointsEarned = 0;
      let gradingResult: any = null;

      if (questionTimedOut) {
        // If question timed out, no points awarded
        isCorrect = false;
        pointsEarned = 0;
      } else {
        // Always compute the automatic grade. Whether the student sees it is
        // decided by the result settings (see utils/quizStudentView); with
        // manual review it is the instructor's starting point.
        // Use advanced grading for all question types for consistency and to trigger AI grading
        try {
          gradingResult = await AdvancedQuizGrader.gradeWithConfig(
            question,
            answer.answer,
          );
          isCorrect = gradingResult.is_correct;
          pointsEarned = gradingResult.points_earned;
          if (isPendingGrade(gradingResult)) anyPendingReview = true;
        } catch (error) {
          console.error(
            `Error grading question ${question.id} of type ${question.questionBank?.question_type}:`,
            error,
          );
          isCorrect = false;
          pointsEarned = 0;
        }
      }

      calculatedTotalScore += pointsEarned;

      // Check if attempt already exists for this question in this submission
      const existingAttempt = allAttempts.find(
        (attempt) => attempt.question_id === question.id,
      );

      // Normalize submitted and correct answers for better comparison
      const normalizedSubmittedAnswer = AdvancedQuizGrader.normalizeAnswer(
        answer.answer,
        question.questionBank?.question_type,
      );
      const normalizedCorrectAnswer =
        AdvancedQuizGrader.normalizeCorrectAnswer(question);

      let attempt;
      if (existingAttempt) {
        // Update existing attempt
        await existingAttempt.update(
          {
            submitted_answer: normalizedSubmittedAnswer.data,
            correct_answer: normalizedCorrectAnswer.data,
            grading_details: gradingResult?.detailed_feedback ?? null,
            is_correct: isCorrect,
            points_earned: pointsEarned,
            time_taken: answer.time_taken || 0,
            completed_at: new Date(),
            status: questionTimedOut ? "timed_out" : "completed",
          },
          { transaction },
        );
        attempt = existingAttempt;
      } else {
        // Create new attempt record
        attempt = await QuizAttempt.create(
          {
            submission_id: submission.id,
            question_id: question.id,
            student_id: req.user.id,
            quiz_id: parseInt(id),
            submitted_answer: normalizedSubmittedAnswer.data,
            correct_answer: normalizedCorrectAnswer.data,
            grading_details: gradingResult?.detailed_feedback ?? null,
            is_correct: isCorrect,
            points_earned: pointsEarned,
            status: questionTimedOut ? "timed_out" : "completed",
            started_at: new Date(),
            time_taken: answer.time_taken || 0,
          },
          { transaction },
        );
      }

      results.push({
        question_id: question.id,
        user_answer: answer.answer,
        correct_answer:
          question.questionBank?.correct_answer ||
          getCorrectAnswerForQuestion(question.questionBank),
        is_correct: isCorrect,
        points_earned: pointsEarned,
        max_points: Number(question.points),
        explanation:
          question.questionBank?.explanation || "No explanation provided.",
        feedback: gradingResult?.feedback || (questionTimedOut ? "Timed out" : "Pending"),
        timed_out: questionTimedOut,
        time_limit_seconds: question.time_limit_seconds,
      });
    }

    const finalPercentage =
      calculatedMaxScore > 0
        ? (calculatedTotalScore / calculatedMaxScore) * 100
        : 0;

    // Update submission with final scores
    await submission.update(
      {
        total_score: calculatedTotalScore,
        max_score: calculatedMaxScore,
        percentage: finalPercentage,
        time_taken: time_taken || 0,
        status: "completed",
        completed_at: new Date(),
        grade_status: gradeStatusOnSubmit(quiz, anyPendingReview),
        passed: isPassed(finalPercentage, quiz),
      },
      { transaction },
    );

    await transaction.commit();

    // Only what the quiz's result settings allow; the results page loads
    // the details from GET /quizzes/:id/results.
    const visible = buildStudentResults(submission, quiz);
    res.status(201).json({
      success: true,
      data: {
        submission_id: submission.id,
        answered: results.length,
        results_available: visible.results_available,
        message: visible.message,
        ...(visible.grading_settings.show_grades
          ? {
              final_score: calculatedTotalScore,
              max_score: calculatedMaxScore,
              percentage: finalPercentage,
              passed: isPassed(finalPercentage, quiz),
            }
          : {}),
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Submit quiz attempt error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Helper function to get correct answer for a question
const getCorrectAnswerForQuestion = (question: any): any => {
  switch (question.question_type) {
    case "single_choice":
      return (
        question.question_data?.correct_option_index ??
        question.correct_answer?.correct_option_index ??
        question.correct_answer
      );
    case "multiple_choice":
    case "true_false":
      return question.correct_answer;
    case "coding":
      return question.question_data?.expected_output || "Sample solution";
    case "ordering":
      return question.question_data?.correct_order || [];
    case "matching":
      return question.question_data?.correct_matches || {};
    default:
      return null;
  }
};

// @desc    Get quiz results by quiz ID (finds latest submission)
// @route   GET /api/quizzes/:id/results
// @access  Private/Student
export const getQuizResultsById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!req.user.permissions?.has("QUIZZES_VIEW_RESULTS_OWN")) {
      return res.status(403).json({
        success: false,
        message: "Only students can view quiz results",
      });
    }

    // Latest finished attempt, or a specific one via ?submission_id=
    const requestedId = Number(req.query.submission_id);
    const submission = await QuizSubmission.findOne({
      where: {
        quiz_id: id,
        student_id: req.user.id,
        status: { [Op.in]: ["completed", "timed_out"] },
        ...(Number.isInteger(requestedId) && requestedId > 0 ? { id: requestedId } : {}),
      },
      include: [
        {
          model: Quiz,
          as: "quiz",
        },
        {
          model: QuizAttempt,
          as: "attempts",
          include: [
            {
              model: QuizQuestion,
              as: "attemptQuestion",
              attributes: ["id", "points"],
              include: [
                {
                  model: QuestionBank,
                  as: "questionBank",
                  attributes: [
                    "question_text",
                    "question_type",
                    "question_data",
                    "explanation",
                    "correct_answer",
                  ],
                },
              ],
            },
          ],
        },
      ],
      order: [["completed_at", "DESC"]],
    });

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "No completed quiz submission found",
      });
    }

    res.status(200).json({
      success: true,
      data: buildStudentResults(submission, submission.quiz),
    });
  } catch (error) {
    console.error("Get quiz results by ID error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Create a quiz submission (start quiz attempt)
// @route   POST /api/quiz-submissions
// @access  Private/Student
export const createQuizSubmission = async (req: Request, res: Response) => {
  const transaction = await sequelize.transaction();
  try {
    const { quiz_id, status = "in_progress" } = req.body;

    if (!req.user.permissions?.has("QUIZZES_ATTEMPT")) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: "Only students can create quiz submissions",
      });
    }

    // Find the quiz
    const quiz = await Quiz.findByPk(quiz_id, { transaction });
    if (!quiz) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Quiz not found" });
    }

    // Check if student already has an in-progress submission
    const existingSubmission = await QuizSubmission.findOne({
      where: {
        quiz_id,
        student_id: req.user.id,
        status: "in_progress",
      },
      transaction,
    });

    if (existingSubmission) {
      // Time already ran out on the attempt: submit it with what was saved
      // rather than discarding it, and tell the client where the results are.
      const closedMeanwhile = quizAvailability(quiz).state === "closed";
      if (isPastDeadline(existingSubmission) || closedMeanwhile) {
        const summary = await finalizeFromSavedAttempts(
          existingSubmission,
          quiz,
          transaction,
        );
        await transaction.commit();
        return res.status(409).json({
          success: false,
          code: "ATTEMPT_TIME_EXPIRED",
          message:
            "Time ran out on your previous attempt. It was submitted with the answers you had saved.",
          data: summary,
        });
      }

      await transaction.rollback();
      return res.status(200).json({
        success: true,
        data: {
          ...existingSubmission.toJSON(),
          time_limit: quiz.time_limit ?? null,
          time_remaining_seconds: secondsRemaining(existingSubmission),
        },
        message: "Resuming existing submission",
      });
    }

    // Published and inside its availability window
    const availability = quizAvailability(quiz);
    if (availability.state !== "open") {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        code: "QUIZ_NOT_AVAILABLE",
        message: `Quiz is not currently available. ${availabilityMessage(availability)}`.trim(),
        data: { availability },
      });
    }

    if (!(await studentMayTakeQuiz(req, quiz))) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        code: "NOT_ENROLLED",
        message: "You are not enrolled in this quiz's subject.",
      });
    }

    // Calculate attempt number
    const previousSubmissions = await QuizSubmission.count({
      where: {
        quiz_id,
        student_id: req.user.id,
        status: { [Op.in]: ["completed", "timed_out", "abandoned"] },
      },
      transaction,
    });

    // max_attempts (null = unlimited)
    const maxAttempts = Number(quiz.max_attempts) > 0 ? Number(quiz.max_attempts) : null;
    if (maxAttempts !== null && previousSubmissions >= maxAttempts) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        code: "MAX_ATTEMPTS_REACHED",
        message: `You have used all ${maxAttempts} attempt${maxAttempts === 1 ? "" : "s"} for this quiz.`,
        data: { max_attempts: maxAttempts, attempts_used: previousSubmissions },
      });
    }

    // The attempt clock always starts on the server: a client-supplied
    // started_at could otherwise push the deadline out.
    const startTime = new Date();
    const endTime = computeAttemptEndTime(quiz, startTime);

    // Create submission record
    const submission = await QuizSubmission.create(
      {
        quiz_id,
        student_id: req.user.id,
        total_score: 0,
        max_score: 0,
        percentage: 0,
        status,
        grade_status: "pending",
        time_taken: 0,
        started_at: startTime,
        end_time: endTime,
        attempt_number: previousSubmissions + 1,
        passed: false,
      },
      { transaction },
    );

    await transaction.commit();

    res.status(201).json({
      success: true,
      data: {
        ...submission.toJSON(),
        time_limit: quiz.time_limit ?? null,
        time_remaining_seconds: secondsRemaining(submission),
      },
    });
  } catch (error: any) {
    await transaction.rollback();
    if (error?.response?.status === 401) {
      return handleMisError(error, res, "MIS session expired");
    }
    console.error("Create quiz submission error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Get quiz submissions for a student
// @route   GET /api/quiz-submissions
// @access  Private/Student
export const getQuizSubmissions = async (req: Request, res: Response) => {
  try {
    const { quiz_id, status } = req.query;

    if (!req.user.permissions?.has("QUIZZES_VIEW_RESULTS_OWN")) {
      return res.status(403).json({
        success: false,
        message: "Only students can view their quiz submissions",
      });
    }

    const whereClause: any = { student_id: req.user.id };

    if (quiz_id) {
      whereClause.quiz_id = quiz_id;
    }

    if (status) {
      whereClause.status = status;
    }

    // An in-progress lookup is how the taking page resumes an attempt, so it
    // also gets the deadline and the answers already saved on the server
    // (lets a student carry on from another device without losing work).
    const resuming = status === "in_progress";

    const submissions = await QuizSubmission.findAll({
      where: whereClause,
      include: [
        {
          model: Quiz,
          as: "quiz",
          attributes: ["id", "title", "description", "type", "time_limit"],
        },
        ...(resuming
          ? [
              {
                model: QuizAttempt,
                as: "attempts",
                attributes: ["question_id", "submitted_answer", "time_taken"],
              },
            ]
          : []),
      ],
      order: [["started_at", "DESC"]],
    });

    res.status(200).json({
      success: true,
      count: submissions.length,
      data: submissions.map((submission) => {
        const json: any = submission.toJSON();
        json.time_remaining_seconds = secondsRemaining(submission);
        if (resuming) {
          json.answers = (json.attempts || []).map((a: any) => ({
            question_id: a.question_id,
            answer_data: a.submitted_answer,
            time_taken: a.time_taken,
          }));
          delete json.attempts;
        }
        return json;
      }),
    });
  } catch (error) {
    console.error("Get quiz submissions error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Update quiz submission
// @route   PATCH /api/quiz-submissions/:id
// @access  Private/Student (own submissions) or Instructor/Admin
export const updateQuizSubmission = async (req: Request, res: Response) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { time_taken, status } = req.body;

    // Find the submission
    const submission = await QuizSubmission.findByPk(id, {
      include: [{ model: Quiz, as: "quiz", attributes: ["id", "created_by", "course_id", "academic_term_id"] }],
      transaction,
    });
    if (!submission) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Quiz submission not found" });
    }

    const isOwnSubmission = submission.student_id === req.user.id;
    const canGrade =
      !isOwnSubmission &&
      !!req.user.permissions?.has("QUIZZES_GRADE") &&
      (await canGradeQuiz(req, (submission as any).quiz));

    // Check authorization
    if (!isOwnSubmission && !canGrade) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this submission",
      });
    }

    // Update fields
    if (time_taken !== undefined) {
      submission.time_taken = time_taken;
    }

    if (status && canGrade) {
      submission.status = status;
      if (status === "completed") {
        submission.completed_at = new Date();
      }
    }

    await submission.save({ transaction });
    await transaction.commit();

    res.status(200).json({
      success: true,
      data: submission,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Update quiz submission error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Reset quiz submission (delete all answers and reset status)
// @route   POST /api/quizzes/submissions/:id/reset
// @access  Private/Instructor/Admin
export const resetQuizSubmission = async (req: Request, res: Response) => {
  const { id } = req.params;
  const transaction = await sequelize.transaction();

  try {
    // Find the submission
    const submission = await QuizSubmission.findByPk(id, {
      include: [{ model: Quiz, as: "quiz", attributes: ["id", "created_by", "time_limit", "end_date"] }],
      transaction,
    });

    if (!submission) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Quiz submission not found",
      });
    }

    if (!canManageQuiz(req.user, (submission as any).quiz)) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: "Only the quiz's creator or a super admin can reset submissions",
      });
    }

    // Delete all quiz attempts for this submission
    await QuizAttempt.destroy({
      where: { submission_id: id },
      transaction,
    });

    // Reset submission status and scores
    submission.status = "in_progress" as any;
    submission.total_score = 0;
    submission.percentage = 0;
    submission.grade_status = "pending" as any;
    submission.time_taken = 0;
    submission.started_at = new Date();
    // A restarted attempt gets a fresh clock (null when the quiz is untimed).
    submission.end_time =
      computeAttemptEndTime((submission as any).quiz, submission.started_at) ??
      (null as any);
    submission.completed_at = undefined;
    submission.passed = false;

    await submission.save({ transaction });
    await transaction.commit();

    res.status(200).json({
      success: true,
      message: "Quiz submission has been reset",
      data: submission,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Reset quiz submission error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Get AI-driven socratic hint for coding questions
// @route   POST /api/quizzes/questions/:questionId/ai-hint
// @access  Private
export const getAIHint = async (req: Request, res: Response) => {
  try {
    const { questionId } = req.params;
    const { code, language, chatHistory, lastError } = req.body;

    const question = await QuizQuestion.findByPk(questionId, {
      include: getQuestionBankInclude(),
    });

    if (!question) {
      return res.status(404).json({
        success: false,
        message: "Question not found",
      });
    }

    const questionText = question.questionBank?.question_text || "";
    const hint = await aiService.getSocraticHint(
      questionText,
      code,
      language || "javascript",
      chatHistory || [],
      lastError,
    );

    res.status(200).json({
      success: true,
      data: { hint },
    });
  } catch (error: any) {
    console.error("AI hint error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to generate AI hint",
    });
  }
};

// @desc    Run code snippet instantly (no grading, just execution)
//          When `test_cases` array is provided, runs code against each case and returns pass/fail.
// @route   POST /api/quizzes/questions/:questionId/run-code
//          POST /api/quizzes/preview-run  (instructor prep, no questionId required)
// @access  Private
export const runCode = async (req: Request, res: Response) => {
  try {
    const { code, language, stdin, test_cases } = req.body;

    if (!code || !language) {
      return res.status(400).json({
        success: false,
        message: "code and language are required",
      });
    }

    const isWeb = isWebLanguage(language);
    // Fail closed: never run code under a runtime it wasn't written for.
    if (!isWeb && !Judge0Service.getLanguageId(language)) {
      return res.status(400).json({
        success: false,
        code: "UNSUPPORTED_LANGUAGE",
        message: `Unsupported language "${language}".`,
      });
    }

    // ── Batch mode: run code against multiple test cases ──────────────────────
    if (Array.isArray(test_cases) && test_cases.length > 0) {
      if (isWeb) {
        // Web languages can't be auto-tested via Judge0 — return preview flag
        const results = test_cases.map((tc: any) => ({
          testCaseId: tc.id,
          passed: null, // visual only
          input: tc.input,
          expected: tc.expected_output,
          actual: null,
          error: null,
          executionTime: 0,
          memoryUsed: null,
          status: "Web Preview",
          is_hidden: tc.is_hidden,
        }));
        return res.json({ success: true, data: { results, web_preview: true, passed: 0, total: test_cases.length } });
      }

      const normalizeOutput = (s: string | null | undefined) =>
        (s ?? "").replace(/\r\n/g, "\n").trimEnd();

      const results: any[] = [];
      for (const tc of test_cases) {
        try {
          const result = await Judge0Service.runSingle(code, language, tc.input ?? "");
          const actual = normalizeOutput(result.stdout);
          const expected = normalizeOutput(tc.expected_output);
          const compileError = result.compile_output || result.message;
          const runtimeError = result.stderr;
          const statusId = result.status?.id;
          // Judge0 status 3 = Accepted; also do our own string compare
          const passed = statusId === 3 || actual === expected;
          results.push({
            testCaseId: tc.id,
            passed,
            input: tc.is_hidden ? null : (tc.input ?? ""),
            expected: tc.is_hidden ? null : tc.expected_output,
            actual: result.stdout ?? null,
            error: !passed
              ? (compileError || runtimeError || result.status?.description || "Wrong Answer")
              : null,
            executionTime: parseFloat(result.time || "0") * 1000,
            memoryUsed: result.memory ?? null,
            status: result.status?.description ?? "Unknown",
            is_hidden: tc.is_hidden ?? false,
          });
        } catch (tcErr: any) {
          results.push({
            testCaseId: tc.id,
            passed: false,
            input: tc.is_hidden ? null : (tc.input ?? ""),
            expected: tc.is_hidden ? null : tc.expected_output,
            actual: null,
            error: tcErr.message || "Execution failed",
            executionTime: 0,
            memoryUsed: null,
            status: "Error",
            is_hidden: tc.is_hidden ?? false,
          });
        }
      }

      return res.json({
        success: true,
        data: {
          results,
          passed: results.filter((r) => r.passed).length,
          total: results.length,
          web_preview: false,
        },
      });
    }

    // ── Single-run mode ───────────────────────────────────────────────────────
    if (isWeb) {
      return res.json({
        success: true,
        data: { stdout: null, stderr: null, web_preview: true, language, execution_time: 0 },
      });
    }

    const result = await Judge0Service.runSingle(code, language, stdin);

    return res.json({
      success: true,
      data: {
        stdout: result.stdout,
        stderr: result.stderr || result.compile_output,
        exit_code: result.status?.id,
        status: result.status?.description,
        execution_time: parseFloat(result.time || "0") * 1000,
        memory_used: result.memory,
        web_preview: false,
      },
    });
  } catch (error: any) {
    console.error("Run code error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to execute code",
    });
  }
};

// @desc    Languages a coding/algorithmic question can use: the judge's
//          runtimes (with versions when known) and browser-preview web
//          languages. The question form only offers these.
// @route   GET /api/quizzes/code-languages
// @access  Private
export const getCodeLanguages = async (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      judge: Judge0Service.supportedLanguages(),
      web_preview: WEB_PREVIEW_LANGUAGES,
    },
  });
};

// @desc    Generate AI test cases for coding questions
// @route   POST /api/quizzes/generate-test-cases
// @access  Private/Instructor/Admin
export const generateTestCases = async (req: Request, res: Response) => {
  try {
    const { problemDescription, language, starterCode } = req.body;

    if (!problemDescription || !language) {
      return res.status(400).json({
        success: false,
        message: "problemDescription and language are required",
      });
    }

    const testCases = await aiService.generateCodingTestCases(
      problemDescription,
      language,
      starterCode,
    );

    res.status(200).json({
      success: true,
      data: testCases,
    });
  } catch (error: any) {
    console.error("Generate test cases error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to generate test cases",
    });
  }
};

// @desc    Delete a single quiz submission and its proctoring data
// @route   DELETE /api/quizzes/submissions/:submissionId/delete
// @access  Private (instructor, admin)
export const deleteQuizSubmission = async (req: Request, res: Response) => {
  const { submissionId } = req.params;
  const transaction = await sequelize.transaction();

  try {
    const submission = await QuizSubmission.findByPk(submissionId, {
      include: [{ model: Quiz, as: "quiz", attributes: ["id", "created_by"] }],
      transaction,
    });
    if (!submission) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: "Submission not found" });
    }

    if (!canManageQuiz(req.user, (submission as any).quiz)) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: "Only the quiz's creator or a super admin can delete submissions",
      });
    }

    const quizId = submission.quiz_id;
    const studentId = submission.student_id;

    // Delete proctoring events for this student's sessions on this quiz
    const sessions = await ProctoringSession.findAll({
      where: { quiz_id: quizId, student_id: studentId },
      attributes: ["id"],
      transaction,
    });
    const sessionIds = sessions.map((s: any) => s.id);
    if (sessionIds.length > 0) {
      await ProctoringEvent.destroy({ where: { session_id: sessionIds }, transaction });
      await ProctoringSession.destroy({ where: { id: sessionIds }, transaction });
    }

    // Delete quiz attempts
    await QuizAttempt.destroy({ where: { submission_id: submissionId }, transaction });

    // Delete submission
    await submission.destroy({ transaction });

    await transaction.commit();
    res.status(200).json({ success: true, message: "Submission and proctoring data deleted" });
  } catch (error) {
    await transaction.rollback();
    console.error("Delete submission error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Delete ALL submissions and proctoring data for a quiz
// @route   DELETE /api/quizzes/:quizId/submissions/all
// @access  Private (instructor, admin)
export const deleteAllQuizSubmissions = async (req: Request, res: Response) => {
  const { quizId } = req.params;
  const transaction = await sequelize.transaction();

  try {
    const quiz = await Quiz.findByPk(quizId, { transaction });
    if (!quiz) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: "Quiz not found" });
    }

    if (!canManageQuiz(req.user, quiz)) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: "Only the quiz's creator or a super admin can delete submissions",
      });
    }

    // Delete all proctoring events for this quiz's sessions
    const sessions = await ProctoringSession.findAll({
      where: { quiz_id: quizId },
      attributes: ["id"],
      transaction,
    });
    const sessionIds = sessions.map((s: any) => s.id);
    if (sessionIds.length > 0) {
      await ProctoringEvent.destroy({ where: { session_id: sessionIds }, transaction });
      await ProctoringSession.destroy({ where: { id: sessionIds }, transaction });
    }

    // Delete all quiz attempts belonging to this quiz's submissions
    const submissions = await QuizSubmission.findAll({
      where: { quiz_id: quizId },
      attributes: ["id"],
      transaction,
    });
    const submissionIds = submissions.map((s: any) => s.id);
    if (submissionIds.length > 0) {
      await QuizAttempt.destroy({ where: { submission_id: submissionIds }, transaction });
    }

    // Delete all submissions
    const count = await QuizSubmission.destroy({ where: { quiz_id: quizId }, transaction });

    await transaction.commit();
    res.status(200).json({
      success: true,
      message: `Deleted ${count} submission(s) and all associated proctoring data`,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Delete all quiz submissions error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

import { Request, Response } from "express";
import { QuizQuestion, QuizAttempt, User, Quiz } from "../models";
import QuizSubmission from "../models/QuizSubmission.model";
import { Op, Transaction } from "sequelize";
import { sequelize } from "../config/database";
import { QuestionValidator } from "../utils/questionValidation";
import { QuizGrader, AdvancedQuizGrader } from "../utils/quizGrader";
import {
  QuestionType,
  CreateQuizRequest,
  UpdateQuizRequest,
  GradingResult,
} from "../types/quiz.types";

// Deep equality comparison for objects
const deepEqual = (a: any, b: any): boolean => {
  if (a === b) return true;

  if (a == null || b == null) return a === b;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  if (typeof a === "object" && typeof b === "object") {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
      if (!keysB.includes(key)) return false;
      if (!deepEqual(a[key], b[key])) return false;
    }
    return true;
  }

  return false;
};

// @desc    Get all quizzes for a course (or all quizzes if no course specified)
// @route   GET /api/courses/:courseId/quizzes
// @route   GET /api/quizzes (admin/instructor only)
// @access  Private (instructor, admin, enrolled students)
export const getQuizzes = async (req: Request, res: Response) => {
  try {
    const { courseId } = req.params;
    const whereClause: any = {};

    // Only filter by course_id if courseId is provided
    if (courseId) {
      whereClause.course_id = courseId;
    }

    // If user is not admin or course instructor, only show published quizzes
    // Note: We need to fetch the course to check instructor_id, but for now we'll skip this check
    // TODO: Add proper course instructor middleware for quiz routes

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
          attributes: ["id", "question_type", "points", "order"],
          required: false,
        },
      ],
      order: [["created_at", "DESC"]],
    });

    // Add computed fields
    const quizzesWithStats = quizzes.map((quiz) => ({
      ...quiz.toJSON(),
      totalQuestions: quiz.questions?.length || 0,
      totalPoints: quiz.questions?.reduce((sum, q) => sum + q.points, 0) || 0,
      isAvailable: quiz.is_available,
      isPublic: quiz.is_public,
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

// @desc    Get single quiz
// @route   GET /api/quizzes/:id
// @access  Private (instructor, admin, enrolled students)
export const getQuiz = async (req: Request, res: Response) => {
  try {
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
          ],
          order: [["order", "ASC"]],
        },
      ],
    });

    if (!quiz) {
      return res
        .status(404)
        .json({ success: false, message: "Quiz not found" });
    }

    // Check if user can access this quiz
    if (req.user.role !== "admin" && req.user.id !== quiz.created_by) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to access this quiz",
      });
    }

    // If quiz is not published and user is not instructor/admin, deny access
    // Exception: public quizzes can be accessed by anyone
    if (
      quiz.status !== "published" &&
      !quiz.is_public &&
      req.user.role !== "admin" &&
      req.user.id !== quiz.created_by
    ) {
      return res.status(403).json({
        success: false,
        message: "Quiz is not available",
      });
    }

    // For students, check if they have already completed this quiz
    if (req.user.role === "student") {
      const completedSubmission = await QuizSubmission.findOne({
        where: {
          quiz_id: req.params.id,
          student_id: req.user.id,
          status: "completed",
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
                as: "question",
                attributes: [
                  "id",
                  "question_text",
                  "question_type",
                  "explanation",
                  "correct_answer",
                ],
              },
            ],
          },
        ],
        order: [["completed_at", "DESC"]],
      });

      if (completedSubmission) {
        // Student has already completed this quiz, return results instead
        const attempts = completedSubmission.attempts || [];

        // Check if results should be shown immediately
        if (
          !completedSubmission.quiz?.show_results_immediately &&
          !completedSubmission.quiz?.show_correct_answers
        ) {
          return res.status(200).json({
            success: true,
            data: {
              quiz_completed: true,
              submission_id: completedSubmission.id,
              final_score: completedSubmission.total_score,
              max_score: completedSubmission.max_score,
              percentage: completedSubmission.percentage,
              passed: completedSubmission.passed,
              results_available: false,
              message:
                "You have already completed this quiz. Results will be available after grading.",
              completed_at: completedSubmission.completed_at,
            },
          });
        }

        // Build results array
        const results = attempts.map((attempt) => ({
          question_id: attempt.question_id,
          question_text: attempt.question?.question_text,
          question_type: attempt.question?.question_type,
          user_answer: attempt.submitted_answer,
          correct_answer: attempt.correct_answer,
          is_correct: attempt.is_correct,
          points_earned: attempt.points_earned,
          max_points: attempt.question?.points,
          explanation: attempt.question?.explanation,
          time_taken: attempt.time_taken,
        }));

        return res.status(200).json({
          success: true,
          data: {
            quiz_completed: true,
            submission_id: completedSubmission.id,
            quiz_title: completedSubmission.quiz?.title,
            final_score: completedSubmission.total_score,
            max_score: completedSubmission.max_score,
            percentage: completedSubmission.percentage,
            grade: getGradeFromScore(completedSubmission.percentage),
            passed: completedSubmission.passed,
            grade_status: completedSubmission.grade_status,
            results_available: true,
            results,
            submitted_at: completedSubmission.completed_at,
            feedback: completedSubmission.feedback,
          },
        });
      }
    }

    const quizData = quiz.toJSON();

    // For students, don't include correct answers unless show_correct_answers is true
    // Note: This logic will be handled by the frontend for now

    res.status(200).json({ success: true, data: quizData });
  } catch (error) {
    console.error("Get quiz error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Create quiz
// @route   POST /api/quizzes
// @access  Private/Instructor/Admin
export const createQuiz = async (req: Request, res: Response) => {
  const transaction = await sequelize.transaction();
  try {
    const quizData: CreateQuizRequest = req.body;

    // Validate required fields
    if (!quizData.title || !quizData.description || !quizData.course_id) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Title, description, and course_id are required",
      });
    }

    const quiz = await Quiz.create(
      {
        title: quizData.title,
        description: quizData.description,
        course_id: quizData.course_id,
        created_by: req.user.id,
        status: quizData.status || "draft",
        type: quizData.type,
        instructions: quizData.instructions,
        time_limit: quizData.time_limit,
        max_attempts: quizData.max_attempts,
        passing_score: quizData.passing_score,
        show_results_immediately: quizData.show_results_immediately,
        randomize_questions: quizData.randomize_questions,
        show_correct_answers: quizData.show_correct_answers,
        enable_automatic_grading:
          quizData.enable_automatic_grading !== undefined
            ? quizData.enable_automatic_grading
            : true,
        require_manual_grading: quizData.require_manual_grading || false,
        start_date: quizData.start_date
          ? new Date(quizData.start_date)
          : undefined,
        end_date: quizData.end_date ? new Date(quizData.end_date) : undefined,
        is_public: quizData.is_public || false,
      },
      { transaction }
    );

    await transaction.commit();

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

    res.status(201).json({ success: true, data: createdQuiz });
  } catch (error) {
    await transaction.rollback();
    console.error("Create quiz error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Update quiz
// @route   PUT /api/quizzes/:id
// @access  Private/Instructor/Admin (quiz creator or course instructor)
export const updateQuiz = async (req: Request, res: Response) => {
  const transaction = await sequelize.transaction();
  try {
    const updateData: UpdateQuizRequest = req.body;

    const quiz = await Quiz.findByPk(req.params.id, { transaction });
    if (!quiz) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Quiz not found" });
    }

    // Check if user is quiz creator, course instructor, or admin
    if (quiz.created_by !== req.user.id && req.user.role !== "admin") {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this quiz",
      });
    }

    // Don't allow status change to published if there are no questions
    if (updateData.status === "published") {
      const questionCount = await QuizQuestion.count({
        where: { quiz_id: quiz.id },
        transaction,
      });

      if (questionCount === 0) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "Cannot publish quiz without questions",
        });
      }
    }

    await quiz.update(
      {
        title: updateData.title,
        description: updateData.description,
        status: updateData.status,
        type: updateData.type,
        instructions: updateData.instructions,
        time_limit: updateData.time_limit,
        max_attempts: updateData.max_attempts,
        passing_score: updateData.passing_score,
        show_results_immediately: updateData.show_results_immediately,
        randomize_questions: updateData.randomize_questions,
        show_correct_answers: updateData.show_correct_answers,
        enable_automatic_grading:
          updateData.enable_automatic_grading !== undefined
            ? updateData.enable_automatic_grading
            : quiz.enable_automatic_grading,
        require_manual_grading:
          updateData.require_manual_grading !== undefined
            ? updateData.require_manual_grading
            : quiz.require_manual_grading,
        start_date: updateData.start_date
          ? new Date(updateData.start_date)
          : undefined,
        end_date: updateData.end_date
          ? new Date(updateData.end_date)
          : undefined,
        is_public:
          updateData.is_public !== undefined
            ? updateData.is_public
            : quiz.is_public,
      },
      { transaction }
    );
    await transaction.commit();

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

    res.status(200).json({ success: true, data: updatedQuiz });
  } catch (error) {
    await transaction.rollback();
    console.error("Update quiz error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Delete quiz
// @route   DELETE /api/quizzes/:id
// @access  Private/Instructor/Admin (quiz creator or course instructor)
export const deleteQuiz = async (req: Request, res: Response) => {
  const transaction = await sequelize.transaction();
  try {
    const quiz = await Quiz.findByPk(req.params.id, { transaction });
    if (!quiz) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Quiz not found" });
    }

    // Check if user is quiz creator, course instructor, or admin
    if (quiz.created_by !== req.user.id && req.user.role !== "admin") {
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
        message: "Cannot delete quiz with existing submissions",
      });
    }

    await quiz.destroy({ transaction });
    await transaction.commit();

    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    await transaction.rollback();
    console.error("Delete quiz error:", error);
    res.status(500).json({ success: false, message: "Server error" });
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
    if (quiz.created_by !== req.user.id && req.user.role !== "admin") {
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
          question_text: question?.question_text?.substring(0, 50) + "...",
          total_attempts: parseInt(attemptStat.total_attempts),
          correct_rate:
            attemptStat.total_attempts > 0
              ? (parseInt(attemptStat.correct_attempts) /
                  parseInt(attemptStat.total_attempts)) *
                100
              : 0,
          average_points: parseFloat(attemptStat.average_points) || 0,
        };
      })
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
    if (req.user.role !== "student") {
      return res.status(403).json({
        success: false,
        message: "Only students can access available quizzes",
      });
    }

    const quizzes = await Quiz.findAll({
      where: {
        [Op.or]: [{ status: "published" }, { is_public: true }],
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

    // Filter quizzes based on date availability
    const now = new Date();
    const availableQuizzes = quizzes.filter((quiz) => {
      const startDate = quiz.start_date;
      const endDate = quiz.end_date;

      const isAfterStart = !startDate || new Date(startDate) <= now;
      const isBeforeEnd = !endDate || new Date(endDate) >= now;

      return isAfterStart && isBeforeEnd;
    });

    console.log(
      `Found ${availableQuizzes.length} available quizzes after date filtering`
    );

    // If student, filter out completed quizzes but include in-progress ones with status
    let filteredQuizzes = availableQuizzes;
    let allSubmissions: any[] = [];
    if (req.user.role === "student") {
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
        `Student ${req.user.id} has completed ${completedQuizIds.length} quizzes`
      );

      // Filter out completed quizzes, but keep in-progress ones
      filteredQuizzes = availableQuizzes.filter(
        (quiz) => !completedQuizIds.includes(quiz.id)
      );
      console.log(
        `Found ${filteredQuizzes.length} available quizzes after filtering completed ones`
      );
    }

    const quizzesWithStats = filteredQuizzes.map((quiz) => {
      const inProgressQuizIds =
        req.user.role === "student"
          ? allSubmissions
              .filter((sub: any) => sub.status === "in_progress")
              .map((sub: any) => sub.quiz_id)
          : [];

      return {
        ...quiz.toJSON(),
        totalQuestions: quiz.questions?.length || 0,
        totalPoints: quiz.questions?.reduce((sum, q) => sum + q.points, 0) || 0,
        isAvailable: quiz.is_available,
        isPublic: quiz.is_public,
        studentStatus: inProgressQuizIds.includes(quiz.id)
          ? "in_progress"
          : "not_started",
      };
    });

    console.log(
      `Returning ${quizzesWithStats.length} available quizzes to student`
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
const getGradeFromScore = (percentage: number): string => {
  if (percentage >= 90) return "A";
  if (percentage >= 80) return "B";
  if (percentage >= 70) return "C";
  if (percentage >= 60) return "D";
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
    if (req.user.role === "student") {
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
        `Student ${req.user.id} has completed ${completedQuizIds.length} quizzes`
      );

      filteredQuizzes = availableQuizzes.filter(
        (quiz) => !completedQuizIds.includes(quiz.id)
      );
    }

    // Add computed fields
    const quizzesWithStats = filteredQuizzes.map((quiz) => {
      const inProgressQuizIds =
        req.user.role === "student"
          ? allSubmissions
              .filter((sub: any) => sub.status === "in_progress")
              .map((sub: any) => sub.quiz_id)
          : [];

      return {
        ...quiz.toJSON(),
        totalQuestions: quiz.questions?.length || 0,
        totalPoints: quiz.questions?.reduce((sum, q) => sum + q.points, 0) || 0,
        isAvailable: quiz.is_available,
        isPublic: quiz.is_public,
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

    // Check deadline
    if (quiz.end_date && new Date(quiz.end_date) < new Date()) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Quiz deadline has passed",
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

    if (!existingSubmission) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "No active quiz session found. Please start the quiz first.",
      });
    }

    // Check if the submission has expired
    if (
      existingSubmission.end_time &&
      new Date() > existingSubmission.end_time
    ) {
      // Mark as timed_out and return error
      await existingSubmission.update(
        { status: "timed_out", completed_at: new Date() },
        { transaction }
      );
      await transaction.commit();
      return res.status(400).json({
        success: false,
        message:
          "Your quiz session has expired. Please contact your instructor to restart.",
      });
    }

    // Use existing submission instead of creating new one
    const submission = existingSubmission;

    // Check if automatic grading is enabled for this quiz
    const enableAutoGrading = quiz.enable_automatic_grading !== false; // Default to true
    const requireManualGrading = quiz.require_manual_grading === true;

    // Now calculate scores and create/update attempts
    let calculatedTotalScore = 0;
    let calculatedMaxScore = 0;

    const results = [];

    // Get all attempts for this submission to calculate scores
    const allAttempts = await QuizAttempt.findAll({
      where: { submission_id: submission.id },
      transaction,
    });

    for (const answer of answers) {
      const question = await QuizQuestion.findByPk(answer.question_id, {
        transaction,
      });

      if (!question || question.quiz_id !== parseInt(id)) {
        continue; // Skip invalid questions
      }

      calculatedMaxScore += Number(question.points);
      const questionData = question.question_data as any;

      // Check if question has individual time limit and if it was exceeded
      let questionTimedOut = false;
      if (
        question.time_limit_seconds &&
        answer.time_taken > question.time_limit_seconds
      ) {
        questionTimedOut = true;
      }

      // Scoring logic based on grading settings
      let isCorrect = false;
      let pointsEarned = 0;

      if (questionTimedOut) {
        // If question timed out, no points awarded
        isCorrect = false;
        pointsEarned = 0;
      } else if (!enableAutoGrading || requireManualGrading) {
        // Manual grading required - don't auto-grade
        isCorrect = false; // Will be determined by manual grading
        pointsEarned = 0; // Will be set by instructor
      } else {
        // Compare normalized answers directly for accurate grading
        const normalizedSubmittedAnswer = AdvancedQuizGrader.normalizeAnswer(
          answer.answer,
          question.question_type
        );
        const normalizedCorrectAnswer =
          AdvancedQuizGrader.normalizeCorrectAnswer(question);

        if (normalizedSubmittedAnswer.data && normalizedCorrectAnswer.data) {
          // For exact match questions, compare normalized answers
          if (
            [
              "single_choice",
              "true_false",
              "numerical",
              "short_answer",
              "fill_blank",
              "matching",
              "ordering",
              "dropdown",
            ].includes(question.question_type)
          ) {
            // Parse JSON if stored as strings and compare objects
            let submitted = normalizedSubmittedAnswer.data;
            let correct = normalizedCorrectAnswer.data;

            if (typeof submitted === "string") {
              try {
                submitted = JSON.parse(submitted);
              } catch (e) {
                submitted = {};
              }
            }
            if (typeof correct === "string") {
              try {
                correct = JSON.parse(correct);
              } catch (e) {
                correct = {};
              }
            }

            // Deep equality comparison
            isCorrect = deepEqual(submitted, correct);
            pointsEarned = isCorrect ? parseFloat(String(question.points)) : 0;
          }
          // For multiple_choice and coding, use advanced grading
          else if (question.question_type === "multiple_choice") {
            try {
              const gradingResult = await AdvancedQuizGrader.gradeWithConfig(
                question,
                answer.answer
              );
              isCorrect = gradingResult.is_correct;
              pointsEarned = gradingResult.points_earned;
            } catch (error) {
              console.error(
                `Error grading multiple choice question ${question.id}:`,
                error
              );
              isCorrect = false;
              pointsEarned = 0;
            }
          } else if (question.question_type === "coding") {
            try {
              const gradingResult = await AdvancedQuizGrader.gradeWithConfig(
                question,
                answer.answer
              );
              isCorrect = gradingResult.is_correct;
              pointsEarned = gradingResult.points_earned;
            } catch (error) {
              console.error(
                `Error grading coding question ${question.id}:`,
                error
              );
              isCorrect = false;
              pointsEarned = 0;
            }
          }
        }
      }

      calculatedTotalScore += pointsEarned;

      // Check if attempt already exists for this question in this submission
      const existingAttempt = allAttempts.find(
        (attempt) => attempt.question_id === question.id
      );

      // Normalize submitted and correct answers for better comparison
      const normalizedSubmittedAnswer = AdvancedQuizGrader.normalizeAnswer(
        answer.answer,
        question.question_type
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
            is_correct: isCorrect,
            points_earned: pointsEarned,
            time_taken: answer.time_taken || 0,
            completed_at: new Date(),
            status: questionTimedOut ? "timed_out" : "completed",
          },
          { transaction }
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
            is_correct: isCorrect,
            points_earned: pointsEarned,
            status: questionTimedOut ? "timed_out" : "completed",
            started_at: new Date(),
            time_taken: answer.time_taken || 0,
          },
          { transaction }
        );
      }

      results.push({
        question_id: question.id,
        user_answer: answer.answer,
        correct_answer:
          question.correct_answer || getCorrectAnswerForQuestion(question),
        is_correct: isCorrect,
        points_earned: pointsEarned,
        max_points: Number(question.points),
        explanation: question.explanation || "No explanation provided.",
        timed_out: questionTimedOut,
        time_limit_seconds: question.time_limit_seconds,
      });
    }

    const finalPercentage =
      calculatedMaxScore > 0
        ? (calculatedTotalScore / calculatedMaxScore) * 100
        : 0;
    const finalGrade =
      enableAutoGrading && !requireManualGrading
        ? getGradeFromScore(finalPercentage)
        : "N/A";

    // Update submission with final scores
    await submission.update(
      {
        total_score: calculatedTotalScore,
        max_score: calculatedMaxScore,
        percentage: finalPercentage,
        status: "completed",
        completed_at: new Date(),
        grade_status: requireManualGrading ? "pending" : "auto_graded",
        passed:
          enableAutoGrading && !requireManualGrading
            ? finalPercentage >= (quiz.passing_score || 60)
            : false,
      },
      { transaction }
    );

    await transaction.commit();

    res.status(201).json({
      success: true,
      data: {
        submission_id: submission.id,
        total_score: calculatedTotalScore,
        max_score: calculatedMaxScore,
        percentage: finalPercentage,
        grade: finalGrade,
        passed: finalPercentage >= (quiz.passing_score || 60),
        answers: results,
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

    if (req.user.role !== "student") {
      return res.status(403).json({
        success: false,
        message: "Only students can view quiz results",
      });
    }

    // Find the latest completed submission for this quiz
    const submission = await QuizSubmission.findOne({
      where: {
        quiz_id: id,
        student_id: req.user.id,
        status: "completed",
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
              as: "question",
              attributes: [
                "id",
                "question_text",
                "question_type",
                "question_data",
                "explanation",
                "correct_answer",
                "points",
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

    // Check if results should be shown immediately
    if (
      !submission.quiz?.show_results_immediately &&
      !submission.quiz?.show_correct_answers
    ) {
      return res.status(200).json({
        success: true,
        data: {
          submission_id: submission.id,
          final_score: submission.total_score,
          max_score: submission.max_score,
          percentage: submission.percentage,
          passed: submission.passed,
          results_available: false,
          message: "Results will be available after grading",
        },
      });
    }

    const attempts = submission.attempts || [];

    // Build results array
    const results = attempts.map((attempt) => ({
      question_id: attempt.question_id,
      question_text: attempt.question?.question_text,
      question_type: attempt.question?.question_type,
      user_answer: attempt.submitted_answer,
      correct_answer: attempt.correct_answer,
      is_correct: attempt.is_correct,
      points_earned: attempt.points_earned,
      max_points: attempt.question?.points,
      explanation: attempt.question?.explanation,
      time_taken: attempt.time_taken,
    }));

    // Check if grades should be shown
    const enableAutoGrading =
      submission.quiz?.enable_automatic_grading !== false;
    const requireManualGrading =
      submission.quiz?.require_manual_grading === true;
    const showGrades = enableAutoGrading && !requireManualGrading;

    res.status(200).json({
      success: true,
      data: {
        submission_id: submission.id,
        quiz_title: submission.quiz?.title,
        final_score: submission.total_score,
        max_score: submission.max_score,
        percentage: submission.percentage,
        grade: showGrades ? getGradeFromScore(submission.percentage) : "N/A",
        passed: showGrades ? submission.passed : null,
        grade_status: submission.grade_status,
        results_available: true,
        results,
        submitted_at: submission.completed_at,
        feedback: submission.feedback,
        grading_settings: {
          enable_automatic_grading: enableAutoGrading,
          require_manual_grading: requireManualGrading,
          show_grades: showGrades,
        },
      },
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
    const { quiz_id, status = "in_progress", started_at } = req.body;

    if (req.user.role !== "student") {
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

    // Check if quiz is available
    if (!quiz.is_available) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Quiz is not currently available",
      });
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
      // Check if the existing submission has expired
      if (
        existingSubmission.end_time &&
        new Date() > existingSubmission.end_time
      ) {
        // Mark as timed_out and return error
        await existingSubmission.update(
          { status: "timed_out", completed_at: new Date() },
          { transaction }
        );
        await transaction.commit();
        return res.status(400).json({
          success: false,
          message:
            "Your quiz session has expired. Please contact your instructor to restart.",
        });
      }

      await transaction.rollback();
      return res.status(200).json({
        success: true,
        data: existingSubmission,
        message: "Resuming existing submission",
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

    // Calculate end_time based on quiz duration
    const startTime = started_at ? new Date(started_at) : new Date();
    let endTime: Date | undefined = undefined;
    if (quiz.time_limit && quiz.time_limit > 0) {
      endTime = new Date(startTime.getTime() + quiz.time_limit * 60 * 1000);
    }

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
      { transaction }
    );

    await transaction.commit();

    res.status(201).json({
      success: true,
      data: submission,
    });
  } catch (error) {
    await transaction.rollback();
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

    if (req.user.role !== "student") {
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

    const submissions = await QuizSubmission.findAll({
      where: whereClause,
      include: [
        {
          model: Quiz,
          as: "quiz",
          attributes: ["id", "title", "description", "type"],
        },
      ],
      order: [["started_at", "DESC"]],
    });

    res.status(200).json({
      success: true,
      count: submissions.length,
      data: submissions,
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
    const submission = await QuizSubmission.findByPk(id, { transaction });
    if (!submission) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Quiz submission not found" });
    }

    // Check authorization
    if (
      submission.student_id !== req.user.id &&
      req.user.role !== "instructor" &&
      req.user.role !== "admin"
    ) {
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

    if (
      status &&
      (req.user.role === "instructor" || req.user.role === "admin")
    ) {
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

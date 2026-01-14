import { Request, Response } from "express";
import {
  QuizSubmission,
  QuizAttempt,
  Quiz,
  User,
  QuizQuestion,
  Course,
} from "../models";
import { Op, Transaction } from "sequelize";
import { sequelize } from "../config/database";

// @desc    Get pending submissions for grading
// @route   GET /api/quiz-submissions/pending
// @access  Private/Instructor/Admin
export const getPendingSubmissions = async (req: Request, res: Response) => {
  try {
    const { courseId } = req.query;

    let whereClause: any = {
      grade_status: "pending",
      status: "completed",
    };

    // If courseId is provided, filter by course
    if (courseId) {
      whereClause["$quiz.course_id$"] = courseId;
    }

    const submissions = await QuizSubmission.findAll({
      where: whereClause,
      include: [
        {
          model: Quiz,
          as: "quiz",
          include: [
            {
              model: Course,
              as: "course",
              attributes: ["id", "title", "code"],
            },
          ],
        },
        {
          model: User,
          as: "submissionStudent",
          attributes: [
            "id",
            "first_name",
            "last_name",
            "email",
            "profile_image",
          ],
        },
      ],
      order: [["completed_at", "ASC"]],
    });

    res.status(200).json({
      success: true,
      count: submissions.length,
      data: submissions.map((submission) => ({
        submission_id: submission.id,
        quiz_id: submission.quiz_id,
        quiz_title: submission.quiz?.title,
        course_name: submission.quiz?.course?.title,
        course_code: submission.quiz?.course?.code,
        student_name: submission.student?.full_name,
        student_email: submission.student?.email,
        attempt_number: submission.attempt_number,
        current_score: submission.total_score,
        max_score: submission.max_score,
        percentage: submission.percentage,
        time_taken: submission.time_taken,
        completed_at: submission.completed_at,
      })),
    });
  } catch (error) {
    console.error("Get pending submissions error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Get submission details for grading
// @route   GET /api/quiz-submissions/:submissionId/grade
// @access  Private/Instructor/Admin
export const getSubmissionForGrading = async (req: Request, res: Response) => {
  try {
    const { submissionId } = req.params;

    const submission = await QuizSubmission.findByPk(submissionId, {
      include: [
        {
          model: Quiz,
          as: "quiz",
          include: [
            {
              model: QuizQuestion,
              as: "questions",
              order: [["order", "ASC"]],
            },
            {
              model: Course,
              as: "course",
              attributes: ["id", "title", "code"],
            },
          ],
        },
        {
          model: User,
          as: "submissionStudent",
          attributes: [
            "id",
            "first_name",
            "last_name",
            "email",
            "profile_image",
          ],
        },
        {
          model: QuizAttempt,
          as: "attempts",
          include: [
            {
              model: QuizQuestion,
              as: "attemptQuestion",
              attributes: [
                "id",
                "question_text",
                "question_type",
                "correct_answer",
                "explanation",
              ],
            },
          ],
        },
      ],
    });

    if (!submission) {
      return res
        .status(404)
        .json({ success: false, message: "Submission not found" });
    }

    const quiz = submission.quiz;

    // Check authorization - only quiz creator, course instructor, or admin
    if (
      quiz?.created_by !== req.user.id &&
      quiz?.course?.instructor_id !== req.user.id &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to grade this submission",
      });
    }

    const questions = quiz?.questions || [];
    const attempts = submission.attempts || [];

    // Organize attempts by question
    const attemptsByQuestion: Record<number, any> = {};
    attempts.forEach((attempt) => {
      attemptsByQuestion[attempt.question_id] = attempt;
    });

    res.status(200).json({
      success: true,
      data: {
        submission_id: submission.id,
        quiz_id: submission.quiz_id,
        quiz_title: quiz?.title,
        quiz_type: quiz?.type,
        course_name: quiz?.course?.title,
        student_name: (submission as any).submissionStudent?.full_name,
        student_email: (submission as any).submissionStudent?.email,
        attempt_number: submission.attempt_number,
        started_at: submission.started_at,
        completed_at: submission.completed_at,
        time_taken: submission.time_taken,
        current_score: submission.total_score,
        max_score: submission.max_score,
        percentage: submission.percentage,
        passed: submission.passed,
        questions: questions.map((question) => ({
          question_id: question.id,
          question_text: question.question_text,
          question_type: question.question_type,
          points: question.points,
          order: question.order,
          explanation: question.explanation,
          correct_answer: question.correct_answer,
          student_answer: attemptsByQuestion[question.id]?.submitted_answer,
          is_correct: attemptsByQuestion[question.id]?.is_correct,
          points_earned: attemptsByQuestion[question.id]?.points_earned,
          time_taken: attemptsByQuestion[question.id]?.time_taken,
        })),
      },
    });
  } catch (error) {
    console.error("Get submission for grading error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Grade a submission
// @route   POST /api/quiz-submissions/:submissionId/grade
// @access  Private/Instructor/Admin
export const gradeSubmission = async (req: Request, res: Response) => {
  const transaction = await sequelize.transaction();
  try {
    const { submissionId } = req.params;
    const { grades, feedback } = req.body; // grades: { question_id: points_earned }

    const submission = await QuizSubmission.findByPk(submissionId, {
      include: [
        {
          model: Quiz,
          as: "quiz",
        },
        {
          model: QuizAttempt,
          as: "attempts",
        },
      ],
      transaction,
    });

    if (!submission) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Submission not found" });
    }

    const quiz = submission.quiz;

    // Check authorization
    if (
      quiz?.created_by !== req.user.id &&
      quiz?.course?.instructor_id !== req.user.id &&
      req.user.role !== "admin"
    ) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: "Not authorized to grade this submission",
      });
    }

    // Update individual attempt grades
    let totalEarned = 0;
    for (const attempt of submission.attempts || []) {
      const questionGrade = grades[attempt.question_id];
      if (questionGrade !== undefined) {
        await attempt.update(
          {
            points_earned: questionGrade,
            is_correct: questionGrade > 0,
          },
          { transaction }
        );
        totalEarned += questionGrade;
      } else {
        totalEarned += attempt.points_earned || 0;
      }
    }

    // Calculate final scores
    const maxPossible =
      quiz?.questions?.reduce((sum, q) => sum + q.points, 0) || 0;
    const percentage = maxPossible > 0 ? (totalEarned / maxPossible) * 100 : 0;
    const passed = quiz?.passing_score
      ? percentage >= quiz.passing_score
      : true;

    // Update submission
    await submission.update(
      {
        total_score: totalEarned,
        percentage,
        passed,
        grade_status: "graded",
        graded_at: new Date(),
        graded_by: req.user.id,
        feedback,
      },
      { transaction }
    );

    await transaction.commit();

    res.status(200).json({
      success: true,
      data: {
        submission_id: submission.id,
        final_score: totalEarned,
        max_score: maxPossible,
        percentage,
        passed,
        message: "Submission graded successfully",
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Grade submission error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Get quiz analytics
// @route   GET /api/quizzes/:quizId/analytics
// @access  Private/Instructor/Admin
export const getQuizAnalytics = async (req: Request, res: Response) => {
  try {
    const { quizId } = req.params;

    const quiz = await Quiz.findByPk(quizId);
    if (!quiz) {
      return res
        .status(404)
        .json({ success: false, message: "Quiz not found" });
    }

    // Check authorization
    if (
      quiz.created_by !== req.user.id &&
      quiz.course?.instructor_id !== req.user.id &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view quiz analytics",
      });
    }

    // Get all submissions
    const submissions = await QuizSubmission.findAll({
      where: {
        quiz_id: quizId,
        status: "completed",
      },
      include: [
        {
          model: User,
          as: "submissionStudent",
          attributes: ["id", "first_name", "last_name", "email"],
        },
      ],
    });

    // Get all attempts
    const attempts = await QuizAttempt.findAll({
      where: { quiz_id: quizId },
      include: [
        {
          model: QuizQuestion,
          as: "attemptQuestion",
          attributes: ["id", "question_text", "question_type", "points"],
        },
      ],
    });

    // Calculate analytics
    const totalSubmissions = submissions.length;
    const averageScore =
      totalSubmissions > 0
        ? submissions.reduce((sum, s) => sum + s.percentage, 0) /
          totalSubmissions
        : 0;
    const highestScore =
      totalSubmissions > 0
        ? Math.max(...submissions.map((s) => s.percentage))
        : 0;
    const lowestScore =
      totalSubmissions > 0
        ? Math.min(...submissions.map((s) => s.percentage))
        : 0;
    const passCount = submissions.filter((s) => s.passed).length;
    const passRate =
      totalSubmissions > 0 ? (passCount / totalSubmissions) * 100 : 0;

    // Question difficulty analysis
    const questionStats: Record<number, any> = {};
    attempts.forEach((attempt) => {
      const questionId = attempt.question_id;
      if (!questionStats[questionId]) {
        questionStats[questionId] = {
          question_id: questionId,
          question_text:
            attempt.question?.question_text?.substring(0, 50) + "...",
          total_attempts: 0,
          correct_attempts: 0,
          average_points: 0,
          total_points_earned: 0,
        };
      }
      questionStats[questionId].total_attempts++;
      if (attempt.is_correct) {
        questionStats[questionId].correct_attempts++;
      }
      questionStats[questionId].total_points_earned +=
        attempt.points_earned || 0;
    });

    const questionAnalytics = Object.values(questionStats).map((stat: any) => ({
      ...stat,
      correct_rate:
        stat.total_attempts > 0
          ? (stat.correct_attempts / stat.total_attempts) * 100
          : 0,
      average_points:
        stat.total_attempts > 0
          ? stat.total_points_earned / stat.total_attempts
          : 0,
      difficulty_score:
        stat.total_attempts > 0
          ? (1 - stat.correct_attempts / stat.total_attempts) * 100
          : 0,
    }));

    // Student performance
    const studentStats: Record<number, any> = {};
    submissions.forEach((submission) => {
      const studentId = submission.student_id;
      if (!studentStats[studentId]) {
        studentStats[studentId] = {
          student_id: studentId,
          student_name: (submission as any).submissionStudent?.full_name,
          student_email: (submission as any).submissionStudent?.email,
          attempts: 0,
          total_score: 0,
          best_score: 0,
          total_time: 0,
          last_attempt: null,
        };
      }
      studentStats[studentId].attempts++;
      studentStats[studentId].total_score += submission.percentage;
      studentStats[studentId].best_score = Math.max(
        studentStats[studentId].best_score,
        submission.percentage
      );
      studentStats[studentId].total_time += submission.time_taken;
      if (
        !studentStats[studentId].last_attempt ||
        (submission.completed_at &&
          submission.completed_at > studentStats[studentId].last_attempt)
      ) {
        studentStats[studentId].last_attempt = submission.completed_at;
      }
    });

    const studentAnalytics = Object.values(studentStats).map((stat: any) => ({
      ...stat,
      average_score: stat.attempts > 0 ? stat.total_score / stat.attempts : 0,
    }));

    res.status(200).json({
      success: true,
      data: {
        quiz_id: quiz.id,
        quiz_title: quiz.title,
        total_submissions: totalSubmissions,
        average_score: Math.round(averageScore * 100) / 100,
        highest_score: Math.round(highestScore * 100) / 100,
        lowest_score: Math.round(lowestScore * 100) / 100,
        pass_rate: Math.round(passRate * 100) / 100,
        question_analytics: questionAnalytics,
        student_analytics: studentAnalytics,
        generated_at: new Date(),
      },
    });
  } catch (error) {
    console.error("Get quiz analytics error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Get all submissions for a quiz
// @route   GET /api/quizzes/:quizId/submissions
// @access  Private/Instructor/Admin
export const getQuizSubmissions = async (req: Request, res: Response) => {
  try {
    const { quizId } = req.params;
    const { status, grade_status, student_id } = req.query;

    const quiz = await Quiz.findByPk(quizId);
    if (!quiz) {
      return res
        .status(404)
        .json({ success: false, message: "Quiz not found" });
    }

    // Check authorization
    if (
      quiz.created_by !== req.user.id &&
      quiz.course?.instructor_id !== req.user.id &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view quiz submissions",
      });
    }

    let whereClause: any = { quiz_id: quizId };

    if (status) {
      whereClause.status = status;
    }
    if (grade_status) {
      whereClause.grade_status = grade_status;
    }
    if (student_id) {
      whereClause.student_id = student_id;
    }

    const submissions = await QuizSubmission.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: "submissionStudent",
          attributes: [
            "id",
            "first_name",
            "last_name",
            "email",
            "profile_image",
          ],
        },
        {
          model: User,
          as: "submissionGrader",
          attributes: ["id", "first_name", "last_name"],
          required: false,
        },
      ],
      order: [["completed_at", "DESC"]],
    });

    res.status(200).json({
      success: true,
      count: submissions.length,
      data: submissions.map((submission) => ({
        submission_id: submission.id,
        student_id: submission.student_id,
        student_name: (submission as any).submissionStudent?.full_name,
        student_email: (submission as any).submissionStudent?.email,
        attempt_number: submission.attempt_number,
        status: submission.status,
        grade_status: submission.grade_status,
        total_score: submission.total_score,
        max_score: submission.max_score,
        percentage: submission.percentage,
        passed: submission.passed,
        time_taken: submission.time_taken,
        started_at: submission.started_at,
        completed_at: submission.completed_at,
        graded_at: submission.graded_at,
        graded_by: submission.grader?.full_name,
        feedback: submission.feedback,
      })),
    });
  } catch (error) {
    console.error("Get quiz submissions error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Update submission feedback
// @route   PUT /api/quiz-submissions/:submissionId/feedback
// @access  Private/Instructor/Admin
export const updateSubmissionFeedback = async (req: Request, res: Response) => {
  const transaction = await sequelize.transaction();
  try {
    const { submissionId } = req.params;
    const { feedback } = req.body;

    const submission = await QuizSubmission.findByPk(submissionId, {
      include: [
        {
          model: Quiz,
          as: "quiz",
        },
      ],
      transaction,
    });

    if (!submission) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Submission not found" });
    }

    const quiz = submission.quiz;

    // Check authorization
    if (
      quiz?.created_by !== req.user.id &&
      quiz?.course?.instructor_id !== req.user.id &&
      req.user.role !== "admin"
    ) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: "Not authorized to update feedback for this submission",
      });
    }

    await submission.update({ feedback }, { transaction });
    await transaction.commit();

    res.status(200).json({
      success: true,
      data: {
        submission_id: submission.id,
        feedback: submission.feedback,
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Update submission feedback error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

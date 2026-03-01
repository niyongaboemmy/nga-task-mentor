import { Request, Response } from "express";
import {
  Quiz,
  QuizQuestion,
  QuizSubmission,
  QuizAttempt,
  User,
  QuestionBank,
} from "../models";
import { Op, Transaction } from "sequelize";
import { sequelize } from "../config/database";
import { AnswerDataType, GradingResult } from "../types/quiz.types";
import { AdvancedQuizGrader } from "../utils/quizGrader";

const computeAttemptGrading = async (params: {
  submission: any;
  quiz: any;
  question: any;
  answerData: any;
  timeTakenSeconds?: number;
}): Promise<{
  gradingResult: GradingResult;
  status: "completed" | "timed_out";
}> => {
  const { quiz, question, answerData, timeTakenSeconds } = params;

  const enableAutoGrading = quiz?.enable_automatic_grading !== false;
  const requireManualGrading = quiz?.require_manual_grading === true;

  const questionTimedOut =
    !!question?.time_limit_seconds &&
    typeof timeTakenSeconds === "number" &&
    timeTakenSeconds > Number(question.time_limit_seconds);

  if (questionTimedOut) {
    return {
      gradingResult: {
        is_correct: false,
        points_earned: 0,
        feedback: "Question timed out",
      },
      status: "timed_out",
    };
  }

  if (!enableAutoGrading || requireManualGrading) {
    return {
      gradingResult: {
        is_correct: false,
        points_earned: 0,
        feedback: "Pending manual grading",
      },
      status: "completed",
    };
  }

  const gradingResult = await AdvancedQuizGrader.gradeWithConfig(
    question,
    answerData,
  );

  return { gradingResult, status: "completed" };
};

// @desc    Start a quiz attempt
// @route   POST /api/quizzes/:quizId/start
// @access  Private/Student
export const startQuizAttempt = async (req: Request, res: Response) => {
  const transaction = await sequelize.transaction();
  try {
    const { quizId } = req.params;

    if (req.user.role !== "student") {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: "Only students can start quiz attempts",
      });
    }

    // Find the quiz
    const quiz = await Quiz.findByPk(quizId, { transaction });
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

    // Check if student is enrolled in the course
    const enrollment = await sequelize.models.UserCourse.findOne({
      where: {
        user_id: req.user.id,
        course_id: quiz.course_id,
        status: "enrolled",
      },
      transaction,
    });

    if (!enrollment) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: "Not enrolled in this course",
      });
    }

    // Check if student has exceeded max attempts
    if (quiz.max_attempts) {
      const attemptCount = await QuizSubmission.count({
        where: {
          quiz_id: quizId,
          student_id: req.user.id,
        },
        transaction,
      });

      if (attemptCount >= quiz.max_attempts) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Maximum attempts (${quiz.max_attempts}) exceeded`,
        });
      }
    }

    // Calculate attempt number first
    const previousSubmissions = await QuizSubmission.count({
      where: {
        quiz_id: quizId,
        student_id: req.user.id,
        status: { [Op.in]: ["completed", "timed_out", "abandoned"] },
      },
      transaction,
    });

    const attemptNumber = previousSubmissions + 1;

    // Calculate end time based on quiz time limit
    const startTime = new Date();
    const endTime = quiz.time_limit
      ? new Date(startTime.getTime() + quiz.time_limit * 60 * 1000)
      : undefined;

    // Create quiz submission
    const submission = await QuizSubmission.create(
      {
        quiz_id: parseInt(quizId),
        student_id: req.user.id,
        total_score: 0,
        max_score: 0,
        percentage: 0,
        status: "in_progress",
        grade_status: "pending",
        time_taken: 0,
        started_at: startTime,
        end_time: endTime,
        passed: false,
        attempt_number: attemptNumber,
      },
      { transaction },
    );

    await transaction.commit();

    res.status(201).json({
      success: true,
      data: {
        submission_id: submission.id,
        attempt_number: submission.attempt_number,
        quiz_info: {
          id: quiz.id,
          title: quiz.title,
          time_limit: quiz.time_limit,
          instructions: quiz.instructions,
          show_results_immediately: quiz.show_results_immediately,
        },
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Start quiz attempt error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Submit answer to a question
// @route   POST /api/attempts/:submissionId/questions/:questionId/answer
// @access  Private/Student
export const submitQuestionAnswer = async (req: Request, res: Response) => {
  const transaction = await sequelize.transaction();
  try {
    const { submissionId, questionId } = req.params;
    const { answer_data, time_taken } = req.body;

    if (req.user.role !== "student") {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: "Only students can submit answers",
      });
    }

    // Find the submission
    const submission = await QuizSubmission.findByPk(submissionId, {
      transaction,
    });
    if (!submission) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Quiz submission not found" });
    }

    // Verify ownership
    if (submission.student_id !== req.user.id) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: "Not authorized to submit answer for this submission",
      });
    }

    // Check if submission is still in progress
    if (submission.status !== "in_progress") {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Quiz submission is no longer in progress",
      });
    }

    // Find the question
    const question = await QuizQuestion.findByPk(questionId, {
      include: [{ model: QuestionBank, as: "questionBank" }],
      transaction,
    });
    if (!question) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Question not found" });
    }

    // Verify question belongs to the quiz
    if (question.quiz_id !== submission.quiz_id) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Question does not belong to this quiz",
      });
    }

    const quiz = await Quiz.findByPk(submission.quiz_id, { transaction });
    if (!quiz) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Quiz not found" });
    }

    // Check if student already answered this question in this submission
    let attempt = await QuizAttempt.findOne({
      where: {
        submission_id: submissionId,
        question_id: questionId,
      },
      transaction,
    });

    // Normalize answers for consistent grading
    const normalizedSubmittedAnswer = AdvancedQuizGrader.normalizeAnswer(
      answer_data,
      question.questionBank?.question_type,
    );
    const normalizedCorrectAnswer =
      AdvancedQuizGrader.normalizeCorrectAnswer(question);

    let gradingResult: GradingResult;
    let attemptStatus: "completed" | "timed_out" = "completed";
    try {
      const computed = await computeAttemptGrading({
        submission,
        quiz,
        question,
        answerData: normalizedSubmittedAnswer.data,
        timeTakenSeconds:
          typeof time_taken === "number" ? time_taken : undefined,
      });
      gradingResult = computed.gradingResult;
      attemptStatus = computed.status;
    } catch (error) {
      console.error("Grading error:", error);
      gradingResult = {
        is_correct: false,
        points_earned: 0,
        feedback: "Grading error occurred",
      };
    }

    const isCorrect = gradingResult.is_correct;
    const pointsEarned = gradingResult.points_earned;

    if (attempt) {
      // Update existing attempt record
      await attempt.update(
        {
          submitted_answer: normalizedSubmittedAnswer.data,
          correct_answer: normalizedCorrectAnswer.data,
          is_correct: isCorrect,
          points_earned: pointsEarned,
          time_taken:
            typeof time_taken === "number" ? time_taken : attempt.time_taken,
          completed_at: new Date(),
          status: attemptStatus,
        },
        { transaction },
      );
    } else {
      // Create new attempt record
      attempt = await QuizAttempt.create(
        {
          quiz_id: submission.quiz_id,
          question_id: parseInt(questionId),
          student_id: req.user.id,
          submission_id: parseInt(submissionId),
          submitted_answer: normalizedSubmittedAnswer.data,
          correct_answer: normalizedCorrectAnswer.data,
          is_correct: isCorrect,
          points_earned: pointsEarned,
          time_taken: typeof time_taken === "number" ? time_taken : 0,
          status: attemptStatus,
          started_at: new Date(),
          completed_at: new Date(),
        },
        { transaction },
      );
    }

    await transaction.commit();

    res.status(201).json({
      success: true,
      data: {
        attempt_id: attempt.id,
        grading_result: {
          is_correct: isCorrect,
          points_earned: pointsEarned,
          feedback:
            gradingResult.feedback || (isCorrect ? "Correct!" : "Incorrect"),
        },
        question_completed: true,
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Submit question answer error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Submit all answers at once
// @route   POST /api/attempts/:submissionId/submit-all
// @access  Private/Student
export const submitAllAnswers = async (req: Request, res: Response) => {
  const transaction = await sequelize.transaction();
  try {
    const { submissionId } = req.params;
    const { answers } = req.body; // Array of { question_id, answer_data }

    if (req.user.role !== "student") {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: "Only students can submit answers",
      });
    }

    // Find the submission
    const submission = await QuizSubmission.findByPk(submissionId, {
      transaction,
    });
    if (!submission) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Quiz submission not found" });
    }

    // Verify ownership
    if (submission.student_id !== req.user.id) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: "Not authorized to submit answers for this submission",
      });
    }

    // Check if submission is still in progress
    if (submission.status !== "in_progress") {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Quiz submission is no longer in progress",
      });
    }

    const quiz = await Quiz.findByPk(submission.quiz_id, { transaction });
    if (!quiz) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Quiz not found" });
    }

    // Process each answer sequentially within the transaction
    for (const answer of answers) {
      const { question_id, answer_data, time_taken } = answer;

      // Find the question
      const question = await QuizQuestion.findByPk(question_id, {
        include: [{ model: QuestionBank, as: "questionBank" }],
        transaction,
      });
      if (!question) {
        throw new Error(`Question ${question_id} not found`);
      }

      // Verify question belongs to the quiz
      if (question.quiz_id !== submission.quiz_id) {
        throw new Error(`Question ${question_id} does not belong to this quiz`);
      }

      // Check if student already answered this question in this submission
      const existingAttempt = await QuizAttempt.findOne({
        where: {
          submission_id: submissionId,
          question_id: question_id,
        },
        transaction,
      });

      if (existingAttempt) {
        // Skip if already answered
        continue;
      }

      // Normalize answers for consistent grading
      const normalizedSubmittedAnswer = AdvancedQuizGrader.normalizeAnswer(
        answer_data,
        question.questionBank?.question_type,
      );
      const normalizedCorrectAnswer =
        AdvancedQuizGrader.normalizeCorrectAnswer(question);

      let gradingResult: GradingResult;
      let attemptStatus: "completed" | "timed_out" = "completed";
      try {
        const computed = await computeAttemptGrading({
          submission,
          quiz,
          question,
          answerData: normalizedSubmittedAnswer.data,
          timeTakenSeconds:
            typeof time_taken === "number" ? time_taken : undefined,
        });
        gradingResult = computed.gradingResult;
        attemptStatus = computed.status;
      } catch (error) {
        console.error("Grading error:", error);
        gradingResult = {
          is_correct: false,
          points_earned: 0,
          feedback: "Grading error occurred",
        };
      }

      const isCorrect = gradingResult.is_correct;
      const pointsEarned = gradingResult.points_earned;

      // Create attempt record
      const attempt = await QuizAttempt.create(
        {
          quiz_id: submission.quiz_id,
          question_id: question_id,
          student_id: req.user.id,
          submission_id: parseInt(submissionId),
          submitted_answer: normalizedSubmittedAnswer.data,
          correct_answer: normalizedCorrectAnswer.data,
          is_correct: isCorrect,
          points_earned: pointsEarned,
          time_taken: typeof time_taken === "number" ? time_taken : 0,
          status: attemptStatus,
          started_at: new Date(),
          completed_at: new Date(),
        },
        { transaction },
      );
    }

    await transaction.commit();

    res.status(200).json({
      success: true,
      message: "All answers submitted successfully",
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Submit all answers error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Get quiz attempt status
// @route   GET /api/attempts/:submissionId
// @access  Private/Student
export const getQuizAttemptStatus = async (req: Request, res: Response) => {
  try {
    const { submissionId } = req.params;

    if (req.user.role !== "student") {
      return res.status(403).json({
        success: false,
        message: "Only students can view their attempts",
      });
    }

    // Find the submission
    const submission = await QuizSubmission.findByPk(submissionId, {
      include: [
        {
          model: Quiz,
          as: "submissionQuiz",
          include: [
            {
              model: QuizQuestion,
              as: "quizQuestions",
              attributes: ["id", "points", "order"],
              include: [
                {
                  model: QuestionBank,
                  as: "questionBank",
                  attributes: ["question_type"],
                },
              ],
            },
          ],
        },
        {
          model: QuizAttempt,
          as: "attempts",
          include: [
            {
              model: QuizQuestion,
              as: "attemptQuestion",
              attributes: ["id"],
              include: [
                {
                  model: QuestionBank,
                  as: "questionBank",
                  attributes: ["question_text", "question_type"],
                },
              ],
            },
          ],
        },
      ],
    });

    if (!submission) {
      return res
        .status(404)
        .json({ success: false, message: "Quiz submission not found" });
    }

    // Verify ownership
    if (submission.student_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this submission",
      });
    }

    const quiz = submission.quiz;
    const questions = quiz?.questions || [];

    // Calculate progress
    const answeredQuestionIds =
      submission.attempts?.map((a) => a.question_id) || [];
    const progress =
      questions.length > 0
        ? (answeredQuestionIds.length / questions.length) * 100
        : 0;

    // Calculate current score
    const totalEarned =
      submission.attempts?.reduce(
        (sum, attempt) =>
          sum + (parseFloat(String(attempt.points_earned)) || 0),
        0,
      ) || 0;
    const maxPossible = questions.reduce((sum, q) => sum + q.points, 0);

    // Calculate remaining time using end_time if available
    let timeRemaining = null;
    let timeElapsed = Math.floor(
      (Date.now() - submission.started_at.getTime()) / 1000,
    );
    let isTimeExpired = false;

    if (submission.end_time) {
      // Use stored end_time for more accurate calculation
      const now = new Date();
      const remainingMs = submission.end_time.getTime() - now.getTime();
      timeRemaining = Math.max(0, Math.floor(remainingMs / 1000));
      isTimeExpired = remainingMs <= 0;
    } else if (quiz?.time_limit) {
      // Fallback to elapsed time calculation
      const timeLimitSeconds = quiz.time_limit * 60;
      timeRemaining = Math.max(0, timeLimitSeconds - timeElapsed);
      isTimeExpired = timeRemaining <= 0;
    }

    res.status(200).json({
      success: true,
      data: {
        submission_id: submission.id,
        quiz_title: quiz?.title,
        status: submission.status,
        progress,
        current_score: totalEarned,
        max_score: maxPossible,
        attempts: submission.attempts?.map((attempt: any) => ({
          question_id: attempt.question_id,
          question_text: attempt.attemptQuestion?.questionBank?.question_text,
          is_correct: attempt.is_correct,
          points_earned: attempt.points_earned,
          time_taken: attempt.time_taken,
        })),
        time_elapsed: timeElapsed,
        time_remaining: timeRemaining,
        time_limit: quiz?.time_limit,
        is_time_expired: isTimeExpired,
      },
    });
  } catch (error) {
    console.error("Get quiz attempt status error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Submit complete quiz
// @route   POST /api/attempts/:submissionId/submit
// @access  Private/Student
export const submitQuiz = async (req: Request, res: Response) => {
  const transaction = await sequelize.transaction();
  try {
    const { submissionId } = req.params;

    if (req.user.role !== "student") {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: "Only students can submit quizzes",
      });
    }

    // Find the submission
    const submission = await QuizSubmission.findByPk(submissionId, {
      include: [
        {
          model: Quiz,
          as: "submissionQuiz",
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
        .json({ success: false, message: "Quiz submission not found" });
    }

    // Verify ownership
    if (submission.student_id !== req.user.id) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: "Not authorized to submit this quiz",
      });
    }

    // Check if submission is still in progress
    if (submission.status !== "in_progress") {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Quiz submission is no longer in progress",
      });
    }

    const quiz = submission.quiz;
    const attempts = submission.attempts || [];

    // Calculate final scores
    const totalEarned = attempts.reduce(
      (sum, attempt) => sum + (parseFloat(String(attempt.points_earned)) || 0),
      0,
    );
    const maxPossible =
      quiz?.questions?.reduce((sum, q) => sum + q.points, 0) || 0;
    const percentage = maxPossible > 0 ? (totalEarned / maxPossible) * 100 : 0;

    // Check if quiz is passed
    const passed = quiz?.passing_score
      ? percentage >= quiz.passing_score
      : true;

    // Calculate duration in seconds
    const timeTaken = Math.floor(
      (new Date().getTime() - submission.started_at.getTime()) / 1000,
    );

    // Update submission
    await submission.update(
      {
        total_score: totalEarned,
        max_score: maxPossible,
        percentage,
        status: "completed",
        completed_at: new Date(),
        time_taken: timeTaken,
        passed,
        grade_status: quiz?.type === "graded" ? "pending" : "auto_graded",
      },
      { transaction },
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
        show_results_immediately: quiz?.show_results_immediately,
        show_correct_answers: quiz?.show_correct_answers,
        message: "Quiz submitted successfully",
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Submit quiz error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Get quiz results
// @route   GET /api/attempts/:submissionId/results
// @access  Private/Student
export const getQuizResults = async (req: Request, res: Response) => {
  try {
    const { submissionId } = req.params;

    if (req.user.role !== "student") {
      return res.status(403).json({
        success: false,
        message: "Only students can view quiz results",
      });
    }

    // Find the submission
    const submission = await QuizSubmission.findByPk(submissionId, {
      include: [
        {
          model: Quiz,
          as: "submissionQuiz",
        },
        {
          model: QuizAttempt,
          as: "attempts",
          include: [
            {
              model: QuizQuestion,
              as: "attemptQuestion",
              attributes: ["id", "points", "order"],
              include: [
                {
                  model: QuestionBank,
                  as: "questionBank",
                  attributes: [
                    "question_text",
                    "question_type",
                    "explanation",
                    "correct_answer",
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    if (!submission) {
      return res
        .status(404)
        .json({ success: false, message: "Quiz submission not found" });
    }

    // Verify ownership
    if (submission.student_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this submission",
      });
    }

    // Check if submission is completed
    if (submission.status !== "completed") {
      return res.status(400).json({
        success: false,
        message: "Quiz is not yet completed",
      });
    }

    const quiz = submission.quiz;

    // Check if results should be shown immediately
    if (!quiz?.show_results_immediately && !quiz?.show_correct_answers) {
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

    res.status(200).json({
      success: true,
      data: {
        submission_id: submission.id,
        quiz_title: quiz?.title,
        final_score: submission.total_score,
        max_score: submission.max_score,
        percentage: submission.percentage,
        passed: submission.passed,
        grade_status: submission.grade_status,
        time_taken: submission.time_taken,
        started_at: submission.started_at,
        completed_at: submission.completed_at,
        attempts: attempts.map((attempt: any) => ({
          question_id: attempt.question_id,
          question_text: attempt.attemptQuestion?.questionBank?.question_text,
          question_type: attempt.attemptQuestion?.questionBank?.question_type,
          question_data: attempt.attemptQuestion?.questionBank?.question_data,
          is_correct: attempt.is_correct,
          points_earned: attempt.points_earned,
          max_points: attempt.attemptQuestion?.points,
          time_taken: attempt.time_taken,
          correct_answer: attempt.correct_answer,
          explanation: attempt.attemptQuestion?.questionBank?.explanation,
          attemptQuestion: attempt.attemptQuestion,
        })),
        submitted_at: submission.completed_at,
      },
    });
  } catch (error) {
    console.error("Get quiz results error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Get student's quiz history
// @route   GET /api/quizzes/my-results
// @access  Private/Student
export const getStudentQuizHistory = async (req: Request, res: Response) => {
  try {
    // For /my-results endpoint, use the authenticated user's ID
    const studentId = req.user.id;

    // Check authorization - only students can access their own results
    if (req.user.role !== "student") {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this student's quiz history",
      });
    }

    const submissions = await QuizSubmission.findAll({
      where: { student_id: studentId, status: "completed" },
      include: [
        {
          model: Quiz,
          as: "quiz",
          attributes: ["id", "title", "description", "course_id", "createdAt"],
        },
      ],
      order: [["completed_at", "DESC"]],
    });

    res.status(200).json({
      success: true,
      count: submissions.length,
      data: submissions.map((submission) => ({
        id: submission.id,
        quiz_id: submission.quiz_id,
        quiz_title: submission.quiz?.title || "Unknown Quiz",
        quiz_description: submission.quiz?.description,
        course_id: submission.quiz?.course_id,
        course_name: null, // Course info available via MIS API if needed
        instructor_name: null, // Instructor info available via MIS API if needed
        final_score: submission.total_score,
        max_score: submission.max_score,
        percentage: submission.percentage,
        grade: getGradeFromPercentage(submission.percentage),
        status: submission.status,
        submitted_at: submission.completed_at,
        time_taken: (submission.time_taken || 0) * 1000,
        question_count: submission.quiz?.questions?.length || 0,
        difficulty: null, // Not available in current model
        tags: null, // Not available in current model
        created_at: submission.quiz?.createdAt,
      })),
    });
  } catch (error) {
    console.error("Get student quiz history error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Helper function to calculate grade from percentage
function getGradeFromPercentage(percentage: number): string {
  if (percentage >= 90) return "A";
  if (percentage >= 80) return "B";
  if (percentage >= 70) return "C";
  if (percentage >= 50) return "D";
  return "F";
}

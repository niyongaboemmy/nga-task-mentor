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
import {
  AdvancedQuizGrader,
  UNGRADED_SAVE,
  isUngradedSave,
} from "../utils/quizGrader";
import { resolveAcademicTermId } from "../utils/misUtils";
import {
  buildStudentResults,
  needsManualReview,
  resultVisibility,
  studentGradingDetails,
} from "../utils/quizStudentView";
import {
  computeAttemptEndTime,
  hasOverallDuration,
  isPastDeadline,
  secondsRemaining,
} from "../utils/quizTiming";

/** What the grader reported, stored in quiz_attempts.grading_details. */
const gradingDetailsOf = (result: GradingResult): object | null =>
  (result as any)?.detailed_feedback ?? null;

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

  // With an overall quiz duration the student may revisit questions, so
  // per-question durations don't apply — only the attempt deadline does.
  const questionTimedOut =
    !hasOverallDuration(quiz) &&
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

  // The automatic grade is always computed and stored; the result settings
  // decide when the student sees it (utils/quizStudentView).
  void enableAutoGrading;
  void requireManualGrading;

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

    if (!req.user.permissions?.has("QUIZZES_ATTEMPT")) {
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
    const endTime = computeAttemptEndTime(quiz, startTime);

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

    if (!req.user.permissions?.has("QUIZZES_ATTEMPT")) {
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

    // The attempt's time is up: answers can no longer be changed. What was
    // saved before the deadline is kept and graded on final submission.
    if (isPastDeadline(submission)) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        code: "ATTEMPT_TIME_EXPIRED",
        message: "Time is up for this quiz — answers can no longer be changed.",
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

    // Background save of a code answer (TM-FIX-8): store it, don't run the
    // judge. It is graded on submit. An unchanged answer that is already
    // graded is left alone.
    const questionType = question.questionBank?.question_type;
    const isCodeType = questionType === "coding" || questionType === "algorithmic";
    if (req.body.save_only === true && isCodeType) {
      const unchanged =
        !!attempt &&
        !isUngradedSave(attempt.grading_details) &&
        JSON.stringify(attempt.submitted_answer) ===
          JSON.stringify(normalizedSubmittedAnswer.data);
      if (!unchanged) {
        const values = {
          submitted_answer: normalizedSubmittedAnswer.data,
          correct_answer: normalizedCorrectAnswer.data,
          grading_details: { ...UNGRADED_SAVE },
          is_correct: null as any,
          points_earned: 0,
          time_taken:
            typeof time_taken === "number" ? time_taken : (attempt?.time_taken ?? 0),
          completed_at: new Date(),
          status: "completed" as const,
        };
        if (attempt) {
          await attempt.update(values, { transaction });
        } else {
          attempt = await QuizAttempt.create(
            {
              ...values,
              quiz_id: submission.quiz_id,
              question_id: parseInt(questionId),
              student_id: req.user.id,
              submission_id: parseInt(submissionId),
              started_at: new Date(),
            },
            { transaction },
          );
        }
      }
      await transaction.commit();
      return res.status(201).json({
        success: true,
        data: {
          attempt_id: attempt?.id ?? null,
          saved: true,
          graded: false,
          grading_result: { is_correct: null, points_earned: null, feedback: "Answer saved" },
          grading_details: null,
          question_completed: true,
        },
      });
    }

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
          grading_details: gradingDetailsOf(gradingResult),
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
          grading_details: gradingDetailsOf(gradingResult),
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

    // While the attempt is running the student only learns that the answer
    // was saved — never whether it is right (they could otherwise probe
    // options and change answers). Coding questions keep their visible
    // test-run output, which is part of the question itself; their score and
    // hidden-test results show only when the quiz releases grades
    // immediately (resultVisibility).
    const isCodeRun = isCodeType;
    const revealScore =
      isCodeRun &&
      quiz.show_results_immediately !== false &&
      !needsManualReview(quiz);

    res.status(201).json({
      success: true,
      data: {
        attempt_id: attempt.id,
        saved: true,
        grading_result: {
          is_correct: revealScore ? isCorrect : null,
          points_earned: revealScore ? pointsEarned : null,
          feedback: isCodeRun
            ? gradingResult.feedback || "Answer saved"
            : "Answer saved",
        },
        // Per-test results without anything a hidden test would give away.
        grading_details: isCodeRun
          ? studentGradingDetails(gradingDetailsOf(gradingResult), {
              includeHidden: revealScore,
            })
          : null,
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

    if (!req.user.permissions?.has("QUIZZES_ATTEMPT")) {
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
          grading_details: gradingDetailsOf(gradingResult),
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

// @route   GET /api/attempts/:submissionId
// @access  Private/Student
export const getQuizAttemptStatus = async (req: Request, res: Response) => {
  try {
    const { submissionId } = req.params;

    if (!req.user.permissions?.has("QUIZZES_ATTEMPT")) {
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

    // Nothing about correctness while the attempt is still running; after
    // that, the quiz's result settings decide.
    const finished = submission.status !== "in_progress";
    const visibility = resultVisibility(quiz, submission);
    const showGrades = finished && visibility.show_score;
    const showCorrectAnswers = finished && visibility.show_correct_answers;
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
      timeRemaining = secondsRemaining(submission);
      isTimeExpired = timeRemaining === 0;
    } else if (quiz?.time_limit) {
      // Fallback to elapsed time calculation
      const timeLimitSeconds = quiz.time_limit * 60;
      timeRemaining = Math.max(0, timeLimitSeconds - timeElapsed);
      isTimeExpired = timeRemaining <= 0;
    }

    // Format the results
    const results = submission.attempts.map((attempt) => ({
      question_id: attempt.question_id,
      question_text: attempt.attemptQuestion?.questionBank?.question_text,
      question_type: attempt.attemptQuestion?.questionBank?.question_type,
      question_data: showCorrectAnswers
        ? attempt.attemptQuestion?.questionBank?.question_data
        : null,
      is_correct: showGrades ? attempt.is_correct : null,
      points_earned: showGrades ? attempt.points_earned : null,
      max_points: attempt.attemptQuestion?.points,
      time_taken: attempt.time_taken,
      correct_answer: showCorrectAnswers ? attempt.correct_answer : null,
      explanation: showCorrectAnswers
        ? attempt.attemptQuestion?.questionBank?.explanation
        : null,
      attemptQuestion: attempt.attemptQuestion,
    }));

    res.status(200).json({
      success: true,
      data: {
        submission_id: submission.id,
        quiz_title: quiz?.title,
        status: submission.status,
        progress,
        current_score: showGrades ? totalEarned : null,
        max_score: maxPossible,
        attempts: results,
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

// @desc    Get student's quiz history
// @route   GET /api/quizzes/my-results
// @access  Private/Student
export const getStudentQuizHistory = async (req: Request, res: Response) => {
  try {
    // For /my-results endpoint, use the authenticated user's ID
    const studentId = req.user.id;

    // Check authorization - only students can access their own results
    if (!req.user.permissions?.has("QUIZZES_VIEW_RESULTS_OWN")) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this student's quiz history",
      });
    }

    const academicTermId = await resolveAcademicTermId(req);

    const submissions = await QuizSubmission.findAll({
      where: { student_id: studentId, status: "completed" },
      include: [
        {
          model: Quiz,
          as: "quiz",
          attributes: ["id", "title", "description", "course_id", "createdAt"],
          // Scope "my results" to the resolved term; keep legacy quizzes
          // (null academic_term_id) so pre-existing history isn't hidden.
          where: academicTermId
            ? {
                [Op.or]: [
                  { academic_term_id: academicTermId },
                  { academic_term_id: null },
                ],
              }
            : undefined,
          required: !!academicTermId,
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

// @desc    Get quiz results for a specific submission
// @route   GET /api/quizzes/attempts/:submissionId/results
// @access  Private/Student
export const getSubmissionResults = async (req: Request, res: Response) => {
  try {
    const { submissionId } = req.params;

    const submission = await QuizSubmission.findOne({
      where: { id: submissionId, student_id: req.user.id },
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
    });

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Submission not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: buildStudentResults(submission, submission.quiz),
    });
  } catch (error) {
    console.error("Get submission results error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

import { Request, Response } from "express";
import { QuizQuestion, Quiz, QuizAttempt } from "../models";
import { Transaction, Op } from "sequelize";
import { sequelize } from "../config/database";
import { QuestionValidator } from "../utils/questionValidation";
import { QuestionType, CreateQuestionRequest } from "../types/quiz.types";

// @desc    Get questions for a quiz
// @route   GET /api/quizzes/:quizId/questions
// @access  Private (instructor, admin, enrolled students)
export const getQuizQuestions = async (req: Request, res: Response) => {
  try {
    const { quizId } = req.params;

    const quiz = await Quiz.findByPk(quizId);
    if (!quiz) {
      return res
        .status(404)
        .json({ success: false, message: "Quiz not found" });
    }

    // Check if user can access this quiz
    if (req.user.role !== "admin" && req.user.id !== quiz.created_by) {
      // Check if student is enrolled in the course
      const enrollment = await sequelize.models.UserCourse.findOne({
        where: {
          user_id: req.user.id,
          course_id: quiz.course_id,
        },
      });

      if (!enrollment) {
        return res.status(403).json({
          success: false,
          message: "Not authorized to access this quiz",
        });
      }
    }

    const questions = await QuizQuestion.findAll({
      where: { quiz_id: quizId },
      order: [["order", "ASC"]],
    });

    // For students, don't include correct answers unless show_correct_answers is true
    let questionsData = questions.map((q) => q.toJSON());

    if (req.user.role === "student" && !quiz.show_correct_answers) {
      questionsData = questionsData.map((q) => {
        const { correct_answer, explanation, ...questionWithoutAnswer } = q;
        return questionWithoutAnswer;
      });
    }

    res.status(200).json({
      success: true,
      count: questionsData.length,
      data: questionsData,
    });
  } catch (error) {
    console.error("Get quiz questions error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Get single question
// @route   GET /api/questions/:id
// @access  Private (instructor, admin, enrolled students)
export const getQuestion = async (req: Request, res: Response) => {
  try {
    const question = await QuizQuestion.findByPk(req.params.id, {
      include: [
        {
          model: Quiz,
          as: "questionQuiz",
          attributes: [
            "id",
            "title",
            "created_by",
            "course_id",
            "show_correct_answers",
          ],
        },
      ],
    });

    if (!question) {
      return res
        .status(404)
        .json({ success: false, message: "Question not found" });
    }

    const quiz = (question as any).questionQuiz;

    // Check if user can access this question
    if (req.user.role !== "admin" && req.user.id !== quiz?.created_by) {
      // For non-admin users, check if they are the quiz creator or course instructor
      // or enrolled in the course
      const course = await sequelize.models.Course.findByPk(quiz?.course_id);
      if (!course) {
        return res
          .status(404)
          .json({ success: false, message: "Course not found" });
      }

      const courseData = course.toJSON();
      if (req.user.id !== courseData.instructor_id) {
        // Check if student is enrolled in the course
        const enrollment = await sequelize.models.UserCourse.findOne({
          where: {
            user_id: req.user.id,
            course_id: quiz?.course_id,
          },
        });

        if (!enrollment) {
          return res.status(403).json({
            success: false,
            message: "Not authorized to access this question",
          });
        }
      }
    }

    let questionData = question.toJSON();

    // For students, don't include correct answers unless show_correct_answers is true
    if (req.user.role === "student" && !quiz?.show_correct_answers) {
      const { correct_answer, explanation, ...questionWithoutAnswer } =
        questionData;
      questionData = questionWithoutAnswer;
    }

    res.status(200).json({ success: true, data: questionData });
  } catch (error) {
    console.error("Get question error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Create question for a quiz
// @route   POST /api/quizzes/:quizId/questions
// @access  Private/Instructor/Admin (quiz creator or course instructor)
export const createQuestion = async (req: Request, res: Response) => {
  const transaction = await sequelize.transaction();
  try {
    const { quizId } = req.params;
    const questionData: CreateQuestionRequest = req.body;

    // Find the quiz
    const quiz = await Quiz.findByPk(quizId, { transaction });
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
        message: "Not authorized to add questions to this quiz",
      });
    }

    // Validate question data
    const validation = QuestionValidator.validateQuestionData(
      questionData.question_type,
      questionData.question_data,
      questionData.correct_answer,
    );

    if (!validation.isValid) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Invalid question data",
        errors: validation.errors,
        warnings: validation.warnings,
      });
    }

    // Set correct_answer based on question type
    let correctAnswer = questionData.correct_answer;
    if (questionData.question_type === "single_choice") {
      const singleChoiceData = questionData.question_data as any;
      if (singleChoiceData?.correct_option_index !== undefined) {
        correctAnswer = singleChoiceData.correct_option_index;
      }
    } else if (questionData.question_type === "multiple_choice") {
      const multipleChoiceData = questionData.question_data as any;
      if (multipleChoiceData?.correct_option_indices) {
        correctAnswer = multipleChoiceData.correct_option_indices;
      }
    } else if (questionData.question_type === "true_false") {
      const trueFalseData = questionData.question_data as any;
      if (trueFalseData?.correct_answer !== undefined) {
        correctAnswer = trueFalseData.correct_answer;
      }
    }
    // For other question types, correct_answer remains as provided or null

    // Get the next order number
    const maxOrder = (await QuizQuestion.max("order", {
      where: { quiz_id: quizId },
      transaction,
    })) as number | undefined;
    const nextOrder = (maxOrder || 0) + 1;

    const question = await QuizQuestion.create(
      {
        ...questionData,
        correct_answer: correctAnswer,
        quiz_id: parseInt(quizId),
        order: nextOrder,
        created_by: req.user.id,
      },
      { transaction },
    );

    await transaction.commit();

    // Fetch the created question with associations
    const createdQuestion = await QuizQuestion.findByPk(question.id, {
      include: [
        {
          model: Quiz,
          as: "questionQuiz",
          attributes: ["id", "title"],
        },
      ],
    });

    res.status(201).json({ success: true, data: createdQuestion });
  } catch (error) {
    await transaction.rollback();
    console.error("Create question error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Update question
// @route   PUT /api/questions/:id
// @access  Private/Instructor/Admin (quiz creator or course instructor)
export const updateQuestion = async (req: Request, res: Response) => {
  const transaction = await sequelize.transaction();
  try {
    const questionData = req.body;

    const question = await QuizQuestion.findByPk(req.params.id, {
      include: [
        {
          model: Quiz,
          as: "questionQuiz",
        },
      ],
      transaction,
    });

    if (!question) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Question not found" });
    }

    const quiz = question.quiz;

    // Check if user is authorized to update this question
    // Admin can update any question
    // Quiz creator can update any question in their quiz
    // Course instructor can update any question in courses they teach
    // Instructor can update questions they created
    // const userId = parseInt(String(req.user.id));
    // const quizCreatorId = parseInt(String(quiz?.created_by));
    // const questionCreatorId = parseInt(String(question.created_by));

    // Set correct_answer based on question type if question data is being updated
    let correctAnswer = questionData.correct_answer;
    if (questionData.question_type || questionData.question_data) {
      const questionType = questionData.question_type || question.question_type;
      const questionDataToUpdate =
        questionData.question_data || question.question_data;

      if (questionType === "single_choice") {
        const singleChoiceData = questionDataToUpdate as any;
        if (singleChoiceData?.correct_option_index !== undefined) {
          correctAnswer = singleChoiceData.correct_option_index;
        }
      } else if (questionType === "multiple_choice") {
        const multipleChoiceData = questionDataToUpdate as any;
        if (multipleChoiceData?.correct_option_indices) {
          correctAnswer = multipleChoiceData.correct_option_indices;
        }
      } else if (questionType === "true_false") {
        const trueFalseData = questionDataToUpdate as any;
        if (trueFalseData?.correct_answer !== undefined) {
          correctAnswer = trueFalseData.correct_answer;
        }
      }

      const validation = QuestionValidator.validateQuestionData(
        questionType,
        questionDataToUpdate,
        correctAnswer,
      );

      if (!validation.isValid) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "Invalid question data",
          errors: validation.errors,
          warnings: validation.warnings,
        });
      }
    }

    await question.update(
      { ...questionData, correct_answer: correctAnswer },
      { transaction },
    );
    await transaction.commit();

    // Fetch updated question
    const updatedQuestion = await QuizQuestion.findByPk(question.id, {
      include: [
        {
          model: Quiz,
          as: "questionQuiz",
          attributes: ["id", "title"],
        },
      ],
    });

    res.status(200).json({ success: true, data: updatedQuestion });
  } catch (error) {
    await transaction.rollback();
    console.error("Update question error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Delete question
// @route   DELETE /api/questions/:id
// @access  Private/Instructor/Admin (quiz creator or course instructor)
export const deleteQuestion = async (req: Request, res: Response) => {
  const transaction = await sequelize.transaction();
  try {
    const question = await QuizQuestion.findByPk(req.params.id, {
      include: [
        {
          model: Quiz,
          as: "questionQuiz",
          attributes: ["id", "title", "created_by", "course_id"],
          include: [
            {
              model: sequelize.models.Course,
              as: "course",
              attributes: ["id", "instructor_id"],
            },
          ],
        },
      ],
      transaction,
    });

    if (!question) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Question not found" });
    }

    const quiz = (question as any).questionQuiz;

    // Check if user is authorized to delete this question
    // Admin can delete any question
    // Quiz creator can delete any question in their quiz
    // Course instructor can delete any question in courses they teach
    // Instructor can delete questions they created
    const userId = parseInt(String(req.user.id));
    const quizCreatorId = parseInt(String(quiz?.created_by));
    const courseInstructorId = parseInt(String(quiz?.course?.instructor_id));
    const questionCreatorId = parseInt(String(question.created_by));

    // Additional check: if course association failed, try to fetch course directly
    let actualCourseInstructorId = courseInstructorId;
    if (isNaN(courseInstructorId) && quiz?.course_id) {
      try {
        const course = (await sequelize.models.Course.findByPk(quiz.course_id, {
          transaction,
        })) as any;
        actualCourseInstructorId = parseInt(String(course?.instructor_id));
        console.log(
          "Fetched course instructor directly:",
          actualCourseInstructorId,
        );
      } catch (error) {
        console.error("Failed to fetch course:", error);
      }
    }

    console.log("Delete authorization check:", {
      userId,
      userRole: req.user.role,
      quizCreatorId,
      courseInstructorId,
      questionCreatorId,
      questionId: question.id,
    });

    // Use the corrected course instructor ID
    const effectiveCourseInstructorId = !isNaN(actualCourseInstructorId)
      ? actualCourseInstructorId
      : courseInstructorId;

    // Handle case where question.created_by might be null/0 for legacy questions
    const isAuthorized =
      req.user.role === "admin" ||
      quizCreatorId === userId ||
      effectiveCourseInstructorId === userId ||
      (req.user.role === "instructor" && questionCreatorId === userId) ||
      (req.user.role === "instructor" &&
        (question.created_by === null || question.created_by === 0) &&
        effectiveCourseInstructorId === userId); // Fallback for legacy questions - allow course instructors to delete

    console.log("Authorization result:", {
      isAuthorized,
      isAdmin: req.user.role === "admin",
      isQuizCreator: quizCreatorId === userId,
      isCourseInstructor: courseInstructorId === userId,
      isQuestionCreator:
        req.user.role === "instructor" && questionCreatorId === userId,
      questionCreatorIdValid: !isNaN(questionCreatorId),
    });

    if (!isAuthorized) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message:
          "Not authorized to delete this question. Only the question creator, course instructor, or admin can delete questions.",
      });
    }

    // Check if there are any attempts for this question
    const attemptCount = await QuizAttempt.count({
      where: { question_id: question.id },
      transaction,
    });

    if (attemptCount > 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Cannot delete question with existing attempts",
      });
    }

    // Delete the question
    await question.destroy({ transaction });

    // Reorder remaining questions
    await reorderQuestionsAfterDelete(
      question.quiz_id,
      question.order,
      transaction,
    );

    await transaction.commit();

    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    await transaction.rollback();
    console.error("Delete question error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Reorder questions
// @route   PUT /api/quizzes/:quizId/questions/reorder
// @access  Private/Instructor/Admin (quiz creator or course instructor)
export const reorderQuestions = async (req: Request, res: Response) => {
  const transaction = await sequelize.transaction();
  try {
    const { quizId } = req.params;
    const { questionOrders } = req.body; // Array of { id, order }

    if (!Array.isArray(questionOrders)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "questionOrders must be an array",
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

    // Check authorization
    if (quiz.created_by !== req.user.id && req.user.role !== "admin") {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: "Not authorized to reorder questions",
      });
    }

    // Update orders in batch
    for (const { id, order } of questionOrders) {
      await QuizQuestion.update(
        { order },
        {
          where: { id, quiz_id: quizId },
          transaction,
        },
      );
    }

    await transaction.commit();

    // Fetch updated questions
    const updatedQuestions = await QuizQuestion.findAll({
      where: { quiz_id: quizId },
      order: [["order", "ASC"]],
    });

    res.status(200).json({
      success: true,
      data: updatedQuestions,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Reorder questions error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Bulk import questions
// @route   POST /api/quizzes/:quizId/questions/bulk
// @access  Private/Instructor/Admin (quiz creator or course instructor)
export const bulkImportQuestions = async (req: Request, res: Response) => {
  const transaction = await sequelize.transaction();
  try {
    const { quizId } = req.params;
    const { questions } = req.body; // Array of question objects

    if (!Array.isArray(questions)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Questions must be an array",
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

    // Check authorization
    if (quiz.created_by !== req.user.id && req.user.role !== "admin") {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: "Not authorized to add questions to this quiz",
      });
    }

    // Validate all questions first
    const validationErrors: Array<{ index: number; errors: string[] }> = [];

    questions.forEach((question, index) => {
      const validation = QuestionValidator.validateQuestionData(
        question.question_type,
        question.question_data,
        question.correct_answer,
      );

      if (!validation.isValid) {
        validationErrors.push({
          index,
          errors: validation.errors,
        });
      }
    });

    if (validationErrors.length > 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Some questions have validation errors",
        errors: validationErrors,
      });
    }

    // Get current max order
    const maxOrder = (await QuizQuestion.max("order", {
      where: { quiz_id: quizId },
      transaction,
    })) as number | undefined;

    // Create questions
    const createdQuestions = [];
    for (let i = 0; i < questions.length; i++) {
      const questionData = questions[i];
      const question = await QuizQuestion.create(
        {
          ...questionData,
          quiz_id: parseInt(quizId),
          order: (maxOrder || 0) + i + 1,
          created_by: req.user.id,
        },
        { transaction },
      );

      createdQuestions.push(question);
    }

    await transaction.commit();

    res.status(201).json({
      success: true,
      count: createdQuestions.length,
      data: createdQuestions,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Bulk import questions error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Helper function to reorder questions after deletion
async function reorderQuestionsAfterDelete(
  quizId: number,
  deletedOrder: number,
  transaction: Transaction,
) {
  await QuizQuestion.update(
    { order: sequelize.literal("`order` - 1") },
    {
      where: {
        quiz_id: quizId,
        order: { [Op.gt]: deletedOrder },
      },
      transaction,
    },
  );
}

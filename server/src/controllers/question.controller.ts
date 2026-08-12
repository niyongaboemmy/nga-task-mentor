import { Request, Response } from "express";
import axios from "axios";
import { QuizQuestion, Quiz, QuizAttempt, QuestionBank } from "../models";
import { Transaction, Op } from "sequelize";
import { sequelize } from "../config/database";
import { QuestionValidator } from "../utils/questionValidation";
import { QuestionType, CreateQuestionRequest } from "../types/quiz.types";
import {
  getMisToken,
  getCurrentTermId,
  handleMisError,
} from "../utils/misUtils";
import BloomsTaxonomyLevel from "../models/BloomsTaxonomyLevel.model";
import { getQuestionBankInclude } from "../utils/quizUtils";

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

    // Instructors and admins can access any quiz; only plain quiz-takers are enrollment-checked
    if (!req.user.permissions?.has("QUIZZES_EDIT")) {
      const token = getMisToken(req);
      const termId = await getCurrentTermId(req);

      try {
        const enrollmentResponse = await axios.get(
          `${process.env.NGA_MIS_BASE_URL}/academics/subjects/${quiz.course_id}/terms/${termId}/students`,
          { headers: { Authorization: `Bearer ${token}` } },
        );

        const enrolledStudents = enrollmentResponse.data.data || [];
        const isEnrolled = enrolledStudents.some(
          (s: any) => s.user_id === req.user.id || s.id === req.user.id,
        );

        if (!isEnrolled) {
          return res.status(403).json({
            success: false,
            message: "Not authorized to access this quiz",
          });
        }
      } catch (enrollmentError: any) {
        if (enrollmentError.response?.status === 401) {
          return handleMisError(enrollmentError, res, "MIS session expired");
        }
        console.error("Error checking enrollment:", enrollmentError);
        return res.status(403).json({
          success: false,
          message: "Not authorized to access this quiz",
        });
      }
    }

    const questions = await QuizQuestion.findAll({
      where: { quiz_id: quizId },
      include: getQuestionBankInclude(),
      order: [["order", "ASC"]],
    });

    // For students, don't include correct answers unless show_correct_answers is true
    let questionsData = questions.map((q) => q.toJSON());

    if (!req.user.permissions?.has("QUIZ_QUESTIONS_VIEW_WITH_ANSWERS") && !quiz.show_correct_answers) {
      questionsData = questionsData.map((q: any) => {
        if (q.questionBank) {
          const { correct_answer, explanation, ...bankWithoutAnswer } =
            q.questionBank;
          return { ...q, questionBank: bankWithoutAnswer };
        }
        return q;
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

// @desc    Get single question (by quiz_question id)
// @route   GET /api/questions/:id
// @access  Private (instructor, admin, enrolled students)
export const getQuestion = async (req: Request, res: Response) => {
  try {
    const question = await QuizQuestion.findByPk(req.params.id, {
      include: [
        {
          model: sequelize.models.Quiz,
          as: "questionQuiz",
          attributes: [
            "id",
            "title",
            "created_by",
            "course_id",
            "show_correct_answers",
          ],
        },
        ...getQuestionBankInclude(),
      ],
    });

    if (!question) {
      return res
        .status(404)
        .json({ success: false, message: "Question not found" });
    }

    const quiz = (question as any).questionQuiz;

    let questionData: any = question.toJSON();

    // For students, don't include correct answers unless show_correct_answers is true
    if (!req.user.permissions?.has("QUIZ_QUESTIONS_VIEW_WITH_ANSWERS") && !quiz?.show_correct_answers) {
      if (questionData.questionBank) {
        const { correct_answer, explanation, ...bankWithoutAnswer } =
          questionData.questionBank;
        questionData = { ...questionData, questionBank: bankWithoutAnswer };
      }
    }

    res.status(200).json({ success: true, data: questionData });
  } catch (error) {
    console.error("Get question error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Add a question to a quiz (either by referencing existing bank question or creating new)
// @route   POST /api/quizzes/:quizId/questions
// @access  Private/Instructor/Admin (quiz creator or course instructor)
export const createQuestion = async (req: Request, res: Response) => {
  const transaction = await sequelize.transaction();
  try {
    const { quizId } = req.params;
    const body = req.body;

    // Find the quiz
    const quiz = await Quiz.findByPk(quizId, { transaction });
    if (!quiz) {
      try {
        await transaction.rollback();
      } catch (re) {
        // Ignore if transaction already finished
      }
      return res
        .status(404)
        .json({ success: false, message: "Quiz not found" });
    }

    // Check if user is quiz creator or admin
    if (quiz.created_by !== req.user.id && !req.user.permissions?.has("QUIZZES_MANAGE_ANY")) {
      try {
        await transaction.rollback();
      } catch (re) {
        // Ignore if transaction already finished
      }
      return res.status(403).json({
        success: false,
        message: "Not authorized to add questions to this quiz",
      });
    }

    let bankQuestionId: number;
    let bankDuration: number = 60;

    if (body.question_id) {
      // Referencing an existing bank question
      const existing = await QuestionBank.findByPk(body.question_id, {
        transaction,
      });
      if (!existing) {
        try {
          await transaction.rollback();
        } catch (re) {
          // Ignore if transaction already finished
        }
        return res.status(404).json({
          success: false,
          message: "Question bank entry not found",
        });
      }
      bankQuestionId = existing.id!;
      bankDuration = existing.time_limit_seconds ?? 60;
    } else {
      // Creating a new question in the bank as part of adding to quiz
      const {
        question_type,
        question_text,
        question_data,
        correct_answer,
        explanation,
        attachments,
        blooms_taxonomy_level_id,
        tags,
        difficulty_level,
      } = body;

      // Validate required fields when creating a new bank entry
      if (!question_type || !question_text || !question_data) {
        try {
          await transaction.rollback();
        } catch (re) {
          // Ignore if transaction already finished
        }
        return res.status(400).json({
          success: false,
          message:
            "Must provide question_id (existing bank question) or question_type, question_text, and question_data (new question)",
        });
      }

      const validation = QuestionValidator.validateQuestionData(
        question_type,
        question_data,
      );

      if (!validation.isValid) {
        try {
          await transaction.rollback();
        } catch (re) {
          // Ignore if transaction already finished
        }
        return res.status(400).json({
          success: false,
          message: "Invalid question data",
          errors: validation.errors,
          warnings: validation.warnings,
        });
      }

      const bankQuestion = await QuestionBank.create(
        {
          course_id: quiz.course_id!,
          question_type,
          question_text,
          question_data,
          correct_answer: correct_answer ?? null,
          explanation: explanation ?? null,
          attachments: attachments ?? null,
          created_by: req.user.id,
          blooms_taxonomy_level_id: blooms_taxonomy_level_id ?? null,
          tags: tags ?? null,
          difficulty_level: difficulty_level ?? null,
          time_limit_seconds: body.time_limit_seconds ?? 60,
        },
        { transaction },
      );

      bankQuestionId = bankQuestion.id!;
      bankDuration = bankQuestion.time_limit_seconds ?? 60;
    }

    // Get the next order number
    const maxOrder = (await QuizQuestion.max("order", {
      where: { quiz_id: quizId },
      transaction,
    })) as number | undefined;
    const nextOrder = (maxOrder || 0) + 1;

    const quizQuestion = await QuizQuestion.create(
      {
        quiz_id: parseInt(quizId),
        question_id: bankQuestionId,
        order: body.order ?? nextOrder,
        points: body.points ?? 1,
        time_limit_seconds: bankDuration,
        is_required: body.is_required ?? true,
      },
      { transaction },
    );

    await transaction.commit();

    // Fetch the created question with all data
    const createdQuestion = await QuizQuestion.findByPk(quizQuestion.id, {
      include: [
        {
          model: sequelize.models.Quiz,
          as: "questionQuiz",
          attributes: ["id", "title"],
        },
        ...getQuestionBankInclude(),
      ],
    });

    res.status(201).json({ success: true, data: createdQuestion });
  } catch (error) {
    try {
      await transaction.rollback();
    } catch (re) {
      // Ignore if transaction already finished
    }
    console.error("Create question error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Update question assignment (order/points/time) and/or question bank content
// @route   PUT /api/questions/:id
// @access  Private/Instructor/Admin
export const updateQuestion = async (req: Request, res: Response) => {
  const transaction = await sequelize.transaction();
  try {
    const body = req.body;

    const quizQuestion = await QuizQuestion.findByPk(req.params.id, {
      include: [
        { model: sequelize.models.Quiz, as: "questionQuiz" },
        ...getQuestionBankInclude(),
      ],
      transaction,
    });

    if (!quizQuestion) {
      try {
        await transaction.rollback();
      } catch (re) {
        // Ignore if transaction already finished
      }
      return res
        .status(404)
        .json({ success: false, message: "Question not found" });
    }

    const quiz = quizQuestion.quiz;
    const bankQuestion = (quizQuestion as any).questionBank as QuestionBank;

    const userId = parseInt(String(req.user.id));
    const quizCreatorId = parseInt(String(quiz?.created_by));
    const questionCreatorId = parseInt(String(bankQuestion?.created_by));

    const isAuthorized =
      req.user.permissions?.has("QUIZZES_MANAGE_ANY") ||
      quizCreatorId === userId ||
      (req.user.permissions?.has("QUESTION_BANK_EDIT") && questionCreatorId === userId);

    if (!isAuthorized) {
      try {
        await transaction.rollback();
      } catch (re) {
        // Ignore if transaction already finished
      }
      return res.status(403).json({
        success: false,
        message:
          "Not authorized to update this question. Only the question creator, quiz creator, or admin can update questions.",
      });
    }

    // Split into bank-level and assignment-level updates
    const {
      order,
      points,
      time_limit_seconds,
      is_required,
      // Everything else goes to the bank
      ...bankUpdates
    } = body;

    // Update assignment metadata on quiz_questions row
    const assignmentUpdate: any = {};
    if (order !== undefined) assignmentUpdate.order = order;
    if (points !== undefined) assignmentUpdate.points = points;
    if (time_limit_seconds !== undefined)
      assignmentUpdate.time_limit_seconds = time_limit_seconds;
    if (is_required !== undefined) assignmentUpdate.is_required = is_required;

    if (Object.keys(assignmentUpdate).length > 0) {
      await quizQuestion.update(assignmentUpdate, { transaction });
    }

    // Update question content in the bank
    if (time_limit_seconds !== undefined) {
      bankUpdates.time_limit_seconds = time_limit_seconds;
    }

    if (Object.keys(bankUpdates).length > 0 && bankQuestion) {
      if (bankUpdates.question_type || bankUpdates.question_data) {
        const questionType =
          bankUpdates.question_type || bankQuestion.question_type;
        const questionDataToValidate =
          bankUpdates.question_data || bankQuestion.question_data;

        const validation = QuestionValidator.validateQuestionData(
          questionType as QuestionType,
          questionDataToValidate,
        );

        if (!validation.isValid) {
          try {
            await transaction.rollback();
          } catch (re) {
            // Ignore if transaction already finished
          }
          return res.status(400).json({
            success: false,
            message: "Invalid question data",
            errors: validation.errors,
            warnings: validation.warnings,
          });
        }
      }

      await bankQuestion.update(bankUpdates, { transaction });
    }

    await transaction.commit();

    // Fetch updated question
    const updatedQuestion = await QuizQuestion.findByPk(quizQuestion.id, {
      include: [
        {
          model: sequelize.models.Quiz,
          as: "questionQuiz",
          attributes: ["id", "title"],
        },
        ...getQuestionBankInclude(),
      ],
    });

    res.status(200).json({ success: true, data: updatedQuestion });
  } catch (error) {
    try {
      await transaction.rollback();
    } catch (re) {
      // Ignore if transaction already finished
    }
    console.error("Update question error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Remove question from quiz (delete quiz_question row)
// @route   DELETE /api/questions/:id
// @access  Private/Instructor/Admin
export const deleteQuestion = async (req: Request, res: Response) => {
  const transaction = await sequelize.transaction();
  try {
    const quizQuestion = await QuizQuestion.findByPk(req.params.id, {
      include: [
        {
          model: sequelize.models.Quiz,
          as: "questionQuiz",
          attributes: ["id", "title", "created_by", "course_id"],
        },
        ...getQuestionBankInclude(),
      ],
      transaction,
    });

    if (!quizQuestion) {
      try {
        await transaction.rollback();
      } catch (re) {
        // Ignore if transaction already finished
      }
      return res
        .status(404)
        .json({ success: false, message: "Question not found" });
    }

    const quiz = (quizQuestion as any).questionQuiz;

    const userId = parseInt(String(req.user.id));
    const quizCreatorId = parseInt(String(quiz?.created_by));
    const bankQuestion = (quizQuestion as any).questionBank as QuestionBank;
    const questionCreatorId = parseInt(String(bankQuestion?.created_by));

    const isAuthorized =
      req.user.permissions?.has("QUIZZES_MANAGE_ANY") ||
      userId === quizCreatorId ||
      (req.user.permissions?.has("QUESTION_BANK_EDIT") && questionCreatorId === userId);

    if (!isAuthorized) {
      try {
        await transaction.rollback();
      } catch (re) {
        // Ignore if transaction already finished
      }
      return res.status(403).json({
        success: false,
        message: "Not authorized to remove this question from the quiz.",
      });
    }

    // Check if there are any attempts for this quiz_question
    const attemptCount = await QuizAttempt.count({
      where: { question_id: quizQuestion.id },
      transaction,
    });

    if (attemptCount > 0) {
      try {
        await transaction.rollback();
      } catch (re) {
        // Ignore if transaction already finished
      }
      return res.status(400).json({
        success: false,
        message: "Cannot remove question with existing attempts",
      });
    }

    const deletedOrder = quizQuestion.order;
    const deletedQuizId = quizQuestion.quiz_id;

    // Delete the quiz_question link row only
    await quizQuestion.destroy({ transaction });

    // Reorder remaining questions in the quiz
    await reorderQuestionsAfterDelete(deletedQuizId, deletedOrder, transaction);

    await transaction.commit();

    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    try {
      await transaction.rollback();
    } catch (re) {
      // Ignore if transaction already finished
    }
    console.error("Delete question error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Reorder questions in a quiz
// @route   PUT /api/quizzes/:quizId/questions/reorder
// @access  Private/Instructor/Admin
export const reorderQuestions = async (req: Request, res: Response) => {
  const transaction = await sequelize.transaction();
  try {
    const { quizId } = req.params;
    const { questionOrders } = req.body; // Array of { id, order }

    if (!Array.isArray(questionOrders)) {
      try {
        await transaction.rollback();
      } catch (re) {
        // Ignore if transaction already finished
      }
      return res.status(400).json({
        success: false,
        message: "questionOrders must be an array",
      });
    }

    const quiz = await Quiz.findByPk(quizId, { transaction });
    if (!quiz) {
      try {
        await transaction.rollback();
      } catch (re) {
        // Ignore if transaction already finished
      }
      return res
        .status(404)
        .json({ success: false, message: "Quiz not found" });
    }

    if (quiz.created_by !== req.user.id && !req.user.permissions?.has("QUIZZES_MANAGE_ANY")) {
      try {
        await transaction.rollback();
      } catch (re) {
        // Ignore if transaction already finished
      }
      return res.status(403).json({
        success: false,
        message: "Not authorized to reorder questions",
      });
    }

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

    const updatedQuestions = await QuizQuestion.findAll({
      where: { quiz_id: quizId },
      include: getQuestionBankInclude(),
      order: [["order", "ASC"]],
    });

    res.status(200).json({
      success: true,
      data: updatedQuestions,
    });
  } catch (error) {
    try {
      await transaction.rollback();
    } catch (re) {
      // Ignore if transaction already finished
    }
    console.error("Reorder questions error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Bulk import questions to a quiz
// @route   POST /api/quizzes/:quizId/questions/bulk
// @access  Private/Instructor/Admin
export const bulkImportQuestions = async (req: Request, res: Response) => {
  const transaction = await sequelize.transaction();
  try {
    const { quizId } = req.params;
    const { questions } = req.body;

    if (!Array.isArray(questions)) {
      try {
        await transaction.rollback();
      } catch (re) {
        // Ignore if transaction already finished
      }
      return res.status(400).json({
        success: false,
        message: "Questions must be an array",
      });
    }

    const quiz = await Quiz.findByPk(quizId, { transaction });
    if (!quiz) {
      try {
        await transaction.rollback();
      } catch (re) {
        // Ignore if transaction already finished
      }
      return res
        .status(404)
        .json({ success: false, message: "Quiz not found" });
    }

    if (quiz.created_by !== req.user.id && !req.user.permissions?.has("QUIZZES_MANAGE_ANY")) {
      try {
        await transaction.rollback();
      } catch (re) {
        // Ignore if transaction already finished
      }
      return res.status(403).json({
        success: false,
        message: "Not authorized to add questions to this quiz",
      });
    }

    // Validate all questions first
    const validationErrors: Array<{ index: number; errors: string[] }> = [];
    questions.forEach((question, index) => {
      if (!question.question_id) {
        // Only validate if creating new bank questions
        const validation = QuestionValidator.validateQuestionData(
          question.question_type,
          question.question_data,
        );
        if (!validation.isValid) {
          validationErrors.push({ index, errors: validation.errors });
        }
      }
    });

    if (validationErrors.length > 0) {
      try {
        await transaction.rollback();
      } catch (re) {
        // Ignore if transaction already finished
      }
      return res.status(400).json({
        success: false,
        message: "Some questions have validation errors",
        errors: validationErrors,
      });
    }

    const maxOrder = (await QuizQuestion.max("order", {
      where: { quiz_id: quizId },
      transaction,
    })) as number | undefined;

    const createdQuestions = [];
    for (let i = 0; i < questions.length; i++) {
      const qData = questions[i];
      let bankQuestionId: number;
      let bankDuration: number = 60;

      if (qData.question_id) {
        // Existing bank question
        bankQuestionId = qData.question_id;
        const existing = await QuestionBank.findByPk(bankQuestionId, {
          transaction,
        });
        if (existing) bankDuration = existing.time_limit_seconds ?? 60;
      } else {
        // Create new bank question
        const bankQuestion = await QuestionBank.create(
          {
            course_id: quiz.course_id!,
            question_type: qData.question_type,
            question_text: qData.question_text,
            question_data: qData.question_data,
            correct_answer: qData.correct_answer ?? null,
            explanation: qData.explanation ?? null,
            attachments: qData.attachments ?? null,
            created_by: req.user.id,
            blooms_taxonomy_level_id: qData.blooms_taxonomy_level_id ?? null,
            tags: qData.tags ?? null,
            difficulty_level: qData.difficulty_level ?? null,
            time_limit_seconds: qData.time_limit_seconds ?? 60,
          },
          { transaction },
        );
        bankQuestionId = bankQuestion.id!;
        bankDuration = bankQuestion.time_limit_seconds ?? 60;
      }

      const quizQuestion = await QuizQuestion.create(
        {
          quiz_id: parseInt(quizId),
          question_id: bankQuestionId,
          order: (maxOrder || 0) + i + 1,
          points: qData.points ?? 1,
          time_limit_seconds: bankDuration,
          is_required: qData.is_required ?? true,
        },
        { transaction },
      );

      createdQuestions.push(quizQuestion);
    }

    await transaction.commit();

    // Fetch with full data
    const resultIds = createdQuestions.map((q) => q.id);
    const result = await QuizQuestion.findAll({
      where: { id: resultIds },
      include: getQuestionBankInclude(),
      order: [["order", "ASC"]],
    });

    res.status(201).json({
      success: true,
      count: result.length,
      data: result,
    });
  } catch (error) {
    try {
      await transaction.rollback();
    } catch (re) {
      // Ignore if transaction already finished
    }
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

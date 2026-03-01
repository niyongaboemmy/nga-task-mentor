import { Request, Response } from "express";
import { QuestionBank, QuizQuestion } from "../models";
import { sequelize } from "../config/database";
import { Op } from "sequelize";
import BloomsTaxonomyLevel from "../models/BloomsTaxonomyLevel.model";
import { QuestionValidator } from "../utils/questionValidation";
import { QuestionType } from "../types/quiz.types";
import { WordParserService } from "../services/WordParserService";
import { WordTemplateService } from "../services/WordTemplateService";

// @desc    Get all questions in a course's question bank
// @route   GET /api/courses/:courseId/question-bank
// @access  Private (instructor, admin)
export const getCourseQuestions = async (req: Request, res: Response) => {
  try {
    const { courseId } = req.params;
    const {
      page = "1",
      limit = "50",
      question_type,
      difficulty_level,
      blooms_taxonomy_level_id,
      search,
      tags,
    } = req.query;

    const pageNum = parseInt(String(page), 10);
    const limitNum = parseInt(String(limit), 10);
    const offset = (pageNum - 1) * limitNum;

    const where: any = { course_id: parseInt(courseId) };

    if (question_type) {
      if (typeof question_type === "string" && question_type.includes(",")) {
        where.question_type = { [Op.in]: question_type.split(",") };
      } else {
        where.question_type = question_type;
      }
    }
    if (difficulty_level) {
      if (
        typeof difficulty_level === "string" &&
        difficulty_level.includes(",")
      ) {
        where.difficulty_level = { [Op.in]: difficulty_level.split(",") };
      } else {
        where.difficulty_level = difficulty_level;
      }
    }
    if (blooms_taxonomy_level_id) {
      if (
        typeof blooms_taxonomy_level_id === "string" &&
        blooms_taxonomy_level_id.includes(",")
      ) {
        where.blooms_taxonomy_level_id = {
          [Op.in]: blooms_taxonomy_level_id
            .split(",")
            .map((id) => parseInt(id)),
        };
      } else {
        where.blooms_taxonomy_level_id = parseInt(
          String(blooms_taxonomy_level_id),
        );
      }
    }
    if (search) {
      where[Op.or] = [
        { question_text: { [Op.like]: `%${search}%` } },
        { tags: { [Op.like]: `%${search}%` } },
      ];
    }
    if (tags) {
      if (typeof tags === "string" && tags.includes(",")) {
        const tagList = tags.split(",");
        where[Op.and] = tagList.map((tag) => ({
          tags: { [Op.like]: `%${tag.trim().toLowerCase()}%` },
        }));
      } else {
        where.tags = { [Op.like]: `%${String(tags).trim().toLowerCase()}%` };
      }
    }

    const { count, rows } = await QuestionBank.findAndCountAll({
      where,
      include: [
        {
          model: BloomsTaxonomyLevel,
          as: "bloomsLevel",
          attributes: ["id", "name", "level_order"],
          required: false,
        },
      ],
      order: [["created_at", "DESC"]],
      limit: limitNum,
      offset,
    });

    res.status(200).json({
      success: true,
      count,
      page: pageNum,
      total_pages: Math.ceil(count / limitNum),
      data: rows,
    });
  } catch (error) {
    console.error("Get course questions error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Get a single question from the bank
// @route   GET /api/courses/:courseId/question-bank/:id
// @access  Private (instructor, admin)
export const getQuestionBankQuestion = async (req: Request, res: Response) => {
  try {
    const { courseId, id } = req.params;

    const question = await QuestionBank.findOne({
      where: { id: parseInt(id), course_id: parseInt(courseId) },
      include: [
        {
          model: BloomsTaxonomyLevel,
          as: "bloomsLevel",
          attributes: ["id", "name", "level_order", "description"],
          required: false,
        },
      ],
    });

    if (!question) {
      return res.status(404).json({
        success: false,
        message: "Question not found in this course's bank",
      });
    }

    res.status(200).json({ success: true, data: question });
  } catch (error) {
    console.error("Get question bank question error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Create a question in a course's question bank
// @route   POST /api/courses/:courseId/question-bank
// @access  Private (instructor, admin)
export const createCourseQuestion = async (req: Request, res: Response) => {
  const transaction = await sequelize.transaction();
  try {
    const { courseId } = req.params;
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
      time_limit_seconds,
    } = req.body;

    // Validate question data
    const validation = QuestionValidator.validateQuestionData(
      question_type as QuestionType,
      question_data,
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

    // Validate Blooms Taxonomy Level if provided
    if (blooms_taxonomy_level_id) {
      const level = await BloomsTaxonomyLevel.findByPk(
        blooms_taxonomy_level_id,
        { transaction },
      );
      if (!level) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "Invalid Bloom's Taxonomy level ID",
        });
      }
    }

    // Sanitize tags
    const sanitizedTags = Array.isArray(tags)
      ? tags.map((t: string) => t.toLowerCase().trim())
      : tags;

    const question = await QuestionBank.create(
      {
        course_id: parseInt(courseId),
        question_type,
        question_text,
        question_data,
        correct_answer: correct_answer ?? null,
        explanation: explanation ?? null,
        attachments: attachments ?? null,
        created_by: req.user.id,
        blooms_taxonomy_level_id: blooms_taxonomy_level_id ?? null,
        tags: sanitizedTags ?? null,
        difficulty_level: difficulty_level ?? null,
        time_limit_seconds: time_limit_seconds ?? 60,
      },
      { transaction },
    );

    await transaction.commit();

    // Fetch with associations
    const created = await QuestionBank.findByPk(question.id, {
      include: [
        {
          model: BloomsTaxonomyLevel,
          as: "bloomsLevel",
          attributes: ["id", "name", "level_order"],
          required: false,
        },
      ],
    });

    res.status(201).json({ success: true, data: created });
  } catch (error) {
    await transaction.rollback();
    console.error("Create course question error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Update a question in the bank
// @route   PUT /api/courses/:courseId/question-bank/:id
// @access  Private (instructor, admin)
export const updateCourseQuestion = async (req: Request, res: Response) => {
  const transaction = await sequelize.transaction();
  try {
    const { courseId, id } = req.params;
    const updateData = req.body;

    const question = await QuestionBank.findOne({
      where: { id: parseInt(id), course_id: parseInt(courseId) },
      transaction,
    });

    if (!question) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Question not found in this course's bank",
      });
    }

    // If question_type or question_data are being updated, re-validate
    if (updateData.question_type || updateData.question_data) {
      const questionType = updateData.question_type || question.question_type;
      const questionDataToValidate =
        updateData.question_data || question.question_data;

      const validation = QuestionValidator.validateQuestionData(
        questionType as QuestionType,
        questionDataToValidate,
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

    // Validate Blooms Taxonomy Level if being updated
    if (updateData.blooms_taxonomy_level_id) {
      const level = await BloomsTaxonomyLevel.findByPk(
        updateData.blooms_taxonomy_level_id,
        { transaction },
      );
      if (!level) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "Invalid Bloom's Taxonomy level ID",
        });
      }
    }

    // Sanitize tags if provided
    if (updateData.tags && Array.isArray(updateData.tags)) {
      updateData.tags = updateData.tags.map((t: string) =>
        t.toLowerCase().trim(),
      );
    }

    // Check authorization: only creator or admin can update
    if (req.user.role !== "admin" && question.created_by !== req.user.id) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this question",
      });
    }

    await question.update(updateData, { transaction });
    await transaction.commit();

    // Fetch updated with associations
    const updated = await QuestionBank.findByPk(question.id, {
      include: [
        {
          model: BloomsTaxonomyLevel,
          as: "bloomsLevel",
          attributes: ["id", "name", "level_order"],
          required: false,
        },
      ],
    });

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    await transaction.rollback();
    console.error("Update course question error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Delete a question from the bank
// @route   DELETE /api/courses/:courseId/question-bank/:id
// @access  Private (instructor, admin)
export const deleteCourseQuestion = async (req: Request, res: Response) => {
  const transaction = await sequelize.transaction();
  try {
    const { courseId, id } = req.params;

    const question = await QuestionBank.findOne({
      where: { id: parseInt(id), course_id: parseInt(courseId) },
      transaction,
    });

    if (!question) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Question not found in this course's bank",
      });
    }

    // Check authorization
    if (req.user.role !== "admin" && question.created_by !== req.user.id) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this question",
      });
    }

    // Guard: cannot delete if still assigned to any quiz
    const assignmentCount = await QuizQuestion.count({
      where: { question_id: question.id },
      transaction,
    });

    if (assignmentCount > 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Cannot delete question — it is currently assigned to ${assignmentCount} quiz(zes). Remove it from all quizzes first.`,
      });
    }

    await question.destroy({ transaction });
    await transaction.commit();

    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    await transaction.rollback();
    console.error("Delete course question error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Download Word Docx Template
// @route   GET /api/courses/:courseId/question-bank/template
// @access  Private (instructor, admin)
export const downloadDocxTemplate = async (req: Request, res: Response) => {
  try {
    const buffer = await WordTemplateService.generateTemplate();
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=question_bank_template.docx",
    );
    res.send(buffer);
  } catch (error) {
    console.error("Download template error:", error);
    res
      .status(500)
      .json({ success: false, message: "Error generating template" });
  }
};

// @desc    Parse uploaded Word Docx
// @route   POST /api/courses/:courseId/question-bank/upload
// @access  Private (instructor, admin)
export const parseDocxQuestions = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded" });
    }
    const questions = await WordParserService.parseDocx(req.file.buffer);
    res.status(200).json({ success: true, data: questions });
  } catch (error) {
    console.error("Parse docx error:", error);
    res.status(500).json({ success: false, message: "Error parsing docx" });
  }
};

// @desc    Bulk create questions in the bank
// @route   POST /api/courses/:courseId/question-bank/bulk
// @access  Private (instructor, admin)
export const bulkCreateCourseQuestions = async (
  req: Request,
  res: Response,
) => {
  const transaction = await sequelize.transaction();
  try {
    const { courseId } = req.params;
    const { questions } = req.body;

    if (!Array.isArray(questions) || questions.length === 0) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ success: false, message: "No questions provided" });
    }

    const createdQuestions = [];

    for (const q of questions) {
      // Validate Blooms Taxonomy Level if name is provided
      let bloomsLevelId = q.blooms_taxonomy_level_id || null;
      if (!bloomsLevelId && q.blooms_level_name) {
        const level = await BloomsTaxonomyLevel.findOne({
          where: { name: { [Op.like]: q.blooms_level_name } },
          transaction,
        });
        if (level) {
          bloomsLevelId = level.id;
        }
      }

      // Sanitize tags
      const sanitizedTags = Array.isArray(q.tags)
        ? q.tags.map((t: string) => t.toLowerCase().trim())
        : q.tags;

      // Validate question data
      const validation = QuestionValidator.validateQuestionData(
        q.question_type as QuestionType,
        q.question_data,
      );

      if (!validation.isValid) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Invalid data for question: "${q.question_text.substring(0, 50)}..."`,
          errors: validation.errors,
          warnings: validation.warnings,
        });
      }

      const question = await QuestionBank.create(
        {
          course_id: parseInt(courseId),
          question_type: q.question_type,
          question_text: q.question_text,
          question_data: q.question_data,
          correct_answer: q.correct_answer ?? null,
          explanation: q.explanation ?? null,
          attachments: q.attachments ?? null,
          created_by: req.user.id,
          blooms_taxonomy_level_id: bloomsLevelId,
          tags: sanitizedTags ?? null,
          difficulty_level: q.difficulty_level ?? "MEDIUM",
          time_limit_seconds: q.time_limit_seconds ?? 60,
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
    console.error("Bulk create questions error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

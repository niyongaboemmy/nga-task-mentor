import { Request, Response } from "express";
import { Submission, Assignment, User } from "../models";
import { Op } from "sequelize";
import { isPastDate } from "../utils/dateUtils";
import path from "path";
import fs from "fs";

// @desc    Get all submissions
// @route   GET /api/submissions
// @access  Private
export const getSubmissions = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    const submissions = await Submission.findAll({
      where: {
        student_id: userId,
      },
      include: [
        {
          model: Assignment,
          attributes: ["id", "title", "course_id"],
        },
      ],
    });

    res
      .status(200)
      .json({ success: true, count: submissions.length, data: submissions });
  } catch (error) {
    console.error("Get submissions error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Get single submission
// @route   GET /api/submissions/:id
// @access  Private
export const getSubmission = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    const submission = await Submission.findByPk(req.params.id, {
      include: [
        {
          model: Assignment,
          attributes: ["id", "title", "course_id"],
        },
      ],
    });

    if (!submission) {
      return res
        .status(404)
        .json({ success: false, message: "Submission not found" });
    }

    // Check if user owns the submission or is instructor/admin
    if (
      submission.student_id !== userId &&
      (req as any).user.role !== "instructor" &&
      (req as any).user.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to access this submission",
      });
    }

    res.status(200).json({ success: true, data: submission });
  } catch (error) {
    console.error("Get submission error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Create submission
// @route   POST /api/assignments/:assignmentId/submissions
// @access  Private/Student
export const createSubmission = async (req: Request, res: Response) => {
  try {
    const { assignmentId } = req.params;
    const { text_submission, file_submissions } = req.body;
    const userId = (req as any).user.id;

    // Check if assignment exists
    const assignment = await Assignment.findByPk(assignmentId);
    if (!assignment) {
      return res
        .status(404)
        .json({ success: false, message: "Assignment not found" });
    }

    // Check if due date has passed
    if (isPastDate(assignment.due_date)) {
      return res
        .status(400)
        .json({ success: false, message: "Assignment deadline has passed" });
    }

    // Check if user already submitted
    const existingSubmission = await Submission.findOne({
      where: {
        student_id: userId,
        assignment_id: parseInt(assignmentId),
      },
    });

    if (existingSubmission) {
      return res.status(400).json({
        success: false,
        message: "Submission already exists for this assignment",
      });
    }

    const submission = await Submission.create({
      student_id: userId,
      assignment_id: parseInt(assignmentId),
      text_submission,
      file_submissions,
      status: "submitted",
      submitted_at: new Date(),
      is_late: isPastDate(assignment.due_date),
    });

    res.status(201).json({ success: true, data: submission });
  } catch (error) {
    console.error("Create submission error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Update submission
// @route   PUT /api/submissions/:id
// @access  Private
export const updateSubmission = async (req: Request, res: Response) => {
  try {
    const { text_submission, file_submissions } = req.body;
    const userId = (req as any).user.id;

    const submission = await Submission.findByPk(req.params.id);

    if (!submission) {
      return res
        .status(404)
        .json({ success: false, message: "Submission not found" });
    }

    // Check if user owns the submission or is instructor/admin
    if (
      submission.student_id !== userId &&
      (req as any).user.role !== "instructor" &&
      (req as any).user.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this submission",
      });
    }

    // Update fields
    submission.text_submission = text_submission || submission.text_submission;
    submission.file_submissions =
      file_submissions || submission.file_submissions;

    await submission.save();

    res.status(200).json({ success: true, data: submission });
  } catch (error) {
    console.error("Update submission error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Delete submission
// @route   DELETE /api/submissions/:id
// @access  Private
export const deleteSubmission = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    const submission = (await Submission.findByPk(req.params.id, {
      include: [
        {
          model: Assignment,
          attributes: ["id", "title", "due_date"],
        },
      ],
    })) as any; // Type assertion for Sequelize include

    if (!submission) {
      return res
        .status(404)
        .json({ success: false, message: "Submission not found" });
    }

    // Check if user owns the submission or is instructor/admin
    if (
      submission.student_id !== userId &&
      (req as any).user.role !== "instructor" &&
      (req as any).user.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this submission",
      });
    }

    // Check if assignment is still open for submissions
    if (submission.Assignment) {
      if (isPastDate(submission.Assignment.due_date)) {
        return res.status(400).json({
          success: false,
          message: "Cannot delete submission after the due date",
        });
      }
    }

    await submission.destroy();

    res.status(200).json({
      success: true,
      message: "Submission deleted successfully",
      data: {},
    });
  } catch (error) {
    console.error("Delete submission error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Download submission file
// @route   GET /api/submissions/:id/files/:fileId
// @access  Private
export const downloadFile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const submission = await Submission.findByPk(req.params.id);

    if (!submission) {
      return res
        .status(404)
        .json({ success: false, message: "Submission not found" });
    }

    // Check if user owns the submission or is instructor/admin
    if (
      submission.student_id !== userId &&
      (req as any).user.role !== "instructor" &&
      (req as any).user.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to download this file",
      });
    }

    // Parse file_submissions JSON if it's stored as a string
    let fileSubmissions = submission.file_submissions;
    if (typeof fileSubmissions === "string") {
      try {
        fileSubmissions = JSON.parse(fileSubmissions);
      } catch (error) {
        console.error("Error parsing file_submissions JSON:", error);
        return res
          .status(500)
          .json({ success: false, message: "Invalid file submissions data" });
      }
    }

    // Parse file_submissions JSON
    if (!fileSubmissions || fileSubmissions.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No files attached to this submission",
      });
    }

    // The fileId parameter now contains the extracted filename from the frontend
    const fileName = decodeURIComponent(req.params.fileId);

    if (!fileName) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid filename" });
    }

    // Find the file in the uploads directory
    const uploadsDir = path.join(__dirname, "../../uploads");
    const fullFilePath = path.join(uploadsDir, fileName);

    // Check if file exists
    if (!fs.existsSync(fullFilePath)) {
      return res
        .status(404)
        .json({ success: false, message: "File not found on server" });
    }

    // Find the corresponding file metadata from the submission
    const fileSubmission = fileSubmissions.find(
      (file: any) => file.filename === fileName,
    );

    const originalName = fileSubmission?.originalname || fileName;
    const mimeType = fileSubmission?.mimetype || "application/octet-stream";

    // Set appropriate headers and send the file
    res.setHeader("Content-Type", mimeType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${originalName}"`,
    );

    // Stream the file
    const fileStream = fs.createReadStream(fullFilePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error("Download file error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Grade submission
// @route   PATCH /api/submissions/:id/grade
// @access  Private/Instructor
export const gradeSubmission = async (req: Request, res: Response) => {
  try {
    const { score, maxScore, feedback, rubricScores } = req.body;
    const userId = (req as any).user.id;

    const submission = (await Submission.findByPk(req.params.id, {
      include: [
        {
          model: Assignment,
          attributes: ["id", "title", "course_id", "max_score"],
        },
      ],
    })) as any;

    if (!submission) {
      return res
        .status(404)
        .json({ success: false, message: "Submission not found" });
    }

    // Check if user is instructor or admin
    if (
      (req as any).user.role !== "instructor" &&
      (req as any).user.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to grade submissions",
      });
    }

    // Get maxScore from assignment if not provided in request
    const finalMaxScore =
      maxScore ||
      (submission.Assignment?.max_score
        ? parseInt(submission.Assignment.max_score)
        : null);

    // Validate grade data
    if (typeof score !== "number" || score < 0) {
      return res.status(400).json({
        success: false,
        message: "Score must be a non-negative number",
      });
    }

    if (!finalMaxScore || finalMaxScore <= 0) {
      return res.status(400).json({
        success: false,
        message: "Max score must be a positive number",
      });
    }

    if (score > finalMaxScore) {
      return res
        .status(400)
        .json({ success: false, message: "Score cannot exceed max score" });
    }

    // Create grade string in the format expected by frontend (e.g., "85/100")
    const gradeString = `${score}/${finalMaxScore}`;

    // Update submission - use update directly to avoid validation issues
    await Submission.update(
      {
        grade: gradeString,
        status: "graded",
        feedback: feedback || submission.feedback,
        rubric_scores: rubricScores || null,
        updated_at: new Date(),
      },
      {
        where: { id: req.params.id },
      },
    );

    // Fetch the updated submission to return
    const updatedSubmission = (await Submission.findByPk(req.params.id, {
      include: [
        {
          model: Assignment,
          attributes: ["id", "title", "course_id", "max_score"],
        },
      ],
    })) as any;

    res.status(200).json({
      success: true,
      message: "Submission graded successfully",
      data: updatedSubmission,
    });
  } catch (error) {
    console.error("Grade submission error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Add comment to submission
// @route   POST /api/submissions/:id/comments
// @access  Private
export const addComment = async (req: Request, res: Response) => {
  try {
    const { content } = req.body;
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;

    if (!content || !content.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Comment content is required" });
    }

    const submission = await Submission.findByPk(req.params.id);

    if (!submission) {
      return res
        .status(404)
        .json({ success: false, message: "Submission not found" });
    }

    // Check if user is student who owns submission or is instructor/admin
    if (
      submission.student_id !== userId &&
      userRole !== "instructor" &&
      userRole !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to comment on this submission",
      });
    }

    // Get current comments
    let currentComments = submission.comments || [];
    if (typeof currentComments === "string") {
      try {
        currentComments = JSON.parse(currentComments);
      } catch (e) {
        currentComments = [];
      }
    }

    // Create new comment
    const newComment = {
      author: `${(req as any).user.first_name} ${(req as any).user.last_name}`,
      authorId: userId,
      content,
      createdAt: new Date().toISOString(),
      isInstructor: userRole !== "student",
    };

    // Update submission
    await Submission.update(
      {
        comments: [...currentComments, newComment],
      },
      {
        where: { id: req.params.id },
      },
    );

    // Fetch updated submission
    const updatedSubmission = await Submission.findByPk(req.params.id);

    res.status(200).json({
      success: true,
      data: updatedSubmission,
    });
  } catch (error) {
    console.error("Add comment error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

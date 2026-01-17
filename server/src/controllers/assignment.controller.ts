import { Request, Response } from "express";
import { Assignment, Submission, User } from "../models";
import { sequelize } from "../config/database";
import {
  parseLocalDateTimeToUTC,
  formatUTCToLocal,
  isPastDate,
} from "../utils/dateUtils";
import axios from "axios";
import { getMisToken } from "../utils/misUtils";

// @desc    Get assignments for a specific course
// @route   GET /api/courses/:courseId/assignments
// @access  Private
export const getCourseAssignments = async (req: Request, res: Response) => {
  try {
    const { courseId } = req.params;

    const assignments = await Assignment.findAll({
      where: { course_id: courseId },
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["id", "first_name", "last_name"],
        },
        {
          model: Submission,
          include: [
            {
              model: User,
              as: "student",
              attributes: ["id", "first_name", "last_name", "profile_image"],
            },
          ],
        },
      ],
      attributes: [
        "id",
        "title",
        "description",
        "due_date",
        "max_score",
        "submission_type",
        "status",
        "created_by",
      ],
      order: [["due_date", "ASC"]],
    });

    res
      .status(200)
      .json({ success: true, count: assignments.length, data: assignments });
  } catch (error) {
    console.error("Get course assignments error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getAssignments = async (req: Request, res: Response) => {
  try {
    const assignments = await Assignment.findAll();
    res
      .status(200)
      .json({ success: true, count: assignments.length, data: assignments });
  } catch (error) {
    console.error("Get assignments error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Get single assignment
// @route   GET /api/assignments/:id
// @access  Public
export const getAssignment = async (req: Request, res: Response) => {
  try {
    const assignment = await Assignment.findByPk(req.params.id);

    if (!assignment) {
      return res
        .status(404)
        .json({ success: false, message: "Assignment not found" });
    }

    res.status(200).json({ success: true, data: assignment });
  } catch (error) {
    console.error("Get assignment error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Create assignment
// @route   POST /api/courses/:courseId/assignments
// @access  Private/Instructor/Admin
export const createAssignment = async (req: Request, res: Response) => {
  try {
    const {
      title,
      description,
      due_date,
      max_score,
      submission_type = "both",
      course_id, // Allow course_id from body for flexibility
    } = req.body;
    const { courseId } = req.params;

    // Use courseId from params or body
    const finalCourseId = courseId || course_id;

    if (!finalCourseId) {
      return res.status(400).json({
        success: false,
        message: "Course ID is required",
      });
    }

    // Convert due_date from local time string to UTC Date object
    let utcDueDate: Date;
    try {
      // Check if due_date is already a Date object (from middleware) or still a string
      if (typeof due_date === "string") {
        utcDueDate = parseLocalDateTimeToUTC(due_date);
      } else if (due_date instanceof Date) {
        utcDueDate = due_date; // Already converted by middleware
      } else {
        throw new Error("Invalid due_date format");
      }
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: "Invalid due date format. Please use YYYY-MM-DDTHH:mm format.",
      });
    }

    // Validate required fields
    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: "Assignment title is required",
      });
    }

    if (!description || !description.trim()) {
      return res.status(400).json({
        success: false,
        message: "Assignment description is required",
      });
    }

    if (!max_score || max_score < 0) {
      return res.status(400).json({
        success: false,
        message: "Valid maximum score is required",
      });
    }

    // Validate submission_type
    const validSubmissionTypes = ["file", "text", "both"];
    if (!validSubmissionTypes.includes(submission_type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid submission type. Must be one of: ${validSubmissionTypes.join(
          ", "
        )}`,
      });
    }

    const assignment = await Assignment.create({
      title: title.trim(),
      description: description.trim(), // Rich text HTML content is stored as-is
      due_date: utcDueDate,
      max_score: parseFloat(max_score),
      course_id: parseInt(finalCourseId),
      submission_type,
      created_by: req.user.id,
    } as any); // Cast to any to allow status field

    res.status(201).json({
      success: true,
      message: "Assignment created successfully",
      data: assignment,
    });
  } catch (error: any) {
    console.error("Create assignment error:", error);

    // Handle Sequelize validation errors
    if (error?.name === "SequelizeValidationError") {
      const messages = error.errors?.map((err: any) => err.message) || [
        "Validation error",
      ];
      return res.status(400).json({
        success: false,
        message: messages.join(", "),
      });
    }

    // Handle Sequelize unique constraint errors
    if (error?.name === "SequelizeUniqueConstraintError") {
      return res.status(400).json({
        success: false,
        message: "An assignment with this title already exists in this course",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to create assignment. Please try again.",
    });
  }
};

// @desc    Update assignment
// @route   PUT /api/assignments/:id
// @access  Private/Instructor/Admin (must be course instructor)
export const updateAssignment = async (req: Request, res: Response) => {
  try {
    const {
      title,
      description,
      due_date,
      max_score,
      submission_type,
      allowed_file_types,
      rubric,
      status,
    } = req.body;

    const assignment = await Assignment.findByPk(req.params.id);

    if (!assignment) {
      return res
        .status(404)
        .json({ success: false, message: "Assignment not found" });
    }

    // Update fields if provided
    if (title !== undefined) assignment.title = title;
    if (description !== undefined) assignment.description = description;
    if (due_date !== undefined) {
      // Convert due_date from local time string to UTC Date object
      try {
        // Check if due_date is already a Date object (from middleware) or still a string
        if (typeof due_date === "string") {
          assignment.due_date = parseLocalDateTimeToUTC(due_date);
        } else if (due_date instanceof Date) {
          assignment.due_date = due_date; // Already converted by middleware
        } else {
          throw new Error("Invalid due_date format");
        }
      } catch (error) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid due date format. Please use YYYY-MM-DDTHH:mm format.",
        });
      }
    }
    if (max_score !== undefined) assignment.max_score = max_score;
    if (submission_type !== undefined)
      assignment.submission_type = submission_type;
    if (allowed_file_types !== undefined)
      assignment.allowed_file_types = allowed_file_types;
    if (rubric !== undefined) assignment.rubric = rubric;
    if (status !== undefined) {
      const validStatuses = ["draft", "published", "completed", "removed"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Must be one of: ${validStatuses.join(
            ", "
          )}`,
        });
      }
      assignment.status = status;
    }

    await assignment.save();

    // Fetch updated assignment with course info
    const updatedAssignment = await Assignment.findByPk(req.params.id);

    res.status(200).json({ success: true, data: updatedAssignment });
  } catch (error) {
    console.error("Update assignment error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Delete assignment
// @route   DELETE /api/assignments/:id
// @access  Private/Instructor/Admin
export const deleteAssignment = async (req: Request, res: Response) => {
  try {
    const assignment = await Assignment.findByPk(req.params.id);

    if (!assignment) {
      return res
        .status(404)
        .json({ success: false, message: "Assignment not found" });
    }

    await assignment.destroy();

    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    console.error("Delete assignment error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Publish assignment
// @route   PUT /api/assignments/:id/publish
// @access  Private/Instructor/Admin
export const publishAssignment = async (req: Request, res: Response) => {
  try {
    const assignment = await Assignment.findByPk(req.params.id);

    if (!assignment) {
      return res
        .status(404)
        .json({ success: false, message: "Assignment not found" });
    }

    // Assignment is already published by default, just return success
    res.status(200).json({ success: true, data: assignment });
  } catch (error) {
    console.error("Publish assignment error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Get assignment submissions
// @route   GET /api/assignments/:id/submissions
// @access  Private - Students (own submission only), Instructors/Admins (all submissions)
export const getAssignmentSubmissions = async (req: Request, res: Response) => {
  try {
    const assignment = await Assignment.findByPk(req.params.id);

    if (!assignment) {
      return res
        .status(404)
        .json({ success: false, message: "Assignment not found" });
    }

    // Get all existing submissions for this assignment
    const existingSubmissions = await Submission.findAll({
      where: {
        assignment_id: req.params.id,
      },
      include: [
        {
          model: User,
          attributes: [
            "id",
            "first_name",
            "last_name",
            "email",
            "profile_image",
          ],
        },
      ],
    });

    // If user is a student, return only their own submission
    if (req.user.role === "student") {
      const userSubmission = existingSubmissions.find(
        (submission) => String(submission.student_id) === String(req.user.id)
      );

      return res.status(200).json({
        success: true,
        count: userSubmission ? 1 : 0,
        data: userSubmission ? [userSubmission] : [],
      });
    }

    // For instructors and admins, get all enrolled students and create comprehensive submission list
    const token = getMisToken(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "MIS authentication required",
      });
    }

    // Get all students enrolled in the course (subject) from NGA MIS
    let enrolledStudents = [];
    try {
      const studentsResponse = await axios.get(
        `${process.env.NGA_MIS_BASE_URL}/academics/subjects/${assignment.course_id}/terms/4/students`,
        {
          headers: {
            Authorization: token,
            "Content-Type": "application/json",
          },
        }
      );

      if (studentsResponse.data.success) {
        enrolledStudents = studentsResponse.data.data || [];
      }
    } catch (enrollmentError: any) {
      console.warn(
        "Could not fetch enrolled students from NGA MIS:",
        enrollmentError.message
      );
      // Continue with existing submissions only
    }

    // Create a map of existing submissions by student_id for quick lookup
    const submissionsMap = new Map();
    existingSubmissions.forEach((submission) => {
      submissionsMap.set(submission.student_id, submission);
    });

    // Create comprehensive submission list including non-submitters
    const allSubmissions = enrolledStudents.map((student: any) => {
      const existingSubmission = submissionsMap.get(student.id);

      if (existingSubmission) {
        // Student has submitted - return the actual submission
        return existingSubmission;
      } else {
        // Student hasn't submitted - create a placeholder submission object
        return {
          id: null,
          assignment_id: parseInt(req.params.id),
          student_id: student.id,
          status: "pending",
          submitted_at: null,
          text_submission: null,
          file_submissions: null,
          grade: null,
          feedback: null,
          resubmissions: null,
          is_late: false,
          comments: null,
          createdAt: null,
          updatedAt: null,
          student: {
            id: student.id,
            first_name: student.first_name || student.firstName,
            last_name: student.last_name || student.lastName,
            email: student.email,
            profile_image: student.profile_image || student.profileImage,
          },
          // Add a flag to indicate this is a placeholder for non-submitters
          _isPlaceholder: true,
        };
      }
    });

    res.status(200).json({
      success: true,
      count: allSubmissions.length,
      data: allSubmissions,
    });
  } catch (error) {
    console.error("Get assignment submissions error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Get enrolled assignments for student
// @route   GET /api/assignments/enrolled
// @access  Private/Student
export const getEnrolledAssignments = async (req: Request, res: Response) => {
  try {
    // Check if user is authenticated and is a student
    if (!req.user) {
      return res
        .status(401)
        .json({ success: false, message: "Not authenticated" });
    }

    if (req.user.role !== "student") {
      return res
        .status(403)
        .json({ success: false, message: "Access denied. Students only." });
    }

    // Get all published assignments (since we can't check enrollments locally)
    const assignments = await Assignment.findAll({
      where: {
        status: "published",
      },
      order: [["due_date", "ASC"]],
    });

    res.status(200).json({
      success: true,
      count: assignments.length,
      data: assignments,
    });
  } catch (error) {
    console.error("Get enrolled assignments error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Update assignment status
// @route   PATCH /api/assignments/:id/status
// @access  Private/Instructor/Admin
export const updateAssignmentStatus = async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const { id } = req.params;

    // Validate status
    const validStatuses = ["draft", "published", "completed", "removed"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      });
    }

    const assignment = await Assignment.findByPk(id);

    if (!assignment) {
      return res
        .status(404)
        .json({ success: false, message: "Assignment not found" });
    }

    // Update the status
    assignment.status = status;
    await assignment.save();

    res.status(200).json({ success: true, data: assignment });
  } catch (error) {
    console.error("Update assignment status error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
// @desc    Submit assignment
// @route   POST /api/assignments/:id/submit
// @access  Private/Student
export const submitAssignment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // 1. Check if user is authenticated and is a student
    if (!req.user) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication required" });
    }

    if (req.user.role !== "student") {
      return res.status(403).json({
        success: false,
        message: "Only students can submit assignments",
      });
    }

    // 2. Check if assignment exists
    const assignment = await Assignment.findByPk(id);
    if (!assignment) {
      return res
        .status(404)
        .json({ success: false, message: "Assignment not found" });
    }

    // 3. Check if assignment is published
    if (assignment.status !== "published") {
      return res.status(400).json({
        success: false,
        message: "Assignment is not published. Cannot submit.",
      });
    }

    // 4. Skip enrollment check since course IDs come from external API

    // 5. Check if assignment is still open for submissions (compare UTC times)
    const now = new Date();
    if (isPastDate(assignment.due_date)) {
      return res.status(400).json({
        success: false,
        message:
          "Assignment deadline has passed. Submissions are no longer accepted.",
      });
    }

    // 6. Check if student has already submitted
    const existingSubmission = await Submission.findOne({
      where: {
        assignment_id: id,
        student_id: req.user.id,
      },
    });

    if (existingSubmission) {
      return res.status(400).json({
        success: false,
        message:
          "You have already submitted this assignment. Multiple submissions are not allowed.",
      });
    }

    // 7. Validate submission content
    const text_submission = req.body.text_submission;
    const file_submission = (req as any).file?.path;

    console.log("Submission validation:", {
      text_submission,
      file_submission,
      hasText: !!text_submission,
      hasFile: !!file_submission,
      reqFile: (req as any).file,
      reqBody: req.body,
    });

    if (!text_submission && !file_submission) {
      return res.status(400).json({
        success: false,
        message: "Please provide either text submission or file submission.",
      });
    }

    // Create submission
    const submission = await Submission.create({
      assignment_id: parseInt(id),
      student_id: req.user.id,
      text_submission: text_submission || null,
      file_submissions: file_submission
        ? [
            {
              filename:
                (req as any).file?.originalname ||
                file_submission.split("/").pop() ||
                "submission",
              originalname:
                (req as any).file?.originalname ||
                file_submission.split("/").pop() ||
                "submission",
              path: file_submission,
              size: (req as any).file?.size || 0,
              mimetype:
                (req as any).file?.mimetype || "application/octet-stream",
            },
          ]
        : null,
      status: "submitted",
      submitted_at: new Date(),
      is_late: isPastDate(assignment.due_date),
    });

    res.status(201).json({
      success: true,
      message: "Assignment submitted successfully",
      data: submission,
    });
  } catch (error) {
    console.error("Submit assignment error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Delete student's own submission
// @route   DELETE /api/submissions/:id
// @access  Private/Student (own submission only)
export const deleteSubmission = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if submission exists and belongs to the authenticated student
    const submission = await Submission.findByPk(id);

    if (!submission) {
      return res
        .status(404)
        .json({ success: false, message: "Submission not found" });
    }

    // Ensure only the student who submitted can delete their own submission
    if (submission.student_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own submissions",
      });
    }

    // Check if assignment is still open for submissions
    const assignment = await Assignment.findByPk(submission.assignment_id);
    if (!assignment) {
      return res
        .status(404)
        .json({ success: false, message: "Assignment not found" });
    }

    const now = new Date();
    if (isPastDate(assignment.due_date)) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete submission after the due date",
      });
    }

    // Delete the submission
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

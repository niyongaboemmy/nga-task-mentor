import { Request, Response } from "express";
import { Op } from "sequelize";
import axios from "axios";
import path from "path";
import fs from "fs";
import { getMisToken } from "../utils/misUtils";
import { Submission, Assignment, QuizSubmission, Quiz } from "../models";

// @desc    Get all users
// @route   GET /api/users
// @access  Private/Admin
export const getUsers = async (req: Request, res: Response) => {
  try {
    const {
      role,
      page = 1,
      limit = 100,
      search,
      subjectId,
      termId,
    } = req.query;
    const token = getMisToken(req);
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // Build query parameters
    let params: any = {
      page,
      limit,
    };

    // Determine MIS endpoint based on role and requester
    let endpoint = "/users/";

    if (req.user.role === "instructor" && role === "student") {
      if (subjectId) {
        // Use the specific academic endpoint provided by the user
        const activeTermId = termId || 4;
        endpoint = `/academics/subjects/${subjectId}/terms/${activeTermId}/students`;
      } else if (search) {
        // Instructors use the search endpoint for students if they have a query
        endpoint = "/users/search";
        params.roleId = 6; // MIS Student Role ID
        params.q = search;
      } else {
        // If an instructor tries to fetch students without a course or search term,
        // we can't use /users/ (forbidden) or /users/search (requires query).
        // Return 200 with empty data and a message instead of letting it fail.
        return res.status(200).json({
          success: true,
          count: 0,
          data: [],
          message:
            "Please select a course or enter a search term to view students.",
        });
      }
    } else if (search) {
      // Admins using the regular users endpoint
      params.search = search;
    }

    // Role filtering will be done after fetching from MIS for the main endpoint,
    // but the search and academic endpoints above already filter by role.
    if (role && endpoint === "/users/") {
      // Non-admin users have restrictions on the main endpoint
      if (req.user.role !== "admin") {
        if (role !== "student" || req.user.role !== "instructor") {
          return res.status(403).json({
            success: false,
            message: "Not authorized to access this resource",
          });
        }
      }
    }
    const response = await axios.get<{
      success: boolean;
      message: string;
      data: {
        user_id: string;
        username: string;
        first_name: string;
        last_name: string;
        gender: string;
        class_group_name: string;
        grade_name: string;
        program_name: string;
        enrolled_at: string;
      }[];
    }>(`${process.env.NGA_MIS_BASE_URL}${endpoint}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      params,
      // Enforce HTTPS in production
      httpsAgent:
        process.env.NODE_ENV === "production"
          ? new (require("https").Agent)({ rejectUnauthorized: true })
          : undefined,
    });

    if (response.data.data && response.data.data.length > 0) {
      const users = response.data.data;
      res.status(200).json({
        success: true,
        count: users.length,
        data: users,
        // meta: response.data.meta,
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Failed to fetch users from MIS",
      });
    }
  } catch (error: any) {
    console.error("Get users error:", error.response?.data || error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Get single user
// @route   GET /api/users/:id
// @access  Private/Admin
export const getUser = async (req: Request, res: Response) => {
  try {
    const token = getMisToken(req);
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const response = await axios.get(
      `${process.env.NGA_MIS_BASE_URL}/users/${req.params.id}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        // Enforce HTTPS in production
        httpsAgent:
          process.env.NODE_ENV === "production"
            ? new (require("https").Agent)({ rejectUnauthorized: true })
            : undefined,
      },
    );

    if (response.data.success) {
      res.status(200).json({ success: true, data: response.data.data });
    } else {
      res.status(404).json({ success: false, message: "User not found" });
    }
  } catch (error: any) {
    console.error("Get user error:", error.response?.data || error.message);
    if (error.response?.status === 404) {
      res.status(404).json({ success: false, message: "User not found" });
    } else {
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
};

// @desc    Get user's enrolled courses
// @route   GET /api/users/:userId/courses
// @access  Private/Admin/Instructor
export const getUserCourses = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const token = getMisToken(req);
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // Only admins and instructors can view user courses
    if (req.user.role !== "admin" && req.user.role !== "instructor") {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this user's courses",
      });
    }

    // Fetch user's enrolled subjects from MIS API
    const response = await axios.get(
      `${process.env.NGA_MIS_BASE_URL}/academics/students/${userId}/enrolled-subjects`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        // Enforce HTTPS in production
        httpsAgent:
          process.env.NODE_ENV === "production"
            ? new (require("https").Agent)({ rejectUnauthorized: true })
            : undefined,
      },
    );

    if (response.data.success) {
      const courses = response.data.data || [];
      res.status(200).json({
        success: true,
        count: courses.length,
        data: courses,
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Failed to fetch user courses from MIS",
      });
    }
  } catch (error: any) {
    console.error(
      "Get user courses error:",
      error.response?.data || error.message,
    );
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Create user
// @route   POST /api/users
// @access  Private/Admin
export const createUser = async (req: Request, res: Response) => {
  try {
    const { first_name, last_name, email, roleIds } = req.body;

    const token = getMisToken(req);
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // Input validation is now handled by middleware (see validation.middleware.ts)
    // but the controller handles the MIS integration securely

    const response = await axios.post(
      `${process.env.NGA_MIS_BASE_URL}/users/`,
      {
        email,
        firstName: first_name,
        lastName: last_name,
        roleIds: roleIds || [],
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        // Enforce HTTPS in production
        httpsAgent:
          process.env.NODE_ENV === "production"
            ? new (require("https").Agent)({ rejectUnauthorized: true })
            : undefined,
      },
    );

    if (response.data.success) {
      res.status(201).json({
        success: true,
        data: response.data.data,
      });
    } else {
      res.status(400).json({
        success: false,
        message: response.data.message || "Failed to create user",
      });
    }
  } catch (error: any) {
    console.error("Create user error:", error.response?.data || error.message);
    if (error.response?.status === 400) {
      res.status(400).json({
        success: false,
        message: error.response.data.message || "User already exists",
      });
    } else {
      // Sanitize error in production
      const message =
        process.env.NODE_ENV === "production"
          ? "Failed to create user"
          : error.response?.data?.message || "Server error";
      res.status(500).json({ success: false, message });
    }
  }
};

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private/Admin
export const updateUser = async (req: Request, res: Response) => {
  try {
    const { first_name, last_name, email } = req.body;

    const token = getMisToken(req);
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const response = await axios.put(
      `${process.env.NGA_MIS_BASE_URL}/users/${req.params.id}`,
      {
        firstName: first_name,
        lastName: last_name,
        email,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        // Enforce HTTPS in production
        httpsAgent:
          process.env.NODE_ENV === "production"
            ? new (require("https").Agent)({ rejectUnauthorized: true })
            : undefined,
      },
    );

    if (response.data.success) {
      res.status(200).json({
        success: true,
        data: response.data.data,
      });
    } else {
      res.status(404).json({ success: false, message: "User not found" });
    }
  } catch (error: any) {
    console.error("Update user error:", error.response?.data || error.message);
    if (error.response?.status === 404) {
      res.status(404).json({ success: false, message: "User not found" });
    } else {
      // Sanitize error in production
      const message =
        process.env.NODE_ENV === "production"
          ? "Failed to update user"
          : error.response?.data?.message || "Server error";
      res.status(500).json({ success: false, message });
    }
  }
};

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private/Admin
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const token = getMisToken(req);
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const response = await axios.delete(
      `${process.env.NGA_MIS_BASE_URL}/users/${req.params.id}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        // Enforce HTTPS in production
        httpsAgent:
          process.env.NODE_ENV === "production"
            ? new (require("https").Agent)({ rejectUnauthorized: true })
            : undefined,
      },
    );

    if (response.data.success) {
      res.status(200).json({ success: true, data: {} });
    } else {
      res.status(404).json({ success: false, message: "User not found" });
    }
  } catch (error: any) {
    console.error("Delete user error:", error.response?.data || error.message);
    if (error.response?.status === 404) {
      res.status(404).json({ success: false, message: "User not found" });
    } else {
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
};

// Note: Course enrollment is managed through the MIS system
// These endpoints are kept for backward compatibility but should ideally
// be handled through the MIS API's enrollment endpoints

// @desc    Enroll user in course
// @route   POST /api/users/:userId/enroll/:courseId
// @access  Private/Admin
export const enrollInCourse = async (req: Request, res: Response) => {
  try {
    // Course enrollment should be managed through MIS API
    // This is a placeholder for backward compatibility
    res.status(501).json({
      success: false,
      message: "Course enrollment is managed through the MIS system",
    });
  } catch (error) {
    console.error("Enroll in course error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Withdraw user from course
// @route   DELETE /api/users/:userId/enroll/:courseId
// @access  Private/Admin
export const withdrawFromCourse = async (req: Request, res: Response) => {
  try {
    // Course withdrawal should be managed through MIS API
    // This is a placeholder for backward compatibility
    res.status(501).json({
      success: false,
      message: "Course withdrawal is managed through the MIS system",
    });
  } catch (error) {
    console.error("Withdraw from course error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
// @desc    Get user profile picture
// @route   GET /api/users/profile-picture/:filename
// @access  Public
export const getProfilePicture = async (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(
      __dirname,
      "../../uploads/profile-pictures",
      filename,
    );

    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).json({ success: false, message: "Image not found" });
    }
  } catch (error) {
    console.error("Get profile picture error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Get student's assignments and submissions
// @route   GET /api/users/:userId/assignments
// @access  Private/Admin/Instructor
export const getStudentAssignments = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const token = getMisToken(req);
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // Fetch user's enrolled subjects from MIS API to know which assignments to show
    const misResponse = await axios.get(
      `${process.env.NGA_MIS_BASE_URL}/academics/students/${userId}/enrolled-subjects`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );

    const enrolledSubjects = misResponse.data.success
      ? misResponse.data.data || []
      : [];
    const courseIds = enrolledSubjects
      .map((s: any) => Number(s.subject_id))
      .filter((id: number) => !isNaN(id));

    // Fetch all assignments for these courses and include student's submission if it exists
    const assignments = await Assignment.findAll({
      where: {
        course_id: { [Op.in]: courseIds },
        status: { [Op.in]: ["published", "completed"] },
      },
      include: [
        {
          model: Submission,
          as: "assignmentSubmissions",
          where: { student_id: Number(userId) },
          required: false, // Left join to show assignments even without submissions
        },
      ],
      order: [["due_date", "DESC"]],
    });

    // Map subject info onto assignments
    const data = assignments.map((assignment: any) => {
      const subject = enrolledSubjects.find(
        (s: any) => Number(s.subject_id) === Number(assignment.course_id),
      );
      return {
        ...assignment.toJSON(),
        subject: subject
          ? {
              subject_name: subject.subject_name,
              subject_code: subject.subject_code,
              subject_description: subject.subject_description,
            }
          : null,
      };
    });

    res.status(200).json({
      success: true,
      count: data.length,
      data: data,
    });
  } catch (error: any) {
    console.error("Get student assignments error:", error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Get student's quiz submissions
// @route   GET /api/users/:userId/quizzes
// @access  Private/Admin/Instructor
export const getStudentQuizzes = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const token = getMisToken(req);
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // Fetch user's enrolled subjects from MIS API
    const misResponse = await axios.get(
      `${process.env.NGA_MIS_BASE_URL}/academics/students/${userId}/enrolled-subjects`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );

    const enrolledSubjects = misResponse.data.success
      ? misResponse.data.data || []
      : [];
    const courseIds = enrolledSubjects
      .map((s: any) => Number(s.subject_id))
      .filter((id: number) => !isNaN(id));

    // Fetch all quizzes for these courses and include student's submission if it exists
    const quizzes = await Quiz.findAll({
      where: {
        course_id: { [Op.in]: courseIds },
        // status: { [Op.in]: ["published", "completed"] },
      },
      include: [
        {
          model: QuizSubmission,
          as: "quizSubmissions",
          where: { student_id: Number(userId) },
          required: false, // Left join
        },
      ],
      order: [["created_at", "DESC"]],
    });

    // Map subject info onto quizzes
    const data = quizzes.map((quiz: any) => {
      const subject = enrolledSubjects.find(
        (s: any) => Number(s.subject_id) === Number(quiz.course_id),
      );
      return {
        ...quiz.toJSON(),
        subject: subject
          ? {
              subject_name: subject.subject_name,
              subject_code: subject.subject_code,
              subject_description: subject.subject_description,
            }
          : null,
      };
    });

    res.status(200).json({
      success: true,
      count: data.length,
      data: data,
    });
  } catch (error: any) {
    console.error("Get student quizzes error:", error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

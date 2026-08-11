import { Request, Response } from "express";
import { Op } from "sequelize";
import axios from "axios";
import fs from "fs";
import path from "path";
import fileServer from "../utils/fileServer";
import {
  getMisToken,
  handleMisError,
  resolveAcademicYearId,
  resolveAcademicTermId,
} from "../utils/misUtils";
import { Submission, Assignment, QuizSubmission, Quiz, User } from "../models";

// MIS role IDs (see nga_central_mis Role table) — used to filter the generic
// /users/ endpoint via its `userRole` query param.
const MIS_ROLE_IDS: Record<string, number> = {
  student: 6,
};

// The generic MIS /users/ endpoint returns `{ user, profile, roles, permissions }`
// per record (names live under `profile`), while the rest of this app (e.g. the
// admin Students list) expects a flat `{ first_name, last_name, ... }` shape —
// the same flat shape course.controller.ts::getCourse already produces when it
// maps MIS enrollment data. Normalize here so every caller of getUsers gets a
// consistent, flat contract regardless of which MIS endpoint served it.
function flattenMisUser(entry: any) {
  if (!entry || typeof entry !== "object") return entry;
  // Already flat (e.g. the /academics/subjects/:id/terms/:id/students endpoint).
  if (!entry.user && !entry.profile) return entry;

  const user = entry.user || {};
  const profile = entry.profile || {};
  return {
    user_id: user.user_id ?? user.id ?? "",
    username: user.username ?? user.email ?? "",
    first_name: profile.first_name ?? user.first_name ?? "",
    last_name: profile.last_name ?? user.last_name ?? "",
    gender: profile.gender ?? "",
    class_group_name: profile.class_group_name ?? "",
    grade_name: profile.grade_name ?? "",
    program_name: profile.program_name ?? "",
    enrolled_at: user.created_at ?? "",
  };
}

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
      if (subjectId && termId) {
        // Use the specific academic endpoint provided by the user
        endpoint = `/academics/subjects/${subjectId}/terms/${termId}/students`;
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

      // Forward the role filter to MIS so /users/ doesn't return every role
      // mixed together — MIS expects a numeric `userRole` (role id), not a name.
      const misRoleId = MIS_ROLE_IDS[role as string];
      if (misRoleId) {
        params.userRole = misRoleId;
      }
    }
    const response = await axios.get<{
      success: boolean;
      message: string;
      data: any[];
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

    const rawUsers = response.data.data ?? [];
    // /users/ returns nested { user, profile }; other endpoints are already
    // flat. flattenMisUser is a no-op for records that are already flat.
    const users =
      endpoint === "/users/" ? rawUsers.map(flattenMisUser) : rawUsers;

    res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error: any) {
    if (error.response?.status === 404) {
      return res.status(200).json({ success: true, count: 0, data: [] });
    }
    return handleMisError(error, res, "Error fetching users");
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

    // IDOR Protection: Users can only view their own profile unless they are admin/instructor
    if (
      req.user.id.toString() !== req.params.id &&
      req.user.role !== "admin" &&
      req.user.role !== "instructor"
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to access this user profile",
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
    if (error.response?.status === 404) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    return handleMisError(error, res, "Error fetching user profile");
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

    // Fetch user's enrolled subjects from MIS API, scoped to the selected
    // academic year (otherwise MIS returns every enrollment across every
    // year the student has ever had).
    const userCoursesYearId = await resolveAcademicYearId(req);
    const response = await axios.get(
      `${process.env.NGA_MIS_BASE_URL}/academics/students/${userId}/enrolled-subjects`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        params: userCoursesYearId
          ? { academic_year_id: userCoursesYearId }
          : {},
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
    return handleMisError(error, res, "Error fetching user courses");
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
    if (error.response?.status === 400) {
      return res.status(400).json({
        success: false,
        message: error.response.data.message || "User already exists",
      });
    }
    return handleMisError(error, res, "Error creating user");
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
    if (error.response?.status === 404) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    return handleMisError(error, res, "Error updating user");
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
    const found = await fileServer.streamTo(
      `profile-pictures/${filename}`,
      res,
    );
    if (found) return;

    // Pre-migration profile pictures were written directly to local disk.
    const legacyPath = path.join(
      __dirname,
      "../../uploads/profile-pictures",
      filename,
    );
    if (fs.existsSync(legacyPath)) {
      return res.sendFile(legacyPath);
    }
    res.status(404).json({ success: false, message: "Image not found" });
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

    // IDOR Protection
    if (
      req.user.id.toString() !== userId &&
      req.user.role !== "admin" &&
      req.user.role !== "instructor"
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view these assignments",
      });
    }

    // userId from URL is the MIS user ID — find the matching local user record
    const localUser = await User.findOne({ where: { mis_user_id: Number(userId) } });
    const localStudentId = localUser?.id ?? null;

    // Fetch enrolled subjects from MIS — treat any failure as empty enrollment.
    // Scoped to the selected academic year (otherwise MIS returns every
    // enrollment across every year the student has ever had).
    let enrolledSubjects: any[] = [];
    try {
      const enrolledYearId = await resolveAcademicYearId(req);
      const misResponse = await axios.get(
        `${process.env.NGA_MIS_BASE_URL}/academics/students/${userId}/enrolled-subjects`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          params: enrolledYearId ? { academic_year_id: enrolledYearId } : {},
        },
      );
      enrolledSubjects = misResponse.data?.success
        ? misResponse.data.data || []
        : [];
    } catch (misError: any) {
      console.error("MIS enrolled-subjects fetch failed:", misError.message);
      // Non-fatal: student may simply have no enrollment data yet
    }

    const courseIds = enrolledSubjects
      .map((s: any) => Number(s.subject_id))
      .filter((id: number) => !isNaN(id) && id > 0);

    // No enrolled courses → return empty result immediately (avoids Op.in([]) edge case)
    if (courseIds.length === 0) {
      return res.status(200).json({ success: true, count: 0, data: [] });
    }

    // Fetch all assignments for enrolled courses, left-joining the student's
    // submission, scoped to the selected term so other terms' assignments
    // don't show up here.
    const assignmentsTermId = await resolveAcademicTermId(req);
    const assignmentsTermWhere = assignmentsTermId
      ? {
          [Op.or]: [
            { academic_term_id: assignmentsTermId },
            { academic_term_id: null },
          ],
        }
      : undefined;
    const submissionWhere = localStudentId ? { student_id: localStudentId } : undefined;
    const assignments = await Assignment.findAll({
      where: {
        course_id: { [Op.in]: courseIds },
        status: { [Op.in]: ["published", "completed"] },
        ...assignmentsTermWhere,
      },
      include: [
        {
          model: Submission,
          as: "submissions",
          where: submissionWhere,
          required: false,
        },
      ],
      order: [["due_date", "DESC"]],
    });

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

    return res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error: any) {
    console.error("Get student assignments error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
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

    // IDOR Protection
    if (
      req.user.id.toString() !== userId &&
      req.user.role !== "admin" &&
      req.user.role !== "instructor"
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view these quizzes",
      });
    }

    // userId from URL is the MIS user ID — find the matching local user record
    const localUser = await User.findOne({ where: { mis_user_id: Number(userId) } });
    const localStudentId = localUser?.id ?? null;

    // Fetch user's enrolled subjects from MIS API, scoped to the selected
    // academic year (otherwise MIS returns every enrollment across every
    // year the student has ever had).
    const studentQuizzesYearId = await resolveAcademicYearId(req);
    const misResponse = await axios.get(
      `${process.env.NGA_MIS_BASE_URL}/academics/students/${userId}/enrolled-subjects`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        params: studentQuizzesYearId
          ? { academic_year_id: studentQuizzesYearId }
          : {},
      },
    );

    const enrolledSubjects = misResponse.data.success
      ? misResponse.data.data || []
      : [];
    const courseIds = enrolledSubjects
      .map((s: any) => Number(s.subject_id))
      .filter((id: number) => !isNaN(id) && id > 0);

    if (courseIds.length === 0) {
      return res.status(200).json({ success: true, count: 0, data: [] });
    }

    // Fetch all quizzes for these courses, scoped to the selected term, and
    // include the student's submission if it exists.
    const studentQuizzesTermId = await resolveAcademicTermId(req);
    const studentQuizzesTermWhere = studentQuizzesTermId
      ? {
          [Op.or]: [
            { academic_term_id: studentQuizzesTermId },
            { academic_term_id: null },
          ],
        }
      : undefined;
    const quizzes = await Quiz.findAll({
      where: {
        course_id: { [Op.in]: courseIds },
        // status: { [Op.in]: ["published", "completed"] },
        ...studentQuizzesTermWhere,
      },
      include: [
        {
          model: QuizSubmission,
          as: "quizSubmissions",
          where: localStudentId ? { student_id: localStudentId } : undefined,
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

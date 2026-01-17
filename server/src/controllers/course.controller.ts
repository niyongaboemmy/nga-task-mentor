import { Request, Response } from "express";
import axios from "axios";
import { getMisToken, hasMisToken } from "../utils/misUtils";
import { Assignment, Submission, Quiz, QuizSubmission } from "../models";
import { Op } from "sequelize";

// @desc    Get all courses
// @route   GET /api/courses
// @access  Private
export const getCourses = async (req: Request, res: Response) => {
  try {
    const token = getMisToken(req);

    if (!token) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication required" });
    }

    let endpoint = "/academics/subjects"; // Default for admin

    if (req.user?.role === "instructor") {
      endpoint = "/academics/my-assigned-subjects";
    } else if (req.user?.role === "student" && req.user.mis_user_id) {
      endpoint = `/academics/students/${req.user.mis_user_id}/enrolled-subjects`;
    }

    // Call NGA MIS API
    const response = await axios.get(
      `${process.env.NGA_MIS_BASE_URL}${endpoint}`,
      {
        headers: {
          Authorization: token,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data.success) {
      // Map subjects to courses format
      const subjects = response.data.data || [];
      const courses = subjects.map((subject: any) => ({
        id: subject.id || subject.subject_id,
        title: subject.name || subject.subject_name,
        code: subject.code || subject.subject_code,
        description: subject.description,
        credits: 3, // Default credits
        start_date: null,
        end_date: null,
        is_active: true,
        max_students: 50,
        instructor_id: req.user?.role === "instructor" ? req.user.id : null,
        created_at: subject.created_at || new Date().toISOString(),
        updated_at: subject.updated_at || new Date().toISOString(),
        instructor:
          req.user?.role === "instructor"
            ? {
                first_name: req.user.first_name,
                last_name: req.user.last_name,
              }
            : null,
      }));

      res
        .status(200)
        .json({ success: true, count: courses.length, data: courses });
    } else {
      res.status(500).json({
        success: false,
        message: "Failed to fetch subjects from NGA MIS",
      });
    }
  } catch (error: any) {
    console.error("Get courses error:", error.response?.data || error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Get single course
// @route   GET /api/courses/:id
// @access  Public
export const getCourse = async (req: Request, res: Response) => {
  try {
    const token = getMisToken(req);

    if (!token) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication required" });
    }

    // Call NGA MIS API to get subject details
    const subjectResponse = await axios.get(
      `${process.env.NGA_MIS_BASE_URL}/academics/subjects/${req.params.id}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!subjectResponse.data.success) {
      return res
        .status(404)
        .json({ success: false, message: "Course not found" });
    }

    const subject = subjectResponse.data.data;
    if (!subject) {
      return res
        .status(404)
        .json({ success: false, message: "Course not found" });
    }

    // Get enrolled students for this subject and term 4
    let enrolledStudents = [];
    try {
      const studentsResponse = await axios.get(
        `${process.env.NGA_MIS_BASE_URL}/academics/subjects/${req.params.id}/terms/4/students`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (studentsResponse.data.success) {
        enrolledStudents = studentsResponse.data.data || [];
      }
    } catch (enrollmentError: any) {
      console.warn(
        "Could not fetch enrolled students:",
        enrollmentError.message
      );
      // Continue without enrolled students data
    }

    // Get assignments statistics for this course
    let assignmentsStats = {
      total: 0,
      by_status: { draft: 0, published: 0, completed: 0, removed: 0 },
      total_submissions: 0,
      average_submissions_per_assignment: 0,
    };

    try {
      // Get all assignments for this course
      const assignments = await Assignment.findAll({
        where: { course_id: parseInt(req.params.id) },
        include: [
          {
            model: Submission,
            required: false,
          },
        ],
      });

      assignmentsStats.total = assignments.length;

      // Count assignments by status
      assignments.forEach((assignment) => {
        assignmentsStats.by_status[assignment.status] =
          (assignmentsStats.by_status[assignment.status] || 0) + 1;
      });

      // Calculate total submissions
      assignmentsStats.total_submissions = assignments.reduce(
        (total, assignment) => total + (assignment.submissions?.length || 0),
        0
      );

      // Calculate average submissions per assignment
      assignmentsStats.average_submissions_per_assignment =
        assignmentsStats.total > 0
          ? Math.round(
              (assignmentsStats.total_submissions / assignmentsStats.total) *
                100
            ) / 100
          : 0;
    } catch (assignmentError: any) {
      console.warn(
        "Could not fetch assignments statistics:",
        assignmentError.message
      );
      // Continue with empty stats
    }

    // Get quizzes statistics for this course
    let quizzesStats = {
      total: 0,
      by_status: { draft: 0, published: 0, completed: 0 },
      by_type: { practice: 0, graded: 0, exam: 0 },
      total_submissions: 0,
      average_score: 0,
      pass_rate: 0,
    };

    try {
      // Get all quizzes for this course
      const quizzes = await Quiz.findAll({
        where: { course_id: parseInt(req.params.id) },
      });

      quizzesStats.total = quizzes.length;

      // Count quizzes by status and type
      quizzes.forEach((quiz) => {
        quizzesStats.by_status[quiz.status] =
          (quizzesStats.by_status[quiz.status] || 0) + 1;
        quizzesStats.by_type[quiz.type] =
          (quizzesStats.by_type[quiz.type] || 0) + 1;
      });

      // Get all quiz submissions for this course's quizzes
      const quizIds = quizzes.map((quiz) => quiz.id);
      if (quizIds.length > 0) {
        const quizSubmissions = await QuizSubmission.findAll({
          where: { quiz_id: { [Op.in]: quizIds } },
        });

        // Calculate submission statistics
        let totalScore = 0;
        let totalSubmissions = 0;
        let passedCount = 0;

        quizSubmissions.forEach((submission: any) => {
          totalSubmissions++;
          totalScore += submission.percentage;
          if (submission.passed) {
            passedCount++;
          }
        });

        quizzesStats.total_submissions = totalSubmissions;
        quizzesStats.average_score =
          totalSubmissions > 0
            ? Math.round((totalScore / totalSubmissions) * 100) / 100
            : 0;
        quizzesStats.pass_rate =
          totalSubmissions > 0
            ? Math.round((passedCount / totalSubmissions) * 100)
            : 0;
      }
    } catch (quizError: any) {
      console.warn("Could not fetch quizzes statistics:", quizError.message);
      // Continue with empty stats
    }

    // Map subject to course format with statistics
    const course = {
      id: subject.id,
      title: subject.name,
      code: subject.code,
      description: subject.description,
      credits: 3,
      start_date: null,
      end_date: null,
      is_active: true,
      max_students: 50,
      instructor_id: null,
      created_at: subject.created_at || new Date().toISOString(),
      updated_at: subject.updated_at || new Date().toISOString(),
      courseInstructor: null,
      enrolledStudents: enrolledStudents,
      // Add statistics
      statistics: {
        assignments: assignmentsStats,
        quizzes: quizzesStats,
      },
    };

    res.status(200).json({ success: true, data: course });
  } catch (error: any) {
    console.error("Get course error:", error.response?.data || error.message);
    if (error.response?.status === 404) {
      res.status(404).json({ success: false, message: "Course not found" });
    } else if (error.response?.status === 403) {
      // For 403 errors, still return course data but with empty statistics
      // This allows the frontend to show the course exists but user may not have access to detailed MIS data
      console.warn(
        `MIS API returned 403 for course ${req.params.id}, returning basic course data`
      );

      // Return course data with empty statistics since MIS access failed
      const course = {
        id: req.params.id,
        title: `Course ${req.params.id}`,
        code: `COURSE${req.params.id}`,
        description: "Course details unavailable - access restricted",
        credits: 3,
        start_date: null,
        end_date: null,
        is_active: true,
        max_students: 50,
        instructor_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        courseInstructor: null,
        enrolledStudents: [],
        statistics: {
          assignments: {
            total: 0,
            by_status: { draft: 0, published: 0, completed: 0, removed: 0 },
            total_submissions: 0,
            average_submissions_per_assignment: 0,
          },
          quizzes: {
            total: 0,
            by_status: { draft: 0, published: 0, completed: 0 },
            by_type: { practice: 0, graded: 0, exam: 0 },
            total_submissions: 0,
            average_score: 0,
            pass_rate: 0,
          },
        },
      };

      res.status(200).json({ success: true, data: course });
    } else {
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
};

// @desc    Create course
// @route   POST /api/courses
// @access  Private/Instructor/Admin
export const createCourse = async (req: Request, res: Response) => {
  try {
    const token = getMisToken(req);

    if (!token) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication required" });
    }

    const {
      title,
      description,
      code,
      credits,
      start_date,
      end_date,
      max_students = 50,
    } = req.body;

    // Call NGA MIS API to create subject
    const response = await axios.post(
      `${process.env.NGA_MIS_BASE_URL}/academics/subjects`,
      {
        name: title,
        code,
        description,
      },
      {
        headers: {
          Authorization: token,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data.success) {
      const subject = response.data.data;
      // Map back to course format
      const course = {
        id: subject.id,
        title: subject.name,
        code: subject.code,
        description: subject.description,
        credits: credits || 3,
        start_date,
        end_date,
        is_active: true,
        max_students,
        instructor_id: req.user?.id || null,
        created_at: subject.created_at || new Date().toISOString(),
        updated_at: subject.updated_at || new Date().toISOString(),
      };

      res.status(201).json({ success: true, data: course });
    } else {
      res.status(400).json({
        success: false,
        message: response.data.message || "Failed to create course",
      });
    }
  } catch (error: any) {
    console.error(
      "Create course error:",
      error.response?.data || error.message
    );
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Update course
// @route   PUT /api/courses/:id
// @access  Private/Instructor/Admin
export const updateCourse = async (req: Request, res: Response) => {
  try {
    const token = getMisToken(req);

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "MIS authentication required. Please log in again.",
      });
    }

    const { title, description, code, credits, start_date, end_date } =
      req.body;

    // Call NGA MIS API to update subject
    const response = await axios.put(
      `${process.env.NGA_MIS_BASE_URL}/academics/subjects/${req.params.id}`,
      {
        name: title,
        code,
        description,
      },
      {
        headers: {
          Authorization: token,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data.success) {
      const subject = response.data.data;
      // Map back to course format
      const course = {
        id: subject.id,
        title: subject.name,
        code: subject.code,
        description: subject.description,
        credits: credits || 3,
        start_date,
        end_date,
        is_active: true,
        max_students: 50,
        instructor_id: null,
        created_at: subject.created_at || new Date().toISOString(),
        updated_at: subject.updated_at || new Date().toISOString(),
      };

      res.status(200).json({ success: true, data: course });
    } else {
      res.status(404).json({ success: false, message: "Course not found" });
    }
  } catch (error: any) {
    console.error(
      "Update course error:",
      error.response?.data || error.message
    );
    if (error.response?.status === 404) {
      res.status(404).json({ success: false, message: "Course not found" });
    } else {
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
};

// @desc    Get enrolled students for a course
// @route   GET /api/courses/:id/students
// @access  Private
export const getCourseStudents = async (req: Request, res: Response) => {
  try {
    const token = getMisToken(req);

    if (!token) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication required" });
    }

    // Get enrolled students for this subject and term 4
    let enrolledStudents = [];
    try {
      const studentsResponse = await axios.get(
        `${process.env.NGA_MIS_BASE_URL}/academics/subjects/${req.params.id}/terms/4/students`,
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
        "Could not fetch enrolled students:",
        enrollmentError.message
      );
      // Continue with empty array
    }

    res.status(200).json({ success: true, data: enrolledStudents });
  } catch (error: any) {
    console.error(
      "Get course students error:",
      error.response?.data || error.message
    );
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Delete course
// @route   DELETE /api/courses/:id
// @access  Private/Instructor/Admin
export const deleteCourse = async (req: Request, res: Response) => {
  try {
    const token = getMisToken(req);

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "MIS authentication required. Please log in again.",
      });
    }

    // Call NGA MIS API to delete subject
    const response = await axios.delete(
      `${process.env.NGA_MIS_BASE_URL}/academics/subjects/${req.params.id}`,
      {
        headers: {
          Authorization: token,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data.success) {
      res.status(200).json({ success: true, data: {} });
    } else {
      res.status(404).json({ success: false, message: "Course not found" });
    }
  } catch (error: any) {
    console.error(
      "Delete course error:",
      error.response?.data || error.message
    );
    if (error.response?.status === 404) {
      res.status(404).json({ success: false, message: "Course not found" });
    } else {
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
};

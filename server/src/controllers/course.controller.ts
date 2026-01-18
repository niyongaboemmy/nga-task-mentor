import { Request, Response } from "express";
import axios from "axios";
import { getMisToken, hasMisToken } from "../utils/misUtils";
import {
  Assignment,
  Submission,
  Quiz,
  QuizSubmission,
  QuizQuestion,
} from "../models";
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

    // Build query parameters
    let endpoint = "/academics/subjects"; // Default for admin
    let params: any = {};

    if (req.user?.role === "instructor") {
      endpoint = "/academics/my-assigned-subjects";
      params.termId = 4; // Default to active term
    } else if (req.user?.role === "student" && req.user.mis_user_id) {
      endpoint = `/academics/students/${req.user.mis_user_id}/enrolled-subjects`;
      // Students usually only get their current enrollments from this endpoint
    } else if (req.user?.role === "admin") {
      endpoint = "/academics/subjects";
      params.termId = 4;
    }

    // Call NGA MIS API
    const response = await axios.get(
      `${process.env.NGA_MIS_BASE_URL}${endpoint}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        params,
      },
    );

    if (response.data.success) {
      // Map subjects to courses format
      const subjects = response.data.data || [];
      const courses = subjects.map((subject: any) => ({
        id: subject.id || subject.subject_id,
        title: subject.name || subject.subject_name || subject.title,
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

    const courseId = parseInt(req.params.id);

    // Get enrolled students for this subject and term 4 from MIS
    let enrolledStudents = [];
    try {
      const studentsResponse = await axios.get(
        `${process.env.NGA_MIS_BASE_URL}/academics/subjects/${req.params.id}/terms/4/students`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (studentsResponse.data.success) {
        enrolledStudents = studentsResponse.data.data || [];
      }
    } catch (enrollmentError: any) {
      console.warn(
        `Could not fetch enrolled students for course ${req.params.id}:`,
        enrollmentError.message,
      );
    }

    // Get local statistics (assignments, quizzes)
    const statistics = await getCourseLocalStatistics(courseId);

    // Return statistics and enrollment to complement Redux list data
    res.status(200).json({
      success: true,
      data: {
        id: courseId,
        statistics,
        enrolledStudents,
      },
    });
  } catch (error: any) {
    console.error("Get course error:", error.response?.data || error.message);
    if (error.response?.status === 404) {
      res.status(404).json({ success: false, message: "Course not found" });
    } else if (error.response?.status === 403) {
      // For 403 errors, still return course data but with local statistics
      console.warn(
        `MIS API returned 403 for course ${req.params.id}, returning local course data and statistics`,
      );

      const statistics = await getCourseLocalStatistics(
        parseInt(req.params.id),
      );

      // Return course data with local statistics since MIS access failed
      const course = {
        id: req.params.id,
        title: `Course ${req.params.id}`,
        code: `COURSE${req.params.id}`,
        description: "Course details restricted in MIS - using local data",
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
        statistics,
      };

      res.status(200).json({ success: true, data: course });
    } else {
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
};

/**
 * Helper to calculate local statistics for a course
 */
async function getCourseLocalStatistics(courseId: number) {
  // Get assignments statistics for this course
  let assignmentsStats = {
    total: 0,
    by_status: { draft: 0, published: 0, completed: 0, removed: 0 } as any,
    total_submissions: 0,
    average_submissions_per_assignment: 0,
  };

  try {
    // Get all assignments for this course
    const assignments = await Assignment.findAll({
      where: { course_id: courseId },
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
      0,
    );

    // Calculate average submissions per assignment
    assignmentsStats.average_submissions_per_assignment =
      assignmentsStats.total > 0
        ? Math.round(
            (assignmentsStats.total_submissions / assignmentsStats.total) * 100,
          ) / 100
        : 0;
  } catch (assignmentError: any) {
    console.warn(
      "Could not fetch assignments statistics:",
      assignmentError.message,
    );
  }

  // Get quizzes statistics for this course
  let quizzesStats = {
    total: 0,
    by_status: { draft: 0, published: 0, completed: 0 } as any,
    by_type: { practice: 0, graded: 0, exam: 0 } as any,
    total_submissions: 0,
    average_score: 0,
    pass_rate: 0,
  };

  try {
    // Get all quizzes for this course
    const quizzes = await Quiz.findAll({
      where: { course_id: courseId },
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
  }

  return {
    assignments: assignmentsStats,
    quizzes: quizzesStats,
  };
}

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
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
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
      error.response?.data || error.message,
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
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
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
      error.response?.data || error.message,
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
        },
      );

      if (studentsResponse.data.success) {
        enrolledStudents = studentsResponse.data.data || [];
      }
    } catch (enrollmentError: any) {
      console.warn(
        "Could not fetch enrolled students:",
        enrollmentError.message,
      );
      // Continue with empty array
    }

    res.status(200).json({ success: true, data: enrolledStudents });
  } catch (error: any) {
    console.error(
      "Get course students error:",
      error.response?.data || error.message,
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
      },
    );

    if (response.data.success) {
      res.status(200).json({ success: true, data: {} });
    } else {
      res.status(404).json({ success: false, message: "Course not found" });
    }
  } catch (error: any) {
    console.error(
      "Delete course error:",
      error.response?.data || error.message,
    );
    if (error.response?.status === 404) {
      res.status(404).json({ success: false, message: "Course not found" });
    } else {
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
};
// @desc    Get course grades (assignments and quizzes) for all students
// @route   GET /api/courses/:id/grades
// @access  Private/Instructor/Admin
export const getCourseGrades = async (req: Request, res: Response) => {
  try {
    const token = getMisToken(req);

    if (!token) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication required" });
    }

    const courseId = req.params.id;

    // 1. Get enrolled students from MIS
    let enrolledStudents: any[] = [];
    try {
      const studentsResponse = await axios.get(
        `${process.env.NGA_MIS_BASE_URL}/academics/subjects/${courseId}/terms/4/students`,
        {
          headers: {
            Authorization: token,
            "Content-Type": "application/json",
          },
        },
      );

      if (studentsResponse.data.success) {
        enrolledStudents = studentsResponse.data.data || [];
      }
    } catch (enrollmentError: any) {
      console.warn(
        "Could not fetch enrolled students:",
        enrollmentError.message,
      );
      // We might still want to proceed if we have local submissions,
      // but typically we need the student list to show who hasn't submitted.
    }

    // 2. Get all Assignments
    const assignments = await Assignment.findAll({
      where: {
        course_id: courseId,
        status: { [Op.in]: ["published", "completed"] }, // Only show published or completed
      },
      attributes: ["id", "title", "max_score", "due_date"],
      order: [["due_date", "ASC"]],
    });

    // 3. Get all Quizzes
    const quizzes = await Quiz.findAll({
      where: {
        course_id: courseId,
        status: "published", // Only parsed published quizzes
      },
      attributes: ["id", "title", "type", "passing_score"],
      include: [
        {
          model: QuizQuestion,
          attributes: ["points"],
        },
      ],
      order: [["created_at", "ASC"]],
    });

    // Calculate max score for each quiz
    const quizzesWithMaxScore = quizzes.map((quiz) => {
      const maxScore =
        quiz.questions?.reduce((sum, q) => sum + (q.points || 0), 0) || 0;
      return {
        id: quiz.id,
        title: quiz.title,
        type: quiz.type,
        max_score: maxScore,
      };
    });

    // 4. Get all Assignment Submissions
    const assignmentIds = assignments.map((a) => a.id);
    const assignmentSubmissions = await Submission.findAll({
      where: { assignment_id: { [Op.in]: assignmentIds } },
      attributes: ["student_id", "assignment_id", "grade", "status"],
    });

    // 5. Get all Quiz Submissions
    const quizIds = quizzes.map((q) => q.id);
    const quizSubmissions = await QuizSubmission.findAll({
      where: {
        quiz_id: { [Op.in]: quizIds },
        status: "completed", // Only count completed attempts
      },
      attributes: [
        "student_id",
        "quiz_id",
        "total_score",
        "percentage",
        "passed",
      ],
      order: [["total_score", "DESC"]], // If multiple, we might want best? Or we assume one per student/quiz for now?
      // Actually, let's just fetch all and handle logic.
    });

    // 6. Aggregate Data
    const studentsWithGrades = enrolledStudents.map((student) => {
      const studentId = student.id;

      // Assignments Map
      const studentAssignments = assignments.map((assignment) => {
        const sub = assignmentSubmissions.find(
          (s) =>
            String(s.student_id) === String(studentId) &&
            s.assignment_id === assignment.id,
        );
        return {
          assignment_id: assignment.id,
          title: assignment.title,
          max_score: assignment.max_score,
          submitted: !!sub,
          grade: sub?.grade !== null ? sub?.grade : null,
          status: sub?.status || "pending",
        };
      });

      // Quizzes Map
      const studentQuizzes = quizzesWithMaxScore.map((quiz) => {
        // Find best submission for this quiz (if multiple allowed)
        // Since we fetched all, we filter by student and quiz
        const subs = quizSubmissions.filter(
          (s) =>
            String(s.student_id) === String(studentId) && s.quiz_id === quiz.id,
        );
        // Take best score
        const bestSub =
          subs.length > 0
            ? subs.reduce((prev, current) =>
                prev.total_score > current.total_score ? prev : current,
              )
            : null;

        return {
          quiz_id: quiz.id,
          title: quiz.title,
          max_score: quiz.max_score,
          submitted: !!bestSub,
          score:
            bestSub?.total_score !== undefined ? bestSub.total_score : null,
          percentage: bestSub?.percentage || null,
          passed: bestSub?.passed || null,
        };
      });

      // Calculate Totals (Mock logic - custom weighting can be added later)
      // For now, simple sum of points earned vs total possible points
      let totalPointsEarned = 0;
      let totalMaxPoints = 0;

      studentAssignments.forEach((a) => {
        if (a.max_score) {
          totalMaxPoints += Number(a.max_score);
          if (a.grade) totalPointsEarned += Number(a.grade);
        }
      });

      studentQuizzes.forEach((q) => {
        if (q.max_score) {
          totalMaxPoints += Number(q.max_score);
          if (q.score) totalPointsEarned += Number(q.score);
        }
      });

      const totalPercentage =
        totalMaxPoints > 0 ? (totalPointsEarned / totalMaxPoints) * 100 : 0;

      // Calculate Average Grade from assignments
      let assignmentsPoints = 0;
      let assignmentsMaxPoints = 0;
      studentAssignments.forEach((a) => {
        if (a.max_score) {
          assignmentsMaxPoints += Number(a.max_score);
          if (a.grade) assignmentsPoints += Number(a.grade);
        }
      });
      const assignmentPercentage =
        assignmentsMaxPoints > 0
          ? (assignmentsPoints / assignmentsMaxPoints) * 100
          : 0;

      // Calculate Average Grade from quizzes
      let quizzesPoints = 0;
      let quizzesMaxPoints = 0;
      studentQuizzes.forEach((q) => {
        if (q.max_score) {
          quizzesMaxPoints += Number(q.max_score);
          if (q.score) quizzesPoints += Number(q.score);
        }
      });
      const quizPercentage =
        quizzesMaxPoints > 0 ? (quizzesPoints / quizzesMaxPoints) * 100 : 0;

      return {
        student: {
          id: student.id,
          name: `${student.first_name} ${student.last_name}`,
          email: student.email,
          profile_image: student.profile_image,
        },
        assignments: studentAssignments,
        quizzes: studentQuizzes,
        summary: {
          total_points_earned: totalPointsEarned,
          total_max_points: totalMaxPoints,
          total_percentage: Math.round(totalPercentage * 100) / 100,
          assignment_percentage: Math.round(assignmentPercentage * 100) / 100,
          quiz_percentage: Math.round(quizPercentage * 100) / 100,
        },
      };
    });

    res.status(200).json({
      success: true,
      data: {
        course_id: courseId,
        students: studentsWithGrades,
        assignments: assignments.map((a) => ({
          id: a.id,
          title: a.title,
          max_score: a.max_score,
        })),
        quizzes: quizzesWithMaxScore.map((q) => ({
          id: q.id,
          title: q.title,
          max_score: q.max_score,
        })),
      },
    });
  } catch (error: any) {
    console.error(
      "Get course grades error:",
      error.response?.data || error.message,
    );
    res.status(500).json({ success: false, message: "Server error" });
  }
};

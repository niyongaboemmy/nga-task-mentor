import { Request, Response } from "express";
import { Op, Sequelize } from "sequelize";
import { User } from "../models/User.model";
import { Assignment } from "../models/Assignment.model";
import { Submission } from "../models/Submission.model";
import { Quiz } from "../models/Quiz.model";
import { QuizSubmission } from "../models/QuizSubmission.model";
import axios from "axios";
import { getMisToken } from "../utils/misUtils";

// Interface for dashboard statistics
interface DashboardStats {
  totalCourses: number;
  totalAssignments: number;
  pendingSubmissions: number;
  completedAssignments: number;
  totalEnrolledStudents?: number; // For instructors only
}

// Interface for recent activity
interface RecentActivity {
  id: string;
  type: "assignment" | "submission" | "course";
  title: string;
  description: string;
  timestamp: string;
}

// Student Dashboard Statistics
export const getStudentStats = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;

    // Get total courses from MIS API
    let totalCourses = 0;
    try {
      const token = getMisToken(req);
      if (token && req.user.mis_user_id) {
        const coursesResponse = await axios.get(
          `${process.env.NGA_MIS_BASE_URL}/academics/students/${req.user.mis_user_id}/enrolled-subjects`,
          {
            headers: {
              Authorization: token,
              "Content-Type": "application/json",
            },
          },
        );
        if (coursesResponse.data.success) {
          totalCourses = coursesResponse.data.data?.length || 0;
        }
      }
    } catch (courseError) {
      console.warn("Could not fetch courses count:", courseError);
      // Continue with 0 courses
    }

    // Get all published assignments
    const totalAssignments = await Assignment.count({
      where: {
        status: "published",
      },
    });

    // Get user's submissions
    const userSubmissions = await Submission.findAll({
      where: { student_id: userId },
    });

    // Count completed assignments (assignments with submissions)
    const completedAssignments = userSubmissions.length;

    // Count pending assignments (published assignments without submissions)
    const pendingSubmissions = await Assignment.count({
      where: {
        status: "published",
        id: {
          [Op.notIn]: userSubmissions.map((s) => s.assignment_id),
        },
      },
    });

    const stats: DashboardStats = {
      totalCourses,
      totalAssignments,
      pendingSubmissions,
      completedAssignments,
    };

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Error fetching student stats:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching dashboard statistics",
    });
  }
};

// Student Pending Assignments
export const getStudentPendingAssignments = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = req.user.id;

    // Get user's existing submissions
    const userSubmissions = await Submission.findAll({
      where: { student_id: userId },
      attributes: ["assignment_id"],
    });

    const submittedAssignmentIds = userSubmissions.map((s) => s.assignment_id);

    // Get pending assignments (published assignments without submissions)
    const pendingAssignments = await Assignment.findAll({
      include: [
        {
          model: User,
          as: "assignmentCreator",
          attributes: ["id", "first_name", "last_name"],
        },
      ],
      where: {
        status: "published",
        id: {
          [Op.notIn]: submittedAssignmentIds,
        },
        due_date: {
          [Op.gt]: new Date(), // Not overdue
        },
      },
      order: [["due_date", "ASC"]],
    });

    // Format the data to match frontend expectations
    const formattedAssignments = pendingAssignments.map((assignment: any) => ({
      id: assignment.id.toString(),
      title: assignment.title,
      description: assignment.description,
      due_date: assignment.due_date.toISOString(),
      max_score: assignment.max_score.toString(),
      submission_type: assignment.submission_type,
      allowed_file_types: assignment.allowed_file_types || "",
      rubric: assignment.rubric || "",
      course_id: assignment.course_id?.toString() || "",
      created_by: assignment.created_by?.toString() || "",
      createdAt: assignment.createdAt.toISOString(),
      updatedAt: assignment.updatedAt.toISOString(),
      creator: assignment.assignmentCreator
        ? {
            id: assignment.assignmentCreator.id.toString(),
            first_name: assignment.assignmentCreator.first_name,
            last_name: assignment.assignmentCreator.last_name,
          }
        : undefined,
      course: null, // No course
      submissions: [], // No submissions since these are pending
      isPublished: assignment.status === "published",
      status: assignment.status,
    }));

    res.status(200).json({
      success: true,
      data: formattedAssignments,
    });
  } catch (error) {
    console.error("Error fetching pending assignments:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching pending assignments",
    });
  }
};

// Instructor Dashboard Statistics
export const getInstructorStats = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;

    // Get total courses from MIS API
    let totalCourses = 0;
    try {
      const token = getMisToken(req);
      if (token) {
        const coursesResponse = await axios.get(
          `${process.env.NGA_MIS_BASE_URL}/academics/my-assigned-subjects`,
          {
            headers: {
              Authorization: token,
              "Content-Type": "application/json",
            },
          },
        );
        if (coursesResponse.data.success) {
          totalCourses = coursesResponse.data.data?.length || 0;
        }
      }
    } catch (courseError) {
      console.warn("Could not fetch courses count:", courseError);
      // Continue with 0 courses
    }

    // Get assignments created by instructor
    const totalAssignments = await Assignment.count({
      where: { created_by: userId },
    });

    // Get pending submissions (submissions that haven't been graded)
    const totalPendingSubmissions = await Submission.count({
      include: [
        {
          model: Assignment,
          as: "submissionAssignment",
          where: { created_by: userId },
          required: true,
        },
      ],
      where: {
        status: { [Op.ne]: "graded" },
      },
    });

    // Get completed assignments (graded submissions)
    const completedAssignments = await Submission.count({
      include: [
        {
          model: Assignment,
          as: "submissionAssignment",
          where: { created_by: userId },
          required: true,
        },
      ],
      where: {
        status: "graded",
      },
    });

    const stats: DashboardStats = {
      totalCourses,
      totalAssignments,
      pendingSubmissions: totalPendingSubmissions,
      completedAssignments,
    };

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Error fetching instructor stats:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching dashboard statistics",
    });
  }
};

// Instructor Courses Overview
export const getInstructorCourses = async (req: Request, res: Response) => {
  try {
    // No courses, return empty array
    res.status(200).json({
      success: true,
      data: [],
    });
  } catch (error) {
    console.error("Error fetching instructor courses:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching courses overview",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Instructor Pending Grading Assignments
export const getInstructorPendingGrading = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = req.user.id;

    // Get assignments created by instructor that are published
    const assignments = await Assignment.findAll({
      where: {
        created_by: userId,
        status: "published",
      },
      attributes: [
        "id",
        "title",
        "description",
        "due_date",
        "max_score",
        "submission_type",
      ],
      order: [["due_date", "ASC"]],
    });

    // For each assignment, get ungraded submissions
    const formattedAssignments = [];

    for (const assignment of assignments) {
      const submissions = await Submission.findAll({
        where: {
          assignment_id: assignment.id,
          status: { [Op.ne]: "graded" },
        },
        attributes: ["id", "status", "submitted_at", "student_id"],
        include: [
          {
            model: User,
            as: "submissionStudent",
            attributes: ["id", "first_name", "last_name"],
          },
        ],
      });

      if (submissions.length > 0) {
        formattedAssignments.push({
          id: assignment.id.toString(),
          title: assignment.title,
          description: assignment.description,
          due_date: assignment.due_date
            ? assignment.due_date.toISOString()
            : new Date().toISOString(),
          max_score: assignment.max_score.toString(),
          submission_type: assignment.submission_type,
          pendingSubmissions: submissions.length,
          course: null, // No course
          submissions: submissions.map((submission: any) => ({
            id: submission.id.toString(),
            status: submission.status,
            submitted_at: submission.submitted_at
              ? submission.submitted_at.toISOString()
              : new Date().toISOString(),
            student: submission.submissionStudent
              ? {
                  id: submission.submissionStudent.id.toString(),
                  first_name: submission.submissionStudent.first_name,
                  last_name: submission.submissionStudent.last_name,
                }
              : undefined,
          })),
        });
      }
    }

    res.status(200).json({
      success: true,
      data: formattedAssignments,
    });
  } catch (error) {
    console.error("Error fetching pending grading:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching pending grading assignments",
    });
  }
};

// Admin Dashboard Statistics
export const getAdminStats = async (req: Request, res: Response) => {
  try {
    // Get total courses from MIS API
    let totalCourses = 0;
    try {
      const token = getMisToken(req);
      if (token) {
        const coursesResponse = await axios.get(
          `${process.env.NGA_MIS_BASE_URL}/academics/subjects`,
          {
            headers: {
              Authorization: token,
              "Content-Type": "application/json",
            },
          },
        );
        if (coursesResponse.data.success) {
          totalCourses = coursesResponse.data.data?.length || 0;
        }
      }
    } catch (courseError) {
      console.warn("Could not fetch courses count:", courseError);
      // Continue with 0 courses
    }

    // Get total assignments in the system
    const totalAssignments = await Assignment.count();

    // Get pending submissions (all submissions not graded)
    const totalPendingSubmissions = await Submission.count({
      where: {
        status: { [Op.ne]: "graded" },
      },
    });

    // Get completed assignments (all graded submissions)
    const completedAssignments = await Submission.count({
      where: {
        status: "graded",
      },
    });

    const stats: DashboardStats = {
      totalCourses,
      totalAssignments,
      pendingSubmissions: totalPendingSubmissions,
      completedAssignments,
    };

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Error fetching admin stats:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching dashboard statistics",
    });
  }
};

// Admin Grading Summary
export const getAdminGradingSummary = async (req: Request, res: Response) => {
  try {
    const token = getMisToken(req);

    // 1. Fetch all courses from MIS (or local cache if we had one, but we use MIS)
    let allCourses: any[] = [];
    try {
      if (token) {
        // Fetch all subjects/courses available
        // Note: In a real scenario with pagination this might need adjustment.
        // For now assuming we can fetch all or a reasonable limit.
        const coursesResponse = await axios.get(
          `${process.env.NGA_MIS_BASE_URL}/academics/subjects`,
          {
            headers: {
              Authorization: token,
              "Content-Type": "application/json",
            },
            params: { limit: 100 }, // Try to get a good chunk
          },
        );
        if (coursesResponse.data.success) {
          allCourses = coursesResponse.data.data || [];
        }
      }
    } catch (courseError) {
      console.warn("Could not fetch courses from MIS:", courseError);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch courses from external system",
      });
    }

    if (allCourses.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
      });
    }

    // 2. Fetch ALL relevant data from local database for aggregation
    const assignmentsFull = await Assignment.findAll({
      attributes: ["id", "course_id", "max_score"],
    });

    const quizzes = await Quiz.findAll({
      attributes: ["id", "course_id", "title"],
    });

    const assignmentInfos = new Map(
      assignmentsFull.map((a) => [
        a.id,
        { courseId: String(a.course_id), maxScore: a.max_score },
      ]),
    );

    const quizInfos = new Map(
      quizzes.map((q: any) => [q.id, String(q.course_id)]),
    );

    // Get all submissions stats
    const assignmentSubmissions = await Submission.findAll({
      attributes: ["assignment_id", "grade", "student_id", "status"],
      where: { status: "graded" },
    });

    const quizSubmissions = await QuizSubmission.findAll({
      attributes: ["quiz_id", "percentage", "student_id", "status"],
      where: { status: "completed" },
    });

    // 3. Aggregate in Map
    const courseStatsMap = new Map<
      string,
      {
        totalGrades: number;
        sumGrades: number;
        uniqueStudents: Set<string>;
        assignmentCount: number;
        quizCount: number;
      }
    >();

    // Initialize map for all fetched courses from MIS
    allCourses.forEach((course) => {
      const courseId = String(course.subject_id || course.id || course._id);
      courseStatsMap.set(courseId, {
        totalGrades: 0,
        sumGrades: 0,
        uniqueStudents: new Set(),
        assignmentCount: 0,
        quizCount: 0,
      });
    });

    // Initial count of assignments and quizzes per course using local data
    assignmentsFull.forEach((a) => {
      const stats = courseStatsMap.get(String(a.course_id));
      if (stats) stats.assignmentCount++;
    });

    quizzes.forEach((q: any) => {
      const stats = courseStatsMap.get(String(q.course_id));
      if (stats) stats.quizCount++;
    });

    // 4. Calculate Global Grade Distribution
    const distribution = {
      excellent: 0, // >= 90
      good: 0, // 75-89
      average: 0, // 60-74
      poor: 0, // < 60
    };

    const processGrade = (
      percentage: number,
      studentId: string,
      courseId: string,
    ) => {
      if (percentage >= 90) distribution.excellent++;
      else if (percentage >= 75) distribution.good++;
      else if (percentage >= 60) distribution.average++;
      else distribution.poor++;

      const stats = courseStatsMap.get(courseId);
      if (stats) {
        stats.sumGrades += percentage;
        stats.totalGrades++;
        if (studentId) stats.uniqueStudents.add(String(studentId));
      }
    };

    // Aggregate Assignment Submissions
    assignmentSubmissions.forEach((sub) => {
      const info = assignmentInfos.get(sub.assignment_id);
      if (info && info.maxScore > 0 && sub.grade !== null) {
        const percentage = (Number(sub.grade) / Number(info.maxScore)) * 100;
        processGrade(percentage, String(sub.student_id), info.courseId);
      }
    });

    // Aggregate Quiz Submissions
    quizSubmissions.forEach((sub: any) => {
      const courseId = quizInfos.get(sub.quiz_id);
      if (courseId) {
        const percentage = Number(sub.percentage);
        if (!isNaN(percentage)) {
          processGrade(percentage, String(sub.student_id), courseId);
        }
      }
    });

    // 5. Construct Final Data
    const gradingSummary = allCourses.map((course) => {
      const courseId = String(course.subject_id || course.id || course._id);
      const stats = courseStatsMap.get(courseId);
      const avgGrade =
        stats && stats.totalGrades > 0
          ? stats.sumGrades / stats.totalGrades
          : 0;

      return {
        course_id: courseId,
        title: course.name || course.title,
        code: course.code,
        average_grade: Math.round(avgGrade * 10) / 10,
        active_students: stats ? stats.uniqueStudents.size : 0,
        graded_submissions: stats ? stats.totalGrades : 0,
      };
    });

    // Sort by most active (students count) or maybe Average Grade?
    // Let's return all and let frontend sort/filter.

    res.status(200).json({
      success: true,
      data: {
        gradingSummary,
        gradeDistribution: distribution,
      },
    });
  } catch (error) {
    console.error("Error fetching admin grading summary:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching grading summary",
    });
  }
};

export const getRecentActivity = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const activities: RecentActivity[] = [];

    if (userRole === "student") {
      // Get recent submissions by the user
      const recentSubmissions = await Submission.findAll({
        where: { student_id: userId },
        attributes: ["id", "assignment_id", "status", "submitted_at"],
        order: [["createdAt", "DESC"]],
        limit: 10,
      });

      for (const submission of recentSubmissions) {
        // Get assignment details
        const assignment = await Assignment.findByPk(submission.assignment_id, {
          attributes: ["id", "title"],
        });

        if (assignment) {
          activities.push({
            id: `submission_${submission.id}`,
            type: "submission",
            title: assignment.title,
            description: `You submitted an assignment: ${assignment.title}`,
            timestamp: submission.createdAt
              ? submission.createdAt.toISOString()
              : new Date().toISOString(),
          });
        }
      }
    } else if (userRole === "instructor") {
      // Get recent submissions that need grading (for instructor's assignments)
      const recentSubmissions = await Submission.findAll({
        include: [
          {
            model: Assignment,
            as: "submissionAssignment",
            attributes: ["id", "title"],
            where: { created_by: userId },
            required: true,
          },
        ],
        attributes: ["id", "createdAt"],
        where: {
          status: { [Op.ne]: "graded" },
        },
        order: [["createdAt", "DESC"]],
        limit: 5,
      });

      for (const submission of recentSubmissions) {
        activities.push({
          id: `submission_${submission.id}`,
          type: "submission",
          title: (submission as any).submissionAssignment.title,
          description: `${
            (submission as any).submissionStudent?.first_name || "A student"
          } submitted: ${(submission as any).submissionAssignment.title}`,
          timestamp: submission.createdAt
            ? submission.createdAt.toISOString()
            : new Date().toISOString(),
        });
      }

      // Get recently created assignments by the instructor
      const recentAssignments = await Assignment.findAll({
        where: { created_by: userId },
        attributes: ["id", "title", "createdAt"],
        order: [["createdAt", "DESC"]],
        limit: 5,
      });

      for (const assignment of recentAssignments) {
        activities.push({
          id: `assignment_${assignment.id}`,
          type: "assignment",
          title: assignment.title,
          description: `You created assignment: ${assignment.title}`,
          timestamp: assignment.createdAt
            ? assignment.createdAt.toISOString()
            : new Date().toISOString(),
        });
      }
    }

    // Sort all activities by timestamp
    activities.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    const recentActivities = activities.slice(0, 15);

    res.status(200).json({
      success: true,
      data: recentActivities,
    });
  } catch (error) {
    console.error("Error fetching recent activity:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching recent activity",
    });
  }
};

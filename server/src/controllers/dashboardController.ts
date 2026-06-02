import { Request, Response } from "express";
import { Op, Sequelize } from "sequelize";
import { User } from "../models/User.model";
import { Assignment } from "../models/Assignment.model";
import { Submission } from "../models/Submission.model";
import { Quiz } from "../models/Quiz.model";
import { QuizSubmission } from "../models/QuizSubmission.model";
import { ProctoringSession } from "../models/ProctoringSession.model";
import { ProctoringSettings } from "../models/ProctoringSettings.model";
import axios from "axios";
import { getMisToken, handleMisError } from "../utils/misUtils";

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
  type: "assignment" | "submission" | "course" | "quiz";
  title: string;
  description: string;
  timestamp: string;
  resource_id?: string; // ID of the linked resource (assignment, course, quiz)
}

// Student Dashboard Statistics
export const getStudentStats = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // Get total courses from MIS API
    let totalCourses = 0;
    try {
      const token = getMisToken(req);
      if (token && req.user.mis_user_id) {
        const coursesResponse = await axios.get(
          `${process.env.NGA_MIS_BASE_URL}/academics/students/${req.user.mis_user_id}/enrolled-subjects`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
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
    }

    // Get all published assignments
    let totalAssignments = 0;
    try {
      totalAssignments = await Assignment.count({
        where: { status: "published" },
      });
    } catch (e) {
      console.error("Error counting assignments:", e);
    }

    // Get user's submissions
    let userSubmissions: any[] = [];
    try {
      userSubmissions = await Submission.findAll({
        where: { student_id: userId },
        attributes: ["assignment_id"],
      });
    } catch (e) {
      console.error("Error fetching submissions:", e);
    }

    const completedAssignments = userSubmissions.length;

    // Count pending assignments — guard against empty array for Op.notIn
    let pendingSubmissions = 0;
    try {
      const submittedIds = userSubmissions.map((s) => s.assignment_id).filter(Boolean);
      pendingSubmissions = await Assignment.count({
        where: {
          status: "published",
          ...(submittedIds.length > 0 && {
            id: { [Op.notIn]: submittedIds },
          }),
        },
      });
    } catch (e) {
      console.error("Error counting pending submissions:", e);
    }

    res.status(200).json({
      success: true,
      data: {
        totalCourses,
        totalAssignments,
        pendingSubmissions,
        completedAssignments,
      },
    });
  } catch (error) {
    console.error(
      "[getStudentStats] Unexpected error — returning empty stats:",
      error instanceof Error ? error.stack : String(error),
    );
    res.status(200).json({
      success: true,
      data: {
        totalCourses: 0,
        totalAssignments: 0,
        pendingSubmissions: 0,
        completedAssignments: 0,
      },
    });
  }
};

// Student Pending Assignments
export const getStudentPendingAssignments = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // Get user's existing submissions
    let userSubmissions: any[] = [];
    try {
      userSubmissions = await Submission.findAll({
        where: { student_id: userId },
        attributes: ["assignment_id"],
      });
    } catch (e) {
      console.error("[getStudentPendingAssignments] Error fetching submissions:", e);
    }

    const submittedAssignmentIds = userSubmissions.map((s) => s.assignment_id).filter(Boolean);

    // Get pending assignments (published assignments without submissions)
    let pendingAssignments: any[] = [];
    try {
      pendingAssignments = await Assignment.findAll({
        include: [
          {
            model: User,
            as: "assignmentCreator",
            attributes: ["id", "first_name", "last_name"],
          },
        ],
        where: {
          status: "published",
          ...(submittedAssignmentIds.length > 0 && {
            id: { [Op.notIn]: submittedAssignmentIds },
          }),
          due_date: {
            [Op.gt]: new Date(),
          },
        },
        order: [["due_date", "ASC"]],
      });
    } catch (e) {
      console.error("[getStudentPendingAssignments] Error fetching assignments:", e);
    }

    // Format the data to match frontend expectations
    const formattedAssignments = pendingAssignments.map((assignment: any) => ({
      id: assignment.id?.toString() || "",
      title: assignment.title || "",
      description: assignment.description || "",
      due_date: assignment.due_date ? assignment.due_date.toISOString() : null,
      max_score: assignment.max_score != null ? assignment.max_score.toString() : "0",
      submission_type: assignment.submission_type || "",
      allowed_file_types: assignment.allowed_file_types || "",
      rubric: assignment.rubric || "",
      course_id: assignment.course_id?.toString() || "",
      created_by: assignment.created_by?.toString() || "",
      createdAt: assignment.createdAt ? assignment.createdAt.toISOString() : null,
      updatedAt: assignment.updatedAt ? assignment.updatedAt.toISOString() : null,
      creator: assignment.assignmentCreator
        ? {
            id: assignment.assignmentCreator.id.toString(),
            first_name: assignment.assignmentCreator.first_name,
            last_name: assignment.assignmentCreator.last_name,
          }
        : undefined,
      course: null,
      submissions: [],
      isPublished: assignment.status === "published",
      status: assignment.status,
    }));

    res.status(200).json({
      success: true,
      data: formattedAssignments,
    });
  } catch (error) {
    console.error(
      "[getStudentPendingAssignments] Unexpected error — returning empty list:",
      error instanceof Error ? error.stack : String(error),
    );
    res.status(200).json({
      success: true,
      data: [],
    });
  }
};

// Instructor Dashboard Statistics
export const getInstructorStats = async (req: Request, res: Response) => {
  const emptyStats: DashboardStats = {
    totalCourses: 0,
    totalAssignments: 0,
    pendingSubmissions: 0,
    completedAssignments: 0,
    totalEnrolledStudents: 0,
  };

  try {
    const userId = req.user.id;
    const token = getMisToken(req);

    // MIS: total courses + enrolled students (non-fatal if unavailable)
    let totalCourses = 0;
    let totalEnrolledStudents = 0;
    try {
      if (token) {
        const coursesResponse = await axios.get(
          `${process.env.NGA_MIS_BASE_URL}/academics/my-assigned-subjects`,
          { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } },
        );
        if (coursesResponse.data.success && coursesResponse.data.data) {
          totalCourses = coursesResponse.data.data.length;
          totalEnrolledStudents = coursesResponse.data.data.reduce(
            (sum: number, course: any) => sum + (course.enrolled_students || 0),
            0,
          );
        }
      }
    } catch (misError: any) {
      console.warn("Could not fetch MIS courses for instructor stats:", misError.message);
    }

    // DB: assignment count
    let totalAssignments = 0;
    try {
      totalAssignments = await Assignment.count({ where: { created_by: userId } });
    } catch (e) {
      console.error("Error counting instructor assignments:", e);
    }

    // DB: pending submissions (not graded)
    let totalPendingSubmissions = 0;
    try {
      totalPendingSubmissions = await Submission.count({
        include: [{
          model: Assignment,
          as: "submissionAssignment",
          where: { created_by: userId },
          required: true,
        }],
        where: { status: { [Op.ne]: "graded" } },
      });
    } catch (e) {
      console.error("Error counting pending submissions:", e);
    }

    // DB: graded submissions
    let completedAssignments = 0;
    try {
      completedAssignments = await Submission.count({
        include: [{
          model: Assignment,
          as: "submissionAssignment",
          where: { created_by: userId },
          required: true,
        }],
        where: { status: "graded" },
      });
    } catch (e) {
      console.error("Error counting completed assignments:", e);
    }

    return res.status(200).json({
      success: true,
      data: { totalCourses, totalAssignments, pendingSubmissions: totalPendingSubmissions, completedAssignments, totalEnrolledStudents },
    });
  } catch (error) {
    console.error("getInstructorStats unexpected error:", error);
    return res.status(200).json({ success: true, data: emptyStats });
  }
};

// Instructor Courses Overview
export const getInstructorCourses = async (req: Request, res: Response) => {
  try {
    const token = getMisToken(req);
    const userId = req.user.id;
    let courses: any[] = [];

    if (token) {
      try {
        const coursesResponse = await axios.get(
          `${process.env.NGA_MIS_BASE_URL}/academics/my-assigned-subjects`,
          { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } },
        );

        if (coursesResponse.data.success) {
          let allAssignments: any[] = [];
          let allQuizzes: any[] = [];

          try {
            allAssignments = await Assignment.findAll({ where: { created_by: userId } });
          } catch (e) {
            console.error("Error fetching assignments for courses overview:", e);
          }

          try {
            allQuizzes = await Quiz.findAll({ where: { created_by: userId } });
          } catch (e) {
            console.error("Error fetching quizzes for courses overview:", e);
          }

          courses = (coursesResponse.data.data || []).map((subject: any) => {
            const courseId = subject.id || subject.subject_id;
            return {
              id: courseId,
              title: subject.name || subject.subject_name || subject.title,
              code: subject.code || subject.subject_code,
              description: subject.description,
              assignmentCount: allAssignments.filter((a) => a.course_id === courseId).length,
              quizCount: allQuizzes.filter((q) => q.course_id === courseId).length,
            };
          });
        }
      } catch (misError: any) {
        console.warn("Could not fetch courses from MIS:", misError.message);
      }
    }

    return res.status(200).json({ success: true, data: courses });
  } catch (error) {
    console.error("getInstructorCourses unexpected error:", error);
    return res.status(200).json({ success: true, data: [] });
  }
};

// Instructor Pending Grading Assignments
export const getInstructorPendingGrading = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = req.user.id;

    let assignments: any[] = [];
    try {
      assignments = await Assignment.findAll({
        where: { created_by: userId, status: "published" },
        attributes: ["id", "title", "description", "due_date", "max_score", "submission_type"],
        order: [["due_date", "ASC"]],
      });
    } catch (e) {
      console.error("getInstructorPendingGrading: error fetching assignments:", e);
      return res.status(200).json({ success: true, data: [] });
    }

    const formattedAssignments: any[] = [];

    for (const assignment of assignments) {
      let submissions: any[] = [];
      try {
        submissions = await Submission.findAll({
          where: { assignment_id: assignment.id, status: { [Op.ne]: "graded" } },
          attributes: ["id", "status", "submitted_at", "student_id"],
          include: [{
            model: User,
            as: "submissionStudent",
            attributes: ["id", "first_name", "last_name"],
          }],
        });
      } catch (e) {
        console.error(`getInstructorPendingGrading: error fetching submissions for assignment ${assignment.id}:`, e);
      }

      if (submissions.length > 0) {
        formattedAssignments.push({
          id: assignment.id.toString(),
          title: assignment.title,
          description: assignment.description,
          due_date: assignment.due_date ? assignment.due_date.toISOString() : new Date().toISOString(),
          max_score: assignment.max_score?.toString() ?? "0",
          submission_type: assignment.submission_type,
          pendingSubmissions: submissions.length,
          course: null,
          submissions: submissions.map((submission: any) => ({
            id: submission.id.toString(),
            status: submission.status,
            submitted_at: submission.submitted_at ? submission.submitted_at.toISOString() : new Date().toISOString(),
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

    return res.status(200).json({ success: true, data: formattedAssignments });
  } catch (error: any) {
    console.error("getInstructorPendingGrading unexpected error:", error.message);
    return res.status(200).json({ success: true, data: [] });
  }
};

// Admin Dashboard Statistics
export const getAdminStats = async (req: Request, res: Response) => {
  const emptyStats: DashboardStats = { totalCourses: 0, totalAssignments: 0, pendingSubmissions: 0, completedAssignments: 0 };

  try {
    let totalCourses = 0;
    try {
      const token = getMisToken(req);
      if (token) {
        const coursesResponse = await axios.get(
          `${process.env.NGA_MIS_BASE_URL}/academics/subjects`,
          { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } },
        );
        if (coursesResponse.data.success) {
          totalCourses = coursesResponse.data.data?.length || 0;
        }
      }
    } catch (e) {
      console.warn("Could not fetch admin courses count from MIS:", e);
    }

    let totalAssignments = 0;
    try {
      totalAssignments = await Assignment.count();
    } catch (e) {
      console.error("Error counting total assignments:", e);
    }

    let totalPendingSubmissions = 0;
    try {
      totalPendingSubmissions = await Submission.count({ where: { status: { [Op.ne]: "graded" } } });
    } catch (e) {
      console.error("Error counting pending submissions:", e);
    }

    let completedAssignments = 0;
    try {
      completedAssignments = await Submission.count({ where: { status: "graded" } });
    } catch (e) {
      console.error("Error counting completed assignments:", e);
    }

    return res.status(200).json({
      success: true,
      data: { totalCourses, totalAssignments, pendingSubmissions: totalPendingSubmissions, completedAssignments },
    });
  } catch (error) {
    console.error("getAdminStats unexpected error:", error);
    return res.status(200).json({ success: true, data: emptyStats });
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
              Authorization: `Bearer ${token}`,
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
    let assignmentsFull: any[] = [];
    try {
      assignmentsFull = await Assignment.findAll({ attributes: ["id", "course_id", "max_score"] });
    } catch (e) { console.error("getAdminGradingSummary: error fetching assignments:", e); }

    let quizzes: any[] = [];
    try {
      quizzes = await Quiz.findAll({ attributes: ["id", "course_id", "title"] });
    } catch (e) { console.error("getAdminGradingSummary: error fetching quizzes:", e); }

    const assignmentInfos = new Map(
      assignmentsFull.map((a) => [a.id, { courseId: String(a.course_id), maxScore: a.max_score }]),
    );
    const quizInfos = new Map(quizzes.map((q: any) => [q.id, String(q.course_id)]));

    let assignmentSubmissions: any[] = [];
    try {
      assignmentSubmissions = await Submission.findAll({
        attributes: ["assignment_id", "grade", "student_id", "status"],
        where: { status: "graded" },
      });
    } catch (e) { console.error("getAdminGradingSummary: error fetching assignment submissions:", e); }

    let quizSubmissions: any[] = [];
    try {
      quizSubmissions = await QuizSubmission.findAll({
        attributes: ["quiz_id", "percentage", "student_id", "status"],
        where: { status: "completed" },
      });
    } catch (e) { console.error("getAdminGradingSummary: error fetching quiz submissions:", e); }

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
    console.error("getAdminGradingSummary unexpected error:", error);
    return res.status(200).json({ success: true, data: { gradingSummary: [], gradeDistribution: { excellent: 0, good: 0, average: 0, poor: 0 } } });
  }
};

// Get active proctoring sessions count for instructor dashboard
export const getActiveProctoringCount = async (req: Request, res: Response) => {
  try {
    if (req.user.role !== "instructor" && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message:
          "Only instructors and admins can view active proctoring sessions",
      });
    }

    // Get active proctoring sessions from the database
    const activeSessions = await ProctoringSession.count({
      where: {
        status: "active",
        // Only show sessions for quizzes created by this instructor (or all for admin)
        ...(req.user.role !== "admin" && {
          "$quiz.created_by$": req.user.id,
        }),
      },
      include: [
        {
          model: Quiz,
          as: "quiz",
          required: true, // INNER JOIN to ensure quiz exists
          include: [
            {
              model: ProctoringSettings,
              as: "proctoringSettings",
              where: { enabled: true },
              required: true, // INNER JOIN to ensure proctoring is enabled
            },
          ],
        },
      ],
    });

    return res.status(200).json({ success: true, data: activeSessions });
  } catch (error) {
    console.error("getActiveProctoringCount unexpected error:", error);
    return res.status(200).json({ success: true, data: 0 });
  }
};

export const getRecentActivity = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const activities: RecentActivity[] = [];

    if (userRole === "student") {
      let recentSubmissions: any[] = [];
      try {
        recentSubmissions = await Submission.findAll({
          where: { student_id: userId },
          attributes: ["id", "assignment_id", "status", "submitted_at", "createdAt"],
          order: [["createdAt", "DESC"]],
          limit: 10,
        });
      } catch (e) {
        console.error("getRecentActivity: error fetching student submissions:", e);
      }

      for (const submission of recentSubmissions) {
        try {
          const assignment = await Assignment.findByPk(submission.assignment_id, {
            attributes: ["id", "title"],
          });
          if (assignment) {
            activities.push({
              id: `submission_${submission.id}`,
              type: "submission",
              title: assignment.title,
              description: `You submitted an assignment: ${assignment.title}`,
              timestamp: submission.createdAt ? submission.createdAt.toISOString() : new Date().toISOString(),
              resource_id: String(assignment.id),
            });
          }
        } catch (e) {
          console.error(`getRecentActivity: error fetching assignment for submission ${submission.id}:`, e);
        }
      }
    } else if (userRole === "instructor") {
      // Recent ungraded submissions for instructor's assignments
      try {
        const recentSubmissions = await Submission.findAll({
          include: [{
            model: Assignment,
            as: "submissionAssignment",
            attributes: ["id", "title"],
            where: { created_by: userId },
            required: true,
          }],
          attributes: ["id", "createdAt"],
          where: { status: { [Op.ne]: "graded" } },
          order: [["createdAt", "DESC"]],
          limit: 5,
        });

        for (const submission of recentSubmissions) {
          activities.push({
            id: `submission_${submission.id}`,
            type: "submission",
            title: (submission as any).submissionAssignment.title,
            description: `A student submitted: ${(submission as any).submissionAssignment.title}`,
            timestamp: submission.createdAt ? submission.createdAt.toISOString() : new Date().toISOString(),
            resource_id: String((submission as any).submissionAssignment.id),
          });
        }
      } catch (e) {
        console.error("getRecentActivity: error fetching instructor submissions:", e);
      }

      // Recently created assignments
      try {
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
            timestamp: assignment.createdAt ? assignment.createdAt.toISOString() : new Date().toISOString(),
            resource_id: String(assignment.id),
          });
        }
      } catch (e) {
        console.error("getRecentActivity: error fetching recent assignments:", e);
      }
    }

    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return res.status(200).json({ success: true, data: activities.slice(0, 15) });
  } catch (error) {
    console.error("getRecentActivity unexpected error:", error);
    return res.status(200).json({ success: true, data: [] });
  }
};

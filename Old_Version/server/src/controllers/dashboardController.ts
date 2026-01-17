import { Request, Response } from "express";
import { Op, Sequelize } from "sequelize";
import { User } from "../models/User.model";
import { Course } from "../models/Course.model";
import { Assignment } from "../models/Assignment.model";
import { Submission } from "../models/Submission.model";
import { UserCourse } from "../models/UserCourse.model";

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

    // Get user's enrolled courses
    const enrolledCourses = await UserCourse.findAll({
      where: { user_id: userId },
      attributes: ['course_id']
    });

    const courseIds = enrolledCourses.map(ec => ec.course_id);

    if (courseIds.length === 0) {
      // No enrolled courses, return zeros
      const stats: DashboardStats = {
        totalCourses: 0,
        totalAssignments: 0,
        pendingSubmissions: 0,
        completedAssignments: 0
      };

      return res.status(200).json({
        success: true,
        data: stats
      });
    }

    // Get total assignments from enrolled courses that are published
    const totalAssignments = await Assignment.count({
      where: {
        course_id: { [Op.in]: courseIds },
        status: "published"
      }
    });

    // Get user's submissions for assignments in enrolled courses
    const userSubmissions = await Submission.findAll({
      include: [
        {
          model: Assignment,
          as: "submissionAssignment",
          where: {
            course_id: { [Op.in]: courseIds }
          },
          required: true
        }
      ],
      where: { student_id: userId }
    });

    // Count completed assignments (assignments with submissions)
    const completedAssignments = userSubmissions.length;

    // Count pending assignments (published assignments in enrolled courses without submissions)
    const pendingSubmissions = await Assignment.count({
      where: {
        course_id: { [Op.in]: courseIds },
        status: "published",
        id: {
          [Op.notIn]: userSubmissions.map(s => s.assignment_id)
        }
      }
    });

    const stats: DashboardStats = {
      totalCourses: courseIds.length,
      totalAssignments,
      pendingSubmissions,
      completedAssignments
    };

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error("Error fetching student stats:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching dashboard statistics"
    });
  }
};

// Student Pending Assignments
export const getStudentPendingAssignments = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;

    // Get user's enrolled courses
    const enrolledCourses = await UserCourse.findAll({
      where: { user_id: userId },
      attributes: ['course_id']
    });

    const courseIds = enrolledCourses.map(ec => ec.course_id);

    if (courseIds.length === 0) {
      // No enrolled courses, return empty array
      return res.status(200).json({
        success: true,
        data: []
      });
    }

    // Get user's existing submissions for assignments in enrolled courses
    const userSubmissions = await Submission.findAll({
      where: { student_id: userId },
      attributes: ['assignment_id']
    });

    const submittedAssignmentIds = userSubmissions.map(s => s.assignment_id);

    // Get pending assignments (published assignments in enrolled courses without submissions)
    const pendingAssignments = await Assignment.findAll({
      include: [
        {
          model: Course,
          as: "assignmentCourse",
          attributes: ["id", "title", "code"],
          required: true
        },
        {
          model: User,
          as: "assignmentCreator",
          attributes: ["id", "first_name", "last_name"]
        }
      ],
      where: {
        course_id: { [Op.in]: courseIds },
        status: "published",
        id: {
          [Op.notIn]: submittedAssignmentIds
        },
        due_date: {
          [Op.gt]: new Date() // Not overdue
        }
      },
      order: [["due_date", "ASC"]]
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
      course_id: assignment.course_id.toString(),
      created_by: assignment.created_by?.toString() || "",
      createdAt: assignment.createdAt.toISOString(),
      updatedAt: assignment.updatedAt.toISOString(),
      creator: assignment.assignmentCreator ? {
        id: assignment.assignmentCreator.id.toString(),
        first_name: assignment.assignmentCreator.first_name,
        last_name: assignment.assignmentCreator.last_name
      } : undefined,
      course: assignment.assignmentCourse ? {
        id: assignment.assignmentCourse.id.toString(),
        title: assignment.assignmentCourse.title,
        code: assignment.assignmentCourse.code
      } : undefined,
      submissions: [], // No submissions since these are pending
      isPublished: assignment.status === "published",
      status: assignment.status
    }));

    res.status(200).json({
      success: true,
      data: formattedAssignments
    });
  } catch (error) {
    console.error("Error fetching pending assignments:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching pending assignments"
    });
  }
};

// Instructor Dashboard Statistics
export const getInstructorStats = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;

    // Get courses taught by instructor
    const totalCourses = await Course.count({
      where: { instructor_id: userId }
    });

    // Get assignments created by instructor
    const totalAssignments = await Assignment.count({
      where: { created_by: userId }
    });

    // Get pending submissions (submissions that haven't been graded + students who haven't submitted)
    // First, get all assignments created by the instructor
    const instructorAssignments = await Assignment.findAll({
      where: { created_by: userId },
      attributes: ['id', 'course_id']
    });

    let totalPendingSubmissions = 0;

    for (const assignment of instructorAssignments) {
      // Get enrolled students for this assignment's course
      const enrolledStudents = await UserCourse.count({
        where: {
          course_id: assignment.course_id,
          status: "enrolled"
        }
      });

      // Get existing submissions for this assignment
      const existingSubmissions = await Submission.count({
        where: {
          assignment_id: assignment.id,
          status: { [Op.ne]: "graded" }
        }
      });

      // Pending = enrolled students - graded submissions (since graded submissions are completed)
      const gradedSubmissions = await Submission.count({
        where: {
          assignment_id: assignment.id,
          status: "graded"
        }
      });

      const pendingForAssignment = enrolledStudents - gradedSubmissions;
      totalPendingSubmissions += Math.max(0, pendingForAssignment); // Ensure non-negative
    }

    // Get completed assignments (graded submissions)
    const completedAssignments = await Submission.count({
      include: [
        {
          model: Assignment,
          as: "submissionAssignment",
          where: { created_by: userId },
          required: true
        }
      ],
      where: {
        status: "graded"
      }
    });

    // Get total enrolled students across all courses taught by instructor
    const enrolledStudents = await UserCourse.count({
      include: [
        {
          model: Course,
          as: "courseInUserCourse",
          where: { instructor_id: userId },
          required: true
        }
      ],
      where: { status: "enrolled" }
    });

    const stats: DashboardStats = {
      totalCourses,
      totalAssignments,
      pendingSubmissions: totalPendingSubmissions,
      completedAssignments,
      totalEnrolledStudents: enrolledStudents
    };

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error("Error fetching instructor stats:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching dashboard statistics"
    });
  }
};

// Instructor Courses Overview
export const getInstructorCourses = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;

    // First, let's try a simpler query to see if basic course retrieval works
    const courses = await Course.findAll({
      where: { instructor_id: userId },
      attributes: [
        "id",
        "code",
        "title",
        "description",
        "credits",
        "is_active",
        "max_students",
        "start_date",
        "end_date"
      ],
      order: [["createdAt", "DESC"]],
      limit: 6
    });

    // Format the data for frontend
    const formattedCourses = courses.map(course => ({
      id: course.id.toString(),
      code: course.code,
      title: course.title,
      description: course.description,
      credits: course.credits,
      is_active: course.is_active,
      max_students: course.max_students,
      start_date: new Date(course.start_date).toISOString(),
      end_date: new Date(course.end_date).toISOString(),
      assignmentCount: 0, // Will be calculated separately
      enrolledCount: 0, // Will be calculated separately
      progress: {
        enrolled: 0,
        capacity: course.max_students,
        assignments: 0
      }
    }));

    res.status(200).json({
      success: true,
      data: formattedCourses
    });
  } catch (error) {
    console.error("Error fetching instructor courses:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching courses overview",
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Instructor Pending Grading Assignments
export const getInstructorPendingGrading = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;

    // Get assignments created by instructor that are published
    const assignments = await Assignment.findAll({
      where: {
        created_by: userId,
        status: "published"
      },
      attributes: ["id", "title", "description", "due_date", "max_score", "submission_type"],
      order: [["due_date", "ASC"]]
    });

    // For each assignment, get ungraded submissions
    const formattedAssignments = [];

    for (const assignment of assignments) {
      const submissions = await Submission.findAll({
        where: {
          assignment_id: assignment.id,
          status: { [Op.ne]: "graded" }
        },
        attributes: ["id", "status", "submitted_at", "student_id"],
        include: [
          {
            model: User,
            as: "submissionStudent",
            attributes: ["id", "first_name", "last_name"]
          }
        ]
      });

      if (submissions.length > 0) {
        // Get course info
        const course = await Course.findByPk(assignment.course_id, {
          attributes: ["id", "title", "code"]
        });

        formattedAssignments.push({
          id: assignment.id.toString(),
          title: assignment.title,
          description: assignment.description,
          due_date: assignment.due_date ? assignment.due_date.toISOString() : new Date().toISOString(),
          max_score: assignment.max_score.toString(),
          submission_type: assignment.submission_type,
          pendingSubmissions: submissions.length,
          course: course ? {
            id: course.id.toString(),
            title: course.title,
            code: course.code
          } : undefined,
          submissions: submissions.map((submission: any) => ({
            id: submission.id.toString(),
            status: submission.status,
            submitted_at: submission.submitted_at ? submission.submitted_at.toISOString() : new Date().toISOString(),
            student: submission.submissionStudent ? {
              id: submission.submissionStudent.id.toString(),
              first_name: submission.submissionStudent.first_name,
              last_name: submission.submissionStudent.last_name
            } : undefined
          }))
        });
      }
    }

    res.status(200).json({
      success: true,
      data: formattedAssignments
    });
  } catch (error) {
    console.error("Error fetching pending grading:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching pending grading assignments"
    });
  }
};

// Admin Dashboard Statistics
export const getAdminStats = async (req: Request, res: Response) => {
  try {
    // Get total courses in the system
    const totalCourses = await Course.count();

    // Get total assignments in the system
    const totalAssignments = await Assignment.count();

    // Get pending submissions (all enrolled students - graded submissions across all assignments)
    // Get all assignments in the system
    const allAssignments = await Assignment.findAll({
      attributes: ['id', 'course_id']
    });

    let totalPendingSubmissions = 0;

    for (const assignment of allAssignments) {
      // Get enrolled students for this assignment's course
      const enrolledStudents = await UserCourse.count({
        where: {
          course_id: assignment.course_id,
          status: "enrolled"
        }
      });

      // Get graded submissions for this assignment
      const gradedSubmissions = await Submission.count({
        where: {
          assignment_id: assignment.id,
          status: "graded"
        }
      });

      const pendingForAssignment = enrolledStudents - gradedSubmissions;
      totalPendingSubmissions += Math.max(0, pendingForAssignment); // Ensure non-negative
    }

    // Get completed assignments (all graded submissions)
    const completedAssignments = await Submission.count({
      where: {
        status: "graded"
      }
    });

    const stats: DashboardStats = {
      totalCourses,
      totalAssignments,
      pendingSubmissions: totalPendingSubmissions,
      completedAssignments
    };

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error("Error fetching admin stats:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching dashboard statistics"
    });
  }
};

// Recent Activity (for logged-in user only)
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
        limit: 10
      });

      for (const submission of recentSubmissions) {
        // Get assignment details
        const assignment = await Assignment.findByPk(submission.assignment_id, {
          attributes: ["id", "title"]
        });

        if (assignment) {
          activities.push({
            id: `submission_${submission.id}`,
            type: "submission",
            title: assignment.title,
            description: `You submitted an assignment: ${assignment.title}`,
            timestamp: submission.createdAt ? submission.createdAt.toISOString() : new Date().toISOString()
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
            required: true
          }
        ],
        attributes: ["id", "createdAt"],
        where: {
          status: { [Op.ne]: "graded" }
        },
        order: [["createdAt", "DESC"]],
        limit: 5
      });

      for (const submission of recentSubmissions) {
        activities.push({
          id: `submission_${submission.id}`,
          type: "submission",
          title: (submission as any).submissionAssignment.title,
          description: `${(submission as any).submissionStudent?.first_name || 'A student'} submitted: ${(submission as any).submissionAssignment.title}`,
          timestamp: submission.createdAt ? submission.createdAt.toISOString() : new Date().toISOString()
        });
      }

      // Get recently created assignments by the instructor
      const recentAssignments = await Assignment.findAll({
        where: { created_by: userId },
        attributes: ["id", "title", "course_id", "createdAt"],
        order: [["createdAt", "DESC"]],
        limit: 5
      });

      for (const assignment of recentAssignments) {
        // Get course info
        const course = await Course.findByPk(assignment.course_id, {
          attributes: ["id", "title", "code"]
        });

        activities.push({
          id: `assignment_${assignment.id}`,
          type: "assignment",
          title: assignment.title,
          description: `You created assignment: ${assignment.title}${course ? ` for ${course.title}` : ''}`,
          timestamp: assignment.createdAt ? assignment.createdAt.toISOString() : new Date().toISOString()
        });
      }

      // Get recent student enrollments in instructor's courses
      const recentEnrollments = await UserCourse.findAll({
        include: [
          {
            model: Course,
            as: "courseInUserCourse",
            attributes: ["id", "title", "code"],
            where: { instructor_id: userId },
            required: true
          },
          {
            model: User,
            as: "userInCourse",
            attributes: ["id", "first_name", "last_name"],
            required: true
          }
        ],
        attributes: ["id", "createdAt"],
        where: { status: "enrolled" },
        order: [["createdAt", "DESC"]],
        limit: 5
      });

      for (const enrollment of recentEnrollments) {
        activities.push({
          id: `enrollment_${enrollment.id}`,
          type: "course",
          title: (enrollment as any).courseInUserCourse.title,
          description: `${(enrollment as any).userInCourse?.first_name || 'A student'} enrolled in ${(enrollment as any).courseInUserCourse.title}`,
          timestamp: enrollment.createdAt ? enrollment.createdAt.toISOString() : new Date().toISOString()
        });
      }
    }

    // Sort all activities by timestamp
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const recentActivities = activities.slice(0, 15);

    res.status(200).json({
      success: true,
      data: recentActivities
    });
  } catch (error) {
    console.error("Error fetching recent activity:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching recent activity"
    });
  }
};

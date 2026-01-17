import { Request, Response } from "express";
import {
  Course,
  User,
  UserCourse,
  Assignment,
  Submission,
  Quiz,
} from "../models";
import { Op, Transaction } from "sequelize";
import { sequelize } from "../config/database";

// @desc    Get all courses
// @route   GET /api/courses
// @access  Public
export const getCourses = async (req: Request, res: Response) => {
  try {
    const whereClause: any = {};

    // If user is not admin, only show their own courses
    if (req.user && req.user.role !== "admin") {
      whereClause.instructor_id = req.user.id;
    }

    const courses = await Course.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: "courseInstructor",
          attributes: ["id", "first_name", "last_name", "email"],
        },
      ],
    });
    res
      .status(200)
      .json({ success: true, count: courses.length, data: courses });
  } catch (error) {
    console.error("Get courses error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Get single course
// @route   GET /api/courses/:id
// @access  Public
export const getCourse = async (req: Request, res: Response) => {
  try {
    const course = await Course.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: "courseInstructor",
          attributes: ["id", "first_name", "last_name", "email"],
        },
        {
          model: Assignment,
          attributes: [
            "id",
            "title",
            "description",
            "due_date",
            "max_score",
            "submission_type",
            "status",
          ],
        },
      ],
    });

    if (!course) {
      return res
        .status(404)
        .json({ success: false, message: "Course not found" });
    }

    res.status(200).json({ success: true, data: course });
  } catch (error) {
    console.error("Get course error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Create course
// @route   POST /api/courses
// @access  Private/Instructor/Admin
export const createCourse = async (req: Request, res: Response) => {
  try {
    const {
      title,
      description,
      code,
      credits,
      start_date,
      end_date,
      max_students = 50,
    } = req.body;

    const course = await Course.create({
      title,
      description,
      code,
      credits,
      start_date,
      end_date,
      max_students,
      instructor_id: req.user.id,
      is_active: true,
    });

    res.status(201).json({ success: true, data: course });
  } catch (error) {
    console.error("Create course error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Update course
// @route   PUT /api/courses/:id
// @access  Private/Instructor/Admin
export const updateCourse = async (req: Request, res: Response) => {
  try {
    const { title, description, code, credits, start_date, end_date } =
      req.body;

    const course = await Course.findByPk(req.params.id);

    if (!course) {
      return res
        .status(404)
        .json({ success: false, message: "Course not found" });
    }

    // Update fields
    course.title = title || course.title;
    course.description = description || course.description;
    course.code = code || course.code;
    course.credits = credits || course.credits;
    course.start_date = start_date || course.start_date;
    course.end_date = end_date || course.end_date;

    await course.save();

    res.status(200).json({ success: true, data: course });
  } catch (error) {
    console.error("Update course error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Delete course
// @route   DELETE /api/courses/:id
// @access  Private/Instructor/Admin
export const deleteCourse = async (req: Request, res: Response) => {
  try {
    const course = await Course.findByPk(req.params.id);

    if (!course) {
      return res
        .status(404)
        .json({ success: false, message: "Course not found" });
    }

    await course.destroy();

    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    console.error("Delete course error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Get course students
// @route   GET /api/courses/:id/students
// @access  Private/Instructor/Admin
export const getCourseStudents = async (req: Request, res: Response) => {
  try {
    const course = await Course.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: "studentsEnrolled",
          attributes: [
            "id",
            "first_name",
            "last_name",
            "email",
            "profile_image",
          ],
          through: { attributes: ["enrollment_date", "status"] }, // Include enrollment data
        },
      ],
    });

    if (!course) {
      return res
        .status(404)
        .json({ success: false, message: "Course not found" });
    }

    // Transform the data to include enrollment information
    const studentsWithEnrollment = (course as any).studentsEnrolled.map(
      (student: any) => {
        const enrollment = student.UserCourse || {};
        return {
          id: student.id,
          firstName: student.first_name,
          lastName: student.last_name,
          email: student.email,
          profile_image: student.profile_image,
          enrollmentDate:
            enrollment.enrollment_date || new Date().toISOString(),
          status: enrollment.status || "enrolled",
        };
      }
    );

    res.status(200).json({
      success: true,
      count: studentsWithEnrollment.length,
      data: studentsWithEnrollment,
    });
  } catch (error) {
    console.error("Get course students error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Get course stats
// @route   GET /api/courses/:id/stats
// @access  Private/Instructor/Admin
export const getCourseStats = async (req: Request, res: Response) => {
  try {
    const course = await Course.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: "studentsEnrolled",
          attributes: [],
          through: { attributes: [] },
          required: false,
        },
        {
          model: Assignment,
          attributes: [],
          required: false,
        },
      ],
      attributes: [
        "id",
        "title",
        [
          // Count students
          Course.sequelize!.literal("COUNT(DISTINCT(students.id))"),
          "studentCount",
        ],
        [
          // Count assignments
          Course.sequelize!.literal("COUNT(DISTINCT(assignments.id))"),
          "assignmentCount",
        ],
      ],
      group: ["Course.id"],
      raw: true,
    });

    if (!course) {
      return res
        .status(404)
        .json({ success: false, message: "Course not found" });
    }

    res.status(200).json({ success: true, data: course });
  } catch (error) {
    console.error("Get course stats error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Get comprehensive course details
// @route   GET /api/courses/:id/details
// @access  Public - All users can access course details
export const getCourseDetails = async (req: Request, res: Response) => {
  try {
    const course = await Course.findByPk(req.params.id);

    if (!course) {
      return res
        .status(404)
        .json({ success: false, message: "Course not found" });
    }

    // All users can access course details - no authorization required

    const courseWithDetails = await Course.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: "courseInstructor",
          attributes: ["id", "first_name", "last_name", "email"],
        },
        {
          model: User,
          as: "studentsEnrolled",
          attributes: [
            "id",
            "first_name",
            "last_name",
            "email",
            "profile_image",
          ],
          through: { attributes: ["enrollment_date", "status", "grade"] },
        },
        {
          model: Assignment,
          include: [
            {
              model: User,
              as: "assignmentCreator",
              attributes: ["id", "first_name", "last_name"],
            },
            {
              model: Submission,
              include: [
                {
                  model: User,
                  as: "submissionStudent",
                  attributes: [
                    "id",
                    "first_name",
                    "last_name",
                    "profile_image",
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    res.status(200).json({ success: true, data: courseWithDetails });
  } catch (error) {
    console.error("Get course details error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
// @desc    Assign instructor to course
// @route   PUT /api/courses/:courseId/assign-instructor
// @access  Private/Admin
export const assignInstructorToCourse = async (req: Request, res: Response) => {
  const transaction = await sequelize.transaction();
  try {
    const { courseId } = req.params;
    const { instructorId } = req.body;

    if (!instructorId) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ success: false, message: "Instructor ID is required" });
    }

    // Check if instructor exists and has the right role
    const instructor = await User.findByPk(instructorId);
    if (
      !instructor ||
      (instructor.role !== "instructor" && instructor.role !== "admin")
    ) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ success: false, message: "Invalid instructor" });
    }

    // Update course with new instructor
    const [updated] = await Course.update(
      { instructor_id: instructorId },
      { where: { id: courseId }, transaction }
    );

    if (!updated) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Course not found" });
    }

    await transaction.commit();
    res
      .status(200)
      .json({ success: true, message: "Instructor assigned successfully" });
  } catch (error) {
    await transaction.rollback();
    console.error("Assign instructor error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Enroll students in course
// @route   POST /api/courses/:courseId/enroll-students
// @access  Private/Instructor/Admin
export const enrollStudentsInCourse = async (req: Request, res: Response) => {
  const transaction = await sequelize.transaction();
  try {
    const { courseId } = req.params;
    const { studentIds } = req.body;

    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ success: false, message: "Student IDs array is required" });
    }

    // Check if course exists
    const course = await Course.findByPk(courseId, { transaction });
    if (!course) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Course not found" });
    }

    // Check if students exist and are actually students
    const students = await User.findAll({
      where: { id: studentIds, role: "student" },
      transaction,
    });

    if (students.length !== studentIds.length) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ success: false, message: "One or more invalid students" });
    }

    // Enroll students
    const enrollments = studentIds.map((studentId) => ({
      user_id: parseInt(studentId),
      course_id: parseInt(courseId),
      enrollment_date: new Date(),
      status: "enrolled" as const,
    }));

    await UserCourse.bulkCreate(enrollments, { transaction });

    await transaction.commit();
    res
      .status(200)
      .json({ success: true, message: "Students enrolled successfully" });
  } catch (error) {
    await transaction.rollback();
    console.error("Enroll students error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Get course assignments
// @route   GET /api/courses/:id/assignments
// @access  Public
export const getCourseAssignments = async (req: Request, res: Response) => {
  try {
    const assignments = await Assignment.findAll({
      where: { course_id: req.params.id },
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

// @desc    Update student status in course
// @route   PUT /api/courses/:courseId/students/:studentId/status
// @access  Private/Instructor/Admin
export const updateStudentStatus = async (req: Request, res: Response) => {
  const transaction = await sequelize.transaction();
  try {
    const { courseId, studentId } = req.params;
    const { status } = req.body;

    // Validate status
    if (!["enrolled", "completed", "dropped"].includes(status)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be enrolled, completed, or dropped",
      });
    }

    // Check if course exists
    const course = await Course.findByPk(courseId, { transaction });
    if (!course) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Course not found" });
    }

    // Check if student exists and is actually a student
    const student = await User.findOne({
      where: { id: studentId, role: "student" },
      transaction,
    });

    if (!student) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Student not found" });
    }

    // Check if enrollment exists
    const enrollment = await UserCourse.findOne({
      where: {
        user_id: parseInt(studentId),
        course_id: parseInt(courseId),
      },
      transaction,
    });

    if (!enrollment) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Student is not enrolled in this course",
      });
    }

    // Update the status
    const updateData: any = { status };

    // If status is completed, set completion date
    if (status === "completed") {
      updateData.completion_date = new Date();
    } else if (status === "dropped" && enrollment.completion_date) {
      // Clear completion date if dropping
      updateData.completion_date = null;
    }

    await enrollment.update(updateData, { transaction });

    await transaction.commit();

    res.status(200).json({
      success: true,
      message: "Student status updated successfully",
      data: enrollment,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Update student status error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Get enrolled courses for current student user
// @route   GET /api/courses/enrolled
// @access  Private/Student
export const getEnrolledCourses = async (req: Request, res: Response) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({
        success: false,
        message: "Only students can access their enrolled courses",
      });
    }

    // Query courses where the current user is enrolled using the many-to-many association
    const courses = await Course.findAll({
      include: [
        {
          model: User,
          as: "studentsEnrolled",
          where: { id: req.user.id },
          attributes: [],
          through: {
            where: { status: "enrolled" },
            attributes: [],
          },
          required: true,
        },
        {
          model: User,
          as: "courseInstructor",
          attributes: ["id", "first_name", "last_name", "email"],
        },
      ],
      where: { is_active: true },
    });

    // Get assignments and quizzes separately to avoid query conflicts
    const courseIds = courses.map((course) => course.id);

    if (courseIds.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: [],
      });
    }

    // Get upcoming assignments for these courses
    const assignments = await Assignment.findAll({
      where: {
        course_id: { [Op.in]: courseIds },
        due_date: { [Op.gte]: new Date() },
        status: "published",
      },
      attributes: ["id", "title", "due_date", "max_score", "course_id"],
      order: [["due_date", "ASC"]],
      limit: 5,
    });

    // Get upcoming quizzes for these courses
    const quizzes = await Quiz.findAll({
      where: {
        course_id: { [Op.in]: courseIds },
        status: "published",
        [Op.or]: [{ end_date: { [Op.gte]: new Date() } }, { end_date: null }],
      },
      attributes: ["id", "title", "end_date", "course_id"],
      order: [["end_date", "ASC"]],
      limit: 5,
    } as any);

    // Group assignments and quizzes by course
    const assignmentsByCourse = assignments.reduce((acc, assignment) => {
      if (!acc[assignment.course_id]) acc[assignment.course_id] = [];
      acc[assignment.course_id].push(assignment);
      return acc;
    }, {} as Record<number, any[]>);

    const quizzesByCourse = quizzes.reduce((acc, quiz) => {
      if (!acc[quiz.course_id]) acc[quiz.course_id] = [];
      acc[quiz.course_id].push(quiz);
      return acc;
    }, {} as Record<number, any[]>);

    // Enhance course data with deadline information
    const enhancedCourses = courses.map((course) => {
      const courseData = course.toJSON();
      const courseAssignments = assignmentsByCourse[course.id] || [];
      const courseQuizzes = quizzesByCourse[course.id] || [];

      // Find next assignment deadline
      const nextAssignment = courseAssignments[0];
      const nextAssignmentDeadline = nextAssignment?.due_date;

      // Find next quiz deadline
      const nextQuiz = courseQuizzes[0];
      const nextQuizDeadline = nextQuiz?.end_date;

      // Determine the next deadline (whichever comes first)
      let nextDeadline = null;
      let nextItemType = null;

      if (nextAssignmentDeadline && nextQuizDeadline) {
        const assignmentDate = new Date(nextAssignmentDeadline);
        const quizDate = new Date(nextQuizDeadline);

        if (assignmentDate <= quizDate) {
          nextDeadline = nextAssignmentDeadline;
          nextItemType = "Assignment";
        } else {
          nextDeadline = nextQuizDeadline;
          nextItemType = "Quiz";
        }
      } else if (nextAssignmentDeadline) {
        nextDeadline = nextAssignmentDeadline;
        nextItemType = "Assignment";
      } else if (nextQuizDeadline) {
        nextDeadline = nextQuizDeadline;
        nextItemType = "Quiz";
      }

      return {
        ...courseData,
        instructor_name: (course as any).courseInstructor
          ? `${(course as any).courseInstructor.first_name} ${
              (course as any).courseInstructor.last_name
            }`.trim()
          : "",
        next_deadline: nextDeadline,
        next_item_type: nextItemType,
        assignment_deadline: nextAssignmentDeadline,
        quiz_deadline: nextQuizDeadline,
        assignments_count: courseAssignments.length,
        quizzes_count: courseQuizzes.length,
        enrolled_students: 1, // The current user
        progress: Math.floor(Math.random() * 100), // Mock progress for now
      };
    });

    res.status(200).json({
      success: true,
      count: enhancedCourses.length,
      data: enhancedCourses,
    });
  } catch (error) {
    console.error("Get enrolled courses error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Get available students for enrollment in a course
// @route   GET /api/courses/:courseId/available-students
// @access  Private (instructor, admin)
export const getAvailableStudents = async (req: Request, res: Response) => {
  try {
    const { courseId } = req.params;

    // First verify the course exists
    const course = await Course.findByPk(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    // Get all enrolled student IDs for this course
    const enrolledStudents = await UserCourse.findAll({
      where: { course_id: courseId },
      attributes: ["user_id"],
    });

    const enrolledStudentIds = enrolledStudents.map((uc) => uc.user_id);

    // Get all students who are NOT enrolled in this course
    const availableStudents = await User.findAll({
      where: {
        role: "student",
        id: {
          [Op.notIn]: enrolledStudentIds.length > 0 ? enrolledStudentIds : [0], // If no enrolled students, exclude ID 0
        },
      },
      attributes: ["id", "first_name", "last_name", "email", "profile_image"],
      order: [["first_name", "ASC"]],
    });

    res.status(200).json({
      success: true,
      count: availableStudents.length,
      data: availableStudents,
    });
  } catch (error) {
    console.error("Get available students error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

import { Request, Response } from "express";
import { User, Course, UserCourse } from "../models";
import { Op } from "sequelize";

// @desc    Get all users
// @route   GET /api/users
// @access  Private/Admin
export const getUsers = async (req: Request, res: Response) => {
  try {
    const { role } = req.query;
    const whereClause: any = {};

    // If role is specified and user is not admin, only allow instructors to get students
    if (role && req.user.role !== "admin") {
      if (role === "student" && req.user.role === "instructor") {
        // Instructors can only get students
        whereClause.role = "student";
      } else {
        return res.status(403).json({
          success: false,
          message: "Not authorized to access this resource",
        });
      }
    }

    const users = await User.findAll({
      where: whereClause,
      attributes: { exclude: ["password"] },
    });
    res.status(200).json({ success: true, count: users.length, data: users });
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Get single user
// @route   GET /api/users/:id
// @access  Private/Admin
export const getUser = async (req: Request, res: Response) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ["password"] },
    });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    res.status(200).json({ success: true, data: user });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
// @desc    Get user's enrolled courses
// @route   GET /api/users/:userId/courses
// @access  Private/Admin/Instructor
export const getUserCourses = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    // Check if user exists
    const user = await User.findByPk(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Only admins and instructors can view user courses
    if (req.user.role !== "admin" && req.user.role !== "instructor") {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this user's courses",
      });
    }

    const courses = await UserCourse.findAll({
      where: { user_id: userId },
      include: [
        {
          model: Course,
          as: "courseInUserCourse",
          include: [
            {
              model: User,
              as: "courseInstructor",
              attributes: ["id", "first_name", "last_name"],
            },
          ],
        },
      ],
    });

    res
      .status(200)
      .json({ success: true, count: courses.length, data: courses });
  } catch (error) {
    console.error("Get user courses error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Create user
// @route   POST /api/users
// @access  Private/Admin
export const createUser = async (req: Request, res: Response) => {
  try {
    const {
      first_name,
      last_name,
      email,
      password,
      role = "student",
    } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res
        .status(400)
        .json({ success: false, message: "User already exists" });
    }

    const user = await User.create({
      first_name,
      last_name,
      email,
      password,
      role,
    });

    res.status(201).json({
      success: true,
      data: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Create user error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private/Admin
export const updateUser = async (req: Request, res: Response) => {
  try {
    const { first_name, last_name, email, role } = req.body;

    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Update fields
    user.first_name = first_name || user.first_name;
    user.last_name = last_name || user.last_name;
    user.email = email || user.email;
    user.role = role || user.role;

    await user.save();

    res.status(200).json({
      success: true,
      data: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private/Admin
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    await user.destroy();

    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Enroll user in course
// @route   POST /api/users/:userId/enroll/:courseId
// @access  Private/Admin
export const enrollInCourse = async (req: Request, res: Response) => {
  try {
    const { userId, courseId } = req.params;

    // Check if user exists
    const user = await User.findByPk(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Check if course exists
    const course = await Course.findByPk(courseId);
    if (!course) {
      return res
        .status(404)
        .json({ success: false, message: "Course not found" });
    }

    // Check if already enrolled
    const existingEnrollment = await UserCourse.findOne({
      where: { user_id: userId, course_id: courseId },
    });

    if (existingEnrollment) {
      return res.status(400).json({
        success: false,
        message: "User already enrolled in this course",
      });
    }

    // Create enrollment
    await UserCourse.create({
      user_id: parseInt(userId),
      course_id: parseInt(courseId),
      enrollment_date: new Date(),
      status: "enrolled",
    });

    res
      .status(200)
      .json({ success: true, message: "User enrolled successfully" });
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
    const { userId, courseId } = req.params;

    const enrollment = await UserCourse.findOne({
      where: { user_id: parseInt(userId), course_id: parseInt(courseId) },
    });

    if (!enrollment) {
      return res
        .status(404)
        .json({ success: false, message: "Enrollment not found" });
    }

    await enrollment.destroy();

    res
      .status(200)
      .json({ success: true, message: "User withdrawn successfully" });
  } catch (error) {
    console.error("Withdraw from course error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

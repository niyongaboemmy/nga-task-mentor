import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/User.model";

declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

interface JwtPayload {
  id: number;
  role: string;
  termId?: number; // Add termId to payload interface
  iat: number;
  exp: number;
}

// Protect routes
export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    let token;

    // Check for token in Authorization header
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies && req.cookies.token) {
      // Check for token in cookies
      token = req.cookies.token;
    }

    // Make sure token exists
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Not authorized to access this route",
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;

      // Get user from the token
      const user = await User.findByPk(decoded.id);

      if (!user) {
        return res
          .status(401)
          .json({ success: false, message: "User not found" });
      }

      // Add user to request object
      req.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        mis_user_id: user.mis_user_id,
        termId: decoded.termId, // Attach termId from token to req.user
      };

      next();
    } catch (error) {
      console.error("Token verification error:", error);
      return res.status(401).json({
        success: false,
        message: "Not authorized to access this route",
      });
    }
  } catch (error) {
    console.error("Authentication error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error during authentication" });
  }
};

// Grant access to specific roles
export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role ${req.user.role} is not authorized to access this route`,
      });
    }
    next();
  };
};

// Check if user is enrolled in course
export const checkEnrollment = (courseIdParam = "courseId") => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { UserCourse } = require("../models");
      const courseId = req.params[courseIdParam] || req.params.id;
      const userId = req.user.id;

      const enrollment = await UserCourse.findOne({
        where: { user_id: userId, course_id: parseInt(courseId) },
      });

      if (!enrollment) {
        return res.status(403).json({
          success: false,
          message: "Not enrolled in this course",
        });
      }

      next();
    } catch (error) {
      console.error("Enrollment check error:", error);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  };
};

// Check if user is course instructor
export const isCourseInstructor = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { Course, Assignment } = require("../models");

    // Check if this is an assignment route (/:id/status or other assignment endpoints)
    // If there's an assignment_id in params or if the route pattern suggests it's an assignment route
    const isAssignmentRoute =
      req.params.id &&
      (req.route.path.includes("/assignments/") ||
        req.originalUrl.includes("/assignments/"));

    let courseId;

    if (isAssignmentRoute) {
      // For assignment routes, first find the assignment to get the course_id
      const assignment = await Assignment.findByPk(req.params.id);

      if (!assignment) {
        return res
          .status(404)
          .json({ success: false, message: "Assignment not found" });
      }

      courseId = assignment.course_id;
    } else {
      // For course routes, use the id directly as course_id
      courseId = req.params.id || req.params.courseId;
    }

    next();
  } catch (error) {
    console.error("Course instructor check error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

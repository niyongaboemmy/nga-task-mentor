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
  academicYearId?: number;
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
    } else if (req.cookies && req.cookies.tm_auth_token) {
      // Check for token in cookies
      token = req.cookies.tm_auth_token;
    }

    // Make sure token exists and is not a placeholder
    if (
      !token ||
      token === "none" ||
      token === "null" ||
      token === "undefined"
    ) {
      console.log(
        "❌ No token found in request or token is placeholder:",
        token,
      );
      return res.status(401).json({
        success: false,
        message: "Not authorized to access this route",
      });
    }

    try {
      // Verify token
      console.log("✅ Verifying token...");
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
      console.log("✅ Token verified successfully for user ID:", decoded.id);

      // Get user from the token
      const user = await User.findByPk(decoded.id);

      if (!user) {
        console.log("❌ User not found for ID:", decoded.id);
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
        academicYearId: decoded.academicYearId,
      };

      next();
    } catch (error: any) {
      console.error(
        `❌ Token verification error for token: "${token.substring(0, 10)}..."`,
        error.message,
      );
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

// Require a short-lived step-up token (X-Db-Access-Token) proving the admin
// recently re-entered their password, in addition to the normal session JWT.
// Used to gate the Database Management tool's raw-SQL/table-CRUD endpoints.
export const requireDbStepUp = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const token = req.headers["x-db-access-token"];

  if (!token || typeof token !== "string") {
    return res.status(401).json({
      success: false,
      message: "Database access token required",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      id: number;
      dbAccess: boolean;
    };

    if (decoded.dbAccess !== true || decoded.id !== req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Invalid database access token",
      });
    }

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired database access token",
    });
  }
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

// Check if user is the owning instructor of the assignment being mutated (or admin).
// Courses themselves live in the external MIS (the local Course/UserCourse tables
// were dropped — see migration 20260114224114-drop-courses-and-user-courses-tables),
// so "owns the course" is determined via Assignment.created_by, the same field
// quiz.controller.ts/question.controller.ts already use for this check.
export const isCourseInstructor = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { Assignment } = require("../models");

    const assignment = await Assignment.findByPk(req.params.id);

    if (!assignment) {
      return res
        .status(404)
        .json({ success: false, message: "Assignment not found" });
    }

    if (req.user.role !== "admin" && assignment.created_by !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to modify this assignment",
      });
    }

    next();
  } catch (error) {
    console.error("Course instructor check error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

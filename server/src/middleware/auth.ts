import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/User.model";
import { Role } from "../models/Role.model";
import { Permission } from "../models/Permission.model";

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

      // Get user from the token, along with its role's resolved permissions
      const user = await User.findByPk(decoded.id, {
        include: [{ model: Role, include: [Permission] }],
      });

      if (!user) {
        console.log("❌ User not found for ID:", decoded.id);
        return res
          .status(401)
          .json({ success: false, message: "User not found" });
      }

      const permissionKeys = (user.roleRecord?.permissions ?? []).map(
        (p) => p.key,
      );

      // Add user to request object
      req.user = {
        id: user.id,
        email: user.email,
        role: user.role, // @deprecated legacy flat role string, kept for backward compatibility
        roleId: user.role_id,
        roleName: user.roleRecord?.name,
        permissions: new Set(permissionKeys),
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

/**
 * @deprecated Grant access to specific roles by string comparison. Superseded
 * by `authorizePermission`, which checks the resolved permission set instead
 * of a flat role string, allowing custom roles to be created without code
 * changes. Retained only until every route/controller call site has been
 * migrated and verified.
 */
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

// Grant access if the user holds ANY of the given permissions (OR semantics),
// matching the OR-style usage the deprecated `authorize(...roles)` had.
export const authorizePermission = (...required: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const granted: Set<string> = req.user?.permissions ?? new Set();
    const has = required.some((perm) => granted.has(perm));
    if (!has) {
      return res.status(403).json({
        success: false,
        message: `Missing required permission: ${required.join(" or ")}`,
      });
    }
    next();
  };
};

// Grant access only if the user holds ALL of the given permissions (AND
// semantics) — for the rare route that genuinely needs more than one
// capability at once.
export const authorizeAllPermissions = (...required: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const granted: Set<string> = req.user?.permissions ?? new Set();
    const has = required.every((perm) => granted.has(perm));
    if (!has) {
      return res.status(403).json({
        success: false,
        message: `Missing required permissions: ${required.join(" and ")}`,
      });
    }
    next();
  };
};

// Allow access if the requesting user is acting on their own resource
// (req.params[idParam] === req.user.id), OR if they hold one of the given
// "view/manage others" permissions. This is the general "own vs anyone's X"
// pattern used across users, submissions, quiz results, report cards, and
// proctoring sessions.
export const selfOrPermission = (idParam: string, ...permsForOthers: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const targetId = String(req.params[idParam]);
    const isSelf = req.user && String(req.user.id) === targetId;
    const granted: Set<string> = req.user?.permissions ?? new Set();
    const hasOverride = permsForOthers.some((perm) => granted.has(perm));
    if (!isSelf && !hasOverride) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to access this resource",
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

    const granted: Set<string> = req.user?.permissions ?? new Set();
    if (
      !granted.has("ASSIGNMENTS_MANAGE_ANY") &&
      assignment.created_by !== req.user.id
    ) {
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

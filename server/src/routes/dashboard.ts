import { Router } from "express";
import {
  getStudentStats,
  getInstructorStats,
  getAdminStats,
  getStudentPendingAssignments,
  getRecentActivity,
  getInstructorCourses,
  getInstructorPendingGrading,
  getAdminGradingSummary,
  getActiveProctoringCount,
} from "../controllers/dashboardController";
import { protect, authorize } from "../middleware/auth";

const router = Router();

// All dashboard routes require authentication
router.use(protect);

// Student dashboard endpoints
router.get("/student/stats", authorize("student"), getStudentStats);
router.get(
  "/student/pending-assignments",
  authorize("student"),
  getStudentPendingAssignments,
);

// Instructor dashboard endpoints
router.get(
  "/instructor/stats",
  authorize("instructor", "admin"),
  getInstructorStats,
);
router.get(
  "/instructor/courses",
  authorize("instructor", "admin"),
  getInstructorCourses,
);
router.get(
  "/instructor/pending-grading",
  authorize("instructor", "admin"),
  getInstructorPendingGrading,
);
router.get(
  "/instructor/active-proctoring",
  authorize("instructor", "admin"),
  getActiveProctoringCount,
);

// Admin dashboard endpoints
router.get("/admin/stats", authorize("admin"), getAdminStats);
router.get(
  "/admin/grading-summary",
  authorize("admin"),
  getAdminGradingSummary,
);

// Common endpoints (accessible by all authenticated users)
router.get("/activity", getRecentActivity);

export default router;

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
import { protect, authorizePermission } from "../middleware/auth";

const router = Router();

// All dashboard routes require authentication
router.use(protect);

// Student dashboard endpoints
router.get("/student/stats", authorizePermission("DASHBOARD_VIEW_STUDENT"), getStudentStats);
router.get(
  "/student/pending-assignments",
  authorizePermission("DASHBOARD_VIEW_STUDENT"),
  getStudentPendingAssignments,
);

// Instructor dashboard endpoints
router.get(
  "/instructor/stats",
  authorizePermission("DASHBOARD_VIEW_INSTRUCTOR"),
  getInstructorStats,
);
router.get(
  "/instructor/courses",
  authorizePermission("DASHBOARD_VIEW_INSTRUCTOR"),
  getInstructorCourses,
);
router.get(
  "/instructor/pending-grading",
  authorizePermission("DASHBOARD_VIEW_INSTRUCTOR"),
  getInstructorPendingGrading,
);
router.get(
  "/instructor/active-proctoring",
  authorizePermission("DASHBOARD_VIEW_INSTRUCTOR"),
  getActiveProctoringCount,
);

// Admin dashboard endpoints
router.get("/admin/stats", authorizePermission("DASHBOARD_VIEW_ADMIN"), getAdminStats);
router.get(
  "/admin/grading-summary",
  authorizePermission("DASHBOARD_VIEW_ADMIN"),
  getAdminGradingSummary,
);

// Common endpoints (accessible by all authenticated users)
router.get("/activity", getRecentActivity);

export default router;

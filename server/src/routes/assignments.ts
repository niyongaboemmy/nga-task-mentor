import { Router } from "express";
import {
  getAssignments,
  getAssignment,
  createAssignment,
  updateAssignment,
  updateAssignmentStatus,
  deleteAssignment,
  publishAssignment,
  getAssignmentSubmissions,
  getEnrolledAssignments,
  submitAssignment,
} from "../controllers/assignment.controller";
import { protect, authorize, isCourseInstructor } from "../middleware/auth";
import { timezoneMiddleware } from "../utils/dateUtils";
import { uploadAssignmentAttachment } from "../middleware/assignmentUpload";
import { uploadSubmission } from "../middleware/submissionUpload";

// Configure multer for file uploads

const router = Router();

// Public routes
router.get("/", getAssignments);
// Get enrolled assignments for students
router.get("/enrolled", protect, authorize("student"), getEnrolledAssignments);
router.get("/:id", getAssignment);

// Protected routes
router.use(protect);

// Instructor and admin routes - these should be for general assignment operations
// Instructor and admin routes - these should be for general assignment operations
router.post(
  "/",
  authorize("instructor", "admin"),
  uploadAssignmentAttachment.any(),
  timezoneMiddleware(["due_date"]),
  createAssignment,
);

// Course instructor and admin routes
router
  .route("/:id")
  .put(
    authorize("instructor", "admin"),
    isCourseInstructor,
    uploadAssignmentAttachment.any(),
    timezoneMiddleware(["due_date"]),
    updateAssignment,
  )
  .delete(
    authorize("instructor", "admin"),
    isCourseInstructor,
    deleteAssignment,
  );

// Publish assignment (legacy route - keeping for backward compatibility)
router.put(
  "/:id/publish",
  authorize("instructor", "admin"),
  isCourseInstructor,
  publishAssignment,
);

// Update assignment status
router.patch(
  "/:id/status",
  authorize("instructor", "admin"),
  isCourseInstructor,
  updateAssignmentStatus,
);

// Submit assignment (for students) - temporarily remove auth for testing
router.post(
  "/:id/submit",
  uploadSubmission.single("file_submission"), // Apply shared multer middleware
  protect,
  authorize("student"),
  submitAssignment,
);

// Get submissions for an assignment - Students see only their own, Instructors see all
router.get(
  "/:id/submissions",
  protect,
  // authorize("instructor", "admin"), // Students can view their own submissions
  getAssignmentSubmissions,
);

// Download submissions as zip (TODO: implement)
// router.get(
//   "/:id/submissions/download",
//   authorize("instructor", "admin"),
//   isCourseInstructor,
//   downloadSubmissions
// );

export default router;

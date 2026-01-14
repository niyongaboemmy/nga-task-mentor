import { Router } from "express";
import {
  getSubmissions,
  getSubmission,
  createSubmission,
  updateSubmission,
  deleteSubmission,
  downloadFile,
  gradeSubmission,
} from "../controllers/submission.controller";
import { protect, authorize, checkEnrollment } from "../middleware/auth";

const router = Router();

// Protected routes
router.use(protect);

// Student routes
router.post(
  "/assignments/:assignmentId/submissions",
  authorize("student"),
  checkEnrollment(),
  createSubmission
);

// Student and instructor routes
router
  .route("/:id")
  .get(authorize("student", "instructor", "admin"), getSubmission)
  .put(authorize("student", "instructor", "admin"), updateSubmission)
  .delete(authorize("student", "instructor", "admin"), deleteSubmission);

// Get submissions (for assignments or users)
router.get("/", authorize("student", "instructor", "admin"), getSubmissions);

// Download submission file
router.get(
  "/:id/files/:fileId",
  authorize("student", "instructor", "admin"),
  downloadFile
);

// Grade submission (instructor/admin only)
router.patch(
  "/:id/grade",
  authorize("instructor", "admin"),
  gradeSubmission
);

export default router;

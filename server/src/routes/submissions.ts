import { Router } from "express";
import {
  getSubmissions,
  getSubmission,
  createSubmission,
  updateSubmission,
  deleteSubmission,
  downloadFile,
  gradeSubmission,
  addComment,
} from "../controllers/submission.controller";
import { protect, authorizePermission, checkEnrollment } from "../middleware/auth";
import { uploadSubmission } from "../middleware/submissionUpload";

const router = Router();

// Protected routes
router.use(protect);

// Student routes
router.post(
  "/assignments/:assignmentId/submissions",
  authorizePermission("SUBMISSIONS_CREATE"),
  checkEnrollment(),
  uploadSubmission.single("file_submission"),
  createSubmission,
);

// Student and instructor routes (controller enforces own-vs-all scoping)
router
  .route("/:id")
  .get(
    authorizePermission("SUBMISSIONS_VIEW_OWN", "SUBMISSIONS_VIEW_ALL"),
    getSubmission,
  )
  .put(
    authorizePermission("SUBMISSIONS_VIEW_OWN", "SUBMISSIONS_VIEW_ALL"),
    uploadSubmission.single("file_submission"),
    updateSubmission,
  )
  .delete(
    authorizePermission("SUBMISSIONS_VIEW_OWN", "SUBMISSIONS_VIEW_ALL"),
    deleteSubmission,
  );

// Get submissions (for assignments or users)
router.get(
  "/",
  authorizePermission("SUBMISSIONS_VIEW_OWN", "SUBMISSIONS_VIEW_ALL"),
  getSubmissions,
);

// Download submission file
router.get(
  "/:id/files/:fileId",
  authorizePermission("SUBMISSIONS_VIEW_OWN", "SUBMISSIONS_VIEW_ALL"),
  downloadFile,
);

// Grade submission (instructor/admin only)
router.patch("/:id/grade", authorizePermission("SUBMISSIONS_GRADE"), gradeSubmission);

// Add comment to submission
router.post(
  "/:id/comments",
  authorizePermission("SUBMISSIONS_VIEW_OWN", "SUBMISSIONS_VIEW_ALL"),
  addComment,
);

export default router;

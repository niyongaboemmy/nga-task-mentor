import { Router } from "express";
import {
  getSubmissions,
  getGroupedSubmissions,
  getSubmission,
  createSubmission,
  updateSubmission,
  deleteSubmission,
  downloadFile,
  gradeSubmission,
  addComment,
} from "../controllers/submission.controller";
import { protect, authorizePermission, checkEnrollment } from "../middleware/auth";
import { intOrNull, trackOnSuccess } from "../activity/keyEvents";
import { uploadSubmission } from "../middleware/submissionUpload";
import { validateBody } from "../middleware/validation.middleware";
import { draftFeedbackSchema } from "../validations/assignmentAi.validation";
import { draftSubmissionFeedback } from "../controllers/submissionAi.controller";

const router = Router();

// Protected routes
router.use(protect);

// Student routes
router.post(
  "/assignments/:assignmentId/submissions",
  authorizePermission("SUBMISSIONS_CREATE"),
  checkEnrollment(),
  uploadSubmission.single("file_submission"),
  trackOnSuccess("tm.assignment.submit", (req) => ({
    assignment_id: intOrNull(req.params.assignmentId),
  })),
  createSubmission,
);

// Submissions grouped by subject + type, role-scoped, paginated (redesigned page)
router.get(
  "/grouped",
  authorizePermission("SUBMISSIONS_VIEW_OWN", "SUBMISSIONS_VIEW_ALL"),
  getGroupedSubmissions,
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
router.patch(
  "/:id/grade",
  authorizePermission("SUBMISSIONS_GRADE"),
  trackOnSuccess("tm.grade.save", (req) => ({
    kind: "assignment",
    submission_id: intOrNull(req.params.id),
  })),
  gradeSubmission,
);

// AI marking draft for the teacher (nothing saved; see submissionAi.controller.ts)
router.post(
  "/:id/ai-feedback",
  authorizePermission("SUBMISSIONS_GRADE"),
  validateBody(draftFeedbackSchema),
  trackOnSuccess("tm.grade.ai_draft", (req) => ({
    kind: "assignment",
    submission_id: intOrNull(req.params.id),
  })),
  draftSubmissionFeedback,
);

// Add comment to submission
router.post(
  "/:id/comments",
  authorizePermission("SUBMISSIONS_VIEW_OWN", "SUBMISSIONS_VIEW_ALL"),
  addComment,
);

export default router;

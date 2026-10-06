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
  getGroupedAssignments,
  submitAssignment,
  gradeUnsubmittedStudent,
} from "../controllers/assignment.controller";
import { protect, authorizePermission, isCourseInstructor } from "../middleware/auth";
import { intOrNull, trackOnSuccess } from "../activity/keyEvents";
import { timezoneMiddleware } from "../utils/dateUtils";
import { assignmentAttachments } from "../middleware/assignmentUpload";
import { uploadSubmission } from "../middleware/submissionUpload";
import { validateBody } from "../middleware/validation.middleware";
import { generateRubricSchema } from "../validations/assignmentAi.validation";
import { generateAssignmentRubric } from "../controllers/assignmentAi.controller";

const router = Router();

// All routes require authentication
router.use(protect);

// Get enrolled assignments for students
router.get("/enrolled", authorizePermission("ASSIGNMENTS_VIEW"), getEnrolledAssignments);
// Assignments grouped by subject, role-scoped, paginated (redesigned /assignments page)
router.get("/grouped", authorizePermission("ASSIGNMENTS_VIEW"), getGroupedAssignments);
router.get("/", authorizePermission("ASSIGNMENTS_VIEW"), getAssignments);
router.get("/:id", authorizePermission("ASSIGNMENTS_VIEW"), getAssignment);

// AI rubric from the (unsaved) description — nothing is stored.
router.post(
  "/ai/rubric",
  authorizePermission("ASSIGNMENTS_CREATE", "ASSIGNMENTS_EDIT"),
  validateBody(generateRubricSchema),
  generateAssignmentRubric,
);

// Instructor and admin routes - these should be for general assignment operations
router.post(
  "/",
  authorizePermission("ASSIGNMENTS_CREATE"),
  assignmentAttachments,
  timezoneMiddleware(["due_date"]),
  createAssignment,
);

// Course instructor and admin routes
router
  .route("/:id")
  .put(
    authorizePermission("ASSIGNMENTS_EDIT"),
    isCourseInstructor,
    assignmentAttachments,
    timezoneMiddleware(["due_date"]),
    updateAssignment,
  )
  .delete(
    authorizePermission("ASSIGNMENTS_DELETE"),
    isCourseInstructor,
    deleteAssignment,
  );

// Publish assignment (legacy route - keeping for backward compatibility)
router.put(
  "/:id/publish",
  authorizePermission("ASSIGNMENTS_EDIT"),
  isCourseInstructor,
  publishAssignment,
);

// Update assignment status
router.patch(
  "/:id/status",
  authorizePermission("ASSIGNMENTS_EDIT"),
  isCourseInstructor,
  updateAssignmentStatus,
);

router.post(
  "/:id/submit",
  uploadSubmission.single("file_submission"),
  authorizePermission("SUBMISSIONS_CREATE"),
  trackOnSuccess("tm.assignment.submit", (req) => ({ assignment_id: intOrNull(req.params.id) })),
  submitAssignment,
);

// Get submissions for an assignment - Students see only their own (controller-scoped),
// instructors/admins see all (ASSIGNMENTS_VIEW_SUBMISSIONS)
router.get(
  "/:id/submissions",
  authorizePermission("ASSIGNMENTS_VIEW", "ASSIGNMENTS_VIEW_SUBMISSIONS"),
  getAssignmentSubmissions,
);

// Grade a student who has not submitted (instructor/admin only)
router.post(
  "/:assignmentId/grade-student",
  authorizePermission("SUBMISSIONS_GRADE"),
  trackOnSuccess("tm.grade.save", (req) => ({
    kind: "assignment",
    assignment_id: intOrNull(req.params.assignmentId),
  })),
  gradeUnsubmittedStudent,
);

// Download submissions as zip (TODO: implement)
// router.get(
//   "/:id/submissions/download",
//   authorize("instructor", "admin"),
//   isCourseInstructor,
//   downloadSubmissions
// );

export default router;

import { markStudentSubmitted } from "../controllers/markSubmitted.controller";
import { Router } from "express";
import {
  getAssignments,
  getAssignment,
  createAssignment,
  updateAssignment,
  updateAssignmentStatus,
  updateAssignmentMarksScope,
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
import { submissionFile } from "../middleware/submissionUpload";
import { validateBody } from "../middleware/validation.middleware";
import { generateRubricSchema } from "../validations/assignmentAi.validation";
import { generateAssignmentRubric } from "../controllers/assignmentAi.controller";
import { requireAi } from "../middleware/requireAi";
import { guard, byParam, ownWork, withStudents } from "../services/approvalLock";

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
  requireAi("author"),
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
    guard("assessment", byParam("assignment", "id")), updateAssignment,
  )
  .delete(
    authorizePermission("ASSIGNMENTS_DELETE"),
    isCourseInstructor,
    guard("assessment", byParam("assignment", "id")), deleteAssignment,
  );

// Publish assignment (legacy route - keeping for backward compatibility)
router.put(
  "/:id/publish",
  authorizePermission("ASSIGNMENTS_EDIT"),
  isCourseInstructor,
  guard("assessment", byParam("assignment", "id")), publishAssignment,
);

// Marks status: counted, or part of another assessment
router.patch(
  "/:id/marks-scope",
  authorizePermission("ASSIGNMENTS_EDIT"),
  isCourseInstructor,
  guard("assessment", byParam("assignment", "id")), updateAssignmentMarksScope,
);

// Update assignment status
router.patch(
  "/:id/status",
  authorizePermission("ASSIGNMENTS_EDIT"),
  isCourseInstructor,
  guard("assessment", byParam("assignment", "id")), updateAssignmentStatus,
);

router.post(
  "/:id/submit",
  submissionFile,
  authorizePermission("SUBMISSIONS_CREATE"),
  trackOnSuccess("tm.assignment.submit", (req) => ({ assignment_id: intOrNull(req.params.id) })),
  guard("mark", ownWork("assignment", { param: "id" })), submitAssignment,
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
  guard("mark", withStudents("assignment", "assignmentId", (req) => ({ mis: [Number(req.body?.student_mis_id)] }))), gradeUnsubmittedStudent,
);

// Mark a student's work as submitted on their behalf, so it can be graded
router.post(
  "/:assignmentId/students/:studentId/mark-submitted",
  authorizePermission("SUBMISSIONS_GRADE"),
  guard("mark", withStudents("assignment", "assignmentId", (req) => ({ local: [Number(req.params.studentId)] }))), markStudentSubmitted,
);

// Download submissions as zip (TODO: implement)
// router.get(
//   "/:id/submissions/download",
//   authorize("instructor", "admin"),
//   isCourseInstructor,
//   downloadSubmissions
// );

export default router;

import express from "express";
import {
  getCourses,
  getCourse,
  getCourseStudents,
  getCourseGrades,
  getStudentOverallGrades,
  createCourse,
  updateCourse,
  deleteCourse,
  getClassGroups,
} from "../controllers/course.controller";
import {
  getCourseAssignments,
  createAssignment,
} from "../controllers/assignment.controller";
import { getQuizzes, createQuiz } from "../controllers/quiz.controller";
import { timezoneMiddleware } from "../utils/dateUtils";
import { uploadAssignmentAttachment } from "../middleware/assignmentUpload";

import { protect, authorizePermission } from "../middleware/auth";
import { requireMisToken } from "../middleware/misAuth";

const router = express.Router();

// All course routes require authentication and MIS auth
router.use(protect);
router.use(requireMisToken);

router
  .route("/")
  .get(authorizePermission("COURSES_VIEW"), getCourses)
  .post(authorizePermission("COURSES_CREATE"), createCourse);

router.route("/class-groups").get(authorizePermission("COURSES_VIEW"), getClassGroups);

router
  .route("/my-grades")
  .get(authorizePermission("COURSES_VIEW_OWN_GRADES"), getStudentOverallGrades);

router
  .route("/:id")
  .get(authorizePermission("COURSES_VIEW"), getCourse)
  .put(authorizePermission("COURSES_EDIT"), updateCourse)
  .delete(authorizePermission("COURSES_DELETE"), deleteCourse);
router
  .route("/:id/students")
  .get(authorizePermission("COURSES_VIEW_STUDENTS"), getCourseStudents);
router
  .route("/:id/grades")
  .get(
    authorizePermission("COURSES_VIEW_GRADES", "COURSES_VIEW_OWN_GRADES"),
    getCourseGrades,
  );
router
  .route("/:courseId/assignments")
  .get(authorizePermission("ASSIGNMENTS_VIEW"), getCourseAssignments)
  .post(
    authorizePermission("ASSIGNMENTS_CREATE"),
    uploadAssignmentAttachment.any(),
    timezoneMiddleware(["due_date"]),
    createAssignment,
  );

// Quiz routes for courses
router
  .route("/:courseId/quizzes")
  .get(protect, authorizePermission("QUIZZES_VIEW"), getQuizzes)
  .post(protect, authorizePermission("QUIZZES_CREATE"), createQuiz);

export default router;

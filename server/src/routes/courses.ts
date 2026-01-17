import express from "express";
import {
  getCourses,
  getCourse,
  getCourseStudents,
  createCourse,
  updateCourse,
  deleteCourse,
} from "../controllers/course.controller";
import {
  getCourseAssignments,
  createAssignment,
} from "../controllers/assignment.controller";
import { getQuizzes, createQuiz } from "../controllers/quiz.controller";
import { timezoneMiddleware } from "../utils/dateUtils";

import { protect, authorize } from "../middleware/auth";
import { requireMisToken } from "../middleware/misAuth";

const router = express.Router();

// All course routes require authentication and MIS auth
router.use(protect);
router.use(requireMisToken);

router.route("/").get(getCourses).post(createCourse);

router.route("/:id").get(getCourse).put(updateCourse).delete(deleteCourse);
router.route("/:id/students").get(getCourseStudents);
router
  .route("/:courseId/assignments")
  .get(getCourseAssignments)
  .post(
    authorize("instructor", "admin"),
    timezoneMiddleware(["due_date"]),
    createAssignment
  );

// Quiz routes for courses
router
  .route("/:courseId/quizzes")
  .get(protect, getQuizzes)
  .post(protect, authorize("instructor", "admin"), createQuiz);

export default router;

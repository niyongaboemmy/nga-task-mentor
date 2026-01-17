import { Router, Request, Response } from "express";

import {
  getCourses,
  getCourse,
  getCourseDetails,
  createCourse,
  updateCourse,
  deleteCourse,
  getCourseStudents,
  getCourseStats,
  assignInstructorToCourse,
  enrollStudentsInCourse,
  getCourseAssignments,
  getEnrolledCourses,
  updateStudentStatus,
  getAvailableStudents,
} from "../controllers/course.controller";
import { createAssignment } from "../controllers/assignment.controller";
import { getQuizzes, createQuiz } from "../controllers/quiz.controller";
import { protect, authorize, isCourseInstructor } from "../middleware/auth";

const router = Router();

// Public routes
router.get("/", getCourses);
router.get("/enrolled", protect, authorize("student"), getEnrolledCourses);
router.get("/:id", getCourse);
router.get("/:id/details", getCourseDetails);
router.get("/:id/assignments", getCourseAssignments);

// Quiz routes for courses
router
  .route("/:courseId/quizzes")
  .get(protect, getQuizzes)
  .post(protect, authorize("instructor", "admin"), createQuiz);

// Protected routes
router.use(protect);

// Handle GET requests to enrollment endpoints with proper error message
router.get("/:courseId/enroll-students", (req: Request, res: Response) => {
  res.status(405).json({
    success: false,
    message: "Enrollment must be done via POST request. Please use the enrollment interface.",
    availableMethods: ["POST"],
  });
});

// Instructor and admin routes
router.post("/", authorize("instructor", "admin"), createCourse);

// Course instructor and admin routes
router
  .route("/:id")
  .put(isCourseInstructor, updateCourse)
  .delete(isCourseInstructor, deleteCourse);

// Course stats - only for instructors and admins
router.get("/:id/stats", isCourseInstructor, getCourseStats);

// Student management - only for instructors and admins
router.get("/:id/students", isCourseInstructor, getCourseStudents);

// Get available students for enrollment
router.get("/:courseId/available-students", protect, authorize("instructor", "admin"), getAvailableStudents);

// Update student status in course
router.put("/:courseId/students/:studentId/status", isCourseInstructor, updateStudentStatus);

// Assign instructor to course (admin only)
router.put("/:courseId/assign-instructor", authorize("admin"), assignInstructorToCourse);

// Enroll students in course
router.post("/:courseId/enroll-students", authorize("instructor", "admin"), enrollStudentsInCourse);

// Create assignment for course
router.post("/:courseId/assignments", authorize("instructor", "admin"), isCourseInstructor, createAssignment);

export default router;

import { Router } from "express";
import {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  enrollInCourse,
  withdrawFromCourse,
  getUserCourses,
  getStudentAssignments,
  getStudentQuizzes,
  getProfilePicture,
} from "../controllers/user.controller";
import { protect, authorizePermission, selfOrPermission } from "../middleware/auth";

const router = Router();

// Public route for profile pictures
router.get("/profile-picture/:filename", getProfilePicture);

// All other routes are protected
router.use(protect);

router
  .route("/")
  .get(authorizePermission("USERS_VIEW_ALL"), getUsers)
  .post(authorizePermission("USERS_CREATE"), createUser);

router
  .route("/:id")
  .get(selfOrPermission("id", "USERS_VIEW_ALL"), getUser)
  .put(authorizePermission("USERS_EDIT"), updateUser)
  .delete(authorizePermission("USERS_DELETE"), deleteUser);

// Enroll/withdraw from course
router
  .route("/:userId/enroll/:courseId")
  .post(
    selfOrPermission("userId", "USERS_MANAGE_ENROLLMENT"),
    enrollInCourse,
  )
  .delete(
    selfOrPermission("userId", "USERS_MANAGE_ENROLLMENT"),
    withdrawFromCourse,
  );

// Get user's assignments, quizzes, and courses
router.get(
  "/:userId/assignments",
  selfOrPermission("userId", "USERS_VIEW_OTHERS_ACTIVITY"),
  getStudentAssignments,
);
router.get(
  "/:userId/quizzes",
  selfOrPermission("userId", "USERS_VIEW_OTHERS_ACTIVITY"),
  getStudentQuizzes,
);
router.get(
  "/:userId/courses",
  selfOrPermission("userId", "USERS_VIEW_OTHERS_ACTIVITY"),
  getUserCourses,
);

export default router;

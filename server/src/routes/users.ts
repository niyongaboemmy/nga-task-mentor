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
  getProfilePicture,
} from "../controllers/user.controller";
import { protect, authorize } from "../middleware/auth";

const router = Router();

// Public route for profile pictures
router.get("/profile-picture/:filename", getProfilePicture);

// All other routes are protected
router.use(protect);

// Admin routes
router
  .route("/")
  .get(authorize("admin", "instructor"), getUsers)
  .post(authorize("admin"), createUser);

router
  .route("/:id")
  .get(getUser)
  .put(authorize("admin"), updateUser)
  .delete(authorize("admin"), deleteUser);

// Enroll/withdraw from course
router
  .route("/:userId/enroll/:courseId")
  .post(enrollInCourse)
  .delete(withdrawFromCourse);

// Get user's courses
router.get("/:userId/courses", getUserCourses);

export default router;

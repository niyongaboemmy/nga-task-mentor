import { Router } from "express";
import {
  getCourseQuestions,
  getQuestionBankQuestion,
  createCourseQuestion,
  updateCourseQuestion,
  deleteCourseQuestion,
} from "../controllers/questionBank.controller";
import { protect, authorize } from "../middleware/auth";

const router = Router({ mergeParams: true }); // mergeParams lets us access :courseId from parent

router.use(protect);

// GET    /api/courses/:courseId/question-bank
// POST   /api/courses/:courseId/question-bank
router
  .route("/")
  .get(authorize("instructor", "admin"), getCourseQuestions)
  .post(authorize("instructor", "admin"), createCourseQuestion);

// GET    /api/courses/:courseId/question-bank/:id
// PUT    /api/courses/:courseId/question-bank/:id
// DELETE /api/courses/:courseId/question-bank/:id
router
  .route("/:id")
  .get(authorize("instructor", "admin"), getQuestionBankQuestion)
  .put(authorize("instructor", "admin"), updateCourseQuestion)
  .delete(authorize("instructor", "admin"), deleteCourseQuestion);

export default router;

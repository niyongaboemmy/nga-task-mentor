import { Router } from "express";
import {
  getCourseQuestions,
  getQuestionBankQuestion,
  createCourseQuestion,
  updateCourseQuestion,
  deleteCourseQuestion,
  downloadDocxTemplate,
  parseDocxQuestions,
  bulkCreateCourseQuestions,
} from "../controllers/questionBank.controller";

import { protect, authorize } from "../middleware/auth";

import multer from "multer";

const router = Router({ mergeParams: true });
const upload = multer({ storage: multer.memoryStorage() });

router.use(protect);

// Template download
router.get("/template", authorize("instructor", "admin"), downloadDocxTemplate);

// Docx upload and parse
router.post(
  "/upload",
  authorize("instructor", "admin"),
  upload.single("file"),
  parseDocxQuestions,
);

// Bulk create
router.post(
  "/bulk",
  authorize("instructor", "admin"),
  bulkCreateCourseQuestions,
);

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

import { Router } from "express";
import {
  getCourseQuestions,
  getQuestionBankQuestion,
  createCourseQuestion,
  updateCourseQuestion,
  deleteCourseQuestion,
  downloadDocxTemplate,
  parseDocxQuestions,
  downloadXlsxTemplate,
  parseXlsxQuestions,
  bulkCreateCourseQuestions,
  getSchemeOfWorkEntries,
  generateQuestionsFromDocument,
} from "../controllers/questionBank.controller";

import { protect, authorize } from "../middleware/auth";

import multer from "multer";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PDF_MIME = "application/pdf";

const router = Router({ mergeParams: true });
const upload = multer({ storage: multer.memoryStorage() });
const aiGenerateUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed =
      file.mimetype === DOCX_MIME ||
      file.mimetype === PDF_MIME ||
      file.originalname.toLowerCase().endsWith(".docx") ||
      file.originalname.toLowerCase().endsWith(".pdf");
    cb(null, allowed);
  },
});

router.use(protect);

// Template downloads
router.get("/template", authorize("instructor", "admin"), downloadDocxTemplate);
router.get("/template/xlsx", authorize("instructor", "admin"), downloadXlsxTemplate);

// Docx upload and parse
router.post(
  "/upload",
  authorize("instructor", "admin"),
  upload.single("file"),
  parseDocxQuestions,
);

// XLSX upload and parse
router.post(
  "/upload/xlsx",
  authorize("instructor", "admin"),
  upload.single("file"),
  parseXlsxQuestions,
);

// Bulk create
router.post(
  "/bulk",
  authorize("instructor", "admin"),
  bulkCreateCourseQuestions,
);

// Scheme of work entries
router.get(
  "/scheme-of-work",
  authorize("instructor", "admin"),
  getSchemeOfWorkEntries,
);

// AI generate questions from uploaded document
router.post(
  "/ai-generate",
  authorize("instructor", "admin"),
  aiGenerateUpload.single("file"),
  generateQuestionsFromDocument,
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

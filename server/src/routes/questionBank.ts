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
import { getCourseQuestionBankOverview } from "../controllers/questionBankHub.controller";
import {
  getAIProviders,
  getAISources,
  prepareDocumentContext,
  prepareResourcesContext,
  generateQuestionBatch,
  getGenerationJob,
} from "../controllers/aiQuestionGeneration.controller";
import { validateBody } from "../middleware/validation.middleware";
import {
  aiGenerateBatchSchema,
  aiResolveSourcesSchema,
} from "../validations/aiGeneration.validation";

import { protect, authorizePermission } from "../middleware/auth";

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
    // Rejected files leave req.file unset; the handler answers with a clear 400.
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
router.get("/template", authorizePermission("QUESTION_BANK_VIEW"), downloadDocxTemplate);
router.get("/template/xlsx", authorizePermission("QUESTION_BANK_VIEW"), downloadXlsxTemplate);

// Docx upload and parse
router.post(
  "/upload",
  authorizePermission("QUESTION_BANK_CREATE"),
  upload.single("file"),
  parseDocxQuestions,
);

// XLSX upload and parse
router.post(
  "/upload/xlsx",
  authorizePermission("QUESTION_BANK_CREATE"),
  upload.single("file"),
  parseXlsxQuestions,
);

// Bulk create
router.post(
  "/bulk",
  authorizePermission("QUESTION_BANK_CREATE"),
  bulkCreateCourseQuestions,
);

// Scheme of work entries
router.get(
  "/scheme-of-work",
  authorizePermission("QUESTION_BANK_VIEW"),
  getSchemeOfWorkEntries,
);

// AI generate questions from uploaded document
router.post(
  "/ai-generate",
  authorizePermission("QUESTION_BANK_CREATE"),
  aiGenerateUpload.single("file"),
  generateQuestionsFromDocument,
);

// AI Question Generator (two-step: prepare a source, then generate batches).
// Nothing is saved until the teacher confirms through POST /bulk.
router.get("/ai/providers", authorizePermission("QUESTION_BANK_CREATE"), getAIProviders);
router.get("/ai/sources", authorizePermission("QUESTION_BANK_CREATE"), getAISources);
router.post(
  "/ai/prepare/document",
  authorizePermission("QUESTION_BANK_CREATE"),
  aiGenerateUpload.single("file"),
  prepareDocumentContext,
);
router.post(
  "/ai/prepare/resources",
  authorizePermission("QUESTION_BANK_CREATE"),
  validateBody(aiResolveSourcesSchema),
  prepareResourcesContext,
);
router.post(
  "/ai/generate",
  authorizePermission("QUESTION_BANK_CREATE"),
  validateBody(aiGenerateBatchSchema),
  generateQuestionBatch,
);
router.get("/ai/jobs/:jobId", authorizePermission("QUESTION_BANK_CREATE"), getGenerationJob);

// Dashboard for this subject's bank (same payload as the teacher hub's)
router.get(
  "/overview",
  authorizePermission("QUESTION_BANK_VIEW"),
  getCourseQuestionBankOverview,
);

router
  .route("/")
  .get(authorizePermission("QUESTION_BANK_VIEW"), getCourseQuestions)
  .post(authorizePermission("QUESTION_BANK_CREATE"), createCourseQuestion);

// GET    /api/courses/:courseId/question-bank/:id
// PUT    /api/courses/:courseId/question-bank/:id
// DELETE /api/courses/:courseId/question-bank/:id
router
  .route("/:id")
  .get(authorizePermission("QUESTION_BANK_VIEW"), getQuestionBankQuestion)
  .put(authorizePermission("QUESTION_BANK_EDIT"), updateCourseQuestion)
  .delete(authorizePermission("QUESTION_BANK_DELETE"), deleteCourseQuestion);

export default router;

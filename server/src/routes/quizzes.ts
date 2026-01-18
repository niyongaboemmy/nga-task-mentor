import { Router } from "express";
import {
  getQuizzes,
  getQuiz,
  createQuiz,
  updateQuiz,
  deleteQuiz,
  getQuizStats,
  getAvailableQuizzes,
  getPublicQuizzes,
  submitQuizAttempt,
  getQuizResultsById,
  createQuizSubmission,
  getQuizSubmissions,
  updateQuizSubmission,
} from "../controllers/quiz.controller";
import {
  getQuizQuestions,
  getQuestion,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  reorderQuestions,
  bulkImportQuestions,
} from "../controllers/question.controller";
import {
  startQuizAttempt,
  submitQuestionAnswer,
  getQuizAttemptStatus,
  submitQuiz,
  getQuizResults,
  getStudentQuizHistory,
  submitAllAnswers,
} from "../controllers/attempt.controller";
import {
  getPendingSubmissions,
  getSubmissionForGrading,
  gradeSubmission,
  getQuizAnalytics,
  updateSubmissionFeedback,
  getQuizSubmissions as getInstructorQuizSubmissions,
} from "../controllers/grading.controller";
import { protect, authorize } from "../middleware/auth";
import multer from "multer";
import path from "path";
import fs from "fs";

// Configure multer for quiz attachments
const quizStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../../uploads/quizzes");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname),
    );
  },
});

const uploadQuizFiles = multer({
  storage: quizStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|png|jpg|jpeg|doc|docx|xls|xlsx|zip/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase(),
    );
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, images, documents, and ZIP files are allowed"));
    }
  },
});

// Configure multer for question attachments
const questionStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../../uploads/questions");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname),
    );
  },
});

const uploadQuestionFiles = multer({
  storage: questionStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|png|jpg|jpeg|doc|docx|xls|xlsx|zip/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase(),
    );
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, images, documents, and ZIP files are allowed"));
    }
  },
});

const router = Router();

// Apply authentication middleware to all routes
router.use(protect);

// Quiz management routes (for instructors and admins)
router
  .route("/")
  .get(protect, getQuizzes)
  .post(
    authorize("instructor", "admin"),
    uploadQuizFiles.array("attachments", 5),
    createQuiz,
  );

// Student quiz routes
router.get("/available", authorize("student"), getAvailableQuizzes);
router.get("/public", getPublicQuizzes);
router.get("/my-results", authorize("student"), getStudentQuizHistory);
router.post("/:id/submit", authorize("student"), submitQuizAttempt);
router.get("/:id/results", authorize("student"), getQuizResultsById);

// Quiz routes
router
  .route("/:id")
  .get(getQuiz)
  .put(
    authorize("instructor", "admin"),
    uploadQuizFiles.array("attachments", 5),
    updateQuiz,
  )
  .delete(authorize("instructor", "admin"), deleteQuiz);

// Question routes
router.get("/:quizId/questions", getQuizQuestions);
router.get("/questions/:id", getQuestion);
router.post(
  "/:quizId/questions",
  authorize("instructor", "admin"),
  uploadQuestionFiles.array("attachments", 5),
  createQuestion,
);
router.put(
  "/questions/:id",
  authorize("instructor", "admin"),
  uploadQuestionFiles.array("attachments", 5),
  updateQuestion,
);
router.delete(
  "/questions/:id",
  authorize("instructor", "admin"),
  deleteQuestion,
);
router.put(
  "/:quizId/questions/reorder",
  authorize("instructor", "admin"),
  reorderQuestions,
);
router.post(
  "/:quizId/questions/bulk",
  authorize("instructor", "admin"),
  bulkImportQuestions,
);

// Quiz submission routes
router.post("/submissions", authorize("student"), createQuizSubmission);
router.patch(
  "/submissions/:id",
  authorize("student", "instructor", "admin"),
  updateQuizSubmission,
);
router.post("/:quizId/start", authorize("student"), startQuizAttempt);
router.get(
  "/attempts/:submissionId",
  authorize("student"),
  getQuizAttemptStatus,
);
router.post("/attempts/:submissionId/submit", authorize("student"), submitQuiz);
router.get(
  "/attempts/:submissionId/results",
  authorize("student"),
  getQuizResults,
);

// Question answering routes
router.post(
  "/attempts/:submissionId/questions/:questionId/answer",
  authorize("student"),
  submitQuestionAnswer,
);
router.post(
  "/attempts/:submissionId/submit-all",
  authorize("student"),
  submitAllAnswers,
);

// Student quiz history
router.get(
  "/students/:studentId/history",
  authorize("instructor", "admin", "student"),
  getStudentQuizHistory,
);

// Grading routes (for instructors and admins)
router.get(
  "/submissions/pending",
  authorize("instructor", "admin"),
  getPendingSubmissions,
);
router.get(
  "/submissions/:submissionId/grade",
  authorize("instructor", "admin"),
  getSubmissionForGrading,
);
router.post(
  "/submissions/:submissionId/grade",
  authorize("instructor", "admin"),
  gradeSubmission,
);
router.put(
  "/submissions/:submissionId/feedback",
  authorize("instructor", "admin"),
  updateSubmissionFeedback,
);

// Quiz submissions and analytics
router.get(
  "/:quizId/submissions",
  authorize("instructor", "admin"),
  getInstructorQuizSubmissions,
);
router.get(
  "/:quizId/analytics",
  authorize("instructor", "admin"),
  getQuizAnalytics,
);

export default router;

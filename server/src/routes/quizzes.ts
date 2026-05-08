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
  resetQuizSubmission,
  deleteQuizSubmission,
  deleteAllQuizSubmissions,
  getAIHint,
  runCode,
  generateTestCases,
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
  initializeManualSubmission,
  getQuizStudents,
} from "../controllers/grading.controller";
import {
  getBloomsTaxonomyLevels,
  getBloomsTaxonomyLevel,
  createBloomsTaxonomyLevel,
  updateBloomsTaxonomyLevel,
  deleteBloomsTaxonomyLevel,
} from "../controllers/bloomsTaxonomy.controller";
import { protect, authorize } from "../middleware/auth";

const router = Router();

// Apply authentication middleware to all routes
router.use(protect);

// -------------------------------------------------------
// Bloom's Taxonomy Level routes
// -------------------------------------------------------
router.get("/blooms-levels", getBloomsTaxonomyLevels);
router.get("/blooms-levels/:id", getBloomsTaxonomyLevel);
router.post("/blooms-levels", authorize("admin"), createBloomsTaxonomyLevel);
router.put("/blooms-levels/:id", authorize("admin"), updateBloomsTaxonomyLevel);
router.delete(
  "/blooms-levels/:id",
  authorize("admin"),
  deleteBloomsTaxonomyLevel,
);

// Quiz management routes (for instructors and admins)
router
  .route("/")
  .get(protect, getQuizzes) // Allow authenticated users to get all quizzes
  .post(authorize("instructor", "admin"), createQuiz);

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
  .put(authorize("instructor", "admin"), updateQuiz)
  .delete(authorize("instructor", "admin"), deleteQuiz);

// Question routes
router.get("/:quizId/questions", getQuizQuestions);
router.get("/questions/:id", getQuestion);
router.post("/questions/:questionId/ai-hint", getAIHint);
router.post("/questions/:questionId/run-code", runCode);

router.post(
  "/:quizId/questions",
  authorize("instructor", "admin"),
  createQuestion,
);
router.put("/questions/:id", authorize("instructor", "admin"), updateQuestion);
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
router.post(
  "/generate-test-cases",
  authorize("instructor", "admin"),
  generateTestCases,
);
// Instructor-only: run code against test cases during question preparation (no submission needed)
router.post("/preview-run", authorize("instructor", "admin"), runCode);

// Quiz submission routes
router.post("/submissions", authorize("student"), createQuizSubmission);
router.patch(
  "/submissions/:id",
  authorize("student", "instructor", "admin"),
  updateQuizSubmission,
);
router.post(
  "/submissions/:id/reset",
  authorize("instructor", "admin"),
  resetQuizSubmission,
);
router.delete(
  "/submissions/:submissionId/delete",
  authorize("instructor", "admin"),
  deleteQuizSubmission,
);
router.delete(
  "/:quizId/submissions/all",
  authorize("instructor", "admin"),
  deleteAllQuizSubmissions,
);
router.post("/:quizId/start", authorize("student"), startQuizAttempt);
router.get(
  "/attempts/:submissionId",
  authorize("student"),
  getQuizAttemptStatus,
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

// Initialize a manual submission (instructor records paper-based marks)
router.post(
  "/:quizId/submissions/initialize-manual",
  authorize("instructor", "admin"),
  initializeManualSubmission,
);

// Quiz submissions and analytics
router.get(
  "/:quizId/submissions",
  authorize("instructor", "admin"),
  getInstructorQuizSubmissions,
);
router.get(
  "/:quizId/students",
  authorize("instructor", "admin"),
  getQuizStudents,
);
router.get(
  "/:quizId/analytics",
  authorize("instructor", "admin"),
  getQuizAnalytics,
);

export default router;

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
  getSubmissionResults,
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
import { protect, authorizePermission } from "../middleware/auth";

const router = Router();

// Apply authentication middleware to all routes
router.use(protect);

// -------------------------------------------------------
// Bloom's Taxonomy Level routes
// -------------------------------------------------------
router.get("/blooms-levels", authorizePermission("QUIZZES_VIEW"), getBloomsTaxonomyLevels);
router.get("/blooms-levels/:id", authorizePermission("QUIZZES_VIEW"), getBloomsTaxonomyLevel);
router.post("/blooms-levels", authorizePermission("QUIZZES_CREATE"), createBloomsTaxonomyLevel);
router.put(
  "/blooms-levels/:id",
  authorizePermission("QUIZZES_EDIT"),
  updateBloomsTaxonomyLevel,
);
router.delete(
  "/blooms-levels/:id",
  authorizePermission("QUIZZES_DELETE"),
  deleteBloomsTaxonomyLevel,
);

// Quiz management routes (for instructors and admins)
router
  .route("/")
  .get(authorizePermission("QUIZZES_VIEW"), getQuizzes)
  .post(authorizePermission("QUIZZES_CREATE"), createQuiz);

// Student quiz routes
router.get("/available", authorizePermission("QUIZZES_ATTEMPT"), getAvailableQuizzes);
router.get("/public", authorizePermission("QUIZZES_VIEW"), getPublicQuizzes);
router.get(
  "/my-results",
  authorizePermission("QUIZZES_VIEW_RESULTS_OWN"),
  getStudentQuizHistory,
);
router.post("/:id/submit", authorizePermission("QUIZZES_ATTEMPT"), submitQuizAttempt);
router.get(
  "/:id/results",
  authorizePermission("QUIZZES_VIEW_RESULTS_OWN"),
  getQuizResultsById,
);

// Quiz routes
router
  .route("/:id")
  .get(authorizePermission("QUIZZES_VIEW"), getQuiz)
  .put(authorizePermission("QUIZZES_EDIT"), updateQuiz)
  .delete(authorizePermission("QUIZZES_DELETE"), deleteQuiz);

// Question routes
router.get("/:quizId/questions", authorizePermission("QUIZZES_VIEW"), getQuizQuestions);
router.get("/questions/:id", authorizePermission("QUIZZES_VIEW"), getQuestion);
router.post(
  "/questions/:questionId/ai-hint",
  authorizePermission("QUIZ_QUESTIONS_USE_AI_HINT"),
  getAIHint,
);
router.post(
  "/questions/:questionId/run-code",
  authorizePermission("QUIZ_QUESTIONS_RUN_CODE"),
  runCode,
);

router.post(
  "/:quizId/questions",
  authorizePermission("QUIZZES_EDIT"),
  createQuestion,
);
router.put("/questions/:id", authorizePermission("QUIZZES_EDIT"), updateQuestion);
router.delete(
  "/questions/:id",
  authorizePermission("QUIZZES_EDIT"),
  deleteQuestion,
);
router.put(
  "/:quizId/questions/reorder",
  authorizePermission("QUIZZES_EDIT"),
  reorderQuestions,
);
router.post(
  "/:quizId/questions/bulk",
  authorizePermission("QUIZZES_EDIT"),
  bulkImportQuestions,
);
router.post(
  "/generate-test-cases",
  authorizePermission("QUIZZES_CREATE", "QUIZZES_EDIT"),
  generateTestCases,
);
// Instructor-only: run code against test cases during question preparation (no submission needed)
router.post(
  "/preview-run",
  authorizePermission("QUIZ_QUESTIONS_RUN_CODE", "QUIZZES_EDIT"),
  runCode,
);

// Quiz submission routes
router.post("/submissions", authorizePermission("QUIZZES_ATTEMPT"), createQuizSubmission);
router.patch(
  "/submissions/:id",
  authorizePermission("QUIZZES_ATTEMPT", "QUIZZES_GRADE"),
  updateQuizSubmission,
);
router.post(
  "/submissions/:id/reset",
  authorizePermission("QUIZZES_GRADE", "QUIZZES_EDIT"),
  resetQuizSubmission,
);
router.delete(
  "/submissions/:submissionId/delete",
  authorizePermission("QUIZZES_GRADE", "QUIZZES_EDIT"),
  deleteQuizSubmission,
);
router.delete(
  "/:quizId/submissions/all",
  authorizePermission("QUIZZES_DELETE"),
  deleteAllQuizSubmissions,
);
router.post("/:quizId/start", authorizePermission("QUIZZES_ATTEMPT"), startQuizAttempt);
router.get(
  "/attempts/:submissionId",
  authorizePermission("QUIZZES_ATTEMPT"),
  getQuizAttemptStatus,
);
router.get(
  "/attempts/:submissionId/results",
  authorizePermission("QUIZZES_VIEW_RESULTS_OWN"),
  getSubmissionResults,
);

// Question answering routes
router.post(
  "/attempts/:submissionId/questions/:questionId/answer",
  authorizePermission("QUIZZES_ATTEMPT"),
  submitQuestionAnswer,
);
router.post(
  "/attempts/:submissionId/submit-all",
  authorizePermission("QUIZZES_ATTEMPT"),
  submitAllAnswers,
);

// Student quiz history
router.get(
  "/students/:studentId/history",
  authorizePermission("QUIZZES_VIEW_RESULTS_OWN", "QUIZZES_VIEW_RESULTS_ALL"),
  getStudentQuizHistory,
);

// Grading routes (for instructors and admins)
router.get(
  "/submissions/pending",
  authorizePermission("QUIZZES_GRADE"),
  getPendingSubmissions,
);
router.get(
  "/submissions/:submissionId/grade",
  authorizePermission("QUIZZES_GRADE"),
  getSubmissionForGrading,
);
router.post(
  "/submissions/:submissionId/grade",
  authorizePermission("QUIZZES_GRADE"),
  gradeSubmission,
);
router.put(
  "/submissions/:submissionId/feedback",
  authorizePermission("QUIZZES_GRADE"),
  updateSubmissionFeedback,
);

// Initialize a manual submission (instructor records paper-based marks)
router.post(
  "/:quizId/submissions/initialize-manual",
  authorizePermission("QUIZZES_GRADE", "QUIZZES_EDIT"),
  initializeManualSubmission,
);

// Quiz submissions and analytics
router.get(
  "/:quizId/submissions",
  authorizePermission("QUIZZES_VIEW_RESULTS_ALL"),
  getInstructorQuizSubmissions,
);
router.get(
  "/:quizId/students",
  authorizePermission("QUIZZES_VIEW_RESULTS_ALL"),
  getQuizStudents,
);
router.get(
  "/:quizId/analytics",
  authorizePermission("QUIZZES_VIEW_RESULTS_ALL"),
  getQuizAnalytics,
);

export default router;

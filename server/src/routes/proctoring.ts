import express from "express";
import {
  getProctoringSettings,
  updateProctoringSettings,
  startProctoringSession,
  updateProctoringSession,
  logProctoringEvent,
  logWarningEvent,
  getProctoringSessions,
  getProctoringSession,
  getMyProctoringSessions,
  joinLiveStream,
  leaveLiveStream,
  getActiveStreams,
  endProctoringSession,
  getSessionEvents,
  getProctoringAnalytics,
} from "../controllers/proctoring.controller";
import { protect, authorizePermission } from "../middleware/auth";

const router = express.Router();

// All routes require authentication
router.use(protect);

// Proctoring settings routes (controller further restricts GET to
// instructor/admin-with-manage-settings OR student-with-start-session)
router
  .route("/quizzes/:quizId/proctoring-settings")
  .get(
    authorizePermission("PROCTORING_MANAGE_SETTINGS", "PROCTORING_START_SESSION"),
    getProctoringSettings,
  )
  .put(authorizePermission("PROCTORING_MANAGE_SETTINGS"), updateProctoringSettings)
  .post(authorizePermission("PROCTORING_MANAGE_SETTINGS"), updateProctoringSettings);

// Proctoring session routes
router.post(
  "/quizzes/:quizId/proctoring/start",
  authorizePermission("PROCTORING_START_SESSION"),
  startProctoringSession,
);
router.patch(
  "/sessions/:sessionId",
  authorizePermission("PROCTORING_START_SESSION", "PROCTORING_VIEW_SESSIONS"),
  updateProctoringSession,
);
router.patch(
  "/sessions/:sessionId/end",
  authorizePermission("PROCTORING_VIEW_SESSIONS"),
  endProctoringSession,
);

// Proctoring event logging
router.post("/events", authorizePermission("PROCTORING_LOG_EVENTS"), logProctoringEvent);

// Instructor warning event logging (message is NOT stored)
router.post(
  "/warning-events",
  authorizePermission("PROCTORING_VIEW_SESSIONS"),
  logWarningEvent,
);

// Proctoring analytics
router.get(
  "/quizzes/:quizId/analytics",
  authorizePermission("PROCTORING_VIEW_ANALYTICS"),
  getProctoringAnalytics,
);

// Proctoring session management (instructors/admins)
router.get(
  "/quizzes/:quizId/proctoring/sessions",
  authorizePermission("PROCTORING_VIEW_SESSIONS"),
  getProctoringSessions,
);
router.get(
  "/sessions/:sessionId",
  authorizePermission("PROCTORING_VIEW_SESSIONS", "PROCTORING_VIEW_OWN_SESSIONS"),
  getProctoringSession,
);

// Student routes
router.get(
  "/my-sessions",
  authorizePermission("PROCTORING_VIEW_OWN_SESSIONS"),
  getMyProctoringSessions,
);

// Live streaming routes (instructors only)
router.post(
  "/sessions/:sessionToken/join-stream",
  authorizePermission("PROCTORING_JOIN_LIVE_STREAM"),
  joinLiveStream,
);
router.post(
  "/sessions/:sessionToken/leave-stream",
  authorizePermission("PROCTORING_JOIN_LIVE_STREAM"),
  leaveLiveStream,
);
router.get(
  "/live-streams",
  authorizePermission("PROCTORING_JOIN_LIVE_STREAM"),
  getActiveStreams,
);

// Session events (including screenshots)
router.get(
  "/sessions/:sessionToken/events",
  authorizePermission("PROCTORING_VIEW_SESSIONS"),
  getSessionEvents,
);

export default router;

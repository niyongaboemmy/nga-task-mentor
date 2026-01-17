import express from "express";
import {
  getProctoringSettings,
  updateProctoringSettings,
  startProctoringSession,
  updateProctoringSession,
  logProctoringEvent,
  getProctoringSessions,
  getProctoringSession,
  getMyProctoringSessions,
  joinLiveStream,
  leaveLiveStream,
  getActiveStreams,
  endProctoringSession,
} from "../controllers/proctoring.controller";
import { protect } from "../middleware/auth";

const router = express.Router();

// All routes require authentication
router.use(protect);

// Proctoring settings routes
router
  .route("/quizzes/:quizId/proctoring-settings")
  .get(getProctoringSettings)
  .put(updateProctoringSettings)
  .post(updateProctoringSettings);

// Proctoring session routes
router.post("/quizzes/:quizId/proctoring/start", startProctoringSession);
router.patch("/sessions/:sessionId", updateProctoringSession);
router.patch("/sessions/:sessionId/end", endProctoringSession);

// Proctoring event logging
router.post("/events", logProctoringEvent);

// Proctoring session management (instructors/admins)
router.get("/quizzes/:quizId/proctoring/sessions", getProctoringSessions);
router.get("/sessions/:sessionId", getProctoringSession);

// Student routes
router.get("/my-sessions", getMyProctoringSessions);

// Live streaming routes (instructors only)
router.post("/sessions/:sessionToken/join-stream", joinLiveStream);
router.post("/sessions/:sessionToken/leave-stream", leaveLiveStream);
router.get("/live-streams", getActiveStreams);

export default router;

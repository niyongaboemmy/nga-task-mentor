import { Request, Response } from "express";
import {
  ProctoringSession,
  ProctoringEvent,
  ProctoringSettings,
  Quiz,
  User,
} from "../models";
import { sequelize } from "../config/database";
import { Op } from "sequelize";

// Store active WebRTC connections for live streaming
const activeStreams = new Map<
  string,
  { instructorSocketId?: string; studentSocketId?: string }
>();

// @desc    Get proctoring settings for a quiz
// @route   GET /api/proctoring/quizzes/:quizId/proctoring-settings
// @access  Private (instructor, admin, student)
export const getProctoringSettings = async (req: Request, res: Response) => {
  try {
    const { quizId } = req.params;

    // Validate quizId
    if (!quizId || isNaN(parseInt(quizId))) {
      return res.status(400).json({
        success: false,
        message: "Invalid quiz ID provided",
      });
    }

    const quiz = await Quiz.findByPk(quizId);
    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: "Quiz not found",
      });
    }

    // Check authorization - instructors and students have access to proctoring settings
    if (req.user.role !== "instructor" && req.user.role !== "student") {
      return res.status(403).json({
        success: false,
        message:
          "Not authorized to view proctoring settings. Only instructors and students allowed.",
      });
    }

    const settings = await ProctoringSettings.findOne({
      where: { quiz_id: quizId },
    });

    // Return settings or null if none exist (don't create defaults on GET)
    res.status(200).json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error("Get proctoring settings error:", error);

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes("connect")) {
        return res.status(500).json({
          success: false,
          message: "Database connection error",
        });
      }
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// @desc    Create or update proctoring settings for a quiz
// @route   POST /api/proctoring/quizzes/:quizId/proctoring-settings
// @route   PUT /api/proctoring/quizzes/:quizId/proctoring-settings
// @access  Private (instructor, admin)
export const updateProctoringSettings = async (req: Request, res: Response) => {
  const transaction = await sequelize.transaction();
  try {
    const { quizId } = req.params;
    const updateData = req.body;

    // Validate quizId
    if (!quizId || isNaN(parseInt(quizId))) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Invalid quiz ID provided",
      });
    }

    // Validate request body
    if (!updateData || typeof updateData !== "object") {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Invalid request body",
      });
    }

    const quiz = await Quiz.findByPk(quizId, { transaction });
    if (!quiz) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Quiz not found",
      });
    }

    // Check authorization - instructors have full access to proctoring
    if (req.user.role !== "instructor") {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message:
          "Not authorized to update proctoring settings. Only instructors allowed.",
      });
    }

    let settings = await ProctoringSettings.findOne({
      where: { quiz_id: quizId },
      transaction,
    });

    if (settings) {
      await settings.update(updateData, { transaction });
    } else {
      settings = await ProctoringSettings.create(
        {
          quiz_id: parseInt(quizId),
          ...updateData,
        },
        { transaction }
      );
    }

    await transaction.commit();

    res.status(200).json({
      success: true,
      data: settings,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Update proctoring settings error:", error);

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes("connect")) {
        return res.status(500).json({
          success: false,
          message: "Database connection error",
        });
      }
      if (error.message.includes("validation")) {
        return res.status(400).json({
          success: false,
          message: "Invalid data provided",
        });
      }
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// @desc    Start proctoring session for a quiz
// @route   POST /api/quizzes/:quizId/proctoring/start
// @access  Private (student)
export const startProctoringSession = async (req: Request, res: Response) => {
  const transaction = await sequelize.transaction();
  try {
    const { quizId } = req.params;
    const { browser_info, system_info, ip_address, location_data } = req.body;

    if (req.user.role !== "student") {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: "Only students can start proctoring sessions",
      });
    }

    const quiz = await Quiz.findByPk(quizId, {
      include: [{ model: ProctoringSettings, as: "proctoringSettings" }],
      transaction,
    });

    if (!quiz) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Quiz not found",
      });
    }

    // Check if proctoring is enabled for this quiz
    if (!quiz.proctoringSettings?.enabled) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Proctoring is not enabled for this quiz",
      });
    }

    // Check if student already has an active session
    const existingSession = await ProctoringSession.findOne({
      where: {
        quiz_id: quizId,
        student_id: req.user.id,
        status: { [Op.in]: ["setup", "active"] },
      },
      transaction,
    });

    if (existingSession) {
      await transaction.rollback();
      return res.status(200).json({
        success: true,
        data: existingSession,
        message: "Resuming existing proctoring session",
      });
    }

    // Generate unique session token
    const sessionToken = `proctor_${quizId}_${
      req.user.id
    }_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const session = await ProctoringSession.create(
      {
        quiz_id: parseInt(quizId),
        student_id: req.user.id,
        session_token: sessionToken,
        status: "active",
        mode: (quiz.proctoringSettings.mode === "automated"
          ? "automated_proctoring"
          : quiz.proctoringSettings.mode === "live"
          ? "live_proctoring"
          : quiz.proctoringSettings.mode === "record_review"
          ? "record_review"
          : "automated_proctoring") as
          | "live_proctoring"
          | "automated_proctoring"
          | "record_review",
        start_time: new Date(),
        browser_info: JSON.stringify(browser_info),
        system_info: JSON.stringify(system_info),
        ip_address,
        location_data,
        identity_verified: false,
        environment_verified: false,
        flags_count: 0,
        risk_score: 0,
        is_connected: true,
        last_connection_time: new Date(),
      },
      { transaction }
    );

    // Log session start event
    await ProctoringEvent.create(
      {
        session_id: session.id,
        event_type: "session_start",
        severity: "low",
        timestamp: new Date(),
        description: "Proctoring session started",
        metadata: JSON.stringify({
          browser_info: JSON.stringify(browser_info),
          system_info: JSON.stringify(system_info),
          ip_address,
          location_data,
        }),
        reviewed: false,
      },
      { transaction }
    );

    await transaction.commit();

    res.status(201).json({
      success: true,
      data: session,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Start proctoring session error:", error);

    // Provide more specific error messages based on error type
    if (error instanceof Error) {
      if (error.message.includes("connect")) {
        return res.status(500).json({
          success: false,
          message: "Database connection error. Please try again later.",
        });
      }
      if (error.message.includes("validation")) {
        return res.status(400).json({
          success: false,
          message: "Invalid data provided for starting proctoring session.",
        });
      }
      if (
        error.message.includes("permission") ||
        error.message.includes("authorize")
      ) {
        return res.status(403).json({
          success: false,
          message:
            "You don't have permission to start a proctoring session for this quiz.",
        });
      }
    }

    res.status(500).json({
      success: false,
      message:
        "An unexpected error occurred while starting the proctoring session. Please contact support if this persists.",
    });
  }
};

// @desc    Update proctoring session status
// @route   PATCH /api/proctoring/sessions/:sessionId
// @access  Private
export const updateProctoringSession = async (req: Request, res: Response) => {
  const transaction = await sequelize.transaction();
  try {
    const { sessionId } = req.params;
    const { status, identity_verified, environment_verified, end_time } =
      req.body;

    const session = await ProctoringSession.findByPk(sessionId, {
      transaction,
    });
    if (!session) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Proctoring session not found",
      });
    }

    // Check authorization
    if (
      session.student_id !== req.user.id &&
      req.user.role !== "instructor" &&
      req.user.role !== "admin"
    ) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this session",
      });
    }

    const updateData: any = {};
    if (status) updateData.status = status;
    if (identity_verified !== undefined)
      updateData.identity_verified = identity_verified;
    if (environment_verified !== undefined)
      updateData.environment_verified = environment_verified;
    if (end_time) updateData.end_time = new Date(end_time);

    // Update connection status if status is being changed
    if (status === "active") {
      updateData.is_connected = true;
      updateData.last_connection_time = new Date();
    } else if (status === "completed" || status === "terminated") {
      updateData.is_connected = false;
    }

    await session.update(updateData, { transaction });

    // Log status change event
    if (status) {
      await ProctoringEvent.create(
        {
          session_id: session.id,
          event_type: status === "completed" ? "session_end" : "session_start",
          severity: "low",
          timestamp: new Date(),
          description: `Session status changed to ${status}`,
          reviewed: false,
        },
        { transaction }
      );
    }

    await transaction.commit();

    res.status(200).json({
      success: true,
      data: session,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Update proctoring session error:", error);

    // Provide more specific error messages based on error type
    if (error instanceof Error) {
      if (error.message.includes("connect")) {
        return res.status(500).json({
          success: false,
          message: "Database connection error. Please try again later.",
        });
      }
      if (error.message.includes("validation")) {
        return res.status(400).json({
          success: false,
          message: "Invalid data provided for updating proctoring session.",
        });
      }
      if (
        error.message.includes("permission") ||
        error.message.includes("authorize")
      ) {
        return res.status(403).json({
          success: false,
          message:
            "You don't have permission to update this proctoring session.",
        });
      }
    }

    res.status(500).json({
      success: false,
      message:
        "An unexpected error occurred while updating the proctoring session. Please contact support if this persists.",
    });
  }
};

// @desc    Log proctoring event
// @route   POST /api/proctoring/events
// @access  Private
export const logProctoringEvent = async (req: Request, res: Response) => {
  try {
    const {
      session_token,
      event_type,
      severity,
      description,
      metadata,
      screenshot_url,
      video_timestamp,
    } = req.body;

    // Find session by token
    const session = await ProctoringSession.findOne({
      where: { session_token },
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Proctoring session not found",
      });
    }

    // Check if session belongs to current user or user is instructor/admin
    if (
      session.student_id !== req.user.id &&
      req.user.role !== "instructor" &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to log events for this session",
      });
    }

    const event = await ProctoringEvent.create({
      session_id: session.id,
      event_type,
      severity: severity || "low",
      timestamp: new Date(),
      description,
      metadata: metadata ? JSON.stringify(metadata) : undefined,
      screenshot_url,
      video_timestamp,
      reviewed: false,
    });

    // Update session flags count and risk score
    if (severity === "high" || severity === "critical") {
      await session.increment("flags_count");
      await session.increment("risk_score", {
        by: severity === "critical" ? 20 : 10,
      });
    }

    res.status(201).json({
      success: true,
      data: event,
    });
  } catch (error) {
    console.error("Log proctoring event error:", error);

    // Provide more specific error messages based on error type
    if (error instanceof Error) {
      if (error.message.includes("connect")) {
        return res.status(500).json({
          success: false,
          message: "Database connection error. Please try again later.",
        });
      }
      if (error.message.includes("validation")) {
        return res.status(400).json({
          success: false,
          message: "Invalid data provided for logging proctoring event.",
        });
      }
      if (
        error.message.includes("permission") ||
        error.message.includes("authorize")
      ) {
        return res.status(403).json({
          success: false,
          message:
            "You don't have permission to log events for this proctoring session.",
        });
      }
    }

    res.status(500).json({
      success: false,
      message:
        "An unexpected error occurred while logging the proctoring event. Please contact support if this persists.",
    });
  }
};

// @desc    Get proctoring sessions for a quiz
// @route   GET /api/quizzes/:quizId/proctoring/sessions
// @access  Private (instructor, admin)
export const getProctoringSessions = async (req: Request, res: Response) => {
  try {
    const { quizId } = req.params;
    const { status, student_id } = req.query;

    const quiz = await Quiz.findByPk(quizId);
    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: "Quiz not found",
      });
    }

    // Check authorization - allow instructors and admins
    if (
      req.user.role !== "admin" &&
      req.user.role !== "instructor" &&
      req.user.id !== quiz.created_by
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view proctoring sessions",
      });
    }

    const whereClause: any = { quiz_id: quizId };
    if (status) whereClause.status = status;
    if (student_id) whereClause.student_id = student_id;

    const sessions = await ProctoringSession.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: "student",
          attributes: ["id", "first_name", "last_name", "email"],
        },
        {
          model: ProctoringEvent,
          as: "events",
          limit: 10,
          order: [["timestamp", "DESC"]],
        },
      ],
      order: [["start_time", "DESC"]],
    });

    res.status(200).json({
      success: true,
      count: sessions.length,
      data: sessions,
    });
  } catch (error) {
    console.error("Get proctoring sessions error:", error);

    // Provide more specific error messages based on error type
    if (error instanceof Error) {
      if (error.message.includes("connect")) {
        return res.status(500).json({
          success: false,
          message: "Database connection error. Please try again later.",
        });
      }
      if (error.message.includes("validation")) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid parameters provided for retrieving proctoring sessions.",
        });
      }
      if (
        error.message.includes("permission") ||
        error.message.includes("authorize")
      ) {
        return res.status(403).json({
          success: false,
          message:
            "You don't have permission to view proctoring sessions for this quiz.",
        });
      }
    }

    res.status(500).json({
      success: false,
      message:
        "An unexpected error occurred while retrieving proctoring sessions. Please contact support if this persists.",
    });
  }
};

// @desc    Get proctoring session details
// @route   GET /api/proctoring/sessions/:sessionId
// @access  Private
export const getProctoringSession = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const session = await ProctoringSession.findByPk(sessionId, {
      include: [
        {
          model: Quiz,
          as: "quiz",
          attributes: ["id", "title", "description"],
        },
        {
          model: User,
          as: "student",
          attributes: ["id", "first_name", "last_name", "email"],
        },
        {
          model: ProctoringEvent,
          as: "events",
          order: [["timestamp", "DESC"]],
        },
      ],
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Proctoring session not found",
      });
    }

    // Check authorization
    if (
      session.student_id !== req.user.id &&
      req.user.role !== "instructor" &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this session",
      });
    }

    res.status(200).json({
      success: true,
      data: session,
    });
  } catch (error) {
    console.error("Get proctoring session error:", error);

    // Provide more specific error messages based on error type
    if (error instanceof Error) {
      if (error.message.includes("connect")) {
        return res.status(500).json({
          success: false,
          message: "Database connection error. Please try again later.",
        });
      }
      if (error.message.includes("validation")) {
        return res.status(400).json({
          success: false,
          message: "Invalid session ID provided.",
        });
      }
      if (
        error.message.includes("permission") ||
        error.message.includes("authorize")
      ) {
        return res.status(403).json({
          success: false,
          message: "You don't have permission to view this proctoring session.",
        });
      }
    }

    res.status(500).json({
      success: false,
      message:
        "An unexpected error occurred while retrieving the proctoring session. Please contact support if this persists.",
    });
  }
};

// @desc    Get student's proctoring sessions
// @route   GET /api/proctoring/my-sessions
// @access  Private (student)
export const getMyProctoringSessions = async (req: Request, res: Response) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({
        success: false,
        message: "Only students can view their proctoring sessions",
      });
    }

    const sessions = await ProctoringSession.findAll({
      where: { student_id: req.user.id },
      include: [
        {
          model: Quiz,
          as: "quiz",
          attributes: ["id", "title", "description", "course_id"],
        },
      ],
      order: [["start_time", "DESC"]],
    });

    res.status(200).json({
      success: true,
      count: sessions.length,
      data: sessions,
    });
  } catch (error) {
    console.error("Get my proctoring sessions error:", error);

    // Provide more specific error messages based on error type
    if (error instanceof Error) {
      if (error.message.includes("connect")) {
        return res.status(500).json({
          success: false,
          message: "Database connection error. Please try again later.",
        });
      }
      if (error.message.includes("validation")) {
        return res.status(400).json({
          success: false,
          message: "Invalid request for retrieving your proctoring sessions.",
        });
      }
      if (
        error.message.includes("permission") ||
        error.message.includes("authorize")
      ) {
        return res.status(403).json({
          success: false,
          message: "You don't have permission to view proctoring sessions.",
        });
      }
    }

    res.status(500).json({
      success: false,
      message:
        "An unexpected error occurred while retrieving your proctoring sessions. Please contact support if this persists.",
    });
  }
};

// @desc    Join live proctoring stream
// @route   POST /api/proctoring/sessions/:sessionToken/join-stream
// @access  Private (instructor)
export const joinLiveStream = async (req: Request, res: Response) => {
  try {
    const { sessionToken } = req.params;

    if (req.user.role !== "instructor" && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only instructors can join live streams",
      });
    }

    const session = await ProctoringSession.findOne({
      where: { session_token: sessionToken },
      include: [
        {
          model: Quiz,
          as: "quiz",
          attributes: ["id", "title", "course_id"],
        },
      ],
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Proctoring session not found",
      });
    }

    // Check if instructor has access to this quiz
    if (
      req.user.role !== "admin" &&
      req.user.role !== "instructor" &&
      req.user.id !== session.quiz?.created_by
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to monitor this session",
      });
    }

    // Store instructor connection for this session
    activeStreams.set(sessionToken, {
      ...activeStreams.get(sessionToken),
      instructorSocketId: req.body.socketId,
    });

    res.status(200).json({
      success: true,
      message: "Successfully joined live stream",
      session: {
        id: session.id,
        student_id: session.student_id,
        status: session.status,
        start_time: session.start_time,
      },
    });
  } catch (error) {
    console.error("Join live stream error:", error);

    // Provide more specific error messages based on error type
    if (error instanceof Error) {
      if (error.message.includes("connect")) {
        return res.status(500).json({
          success: false,
          message: "Database connection error. Please try again later.",
        });
      }
      if (error.message.includes("validation")) {
        return res.status(400).json({
          success: false,
          message: "Invalid session token provided for joining live stream.",
        });
      }
      if (
        error.message.includes("permission") ||
        error.message.includes("authorize")
      ) {
        return res.status(403).json({
          success: false,
          message:
            "You don't have permission to join this live proctoring stream.",
        });
      }
    }

    res.status(500).json({
      success: false,
      message:
        "An unexpected error occurred while joining the live stream. Please contact support if this persists.",
    });
  }
};

// @desc    Leave live proctoring stream
// @route   POST /api/proctoring/sessions/:sessionToken/leave-stream
// @access  Private (instructor)
export const leaveLiveStream = async (req: Request, res: Response) => {
  try {
    const { sessionToken } = req.params;

    const streamData = activeStreams.get(sessionToken);
    if (streamData) {
      delete streamData.instructorSocketId;
      if (!streamData.studentSocketId) {
        activeStreams.delete(sessionToken);
      } else {
        activeStreams.set(sessionToken, streamData);
      }
    }

    res.status(200).json({
      success: true,
      message: "Successfully left live stream",
    });
  } catch (error) {
    console.error("Leave live stream error:", error);

    // Provide more specific error messages based on error type
    if (error instanceof Error) {
      if (error.message.includes("connect")) {
        return res.status(500).json({
          success: false,
          message: "Database connection error. Please try again later.",
        });
      }
      if (error.message.includes("validation")) {
        return res.status(400).json({
          success: false,
          message: "Invalid session token provided for leaving live stream.",
        });
      }
      if (
        error.message.includes("permission") ||
        error.message.includes("authorize")
      ) {
        return res.status(403).json({
          success: false,
          message:
            "You don't have permission to leave this live proctoring stream.",
        });
      }
    }

    res.status(500).json({
      success: false,
      message:
        "An unexpected error occurred while leaving the live stream. Please contact support if this persists.",
    });
  }
};

// @desc    Get active proctoring streams for instructor
// @route   GET /api/proctoring/live-streams
// @access  Private (instructor)
export const getActiveStreams = async (req: Request, res: Response) => {
  try {
    if (req.user.role !== "instructor" && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only instructors can view active streams",
      });
    }

    // Get sessions that are currently active and have proctoring enabled
    // Include both currently connected and previously connected sessions
    const activeSessions = await ProctoringSession.findAll({
      where: {
        status: "active",
        // Only show sessions for quizzes created by this instructor (or all for admin)
        ...(req.user.role !== "admin" && {
          "$quiz.created_by$": req.user.id,
        }),
      },
      include: [
        {
          model: Quiz,
          as: "quiz",
          required: true, // INNER JOIN to ensure quiz exists
          include: [
            {
              model: ProctoringSettings,
              as: "proctoringSettings",
              where: { enabled: true },
              required: true, // INNER JOIN to ensure proctoring is enabled
            },
          ],
        },
        {
          model: User,
          as: "student",
          attributes: ["id", "first_name", "last_name", "email"],
          required: true, // INNER JOIN to ensure student exists
        },
      ],
    });

    const streams = activeSessions.map((session) => ({
      id: session.id,
      sessionToken: session.session_token,
      student: session.student,
      quiz: {
        id: session.quiz?.id,
        title: session.quiz?.title,
      },
      startTime: session.start_time,
      riskScore: session.risk_score,
      flagsCount: session.flags_count,
      isLive: false, // Always start as false - only socket connections make it live
      lastConnectionTime: session.last_connection_time,
    }));

    res.status(200).json({
      success: true,
      count: streams.length,
      data: streams,
    });
  } catch (error) {
    console.error("Get active streams error:", error);

    // Provide more specific error messages based on error type
    if (error instanceof Error) {
      if (error.message.includes("connect")) {
        return res.status(500).json({
          success: false,
          message: "Database connection error. Please try again later.",
        });
      }
      if (error.message.includes("validation")) {
        return res.status(400).json({
          success: false,
          message: "Invalid request for retrieving active streams.",
        });
      }
      if (
        error.message.includes("permission") ||
        error.message.includes("authorize")
      ) {
        return res.status(403).json({
          success: false,
          message:
            "You don't have permission to view active proctoring streams.",
        });
      }
    }

    res.status(500).json({
      success: false,
      message:
        "An unexpected error occurred while retrieving active streams. Please contact support if this persists.",
    });
  }
};

// @desc    End proctoring session with reason
// @route   PATCH /api/proctoring/sessions/:sessionId/end
// @access  Private (instructor, admin)
export const endProctoringSession = async (req: Request, res: Response) => {
  const transaction = await sequelize.transaction();
  try {
    const { sessionId } = req.params;
    const { reason } = req.body;

    if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Reason is required for ending the session",
      });
    }

    const session = await ProctoringSession.findByPk(sessionId, {
      include: [
        {
          model: User,
          as: "student",
          attributes: ["id", "first_name", "last_name", "email"],
        },
      ],
      transaction,
    });

    if (!session) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Proctoring session not found",
      });
    }

    // Check authorization - instructors and admins can end sessions
    if (req.user.role !== "instructor" && req.user.role !== "admin") {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: "Not authorized to end proctoring sessions",
      });
    }

    // Check if session is already ended
    if (session.status === "completed" || session.status === "terminated") {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Session is already ended",
      });
    }

    // Update session status
    await session.update(
      {
        status: "terminated",
        end_time: new Date(),
      },
      { transaction }
    );

    // Log termination event
    await ProctoringEvent.create(
      {
        session_id: session.id,
        event_type: "session_end",
        severity: "high",
        timestamp: new Date(),
        description: `Session terminated by proctor: ${reason}`,
        metadata: JSON.stringify({
          terminated_by: req.user.id,
          termination_reason: reason,
        }),
        reviewed: false,
      },
      { transaction }
    );

    await transaction.commit();

    // Emit socket event to notify student
    // This will be handled by the socket server

    res.status(200).json({
      success: true,
      data: session,
      message: "Session ended successfully",
    });
  } catch (error) {
    await transaction.rollback();
    console.error("End proctoring session error:", error);

    // Provide more specific error messages based on error type
    if (error instanceof Error) {
      if (error.message.includes("connect")) {
        return res.status(500).json({
          success: false,
          message: "Database connection error. Please try again later.",
        });
      }
      if (error.message.includes("validation")) {
        return res.status(400).json({
          success: false,
          message: "Invalid data provided for ending proctoring session.",
        });
      }
      if (
        error.message.includes("permission") ||
        error.message.includes("authorize")
      ) {
        return res.status(403).json({
          success: false,
          message: "You don't have permission to end this proctoring session.",
        });
      }
    }

    res.status(500).json({
      success: false,
      message:
        "An unexpected error occurred while ending the proctoring session. Please contact support if this persists.",
    });
  }
};

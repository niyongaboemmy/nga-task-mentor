import dotenv from "dotenv";
import path from "path";
import fs from "fs";
// Resolve .env relative to this file, not process.cwd() — pm2 restarts can
// run with a different working directory, which otherwise makes dotenv
// silently find nothing.
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import express from "express";
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";
import {
  Room,
  Client,
  JoinRoomPayload,
  OfferPayload,
  AnswerPayload,
  IceCandidatePayload,
  LeaveRoomPayload,
} from "./types";
import {
  createSocketAuthMiddleware,
  extractHandshakeToken,
  getIdentity,
  isProctorSocket,
  PROCTOR_ONLY_EVENTS,
  PROCTORS_ROOM,
  resolveAllowedOrigins,
  resolveProctoringRole,
  SocketAuthError,
  verifySocketToken,
} from "./socketAuth";

// Environment variables with defaults
const PORT = process.env.PORT || 5002;
const NODE_ENV = process.env.NODE_ENV || "development";
// Same env vars as the main API (ALLOWED_ORIGINS / CORS_ORIGIN / FRONTEND_URL);
// "*" only if explicitly configured.
const CORS_ORIGIN = resolveAllowedOrigins(process.env);

// Socket/HTTP auth uses the SAME secret the main API signs session JWTs with
// (server/src/models/User.model.ts -> JWT_SECRET). Set JWT_SECRET in
// live-server/.env; as a fallback (same host, e.g. local dev) read it from the
// sibling server/.env without importing any of its other variables.
const resolveJwtSecret = (): string | undefined => {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  for (const candidate of [
    path.resolve(__dirname, "../../server/.env"),
    path.resolve(process.cwd(), "../server/.env"),
  ]) {
    try {
      const parsed = dotenv.parse(fs.readFileSync(candidate));
      if (parsed.JWT_SECRET) {
        console.warn(
          `⚠️ JWT_SECRET not set for live-server; using the one from ${candidate}`,
        );
        return parsed.JWT_SECRET;
      }
    } catch {
      // file missing/unreadable — try the next candidate
    }
  }
  return undefined;
};
const JWT_SECRET = resolveJwtSecret();
if (!JWT_SECRET) {
  console.error(
    "❌ JWT_SECRET is not configured — every socket connection will be rejected. " +
      "Set JWT_SECRET in live-server/.env to the same value as the main API.",
  );
}
const MAX_PARTICIPANTS = parseInt(
  process.env.MAX_PARTICIPANTS_PER_ROOM || "10",
  10,
);

// Cloudflare TURN server configuration
const CF_TURN_TOKEN_ID = process.env.CLOUDFLARE_TURN_TOKEN_ID;
const CF_TURN_API_TOKEN = process.env.CLOUDFLARE_TURN_API_TOKEN;

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: CORS_ORIGIN,
    credentials: true,
    methods: ["GET", "POST"],
  },
  allowEIO3: true,
});

app.use(cors({ origin: CORS_ORIGIN, credentials: true }));

// Every socket must present a valid TaskMentor token (live ticket or session
// JWT); identity + proctor status come from the verified token only.
io.use(createSocketAuthMiddleware(() => JWT_SECRET));

// HTTP counterpart of the socket auth: `requireProctor` limits the endpoint to
// holders of a proctor live ticket.
const requireAuth =
  (requireProctor = false): express.RequestHandler =>
  (req, res, next) => {
    try {
      const identity = verifySocketToken(
        extractHandshakeToken({ headers: req.headers }),
        JWT_SECRET,
      );
      if (requireProctor && !identity.isProctor) {
        return res.status(403).json({ error: "Forbidden" });
      }
      return next();
    } catch (err) {
      const message =
        err instanceof SocketAuthError ? err.message : "Authentication failed";
      console.warn(`[live-server] Rejected ${req.method} ${req.path}: ${message}`);
      return res.status(401).json({ error: message });
    }
  };
app.use(express.json());

// Store rooms in memory (for general WebRTC room functionality)
const rooms: Map<string, Room> = new Map();

// Store active proctoring streams (from original socket-server.js)
const activeProctoringStreams = new Map<string, any>();

// Store client information by socket ID
const clients: Map<string, { roomId: string; userId: string }> = new Map();

// Health check endpoint
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    rooms: rooms.size,
    proctoringStreams: activeProctoringStreams.size,
    nodeEnv: NODE_ENV,
  });
});

// TURN credentials endpoint — fetches short-lived credentials from Cloudflare
// Cloudflare Realtime TURN: 1,000 GB/month free, global Anycast network
app.get("/turn-credentials", requireAuth(), async (_req, res) => {
  const fallback = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
  };

  if (!CF_TURN_TOKEN_ID || !CF_TURN_API_TOKEN) {
    return res.json(fallback);
  }

  try {
    const cfRes = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${CF_TURN_TOKEN_ID}/credentials/generate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${CF_TURN_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ttl: 86400 }),
      },
    );

    if (!cfRes.ok) {
      console.error("Cloudflare TURN API error:", cfRes.status, await cfRes.text());
      return res.json(fallback);
    }

    const data = await cfRes.json() as { iceServers: object | object[] };
    // Cloudflare may return iceServers as a single object — wrap in array for WebRTC spec
    const iceServers = Array.isArray(data.iceServers)
      ? data.iceServers
      : [data.iceServers];
    return res.json({ iceServers, ttl: 86400 });
  } catch (err) {
    console.error("Failed to fetch Cloudflare TURN credentials:", err);
    return res.json(fallback);
  }
});

// Get all rooms
app.get("/rooms", requireAuth(true), (_req, res) => {
  const roomList = Array.from(rooms.values()).map((room) => ({
    id: room.id,
    name: room.name,
    clientCount: room.clients.size,
    createdAt: room.createdAt,
  }));
  res.json(roomList);
});

// Get specific room info
app.get("/rooms/:roomId", requireAuth(true), (req, res) => {
  const room = rooms.get(req.params.roomId);
  if (!room) {
    return res.status(404).json({ error: "Room not found" });
  }
  res.json({
    id: room.id,
    name: room.name,
    clientCount: room.clients.size,
    clients: Array.from(room.clients.values()).map((c) => ({
      id: c.id,
      username: c.username,
      role: c.role,
      isAudioEnabled: c.isAudioEnabled,
      isVideoEnabled: c.isVideoEnabled,
    })),
    createdAt: room.createdAt,
  });
});

// Get active proctoring streams
app.get("/proctoring/streams", requireAuth(true), (_req, res) => {
  const streams = Array.from(activeProctoringStreams.values());
  res.json(streams);
});

console.log(`🚀 LIVE SERVER v3 - Started at ${new Date().toISOString()}`);
console.log(`🔧 Running in ${NODE_ENV} mode on port ${PORT}`);

// Socket.IO connection handling
io.on("connection", (socket: Socket) => {
  const identity = getIdentity(socket);
  console.log(
    `Client connected: ${socket.id} (user ${identity?.userId}, ${
      identity?.isProctor ? "proctor" : "non-proctor"
    }, via ${identity?.via})`,
  );

  // Proctors receive the global stream/status/screenshot broadcasts; students
  // no longer do (those used to go to every connected socket via io.emit).
  if (identity?.isProctor) socket.join(PROCTORS_ROOM);

  // Drop proctor-only commands (pause/end exam, warnings, screenshot
  // requests, WebRTC offers to students, stream listing) from non-proctors.
  socket.use(([event], next) => {
    if (PROCTOR_ONLY_EVENTS.has(event) && !isProctorSocket(socket)) {
      console.warn(
        `[live-server] Blocked proctor-only event "${event}" from non-proctor socket ${socket.id} (user ${identity?.userId})`,
      );
      socket.emit("proctoring-auth-error", {
        event,
        message: "Not authorized to perform this action",
      });
      return; // do not call next(): the packet is dropped
    }
    next();
  });

  // Debug: Listen for ALL events to trace
  socket.onAny((eventName, ...args) => {
    if (eventName.includes("webrtc") || eventName.includes("offer")) {
      console.log("🔍 DEBUG: Event received:", eventName, args);
    }
  });

  // ========================================
  // General WebRTC Room Events
  // ========================================

  // Create a new room
  socket.on(
    "create-room",
    (data: { roomName: string; username: string }, callback) => {
      const roomId = uuidv4();
      const room: Room = {
        id: roomId,
        name: data.roomName,
        clients: new Map(),
        createdAt: new Date(),
      };

      const clientId = uuidv4();
      const client: Client = {
        id: clientId,
        socketId: socket.id,
        username: data.username,
        role: "host",
        isAudioEnabled: true,
        isVideoEnabled: true,
        joinedAt: new Date(),
      };

      room.clients.set(clientId, client);
      rooms.set(roomId, room);
      clients.set(socket.id, { roomId, userId: clientId });

      socket.join(roomId);

      console.log(`Room created: ${roomId} by ${data.username}`);

      callback({
        success: true,
        roomId,
        clientId,
        room: {
          id: room.id,
          name: room.name,
          clients: Array.from(room.clients.values()),
        },
      });
    },
  );

  // Join an existing room
  socket.on("join-room", (payload: JoinRoomPayload, callback) => {
    const room = rooms.get(payload.roomId);

    if (!room) {
      return callback({ success: false, error: "Room not found" });
    }

    if (room.clients.size >= MAX_PARTICIPANTS) {
      return callback({ success: false, error: "Room is full" });
    }

    const clientId = uuidv4();
    const client: Client = {
      id: clientId,
      socketId: socket.id,
      // Identity from the verified token, never from the payload.
      userId: identity ? String(identity.userId) : undefined,
      username: payload.username,
      role: payload.role,
      isAudioEnabled: true,
      isVideoEnabled: true,
      joinedAt: new Date(),
    };

    room.clients.set(clientId, client);
    clients.set(socket.id, { roomId: payload.roomId, userId: clientId });
    socket.join(payload.roomId);

    // Notify other clients in the room
    socket.to(payload.roomId).emit("user-joined", {
      userId: clientId,
      username: payload.username,
      role: payload.role,
    });

    console.log(`${payload.username} joined room ${payload.roomId}`);

    callback({
      success: true,
      clientId,
      room: {
        id: room.id,
        name: room.name,
        clients: Array.from(room.clients.values()),
      },
    });
  });

  // Leave a room
  socket.on("leave-room", (payload: LeaveRoomPayload) => {
    handleLeaveRoom(socket, payload.roomId, payload.userId);
  });

  // WebRTC Offer - sent from caller to callee
  socket.on("offer", (payload: OfferPayload) => {
    const room = rooms.get(payload.roomId);
    if (!room) return;

    const receiver = room.clients.get(payload.receiverId);
    if (receiver) {
      io.to(receiver.socketId).emit("offer", {
        senderId: payload.senderId,
        sdp: payload.sdp,
      });
    }
  });

  // WebRTC Answer - sent from callee to caller
  socket.on("answer", (payload: AnswerPayload) => {
    const room = rooms.get(payload.roomId);
    if (!room) return;

    const receiver = room.clients.get(payload.receiverId);
    if (receiver) {
      io.to(receiver.socketId).emit("answer", {
        senderId: payload.senderId,
        sdp: payload.sdp,
      });
    }
  });

  // ICE Candidate exchange
  socket.on("ice-candidate", (payload: IceCandidatePayload) => {
    const room = rooms.get(payload.roomId);
    if (!room) return;

    const receiver = room.clients.get(payload.receiverId);
    if (receiver) {
      io.to(receiver.socketId).emit("ice-candidate", {
        senderId: payload.senderId,
        candidate: payload.candidate,
      });
    }
  });

  // Toggle audio
  socket.on(
    "toggle-audio",
    (data: { roomId: string; userId: string; enabled: boolean }) => {
      const room = rooms.get(data.roomId);
      if (!room) return;

      const client = room.clients.get(data.userId);
      if (client) {
        client.isAudioEnabled = data.enabled;
        socket.to(data.roomId).emit("user-toggled-audio", {
          userId: data.userId,
          enabled: data.enabled,
        });
      }
    },
  );

  // Toggle video
  socket.on(
    "toggle-video",
    (data: { roomId: string; userId: string; enabled: boolean }) => {
      const room = rooms.get(data.roomId);
      if (!room) return;

      const client = room.clients.get(data.userId);
      if (client) {
        client.isVideoEnabled = data.enabled;
        socket.to(data.roomId).emit("user-toggled-video", {
          userId: data.userId,
          enabled: data.enabled,
        });
      }
    },
  );

  // Get room state
  socket.on("get-room-state", (roomId: string, callback) => {
    const room = rooms.get(roomId);
    if (!room) {
      return callback({ error: "Room not found" });
    }

    callback({
      room: {
        id: room.id,
        name: room.name,
        clients: Array.from(room.clients.values()),
      },
    });
  });

  // ========================================
  // Proctoring Events (from socket-server.js)
  // ========================================

  socket.on(
    "join-proctoring-session",
    (data: { sessionToken: string; role?: string }) => {
      const { sessionToken } = data || ({} as { sessionToken: string });
      if (!sessionToken) return;
      // The claimed role is only honoured when consistent with the verified
      // identity: "dashboard" requires a proctor live ticket.
      const decision = resolveProctoringRole(identity, data.role);
      if (!decision.allowed) {
        console.warn(
          `[live-server] Denied join-proctoring-session as "${data.role}" for socket ${socket.id} (user ${identity?.userId}): ${decision.reason}`,
        );
        socket.emit("proctoring-auth-error", {
          event: "join-proctoring-session",
          sessionToken,
          message: decision.reason,
        });
        return;
      }
      const role = decision.role;
      socket.join("proctoring-" + sessionToken);
      console.log(
        `Client ${socket.id} (user ${identity?.userId}) joined proctoring session: ${sessionToken} as ${role}`,
      );

      // If this is a STUDENT joining, add them to activeStreams immediately
      if (role === "student") {
        console.log(
          `🚨 Adding student to activeProctoringStreams based on join-proctoring-session:`,
          sessionToken,
        );

        const existingStream = activeProctoringStreams.get(sessionToken);
        if (!existingStream) {
          activeProctoringStreams.set(sessionToken, {
            sessionToken,
            student: { first_name: "Student", last_name: "" },
            studentUserId: identity?.userId,
            quiz: { title: "Quiz" },
            startTime: new Date(),
            socketId: socket.id,
            isLive: true,
            lastReconnection: null,
          });

          io.to(PROCTORS_ROOM).emit("stream-started", {
            sessionToken,
            student: { first_name: "Student", last_name: "" },
            quiz: { title: "Quiz" },
            startTime: new Date(),
            isLive: true,
            isReconnection: false,
          });
          console.log(
            `🚨 Emitted stream-started for student who joined session:`,
            sessionToken,
          );
        }
      }

      // If this is a dashboard joining, notify the student to reset their connection
      if (role === "dashboard") {
        console.log(
          `Dashboard joined session ${sessionToken}, notifying student to reset connection`,
        );
        socket.to("proctoring-" + sessionToken).emit("dashboard-reconnected", {
          sessionToken,
          message:
            "Dashboard has reconnected, please reset your WebRTC connection",
        });
      }
    },
  );

  socket.on("leave-proctoring-session", (sessionToken: string) => {
    socket.leave("proctoring-" + sessionToken);
    console.log(`Client ${socket.id} left proctoring session: ${sessionToken}`);
  });

  socket.on(
    "student-stream-started",
    (data: { sessionToken: string; studentInfo: any; quizInfo: any; cameraHidden?: boolean }) => {
      console.log("🚨🚨🚨 Student stream started RECEIVED on server:", data);
      const { sessionToken, studentInfo, quizInfo, cameraHidden } = data;

      if (!sessionToken) {
        console.error(
          "🚨🚨🚨 ERROR: student-stream-started received WITHOUT sessionToken!",
        );
        return;
      }

      const existingStream = activeProctoringStreams.get(sessionToken);
      const isReconnection = !!existingStream;

      activeProctoringStreams.set(sessionToken, {
        sessionToken,
        student: studentInfo,
        // Verified user id of the streaming socket (studentInfo is client-supplied).
        studentUserId: identity?.userId,
        quiz: quizInfo,
        startTime: new Date(),
        socketId: socket.id,
        isLive: true,
        cameraHidden: cameraHidden ?? false,
        lastReconnection: isReconnection ? new Date() : null,
      });

      console.log(
        "🚨🚨🚨 EMITTING stream-started to proctor clients:",
        sessionToken,
      );

      io.to(PROCTORS_ROOM).emit("stream-started", {
        sessionToken,
        student: studentInfo,
        quiz: quizInfo,
        startTime: new Date(),
        isLive: true,
        isReconnection,
        cameraHidden: cameraHidden ?? false,
      });

      io.to("proctoring-" + sessionToken).emit("stream-started", {
        sessionToken,
        student: studentInfo,
        quiz: quizInfo,
        startTime: new Date(),
        isLive: true,
        isReconnection,
        cameraHidden: cameraHidden ?? false,
      });

      console.log(
        "✅ Active proctoring streams count:",
        activeProctoringStreams.size,
      );
      if (isReconnection) {
        console.log("Student reconnected to stream:", sessionToken);
      }
    },
  );

  socket.on("student-stream-ended", (sessionToken: string) => {
    console.log("Student stream ended:", sessionToken);

    if (activeProctoringStreams.has(sessionToken)) {
      activeProctoringStreams.delete(sessionToken);
      io.to(PROCTORS_ROOM).emit("stream-ended", { sessionToken });
      console.log(
        "Active proctoring streams count:",
        activeProctoringStreams.size,
      );
    }
  });

  socket.on("resume-stream", (sessionToken: string) => {
    console.log("Student attempting to resume stream:", sessionToken);

    const existingStream = activeProctoringStreams.get(sessionToken);
    if (existingStream && !existingStream.socketId) {
      activeProctoringStreams.set(sessionToken, {
        ...existingStream,
        socketId: socket.id,
        isLive: true,
        lastReconnection: new Date(),
        disconnectedAt: null,
      });

      io.to(PROCTORS_ROOM).emit("stream-resumed", {
        sessionToken,
        resumedAt: new Date(),
        wasDisconnected: true,
      });

      console.log("Stream resumed successfully:", sessionToken);
    } else if (!existingStream) {
      socket.emit("stream-not-found", { sessionToken });
    }
  });

  socket.on("get-active-streams", async () => {
    try {
      const streams = Array.from(activeProctoringStreams.values());
      socket.emit("active-streams", streams);
    } catch (error) {
      console.error("Error getting active streams:", error);
      socket.emit("active-streams", []);
    }
  });

  socket.on("student-webrtc-ready", (data: any) => {
    console.log("Student signaled WebRTC readiness:", data);
    socket.to("proctoring-" + data.sessionToken).emit("student-webrtc-ready", {
      sessionToken: data.sessionToken,
      message: data.message,
      from: socket.id,
    });
  });

  socket.on("webrtc-offer", (data: any) => {
    console.log("🔧 SERVER: Received WebRTC offer:", {
      hasSessionToken: !!data.sessionToken,
      sessionToken: data.sessionToken,
      hasOffer: !!data.offer,
      from: socket.id,
    });

    if (!data.sessionToken) {
      console.error(
        "🔧 SERVER ERROR: sessionToken is MISSING from webrtc-offer!",
      );
      return;
    }

    const emitData = {
      offer: data.offer,
      from: socket.id,
      sessionToken: data.sessionToken,
    };

    const room = "proctoring-" + data.sessionToken;
    socket.to(room).emit("webrtc-offer", emitData);
  });

  socket.on("webrtc-answer", (data: any) => {
    if (!data.sessionToken) {
      console.error("⚠️ webrtc-answer received without sessionToken — dropped");
      return;
    }

    const room = "proctoring-" + data.sessionToken;
    socket.to(room).emit("webrtc-answer", {
      answer: data.answer,
      from: socket.id,
      sessionToken: data.sessionToken,
    });
  });

  socket.on("webrtc-ice-candidate", (data: any) => {
    console.log("Received WebRTC ICE candidate:", data);

    if (!data.sessionToken) {
      console.error("⚠️ ICE candidate received WITHOUT sessionToken — dropped");
      return;
    }

    socket.to("proctoring-" + data.sessionToken).emit("webrtc-ice-candidate", {
      candidate: data.candidate,
      from: socket.id,
      sessionToken: data.sessionToken,
    });
  });

  socket.on("request-student-audio-confirmation", (data: any) => {
    console.log("Received request for student audio confirmation:", data);
    socket
      .to("proctoring-" + data.sessionToken)
      .emit("request-student-audio-confirmation", {
        sessionToken: data.sessionToken,
        volume: data.volume || 0.5,
        micGain: data.micGain || 0.6,
        requestId: data.requestId,
      });
  });

  socket.on("student-audio-confirmation", (data: any) => {
    console.log("Received student audio confirmation:", data);
    socket
      .to("proctoring-" + data.sessionToken)
      .emit("student-audio-confirmation", {
        sessionToken: data.sessionToken,
        confirmed: data.confirmed,
        requestId: data.requestId,
      });
  });

  socket.on("force-student-audio", (data: any) => {
    console.log("Received force student audio command:", data);
    socket.to("proctoring-" + data.sessionToken).emit("force-student-audio", {
      sessionToken: data.sessionToken,
      volume: data.volume || 0.5,
      micGain: data.micGain || 0.6,
    });
  });

  // Handle warning sent from instructor to student
  socket.on("send-warning-to-student", (data: any) => {
    console.log("Received send-warning-to-student:", data);
    const { sessionToken, message } = data;

    // Forward the warning to the student in the proctoring session
    socket.to("proctoring-" + sessionToken).emit("send-warning-to-student", {
      sessionToken,
      message,
    });
  });

  // Handle note sent from instructor to student
  socket.on("send-note-to-student", (data: any) => {
    console.log("Received send-note-to-student:", data);
    const { sessionToken, message } = data;

    // Forward the note to the student in the proctoring session
    socket.to("proctoring-" + sessionToken).emit("send-note-to-student", {
      sessionToken,
      message,
    });
  });

  // Handle pause exam command from instructor
  socket.on("pause-student-exam", (data: any) => {
    console.log("Received pause-student-exam:", data);
    const { sessionToken, reason } = data;

    // Forward the pause command to the student
    socket.to("proctoring-" + sessionToken).emit("pause-student-exam", {
      sessionToken,
      reason: reason || "Exam paused by instructor",
    });
  });

  // Handle resume exam command from instructor
  socket.on("resume-student-exam", (data: any) => {
    console.log("Received resume-student-exam:", data);
    const { sessionToken } = data;

    // Forward the resume command to the student
    socket.to("proctoring-" + sessionToken).emit("resume-student-exam", {
      sessionToken,
    });
  });

  // Handle exam status changed from student
  socket.on("exam-status-changed", (data: any) => {
    console.log("Received exam-status-changed:", data);
    const { sessionToken, status } = data;

    // Broadcast the status change to all clients in the room and globally
    socket.to("proctoring-" + sessionToken).emit("exam-status-changed", {
      sessionToken,
      status,
    });

    io.to(PROCTORS_ROOM).emit("exam-status-changed", {
      sessionToken,
      status,
    });
  });

  // Handle restart quiz command from instructor
  socket.on("restart-student-quiz", (data: any) => {
    console.log("Received restart-student-quiz:", data);
    const { sessionToken } = data;

    // Forward the restart command to the student
    socket.to("proctoring-" + sessionToken).emit("restart-student-quiz", {
      sessionToken,
    });
  });

  // Handle request for student screenshot (camera)
  socket.on("request-student-camera-screenshot", (data: any) => {
    console.log("Received request-student-camera-screenshot:", data);
    const { sessionToken } = data;

    // Forward the request to the student
    socket
      .to("proctoring-" + sessionToken)
      .emit("request-student-camera-screenshot", {
        sessionToken,
      });
  });

  // Handle student sending camera screenshot
  socket.on("student-camera-screenshot", (data: any) => {
    console.log("Received student-camera-screenshot:", data);
    const { sessionToken, screenshot } = data;

    // Broadcast to instructor dashboard
    io.to(PROCTORS_ROOM).emit("student-camera-screenshot", {
      sessionToken,
      screenshot,
      timestamp: new Date(),
    });
  });

  // Handle request for student interface screenshot
  socket.on("request-student-interface-screenshot", (data: any) => {
    console.log("Received request-student-interface-screenshot:", data);
    const { sessionToken } = data;

    // Forward the request to the student
    socket
      .to("proctoring-" + sessionToken)
      .emit("request-student-interface-screenshot", {
        sessionToken,
      });
  });

  // Handle student sending interface screenshot
  socket.on("student-interface-screenshot", (data: any) => {
    console.log("Received student-interface-screenshot:", data);
    const { sessionToken, screenshot } = data;

    // Broadcast to instructor dashboard
    io.to(PROCTORS_ROOM).emit("student-interface-screenshot", {
      sessionToken,
      screenshot,
      timestamp: new Date(),
    });
  });

  socket.on("proctoring-violation", (data: any) => {
    console.log("Received proctoring violation:", data);
    const { sessionToken, quizId, violation } = data;

    socket.to("proctoring-" + sessionToken).emit("proctoring-violation", {
      sessionToken,
      quizId,
      violation,
      timestamp: new Date(),
    });

    io.to(PROCTORS_ROOM).emit("global-proctoring-violation", {
      sessionToken,
      quizId,
      violation,
      timestamp: new Date(),
    });
  });

  socket.on("end-student-quiz", (data: any) => {
    console.log("Received end student quiz command:", data);
    const { sessionToken, reason } = data;

    socket.to("proctoring-" + sessionToken).emit("quiz-terminated", {
      sessionToken,
      reason,
      terminatedAt: new Date(),
    });
  });

  // ========================================
  // Disconnect Handler
  // ========================================
  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);

    // Handle proctoring stream disconnection
    for (const [
      sessionToken,
      streamData,
    ] of activeProctoringStreams.entries()) {
      if (streamData.socketId === socket.id) {
        activeProctoringStreams.set(sessionToken, {
          ...streamData,
          socketId: null,
          isLive: false,
          disconnectedAt: new Date(),
        });

        io.to(PROCTORS_ROOM).emit("stream-paused", {
          sessionToken,
          reason: "student_disconnected",
          disconnectedAt: new Date(),
        });

        console.log("Marked stream as temporarily disconnected:", sessionToken);
      }
    }

    // Handle room disconnection
    const clientInfo = clients.get(socket.id);
    if (clientInfo) {
      handleLeaveRoom(socket, clientInfo.roomId, clientInfo.userId);
    }
  });
});

// Helper function to handle leaving a room
function handleLeaveRoom(socket: Socket, roomId: string, userId: string): void {
  const room = rooms.get(roomId);
  if (!room) return;

  const client = room.clients.get(userId);
  if (!client) return;

  socket.to(roomId).emit("user-left", { userId });
  room.clients.delete(userId);
  clients.delete(socket.id);
  socket.leave(roomId);

  if (room.clients.size === 0) {
    rooms.delete(roomId);
    console.log(`Room ${roomId} deleted (empty)`);
  } else {
    console.log(`${client.username} left room ${roomId}`);
  }
}

// Tests set LIVE_SERVER_NO_LISTEN=1 so they can import the configured server
// and listen on an ephemeral port. (Not `require.main === module`: pm2 fork
// mode loads the script via require(), which would make that check false.)
if (process.env.LIVE_SERVER_NO_LISTEN !== "1") {
  httpServer.listen(PORT, () => {
    console.log(`✅ Live Server running on port ${PORT}`);
    console.log(`✅ WebSocket server ready for WebRTC signaling and proctoring`);
  });
}

export { app, httpServer, io, rooms, clients, activeProctoringStreams };

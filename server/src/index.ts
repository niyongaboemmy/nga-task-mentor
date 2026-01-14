import "reflect-metadata";
import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { Sequelize } from "sequelize-typescript";
import { Server as SocketIOServer, Socket } from "socket.io";
import http from "http";
import {
  sequelize as sequelizeInstance,
  testConnection,
} from "./config/database";
import { setupAssociations } from "./models";
import { ProctoringSession } from "./models";

// Load environment variables
dotenv.config();
console.log("Environment variables loaded:");
console.log("JWT_SECRET:", process.env.JWT_SECRET ? "SET" : "NOT SET");
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("PORT:", process.env.PORT);

// Set server timezone to UTC for consistent date handling
process.env.TZ = "UTC";
console.log("Server timezone set to:", process.env.TZ);

const app: Application = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: true,
    credentials: true,
    methods: ["GET", "POST"],
  },
  allowEIO3: true,
});

// Import routes
import authRoutes from "./routes/auth";
import userRoutes from "./routes/users";
import courseRoutes from "./routes/courses";
import assignmentRoutes from "./routes/assignments";
import submissionRoutes from "./routes/submissions";
import dashboardRoutes from "./routes/dashboard";
import quizRoutes from "./routes/quizzes";
import proctoringRoutes from "./routes/proctoring";

// Security middleware
app.set("trust proxy", 1); // Trust one proxy (e.g., cPanel)
app.use(helmet());
app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-mis-token"],
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10000, // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from uploads directory
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Test database connection and sync models
const initializeDatabase = async (): Promise<void> => {
  try {
    await testConnection();
    console.log("Database connection has been established successfully.");

    // Import all models to ensure they're registered with Sequelize
    const {
      User,
      Course,
      Assignment,
      Submission,
      UserCourse,
      Quiz,
      QuizQuestion,
      QuizAttempt,
      QuizSubmission,
      ProctoringSession,
      ProctoringEvent,
      ProctoringSettings,
    } = await import("./models");

    // Add models to Sequelize instance
    sequelizeInstance.addModels([
      User,
      Course,
      Assignment,
      Submission,
      UserCourse,
      Quiz,
      QuizQuestion,
      QuizAttempt,
      QuizSubmission,
      ProctoringSession,
      ProctoringEvent,
      ProctoringSettings,
    ]);

    // Set up model associations
    const models = await import("./models");
    models.setupAssociations();

    // Sync all models (use alter: false to avoid MySQL key limit issues)
    await sequelizeInstance.sync({ alter: false });
    console.log("Database synchronized");

    // Add any additional initialization here
  } catch (error) {
    console.error("Unable to connect to the database:", error);
    process.exit(1);
  }
};

// Initialize database first, then start server
const startServer = async (): Promise<void> => {
  try {
    await initializeDatabase();

    // API Routes (only set up after database is ready)
    app.use("/api/auth", authRoutes);
    app.use("/api/users", userRoutes);
    app.use("/api/courses", courseRoutes);
    app.use("/api/assignments", assignmentRoutes);
    app.use("/api/submissions", submissionRoutes);
    app.use("/api/dashboard", dashboardRoutes);
    app.use("/api/quizzes", quizRoutes);
    app.use("/api/proctoring", proctoringRoutes);

    // Health check endpoint
    app.get("/health", (req: Request, res: Response) => {
      res
        .status(200)
        .json({ status: "ok", timestamp: new Date().toISOString() });
    });

    // 404 handler
    app.use((req: Request, res: Response) => {
      res.status(404).json({
        status: "error",
        message: "Not Found",
        path: req.path,
      });
    });

    // Error handling middleware
    app.use((err: any, req: Request, res: Response, next: NextFunction) => {
      console.error("Error:", err);

      const statusCode = err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      res.status(statusCode).json({
        status: "error",
        statusCode,
        message,
        ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
      });
    });

    const PORT = process.env.PORT || 5000;

    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });

    // Socket.IO setup for proctoring
    io.on("connection", (socket: any) => {
      console.log("Client connected:", socket.id);

      // Join proctoring session room
      socket.on("join-proctoring-session", (sessionToken: string) => {
        socket.join(`proctoring-${sessionToken}`);
        console.log(
          `Client ${socket.id} joined proctoring session: ${sessionToken}`
        );
      });

      // Leave proctoring session room
      socket.on("leave-proctoring-session", (sessionToken: string) => {
        socket.leave(`proctoring-${sessionToken}`);
        console.log(
          `Client ${socket.id} left proctoring session: ${sessionToken}`
        );
      });

      // WebRTC signaling for video streaming
      socket.on(
        "webrtc-offer",
        (data: { sessionToken: string; offer: any; targetUserId?: string }) => {
          socket.to(`proctoring-${data.sessionToken}`).emit("webrtc-offer", {
            offer: data.offer,
            from: socket.id,
            targetUserId: data.targetUserId,
          });
        }
      );

      socket.on(
        "webrtc-answer",
        (data: {
          sessionToken: string;
          answer: any;
          targetUserId?: string;
        }) => {
          socket.to(`proctoring-${data.sessionToken}`).emit("webrtc-answer", {
            answer: data.answer,
            from: socket.id,
            targetUserId: data.targetUserId,
          });
        }
      );

      socket.on(
        "webrtc-ice-candidate",
        (data: {
          sessionToken: string;
          candidate: any;
          targetUserId?: string;
        }) => {
          socket
            .to(`proctoring-${data.sessionToken}`)
            .emit("webrtc-ice-candidate", {
              candidate: data.candidate,
              from: socket.id,
              targetUserId: data.targetUserId,
            });
        }
      );

      // Proctoring events
      socket.on(
        "proctoring-event",
        (data: { sessionToken: string; event: any }) => {
          socket
            .to(`proctoring-${data.sessionToken}`)
            .emit("proctoring-event", data.event);
        }
      );

      socket.on("disconnect", () => {
        console.log("Client disconnected:", socket.id);

        // Update database when student disconnects
        // Find any active proctoring sessions for this socket and mark as disconnected
        ProctoringSession.update(
          { is_connected: false },
          {
            where: {
              status: "active",
              // Note: We would need to track socket_id in the session to properly map this
              // For now, we'll handle this in the socket server
            },
          }
        ).catch((err: any) =>
          console.error("Error updating session on disconnect:", err)
        );
      });
    });

    // Handle unhandled promise rejections
    process.on("unhandledRejection", (err: Error) => {
      console.error("UNHANDLED REJECTION! 💥 Shutting down...");
      console.error(err.name, err.message);
      server.close(() => {
        process.exit(1);
      });
    });

    // Handle uncaught exceptions
    process.on("uncaughtException", (err: Error) => {
      console.error("UNCAUGHT EXCEPTION! 💥 Shutting down...");
      console.error(err.name, err.message);
      server.close(() => {
        process.exit(1);
      });
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

// Start the server
startServer();

export default app;

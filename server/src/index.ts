import "reflect-metadata";
import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";
import dotenv from "dotenv";
import { Sequelize } from "sequelize-typescript";
import http from "http";
import {
  sequelize as sequelizeInstance,
  testConnection,
} from "./config/database";
import { setupAssociations } from "./models";

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

// Import routes
import authRoutes from "./routes/auth";
import userRoutes from "./routes/users";
import courseRoutes from "./routes/courses";
import assignmentRoutes from "./routes/assignments";
import submissionRoutes from "./routes/submissions";
import dashboardRoutes from "./routes/dashboard";
import quizRoutes from "./routes/quizzes";
import proctoringRoutes from "./routes/proctoring";
import questionBankRoutes from "./routes/questionBank";

import cookieParser from "cookie-parser";

// Security middleware
app.set("trust proxy", 1); // Trust one proxy (e.g., cPanel)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "frame-src": ["'self'", "blob:", "http://localhost:*", "https://*"],
        "img-src": [
          "'self'",
          "data:",
          "blob:",
          "http://localhost:*",
          "https://*",
        ],
        "connect-src": ["'self'", "http://localhost:*", "https://*"],
      },
    },
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
  }),
);
app.use(cookieParser()); // Parse cookies
// Collect allowed origins from all env vars that may define them
const allowedOrigins = [
  process.env.ALLOWED_ORIGINS,
  process.env.CORS_ORIGIN,
  process.env.FRONTEND_URL,
  // Hard-coded dev fallbacks and production domains
  "http://localhost:5173,http://localhost:5174,http://localhost:3000",
  "https://nga.ac.rw,https://taskmentor.hts.rw,https://task-mentor-gamma.vercel.app",
]
  .filter(Boolean)
  .flatMap((s) => s!.split(","))
  .map((o) => o.trim())
  .filter((v, i, arr) => Boolean(v) && arr.indexOf(v) === i);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      // Check if origin is in allowedOrigins list
      if (allowedOrigins.includes(origin)) return callback(null, true);

      // Additional check for known production domains and localhost
      if (
        origin.includes("nga.ac.rw") ||
        origin.includes("hts.rw") ||
        origin.startsWith("http://localhost") ||
        origin.startsWith("http://127.0.0.1")
      ) {
        return callback(null, true);
      }

      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"],
    allowedHeaders: ["Content-Type", "Authorization", "x-mis-token"],
  }),
);

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from uploads directory with explicit CORS
app.use(
  "/uploads",
  (req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
    } else {
      res.setHeader("Access-Control-Allow-Origin", "*");
    }
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, HEAD");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, x-mis-token",
    );

    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }
    next();
  },
  express.static(path.join(__dirname, "../uploads")),
);

// Test database connection and sync models
const initializeDatabase = async (): Promise<void> => {
  try {
    await testConnection();

    // Import all models to ensure they're registered with Sequelize
    const {
      User,
      Assignment,
      Submission,
      Quiz,
      QuizQuestion,
      QuizAttempt,
      QuizSubmission,
      ProctoringSession,
      ProctoringEvent,
      ProctoringSettings,
      BloomsTaxonomyLevel,
      QuestionBank,
    } = await import("./models");

    // Add models to Sequelize instance
    sequelizeInstance.addModels([
      User,
      Assignment,
      Submission,
      Quiz,
      QuizQuestion,
      QuizAttempt,
      QuizSubmission,
      ProctoringSession,
      ProctoringEvent,
      ProctoringSettings,
      BloomsTaxonomyLevel,
      QuestionBank,
    ]);

    // Set up model associations
    const models = await import("./models");
    models.setupAssociations();

    // Sync all models (use alter: true to update schema if needed, but currently causing too many keys error)
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
    app.use("/api/courses/:courseId/question-bank", questionBankRoutes);
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
      console.log(
        `Note: Socket functionality moved to live-server (port 5002)`,
      );
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

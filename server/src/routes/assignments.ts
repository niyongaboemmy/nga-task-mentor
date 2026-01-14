import { Router } from "express";
import {
  getAssignments,
  getAssignment,
  createAssignment,
  updateAssignment,
  updateAssignmentStatus,
  deleteAssignment,
  publishAssignment,
  getAssignmentSubmissions,
  getEnrolledAssignments,
  submitAssignment,
} from "../controllers/assignment.controller";
import { protect, authorize, isCourseInstructor } from "../middleware/auth";
import { timezoneMiddleware } from "../utils/dateUtils";

// Configure multer for file uploads (same config as in index.ts)
import multer from "multer";
import path from "path";
import fs from "fs";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../../uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept common file types for assignments
    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/zip",
      "application/x-zip-compressed",
      "application/x-7z-compressed",
      "application/x-rar-compressed",
      "application/rar",
      "application/x-rar",
      "text/plain",
      "image/jpeg",
      "image/png",
      "image/gif",
    ];

    // Check MIME type
    const isAllowedMimeType = allowedTypes.includes(file.mimetype);

    // Additional check: allow files with generic MIME type but valid extensions
    const allowedExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.zip', '.7z', '.rar', '.txt', '.jpg', '.jpeg', '.png', '.gif'];
    const fileExtension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
    const isAllowedExtension = allowedExtensions.includes(fileExtension);

    // Special case: allow octet-stream (generic binary) files with valid extensions
    const isGenericBinaryWithValidExtension = file.mimetype === 'application/octet-stream' && isAllowedExtension;

    // Allow if either MIME type matches or extension is valid or it's a generic binary with valid extension
    if (isAllowedMimeType || isAllowedExtension || isGenericBinaryWithValidExtension) {
      cb(null, true);
    } else {
      console.log(`File rejected - MIME: ${file.mimetype}, Extension: ${fileExtension}, Original: ${file.originalname}`);
      cb(new Error(`Invalid file type. Only PDF, DOC, XLS, ZIP, 7Z, RAR, TXT, and images are allowed. Received: ${file.mimetype}`));
    }
  },
});

const router = Router();

// Public routes
router.get("/", getAssignments);
// Get enrolled assignments for students
router.get(
  "/enrolled",
  protect,
  authorize("student"),
  getEnrolledAssignments
);
router.get("/:id", getAssignment);

// Protected routes
router.use(protect);

// Instructor and admin routes - these should be for general assignment operations
router.post("/", authorize("instructor", "admin"), timezoneMiddleware(['due_date']), createAssignment);

// Course instructor and admin routes
router
  .route("/:id")
  .put(authorize("instructor", "admin"), isCourseInstructor, timezoneMiddleware(['due_date']), updateAssignment)
  .delete(
    authorize("instructor", "admin"),
    isCourseInstructor,
    deleteAssignment
  );

// Publish assignment (legacy route - keeping for backward compatibility)
router.put(
  "/:id/publish",
  authorize("instructor", "admin"),
  isCourseInstructor,
  publishAssignment
);

// Update assignment status
router.patch(
  "/:id/status",
  authorize("instructor", "admin"),
  isCourseInstructor,
  updateAssignmentStatus
);

// Submit assignment (for students) - temporarily remove auth for testing
router.post(
  "/:id/submit",
  upload.single("file_submission"), // Apply multer middleware for file uploads
  protect,
  authorize("student"),
  submitAssignment
);

// Get submissions for an assignment - Students see only their own, Instructors see all
router.get(
  "/:id/submissions",
  protect,
  // authorize("instructor", "admin"), // Students can view their own submissions
  getAssignmentSubmissions
);

// Download submissions as zip (TODO: implement)
// router.get(
//   "/:id/submissions/download",
//   authorize("instructor", "admin"),
//   isCourseInstructor,
//   downloadSubmissions
// );

export default router;

import multer from "multer";
import path from "path";
import fs from "fs";
import { Request } from "express";

// Ensure upload directory exists
const uploadDir = path.join(__dirname, "../../uploads/assignments");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    // Sanitize filename to remove special characters but keep extension
    const sanitizeFilename = (name: string) =>
      name.replace(/[^a-z0-9.]/gi, "_").toLowerCase();
    const originalName = sanitizeFilename(file.originalname);
    cb(null, "assignment-" + uniqueSuffix + "-" + originalName);
  },
});

// File filter (allow most document types)
const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  // Allowed mime types
  const allowedMimeTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
    "text/plain",
    "image/jpeg",
    "image/png",
    "image/gif",
    "application/zip",
    "application/x-zip-compressed",
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    // If mime type detection fails or is generic, check extension
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = [
      ".pdf",
      ".doc",
      ".docx",
      ".xls",
      ".xlsx",
      ".ppt",
      ".pptx",
      ".txt",
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".zip",
    ];

    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid file type. Allowed types: PDF, Word, Excel, PowerPoint, Text, Images, and ZIP.",
        ),
      );
    }
  }
};

// Configure multer
export const uploadAssignmentAttachment = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

export default uploadAssignmentAttachment;

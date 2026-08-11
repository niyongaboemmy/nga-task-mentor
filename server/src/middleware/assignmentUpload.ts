import multer from "multer";
import path from "path";
import { Request } from "express";

// In-memory buffer, uploaded to the shared file-server by the controller
// (which is also where the filename is now generated -- see
// utils/uploadFilename.ts -- since memoryStorage has no destination/filename
// callback the way diskStorage did).
const storage = multer.memoryStorage();

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

import multer from "multer";
import path from "path";
import { Request, Response, NextFunction } from "express";

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
    "image/webp",
    "text/csv",
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
      ".webp",
      ".csv",
      ".zip",
      ".rar",
      ".7z",
    ];

    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(
        Object.assign(
          new Error(
            `"${file.originalname}" can't be attached. Allowed: PDF, Word, Excel, PowerPoint, text/CSV, images (JPG, PNG, GIF, WebP) and archives (ZIP, RAR, 7z).`,
          ),
          { statusCode: 400 },
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

/** Attachment limits the client mirrors in its dropzone (ASSIGNMENT_ATTACHMENT_*). */
export const ASSIGNMENT_ATTACHMENT_MAX_MB = 10;

/**
 * uploadAssignmentAttachment.any() with its errors turned into a 400/413 the
 * form can show, instead of falling through to the global handler as a 500.
 */
export const assignmentAttachments = (req: Request, res: Response, next: NextFunction) =>
  uploadAssignmentAttachment.any()(req, res, (err: any) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      const tooBig = err.code === "LIMIT_FILE_SIZE";
      return res.status(tooBig ? 413 : 400).json({
        success: false,
        message: tooBig
          ? `A file is too large. Each attachment can be at most ${ASSIGNMENT_ATTACHMENT_MAX_MB} MB.`
          : err.message,
      });
    }
    return res.status(err.statusCode || 400).json({ success: false, message: err.message });
  });

export default uploadAssignmentAttachment;

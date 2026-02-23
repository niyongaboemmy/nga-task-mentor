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
    // Sanitize filename to remove special characters but keep extension
    const sanitizeFilename = (name: string) => {
      const ext = path.extname(name);
      const base = path.basename(name, ext);
      const sanitizedBase = base.replace(/[^a-z0-9]/gi, "_").toLowerCase();
      return sanitizedBase + ext;
    };
    const sanitizedName = sanitizeFilename(file.originalname);
    cb(null, "submission-" + uniqueSuffix + "-" + sanitizedName);
  },
});

export const uploadSubmission = multer({
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
      "application/illustrator",
      "application/postscript",
    ];

    // Check MIME type
    const isAllowedMimeType = allowedTypes.includes(file.mimetype);

    // Additional check: allow files with generic MIME type but valid extensions
    const allowedExtensions = [
      ".pdf",
      ".doc",
      ".docx",
      ".xls",
      ".xlsx",
      ".csv",
      ".zip",
      ".7z",
      ".rar",
      ".txt",
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".ai",
    ];
    const fileExtension = file.originalname
      .toLowerCase()
      .substring(file.originalname.lastIndexOf("."));
    const isAllowedExtension = allowedExtensions.includes(fileExtension);

    // Special case: allow octet-stream (generic binary) files with valid extensions
    const isGenericBinaryWithValidExtension =
      file.mimetype === "application/octet-stream" && isAllowedExtension;

    if (
      isAllowedMimeType ||
      isAllowedExtension ||
      isGenericBinaryWithValidExtension
    ) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Invalid file type. Only PDF, DOC, XLS, ZIP, 7Z, RAR, TXT, AI, and images are allowed.`,
        ),
      );
    }
  },
});

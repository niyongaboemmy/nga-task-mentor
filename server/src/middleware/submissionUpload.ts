import multer from "multer";

// In-memory buffer, uploaded to the shared file-server by the controller
// (which is also where the filename is now generated -- see
// utils/uploadFilename.ts -- since memoryStorage has no destination/filename
// callback the way diskStorage did).
const storage = multer.memoryStorage();

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

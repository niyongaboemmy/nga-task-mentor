import multer from "multer";
import { Request, Response, NextFunction } from "express";
import {
  BLOCKED_SUBMISSION_EXTENSIONS,
  SUBMISSION_FILE_MAX_MB,
  extensionOf,
} from "../utils/submissionFiles";

// In-memory buffer, uploaded to the shared file-server by the controller
// (utils/submissionFiles.ts storeSubmissionFile). memoryStorage files have a
// `buffer` but no `path` -- reading req.file.path is what silently dropped
// every new submission's file after the move to the file-server.
const storage = multer.memoryStorage();

// Only executables are refused here. Which types an assignment accepts is the
// teacher's call (allowed_file_types), checked by the controller once the
// assignment is loaded -- see submissionFileError.
export const uploadSubmission = multer({
  storage: storage,
  limits: {
    fileSize: SUBMISSION_FILE_MAX_MB * 1024 * 1024,
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const ext = extensionOf(file.originalname);
    if (BLOCKED_SUBMISSION_EXTENSIONS.includes(ext)) {
      return cb(
        Object.assign(new Error(`"${file.originalname}" can't be submitted: .${ext} files are not accepted.`), {
          statusCode: 400,
        }),
      );
    }
    cb(null, true);
  },
});

/**
 * uploadSubmission.single("file_submission") with its errors turned into a
 * 400/413 the submission form can show, instead of the global handler's 500.
 */
export const submissionFile = (req: Request, res: Response, next: NextFunction) =>
  uploadSubmission.single("file_submission")(req, res, (err: any) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      const tooBig = err.code === "LIMIT_FILE_SIZE";
      return res.status(tooBig ? 413 : 400).json({
        success: false,
        message: tooBig
          ? `The file is too large. A submission file can be at most ${SUBMISSION_FILE_MAX_MB} MB.`
          : err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE"
            ? "Attach one file per submission (put several files in a ZIP)."
            : err.message,
      });
    }
    return res.status(err.statusCode || 400).json({ success: false, message: err.message });
  });

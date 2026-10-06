import { Router } from "express";
import multer from "multer";
import { protect, authorizePermission } from "../middleware/auth";
import { validateBody } from "../middleware/validation.middleware";
import { importEditorImageSchema } from "../validations/assignmentAi.validation";
import { importEditorImage, uploadEditorImage } from "../controllers/media.controller";
import { EDITOR_IMAGE_MAX_BYTES } from "../services/editorImages";

const router = Router();
router.use(protect);

// Anyone who writes rich content (assignments, quizzes, question bank) can put
// images in it. The file type is checked from the bytes in storeEditorImage.
const CAN_AUTHOR = [
  "ASSIGNMENTS_CREATE",
  "ASSIGNMENTS_EDIT",
  "QUIZZES_CREATE",
  "QUIZZES_EDIT",
  "QUESTION_BANK_CREATE",
];

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: EDITOR_IMAGE_MAX_BYTES, files: 1 },
});

router.post(
  "/editor-images",
  authorizePermission(...CAN_AUTHOR),
  (req, res, next) =>
    imageUpload.single("image")(req, res, (err: any) => {
      if (!err) return next();
      const tooBig = err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE";
      return res.status(tooBig ? 413 : 400).json({
        success: false,
        message: tooBig ? "Image is too large. The maximum is 10 MB." : err.message || "Upload failed",
      });
    }),
  uploadEditorImage,
);

router.post(
  "/editor-images/import",
  authorizePermission(...CAN_AUTHOR),
  validateBody(importEditorImageSchema),
  importEditorImage,
);

export default router;

import { Router } from "express";
import {
  saveBuilder,
  saveAttributes,
  getStudentReportCard,
  generatePdf,
} from "../controllers/reportCard.controller";
import { protect, authorize } from "../middleware/auth";
import { validate } from "../middleware/validation.middleware";
import {
  builderSaveSchema,
  attributesSaveSchema,
  generatePdfSchema,
} from "../validations/reportCard.validation";

const router = Router();

router.use(protect);

router.post(
  "/builder/save",
  authorize("instructor", "admin"),
  validate(builderSaveSchema),
  saveBuilder,
);

router.post(
  "/attributes/save",
  authorize("instructor", "admin"),
  validate(attributesSaveSchema),
  saveAttributes,
);

router.get(
  "/student/:studentId",
  authorize("instructor", "admin", "student"),
  getStudentReportCard,
);

router.post(
  "/generate-pdf",
  authorize("instructor", "admin"),
  validate(generatePdfSchema),
  generatePdf,
);

export default router;

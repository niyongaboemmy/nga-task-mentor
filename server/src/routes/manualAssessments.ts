import { Router } from "express";
import {
  createManualAssessment,
  listManualAssessments,
  updateManualAssessment,
  deleteManualAssessment,
  getScores,
  upsertScores,
} from "../controllers/manualAssessment.controller";
import { protect, authorizePermission } from "../middleware/auth";
import { validate } from "../middleware/validation.middleware";
import {
  createManualAssessmentSchema,
  updateManualAssessmentSchema,
  upsertScoresSchema,
} from "../validations/manualAssessment.validation";

const router = Router();

router.use(protect);

router.post(
  "/",
  authorizePermission("MANUAL_ASSESSMENTS_CREATE"),
  validate(createManualAssessmentSchema),
  createManualAssessment,
);

router.get(
  "/",
  authorizePermission("MANUAL_ASSESSMENTS_VIEW"),
  listManualAssessments,
);

router.patch(
  "/:id",
  authorizePermission("MANUAL_ASSESSMENTS_EDIT"),
  validate(updateManualAssessmentSchema),
  updateManualAssessment,
);

router.delete(
  "/:id",
  authorizePermission("MANUAL_ASSESSMENTS_DELETE"),
  deleteManualAssessment,
);

router.get(
  "/:id/scores",
  authorizePermission("MANUAL_ASSESSMENTS_VIEW"),
  getScores,
);

router.post(
  "/:id/scores",
  authorizePermission("MANUAL_ASSESSMENTS_EDIT"),
  validate(upsertScoresSchema),
  upsertScores,
);

export default router;

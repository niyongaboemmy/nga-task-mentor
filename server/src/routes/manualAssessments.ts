import { Router } from "express";
import {
  createManualAssessment,
  listManualAssessments,
  updateManualAssessment,
  deleteManualAssessment,
  getScores,
  upsertScores,
} from "../controllers/manualAssessment.controller";
import { protect, authorize } from "../middleware/auth";
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
  authorize("instructor", "admin"),
  validate(createManualAssessmentSchema),
  createManualAssessment,
);

router.get(
  "/",
  authorize("instructor", "admin"),
  listManualAssessments,
);

router.patch(
  "/:id",
  authorize("instructor", "admin"),
  validate(updateManualAssessmentSchema),
  updateManualAssessment,
);

router.delete(
  "/:id",
  authorize("instructor", "admin"),
  deleteManualAssessment,
);

router.get(
  "/:id/scores",
  authorize("instructor", "admin"),
  getScores,
);

router.post(
  "/:id/scores",
  authorize("instructor", "admin"),
  validate(upsertScoresSchema),
  upsertScores,
);

export default router;

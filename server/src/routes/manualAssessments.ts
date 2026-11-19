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
import { intOrNull, trackOnSuccess } from "../activity/keyEvents";
import { validate } from "../middleware/validation.middleware";
import {
  createManualAssessmentSchema,
  updateManualAssessmentSchema,
  upsertScoresSchema,
} from "../validations/manualAssessment.validation";
import { guard, byParam, withStudents } from "../services/approvalLock";

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
  guard("assessment", byParam("manual", "id")), updateManualAssessment,
);

router.delete(
  "/:id",
  authorizePermission("MANUAL_ASSESSMENTS_DELETE"),
  guard("assessment", byParam("manual", "id")), deleteManualAssessment,
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
  trackOnSuccess("tm.grade.save", (req) => ({
    kind: "manual",
    assessment_id: intOrNull(req.params.id),
    count: Array.isArray(req.body?.scores) ? req.body.scores.length : null,
  })),
  guard("mark", withStudents("manual", "id", (req) => ({ mis: (Array.isArray(req.body?.scores) ? req.body.scores : []).map((s: { student_id?: unknown }) => Number(s?.student_id)) }))), upsertScores,
);

export default router;

import { Router } from "express";
import { protect, authorizePermission } from "../middleware/auth";
import { validateBody } from "../middleware/validation.middleware";
import {
  listCycles,
  getWorkbench,
  putCycleSettings,
  previewSignoff,
  signoffSubject,
  importAttendance,
} from "../controllers/reportCardWorkflow.controller";
import {
  cycleSettingsSchema,
  signoffSchema,
  attendanceImportSchema,
} from "../validations/reportCardWorkflow.validation";

/**
 * Report cycles: one class group x term, the unit report cards are managed
 * in (the workbench). See controllers/reportCardWorkflow.controller.ts.
 */
const router = Router();
router.use(protect);

const MANAGERS = ["REPORT_CARDS_VIEW_ALL", "REPORT_CARDS_REVIEW", "REPORT_CARDS_APPROVE", "REPORT_CARDS_COMMENT", "REPORT_CARDS_EDIT"];

router.get("/", authorizePermission(...MANAGERS), listCycles);
router.get("/workbench", authorizePermission(...MANAGERS), getWorkbench);
router.put(
  "/settings",
  authorizePermission("REPORT_CARDS_APPROVE", "REPORT_CARDS_REVIEW"),
  validateBody(cycleSettingsSchema),
  putCycleSettings,
);

// A subject teacher's "my marks for this class are final" (and the reverse).
router.get("/signoff/preview", authorizePermission("REPORT_CARDS_EDIT", "REPORT_CARDS_CREATE"), previewSignoff);
router.post(
  "/signoff",
  authorizePermission("REPORT_CARDS_EDIT", "REPORT_CARDS_CREATE", "REPORT_CARDS_REVIEW", "REPORT_CARDS_APPROVE"),
  validateBody(signoffSchema),
  signoffSubject,
);

router.post(
  "/attendance/import",
  authorizePermission("REPORT_CARDS_COMMENT", "REPORT_CARDS_EDIT", "REPORT_CARDS_REVIEW"),
  validateBody(attendanceImportSchema),
  importAttendance,
);

export default router;

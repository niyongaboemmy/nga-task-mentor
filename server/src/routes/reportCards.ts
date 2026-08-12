import { Router } from "express";
import {
  saveBuilder,
  saveAttributes,
  getStudentReportCard,
  getCourseOverview,
  updateStatus,
  generatePdf,
  listReportCardStudents,
  getAdminSummary,
} from "../controllers/reportCard.controller";
import { protect, authorizePermission } from "../middleware/auth";
import { validate } from "../middleware/validation.middleware";
import {
  builderSaveSchema,
  attributesSaveSchema,
  generatePdfSchema,
  updateStatusSchema,
} from "../validations/reportCard.validation";

const router = Router();

router.use(protect);

// ── Build ──────────────────────────────────────────────────────────────────────
// Any instructor or admin can call this for their course (subject).
// The controller does a partial replace scoped to the subject_ids in the payload.
router.post(
  "/builder/save",
  authorizePermission("REPORT_CARDS_CREATE", "REPORT_CARDS_EDIT"),
  validate(builderSaveSchema),
  saveBuilder,
);

// ── Attributes (class teacher / admin) ────────────────────────────────────────
router.post(
  "/attributes/save",
  authorizePermission("REPORT_CARDS_EDIT"),
  validate(attributesSaveSchema),
  saveAttributes,
);

// ── Course overview ────────────────────────────────────────────────────────────
// Returns report-card status rows for a batch of student IDs.
// The frontend provides student_ids (comma-separated) it already holds from
// the enrollment list, so this endpoint stays free of NGA MIS dependencies.
router.get(
  "/overview",
  authorizePermission("REPORT_CARDS_VIEW_ALL"),
  getCourseOverview,
);

// ── Admin cross-course reporting ────────────────────────────────────────────────
// Lists every report card for a term/year (used by the bulk export "by
// term/year" mode and admin student search) and an aggregate summary
// (status counts, per-category and per-subject averages) for that period.
router.get(
  "/admin/students",
  authorizePermission("REPORT_CARDS_VIEW_ALL"),
  listReportCardStudents,
);
router.get(
  "/admin/summary",
  authorizePermission("REPORT_CARDS_VIEW_ALL"),
  getAdminSummary,
);

// ── Status lifecycle ───────────────────────────────────────────────────────────
// PATCH /api/report-cards/:id/status
// Editors: draft <-> saved
// Approvers: any -> any (including approved) — enforced in the controller
router.patch(
  "/:id/status",
  authorizePermission("REPORT_CARDS_EDIT", "REPORT_CARDS_APPROVE"),
  validate(updateStatusSchema),
  updateStatus,
);

// ── Read ───────────────────────────────────────────────────────────────────────
// Callers without REPORT_CARDS_VIEW_ALL receive only approved cards (controller-scoped).
router.get(
  "/student/:studentId",
  authorizePermission("REPORT_CARDS_VIEW_OWN", "REPORT_CARDS_VIEW_ALL"),
  getStudentReportCard,
);

// ── PDF generation ─────────────────────────────────────────────────────────────
// Callers without REPORT_CARDS_VIEW_ALL can only generate PDFs for approved cards
// (enforced in controller).
router.post(
  "/generate-pdf",
  authorizePermission("REPORT_CARDS_EXPORT_PDF"),
  validate(generatePdfSchema),
  generatePdf,
);

export default router;

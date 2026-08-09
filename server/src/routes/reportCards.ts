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
import { protect, authorize } from "../middleware/auth";
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
  authorize("instructor", "admin"),
  validate(builderSaveSchema),
  saveBuilder,
);

// ── Attributes (class teacher / admin) ────────────────────────────────────────
router.post(
  "/attributes/save",
  authorize("instructor", "admin"),
  validate(attributesSaveSchema),
  saveAttributes,
);

// ── Course overview ────────────────────────────────────────────────────────────
// Returns report-card status rows for a batch of student IDs.
// The frontend provides student_ids (comma-separated) it already holds from
// the enrollment list, so this endpoint stays free of NGA MIS dependencies.
router.get(
  "/overview",
  authorize("instructor", "admin"),
  getCourseOverview,
);

// ── Admin cross-course reporting ────────────────────────────────────────────────
// Lists every report card for a term/year (used by the bulk export "by
// term/year" mode and admin student search) and an aggregate summary
// (status counts, per-category and per-subject averages) for that period.
router.get("/admin/students", authorize("admin"), listReportCardStudents);
router.get("/admin/summary", authorize("admin"), getAdminSummary);

// ── Status lifecycle ───────────────────────────────────────────────────────────
// PATCH /api/report-cards/:id/status
// Instructors: draft ↔ saved
// Admins:      any → any (including approved)
router.patch(
  "/:id/status",
  authorize("instructor", "admin"),
  validate(updateStatusSchema),
  updateStatus,
);

// ── Read ───────────────────────────────────────────────────────────────────────
// Students receive only approved cards; instructors/admins receive any status.
router.get(
  "/student/:studentId",
  authorize("instructor", "admin", "student"),
  getStudentReportCard,
);

// ── PDF generation ─────────────────────────────────────────────────────────────
// Students can only generate PDFs for approved cards (enforced in controller).
router.post(
  "/generate-pdf",
  authorize("instructor", "admin", "student"),
  validate(generatePdfSchema),
  generatePdf,
);

export default router;

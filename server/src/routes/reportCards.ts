import { Router } from "express";
import { requireAi } from "../middleware/requireAi";
import {
  saveBuilder,
  getSubjectMapping,
  saveSubjectMapping,
  saveAttributes,
  getStudentReportCard,
  getAnnualReportCard,
  getReportCardPreview,
  getCourseOverview,
  getSubjectOverview,
  updateStatus,
  generatePdf,
  generateAnnualPdf,
  listReportCardStudents,
  getAdminSummary,
  getComponentWeightsHandler,
  putDefaultComponentWeights,
  putSubjectComponentWeights,
} from "../controllers/reportCard.controller";
import { protect, authorizePermission, authorizeCapability } from "../middleware/auth";
import { draftReportComment } from "../controllers/reportCommentAi.controller";
import {
  transitionCards,
  getCardHistory,
  getCardDiff,
  getScheme,
  putScheme,
  getStructure,
  getTemplateModules,
  getTemplateSchool,
  putTemplateSchool,
  putModuleWeight,
  postMapFormative,
} from "../controllers/reportCardWorkflow.controller";
import { transitionSchema } from "../validations/reportCardWorkflow.validation";
import { validate, validateBody } from "../middleware/validation.middleware";
import {
  builderSaveSchema,
  subjectMappingSaveSchema,
  attributesSaveSchema,
  generatePdfSchema,
  updateStatusSchema,
  aiCommentSchema,
} from "../validations/reportCard.validation";

const router = Router();

router.use(protect);

// ── Build (legacy, per-student) ─────────────────────────────────────────────────
// Superseded by the subject-mapping endpoints below for new saves — kept so
// any already-stored per-student mappings remain readable/editable. Any
// instructor or admin can call this for their course (subject); the
// controller does a partial replace scoped to the subject_ids in the payload.
router.post(
  "/builder/save",
  authorizePermission("REPORT_CARDS_CREATE", "REPORT_CARDS_EDIT"),
  validate(builderSaveSchema),
  saveBuilder,
);

// ── Subject-wide mapping ─────────────────────────────────────────────────────────
// The builder now maps a subject's assessments into CW/HW/MD/EOT ONCE; saving
// fans the mapping out to every student currently enrolled in that subject
// (see saveSubjectMapping). No student_id in this payload at all.
router.get(
  "/subject-mapping",
  authorizePermission("REPORT_CARDS_CREATE", "REPORT_CARDS_EDIT", "REPORT_CARDS_VIEW_ALL"),
  getSubjectMapping,
);
router.post(
  "/subject-mapping/save",
  authorizePermission("REPORT_CARDS_CREATE", "REPORT_CARDS_EDIT"),
  validate(subjectMappingSaveSchema),
  saveSubjectMapping,
);

// Kinds of work inside a category (FA = class work 30, homework 20...): the
// school's default (approvers) and each subject's own (who maps that subject).
router.get(
  "/component-weights",
  authorizePermission("REPORT_CARDS_CREATE", "REPORT_CARDS_EDIT", "REPORT_CARDS_VIEW_ALL", "REPORT_CARDS_APPROVE"),
  getComponentWeightsHandler,
);
router.put("/component-weights", authorizePermission("REPORT_CARDS_APPROVE", "USERS_EDIT"), putDefaultComponentWeights);
router.put("/component-weights/subjects/:id(\\d+)", authorizePermission("REPORT_CARDS_CREATE", "REPORT_CARDS_EDIT"), putSubjectComponentWeights);

// ── Attributes (class teacher / admin) ────────────────────────────────────────
// Access control v2 (enforce): the class-teacher comment is its own
// capability, REPORT_CARDS_COMMENT, checked against the student's class
// group in the controller. Legacy (off/shadow): REPORT_CARDS_EDIT as before.
router.post(
  "/attributes/save",
  authorizeCapability({ legacy: ["REPORT_CARDS_EDIT"], v2: ["REPORT_CARDS_COMMENT"] }),
  validate(attributesSaveSchema),
  saveAttributes,
);

// AI draft of the class-teacher comment (nothing stored; same guard as saving it).
router.post(
  "/ai-comment",
  authorizeCapability({ legacy: ["REPORT_CARDS_EDIT"], v2: ["REPORT_CARDS_COMMENT"] }),
  requireAi("author"),
  validate(aiCommentSchema),
  draftReportComment,
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

// ── Subject overview (Grades → Subject dashboard) ─────────────────────────────
// Same student_ids-batch shape as /overview, plus one subject's computed
// grade per student and a class average — the single call the subject
// dashboard needs instead of scanning admin/summary or N calls to /student/:id.
router.get(
  "/subject-overview",
  authorizePermission("REPORT_CARDS_CREATE", "REPORT_CARDS_EDIT", "REPORT_CARDS_VIEW_ALL"),
  getSubjectOverview,
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

// ── Workflow: draft -> reviewed -> approved -> published ───────────────────────
// One action over up to 200 cards; each card is checked on its own (scope,
// state, readiness, reason) and gets its own result. See
// controllers/reportCardWorkflow.controller.ts and services/reportCardWorkflow.ts.
router.post(
  "/transition",
  authorizePermission("REPORT_CARDS_REVIEW", "REPORT_CARDS_APPROVE", "REPORT_CARDS_PUBLISH"),
  validateBody(transitionSchema),
  transitionCards,
);

// The school's report card scheme (weights, pass mark, attributes, subject
// groups, what the card shows). Read by anyone who works on cards.
router.get(
  "/scheme",
  authorizePermission("REPORT_CARDS_VIEW_ALL", "REPORT_CARDS_EDIT", "REPORT_CARDS_COMMENT", "REPORT_CARDS_REVIEW", "REPORT_CARDS_APPROVE"),
  getScheme,
);
router.put("/scheme", authorizePermission("REPORT_CARDS_APPROVE", "USERS_EDIT"), putScheme);
// The builder the school chose (Normal / TVET) and its mapping categories:
// every signed-in user who maps marks (Grades page, report card builder).
router.get("/structure", getStructure);
// Modules with their MIS learning hours, for the TVET module-weight editor.
router.get("/templates/modules", authorizePermission("REPORT_CARDS_APPROVE", "USERS_EDIT"), getTemplateModules);
// A module's weight and the school's identity block live in MIS (per tenant):
// read here, saved through to MIS, which checks its own permission too.
router.put("/templates/modules/:id(\\d+)/weight", authorizePermission("REPORT_CARDS_APPROVE", "USERS_EDIT"), putModuleWeight);
router.get("/templates/school", authorizePermission("REPORT_CARDS_APPROVE", "USERS_EDIT"), getTemplateSchool);
router.put("/templates/school", authorizePermission("REPORT_CARDS_APPROVE", "USERS_EDIT"), putTemplateSchool);
// TVET: map this term's unmapped work to FA (dry_run counts it first).
router.post("/templates/map-formative", authorizePermission("REPORT_CARDS_APPROVE", "USERS_EDIT"), postMapFormative);

router.get("/:id(\\d+)/history", authorizePermission("REPORT_CARDS_VIEW_ALL"), getCardHistory);
router.get("/:id(\\d+)/diff", authorizePermission("REPORT_CARDS_VIEW_ALL"), getCardDiff);

// ── Status lifecycle ───────────────────────────────────────────────────────────
// PATCH /api/report-cards/:id/status (legacy, one release): the target status
// is mapped onto the workflow actions above, so the same rules apply.
router.patch(
  "/:id/status",
  authorizePermission("REPORT_CARDS_REVIEW", "REPORT_CARDS_APPROVE", "REPORT_CARDS_PUBLISH"),
  validate(updateStatusSchema),
  updateStatus,
);

// ── Read ───────────────────────────────────────────────────────────────────────
// Callers without REPORT_CARDS_VIEW_ALL receive only their own published cards.
router.get(
  "/student/:studentId",
  authorizePermission("REPORT_CARDS_VIEW_OWN", "REPORT_CARDS_VIEW_ALL"),
  getStudentReportCard,
);

// ── Provisional preview (staff) ───────────────────────────────────────────────
// What the card would show today, before it exists or every mark is in.
// Computed on demand, never stored; the controller also requires view-all
// access over the student.
router.get(
  "/preview/:studentId",
  authorizePermission("REPORT_CARDS_VIEW_ALL"),
  getReportCardPreview,
);

// ── Annual (combined-terms) summary ───────────────────────────────────────────
// Read-only, computed on demand from the term cards that already exist —
// there is no "annual" ReportCard row to build/edit directly.
router.get(
  "/annual/:studentId",
  authorizePermission("REPORT_CARDS_VIEW_OWN", "REPORT_CARDS_VIEW_ALL"),
  getAnnualReportCard,
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
router.post(
  "/annual/generate-pdf",
  authorizePermission("REPORT_CARDS_EXPORT_PDF"),
  generateAnnualPdf,
);

export default router;

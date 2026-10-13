import { Router, Request, Response } from "express";
import { misBearerAuth } from "../middleware/misBearerAuth";
import { integrationLimiter, lessonCodeRunLimiter } from "../middleware/rateLimiter.middleware";
import { practiceRun } from "../controllers/codeRun.controller";
import { getCodeRunner } from "../services/coderunner";
import { Judge0Service } from "../services/Judge0Service";
import { catalogLanguages } from "../services/runtimeCatalog";
import { buildHomeSummary, emptySummary } from "../integration/homeSummary";
import { computeOverview } from "../controllers/instructorOverview.controller";
import { PASS_MARK } from "../services/instructorOverview.service";

/**
 * /api/integration/* -- server-to-server reads for the NGA Central MIS,
 * authenticated with the user's own MIS token (misBearerAuth), never a Task
 * Mentor session. Read-only.
 *
 * POST /api/integration/home-summary (GET with no body works too): what needs
 * the user in Task Mentor, for the MIS Home page. Body (all optional):
 * { date, tz, lenses: [{ key, type, class_group_ids }] } -- lenses only label
 * items; access comes from this app's own scoping helpers. `date`/`tz` are
 * accepted for the shared contract; Task Mentor's signals are relative to now.
 */
const router = Router();

const homeSummary = async (req: Request, res: Response) => {
  try {
    if (!(req as any).misProvisioned || !req.user) {
      // The MIS user has never signed in to Task Mentor: nothing of theirs here.
      return res.status(200).json(emptySummary(false));
    }
    if ((req as any).accessUnavailable) {
      return res.status(503).json({
        success: false,
        code: "ACCESS_UNAVAILABLE",
        message: "Access check unavailable -- please try again shortly",
      });
    }
    const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
    const lenses = body.lenses;
    // Only the contract's fields are read. The shared scoping helpers honour
    // academic_term_id / academicTermId (and year) overrides from the body and
    // query (resolveAcademicTermId), which would let the caller pick another
    // term's subjects -- so neither reaches them: always the current period.
    req.body = {};
    req.query = {};
    res.status(200).json(await buildHomeSummary(req, { lenses }));
  } catch (error) {
    console.error("Home summary error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * GET /api/integration/student-standing: how each student the caller teaches
 * is doing in Task Mentor (average, graded work, missing work, reasons), for
 * the MIS office-hours "Suggested students" list. Same scope and numbers as
 * the teacher dashboard (computeOverview); keyed by MIS user id so the MIS
 * needs no subject-id mapping. Read-only; the term is always the current one.
 */
const studentStanding = async (req: Request, res: Response) => {
  try {
    if (!(req as any).misProvisioned || !req.user) {
      return res.status(200).json({ success: true, data: { provisioned: false, pass_mark: PASS_MARK, students: [] } });
    }
    if ((req as any).accessUnavailable) {
      return res.status(503).json({ success: false, code: "ACCESS_UNAVAILABLE", message: "Access check unavailable -- please try again shortly" });
    }
    req.body = {};
    req.query = {};
    const { overview } = await computeOverview(req, { includeAllStudents: true });
    const all = overview.students.all ?? [...overview.students.at_risk, ...overview.students.top];
    const seen = new Set<number>();
    const students = all
      .filter((s) => s.mis_user_id != null && !seen.has(s.mis_user_id) && seen.add(s.mis_user_id))
      .map((s) => ({
        mis_user_id: s.mis_user_id as number,
        avg_score: s.avg_score,
        graded_count: s.graded_count,
        missing: s.missing,
        subjects: s.subjects,
        reasons: s.reasons,
        below_pass: s.avg_score != null && s.avg_score < PASS_MARK,
      }));
    res.status(200).json({ success: true, data: { provisioned: true, pass_mark: PASS_MARK, students } });
  } catch (error) {
    console.error("Student standing error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * GET /api/integration/code/languages: the languages the code runner runs now,
 * for the MIS lesson Code Playground's language picker.
 *
 * POST /api/integration/code/run: one practice run for that playground -- the
 * same request, checks and answer as POST /api/code/run (practiceRun). Nothing
 * is graded or stored. Any verified MIS user may run code read in a lesson,
 * signed in to Task Mentor or not (students read notes in the MIS), so the
 * limit is per MIS user, not per local user.
 */
const codeLanguages = (_req: Request, res: Response) => {
  const runner = getCodeRunner();
  const labels = new Map<string, string>(Judge0Service.supportedLanguages().map((l) => [l.key, l.label]));
  for (const l of catalogLanguages()) labels.set(l.key, l.label);
  res.status(200).json({
    success: true,
    data: { languages: runner.languages().map((key) => ({ key, label: labels.get(key) ?? key, engine: runner.engineFor(key) })) },
  });
};

router.get("/code/languages", misBearerAuth, integrationLimiter, codeLanguages);
router.post("/code/run", misBearerAuth, lessonCodeRunLimiter, practiceRun);

router.post("/home-summary", misBearerAuth, integrationLimiter, homeSummary);
router.get("/student-standing", misBearerAuth, integrationLimiter, studentStanding);
router.get("/home-summary", misBearerAuth, integrationLimiter, homeSummary);

export default router;

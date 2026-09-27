import { Router, Request, Response } from "express";
import { misBearerAuth } from "../middleware/misBearerAuth";
import { integrationLimiter } from "../middleware/rateLimiter.middleware";
import { buildHomeSummary, emptySummary } from "../integration/homeSummary";

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

router.post("/home-summary", misBearerAuth, integrationLimiter, homeSummary);
router.get("/home-summary", misBearerAuth, integrationLimiter, homeSummary);

export default router;

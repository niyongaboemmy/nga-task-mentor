import { Router } from "express";
import { protect, authorizePermission } from "../middleware/auth";
import { codeRunLimiter } from "../middleware/rateLimiter.middleware";
import { codeCapabilities, codeSessionEvents, codeSessionInput, startCodeSession, stopCodeSession } from "../controllers/codeSession.controller";
import { codePreviewEvents, codePreviewUrl, startCodePreview, stopCodePreview } from "../controllers/codePreview.controller";
import { codeCatalog, codeStarter, codeStarters, practiceRun, practiceUnitTests, runnableLanguages } from "../controllers/codeRun.controller";

/** /api/code — practice runs and the runner's languages (CODE_RUNNER_PLAN.md §17). */
const router = Router();

router.use(protect);
router.get("/languages", runnableLanguages);
router.get("/catalog", codeCatalog);
router.get("/starters", codeStarters);
router.get("/starters/:id", codeStarter);
router.post("/run", authorizePermission("PROJECTS_USE"), codeRunLimiter, practiceRun);
router.post("/test", authorizePermission("PROJECTS_USE"), codeRunLimiter, practiceUnitTests);

// Interactive runs: start (rate-limited like runs), stream the output, send input, stop.
router.get("/capabilities", codeCapabilities);
router.post("/sessions", authorizePermission("PROJECTS_USE"), codeRunLimiter, startCodeSession);
router.get("/sessions/:id/events", authorizePermission("PROJECTS_USE"), codeSessionEvents);
router.post("/sessions/:id/input", authorizePermission("PROJECTS_USE"), codeSessionInput);
router.delete("/sessions/:id", authorizePermission("PROJECTS_USE"), stopCodeSession);

// Web servers shown in a sandboxed frame on the separate preview origin.
router.post("/previews", authorizePermission("PROJECTS_USE"), codeRunLimiter, startCodePreview);
router.get("/previews/:id/events", authorizePermission("PROJECTS_USE"), codePreviewEvents);
router.get("/previews/:id/url", authorizePermission("PROJECTS_USE"), codePreviewUrl);
router.delete("/previews/:id", authorizePermission("PROJECTS_USE"), stopCodePreview);

export default router;

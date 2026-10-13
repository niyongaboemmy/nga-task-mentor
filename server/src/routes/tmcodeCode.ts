import { Router } from "express";
import { authorizePermission } from "../middleware/auth";
import { codeRunLimiter } from "../middleware/rateLimiter.middleware";
import { tmcodeUserAuth } from "../middleware/tmcodeUserAuth";
import { codeCapabilities, codeSessionEvents, codeSessionInput, startCodeSession, stopCodeSession } from "../controllers/codeSession.controller";
import { practiceRun, practiceUnitTests } from "../controllers/codeRun.controller";

/**
 * /api/tmcode/code — the code runner for the TMCode desktop app: the same
 * endpoints and controllers as /api/code, but signed in with a TMCode user
 * token (aud "tmcode-user") or a web JWT, via tmcodeUserAuth. No previews,
 * catalog or starters (TMCode has its own). Auth failures use the TMCode
 * `{error_code, message}` shape; everything past auth answers exactly like
 * /api/code (`{success, code, message}`).
 */
const router = Router();

router.use(tmcodeUserAuth);
router.get("/capabilities", codeCapabilities);
router.post("/run", authorizePermission("PROJECTS_USE"), codeRunLimiter, practiceRun);
router.post("/test", authorizePermission("PROJECTS_USE"), codeRunLimiter, practiceUnitTests);
router.post("/sessions", authorizePermission("PROJECTS_USE"), codeRunLimiter, startCodeSession);
router.get("/sessions/:id/events", authorizePermission("PROJECTS_USE"), codeSessionEvents);
router.post("/sessions/:id/input", authorizePermission("PROJECTS_USE"), codeSessionInput);
router.delete("/sessions/:id", authorizePermission("PROJECTS_USE"), stopCodeSession);

export default router;

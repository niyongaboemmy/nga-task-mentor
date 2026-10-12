import { Router } from "express";
import { protect, authorizePermission } from "../middleware/auth";
import { codeRunLimiter } from "../middleware/rateLimiter.middleware";
import { codeCatalog, codeStarter, codeStarters, practiceRun, runnableLanguages } from "../controllers/codeRun.controller";

/** /api/code — practice runs and the runner's languages (CODE_RUNNER_PLAN.md §17). */
const router = Router();

router.use(protect);
router.get("/languages", runnableLanguages);
router.get("/catalog", codeCatalog);
router.get("/starters", codeStarters);
router.get("/starters/:id", codeStarter);
router.post("/run", authorizePermission("PROJECTS_USE"), codeRunLimiter, practiceRun);

export default router;

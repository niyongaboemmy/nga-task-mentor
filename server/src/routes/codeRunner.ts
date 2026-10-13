import { Router } from "express";
import { protect, authorizePermission } from "../middleware/auth";
import { codeRunnerStatus } from "../controllers/codeRunner.controller";

const router = Router();

router.use(protect);
router.get("/status", authorizePermission("CODE_RUNNER_ADMIN"), codeRunnerStatus);

export default router;

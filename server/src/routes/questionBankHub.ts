import { Router } from "express";
import { getQuestionBankOverview } from "../controllers/questionBankHub.controller";
import { protect, authorizePermission } from "../middleware/auth";

// Question Bank hub: cross-subject endpoints for the caller's own subjects.
// Per-subject CRUD stays on /api/courses/:courseId/question-bank.
const router = Router();

router.use(protect);

router.get("/overview", authorizePermission("QUESTION_BANK_HUB_VIEW"), getQuestionBankOverview);

export default router;

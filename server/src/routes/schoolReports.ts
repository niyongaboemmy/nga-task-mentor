import { Router } from "express";
import { protect, authorizePermission } from "../middleware/auth";
import { getSchoolReports } from "../controllers/reportAnalytics.controller";

/** School reports hub (broadsheet, performance, gender, trends, at-risk). */
const router = Router();
router.use(protect);
router.get("/school", authorizePermission("REPORT_CARDS_VIEW_ALL"), getSchoolReports);
export default router;

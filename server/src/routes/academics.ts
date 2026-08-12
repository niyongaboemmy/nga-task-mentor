import { Router } from "express";
import { getAcademicYears, getAcademicTerms } from "../controllers/academics.controller";
import { protect, authorizePermission } from "../middleware/auth";
import { requireMisToken } from "../middleware/misAuth";

const router = Router();

router.use(protect);
router.use(requireMisToken);

router.get("/years", authorizePermission("ACADEMICS_VIEW"), getAcademicYears);
router.get("/terms", authorizePermission("ACADEMICS_VIEW"), getAcademicTerms);

export default router;

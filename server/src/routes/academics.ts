import { Router } from "express";
import { getAcademicYears, getAcademicTerms } from "../controllers/academics.controller";
import { protect } from "../middleware/auth";
import { requireMisToken } from "../middleware/misAuth";

const router = Router();

router.use(protect);
router.use(requireMisToken);

router.get("/years", getAcademicYears);
router.get("/terms", getAcademicTerms);

export default router;

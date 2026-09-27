import { Router } from "express";
import { getRanking } from "../controllers/ranking.controller";
import { protect, authorizePermission } from "../middleware/auth";

// Overall ranking. Every role that can see courses may call it; what comes
// back (own position only vs a named leaderboard) is decided in the
// controller from the caller's subject scope.
const router = Router();

router.use(protect);

router.get("/", authorizePermission("COURSES_VIEW"), getRanking);

export default router;

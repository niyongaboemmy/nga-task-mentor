import { Router } from "express";
import { getRanking } from "../controllers/ranking.controller";
import { protect, authorizePermission } from "../middleware/auth";

// Overall ranking. The caller's subject scope decides which view comes back
// (own position vs a named leaderboard), and the controller then requires the
// matching permission: RANKINGS_VIEW_OWN for a student's own position,
// RANKINGS_VIEW_ALL for the staff leaderboard.
const router = Router();

router.use(protect);

router.get(
  "/",
  authorizePermission("COURSES_VIEW"),
  authorizePermission("RANKINGS_VIEW_OWN", "RANKINGS_VIEW_ALL"),
  getRanking,
);

export default router;

import { NextFunction, Request, Response, Router } from "express";
import { protect, authorizePermission } from "../middleware/auth";
import * as c from "../controllers/adminAi.controller";

/** /api/admin/ai — Admin → AI: premium & own keys (AI_SETTINGS_MANAGE). */
const router = Router();

const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch((e) => {
      console.error("[admin-ai]", req.method, req.path, e?.message ?? e);
      if (res.headersSent) return next(e);
      res.status(500).json({ success: false, message: "Something went wrong on Task Mentor." });
    });

router.use(protect, authorizePermission("AI_SETTINGS_MANAGE"));
router.get("/settings", wrap(c.getAiSettings));
router.put("/settings", wrap(c.putAiSettings));
router.get("/entitlements", wrap(c.listEntitlements));
router.put("/entitlements/:userId(\\d+)", wrap(c.putEntitlement));
router.delete("/entitlements/:userId(\\d+)", wrap(c.deleteEntitlement));
router.get("/users", wrap(c.searchUsers));

export default router;

import { Router, Request, Response } from "express";
import { protect } from "../middleware/auth";
import { accessMode } from "../access/mode";
import { requestSnapshot } from "../access/policy";

/**
 * GET /api/access/me -- the caller's access-control v2 snapshot for this app
 * (MIS GET /access/me?app=tm, cached), for UI gating. `snapshot` is null when
 * MIS has none for us (not installed, unreachable > 24 h, no MIS identity).
 * Read-only; never changes what the legacy permission checks decide.
 */
const router = Router();

router.get("/me", protect, async (req: Request, res: Response) => {
  const snapshot = await requestSnapshot(req);
  res.status(200).json({
    success: true,
    data: { mode: accessMode(), available: snapshot !== null, snapshot },
  });
});

export default router;

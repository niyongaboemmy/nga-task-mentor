import { Request, Response, Router } from "express";
import { authorizePermission, protect } from "../middleware/auth";
import { getBranding, getGradingBands, setGradingBands } from "../services/tenantSettings";

/**
 * Per-school settings (TM-12), read by the client:
 *  GET /api/settings/grading   -> { bands }  (report-card letter scale)
 *  PUT /api/settings/grading   { bands }     (school admins)
 *  GET /api/settings/branding  -> { name, address_line }
 */
const router = Router();
router.use(protect);

router.get("/grading", async (_req: Request, res: Response) => {
  res.status(200).json({ success: true, bands: await getGradingBands() });
});

router.put("/grading", authorizePermission("USERS_EDIT", "REPORT_CARDS_APPROVE"), async (req: Request, res: Response) => {
  try {
    const bands = await setGradingBands(req.body?.bands, req.user?.id ?? null);
    res.status(200).json({ success: true, bands });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err?.message ?? "Invalid grade bands" });
  }
});

router.get("/branding", async (_req: Request, res: Response) => {
  res.status(200).json({ success: true, branding: await getBranding() });
});

export default router;

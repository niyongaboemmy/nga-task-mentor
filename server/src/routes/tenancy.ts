import crypto from "crypto";
import { NextFunction, Request, Response, Router } from "express";
import { normalizeTenant, parseTid } from "../vendor/nga-tenancy";
import { provisionTenant } from "../tenancy/provision";
import { getTenantRegistry } from "../tenancy/registry";

/**
 * MIS -> Task Mentor control-plane calls (CONTRACT.md §4-5), mounted at
 * /api/integration/tenants:
 *
 *  POST /:tid/provision   body TenantCtx -> { ok, tid, created }
 *  POST /changed          body { tid }   -> registry.invalidate()
 *
 * Auth: `Authorization: Bearer ${TENANCY_PROVISION_SECRET}` (constant-time
 * compare); 503 when the secret is not configured.
 */

export function requireProvisionSecret(req: Request, res: Response, next: NextFunction) {
  const secret = process.env.TENANCY_PROVISION_SECRET;
  if (!secret) {
    return res.status(503).json({ success: false, code: "PROVISIONING_DISABLED", message: "TENANCY_PROVISION_SECRET is not set" });
  }
  const header = req.headers.authorization || "";
  const given = /^Bearer\s+/i.test(header) ? header.replace(/^Bearer\s+/i, "").trim() : "";
  const a = crypto.createHash("sha256").update(given).digest();
  const b = crypto.createHash("sha256").update(secret).digest();
  if (!given || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ success: false, code: "UNAUTHORIZED", message: "Invalid provisioning credentials" });
  }
  next();
}

const router = Router();

router.post("/:tid/provision", requireProvisionSecret, async (req: Request, res: Response) => {
  const tid = parseTid(req.params.tid);
  if (!tid) return res.status(400).json({ success: false, code: "BAD_TENANT", message: "Invalid tenant id" });
  const body = (req.body ?? {}) as Record<string, unknown>;
  const fromBody = normalizeTenant({ ...body, tid: body.tid ?? body.tenant_id ?? tid });
  if (!fromBody || fromBody.tid !== tid) {
    return res.status(400).json({ success: false, code: "TENANT_MISMATCH", message: "Body tid differs from the path" });
  }
  try {
    const result = await provisionTenant(fromBody);
    getTenantRegistry().invalidate();
    return res.status(200).json(result);
  } catch (err: any) {
    console.error(`[tenancy] provisioning tenant ${tid} failed:`, err?.message ?? err);
    return res.status(500).json({ success: false, code: "PROVISION_FAILED", message: err?.message ?? "Provisioning failed" });
  }
});

router.post("/changed", requireProvisionSecret, (_req: Request, res: Response) => {
  getTenantRegistry().invalidate();
  res.status(200).json({ ok: true });
});

export default router;

import { Request, Response } from "express";
import { LogoutTokenError, verifyLogoutTokenSubject } from "../utils/ssoLogout";
import { primaryTenantCtx, PRIMARY_TENANT_ID, runWithTenant } from "../vendor/nga-tenancy";
import { getTenantRegistry } from "../tenancy/registry";
import { revokeSessionsForMisUser } from "../services/sessionRevocation";
import { recheckMisStatus } from "../services/misStatusSweep";

/**
 * POST /api/auth/backchannel-logout -- OpenID Connect Back-Channel Logout.
 * Called by NGA MIS (server to server) when a user signs out there; we end
 * that user's Task Mentor sessions too (nga_central_mis/docs/SINGLE_SIGN_OUT.md).
 */
export const backchannelLogout = async (req: Request, res: Response) => {
  res.set("Cache-Control", "no-store");
  try {
    const { sub: misUserId, tid } = await verifyLogoutTokenSubject((req.body || {}).logout_token, {
      misBaseUrl: process.env.NGA_MIS_BASE_URL || "https://api.amashuri.com",
      clientId: process.env.SSO_CLIENT_ID || "taskmentor_app",
    });
    // Revoke on (tid, sub): MIS user ids repeat across schools. A token minted
    // before tenancy names tenant 1. Any status still revokes (a suspended
    // school's sessions must end too); an unknown tenant has nothing to end.
    const tenantId = tid ?? PRIMARY_TENANT_ID;
    const tenant =
      (await getTenantRegistry().get(tenantId)) ?? (tenantId === PRIMARY_TENANT_ID ? primaryTenantCtx() : null);
    if (!tenant) return res.status(200).json({ success: true });
    const ended = await runWithTenant(tenant, () => revokeSessionsForMisUser(misUserId));
    console.log(`🔒 Single sign-out: ended sessions of MIS user ${misUserId} (${ended.length} local account(s))`);
    // MIS also sends this when an account is disabled: re-read its status
    // in the background (ACTIVE_USERS_CONTRACTS.md) so rosters drop it now
    // rather than at the next daily sweep. Never delays MIS's call.
    if (ended.length) void runWithTenant(tenant, () => recheckMisStatus(misUserId));
    return res.status(200).json({ success: true });
  } catch (error: any) {
    if (error instanceof LogoutTokenError) {
      return res.status(400).json({ error: "invalid_request", error_description: error.message });
    }
    console.error("Back-channel logout failed:", error?.message || error);
    return res.status(500).json({ error: "server_error" });
  }
};

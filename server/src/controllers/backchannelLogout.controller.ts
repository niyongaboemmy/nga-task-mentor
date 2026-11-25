import { Request, Response } from "express";
import { LogoutTokenError, verifyLogoutTokenSubject } from "../utils/ssoLogout";
import { primaryTenantCtx, PRIMARY_TENANT_ID, runWithTenant } from "../vendor/nga-tenancy";
import { getTenantRegistry } from "../tenancy/registry";
import { revokeSessionsForMisSid, revokeSessionsForMisUser } from "../services/sessionRevocation";
import { countFallback } from "../tenancy/fallbacks";
import { recheckMisStatus } from "../services/misStatusSweep";

/**
 * POST /api/auth/backchannel-logout -- OpenID Connect Back-Channel Logout.
 * Called by NGA MIS (server to server) when a user signs out there; we end
 * that user's Task Mentor sessions too (nga_central_mis/docs/SINGLE_SIGN_OUT.md).
 */
export const backchannelLogout = async (req: Request, res: Response) => {
  res.set("Cache-Control", "no-store");
  try {
    const { sub: misUserId, tid, sid } = await verifyLogoutTokenSubject((req.body || {}).logout_token, {
      misBaseUrl: process.env.NGA_MIS_BASE_URL || "https://api.amashuri.com",
      clientId: process.env.SSO_CLIENT_ID || "taskmentor_app",
    });
    // Revoke on (tid, sub): MIS user ids repeat across schools, so a token
    // without `tid` can't say whose sessions to end. MIS always sends one now
    // (TM-ISO-3/8): refuse it -- revoking school 1's user with that MIS id
    // could sign out the wrong person -- and count it for the strict-mode clock.
    if (tid === null) {
      countFallback("payload_no_tid", "backchannelLogout");
      return res.status(400).json({ error: "invalid_request", error_description: "logout_token has no tid" });
    }
    // Any status still revokes (a suspended school's sessions must end too);
    // an unknown tenant has nothing to end.
    const tenant =
      (await getTenantRegistry().get(tid)) ?? (tid === PRIMARY_TENANT_ID ? primaryTenantCtx() : null);
    if (!tenant) return res.status(200).json({ success: true });
    // With `sid` (plan Appendix A.3, e.g. a school switch) only the sessions
    // built from that MIS browser session end; other devices stay signed in.
    const ended = await runWithTenant(tenant, () =>
      sid ? revokeSessionsForMisSid(misUserId, sid) : revokeSessionsForMisUser(misUserId),
    );
    console.log(
      `🔒 Single sign-out: ended ${sid ? "one MIS session's" : "all"} sessions of MIS user ${misUserId} (${ended.length} local account(s))`,
    );
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

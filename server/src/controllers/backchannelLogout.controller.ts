import { Request, Response } from "express";
import { LogoutTokenError, verifyLogoutToken } from "../utils/ssoLogout";
import { revokeSessionsForMisUser } from "../services/sessionRevocation";

/**
 * POST /api/auth/backchannel-logout -- OpenID Connect Back-Channel Logout.
 * Called by NGA MIS (server to server) when a user signs out there; we end
 * that user's Task Mentor sessions too (nga_central_mis/docs/SINGLE_SIGN_OUT.md).
 */
export const backchannelLogout = async (req: Request, res: Response) => {
  res.set("Cache-Control", "no-store");
  try {
    const misUserId = await verifyLogoutToken((req.body || {}).logout_token, {
      misBaseUrl: process.env.NGA_MIS_BASE_URL || "https://api.amashuri.com",
      clientId: process.env.SSO_CLIENT_ID || "taskmentor_app",
    });
    const ended = await revokeSessionsForMisUser(misUserId);
    console.log(`🔒 Single sign-out: ended sessions of MIS user ${misUserId} (${ended.length} local account(s))`);
    return res.status(200).json({ success: true });
  } catch (error: any) {
    if (error instanceof LogoutTokenError) {
      return res.status(400).json({ error: "invalid_request", error_description: error.message });
    }
    console.error("Back-channel logout failed:", error?.message || error);
    return res.status(500).json({ error: "server_error" });
  }
};

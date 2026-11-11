import { Request, Response, NextFunction } from "express";
import axios from "axios";
import crypto from "crypto";
import { User } from "../models/User.model";
import { Role } from "../models/Role.model";
import { Permission } from "../models/Permission.model";
import { applyEnforcedPermissions } from "../access/policy";
import { noteAccessVersion } from "../access/snapshot";
import { noteAiPolicyVersion } from "../services/aiPolicy";
import { noteMyAiVersions } from "../services/myAiGateway";
import { enterTenant, headerTid, resolveTenant, sendTenantGate, sendTenantMismatch, tidFromMisAuth } from "../tenancy/request";

/**
 * Authentication for /api/integration/* only: the caller (the MIS backend,
 * relaying for a signed-in user) presents that user's own MIS session token
 * as `Authorization: Bearer <MIS token>` instead of a Task Mentor JWT.
 *
 *  1. The token is verified with MIS GET /auth/verify (401 there -> 401
 *     MIS_TOKEN_INVALID here; MIS unreachable -> 503). Verifications are
 *     cached ~60 s keyed by sha256(token); the token itself is never logged.
 *  2. The MIS user id maps to the local user by users.mis_user_id, the key
 *     ssoCallback() looks users up by. This middleware never creates or
 *     updates users (the integration routes are read-only): an MIS user with
 *     no local row yet is passed on with req.user unset and
 *     req.misProvisioned = false, and the route answers `provisioned: false`.
 *  3. req.user is built exactly like protect() builds it (role, resolved
 *     permissions, mis_user_id), and the MIS token is exposed where
 *     getMisToken() reads it (x-mis-token), so existing scoping helpers and
 *     MIS calls work unchanged. Under ACCESS_V2_MODE=enforce the snapshot's
 *     capabilities replace the local role's, as in protect().
 */

const VERIFY_TTL_MS = 60 * 1000;
const MAX_CACHED = 1000;

interface Verified {
  misUserId: number;
  /** Tenant the MIS token belongs to (null = legacy token, legacy default refused). */
  tid: number | null;
  at: number;
}

const verified = new Map<string, Verified>();

/** Tests only. */
export function clearMisBearerCache() {
  verified.clear();
}

/** Tests only. */
export const misBearerCacheSize = () => verified.size;

const tokenKey = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

function remember(key: string, misUserId: number, tid: number | null) {
  if (verified.size >= MAX_CACHED && !verified.has(key)) {
    // Drop the oldest entry (Map keeps insertion order).
    const oldest = verified.keys().next().value;
    if (oldest !== undefined) verified.delete(oldest);
  }
  verified.set(key, { misUserId, tid, at: Date.now() });
}

const invalid = (res: Response) =>
  res.status(401).json({ success: false, code: "MIS_TOKEN_INVALID", message: "MIS session token missing or invalid" });

export const misBearerAuth = async (req: Request, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  const token = header && /^Bearer /i.test(header) ? header.replace(/^Bearer /i, "").trim() : "";
  if (!token || token === "null" || token === "undefined" || token === "none") return invalid(res);

  const key = tokenKey(token);
  let misUserId: number | null = null;
  let tid: number | null = null;
  const cached = verified.get(key);
  if (cached && Date.now() - cached.at < VERIFY_TTL_MS) {
    misUserId = cached.misUserId;
    tid = cached.tid;
  } else {
    if (cached) verified.delete(key);
    try {
      const response = await axios.get(`${process.env.NGA_MIS_BASE_URL}/auth/verify`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
      });
      const data = response.data?.data ?? {};
      const id = Number(data.userId);
      if (!Number.isInteger(id) || id <= 0) return invalid(res);
      misUserId = id;
      tid = tidFromMisAuth(token, data, response.data);
      remember(key, id, tid);
      // A changed access_version invalidates the cached access snapshot.
      noteAccessVersion(id, data.access_version);
      // A changed ai_policy_v means the super admin changed the AI policy.
      noteAiPolicyVersion(data.ai_policy_v);
      // My AI: a new ai_routes_v or ai_policy_v drops this person's cached routes.
      noteMyAiVersions(id, data);
    } catch (error: any) {
      const status = error?.response?.status;
      if (status === 401 || status === 403) return invalid(res);
      console.error("misBearerAuth: MIS verify unavailable:", error?.message ?? error);
      return res.status(503).json({ success: false, code: "MIS_UNAVAILABLE", message: "Could not verify the MIS session" });
    }
  }

  // Tenancy: the MIS token names the school; a relayed X-NGA-Tenant must agree.
  const gate = await resolveTenant(tid);
  if (!gate.ok) return sendTenantGate(res, gate);
  const claimed = headerTid(req);
  if (claimed !== null && claimed !== gate.tenant.tid) return sendTenantMismatch(res);
  return enterTenant(req, gate.tenant, () => provisionedUser(req, res, next, misUserId!, token));
};

async function provisionedUser(req: Request, res: Response, next: NextFunction, misUserId: number, token: string) {
  try {
    (req as any).misUserId = misUserId;
    // The bearer is authoritative for this request: getMisToken() prefers a
    // misToken cookie, so drop any and expose the token as x-mis-token.
    if (req.cookies && req.cookies.misToken) delete req.cookies.misToken;
    req.headers["x-mis-token"] = token;
    (req as any).misToken = token;

    const user = await User.findOne({
      where: { mis_user_id: misUserId },
      include: [{ model: Role, include: [Permission] }],
    });
    if (!user) {
      (req as any).misProvisioned = false;
      return next();
    }

    const permissionKeys = (user.roleRecord?.permissions ?? []).map((p) => p.key);
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role, // @deprecated legacy flat role string, kept for backward compatibility
      roleId: user.role_id,
      roleName: user.roleRecord?.name,
      permissions: new Set(permissionKeys),
      mis_user_id: user.mis_user_id,
      tid: req.tenant?.tid,
      termId: undefined,
      academicYearId: undefined,
    };
    (req as any).misProvisioned = true;

    await applyEnforcedPermissions(req);
    next();
  } catch (error) {
    console.error("misBearerAuth error:", error);
    return res.status(500).json({ success: false, message: "Server error during authentication" });
  }
}

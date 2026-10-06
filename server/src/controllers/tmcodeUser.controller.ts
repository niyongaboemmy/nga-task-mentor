import { Request, Response } from "express";
import axios from "axios";
import { User } from "../models/User.model";
import { Role } from "../models/Role.model";
import { Permission } from "../models/Permission.model";
import { tmcodeError } from "../middleware/tmcodeAuth";
import { applyEnforcedPermissions } from "../access/policy";
import { noteAccessVersion } from "../access/snapshot";
import { upsertMisUser } from "../services/misUserSync";
import { signTmcodeUserToken } from "../tmcode/userToken";

/**
 * TMCode sign-in (PROJECTS_PLAN.md §1). TMCode signs in with MIS (desktop
 * handoff, PKCE), then trades the MIS JWT for a TMCode user token here.
 */

const userName = (u: User) => `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || u.email;

function userJson(u: User, permissions: Iterable<string>) {
  return {
    id: u.id,
    mis_user_id: u.mis_user_id ?? null,
    name: userName(u),
    email: u.email,
    role: u.role,
    avatar_url: u.profile_image ?? null,
    permissions: [...permissions].sort(),
  };
}

/** The local role's permissions, or the v2 snapshot's under ACCESS_V2_MODE=enforce. */
async function effectivePermissions(req: Request, user: User, misToken: string | null): Promise<Set<string>> {
  const role = user.role_id ? await Role.findByPk(user.role_id, { include: [Permission] }) : null;
  req.user = {
    id: user.id,
    email: user.email,
    role: user.role,
    roleId: user.role_id,
    roleName: role?.name,
    permissions: new Set((role?.permissions ?? []).map((p) => p.key)),
    mis_user_id: user.mis_user_id,
  };
  if (misToken) req.headers["x-mis-token"] = misToken;
  await applyEnforcedPermissions(req);
  return req.user.permissions;
}

// @desc    MIS JWT -> TMCode user token. Verifies the MIS session with MIS
//          /auth/verify, creates or refreshes the local user exactly as the
//          SSO callback does, and signs a 30-day TMCode user token.
// @route   POST /api/tmcode/auth/exchange
// @access  Public (Authorization: Bearer <MIS JWT>)
export const exchange = async (req: Request, res: Response) => {
  const header = req.headers.authorization;
  const misToken = header && /^Bearer /i.test(header) ? header.slice(7).trim() : "";
  if (!misToken || misToken === "null" || misToken === "undefined") {
    return tmcodeError(res, 401, "MIS_TOKEN_INVALID", "Sign in with NGA first.");
  }
  const base = process.env.NGA_MIS_BASE_URL;
  const headers = { Authorization: `Bearer ${misToken}` };

  let misUserId: number;
  try {
    const verify = await axios.get(`${base}/auth/verify`, { headers, timeout: 10_000 });
    const data = verify.data?.data ?? {};
    misUserId = Number(data.userId);
    if (!Number.isInteger(misUserId) || misUserId <= 0) {
      return tmcodeError(res, 401, "MIS_TOKEN_INVALID", "Your NGA session is invalid. Sign in again.");
    }
    noteAccessVersion(misUserId, data.access_version);
  } catch (e: any) {
    const status = e?.response?.status;
    if (status === 401 || status === 403) {
      return tmcodeError(res, 401, "MIS_TOKEN_INVALID", "Your NGA session is invalid. Sign in again.");
    }
    console.error("[tmcode auth] MIS verify unavailable:", e?.message);
    return tmcodeError(res, 503, "MIS_UNAVAILABLE", "Could not reach NGA to check your sign-in. Try again shortly.");
  }

  let user: User | null = null;
  try {
    const me = await axios.get(`${base}/users/me`, { headers, timeout: 15_000 });
    const d = me.data?.data ?? {};
    const misUser = d.user ?? {};
    if (!misUser.email) throw new Error("MIS profile without an email");
    ({ user } = await upsertMisUser(
      { user_id: misUserId, email: misUser.email, username: misUser.username },
      d.profile ?? null,
      d.roles ?? [],
    ));
  } catch (e: any) {
    // The profile is only needed to create or refresh the row: a known user
    // still signs in while /users/me is down.
    user = await User.findOne({ where: { mis_user_id: misUserId } });
    if (!user) {
      if (e?.response?.status === 401) {
        return tmcodeError(res, 401, "MIS_TOKEN_INVALID", "Your NGA session is invalid. Sign in again.");
      }
      console.error("[tmcode auth] could not provision the user:", e?.message);
      return tmcodeError(res, 503, "MIS_UNAVAILABLE", "Could not load your NGA profile. Try again shortly.");
    }
  }

  const permissions = await effectivePermissions(req, user, misToken);
  const { token, expiresAt } = signTmcodeUserToken(user.id, user.mis_user_id ?? misUserId);
  return res.status(200).json({
    token,
    expires_at: expiresAt.toISOString(),
    user: userJson(user, permissions),
  });
};

// @desc    The signed-in user and their permissions (TMCode polls it every
//          10 minutes; 401 SESSION_ENDED after an MIS sign-out).
// @route   GET /api/tmcode/auth/me
// @access  tmcodeUserAuth (TMCode user token or TM web token)
export const me = async (req: Request, res: Response) => {
  const user: User = (req as any).tmcodeUserRecord;
  const exp: number | null = (req as any).tmcodeTokenExp ?? null;
  return res.status(200).json({
    user: userJson(user, req.user.permissions),
    token_kind: (req as any).tmcodeTokenKind,
    expires_at: exp ? new Date(exp * 1000).toISOString() : null,
  });
};

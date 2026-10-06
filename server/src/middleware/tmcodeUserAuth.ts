import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/User.model";
import { Role } from "../models/Role.model";
import { Permission } from "../models/Permission.model";
import { applyEnforcedPermissions } from "../access/policy";
import { getRevokedAt } from "../services/sessionRevocation";
import { issuedBeforeRevocation } from "../utils/ssoLogout";
import { verifyTmcodeUserToken } from "../tmcode/userToken";
import { tmcodeError } from "./tmcodeAuth";

/**
 * Auth for the TMCode Projects API (PROJECTS_PLAN.md §3): either
 *  - a TMCode user token (aud "tmcode-user", tmcode/userToken.ts) -- TMCode,
 *    as `Authorization: Bearer`; or
 *  - a normal Task Mentor web JWT (Bearer or the tm_auth_token cookie) --
 *    the TM web pages, including EventSource streams that can only send the
 *    cookie.
 * Builds req.user exactly like protect() (role permissions, mis_user_id, v2
 * enforcement) and honours single sign-out for both kinds by `iat`. Errors
 * use the TMCode `{error_code, message}` shape; 401 SESSION_ENDED tells
 * TMCode to forget its tokens.
 */

export type TmcodeTokenKind = "tmcode-user" | "web";

const BAD = new Set(["", "none", "null", "undefined"]);

function tokenOf(req: Request): string | null {
  const header = req.headers.authorization;
  if (header && /^Bearer /i.test(header)) {
    const t = header.slice(7).trim();
    if (!BAD.has(t)) return t;
  }
  const cookie = (req as any).cookies?.tm_auth_token;
  if (typeof cookie === "string" && !BAD.has(cookie)) return cookie;
  return null;
}

export async function tmcodeUserAuth(req: Request, res: Response, next: NextFunction) {
  const token = tokenOf(req);
  if (!token) return tmcodeError(res, 401, "TOKEN_MISSING", "Sign in to Task Mentor first.");

  let userId: number;
  let iat: number;
  let exp: number | null;
  let kind: TmcodeTokenKind;
  let termId: number | undefined;
  let academicYearId: number | undefined;
  try {
    const claims = verifyTmcodeUserToken(token);
    userId = claims.sub;
    iat = claims.iat;
    exp = claims.exp;
    kind = "tmcode-user";
  } catch (userTokenError: any) {
    if (userTokenError?.name === "TokenExpiredError") {
      return tmcodeError(res, 401, "TOKEN_EXPIRED", "Your TMCode sign-in expired. Sign in again.");
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      if (!decoded?.id || decoded.dbAccess) throw new Error("not a session token");
      userId = Number(decoded.id);
      iat = Number(decoded.iat);
      exp = decoded.exp ? Number(decoded.exp) : null;
      kind = "web";
      termId = decoded.termId;
      academicYearId = decoded.academicYearId;
    } catch (e: any) {
      return tmcodeError(
        res,
        401,
        e?.name === "TokenExpiredError" ? "TOKEN_EXPIRED" : "TOKEN_INVALID",
        "Your Task Mentor sign-in is invalid or expired. Sign in again.",
      );
    }
  }

  try {
    const user = await User.findByPk(userId, { include: [{ model: Role, include: [Permission] }] });
    if (!user) return tmcodeError(res, 401, "TOKEN_INVALID", "This account no longer exists.");
    if (issuedBeforeRevocation(iat, await getRevokedAt(user.id))) {
      return tmcodeError(res, 401, "SESSION_ENDED", "You signed out of NGA. Please sign in again.");
    }
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role, // @deprecated legacy flat role string
      roleId: user.role_id,
      roleName: user.roleRecord?.name,
      permissions: new Set((user.roleRecord?.permissions ?? []).map((p) => p.key)),
      mis_user_id: user.mis_user_id,
      termId,
      academicYearId,
    };
    (req as any).tmcodeTokenKind = kind;
    (req as any).tmcodeTokenExp = exp;
    (req as any).tmcodeUserRecord = user;
    await applyEnforcedPermissions(req);
    next();
  } catch (error) {
    console.error("tmcodeUserAuth error:", error);
    return tmcodeError(res, 500, "SERVER_ERROR", "Something went wrong on Task Mentor.");
  }
}

/** Any-of permission gate with the TMCode error shape. */
export const requireTmPermission =
  (...keys: string[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    const granted: Set<string> = req.user?.permissions ?? new Set();
    if (keys.some((k) => granted.has(k))) return next();
    return tmcodeError(res, 403, "FORBIDDEN", `Missing required permission: ${keys.join(" or ")}`);
  };

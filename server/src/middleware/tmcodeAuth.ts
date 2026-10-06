import { NextFunction, Request, Response } from "express";
import { TmcodeSession } from "../models";
import { verifyTmcodeToken } from "../tmcode/token";

/** PROTOCOL.md error shape. */
export const tmcodeError = (
  res: Response,
  status: number,
  error_code: string,
  message: string,
  extra: Record<string, unknown> = {},
) => res.status(status).json({ error_code, message, ...extra });

/**
 * Bearer TMCode token, scoped to the session in the URL: a token for one
 * session can't touch another (403 SESSION_SCOPE). Attaches the session as
 * `req.tmcodeSession`; the routes decide what a superseded/ended session may
 * still do (heartbeat reports the status; uploads refuse).
 */
export async function tmcodeAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return tmcodeError(res, 401, "TOKEN_MISSING", "A TMCode session token is required.");
  let claims;
  try {
    claims = verifyTmcodeToken(token);
  } catch (e: any) {
    return tmcodeError(
      res,
      401,
      e?.name === "TokenExpiredError" ? "TOKEN_EXPIRED" : "TOKEN_INVALID",
      "The TMCode session token is invalid or expired.",
    );
  }
  if (claims.sid !== req.params.sid) {
    return tmcodeError(res, 403, "SESSION_SCOPE", "This token belongs to another session.");
  }
  const session = await TmcodeSession.findByPk(claims.sid);
  if (!session || session.submission_id !== claims.submission_id) {
    return tmcodeError(res, 401, "TOKEN_INVALID", "Unknown TMCode session.");
  }
  if (session.status === "revoked") {
    return tmcodeError(res, 401, "SESSION_REVOKED", "This session was ended by Task Mentor. Launch again from Task Mentor.");
  }
  (req as any).tmcodeSession = session;
  next();
}

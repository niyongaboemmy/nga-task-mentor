import jwt from "jsonwebtoken";

/**
 * The TMCode user token (PROJECTS_PLAN.md §1): what TMCode keeps in the OS
 * keychain after signing in with MIS. HS256 with JWT_SECRET + ":tmcode-user",
 * aud "tmcode-user", sub = local user id, mis = MIS user id, 30 days.
 *
 * A different secret from the web JWT and from the exam-session token
 * (tmcode/token.ts, ":tmcode"), so none of the three is accepted where another
 * is expected. Only middleware/tmcodeUserAuth accepts it (on /api/tmcode/*).
 */

export const TMCODE_USER_AUDIENCE = "tmcode-user";

const secret = () => `${process.env.JWT_SECRET}:tmcode-user`;

export const userTokenTtlSeconds = () =>
  Math.max(60, Number(process.env.TMCODE_USER_TOKEN_TTL_DAYS || 30) * 86_400);

export interface TmcodeUserClaims {
  /** Local Task Mentor user id. */
  sub: number;
  /** MIS user id (null for a local-only account). */
  mis: number | null;
  /** Issued-at, seconds (single sign-out compares it with the revocation time). */
  iat: number;
  exp: number;
}

export function signTmcodeUserToken(userId: number, misUserId: number | null): { token: string; expiresAt: Date } {
  const ttl = userTokenTtlSeconds();
  const token = jwt.sign({ mis: misUserId ?? null }, secret(), {
    algorithm: "HS256",
    audience: TMCODE_USER_AUDIENCE,
    subject: String(userId),
    expiresIn: ttl,
  });
  const { exp } = jwt.decode(token) as { exp: number };
  return { token, expiresAt: new Date(exp * 1000) };
}

/** Throws on a bad signature, wrong audience or expiry. */
export function verifyTmcodeUserToken(token: string): TmcodeUserClaims {
  const p = jwt.verify(token, secret(), { algorithms: ["HS256"], audience: TMCODE_USER_AUDIENCE }) as any;
  const sub = Number(p.sub);
  if (!Number.isInteger(sub) || sub <= 0) throw new jwt.JsonWebTokenError("bad subject");
  return { sub, mis: p.mis == null ? null : Number(p.mis), iat: Number(p.iat), exp: Number(p.exp) };
}

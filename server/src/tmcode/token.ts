import jwt from "jsonwebtoken";

/**
 * The attempt-scoped TMCode token (PROTOCOL.md §1): HS256 with
 * JWT_SECRET + ":tmcode", aud "tmcode", claims {sid, sub, submission_id}.
 * Valid only on /api/tmcode/sessions/<sid>/* (see middleware/tmcodeAuth).
 */

export interface TmcodeClaims {
  sid: string;
  /** Local Task Mentor user id (string, as JWT `sub` requires). */
  sub: string;
  submission_id: number;
}

const secret = () => `${process.env.JWT_SECRET}:tmcode`;

export function signTmcodeToken(claims: TmcodeClaims, expiresAt: Date): string {
  return jwt.sign(
    { sid: claims.sid, submission_id: claims.submission_id },
    secret(),
    {
      algorithm: "HS256",
      audience: "tmcode",
      subject: claims.sub,
      expiresIn: Math.max(60, Math.floor((expiresAt.getTime() - Date.now()) / 1000)),
    },
  );
}

/** Throws on a bad signature, wrong audience or expiry. */
export function verifyTmcodeToken(token: string): TmcodeClaims {
  const p = jwt.verify(token, secret(), { algorithms: ["HS256"], audience: "tmcode" }) as any;
  return { sid: String(p.sid), sub: String(p.sub), submission_id: Number(p.submission_id) };
}

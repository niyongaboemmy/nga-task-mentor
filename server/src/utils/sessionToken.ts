import jwt from "jsonwebtoken";

/**
 * Task Mentor's own tokens, kept apart by purpose (school isolation audit
 * 2026-11-25, TM-ISO-1 / TM-ISO-2).
 *
 * Session token -- what `protect`, `refreshToken`, the live-server, the
 * activity relay and TMCode's web fallback accept:
 *   HS256 with JWT_SECRET, `typ: "session"`, `aud: "task-mentor"`, and the
 *   school (`tid`) it was signed in to. Tokens minted before this change have
 *   no `typ`; they stay valid (so nobody is logged out by the deploy) only
 *   while they carry none of the markers another kind of token uses
 *   (`dbAccess`, `typ`, `purpose`).
 *
 * DB step-up token -- the Database console's "re-enter your password" proof:
 *   HS256 with a key DERIVED from JWT_SECRET, `typ: "db-step-up"`,
 *   `aud: "task-mentor:db-console"`, the user id and the school, 20 minutes.
 *   It used to be `{id, dbAccess}` signed with JWT_SECRET itself and no tid,
 *   which `protect` accepted as a full session of school 1 (TM-ISO-1). Signed
 *   with another key it can't verify as a session anywhere; the typed checks
 *   below are the second wall.
 *
 * TMCode web preview token -- the key in /api/tmcode/preview/<token>/ (an
 *   iframe sends no Authorization header):
 *   HS256 with another key DERIVED from JWT_SECRET, `typ: "tmcode-preview"`,
 *   `aud: "task-mentor:tmcode-preview"`, the project + revision and the school
 *   (`tid`) it was made in, 30 minutes. It used to be an HMAC of {p, r, e} with
 *   JWT_SECRET itself and no school, so the unauthenticated preview route read
 *   the revision from whichever database it fell back to (school 1).
 */

export const SESSION_TYP = "session";
export const SESSION_AUDIENCE = "task-mentor";
export const DB_STEP_UP_TYP = "db-step-up";
export const DB_STEP_UP_AUDIENCE = "task-mentor:db-console";
export const DB_STEP_UP_TTL_SECONDS = 1200;
export const PREVIEW_TYP = "tmcode-preview";
export const PREVIEW_AUDIENCE = "task-mentor:tmcode-preview";
export const PREVIEW_TTL_SECONDS = 30 * 60;

/** Claims that mark a token as something other than a session. */
const TYPED_MARKERS = ["dbAccess", "typ", "purpose"] as const;

export interface SessionClaims {
  id: number;
  role?: string;
  tid?: number;
  termId?: number;
  academicYearId?: number;
  sid?: string;
  typ?: string;
  iat?: number;
  exp?: number;
}

export class SessionTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SessionTokenError";
  }
}

const sessionSecret = (secret?: string) => {
  const s = secret ?? process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET is not defined");
  return s;
};

export const dbStepUpSecret = (secret?: string) => `${sessionSecret(secret)}:db-step-up`;
export const previewSecret = (secret?: string) => `${sessionSecret(secret)}:tmcode-preview`;

const sessionExpiry = () =>
  process.env.JWT_EXPIRE ? Number(process.env.JWT_EXPIRE) || process.env.JWT_EXPIRE : "30d";

/** The one place a Task Mentor session token is signed. */
export function signSessionToken(claims: {
  id: number;
  role?: string;
  tid: number;
  termId?: number | null;
  academicYearId?: number | null;
  sid?: string | null;
}): string {
  const payload: Record<string, unknown> = { id: claims.id, role: claims.role, tid: claims.tid, typ: SESSION_TYP };
  if (claims.termId) payload.termId = claims.termId;
  if (claims.academicYearId) payload.academicYearId = claims.academicYearId;
  if (claims.sid) payload.sid = claims.sid;
  return jwt.sign(payload, sessionSecret(), { expiresIn: sessionExpiry() as any, audience: SESSION_AUDIENCE });
}

/**
 * Is this (already signature-verified) payload a session? `typ: "session"`
 * with our audience, or a legacy token with no typed marker at all.
 */
export function isSessionClaims(claims: unknown): claims is SessionClaims {
  if (!claims || typeof claims !== "object") return false;
  const c = claims as Record<string, unknown>;
  const id = Number(c.id);
  if (!Number.isSafeInteger(id) || id <= 0) return false;
  if (c.typ === SESSION_TYP) {
    const aud = c.aud;
    return aud === SESSION_AUDIENCE || (Array.isArray(aud) && aud.includes(SESSION_AUDIENCE));
  }
  // Legacy shape (before typ existed): accepted only when nothing marks it as
  // another kind of token, and it names no audience of its own.
  if (TYPED_MARKERS.some((k) => k in c)) return false;
  if ("aud" in c) return false;
  return true;
}

/** Verify signature + expiry and the session shape. Throws on anything else. */
export function verifySessionToken(token: string, secret?: string): SessionClaims {
  const decoded = jwt.verify(token, sessionSecret(secret), { algorithms: ["HS256"] });
  if (!isSessionClaims(decoded)) throw new SessionTokenError("not a session token");
  return decoded;
}

/** The DB console's step-up proof for `id` in school `tid`. */
export function signDbStepUpToken(id: number, tid: number): string {
  return jwt.sign({ id, tid, typ: DB_STEP_UP_TYP }, dbStepUpSecret(), {
    expiresIn: DB_STEP_UP_TTL_SECONDS,
    audience: DB_STEP_UP_AUDIENCE,
    algorithm: "HS256",
  });
}

/** Verify a step-up token for this user in this school; throws otherwise. */
export function verifyDbStepUpToken(token: string, expect: { id: number; tid: number | undefined }): void {
  const p = jwt.verify(token, dbStepUpSecret(), { algorithms: ["HS256"], audience: DB_STEP_UP_AUDIENCE }) as any;
  if (p?.typ !== DB_STEP_UP_TYP) throw new SessionTokenError("not a step-up token");
  if (!expect.tid || Number(p.tid) !== Number(expect.tid)) throw new SessionTokenError("step-up token is for another school");
  if (Number(p.id) !== Number(expect.id)) throw new SessionTokenError("step-up token is for another user");
}

export interface PreviewClaims {
  /** Project id. */
  p: number;
  /** Revision id. */
  r: number;
  /** The school the preview was made in; the revision is read there only. */
  tid: number;
}

const positiveInt = (v: unknown) => {
  const n = Number(v);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
};

/** A TMCode web preview of project `p` at revision `r`, in school `tid`. */
export function signPreviewToken(claims: PreviewClaims, now = Date.now()): string {
  const p = positiveInt(claims.p);
  const r = positiveInt(claims.r);
  const tid = positiveInt(claims.tid);
  if (!p || !r || !tid) throw new SessionTokenError("a preview needs a project, a revision and a school");
  return jwt.sign({ p, r, tid, typ: PREVIEW_TYP, iat: Math.floor(now / 1000) }, previewSecret(), {
    expiresIn: PREVIEW_TTL_SECONDS,
    audience: PREVIEW_AUDIENCE,
    algorithm: "HS256",
  });
}

/** The preview a token opens, or null (bad signature, expired, wrong kind, no school). */
export function verifyPreviewToken(token: string, now = Date.now()): PreviewClaims | null {
  try {
    const c = jwt.verify(String(token), previewSecret(), {
      algorithms: ["HS256"],
      audience: PREVIEW_AUDIENCE,
      clockTimestamp: Math.floor(now / 1000),
    }) as Record<string, unknown>;
    if (!c || c.typ !== PREVIEW_TYP) return null;
    const p = positiveInt(c.p);
    const r = positiveInt(c.r);
    const tid = positiveInt(c.tid);
    return p && r && tid ? { p, r, tid } : null;
  } catch {
    return null;
  }
}

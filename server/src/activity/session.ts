import { Request } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/User.model";
import { getRevokedAt } from "../services/sessionRevocation";
import { issuedBeforeRevocation } from "../utils/ssoLogout";

/**
 * Who is behind an activity batch: the MIS user id of this request's Task
 * Mentor session, or null for a public visitor.
 *
 * Mirrors `protect` (middleware/auth.ts) exactly -- same token sources, same
 * signature/expiry check, same "user still exists" and single sign-out
 * (session_revocations) checks -- but never rejects: any failure means
 * "visitor". It returns the MIS id, never the local `users.id`.
 */

const PLACEHOLDER_TOKENS = new Set(["none", "null", "undefined"]);

/** The session token, read from the same places `protect` reads it. */
export const sessionTokenOf = (req: Request): string | null => {
  const header = req.headers?.authorization;
  let token: string | undefined;
  if (header && header.startsWith("Bearer")) token = header.split(" ")[1];
  else if (req.cookies && req.cookies.tm_auth_token) token = req.cookies.tm_auth_token;
  if (!token || PLACEHOLDER_TOKENS.has(token)) return null;
  return token;
};

export interface SessionLookups {
  /** JWT secret; read from JWT_SECRET at call time when omitted. */
  secret?: string;
  /** The MIS id of local user `id`: undefined when the user doesn't exist, null when it has no MIS id. */
  findMisUserId: (localUserId: number) => Promise<number | null | undefined>;
  /** When this local user's sessions were ended by a back-channel logout, if ever. */
  revokedAt: (localUserId: number) => Promise<Date | null>;
}

export const createMisUserIdResolver =
  (lookups: SessionLookups) =>
  async (req: Request): Promise<number | null> => {
    try {
      const token = sessionTokenOf(req);
      const secret = lookups.secret ?? process.env.JWT_SECRET;
      if (!token || !secret) return null;
      const decoded = jwt.verify(token, secret) as { id?: unknown; iat?: number };
      const localId = Number(decoded?.id);
      if (!Number.isInteger(localId) || localId <= 0) return null;
      const misUserId = await lookups.findMisUserId(localId);
      if (misUserId === undefined) return null; // protect: "User not found"
      if (issuedBeforeRevocation(decoded.iat, await lookups.revokedAt(localId))) return null; // SESSION_ENDED
      const id = Number(misUserId);
      return Number.isInteger(id) && id > 0 ? id : null;
    } catch {
      return null;
    }
  };

// A user's MIS id never changes, and a deleted user can only linger here for
// the cache window; heartbeats arrive every 30 s per tab, so this saves a
// users lookup on almost every batch.
const MIS_ID_CACHE_MS = 60_000;
const misIdCache = new Map<number, { at: number; misUserId: number | null }>();

const findMisUserId = async (localUserId: number) => {
  const hit = misIdCache.get(localUserId);
  if (hit && Date.now() - hit.at < MIS_ID_CACHE_MS) return hit.misUserId;
  const user = await User.findByPk(localUserId, { attributes: ["id", "mis_user_id"] });
  if (!user) return undefined;
  const misUserId = user.mis_user_id ?? null;
  if (misIdCache.size >= 5_000) misIdCache.delete(misIdCache.keys().next().value as number);
  misIdCache.set(localUserId, { at: Date.now(), misUserId });
  return misUserId;
};

/** The resolver the relay uses in production (real users table + revocations). */
export const misUserIdFromSession = createMisUserIdResolver({ findMisUserId, revokedAt: getRevokedAt });

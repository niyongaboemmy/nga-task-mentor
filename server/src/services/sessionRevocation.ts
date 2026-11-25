import { tk } from "../tenancy/keys";
import { QueryTypes } from "sequelize";
import { sequelize } from "../config/database";
import { User } from "../models/User.model";

/**
 * Single sign-out (nga_central_mis/docs/SINGLE_SIGN_OUT.md): when someone
 * signs out of NGA MIS, MIS tells us (back-channel logout) and we record
 * "sessions of this user ended at T". The auth middleware then refuses any
 * Task Mentor token issued before T -- including copies in other browsers.
 *
 * A tiny table created on first use (no migration step needed on deploy);
 * DATETIME(3) keeps millisecond precision so a token issued just before the
 * sign-out can't slip through.
 */

// Per tenant database: each school's DB gets its own CREATE TABLE IF NOT EXISTS.
const ensuredByDb = new Map<string, Promise<void>>();
export const ensureRevocationTable = () => {
  const key = tk("ensure-table");
  let ensured = ensuredByDb.get(key);
  if (!ensured) {
    ensured = sequelize
      .query(
        `CREATE TABLE IF NOT EXISTS session_revocations (
           user_id INT NOT NULL PRIMARY KEY,
           revoked_at DATETIME(3) NOT NULL
         ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      )
      .then(() => undefined)
      .catch((e) => {
        ensuredByDb.delete(key);
        throw e;
      });
    ensuredByDb.set(key, ensured);
  }
  return ensured;
};

/**
 * Per-session revocations (TENANT_SWITCHING_PLAN.md Appendix A.3): a logout
 * token that carries `sid` (one MIS browser session, e.g. a school switch)
 * ends only the Task Mentor sessions built from that MIS session. Rows are
 * (user, sid); sid '' stands for "sessions that carry no sid", which can't be
 * told apart and are revoked by every sid logout. Same create-on-first-use
 * style as session_revocations (no migration step on deploy).
 */
const ensuredSidByDb = new Map<string, Promise<void>>();
export const ensureSidRevocationTable = () => {
  const key = tk("ensure-sid-table");
  let ensured = ensuredSidByDb.get(key);
  if (!ensured) {
    ensured = sequelize
      .query(
        `CREATE TABLE IF NOT EXISTS session_sid_revocations (
           user_id INT NOT NULL,
           sid VARCHAR(64) NOT NULL,
           revoked_at DATETIME(3) NOT NULL,
           PRIMARY KEY (user_id, sid)
         ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      )
      .then(() => undefined)
      .catch((e) => {
        ensuredSidByDb.delete(key);
        throw e;
      });
    ensuredSidByDb.set(key, ensured);
  }
  return ensured;
};

/** The sid a session is tied to, normalised ('' = none / unknown). */
export const normalizeSid = (sid: unknown): string => {
  const v = typeof sid === "string" ? sid.trim() : "";
  return /^[A-Za-z0-9_-]{1,64}$/.test(v) ? v : "";
};

const later = (a: Date | null, b: Date | null) => (!a ? b : !b ? a : a.getTime() >= b.getTime() ? a : b);

// Short cache: the middleware asks on every request.
const cache = new Map<string, { at: number; revokedAt: Date | null }>();
const CACHE_MS = 15_000;

const getUserRevokedAt = async (userId: number): Promise<Date | null> => {
  const hit = cache.get(tk(userId));
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.revokedAt;
  try {
    await ensureRevocationTable();
    const rows = await sequelize.query<{ revoked_at: Date }>(
      "SELECT revoked_at FROM session_revocations WHERE user_id = ? LIMIT 1",
      { replacements: [userId], type: QueryTypes.SELECT },
    );
    const revokedAt = rows[0]?.revoked_at ? new Date(rows[0].revoked_at) : null;
    cache.set(tk(userId), { at: Date.now(), revokedAt });
    return revokedAt;
  } catch {
    // Never lock everyone out over a lookup failure.
    return null;
  }
};

const sidCache = new Map<string, { at: number; revokedAt: Date | null }>();

const getSidRevokedAt = async (userId: number, sid: string): Promise<Date | null> => {
  const key = tk(userId, "sid", sid);
  const hit = sidCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.revokedAt;
  try {
    await ensureSidRevocationTable();
    const rows = await sequelize.query<{ revoked_at: Date }>(
      "SELECT revoked_at FROM session_sid_revocations WHERE user_id = ? AND sid = ? LIMIT 1",
      { replacements: [userId, sid], type: QueryTypes.SELECT },
    );
    const revokedAt = rows[0]?.revoked_at ? new Date(rows[0].revoked_at) : null;
    sidCache.set(key, { at: Date.now(), revokedAt });
    return revokedAt;
  } catch {
    return null;
  }
};

/**
 * When the sessions of `userId` that are tied to MIS session `sid` were last
 * ended: the later of an all-sessions revocation and one for that sid (a
 * session with no sid -- null/'' -- matches every sid revocation).
 */
export const getRevokedAt = async (userId: number, sid?: string | null): Promise<Date | null> => {
  const [all, one] = await Promise.all([getUserRevokedAt(userId), getSidRevokedAt(userId, normalizeSid(sid))]);
  return later(all, one);
};

/**
 * End the Task Mentor sessions of MIS user `misUserId` built from MIS session
 * `sid` (plus the ones that carry no sid). Returns local user ids.
 */
export const revokeSessionsForMisSid = async (misUserId: string, sid: string, at = new Date()): Promise<number[]> => {
  const s = normalizeSid(sid);
  if (!s) return revokeSessionsForMisUser(misUserId, at);
  await ensureSidRevocationTable();
  const users = await User.findAll({ where: { mis_user_id: Number(misUserId) } as any, attributes: ["id"] });
  for (const u of users) {
    for (const value of [s, ""]) {
      await sequelize.query(
        "INSERT INTO session_sid_revocations (user_id, sid, revoked_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE revoked_at = VALUES(revoked_at)",
        { replacements: [u.id, value, at] },
      );
      sidCache.set(tk(u.id, "sid", value), { at: Date.now(), revokedAt: at });
    }
  }
  return users.map((u) => u.id);
};

/** End every Task Mentor session of the MIS user `misUserId`. Returns local user ids. */
export const revokeSessionsForMisUser = async (misUserId: string, at = new Date()): Promise<number[]> => {
  await ensureRevocationTable();
  const users = await User.findAll({ where: { mis_user_id: Number(misUserId) } as any, attributes: ["id"] });
  for (const u of users) {
    await sequelize.query(
      "INSERT INTO session_revocations (user_id, revoked_at) VALUES (?, ?) ON DUPLICATE KEY UPDATE revoked_at = VALUES(revoked_at)",
      { replacements: [u.id, at] },
    );
    cache.set(tk(u.id), { at: Date.now(), revokedAt: at });
  }
  return users.map((u) => u.id);
};

/** Tests only: forget the cached lookups. */
export const resetRevocationCacheForTests = () => {
  cache.clear();
  sidCache.clear();
};

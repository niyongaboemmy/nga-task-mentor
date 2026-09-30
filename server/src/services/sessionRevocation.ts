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

let ensured: Promise<void> | null = null;
export const ensureRevocationTable = () => {
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
        ensured = null;
        throw e;
      });
  }
  return ensured;
};

// Short cache: the middleware asks on every request.
const cache = new Map<number, { at: number; revokedAt: Date | null }>();
const CACHE_MS = 15_000;

export const getRevokedAt = async (userId: number): Promise<Date | null> => {
  const hit = cache.get(userId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.revokedAt;
  try {
    await ensureRevocationTable();
    const rows = await sequelize.query<{ revoked_at: Date }>(
      "SELECT revoked_at FROM session_revocations WHERE user_id = ? LIMIT 1",
      { replacements: [userId], type: QueryTypes.SELECT },
    );
    const revokedAt = rows[0]?.revoked_at ? new Date(rows[0].revoked_at) : null;
    cache.set(userId, { at: Date.now(), revokedAt });
    return revokedAt;
  } catch {
    // Never lock everyone out over a lookup failure.
    return null;
  }
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
    cache.set(u.id, { at: Date.now(), revokedAt: at });
  }
  return users.map((u) => u.id);
};

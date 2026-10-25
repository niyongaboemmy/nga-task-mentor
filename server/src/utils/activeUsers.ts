import { Op, WhereOptions } from "sequelize";
import { User } from "../models/User.model";

/**
 * Active users only (ACTIVE_USERS_CONTRACTS.md, "Task Mentor").
 *
 * MIS is the source of truth: a person is active when their MIS account
 * status is ACTIVE. INACTIVE, SUSPENDED and REMOVED (MIS no longer returns
 * the account) are not. Task Mentor keeps that status on users.mis_status --
 * set on SSO sign-in and by the daily sweep (services/misStatusSweep.ts) --
 * and NULL (not synced yet) counts as active.
 *
 * Lists of people (rosters, pickers, searches, rankings, counts used for
 * actions) go through these helpers. History (submissions, grades, report
 * cards, proctoring, project members...) keeps inactive people, tagged
 * `inactive: true` where that is cheap.
 *
 * Two layers, both applied: the MIS row's own status when the payload
 * carries one (MIS rosters will only return active people once MIS is
 * fixed), and the local users.mis_status as defence in depth for today's
 * MIS, which still lists deactivated students.
 */

export const ACTIVE = "ACTIVE";
export const REMOVED = "REMOVED";

/** Upper-cased status, or null when there is none. Booleans / 0-1 map to ACTIVE / INACTIVE. */
export function normalizeStatus(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value ? ACTIVE : "INACTIVE";
  if (typeof value === "number") return value === 1 ? ACTIVE : value === 0 ? "INACTIVE" : String(value);
  const s = String(value).trim().toUpperCase();
  return s ? s.slice(0, 16) : null;
}

/** The one predicate: no status (not synced) or ACTIVE. */
export function isActiveStatus(value: unknown): boolean {
  const s = normalizeStatus(value);
  return s === null || s === ACTIVE;
}

/** A local users row (or plain object) is active. */
export const isActiveUser = (u: { mis_status?: string | null } | null | undefined): boolean =>
  !!u && isActiveStatus(u.mis_status);

/**
 * Sequelize `where` fragment for active local users. Spread it into a User
 * where, or pass `prefix` ("student") to target an included alias as
 * `$student.mis_status$`.
 */
export function activeUserWhere(prefix?: string): WhereOptions {
  const col = prefix ? `$${prefix}.mis_status$` : "mis_status";
  return { [Op.or]: [{ [col]: null }, { [col]: ACTIVE }] } as any;
}

/** Raw-SQL fragment (alias.mis_status), for code that writes SQL. */
export const activeUserSql = (alias = "users") =>
  `(${alias}.mis_status IS NULL OR ${alias}.mis_status = '${ACTIVE}')`;

/** The MIS user id of a roster/user row in any of the shapes MIS returns. */
export function misRowUserId(row: any): number | null {
  if (row == null) return null;
  if (typeof row === "number" || typeof row === "string") {
    const n = Number(row);
    return Number.isInteger(n) && n > 0 ? n : null;
  }
  const candidates = [row.user_id, row.student_id, row.user?.user_id, row.user?.id, row.id];
  for (const c of candidates) {
    const n = Number(c);
    if (c != null && c !== "" && Number.isInteger(n) && n > 0) return n;
  }
  return null;
}

/** The account status an MIS row carries, if any (nested user first, then flat). */
export function misRowStatus(row: any): unknown {
  if (row == null || typeof row !== "object") return null;
  return row.user?.status ?? row.user_status ?? row.status ?? null;
}

/** Local users.id set whose mis_status says inactive, among `localIds`. */
export async function inactiveLocalIds(localIds: Array<number | null | undefined>): Promise<Set<number>> {
  const ids = [...new Set(localIds.map(Number).filter((n) => Number.isInteger(n) && n > 0))];
  if (!ids.length) return new Set();
  const rows = (await User.findAll({
    where: { id: { [Op.in]: ids }, mis_status: { [Op.ne]: null, [Op.notIn]: [ACTIVE] } } as any,
    attributes: ["id"],
    raw: true,
  })) as any[];
  return new Set(rows.map((r) => Number(r.id)));
}

/** MIS user ids whose local row says inactive, among `misIds`. */
export async function inactiveMisIds(misIds: Array<number | null | undefined>): Promise<Set<number>> {
  const ids = [...new Set(misIds.map(Number).filter((n) => Number.isInteger(n) && n > 0))];
  if (!ids.length) return new Set();
  const rows = (await User.findAll({
    where: { mis_user_id: { [Op.in]: ids }, mis_status: { [Op.ne]: null, [Op.notIn]: [ACTIVE] } } as any,
    attributes: ["mis_user_id"],
    raw: true,
  })) as any[];
  return new Set(rows.map((r) => Number(r.mis_user_id)));
}

/** Keep only active local user ids (order kept). */
export async function filterActiveLocalIds<T extends number | null | undefined>(localIds: T[]): Promise<T[]> {
  const off = await inactiveLocalIds(localIds);
  return off.size ? localIds.filter((id) => !off.has(Number(id))) : localIds;
}

/**
 * Drop MIS rows of people who are not active: a non-ACTIVE status on the row
 * itself, or a local users row (by MIS id) with a non-active mis_status.
 * A local lookup failure keeps the rows (never empty a roster over it).
 */
export async function filterActiveMisRows<T>(
  rows: T[],
  idOf: (row: T) => number | null = misRowUserId,
): Promise<T[]> {
  if (!Array.isArray(rows) || rows.length === 0) return rows ?? [];
  const byStatus = rows.filter((r) => isActiveStatus(misRowStatus(r)));
  try {
    const off = await inactiveMisIds(byStatus.map(idOf));
    return off.size ? byStatus.filter((r) => !off.has(Number(idOf(r)))) : byStatus;
  } catch (err: any) {
    console.warn("[active-users] local status lookup failed:", err?.message ?? err);
    return byStatus;
  }
}

/** History views: tag each row `inactive: true|false` instead of dropping it. */
export async function tagInactiveMisRows<T extends Record<string, any>>(
  rows: T[],
  idOf: (row: T) => number | null = misRowUserId,
): Promise<Array<T & { inactive: boolean }>> {
  let off = new Set<number>();
  try {
    off = await inactiveMisIds(rows.map(idOf));
  } catch {
    /* tags are cosmetic */
  }
  return rows.map((r) => ({ ...r, inactive: !isActiveStatus(misRowStatus(r)) || off.has(Number(idOf(r))) }));
}

/**
 * Rows keyed by a ranking/student key ("m<mis id>" or "l<local id>", see
 * utils/overallRanking studentKey) without the ones whose local user is
 * inactive. `keep` is never dropped (the signed-in caller).
 */
export async function dropInactiveKeyed<T>(rows: T[], keyOf: (row: T) => string, keep?: string): Promise<T[]> {
  const keys = Array.from(new Set(rows.map(keyOf))).filter((k) => k && k !== keep);
  const mis = keys.filter((k) => k.startsWith("m")).map((k) => Number(k.slice(1)));
  const local = keys.filter((k) => k.startsWith("l")).map((k) => Number(k.slice(1)));
  if (!mis.length && !local.length) return rows;
  const [offMis, offLocal] = await Promise.all([inactiveMisIds(mis), inactiveLocalIds(local)]);
  if (!offMis.size && !offLocal.size) return rows;
  return rows.filter((r) => {
    const k = keyOf(r);
    if (k === keep) return true;
    const id = Number(k.slice(1));
    return !((k.startsWith("m") && offMis.has(id)) || (k.startsWith("l") && offLocal.has(id)));
  });
}

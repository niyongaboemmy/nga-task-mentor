import { Op, QueryTypes } from "sequelize";
import { sequelize } from "../config/database";
import { User } from "../models/User.model";
import { clientBasicAuth } from "../access/misClient";
import { isMisTransportInjected, misBase, misServiceCall } from "./reminderSync";
import { getLastSuccess, loadMisPeople, nextRunAt, parseRunAt, recordRun } from "./earlyWarningPush";
import { ACTIVE, REMOVED, normalizeStatus } from "../utils/activeUsers";

/**
 * MIS status sweep (ACTIVE_USERS_CONTRACTS.md, "Spokes"): copies each MIS
 * account's status onto users.mis_status so rosters, pickers, rankings and
 * counts can leave inactive people out (utils/activeUsers.ts).
 *
 *  - Daily: pages GET /integrations/sync/people (all users, with `status`)
 *    using this app's client credentials. Linked local users (mis_user_id)
 *    that MIS no longer returns become REMOVED. Nothing changes when any
 *    page fails, when MIS returns nobody, or when the sweep would mark more
 *    than MIS_STATUS_SWEEP_MAX_REMOVED_RATIO (default 0.5) of the linked
 *    users REMOVED -- a broken MIS answer must not hide every student.
 *  - On demand: after a back-channel logout, recheckMisStatus(misUserId)
 *    reads that one user (sync/people from cursor id-1, limit 1).
 *
 * Runs at MIS_STATUS_SWEEP_AT (default 02:30 Africa/Kigali) and ~3 minutes
 * after boot when the last success is older than 20 hours. Off with
 * MIS_STATUS_SWEEP=0/false/off, or without the MIS URL / client
 * credentials. Never throws.
 */

export const JOB_NAME = "mis_status_sweep";
const BOOT_DELAY_MS = 3 * 60 * 1000;
const STALE_AFTER_MS = 20 * 60 * 60 * 1000;
const UPDATE_CHUNK = 500;

const log = (msg: string) => console.log(`[mis-status] ${msg}`);
const warn = (msg: string, err?: unknown) =>
  console.warn(`[mis-status] ${msg}${err ? `: ${(err as any)?.message ?? err}` : ""}`);

export function misStatusSweepDisabledReason(env: NodeJS.ProcessEnv = process.env): string | null {
  const flag = (env.MIS_STATUS_SWEEP || "").trim().toLowerCase();
  if (flag === "0" || flag === "false" || flag === "off") return `MIS_STATUS_SWEEP=${env.MIS_STATUS_SWEEP}`;
  if (env.NODE_ENV === "test" && !isMisTransportInjected()) return "NODE_ENV=test";
  if (!misBase(env)) return "NGA_MIS_BASE_URL is not set";
  if (!clientBasicAuth(env)) return "SSO_CLIENT_ID/SSO_CLIENT_SECRET are not set";
  return null;
}

const maxRemovedRatio = (env: NodeJS.ProcessEnv = process.env) => {
  const n = Number(env.MIS_STATUS_SWEEP_MAX_REMOVED_RATIO);
  return Number.isFinite(n) && n > 0 && n <= 1 ? n : 0.5;
};

/** Pure: MIS people -> MIS id -> status (a user without a status field counts as ACTIVE). */
export function statusByMisId(people: any[]): Map<number, string> {
  const out = new Map<number, string>();
  for (const u of people ?? []) {
    const id = Number(u?.id ?? u?.user_id);
    if (!Number.isInteger(id) || id <= 0) continue;
    out.set(id, normalizeStatus(u?.status) ?? ACTIVE);
  }
  return out;
}

export interface SweepSummary {
  ok: boolean;
  skipped?: string;
  people: number;
  linked: number;
  changed: number;
  inactive: number;
  removed: number;
}

/**
 * Pure: the status each linked local user should get. Local rows whose MIS
 * id MIS did not return become REMOVED.
 */
export function plannedStatuses(
  local: Array<{ id: number; mis_user_id: number; mis_status: string | null }>,
  byMis: Map<number, string>,
): Map<string, number[]> {
  const plan = new Map<string, number[]>();
  for (const u of local) {
    const next = byMis.get(Number(u.mis_user_id)) ?? REMOVED;
    if ((u.mis_status ?? null) === next) continue;
    const list = plan.get(next) ?? [];
    list.push(Number(u.id));
    plan.set(next, list);
  }
  return plan;
}

async function applyPlan(plan: Map<string, number[]>): Promise<number> {
  let changed = 0;
  for (const [status, ids] of plan) {
    for (let i = 0; i < ids.length; i += UPDATE_CHUNK) {
      const chunk = ids.slice(i, i + UPDATE_CHUNK);
      const [n] = await User.update({ mis_status: status } as any, {
        where: { id: { [Op.in]: chunk } } as any,
        hooks: false,
        silent: true,
      } as any);
      changed += Number(n) || 0;
    }
  }
  return changed;
}

let running = false;

/** Sync every linked local user's mis_status from MIS. Never throws. */
export async function runMisStatusSweep(now = new Date()): Promise<SweepSummary> {
  const empty: SweepSummary = { ok: false, people: 0, linked: 0, changed: 0, inactive: 0, removed: 0 };
  const off = misStatusSweepDisabledReason();
  if (off) return { ...empty, skipped: off };
  if (running) return { ...empty, skipped: "already running" };
  running = true;
  try {
    const people = await loadMisPeople();
    const byMis = statusByMisId(people);
    if (byMis.size === 0) {
      const line = "MIS returned no people; nothing changed";
      warn(line);
      await recordRun(false, now.getTime(), line, JOB_NAME);
      return { ...empty, skipped: "empty" };
    }
    const local = (await sequelize.query<{ id: number; mis_user_id: number; mis_status: string | null }>(
      "SELECT id, mis_user_id, mis_status FROM users WHERE mis_user_id IS NOT NULL",
      { type: QueryTypes.SELECT },
    )) as any[];
    const plan = plannedStatuses(local, byMis);
    const removedAfter = local.filter((u) => !byMis.has(Number(u.mis_user_id))).length;
    if (local.length && removedAfter / local.length > maxRemovedRatio()) {
      const line =
        `refused: ${removedAfter} of ${local.length} linked users missing from MIS ` +
        `(> ${Math.round(maxRemovedRatio() * 100)}%); nothing changed`;
      warn(line);
      await recordRun(false, now.getTime(), line, JOB_NAME);
      return { ...empty, people: byMis.size, linked: local.length, skipped: "too many removed" };
    }
    const changed = await applyPlan(plan);
    const finalStatus = (u: any) => byMis.get(Number(u.mis_user_id)) ?? REMOVED;
    const summary: SweepSummary = {
      ok: true,
      people: byMis.size,
      linked: local.length,
      changed,
      inactive: local.filter((u) => ![ACTIVE, REMOVED].includes(finalStatus(u))).length,
      removed: removedAfter,
    };
    const line =
      `${summary.people} MIS people, ${summary.linked} linked users: ${summary.changed} changed, ` +
      `${summary.inactive} inactive, ${summary.removed} removed`;
    log(line);
    await recordRun(true, now.getTime(), line, JOB_NAME);
    return summary;
  } catch (err) {
    warn("sweep failed", err);
    await recordRun(false, now.getTime(), `failed: ${(err as any)?.message ?? err}`, JOB_NAME);
    return { ...empty, skipped: "error" };
  } finally {
    running = false;
  }
}

/**
 * Re-read one MIS user's status (after a back-channel logout -- MIS sends
 * one when an account is disabled) and store it on their local rows.
 * Returns the status written, or null when MIS could not be asked. Never throws.
 */
export async function recheckMisStatus(misUserId: number | string): Promise<string | null> {
  const id = Number(misUserId);
  if (!Number.isInteger(id) || id <= 0) return null;
  if (misStatusSweepDisabledReason()) return null;
  try {
    const res = await misServiceCall("GET", `/integrations/sync/people?limit=1&cursor=${id - 1}`);
    if (res.status < 200 || res.status >= 300) throw new Error(`MIS people refused (HTTP ${res.status})`);
    const users: any[] = res.body?.data?.users ?? [];
    const hit = users.find((u) => Number(u?.id ?? u?.user_id) === id);
    const status = hit ? normalizeStatus(hit.status) ?? ACTIVE : REMOVED;
    await User.update({ mis_status: status } as any, {
      where: { mis_user_id: id } as any,
      hooks: false,
      silent: true,
    } as any);
    if (status !== ACTIVE) log(`MIS user ${id} is ${status}`);
    return status;
  } catch (err) {
    warn(`re-check of MIS user ${id} failed`, err);
    return null;
  }
}

// ── Schedule ─────────────────────────────────────────────────────────────

let timers: NodeJS.Timeout[] = [];

/** Called once from server start. */
export function startMisStatusSweepSchedule(): void {
  const off = misStatusSweepDisabledReason();
  if (off) {
    log(`MIS status sweep off (${off})`);
    return;
  }
  stopMisStatusSweepSchedule();
  const at = parseRunAt(process.env.MIS_STATUS_SWEEP_AT || "02:30");

  const boot = setTimeout(() => {
    void (async () => {
      const last = await getLastSuccess(JOB_NAME);
      if (last == null || Date.now() - last > STALE_AFTER_MS) await runMisStatusSweep();
    })().catch((err) => warn("boot run failed", err));
  }, BOOT_DELAY_MS);
  boot.unref?.();

  const scheduleDaily = () => {
    const wait = Math.max(1000, nextRunAt(new Date(), at).getTime() - Date.now());
    const t = setTimeout(() => {
      void runMisStatusSweep()
        .catch((err) => warn("daily run failed", err))
        .finally(scheduleDaily);
    }, wait);
    t.unref?.();
    timers = [boot, t];
  };
  timers = [boot];
  scheduleDaily();
}

export function stopMisStatusSweepSchedule(): void {
  for (const t of timers) clearTimeout(t);
  timers = [];
}

import { Request, Response } from "express";
import { QueryTypes } from "sequelize";
import {
  AccessSnapshot,
  decide,
  Decision,
  Depth,
  Target,
} from "../vendor/nga-access";
import { sequelize } from "../config/database";
import { getMisToken } from "../utils/misUtils";
import { accessMode } from "./mode";
import { getSnapshot } from "./snapshot";
import { TM_MANIFEST } from "./manifest";

/**
 * Task Mentor's side of the v2 decision (ACCESS_LEVELS_RBAC_IMPLEMENTATION_PLAN
 * §7, §13). Everything here is mode-aware:
 *
 *   off      -> the legacy answer, untouched; no MIS call, no DB write
 *   shadow   -> the legacy answer; v2 is evaluated in the background and a
 *               disagreement is counted in access_shadow_diffs (throttled).
 *               A missing snapshot skips the comparison silently.
 *   enforce  -> the v2 answer; no usable snapshot = deny (fail closed)
 */

// ---------------------------------------------------------------------------
// Snapshot for a request
// ---------------------------------------------------------------------------

/** The requester's snapshot (memoised on req), or null when unavailable. */
export async function requestSnapshot(req: Request): Promise<AccessSnapshot | null> {
  const r = req as any;
  if (r.accessSnapshot !== undefined) return r.accessSnapshot;
  const snap = await getSnapshot({
    misUserId: r.user?.mis_user_id,
    misToken: getMisToken(req, { quiet: true }) || null,
  });
  r.accessSnapshot = snap;
  return snap;
}

/** Capability keys with at least one grant entry ("held anywhere"). */
export function heldCapabilities(snapshot: AccessSnapshot | null | undefined): Set<string> {
  const out = new Set<string>();
  for (const [key, entries] of Object.entries(snapshot?.caps ?? {})) {
    if (Array.isArray(entries) && entries.length > 0) out.add(key);
  }
  return out;
}

/** A minimum depth only means something for READ capabilities (WRITE ones have none). */
export function depthFor(cap: string, minDepth?: Depth | null): Depth | null {
  const def = (TM_MANIFEST.capabilities as Record<string, { kind: string }>)[cap];
  return def?.kind === "READ" ? minDepth ?? null : null;
}

/** Any-of decision over several capabilities; the deepest covering one wins. */
export function decideAny(
  snapshot: AccessSnapshot | null | undefined,
  caps: string[],
  target?: Target | null,
  minDepth?: Depth | null,
): Decision {
  let best: Decision = { allowed: false, depth: null, via: [] };
  const rank = (d: Depth | null) => (d ? ["summary", "detail", "sensitive"].indexOf(d) + 1 : 0);
  for (const cap of caps) {
    const d = decide(snapshot, cap, target, depthFor(cap, minDepth));
    if (d.allowed && (!best.allowed || rank(d.depth) > rank(best.depth))) best = d;
  }
  return best;
}

/** 503 when the check could not be made (enforce, MIS gone), else 403. */
export function denyResponse(req: Request, res: Response, message = "Not authorized to access this resource") {
  if ((req as any).accessUnavailable) {
    return res.status(503).json({ success: false, message: "Access check unavailable -- please try again shortly" });
  }
  return res.status(403).json({ success: false, message });
}

// ---------------------------------------------------------------------------
// Shadow-diff recording
// ---------------------------------------------------------------------------

const DIFF_THROTTLE_MS = 60_000;
const recentDiffs = new Map<string, number>();
const pending = new Set<Promise<unknown>>();

export const routeOf = (req: Request) =>
  `${req.method} ${((req.baseUrl || "") + ((req as any).route?.path || req.path || "")) || "?"}`.slice(0, 190);

/** Run shadow work off the request path; never throws. Tests await flushShadowWork(). */
export function runInBackground(work: () => Promise<unknown>) {
  const p = work().catch((err) => {
    if (process.env.NODE_ENV !== "test") {
      console.warn(`[access] shadow comparison failed: ${err?.message ?? err}`);
    }
  });
  pending.add(p);
  p.finally(() => pending.delete(p));
}

export async function flushShadowWork() {
  while (pending.size > 0) await Promise.all([...pending]);
}

/** Until when to skip writes because migration 20260927120100 is not applied. */
let tableMissingUntil = 0;

export function __resetShadowThrottle() {
  recentDiffs.clear();
  tableMissingUntil = 0;
}

export interface ShadowDiff {
  userId: number;
  misUserId?: number | null;
  capability: string;
  route: string;
  legacyAllowed: boolean;
  v2: Pick<Decision, "allowed" | "depth">;
  target?: unknown;
}

/** Count a legacy/v2 disagreement (throttled per key; never throws). */
export async function recordShadowDiff(entry: ShadowDiff): Promise<void> {
  const capability = entry.capability.slice(0, 120);
  const key = `${entry.userId}|${capability}|${entry.route}|${entry.legacyAllowed}|${entry.v2.allowed}`;
  const last = recentDiffs.get(key) ?? 0;
  if (Date.now() - last < DIFF_THROTTLE_MS || Date.now() < tableMissingUntil) return;
  if (recentDiffs.size > 5000) recentDiffs.clear();
  recentDiffs.set(key, Date.now());
  try {
    await sequelize.query(
      `INSERT INTO access_shadow_diffs
         (user_id, mis_user_id, capability, route, legacy_allowed, v2_allowed, v2_depth, sample_target, hits, first_seen, last_seen)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE hits = hits + 1, last_seen = CURRENT_TIMESTAMP,
         v2_depth = VALUES(v2_depth), sample_target = VALUES(sample_target)`,
      {
        replacements: [
          entry.userId,
          entry.misUserId ?? null,
          capability,
          entry.route.slice(0, 190),
          entry.legacyAllowed ? 1 : 0,
          entry.v2.allowed ? 1 : 0,
          entry.v2.depth ?? null,
          entry.target == null ? null : JSON.stringify(entry.target).slice(0, 500),
        ],
        type: QueryTypes.INSERT,
      },
    );
  } catch (err: any) {
    const missing = /ER_NO_SUCH_TABLE|doesn't exist/i.test(`${err?.original?.code ?? ""} ${err?.message ?? ""}`);
    if (missing) tableMissingUntil = Date.now() + 5 * 60 * 1000;
    if (process.env.NODE_ENV !== "test") {
      console.warn(
        missing
          ? "[access] access_shadow_diffs is missing (run the migrations); shadow diffs paused for 5 min"
          : `[access] shadow diff not recorded: ${err?.message ?? err}`,
      );
    }
  }
}

const diffFor = (req: Request, capability: string, legacyAllowed: boolean, v2: Pick<Decision, "allowed" | "depth">, target?: unknown): ShadowDiff => ({
  userId: Number((req as any).user?.id),
  misUserId: (req as any).user?.mis_user_id ?? null,
  capability,
  route: routeOf(req),
  legacyAllowed,
  v2,
  target,
});

// ---------------------------------------------------------------------------
// Route guards (authorizePermission & co.) -- "held anywhere" semantics
// ---------------------------------------------------------------------------

/**
 * Shadow comparison for a legacy route guard. Legacy permissions are global
 * ("holds the key"), so v2 is asked the same question with no target
 * ("holds the capability anywhere"), like the MIS's shadowCompareLegacy.
 * Returns immediately; the comparison runs in the background.
 */
export function shadowCompareGuard(
  req: Request,
  caps: string[],
  semantics: "any" | "all",
  legacyAllowed: boolean,
  opts: { selfPasses?: boolean } = {},
) {
  if (accessMode() !== "shadow" || !(req as any).user?.id || caps.length === 0) return;
  runInBackground(async () => {
    const snap = await requestSnapshot(req);
    if (!snap) return;
    const held = heldCapabilities(snap);
    const v2Caps = semantics === "any" ? caps.some((c) => held.has(c)) : caps.every((c) => held.has(c));
    const v2Allowed = Boolean(opts.selfPasses) || v2Caps;
    if (v2Allowed !== legacyAllowed) {
      await recordShadowDiff(
        diffFor(req, caps.join(semantics === "any" ? "|" : "&"), legacyAllowed, { allowed: v2Allowed, depth: null }),
      );
    }
  });
}

/**
 * Under enforce, `protect` swaps req.user.permissions for the capabilities
 * the snapshot grants anywhere (legacy set kept as req.user.legacyPermissions),
 * so every existing `permissions.has(...)` -- route guards and controller
 * checks alike -- is decided by v2. No snapshot = empty set + 503 on denial.
 */
export async function applyEnforcedPermissions(req: Request): Promise<void> {
  if (accessMode() !== "enforce" || !(req as any).user) return;
  const user = (req as any).user;
  const snap = await requestSnapshot(req);
  user.legacyPermissions = user.permissions;
  if (snap) {
    user.permissions = heldCapabilities(snap);
    (req as any).accessUnavailable = false;
  } else {
    user.permissions = new Set<string>();
    (req as any).accessUnavailable = true;
  }
}

// ---------------------------------------------------------------------------
// Scoped (target-aware) checks for controllers
// ---------------------------------------------------------------------------

export interface ScopedCheck {
  /** any-of */
  caps: string | string[];
  /** every one of these must also allow (e.g. approve AND publish) */
  alsoRequire?: string[];
  /**
   * the record the action is about; may call MIS (only evaluated when
   * needed). An array means "any of these targets" (e.g. any subject on a card).
   */
  target: TargetSpec | (() => Promise<TargetSpec> | TargetSpec);
  minDepth?: Depth | null;
  /** what the existing (legacy) code decided */
  legacy: boolean;
  /** label for the diff row; default caps joined */
  label?: string;
}

export type TargetSpec = Target | Target[] | null;

const resolveTarget = async (t: ScopedCheck["target"]): Promise<TargetSpec> =>
  typeof t === "function" ? await t() : t;

function evaluateOne(snap: AccessSnapshot | null, check: ScopedCheck, target: Target | null): Decision {
  const caps = Array.isArray(check.caps) ? check.caps : [check.caps];
  const d = decideAny(snap, caps, target, check.minDepth ?? null);
  if (!d.allowed || !check.alsoRequire?.length) return d;
  for (const cap of check.alsoRequire) {
    if (!decide(snap, cap, target, depthFor(cap, check.minDepth)).allowed) return { allowed: false, depth: null, via: [] };
  }
  return d;
}

function evaluate(snap: AccessSnapshot | null, check: ScopedCheck, target: TargetSpec): Decision {
  if (!Array.isArray(target)) return evaluateOne(snap, check, target);
  for (const t of target) {
    const d = evaluateOne(snap, check, t);
    if (d.allowed) return d;
  }
  return { allowed: false, depth: null, via: [] };
}

/**
 * Is the action on this target allowed? off/shadow return `check.legacy`
 * (shadow compares in the background); enforce returns the v2 decision.
 */
export async function scopedAllow(req: Request, check: ScopedCheck): Promise<boolean> {
  const mode = accessMode();
  const label = check.label ?? [(Array.isArray(check.caps) ? check.caps.join("|") : check.caps), ...(check.alsoRequire ?? [])].join("&");
  if (mode === "off") return check.legacy;
  if (mode === "shadow") {
    if ((req as any).user?.id) {
      runInBackground(async () => {
        const snap = await requestSnapshot(req);
        if (!snap) return;
        const target = await resolveTarget(check.target);
        const v2 = evaluate(snap, check, target);
        if (v2.allowed !== check.legacy) await recordShadowDiff(diffFor(req, label, check.legacy, v2, target));
      });
    }
    return check.legacy;
  }
  const snap = await requestSnapshot(req);
  if (!snap) {
    (req as any).accessUnavailable = true;
    return false;
  }
  try {
    return evaluate(snap, check, await resolveTarget(check.target)).allowed;
  } catch {
    return false;
  }
}

/** The v2 depth at a target (enforce/shadow helpers); null if none/unavailable. */
export async function depthAtTarget(req: Request, caps: string[], target: Target | null): Promise<Depth | null> {
  const snap = await requestSnapshot(req);
  return decideAny(snap, caps, target).depth;
}

/** Memoise a (possibly MIS-calling) target resolver for use by several checks. */
export function once<T>(fn: () => Promise<T>): () => Promise<T> {
  let p: Promise<T> | null = null;
  return () => (p ??= fn());
}

/**
 * Filter a list of ids (e.g. students) down to those v2 allows. off/shadow
 * return `ids` unchanged (shadow records one diff row when v2 would drop
 * some); enforce returns only the allowed ones. `allowedOf` gets the snapshot
 * and returns the allowed subset (may call MIS).
 */
export async function scopedFilter<T>(
  req: Request,
  ids: T[],
  label: string,
  allowedOf: (snap: AccessSnapshot) => Promise<T[]>,
): Promise<T[]> {
  const mode = accessMode();
  if (mode === "off") return ids;
  if (mode === "shadow") {
    if ((req as any).user?.id && ids.length > 0) {
      runInBackground(async () => {
        const snap = await requestSnapshot(req);
        if (!snap) return;
        const allowed = new Set(await allowedOf(snap));
        const dropped = ids.filter((i) => !allowed.has(i));
        if (dropped.length > 0) {
          await recordShadowDiff(diffFor(req, label, true, { allowed: false, depth: null }, { dropped: dropped.slice(0, 50), of: ids.length }));
        }
      });
    }
    return ids;
  }
  const snap = await requestSnapshot(req);
  if (!snap) {
    (req as any).accessUnavailable = true;
    return [];
  }
  try {
    const allowed = new Set(await allowedOf(snap));
    return ids.filter((i) => allowed.has(i));
  } catch {
    return [];
  }
}

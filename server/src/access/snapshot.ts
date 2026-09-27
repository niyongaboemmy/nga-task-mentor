import type { AccessSnapshot } from "../vendor/nga-access";
import { fetchSnapshotFromMis, SnapshotFetchError } from "./misClient";

/**
 * Per-user cache of the MIS access snapshot (packages/access/README.md §4-5).
 *
 *  - Keyed by MIS user id; each entry remembers the snapshot's `v`
 *    (User.access_version). verifyMisSession feeds the `access_version` it
 *    sees from MIS /auth/verify into noteAccessVersion(): a different value
 *    marks the entry stale and the next request re-fetches.
 *  - A backstop refresh after REFRESH_MS, for users who never poll /verify.
 *  - MIS unreachable / 503 (v2 not installed): the last good snapshot is used
 *    for up to 24 h after it was fetched, then we fail closed (unavailable).
 *    Failures are remembered for RETRY_MS so a down MIS is not hammered.
 *  - Concurrent misses for one user share one request.
 */

export const LAST_GOOD_MS = 24 * 60 * 60 * 1000;
const REFRESH_MS = 10 * 60 * 1000;
const RETRY_MS = 30 * 1000;
/** MIS answered 503 (access v2 not installed there): back off longer. */
const RETRY_NOT_INSTALLED_MS = 5 * 60 * 1000;
const MAX_ENTRIES = 5000;

interface Entry {
  snapshot: AccessSnapshot | null;
  /** when `snapshot` was fetched */
  fetchedAt: number;
  /** access_version reported by /auth/verify is newer than the snapshot */
  stale: boolean;
  /** last failed fetch (0 = none since the last success) */
  failedAt: number;
  /** how long to wait after failedAt before trying MIS again */
  retryMs: number;
}

const cache = new Map<number, Entry>();
const inflight = new Map<number, Promise<AccessSnapshot | null>>();

/** Injection point for tests (and nothing else). */
let fetcher: (misToken: string) => Promise<AccessSnapshot> = fetchSnapshotFromMis;
export function __setSnapshotFetcher(fn: typeof fetcher | null) {
  fetcher = fn ?? fetchSnapshotFromMis;
}

export function clearSnapshotCache() {
  cache.clear();
  inflight.clear();
}

/** Called with MIS /auth/verify's data.access_version. */
export function noteAccessVersion(misUserId: number | null | undefined, version: unknown) {
  if (!misUserId || typeof version !== "number") return;
  const entry = cache.get(misUserId);
  if (entry?.snapshot && entry.snapshot.v !== version) entry.stale = true;
}

export interface GetSnapshotOptions {
  misUserId: number | null | undefined;
  misToken: string | null | undefined;
  now?: number;
}

const usable = (e: Entry, now: number) => e.snapshot !== null && now - e.fetchedAt < LAST_GOOD_MS;

/**
 * The user's snapshot, or null when there is none we may use (no MIS
 * identity/token, MIS never answered, or the last good one is > 24 h old).
 * Never throws.
 */
export async function getSnapshot(opts: GetSnapshotOptions): Promise<AccessSnapshot | null> {
  const misUserId = Number(opts.misUserId);
  if (!Number.isInteger(misUserId) || misUserId <= 0) return null;
  const now = opts.now ?? Date.now();
  const entry = cache.get(misUserId);

  const fresh = entry && entry.snapshot && !entry.stale && now - entry.fetchedAt < REFRESH_MS;
  if (fresh) return entry!.snapshot;

  // Recently failed: don't retry yet; serve last-good (<= 24h) or nothing.
  if (entry && entry.failedAt && now - entry.failedAt < entry.retryMs) {
    return usable(entry, now) ? entry.snapshot : null;
  }
  if (!opts.misToken) return entry && usable(entry, now) ? entry.snapshot : null;

  const pending = inflight.get(misUserId);
  if (pending) return pending;

  const p = (async () => {
    try {
      const snap = await fetcher(opts.misToken!);
      if (snap.user?.id != null && Number(snap.user.id) !== misUserId) {
        // The MIS token belongs to someone else than this session's user.
        throw new SnapshotFetchError("snapshot user does not match the session", null);
      }
      if (cache.size >= MAX_ENTRIES && !cache.has(misUserId)) cache.clear();
      cache.set(misUserId, { snapshot: snap, fetchedAt: now, stale: false, failedAt: 0, retryMs: 0 });
      return snap;
    } catch (err: any) {
      const prev = cache.get(misUserId);
      cache.set(misUserId, {
        snapshot: prev?.snapshot ?? null,
        fetchedAt: prev?.fetchedAt ?? 0,
        stale: prev?.stale ?? false,
        failedAt: now,
        retryMs: err?.status === 503 ? RETRY_NOT_INSTALLED_MS : RETRY_MS,
      });
      if (process.env.NODE_ENV !== "test") {
        console.warn(`[access] snapshot unavailable for MIS user ${misUserId}: ${err?.message ?? err}`);
      }
      const e = cache.get(misUserId)!;
      return usable(e, now) ? e.snapshot : null;
    } finally {
      inflight.delete(misUserId);
    }
  })();
  inflight.set(misUserId, p);
  return p;
}

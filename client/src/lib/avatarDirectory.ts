import { useEffect, useSyncExternalStore } from "react";
import api from "../utils/axiosConfig";

/**
 * Everyone's profile photo, by Task Mentor user id or MIS user id.
 *
 * A <UserAvatar userId|misUserId> asks here; every id asked for during one render is
 * sent as a single POST /users/avatars/lookup and the answers are kept for the session
 * (no photo is remembered as null). Values are an absolute NGA MIS link or a legacy
 * Task Mentor filename -- getProfileImageUrl() turns either into a URL.
 */
type Key = `u:${number}` | `m:${number}`;

const BATCH = 500;
const FLUSH_DELAY_MS = 16;

const cache = new Map<Key, string | null>();
const queued = new Set<Key>();
const inFlight = new Set<Key>();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;

const emit = () => listeners.forEach((l) => l());
const valid = (id: unknown): id is number => typeof id === "number" && Number.isSafeInteger(id) && id > 0;
export const keyFor = (opts: { userId?: number | null; misUserId?: number | null }): Key | null =>
  valid(opts.userId) ? `u:${opts.userId}` : valid(opts.misUserId) ? `m:${opts.misUserId}` : null;

async function flush() {
  timer = null;
  const keys = [...queued];
  queued.clear();
  for (let i = 0; i < keys.length; i += BATCH) {
    const chunk = keys.slice(i, i + BATCH);
    chunk.forEach((k) => inFlight.add(k));
    const user_ids = chunk.filter((k) => k.startsWith("u:")).map((k) => Number(k.slice(2)));
    const mis_user_ids = chunk.filter((k) => k.startsWith("m:")).map((k) => Number(k.slice(2)));
    try {
      const res = await api.post("/users/avatars/lookup", { user_ids, mis_user_ids });
      const byUser: Record<string, string> = res.data?.data?.by_user ?? {};
      const byMis: Record<string, string> = res.data?.data?.by_mis ?? {};
      chunk.forEach((k) => {
        const id = k.slice(2);
        cache.set(k, (k.startsWith("u:") ? byUser[id] : byMis[id]) ?? null);
      });
    } catch {
      // Initials are a fine fallback; don't retry on every render.
      chunk.forEach((k) => cache.set(k, null));
    } finally {
      chunk.forEach((k) => inFlight.delete(k));
    }
  }
  emit();
}

export function requestAvatar(key: Key | null) {
  if (!key || cache.has(key) || queued.has(key) || inFlight.has(key)) return;
  queued.add(key);
  if (!timer) timer = setTimeout(flush, FLUSH_DELAY_MS);
}

/** Record a photo already known (e.g. your own after sign-in). */
export function primeAvatar(key: Key | null, value: string | null | undefined) {
  if (!key || value === undefined || cache.get(key) === value) return;
  cache.set(key, value);
  emit();
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** undefined while unknown, null when the person has no photo. */
export function useLookedUpAvatar(key: Key | null): string | null | undefined {
  const snapshot = useSyncExternalStore(subscribe, () => (key ? cache.get(key) : undefined));
  useEffect(() => requestAvatar(key), [key]);
  return snapshot;
}

export function _resetAvatarDirectoryForTests() {
  cache.clear();
  queued.clear();
  inFlight.clear();
  if (timer) clearTimeout(timer);
  timer = null;
}

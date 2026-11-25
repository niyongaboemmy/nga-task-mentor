/**
 * Browser storage keyed by (school, person) -- TENANT_SWITCHING_PLAN.md §4.7.3.
 *
 * Local user ids repeat across schools, and one browser can sign in to
 * another school (or as another person) at any time, so every key that holds
 * someone's data goes through `storageKey(base)` -> `${base}.t${tid}.u${uid}`.
 * The identity comes from the stored Task Mentor session token (its `tid` and
 * `id` claims), so no React state is needed to read it.
 *
 * Keys written before this existed carry no suffix. `reconcileStorageIdentity`
 * runs whenever a session is established and removes them: nothing in an
 * unscoped key says whose it is, and the first person to sign in on a shared
 * browser is not necessarily the one who wrote it (WEB-ISO-3). The one
 * exception is a legacy key that itself names the user (`...u<uid>` at the
 * end, written before tenancy, so school 1): it is adopted by that user.
 */

export interface StorageIdentity {
  tid: number;
  uid: number;
}

const IDENTITY_KEY = "tm.storage.identity";

/** Prefixes / exact keys of personal data stored before keying existed. */
export const LEGACY_PERSONAL_PREFIXES = [
  "quiz_",
  "tm:marks-draft:",
  "tm.grading.draft.",
  "tm.grading.openedInTmcode",
  "tm.grading.snippets",
  "tm.rank.ack",
  // TM-ISO-6 / WEB-ISO-4: keyed by storageKey() since 2026-11-25.
  "tm.playground.",
  "tm.grading.runCases.",
  "countdown_",
  "tm.aiGenerator.prefs",
];

/** The user id an unscoped legacy key names itself (`...[._:-]u<uid>`), or null. */
export function legacyKeyUid(key: string): number | null {
  const m = /[._:-]u(\d+)$/.exec(key);
  const n = m ? Number(m[1]) : NaN;
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

const SCOPED_SUFFIX = /\.t\d+\.u\d+$/;

const safe = <T,>(fn: () => T, fallback: T): T => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};

/** The (unverified) claims of a JWT, or null. */
export function decodeJwtClaims(token: string | null | undefined): Record<string, unknown> | null {
  if (!token) return null;
  const part = String(token).replace(/^Bearer /i, "").split(".")[1];
  if (!part) return null;
  try {
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=");
    const json = decodeURIComponent(
      Array.from(atob(b64), (c) => `%${c.charCodeAt(0).toString(16).padStart(2, "0")}`).join(""),
    );
    const claims = JSON.parse(json);
    return claims && typeof claims === "object" ? claims : null;
  } catch {
    return null;
  }
}

const posInt = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
};

/**
 * The identity of a Task Mentor session token. A token minted before tenancy
 * has no `tid`: it belongs to school 1 (the server's legacy default).
 */
export function identityFromToken(token: string | null | undefined): StorageIdentity | null {
  const claims = decodeJwtClaims(token);
  const uid = posInt(claims?.id);
  if (!claims || !uid) return null;
  return { tid: posInt(claims.tid) ?? 1, uid };
}

export function currentIdentity(): StorageIdentity | null {
  return identityFromToken(safe(() => localStorage.getItem("tm_auth_token"), null));
}

/** `${base}.t${tid}.u${uid}` for the signed-in identity (`${base}.anon` when signed out). */
export function storageKey(base: string, identity: StorageIdentity | null = currentIdentity()): string {
  return identity ? `${base}.t${identity.tid}.u${identity.uid}` : `${base}.anon`;
}

const isLegacyPersonalKey = (key: string) =>
  !SCOPED_SUFFIX.test(key) && !key.endsWith(".anon") && LEGACY_PERSONAL_PREFIXES.some((p) => key.startsWith(p));

function legacyKeys(store: Storage): string[] {
  const out: string[] = [];
  for (let i = 0; i < store.length; i++) {
    const k = store.key(i);
    if (k && isLegacyPersonalKey(k)) out.push(k);
  }
  return out;
}

/** Remove every unscoped personal key (and anything signed-out). */
export function clearUnscopedPersonalKeys(store: Storage = localStorage): void {
  safe(() => {
    for (const k of legacyKeys(store)) store.removeItem(k);
    for (let i = store.length - 1; i >= 0; i--) {
      const k = store.key(i);
      if (k && k.endsWith(".anon") && LEGACY_PERSONAL_PREFIXES.some((p) => k.startsWith(p))) store.removeItem(k);
    }
  }, undefined);
}

/**
 * Call when a session is (re)established. Returns what happened, for tests:
 *  - "first":   no identity recorded before; legacy keys were removed, except
 *               those that name this very user (school 1), which it keeps
 *  - "same":    nothing to do
 *  - "changed": another school/person than last time; legacy keys removed
 */
export function reconcileStorageIdentity(
  identity: StorageIdentity | null = currentIdentity(),
  store: Storage = localStorage,
): "first" | "same" | "changed" | "none" {
  if (!identity) return "none";
  return safe(() => {
    const raw = store.getItem(IDENTITY_KEY);
    const tag = `${identity.tid}:${identity.uid}`;
    if (raw === tag) return "same" as const;
    if (!raw) {
      for (const k of legacyKeys(store)) {
        const v = store.getItem(k);
        const own = identity.tid === 1 && legacyKeyUid(k) === identity.uid;
        const target = storageKey(k, identity);
        if (own && v !== null && store.getItem(target) === null) store.setItem(target, v);
        store.removeItem(k);
      }
      store.setItem(IDENTITY_KEY, tag);
      return "first" as const;
    }
    clearUnscopedPersonalKeys(store);
    store.setItem(IDENTITY_KEY, tag);
    return "changed" as const;
  }, "none" as const);
}

import axios from "axios";
import { Op } from "sequelize";
import { User } from "../models/User.model";
import { clientBasicAuth } from "../access/misClient";

/**
 * The profile picture lives in NGA MIS (one picture for every NGA app). Task Mentor
 * keeps the MIS link in users.profile_image, so every existing place that shows a
 * profile_image (top bar, submissions, rankings, TMCode...) shows the central picture.
 *
 *  - MIS links are absolute (https://api.amashuri.com/avatars/...); a bare filename is
 *    a legacy Task Mentor upload, still served from /users/profile-picture/.
 *  - The link is refreshed whenever MIS is asked about the user anyway: sign-in,
 *    GET /auth/me and the minute-by-minute /auth/verify-mis poll.
 *  - Pictures are changed in MIS only (its profile page); this app has no upload.
 */

export const isMisAvatarUrl = (value: string | null | undefined): boolean =>
  !!value && /^https?:\/\//i.test(value);

/**
 * The 256 px picture MIS reports in a /users/me, /auth/verify or /sso/token payload.
 * undefined = this payload says nothing about pictures (an older MIS): leave ours alone.
 */
export function misAvatarFrom(data: any): string | null | undefined {
  if (!data || typeof data !== "object") return undefined;
  if (data.avatar !== undefined) return data.avatar?.md ?? null;
  if (data.user && data.user.avatar_url !== undefined) return data.user.avatar_url ?? null;
  return undefined;
}

/**
 * Points the local user at MIS's picture. A MIS "no picture" clears a MIS link but
 * keeps a legacy Task Mentor upload, so nobody loses a photo they set here before the
 * picture moved to MIS. Returns whether the row changed.
 */
export async function applyMisAvatar(user: User | null | undefined, url: string | null | undefined): Promise<boolean> {
  if (!user || url === undefined) return false;
  const current = user.profile_image ?? null;
  let next: string | null = current;
  if (url) next = url;
  else if (isMisAvatarUrl(current)) next = null;
  if (next === current) return false;
  user.profile_image = next;
  await user.save();
  return true;
}

/**
 * The profile cover (wide banner) MIS reports, as its large link. Not stored here: it is
 * only shown on the profile page, which reads it fresh from MIS via GET /auth/me.
 * null = none (the page uses the system blue); undefined = this payload is silent.
 */
export function misCoverFrom(data: any): string | null | undefined {
  if (!data || typeof data !== "object") return undefined;
  const valid = (u: unknown) => (typeof u === "string" && /^https?:\/\//i.test(u) ? u : null);
  if (data.cover !== undefined) return data.cover ? valid(data.cover.lg) : null;
  if (data.user && data.user.cover_url !== undefined) return valid(data.user.cover_url);
  return undefined;
}

/* ------------------------------------------------------------------ *
 * Everyone else's photo
 *
 * Sign-in and the verify-mis poll only refresh the person using Task Mentor. Lists
 * (students, submissions, rankings...) need everyone's current photo, so:
 *  - misAvatarsFor() asks MIS for many people at once (POST /users/profile-media/lookup,
 *    this app's SSO client credentials), cached for a few minutes;
 *  - lookupAvatars() answers the client's batched POST /api/users/avatars/lookup;
 *  - startAvatarSync() refreshes users.profile_image for everyone every 15 minutes, so
 *    screens that already render profile_image stay current too.
 * ------------------------------------------------------------------ */

const CACHE_TTL_MS = 5 * 60_000;
const MIS_BATCH = 1000;
const avatarCache = new Map<number, { url: string | null; at: number }>();

type MediaTransport = (misIds: number[]) => Promise<Array<{ user_id: number; avatar?: { md?: string } | null }>>;

const defaultTransport: MediaTransport = async (misIds) => {
  const auth = clientBasicAuth();
  if (!auth) throw new Error("SSO_CLIENT_ID / SSO_CLIENT_SECRET are not set");
  const base = (process.env.NGA_MIS_BASE_URL || "").replace(/\/+$/, "");
  const res = await axios.post(
    `${base}/users/profile-media/lookup`,
    { user_ids: misIds },
    { headers: { Authorization: auth }, timeout: 8000 },
  );
  return res.data?.data?.users ?? [];
};
let mediaTransport: MediaTransport = defaultTransport;

/** Tests swap the MIS call out. */
export function _setMediaTransportForTests(fn: MediaTransport | null) {
  mediaTransport = fn ?? defaultTransport;
  avatarCache.clear();
}

const httpUrl = (u: unknown): string | null => (typeof u === "string" && /^https?:\/\//i.test(u) ? u : null);

/** MIS user id -> 256 px photo link (null = none). Unknown to MIS = absent. */
export async function misAvatarsFor(misIds: number[], opts: { fresh?: boolean; now?: number } = {}) {
  const now = opts.now ?? Date.now();
  const out = new Map<number, string | null>();
  const missing: number[] = [];
  for (const id of new Set(misIds.filter((n) => Number.isSafeInteger(n) && n > 0))) {
    const hit = avatarCache.get(id);
    if (!opts.fresh && hit && now - hit.at < CACHE_TTL_MS) out.set(id, hit.url);
    else missing.push(id);
  }
  for (let i = 0; i < missing.length; i += MIS_BATCH) {
    const chunk = missing.slice(i, i + MIS_BATCH);
    const users = await mediaTransport(chunk);
    for (const u of users) {
      const url = u.avatar ? httpUrl(u.avatar.md) : null;
      avatarCache.set(Number(u.user_id), { url, at: now });
      out.set(Number(u.user_id), url);
    }
  }
  return out;
}

const LOOKUP_MAX = 1000;
const ids = (raw: unknown): number[] =>
  Array.isArray(raw) ? Array.from(new Set(raw.map(Number))).filter((n) => Number.isSafeInteger(n) && n > 0) : [];

/**
 * Photos for a page of people, by Task Mentor user id and/or MIS user id (roster rows
 * for students who never opened Task Mentor only have the latter). Values are either
 * an absolute MIS link or a legacy Task Mentor filename -- the client's
 * getProfileImageUrl() handles both. People without a photo are absent.
 */
export async function lookupAvatars(body: { user_ids?: unknown; mis_user_ids?: unknown }) {
  const userIds = ids(body?.user_ids);
  const misIds = ids(body?.mis_user_ids);
  if (userIds.length + misIds.length > LOOKUP_MAX) {
    throw Object.assign(new Error(`At most ${LOOKUP_MAX} ids per request`), { status: 400 });
  }
  const local = userIds.length
    ? await User.findAll({ where: { id: userIds }, attributes: ["id", "mis_user_id", "profile_image"] })
    : [];
  let fromMis = new Map<number, string | null>();
  try {
    fromMis = await misAvatarsFor([...misIds, ...local.map((u) => Number(u.mis_user_id)).filter(Boolean)]);
  } catch (err: any) {
    // MIS unreachable: fall back to what this app last stored.
    console.warn("⚠️ MIS avatar lookup failed:", err?.message);
  }
  const by_user: Record<number, string> = {};
  const by_mis: Record<number, string> = {};
  for (const id of misIds) {
    const url = fromMis.get(id);
    if (url) by_mis[id] = url;
  }
  for (const u of local) {
    const mis = u.mis_user_id ? fromMis.get(Number(u.mis_user_id)) : undefined;
    const value = mis !== undefined ? mis ?? (isMisAvatarUrl(u.profile_image) ? null : u.profile_image ?? null) : u.profile_image ?? null;
    if (value) by_user[u.id] = value;
  }
  return { by_user, by_mis };
}

/** One refresh of every MIS-linked user's stored photo. Returns how many rows changed. */
export async function syncAllAvatars(): Promise<number> {
  const users = await User.findAll({
    where: { mis_user_id: { [Op.ne]: null } },
    attributes: ["id", "mis_user_id", "profile_image"],
  });
  const fresh = await misAvatarsFor(users.map((u) => Number(u.mis_user_id)), { fresh: true });
  let changed = 0;
  for (const u of users) {
    const url = fresh.get(Number(u.mis_user_id));
    if (url === undefined) continue; // MIS didn't answer for them: not "no photo"
    if (await applyMisAvatar(u, url)) changed++;
  }
  return changed;
}

const SYNC_EVERY_MS = 15 * 60_000;
const SYNC_BOOT_DELAY_MS = 60_000;

export function startAvatarSync() {
  if (process.env.NODE_ENV === "test" || !clientBasicAuth() || !process.env.NGA_MIS_BASE_URL) {
    console.log("[avatars] sync off (no MIS client credentials, or under test)");
    return;
  }
  const run = async () => {
    try {
      const n = await syncAllAvatars();
      if (n) console.log(`[avatars] refreshed ${n} profile photo(s) from MIS`);
    } catch (err: any) {
      console.warn("[avatars] sync failed:", err?.message);
    }
  };
  setTimeout(() => void run(), SYNC_BOOT_DELAY_MS).unref?.();
  setInterval(() => void run(), SYNC_EVERY_MS).unref?.();
}

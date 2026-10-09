import { User } from "../models/User.model";

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

import axios from "axios";
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
 *  - Uploading or removing a picture here is forwarded to MIS.
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

const misBase = () => process.env.NGA_MIS_BASE_URL;

/** PUT /users/me/avatar on MIS; MIS resizes/compresses and answers with the new links. */
export async function uploadAvatarToMis(
  misToken: string,
  file: { buffer: Buffer; originalname?: string; mimetype?: string },
  crop?: string,
): Promise<{ version: number; sm: string; md: string; lg: string }> {
  const form = new FormData();
  if (crop) form.append("crop", crop);
  form.append(
    "avatar",
    new Blob([new Uint8Array(file.buffer)], { type: file.mimetype || "application/octet-stream" }),
    file.originalname || "avatar",
  );
  const res = await axios.put(`${misBase()}/users/me/avatar`, form, {
    headers: { Authorization: `Bearer ${misToken}` },
    timeout: 60000,
    maxBodyLength: Infinity,
  });
  return res.data.data.avatar;
}

export async function removeAvatarFromMis(misToken: string): Promise<void> {
  await axios.delete(`${misBase()}/users/me/avatar`, {
    headers: { Authorization: `Bearer ${misToken}` },
    timeout: 15000,
  });
}

import React, { useEffect, useState } from "react";
import { getProfileImageUrl } from "../../utils/imageUrl";
import { keyFor, useLookedUpAvatar } from "../../lib/avatarDirectory";

/** Same colour for the same person everywhere, so initials still read as "them". */
const TINTS = [
  "bg-blue-600",
  "bg-sky-600",
  "bg-emerald-600",
  "bg-violet-600",
  "bg-rose-600",
  "bg-amber-600",
  "bg-cyan-600",
  "bg-indigo-600",
];

export function initialsOf(name: string | null | undefined): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts.length === 1 ? parts[0][0] : parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const tintFor = (seed: string) => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return TINTS[Math.abs(h) % TINTS.length];
};

export interface UserAvatarProps {
  name: string;
  /** A known photo: `profile_image` (MIS link or legacy filename) or any URL. */
  src?: string | null;
  /** Looked up (batched, cached) when `src` is empty -- a Task Mentor user id... */
  userId?: number | null;
  /** ...or an MIS user id (roster rows for people who never opened Task Mentor). */
  misUserId?: number | null;
  /** Rendered size in px. */
  size?: number;
  className?: string;
  /** People are round; "rounded" keeps a square-ish look. */
  shape?: "circle" | "rounded";
  ring?: boolean;
  /** Hidden from screen readers -- for avatars beside a visible name, so it isn't read twice. */
  decorative?: boolean;
}

/**
 * The one way Task Mentor shows a person: their NGA profile photo, else initials on a
 * stable colour. Falls back to initials if the photo fails to load.
 */
const UserAvatar: React.FC<UserAvatarProps> = ({
  name,
  src,
  userId,
  misUserId,
  size = 32,
  className = "",
  shape = "circle",
  ring = false,
  decorative = false,
}) => {
  const looked = useLookedUpAvatar(src ? null : keyFor({ userId, misUserId }));
  const url = getProfileImageUrl(src || looked || null);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);

  const box = `relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden ${
    shape === "rounded" ? "rounded-xl" : "rounded-full"
  } ${ring ? "ring-2 ring-white dark:ring-gray-900" : ""} ${className}`;
  const style = { width: size, height: size };

  if (url && !failed) {
    return (
      <span className={`${box} bg-gray-100 dark:bg-gray-800`} style={style}>
        <img
          src={url}
          alt={decorative ? "" : name}
          aria-hidden={decorative || undefined}
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      </span>
    );
  }
  return (
    <span
      {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": name })}
      className={`${box} ${tintFor(name || "?")} font-semibold text-white`}
      style={{ ...style, fontSize: Math.max(9, Math.round(size * 0.4)) }}
    >
      {initialsOf(name)}
    </span>
  );
};

export default UserAvatar;

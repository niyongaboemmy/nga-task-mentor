// Names from NGA MIS, made to fit Task Mentor's User model (1–50 characters each).
// Some MIS accounts have no last name (or a very long one); without this the user
// can't sign in at all — the SSO callback failed with a validation error.

const MAX = 50;

/** Trimmed, single-spaced, at most 50 characters; `fallback` when nothing is left. */
export function fitName(value: unknown, fallback: string): string {
  const s = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return (s || fallback).slice(0, MAX);
}

/** First and last name for a local user, from an MIS profile (email as a last resort). */
export function namesFromMis(profile: { first_name?: unknown; last_name?: unknown } | null | undefined, email?: string | null): { first_name: string; last_name: string } {
  const local = typeof email === "string" ? email.split("@")[0] : "";
  const first = fitName(profile?.first_name, fitName(local, "User"));
  return { first_name: first, last_name: fitName(profile?.last_name, "-") };
}

/**
 * How Task Mentor uses access control v2 (packages/access/README.md §7):
 *
 *   off      only the existing local-permission checks run (v2 never consulted)
 *   shadow   existing checks decide; v2 decides too and every disagreement is
 *            recorded in access_shadow_diffs. Responses never change.
 *   enforce  v2 decides (the MIS snapshot replaces the local role's permissions)
 *
 * Default: "off" under NODE_ENV=test (so existing suites behave exactly as
 * before), otherwise "shadow". Read on every call so tests can switch it.
 */
export type AccessMode = "off" | "shadow" | "enforce";

export function accessMode(): AccessMode {
  const raw = (process.env.ACCESS_V2_MODE || "").trim().toLowerCase();
  if (raw === "off" || raw === "shadow" || raw === "enforce") return raw;
  return process.env.NODE_ENV === "test" ? "off" : "shadow";
}

/**
 * NGA MIS addresses, derived from VITE_MIS_LOGIN_URL (the one MIS setting this app
 * already has) rather than a second env var.
 */
export const misHomeUrl = (): string =>
  (import.meta.env.VITE_MIS_LOGIN_URL || "https://mis.amashuri.com/login").replace(/\/login\/?$/, "");

/** Where the profile picture and cover are changed -- they are managed in MIS only. */
export const misProfileUrl = (): string => `${misHomeUrl()}/profile`;

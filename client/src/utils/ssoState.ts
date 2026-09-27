/**
 * OAuth `state` handling for the MIS single sign-on flow (login-CSRF guard).
 *
 * Login.tsx generates a random state, remembers it in sessionStorage and sends
 * it to MIS with the authorize redirect; MIS echoes it back to /sso/callback
 * with the code (nga_central_mis frontend Login.tsx -> authorizeSSO), and
 * Callback.tsx only exchanges the code if the echoed state matches.
 */
export const SSO_STATE_KEY = "tm_sso_state";

export const generateSsoState = (): string => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
};

export const buildSsoAuthorizeUrl = (opts: {
  loginUrl: string;
  clientId: string;
  redirectUri: string;
  state: string;
}): string =>
  `${opts.loginUrl}?client_id=${encodeURIComponent(opts.clientId)}` +
  `&redirect_uri=${encodeURIComponent(opts.redirectUri)}` +
  `&state=${encodeURIComponent(opts.state)}`;

export const getSsoConfig = () => {
  const clientId = import.meta.env.VITE_SSO_CLIENT_ID || "taskmentor_app";
  const loginUrl =
    import.meta.env.VITE_MIS_LOGIN_URL || "https://nga.ac.rw/mis/login";
  const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
  const redirectUri = window.location.origin + base + "/sso/callback";
  return { clientId, loginUrl, redirectUri };
};

/** Start an SP-initiated SSO login: store a fresh state and go to MIS. */
export const beginSsoLogin = (): void => {
  const state = generateSsoState();
  sessionStorage.setItem(SSO_STATE_KEY, state);
  window.location.href = buildSsoAuthorizeUrl({ ...getSsoConfig(), state });
};

/**
 * Compare the state MIS returned with the one we stored, and clear the stored
 * value either way (single use).
 *  - "valid":       we started this login and the state matches.
 *  - "mismatch":    we started a login but the returned state is missing or
 *                   different — reject.
 *  - "unsolicited": no login was started from this tab (e.g. TaskMentor was
 *                   launched from the MIS apps menu, which sends its own
 *                   state) — the code must NOT be exchanged; the caller
 *                   restarts a fresh login instead.
 */
export type SsoStateCheck = "valid" | "mismatch" | "unsolicited";

export const consumeSsoState = (returned: string | null): SsoStateCheck => {
  const expected = sessionStorage.getItem(SSO_STATE_KEY);
  sessionStorage.removeItem(SSO_STATE_KEY);
  if (!expected) return "unsolicited";
  if (!returned || returned.length !== expected.length) return "mismatch";
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ returned.charCodeAt(i);
  }
  return diff === 0 ? "valid" : "mismatch";
};

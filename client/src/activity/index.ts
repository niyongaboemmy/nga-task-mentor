import api, { API_BASE_URL } from "../utils/axiosConfig";
import { store } from "../store";
import { initActivity, endActivity, getDeviceId, track, type CatalogEntry } from "../vendor/nga-activity";
import catalog from "./tm.catalog.json";

/**
 * Platform usage analytics for Task Mentor (nga_central_mis
 * USAGE_ANALYTICS_IMPLEMENTATION_PLAN.md §5.1). The tracker posts to this app's
 * own API (/api/activity), which adds the session's MIS user id and forwards to
 * the MIS collector. Identity comes from the session token, never from the page.
 *
 * The catalog is a copy of server/src/activity/catalog.json (the source of
 * truth, published to MIS on boot): `npm run sync:activity-catalog`.
 */
const TOKEN_KEY = "tm_auth_token";

const sessionToken = (): string | null => {
  try {
    const t = localStorage.getItem(TOKEN_KEY);
    return t && t !== "null" && t !== "undefined" && t !== "none" ? t : null;
  } catch {
    return null;
  }
};

const currentUser = (): { mis_user_id?: number; user_type?: string } | null => {
  try {
    return store.getState().auth.user ?? null;
  } catch {
    return null;
  }
};

// The SPA (taskmentor.amashuri.com) and the API (taskmentor-api.amashuri.com)
// are different origins, as are the dev servers, so the request carries
// cookies explicitly, exactly like the axios client (withCredentials).
const crossOrigin = (() => {
  try {
    return new URL(API_BASE_URL, window.location.href).origin !== window.location.origin;
  } catch {
    return true;
  }
})();

const loginPath = () => (import.meta.env.BASE_URL + "/login").replace(/\/+/g, "/");

export const startActivity = () =>
  initActivity({
    app: "tm",
    endpoint: `${API_BASE_URL}/activity`,
    configUrl: `${API_BASE_URL}/activity/config`,
    credentials: crossOrigin ? "include" : "same-origin",
    authHeader: () => {
      const t = sessionToken();
      return t ? `Bearer ${t}` : null;
    },
    userKey: () => (sessionToken() ? (currentUser()?.mis_user_id ?? null) : null),
    userType: () => currentUser()?.user_type ?? null,
    release: (import.meta.env.VITE_RELEASE as string | undefined) ?? undefined,
    catalog: (catalog as { features: CatalogEntry[] }).features,
    // An administrator signed this device out (MIS Usage & Monitoring → User 360).
    // Clear the httpOnly session cookie too, or the next load would sign straight back in.
    onEndCommand: () => {
      void api
        .post("/auth/logout")
        .catch(() => undefined)
        .finally(() => {
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem("misToken");
          window.location.assign(loginPath());
        });
    },
  });

export { endActivity, getDeviceId, track };

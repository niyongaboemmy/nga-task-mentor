import {
  createActivityRelay,
  type ActivityRelay,
  type RelayOptions,
} from "../vendor/nga-activity-relay/relay";
import { misUserIdFromSession } from "./session";

/**
 * Platform usage analytics (nga_central_mis USAGE_ANALYTICS_IMPLEMENTATION_PLAN.md §5.2):
 * the browser posts its activity batches to this server (/api/activity), which
 * stamps the session's MIS user id and the real client IP and forwards them to
 * the MIS collector with this app's SSO client credentials.
 *
 * One relay per process. Without NGA_MIS_BASE_URL / SSO_CLIENT_ID /
 * SSO_CLIENT_SECRET it is a no-op: the routes answer 204 / {enabled:false}
 * and nothing is queued.
 */

// The SPA (cross-origin to taskmentor-api in production) and local dev.
const DEFAULT_ORIGINS = [
  "https://taskmentor.amashuri.com",
  "http://localhost:5174",
  "http://127.0.0.1:5174",
].join(",");

/** A relay that accepts nothing and forwards nothing (analytics not configured). */
export const disabledActivityRelay = (): ActivityRelay => ({
  handler: async (_req: any, res: any) => res.status(204).end(),
  configHandler: async (_req: any, res: any) => {
    res.set?.("Cache-Control", "no-store");
    return res.status(200).json({ enabled: false, v: 1 });
  },
  track: () => undefined,
  pushCatalog: async () => false,
  deviceIdOf: () => null,
  flush: async () => undefined,
  stop: async () => undefined,
  stats: { forwarded: 0, dropped: 0, failures: 0, lastOkAt: 0 },
  _queue: () => ({ batches: 0, serverEvents: 0 }),
});

let warnedDisabled = false;

export const buildActivityRelay = (
  env: Record<string, string | undefined> = process.env,
  overrides: Partial<RelayOptions> = {},
): ActivityRelay => {
  const misBaseUrl = env.NGA_MIS_BASE_URL?.trim();
  const clientId = env.SSO_CLIENT_ID?.trim();
  const clientSecret = env.SSO_CLIENT_SECRET?.trim();
  if (!misBaseUrl || !clientId || !clientSecret) {
    if (!warnedDisabled) {
      warnedDisabled = true;
      console.warn(
        "[activity] NGA_MIS_BASE_URL, SSO_CLIENT_ID or SSO_CLIENT_SECRET is not set: platform activity is not collected.",
      );
    }
    return disabledActivityRelay();
  }
  return createActivityRelay({
    app: "tm",
    misBaseUrl,
    clientId,
    clientSecret,
    origins: (env.ACTIVITY_ORIGINS || DEFAULT_ORIGINS)
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean),
    getUserId: misUserIdFromSession,
    ...overrides,
  });
};

// Jest runs controllers through real routes; keep their key events out of a
// live queue (and its 5 s forward timer). Tests build their own relay.
export const activityRelay: ActivityRelay =
  process.env.NODE_ENV === "test" ? disabledActivityRelay() : buildActivityRelay();

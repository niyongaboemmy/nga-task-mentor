import axios from "axios";
import { basicAuth, registrySource } from "./registry";

/**
 * Tenant fallback counter and its daily report to MIS (TENANT_SWITCHING_PLAN.md
 * Appendix A.6). Every place that falls back to school 1 (or to the legacy
 * default) because the tenant was not known counts itself here:
 *
 *  no_context      data access with no tenant context, so school 1 was used
 *  legacy_tid      a token or claims without `tid` (legacy default applied)
 *  payload_no_tid  a job, pub/sub or logout payload without `tid`
 *
 * The counts are cumulative per UTC day. They go to MIS
 * `POST /platform/tenancy/fallbacks` once at start-up and every hour, with the
 * same service credentials as the registry fetch; the report doubles as this
 * app's heartbeat, so it is sent even when every count is 0. MIS flips
 * `tenancy.strict.taskmentor` on after 7 clean days (strict.ts).
 *
 * Never throws and never crashes the app: an MIS that doesn't know the
 * endpoint yet (404) or refuses it (403) is logged at debug level only.
 */

export const FALLBACK_KINDS = ["no_context", "legacy_tid", "payload_no_tid"] as const;
export type FallbackKind = (typeof FALLBACK_KINDS)[number];

const MAX_SITES = 10;
const REPORT_EVERY_MS = 60 * 60 * 1000;

interface DayCounts {
  day: string;
  counts: Record<FallbackKind, number>;
  sites: string[];
}

const utcDay = (at: Date = new Date()) => at.toISOString().slice(0, 10);
const empty = (day: string): DayCounts => ({ day, counts: { no_context: 0, legacy_tid: 0, payload_no_tid: 0 }, sites: [] });

let current: DayCounts = empty(utcDay());
let now: () => Date = () => new Date();

function today(): DayCounts {
  const day = utcDay(now());
  if (current.day !== day) current = empty(day);
  return current;
}

/** Count one fallback. `site` is a short code label (e.g. "dbRouter"), kept up to 10 per day. */
export function countFallback(kind: FallbackKind, site?: string): void {
  try {
    const d = today();
    d.counts[kind] += 1;
    if (site) {
      const label = `${kind}:${site}`.slice(0, 80);
      if (d.sites.length < MAX_SITES && !d.sites.includes(label)) d.sites.push(label);
    }
  } catch {
    /* counting must never break the caller */
  }
}

export interface FallbackReport {
  app: "taskmentor";
  day: string;
  counts: Record<FallbackKind, number>;
  sites?: string[];
}

/** The body MIS receives: today's cumulative counts. */
export function fallbackReport(): FallbackReport {
  const d = today();
  const body: FallbackReport = { app: "taskmentor", day: d.day, counts: { ...d.counts } };
  if (d.sites.length) body.sites = d.sites.slice(0, MAX_SITES);
  return body;
}

const debug = (...args: unknown[]) => {
  if (process.env.TENANCY_DEBUG === "1" || process.env.LOG_LEVEL === "debug") console.debug(...args);
};

/**
 * Send today's report. Resolves to "sent", "skipped" (no MIS configured,
 * static registry) or "failed" -- never rejects.
 */
export async function reportFallbacks(env: NodeJS.ProcessEnv = process.env): Promise<"sent" | "skipped" | "failed"> {
  try {
    if (registrySource(env) === "static") return "skipped";
    const base = (env.NGA_MIS_BASE_URL || "").replace(/\/+$/, "");
    const auth = basicAuth(env);
    if (!base || !auth) return "skipped";
    await axios.post(`${base}/platform/tenancy/fallbacks`, fallbackReport(), {
      headers: { Authorization: auth, "Content-Type": "application/json" },
      timeout: Number(env.TENANCY_REGISTRY_TIMEOUT_MS) || 3000,
    });
    return "sent";
  } catch (err: any) {
    const status = err?.response?.status;
    debug(`[tenancy] fallback report not accepted${status ? ` (HTTP ${status})` : ""}: ${err?.message ?? err}`);
    return "failed";
  }
}

let timer: NodeJS.Timeout | null = null;

/** Report once now and then every hour. Idempotent. */
export function startFallbackReporter(): void {
  if (timer) return;
  void reportFallbacks();
  timer = setInterval(() => void reportFallbacks(), REPORT_EVERY_MS);
  timer.unref?.();
}

export function stopFallbackReporter(): void {
  if (timer) clearInterval(timer);
  timer = null;
}

/** Tests only. */
export function resetFallbacksForTests(clock?: () => Date): void {
  now = clock ?? (() => new Date());
  current = empty(utcDay(now()));
}

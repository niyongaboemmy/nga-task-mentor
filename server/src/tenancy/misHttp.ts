import axios from "axios";
import { currentTenantOrNull, TENANT_HEADER } from "../vendor/nga-tenancy";

/**
 * X-NGA-Tenant on every call to the MIS (CONTRACT.md §3).
 *
 * Task Mentor calls the MIS from ~100 places with the shared axios instance:
 * app-level calls with the SSO client's Basic credentials (status sweep,
 * early warning, reminders, competency, AI policy, avatars, holders, audit,
 * manifests, activity relay) and user-token calls. A request interceptor adds
 * the current tenant to each of them, so no call site can forget it. On
 * user-token calls the header is redundant but harmless: the auth middleware
 * has already refused a session whose MIS token names another tenant
 * (TENANT_MISMATCH), so the two always agree.
 *
 * Outside a tenant context (startup, a CLI) nothing is added and the MIS
 * treats the call as tenant 1. Calls that must not carry it can pass the
 * header explicitly (an explicit value is never overwritten).
 */

const misBase = () => (process.env.NGA_MIS_BASE_URL || "").replace(/\/+$/, "");

export function isMisUrl(url: string | undefined, baseURL?: string): boolean {
  const base = misBase();
  if (!base) return false;
  const full = url && /^https?:\/\//i.test(url) ? url : `${baseURL ?? ""}${url ?? ""}`;
  return full === base || full.startsWith(`${base}/`) || full.startsWith(`${base}?`);
}

/** Headers for an app-level (no end user) MIS call in the current tenant. */
export function tenantHeaders(tid?: number): Record<string, string> {
  const t = tid ?? currentTenantOrNull()?.tid;
  return t ? { "X-NGA-Tenant": String(t) } : {};
}

/** Add the tenant header to an axios request config aimed at the MIS. */
export function withTenantHeader<T extends { url?: string; baseURL?: string; headers?: any }>(config: T): T {
  const tenant = currentTenantOrNull();
  if (!tenant || !isMisUrl(config.url, config.baseURL)) return config;
  const headers = config.headers ?? {};
  const has =
    typeof headers.has === "function"
      ? headers.has(TENANT_HEADER)
      : Object.keys(headers).some((k) => k.toLowerCase() === TENANT_HEADER);
  if (has) return config;
  if (typeof headers.set === "function") headers.set("X-NGA-Tenant", String(tenant.tid));
  else headers["X-NGA-Tenant"] = String(tenant.tid);
  config.headers = headers;
  return config;
}

let installed = false;

export function installMisTenantHeader(instance: any = axios): void {
  if (installed && instance === axios) return;
  // A jest automock of axios has no interceptors; nothing to install then.
  if (!instance?.interceptors?.request?.use) return;
  instance.interceptors.request.use((config: any) => withTenantHeader(config));
  if (instance === axios) installed = true;
}

installMisTenantHeader();

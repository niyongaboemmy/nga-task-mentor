import { currentTenantOrNull, PRIMARY_TENANT_ID, tenantKeyFor } from "../vendor/nga-tenancy";
import { countFallback } from "./fallbacks";

/**
 * The current tenant id, or the primary one when there is no tenant context
 * -- counted as a `no_context` fallback (plan Appendix A.6) under `site`.
 */
export function tidOrPrimary(site: string): number {
  const tid = currentTenantOrNull()?.tid;
  if (tid) return tid;
  countFallback("no_context", site);
  return PRIMARY_TENANT_ID;
}

/**
 * Cache key in the current tenant (CONTRACT.md §8): `t<tid>:<parts>`. MIS ids
 * repeat across tenant databases, so every in-process cache keyed by a user,
 * subject, class group or term id goes through this. Outside a context
 * (startup, shadow-mode stragglers) it is the primary tenant's key.
 */
export function tk(...parts: Array<string | number | null | undefined>): string {
  return tenantKeyFor(tidOrPrimary("keys.tk"), ...parts.map((p) => (p ?? "") as string | number));
}

/**
 * The current tenant id (primary outside a context). In-memory records that
 * are looked up by a LOCAL id (user, project, session, job) store it and
 * compare it alongside the id, since local ids repeat across schools.
 */
export function ctid(): number {
  return tidOrPrimary("keys.ctid");
}

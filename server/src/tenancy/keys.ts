import { currentTenantOrNull, PRIMARY_TENANT_ID, tenantKeyFor } from "../vendor/nga-tenancy";

/**
 * Cache key in the current tenant (CONTRACT.md §8): `t<tid>:<parts>`. MIS ids
 * repeat across tenant databases, so every in-process cache keyed by a user,
 * subject, class group or term id goes through this. Outside a context
 * (startup, shadow-mode stragglers) it is the primary tenant's key.
 */
export function tk(...parts: Array<string | number | null | undefined>): string {
  return tenantKeyFor(currentTenantOrNull()?.tid ?? PRIMARY_TENANT_ID, ...parts.map((p) => (p ?? "") as string | number));
}

/**
 * The current tenant id (primary outside a context). In-memory records that
 * are looked up by a LOCAL id (user, project, session, job) store it and
 * compare it alongside the id, since local ids repeat across schools.
 */
export function ctid(): number {
  return currentTenantOrNull()?.tid ?? PRIMARY_TENANT_ID;
}

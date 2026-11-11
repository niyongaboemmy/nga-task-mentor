import { PRIMARY_TENANT_ID } from "../vendor/nga-tenancy";

/**
 * Task Mentor tenancy settings (MULTI_TENANCY_GAP_FIX_PLAN.md Phase 4,
 * packages/tenancy/CONTRACT.md §6-7).
 *
 *  TENANCY_MODE                shadow (default) | enforce. With no tenant
 *                              context, shadow uses tenant 1 and warns;
 *                              enforce throws TenantContextMissing.
 *  TENANCY_LEGACY_DEFAULT_TID  tenant for tokens without a tid (default 1);
 *                              "none" rejects them (401 TENANT_REQUIRED).
 *  TENANT_DB_PREFIX            database name prefix for tenant N > 1
 *                              (default `${DB_NAME}_t`); tenant 1 is DB_NAME.
 */

export type TenancyMode = "shadow" | "enforce";

export function tenancyMode(env: NodeJS.ProcessEnv = process.env): TenancyMode {
  return String(env.TENANCY_MODE || "").trim().toLowerCase() === "enforce" ? "enforce" : "shadow";
}

/** null = legacy (tid-less) tokens are refused. */
export function legacyDefaultTid(env: NodeJS.ProcessEnv = process.env): number | null {
  const raw = String(env.TENANCY_LEGACY_DEFAULT_TID ?? "").trim().toLowerCase();
  if (raw === "none" || raw === "off" || raw === "false") return null;
  const n = Number(raw);
  return raw && Number.isSafeInteger(n) && n > 0 ? n : PRIMARY_TENANT_ID;
}

const SAFE_DB_NAME = /^[A-Za-z0-9_]{1,64}$/;

export function primaryDbName(env: NodeJS.ProcessEnv = process.env): string {
  return env.DB_NAME || "";
}

/** The MySQL database holding a tenant's Task Mentor data. */
export function dbNameFor(tid: number, env: NodeJS.ProcessEnv = process.env): string {
  if (!Number.isSafeInteger(tid) || tid <= 0) throw new Error(`invalid tenant id ${tid}`);
  const name = tid === PRIMARY_TENANT_ID ? primaryDbName(env) : `${env.TENANT_DB_PREFIX || `${primaryDbName(env)}_t`}${tid}`;
  if (!SAFE_DB_NAME.test(name)) throw new Error(`unsafe tenant database name "${name}"`);
  return name;
}

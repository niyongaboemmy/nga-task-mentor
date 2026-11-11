import { forEachActiveTenant, TenantCtx } from "../vendor/nga-tenancy";
import { getTenantRegistry } from "./registry";

/**
 * Run a scheduler body once per schedulable tenant (ACTIVE + GRACE), each in
 * its own tenant context (CONTRACT.md §6.4): its queries go to that tenant's
 * database, its MIS calls carry X-NGA-Tenant, and one school's failure never
 * stops the others. Run records (scheduled_job_runs) live in each tenant DB.
 */
export async function allTenants(job: string, fn: (tenant: TenantCtx) => Promise<unknown> | unknown): Promise<void> {
  let tenants;
  try {
    tenants = getTenantRegistry();
  } catch (err) {
    console.error(`[${job}] tenant registry unavailable:`, (err as Error)?.message ?? err);
    return;
  }
  await forEachActiveTenant(tenants, async (t) => void (await fn(t)), {
    onError: (t, err) => console.error(`[${job}] failed for tenant ${t.tid} (${t.slug}):`, (err as Error)?.message ?? err),
  });
}

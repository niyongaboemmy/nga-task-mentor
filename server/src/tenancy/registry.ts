import axios from "axios";
import {
  normalizeTenant,
  PRIMARY_TENANT_ID,
  primaryTenantCtx,
  TenantCtx,
  TenantRegistry,
} from "../vendor/nga-tenancy";

/**
 * The spoke's cached view of the MIS control plane (CONTRACT.md §4):
 * GET {NGA_MIS_BASE_URL}/platform/tenants/active with this app's SSO client
 * credentials, 30 s TTL, and the primary tenant as the fallback so a
 * single-tenant install keeps working when MIS is unreachable or still old.
 *
 *  TENANCY_REGISTRY   mis (default) | static. static never calls MIS: the
 *                     registry is the primary tenant plus TENANCY_STATIC_TENANTS
 *                     (JSON array of TenantCtx-like objects). Jest defaults to
 *                     static so a test's axios mocks are never consumed here.
 */

const FAILURE_BACKOFF_MS = 30_000;
let lastFailureAt = 0;

function basicAuth(env: NodeJS.ProcessEnv = process.env): string | null {
  const id = env.SSO_CLIENT_ID;
  const secret = env.SSO_CLIENT_SECRET;
  if (!id || !secret) return null;
  return `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
}

function registrySource(env: NodeJS.ProcessEnv = process.env): "mis" | "static" {
  const raw = String(env.TENANCY_REGISTRY || "").trim().toLowerCase();
  if (raw === "static") return "static";
  if (raw === "mis") return "mis";
  return env.JEST_WORKER_ID ? "static" : "mis";
}

export function staticTenants(env: NodeJS.ProcessEnv = process.env): TenantCtx[] {
  const list: TenantCtx[] = [primaryTenantCtx()];
  if (env.TENANCY_STATIC_TENANTS) {
    try {
      for (const raw of JSON.parse(env.TENANCY_STATIC_TENANTS) as Record<string, unknown>[]) {
        const t = normalizeTenant(raw);
        if (!t) continue;
        const i = list.findIndex((x) => x.tid === t.tid);
        if (i >= 0) list[i] = t;
        else list.push(t);
      }
    } catch (err) {
      console.warn("[tenancy] TENANCY_STATIC_TENANTS is not valid JSON:", (err as Error).message);
    }
  }
  return list;
}

/** Load every tenant from MIS. Throws (fast, during a backoff) when MIS can't answer. */
export async function loadTenantsFromMis(env: NodeJS.ProcessEnv = process.env): Promise<TenantCtx[]> {
  if (registrySource(env) === "static") return staticTenants(env);
  const base = (env.NGA_MIS_BASE_URL || "").replace(/\/+$/, "");
  const auth = basicAuth(env);
  if (!base || !auth) return staticTenants(env);
  if (Date.now() - lastFailureAt < FAILURE_BACKOFF_MS) throw new Error("MIS tenant registry unavailable (backing off)");
  try {
    const res = await axios.get(`${base}/platform/tenants/active`, {
      headers: { Authorization: auth },
      timeout: Number(env.TENANCY_REGISTRY_TIMEOUT_MS) || 3000,
    });
    const body = res?.data ?? {};
    const raw: unknown = body.tenants ?? body.data?.tenants ?? body.data;
    if (!Array.isArray(raw)) throw new Error("MIS returned no tenant list");
    const tenants = raw.map((r) => normalizeTenant(r as Record<string, unknown>)).filter((t): t is TenantCtx => !!t);
    // An install whose MIS doesn't list the primary yet still serves it.
    if (!tenants.some((t) => t.tid === PRIMARY_TENANT_ID)) tenants.push(primaryTenantCtx());
    return tenants;
  } catch (err) {
    lastFailureAt = Date.now();
    throw err;
  }
}

let registry: TenantRegistry | null = null;

export function getTenantRegistry(): TenantRegistry {
  if (!registry) {
    registry = new TenantRegistry({
      load: () => loadTenantsFromMis(),
      ttlMs: Number(process.env.TENANCY_REGISTRY_TTL_MS) || 30_000,
      fallback: [primaryTenantCtx()],
    });
  }
  return registry;
}

/** Tests: replace the registry (null restores the default). */
export function setTenantRegistryForTests(r: TenantRegistry | null): void {
  registry = r;
  lastFailureAt = 0;
}

/** A registry over a fixed list (tests, scripts). */
export function fixedRegistry(tenants: TenantCtx[]): TenantRegistry {
  return new TenantRegistry({ load: async () => tenants, ttlMs: 60_000 });
}

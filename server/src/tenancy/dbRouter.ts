import type { Sequelize } from "sequelize-typescript";
import { currentTenantOrNull, TenantContextMissing } from "../vendor/nga-tenancy";
import { dbNameFor, primaryDbName, tenancyMode } from "./config";

/**
 * Database-per-tenant routing for the single Sequelize instance (spike S-2,
 * option a; see docs/multi-tenancy/spikes/S-2-sequelize-routing.md).
 *
 * Every model and raw query acquires a pooled connection through
 * connectionManager.getConnection(), which runs the `afterPoolAcquire` hook.
 * The hook resolves the tenant database from the AsyncLocalStorage context
 * and issues `USE \`db\`` when the connection currently points elsewhere (the
 * current database is tracked per connection). A transaction acquires its
 * connection once, so every statement in it -- and every include/join,
 * which is a single statement -- stays in the same tenant database.
 *
 * `sequelize.config.database` becomes a getter for the same name, because
 * Sequelize reads it for INFORMATION_SCHEMA lookups (Model.sync's
 * tableExists, showAllTables, foreign-key reflection): without it a sync in
 * tenant 2 would see tenant 1's tables and skip creating its own.
 *
 * Fail closed: with no tenant context, TENANCY_MODE=enforce throws
 * TenantContextMissing; shadow (the default during roll-out) uses tenant 1
 * and logs a rate-limited warning.
 */

export class TenantDatabaseUnavailable extends Error {
  readonly code = "TENANT_DB_UNAVAILABLE";
  constructor(
    readonly database: string,
    cause: unknown,
  ) {
    super(`Tenant database "${database}" is not available: ${(cause as Error)?.message ?? cause}`);
    this.name = "TenantDatabaseUnavailable";
  }
}

const WARN_EVERY_MS = 60_000;
let lastWarnAt = 0;
let missingContextCount = 0;

/** Tests/diagnostics: how many queries ran without a tenant context (shadow). */
export const missingContextQueries = () => missingContextCount;

/** The database the current context's queries belong to. */
export function currentDbName(what = "database query"): string {
  const tenant = currentTenantOrNull();
  if (tenant) return dbNameFor(tenant.tid);
  if (tenancyMode() === "enforce") throw new TenantContextMissing(what);
  missingContextCount++;
  const now = Date.now();
  if (now - lastWarnAt > WARN_EVERY_MS) {
    lastWarnAt = now;
    const where = new Error().stack?.split("\n").slice(3, 6).map((l) => l.trim()).join(" <- ");
    console.warn(`[tenancy] ${what} without a tenant context; using tenant 1 (TENANCY_MODE=shadow). ${where ?? ""}`);
  }
  return primaryDbName();
}

const TRACKED = Symbol.for("tm.tenancy.currentDb");

function rawQuery(connection: any, sql: string): Promise<void> {
  return new Promise((resolve, reject) => {
    connection.query(sql, (err: unknown) => (err ? reject(err) : resolve()));
  });
}

/** The database a pooled connection points at, as far as the router knows. */
export function trackedDatabase(connection: any): string | undefined {
  return connection?.[TRACKED];
}

let installed = new WeakSet<object>();

export function installTenantRouter(sequelize: Sequelize): void {
  if (installed.has(sequelize)) return;
  installed.add(sequelize);

  const config = (sequelize as any).config;
  Object.defineProperty(config, "database", {
    configurable: true,
    enumerable: true,
    get: () => currentDbName("schema lookup"),
    set: () => {
      /* fixed by DB_NAME / the tenant context */
    },
  });

  sequelize.addHook("afterPoolAcquire", async (connection: any) => {
    let target: string;
    try {
      target = currentDbName();
    } catch (err) {
      sequelize.connectionManager.releaseConnection(connection);
      throw err;
    }
    if (connection[TRACKED] === undefined) {
      connection[TRACKED] = connection.config?.database || primaryDbName();
    }
    if (connection[TRACKED] === target) return;
    try {
      // mysql2 caches prepared statements per connection (bound queries use
      // execute()). A statement resolves its tables when it is prepared, so
      // one prepared in the previous tenant's database would keep writing
      // there after USE. Close them all (lru clear -> statement.close()).
      connection._statements?.clear?.();
      await rawQuery(connection, `USE \`${target}\``);
      connection[TRACKED] = target;
    } catch (err) {
      sequelize.connectionManager.releaseConnection(connection);
      throw new TenantDatabaseUnavailable(target, err);
    }
  });
}

/** Tests only. */
export function resetTenantRouterForTests(): void {
  installed = new WeakSet<object>();
  lastWarnAt = 0;
  missingContextCount = 0;
}

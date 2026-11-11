import { QueryTypes } from "sequelize";
import { sequelize } from "../config/database";
import { syncModels } from "../utils/syncModels";
import { DEFAULT_GRADING_BANDS, GRADING_BANDS_KEY } from "../services/tenantSettings";
import { PRIMARY_TENANT_ID, primaryTenantCtx, runWithTenant, TenantCtx } from "../vendor/nga-tenancy";
import { dbNameFor, primaryDbName } from "./config";

/**
 * Provisioning a tenant's Task Mentor database (CONTRACT.md §5, Phase 4 #2).
 *
 * Idempotent; safe to call again after a release:
 *  1. CREATE DATABASE IF NOT EXISTS `${TENANT_DB_PREFIX}<tid>` (utf8mb4).
 *  2. Schema: every base table of the primary database that the tenant
 *     database lacks is created from SHOW CREATE TABLE (structure only --
 *     never rows), which carries the tables only migrations make
 *     (session_revocations, scheduled_job_runs, access_shadow_diffs, ...).
 *     Then syncModels() for anything model-defined.
 *  3. Catalog seeds, INSERT IGNORE: SequelizeMeta (the schema is already at
 *     the primary's migration level), permissions, the system roles and
 *     their role_permissions, Bloom's taxonomy levels; app_settings defaults
 *     (grading bands). No school data is ever copied.
 * Tenant 1 is the existing database: it is only model-synced, never seeded.
 *
 * Production: the app's MySQL user needs CREATE on `<DB_NAME>_t%`.* (or the
 * TENANT_DB_PREFIX pattern).
 */

export const CATALOG_TABLES = ["SequelizeMeta", "permissions", "blooms_taxonomy_levels"] as const;

const q = (sql: string, replacements?: Record<string, unknown>, transaction?: any) =>
  sequelize.query(sql, { replacements, transaction, type: QueryTypes.RAW });
const select = <T>(sql: string, replacements?: Record<string, unknown>, transaction?: any) =>
  sequelize.query(sql, { replacements, transaction, type: QueryTypes.SELECT }) as Promise<T[]>;

/** Does the tenant's database exist on the server? */
export async function tenantDatabaseExists(tid: number): Promise<boolean> {
  const rows = await runWithTenant(primaryTenantCtx(), () =>
    select<{ n: number }>("SELECT COUNT(*) AS n FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = :db", { db: dbNameFor(tid) }),
  );
  return Number(rows[0]?.n) > 0;
}

async function baseTables(db: string): Promise<string[]> {
  const rows = await select<{ t: string }>(
    "SELECT TABLE_NAME AS t FROM information_schema.TABLES WHERE TABLE_SCHEMA = :db AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME",
    { db },
  );
  return rows.map((r) => r.t);
}

const ident = (name: string) => {
  if (!/^[A-Za-z0-9_]+$/.test(name)) throw new Error(`unsafe identifier ${name}`);
  return `\`${name}\``;
};

/** CREATE TABLE IF NOT EXISTS ... for the tenant, from the primary's definition. */
export function tenantTableDdl(createTable: string): string {
  return createTable
    .replace(/^CREATE TABLE /i, "CREATE TABLE IF NOT EXISTS ")
    .replace(/\s+AUTO_INCREMENT=\d+/i, "");
}

export interface ProvisionResult {
  ok: true;
  tid: number;
  created: boolean;
  tablesCreated: number;
  synced: number;
}

export async function provisionTenant(tenant: TenantCtx): Promise<ProvisionResult> {
  const tid = tenant.tid;
  if (tid === PRIMARY_TENANT_ID) {
    const report = await runWithTenant(tenant, () => syncModels(sequelize, { alter: false }));
    return { ok: true, tid, created: false, tablesCreated: 0, synced: report.synced };
  }

  const db = dbNameFor(tid);
  const primary = primaryDbName();
  const existed = await tenantDatabaseExists(tid);
  if (!existed) {
    await runWithTenant(primaryTenantCtx(), () =>
      q(`CREATE DATABASE IF NOT EXISTS ${ident(db)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`),
    );
  }

  return runWithTenant(tenant, async () => {
    const have = new Set(await baseTables(db));
    const missing = (await baseTables(primary)).filter((t) => !have.has(t));

    // One pinned connection, so FOREIGN_KEY_CHECKS=0 covers every CREATE
    // (tables reference each other in any order). DDL commits implicitly;
    // the transaction only holds the connection.
    if (missing.length) {
      await sequelize.transaction(async (tx) => {
        await q("SET FOREIGN_KEY_CHECKS = 0", undefined, tx);
        try {
          for (const table of missing) {
            const [row] = await select<Record<string, string>>(`SHOW CREATE TABLE ${ident(primary)}.${ident(table)}`, undefined, tx);
            const ddl = row?.["Create Table"];
            if (ddl) await q(tenantTableDdl(ddl), undefined, tx);
          }
        } finally {
          await q("SET FOREIGN_KEY_CHECKS = 1", undefined, tx);
        }
      });
    }

    const report = await syncModels(sequelize, { alter: false });

    for (const table of CATALOG_TABLES) {
      await q(`INSERT IGNORE INTO ${ident(table)} SELECT * FROM ${ident(primary)}.${ident(table)}`);
    }
    await q(`INSERT IGNORE INTO \`roles\` SELECT * FROM ${ident(primary)}.\`roles\` WHERE is_system = 1`);
    await q(
      `INSERT IGNORE INTO \`role_permissions\` SELECT rp.* FROM ${ident(primary)}.\`role_permissions\` rp
         JOIN ${ident(primary)}.\`roles\` r ON r.id = rp.role_id WHERE r.is_system = 1`,
    );
    await q("INSERT IGNORE INTO `app_settings` (`key`, `value`, `updated_by`, `updated_at`) VALUES (:k, :v, NULL, NOW())", {
      k: GRADING_BANDS_KEY,
      v: JSON.stringify(DEFAULT_GRADING_BANDS),
    });

    return { ok: true as const, tid, created: !existed, tablesCreated: missing.length, synced: report.synced };
  });
}

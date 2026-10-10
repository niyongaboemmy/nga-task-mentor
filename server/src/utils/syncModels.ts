import type { ModelStatic, Sequelize, SyncOptions } from "sequelize";

/**
 * sequelize.sync(), one model at a time, where failing to add an index
 * doesn't stop the server.
 *
 * Model.sync() also adds the indexes a model declares. When the data breaks
 * one (a unique index over duplicate rows, which a migration is about to
 * clean up), sequelize.sync() throws and startup used to exit: on
 * 2026-10-10 that crash-looped the API between a deploy and its migration.
 * An index failure is logged and the remaining models still sync; anything
 * else (database unreachable, a table that can't be created) still throws.
 */

const INDEX_DDL = /^\s*(ALTER\s+TABLE\s+\S+\s+ADD\s+(UNIQUE\s+|FULLTEXT\s+|SPATIAL\s+)?INDEX|CREATE\s+(UNIQUE\s+|FULLTEXT\s+|SPATIAL\s+)?INDEX)\b/i;
// ER_DUP_KEYNAME, ER_DUP_ENTRY, ER_TOO_MANY_KEYS
const INDEX_ERRNOS = new Set([1061, 1062, 1069]);

export function isIndexError(error: unknown): boolean {
  const e = error as { sql?: string; parent?: { sql?: string; errno?: number }; original?: { errno?: number } } | null;
  const sql = e?.sql ?? e?.parent?.sql ?? "";
  if (INDEX_DDL.test(sql)) return true;
  const errno = e?.parent?.errno ?? e?.original?.errno;
  return !!errno && INDEX_ERRNOS.has(errno) && /index/i.test(sql);
}

export interface SyncReport {
  synced: number;
  /** Models whose index couldn't be added (the table itself is in place). */
  skippedIndexes: { model: string; error: string }[];
}

export async function syncModels(
  sequelize: Sequelize,
  options: SyncOptions = { alter: false },
  log: (msg: string) => void = (m) => console.warn(m),
): Promise<SyncReport> {
  const report: SyncReport = { synced: 0, skippedIndexes: [] };
  const sorted = sequelize.modelManager.getModelsTopoSortedByForeignKey() as ModelStatic<any>[] | null;
  // Same order as sequelize.sync(): referenced tables first; with cyclic
  // references, every model without its foreign-key constraints.
  const models = sorted ? [...sorted].reverse() : (sequelize.modelManager.models as ModelStatic<any>[]);
  const opts = sorted ? options : { ...options, withoutForeignKeyConstraints: true };
  for (const model of models) {
    try {
      await model.sync(opts);
      report.synced++;
    } catch (error) {
      if (!isIndexError(error)) throw error;
      const message = (error as Error).message;
      report.skippedIndexes.push({ model: model.name, error: message });
      log(`[db] ${model.name}: an index couldn't be added, continuing without it (${message})`);
    }
  }
  return report;
}

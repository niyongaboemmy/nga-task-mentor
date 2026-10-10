import { DataTypes, Sequelize } from "sequelize";
import { sequelize as appDb } from "../config/database";
import { isIndexError, syncModels } from "../utils/syncModels";

/**
 * Startup sync must survive an index the data can't take yet (the
 * 2026-10-10 crash loop: a unique index declared over duplicate rows).
 */

const TABLE = "zz_sync_models_check";

describe("syncModels", () => {
  let db: Sequelize;

  beforeAll(async () => {
    // A separate instance holding only the throwaway models.
    db = new Sequelize(appDb.config.database!, appDb.config.username!, appDb.config.password ?? undefined, {
      host: appDb.config.host,
      port: Number(appDb.config.port),
      dialect: "mysql",
      logging: false,
    });
    await db.query(`DROP TABLE IF EXISTS ${TABLE}`);
    await db.query(`DROP TABLE IF EXISTS ${TABLE}_other`);
    await db.query(`CREATE TABLE ${TABLE} (id INT AUTO_INCREMENT PRIMARY KEY, k VARCHAR(20) NOT NULL)`);
    await db.query(`INSERT INTO ${TABLE} (k) VALUES ('dup'), ('dup')`);
  });

  afterAll(async () => {
    await db.query(`DROP TABLE IF EXISTS ${TABLE}`);
    await db.query(`DROP TABLE IF EXISTS ${TABLE}_other`);
    await db.close();
  });

  it("logs a unique index the duplicates block and still creates the other tables", async () => {
    db.define("Dup", { k: { type: DataTypes.STRING(20), allowNull: false } }, {
      tableName: TABLE,
      timestamps: false,
      indexes: [{ unique: true, fields: ["k"], name: `${TABLE}_k` }],
    });
    db.define("Other", { v: DataTypes.STRING(20) }, { tableName: `${TABLE}_other`, timestamps: false });

    // What startup used to do: the whole sync fails.
    await expect(db.sync({ alter: false })).rejects.toThrow();

    const logs: string[] = [];
    const report = await syncModels(db, { alter: false }, (m) => logs.push(m));
    expect(report.skippedIndexes.map((s) => s.model)).toEqual(["Dup"]);
    expect(report.synced).toBe(1);
    expect(logs[0]).toMatch(/Dup: an index couldn't be added/);
    const [tables]: any = await db.query(`SHOW TABLES LIKE '${TABLE}_other'`);
    expect(tables).toHaveLength(1);
  });
});

describe("isIndexError", () => {
  it("recognises index DDL failures and nothing else", () => {
    expect(isIndexError({ sql: "ALTER TABLE `project_presence` ADD UNIQUE INDEX `x` (`a`)" })).toBe(true);
    expect(isIndexError({ parent: { sql: "CREATE INDEX `y` ON `t` (`a`)", errno: 1061 } })).toBe(true);
    expect(isIndexError({ sql: "CREATE TABLE IF NOT EXISTS `t` (...)" })).toBe(false);
    expect(isIndexError({ name: "SequelizeConnectionRefusedError", parent: { errno: 2002 } })).toBe(false);
    expect(isIndexError(null)).toBe(false);
  });

  it("rethrows anything that isn't about an index", async () => {
    const fake: any = {
      modelManager: {
        getModelsTopoSortedByForeignKey: () => [{ name: "Broken", sync: async () => Promise.reject(Object.assign(new Error("connect ECONNREFUSED"), { parent: { errno: 2002 } })) }],
        models: [],
      },
    };
    await expect(syncModels(fake, { alter: false }, () => undefined)).rejects.toThrow("ECONNREFUSED");
  });
});

import "reflect-metadata";
import { DataTypes, QueryTypes } from "sequelize";
import { sequelize } from "../config/database";
import { dbNameFor } from "../tenancy/config";
import { TenantDatabaseUnavailable } from "../tenancy/dbRouter";
import { primaryTenantCtx, runWithTenant, TenantContextMissing, TenantCtx } from "../vendor/nga-tenancy";

/**
 * Spike S-2 / router isolation: one Sequelize instance, `USE` per pooled
 * connection from the ALS tenant. Two real databases on the test server:
 * DB_NAME (tenant 1) and `${DB_NAME}_t2` (tenant 2). Only runs against a
 * throw-away test database (DB_NAME starting with tm_mt_).
 */

const T1 = primaryTenantCtx();
const T2: TenantCtx = { ...primaryTenantCtx(), tid: 2, slug: "two", name: "School Two", isPrimary: false };
const T9: TenantCtx = { ...T2, tid: 9, slug: "nine" };
const safe = /^tm_mt_/.test(process.env.DB_NAME || "");
const d = safe ? describe : describe.skip;

const Probe = sequelize.define(
  "TenancyProbe",
  { id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true }, label: DataTypes.STRING(60) },
  { tableName: "tenancy_probe", timestamps: false },
);
const ProbeNote = sequelize.define(
  "TenancyProbeNote",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    probe_id: DataTypes.INTEGER,
    note: DataTypes.STRING(60),
  },
  { tableName: "tenancy_probe_notes", timestamps: false },
);
Probe.hasMany(ProbeNote, { foreignKey: "probe_id", as: "notes", constraints: false });
ProbeNote.belongsTo(Probe, { foreignKey: "probe_id", as: "probe", constraints: false });

const inT = <R>(t: TenantCtx, fn: () => Promise<R>) => runWithTenant(t, fn);

d("tenant database router", () => {
  beforeAll(async () => {
    await inT(T1, () => sequelize.query(`CREATE DATABASE IF NOT EXISTS \`${dbNameFor(2)}\``));
    for (const t of [T1, T2]) {
      await inT(t, async () => {
        await Probe.sync({ force: true });
        await ProbeNote.sync({ force: true });
      });
    }
  });

  afterAll(async () => {
    for (const t of [T1, T2]) {
      await inT(t, async () => {
        await ProbeNote.drop();
        await Probe.drop();
      });
    }
    await sequelize.close();
  });

  it("maps tenant ids to database names", () => {
    expect(dbNameFor(1)).toBe(process.env.DB_NAME);
    expect(dbNameFor(2)).toBe(`${process.env.DB_NAME}_t2`);
  });

  it("sync created the table in each tenant database (tableExists follows the tenant)", async () => {
    for (const t of [T1, T2]) {
      const rows = await inT(t, () =>
        sequelize.query(
          "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenancy_probe'",
          { type: QueryTypes.SELECT },
        ),
      );
      expect(rows).toHaveLength(1);
    }
  });

  it("rows written in one tenant are invisible to the other, even when queries interleave", async () => {
    await inT(T1, () => Probe.create({ label: "CANARY-A-1" }));
    await inT(T2, () => Probe.create({ label: "CANARY-B-1" }));
    // Interleave many queries from both tenants over the shared pool (max 5).
    const reads = await Promise.all(
      Array.from({ length: 30 }, (_, i) =>
        inT(i % 2 ? T2 : T1, async () => (await Probe.findAll({ raw: true })).map((r: any) => r.label)),
      ),
    );
    reads.forEach((labels, i) => {
      expect(labels).toEqual(i % 2 ? ["CANARY-B-1"] : ["CANARY-A-1"]);
    });
    const [db2] = await inT(T2, () => sequelize.query("SELECT DATABASE() AS db", { type: QueryTypes.SELECT }));
    expect((db2 as any).db).toBe(dbNameFor(2));
  });

  it("includes (joins) resolve inside the tenant database", async () => {
    await inT(T2, async () => {
      const p: any = await Probe.create({ label: "B-with-note" });
      await ProbeNote.create({ probe_id: p.id, note: "CANARY-B-NOTE" });
    });
    await inT(T1, async () => {
      const p: any = await Probe.create({ label: "A-with-note" });
      await ProbeNote.create({ probe_id: p.id, note: "CANARY-A-NOTE" });
    });
    const b: any[] = await inT(T2, () => Probe.findAll({ include: [{ model: ProbeNote, as: "notes" }] }));
    const notes = b.flatMap((p) => p.notes.map((n: any) => n.note));
    expect(notes).toEqual(["CANARY-B-NOTE"]);
  });

  it("a transaction stays on its tenant's connection while the other tenant runs queries", async () => {
    await inT(T2, () =>
      sequelize.transaction(async (tx) => {
        await Probe.create({ label: "B-tx" }, { transaction: tx });
        // Tenant 1 traffic in the middle of tenant 2's transaction.
        await Promise.all(Array.from({ length: 8 }, () => inT(T1, () => Probe.count())));
        const inside = await Probe.findAll({ where: { label: "B-tx" }, transaction: tx, raw: true });
        expect(inside).toHaveLength(1);
      }),
    );
    expect(await inT(T1, () => Probe.count({ where: { label: "B-tx" } }))).toBe(0);
    expect(await inT(T2, () => Probe.count({ where: { label: "B-tx" } }))).toBe(1);
  });

  it("a rolled-back transaction leaves the tenant database untouched", async () => {
    await expect(
      inT(T2, () =>
        sequelize.transaction(async (tx) => {
          await Probe.create({ label: "B-rollback" }, { transaction: tx });
          throw new Error("rollback");
        }),
      ),
    ).rejects.toThrow("rollback");
    expect(await inT(T2, () => Probe.count({ where: { label: "B-rollback" } }))).toBe(0);
  });

  it("enforce mode throws TenantContextMissing for a query without a tenant", async () => {
    const prev = process.env.TENANCY_MODE;
    process.env.TENANCY_MODE = "enforce";
    try {
      await expect(Probe.count()).rejects.toBeInstanceOf(TenantContextMissing);
      // ...and the pool is not leaked: queries in a context still work.
      for (let i = 0; i < 8; i++) await expect(inT(T1, () => Probe.count())).resolves.toEqual(expect.any(Number));
    } finally {
      process.env.TENANCY_MODE = prev;
    }
  });

  it("shadow mode falls back to tenant 1 without a context", async () => {
    const labels = (await Probe.findAll({ raw: true })).map((r: any) => r.label);
    expect(labels).toContain("CANARY-A-1");
    expect(labels).not.toContain("CANARY-B-1");
  });

  it("a tenant whose database does not exist fails without leaking connections", async () => {
    await expect(inT(T9, () => Probe.count())).rejects.toBeInstanceOf(TenantDatabaseUnavailable);
    for (let i = 0; i < 8; i++) await expect(inT(T2, () => Probe.count())).resolves.toEqual(expect.any(Number));
  });
});

import crypto from "crypto";
import fs from "fs";
import path from "path";
import express from "express";
import request from "supertest";
import "../expressContext";
import { currentTenantOrNull, primaryTenantCtx, runWithTenant, TenantCtx } from "../../vendor/nga-tenancy";
import { dbNameFor, legacyDefaultTid, tenancyMode } from "../config";
import { tenantTableDdl } from "../provision";
import { misTokenTid, tidFromMisAuth } from "../request";
import { staticTenants } from "../registry";
import jwt from "jsonwebtoken";

describe("vendored @nga/tenancy copies", () => {
  it.each(["server/src/vendor/nga-tenancy/index.ts", "live-server/src/vendor/nga-tenancy/index.ts"])(
    "%s is an unedited copy of the core (sha256 header matches the body)",
    (rel) => {
      const file = fs.readFileSync(path.resolve(__dirname, "../../../..", rel), "utf8");
      const [l1, l2, l3, ...rest] = file.split("\n");
      expect(l1).toMatch(/^\/\/ VENDORED from/);
      expect(l2).toMatch(/^\/\/ Re-sync with/);
      const sha = /sha256:([0-9a-f]{64})/.exec(l3)?.[1];
      expect(crypto.createHash("sha256").update(rest.join("\n")).digest("hex")).toBe(sha);
    },
  );
});

describe("tenancy config", () => {
  it("names tenant databases", () => {
    const env = { DB_NAME: "taskmentor" } as any;
    expect(dbNameFor(1, env)).toBe("taskmentor");
    expect(dbNameFor(7, env)).toBe("taskmentor_t7");
    expect(dbNameFor(7, { ...env, TENANT_DB_PREFIX: "tm_t" })).toBe("tm_t7");
    expect(() => dbNameFor(0, env)).toThrow();
    expect(() => dbNameFor(2, { DB_NAME: "bad-name" } as any)).toThrow();
  });

  it("reads TENANCY_MODE and TENANCY_LEGACY_DEFAULT_TID", () => {
    expect(tenancyMode({} as any)).toBe("shadow");
    expect(tenancyMode({ TENANCY_MODE: "enforce" } as any)).toBe("enforce");
    expect(legacyDefaultTid({} as any)).toBe(1);
    expect(legacyDefaultTid({ TENANCY_LEGACY_DEFAULT_TID: "none" } as any)).toBeNull();
  });

  it("static registry: the primary plus TENANCY_STATIC_TENANTS", () => {
    const list = staticTenants({ TENANCY_STATIC_TENANTS: JSON.stringify([{ tenant_id: 3, slug: "x", status: "suspended" }]) } as any);
    expect(list.map((t) => [t.tid, t.status])).toEqual([
      [1, "ACTIVE"],
      [3, "SUSPENDED"],
    ]);
  });

  it("finds the tenant of an MIS sign-in: response tenant, else token tid, else legacy default", () => {
    const tok = jwt.sign({ sub: "1", tid: 4 }, "k");
    expect(tidFromMisAuth(tok, { tenant: { tid: 6 } })).toBe(6);
    expect(tidFromMisAuth(tok, {})).toBe(4);
    expect(tidFromMisAuth(jwt.sign({ sub: "1" }, "k"), null)).toBe(1);
    expect(misTokenTid("not-a-jwt")).toBeNull();
  });

  it("tenant DDL is CREATE TABLE IF NOT EXISTS without the AUTO_INCREMENT counter", () => {
    expect(tenantTableDdl("CREATE TABLE `users` (\n `id` int\n) ENGINE=InnoDB AUTO_INCREMENT=812 DEFAULT CHARSET=utf8mb4")).toBe(
      "CREATE TABLE IF NOT EXISTS `users` (\n `id` int\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
    );
  });
});

describe("Express keeps the tenant across middleware that resumes from outside the context", () => {
  // A timer created at module load runs its callbacks with no tenant -- like
  // busboy/multer resuming the chain from the request stream's events.
  const pending: Array<() => void> = [];
  const pump = setInterval(() => pending.splice(0).forEach((f) => f()), 5);
  afterAll(() => clearInterval(pump));

  it("re-enters req.tenant for the next layer", async () => {
    const T2: TenantCtx = { ...primaryTenantCtx(), tid: 2, slug: "two", isPrimary: false };
    const app = express();
    app.use((req, _res, next) => {
      req.tenant = T2;
      runWithTenant(T2, () => next());
    });
    app.use((_req, _res, next) => {
      pending.push(() => next()); // resumed later, outside any tenant context
    });
    app.get("/", (_req, res) => res.json({ tid: currentTenantOrNull()?.tid ?? null }));
    expect((await request(app).get("/")).body).toEqual({ tid: 2 });
  });
});

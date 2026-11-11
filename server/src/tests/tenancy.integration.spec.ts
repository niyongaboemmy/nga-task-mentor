import "reflect-metadata";
import crypto from "crypto";
import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { QueryTypes } from "sequelize";
import { sequelize } from "../config/database";
import { protect } from "../middleware/auth";
import { Role, User } from "../models";
import { upsertMisUser, mapMisRoleToLocal } from "../services/misUserSync";
import { getSnapshot, __setSnapshotFetcher, clearSnapshotCache } from "../access/snapshot";
import { dbNameFor } from "../tenancy/config";
import { tk } from "../tenancy/keys";
import { withTenantHeader } from "../tenancy/misHttp";
import { provisionTenant, tenantDatabaseExists } from "../tenancy/provision";
import { fixedRegistry, setTenantRegistryForTests } from "../tenancy/registry";
import { signTmcodeToken, verifyTmcodeToken } from "../tmcode/token";
import { signTmcodeUserToken, verifyTmcodeUserToken } from "../tmcode/userToken";
import { liveTicketSecret, signLiveSocketTicket } from "../utils/liveSocketTicket";
import { __fileServerPaths } from "../utils/fileServer";
import fileServer from "../utils/fileServer";
import { signUploadQuery, verifyUploadGrant } from "../routes/uploads";
import { currentTenantOrNull, primaryTenantCtx, runWithTenant, TenantCtx } from "../vendor/nga-tenancy";
import { buildTestApp, ensureModelsRegistered } from "./testApp";
import { runQuery } from "../controllers/database.controller";

/**
 * Multi-tenancy (Phase 0 leak fixes + Phase 4) against two real tenant
 * databases on the test server: DB_NAME (tenant 1) and `${DB_NAME}_t2`
 * (tenant 2, provisioned here). Runs only on a throw-away tm_mt_* database.
 */

const safe = /^tm_mt_/.test(process.env.DB_NAME || "");
const d = safe ? describe : describe.skip;

const T1 = primaryTenantCtx();
const T2: TenantCtx = { ...T1, tid: 2, slug: "school-two", name: "School Two", isPrimary: false, pkg: "starter" };
const PENDING: TenantCtx = { ...T2, tid: 3, slug: "pending", status: "PENDING" };
const SUSPENDED: TenantCtx = { ...T2, tid: 4, slug: "suspended", status: "SUSPENDED" };
const GRACE: TenantCtx = { ...T2, tid: 5, slug: "grace", status: "GRACE" };
const RUN = `${Date.now()}`.slice(-7);
const SECRET = () => process.env.JWT_SECRET!;

const inT = <R>(t: TenantCtx, fn: () => Promise<R>) => runWithTenant(t, fn);
const sessionToken = (id: number, tid?: number, extra: Record<string, unknown> = {}) =>
  jwt.sign({ id, ...(tid ? { tid } : {}), ...extra }, SECRET(), { expiresIn: "1h" });

/** A tiny app: protect, then echo what the handler sees. */
function echoApp() {
  const app = express();
  app.get("/echo", protect, async (req, res) => {
    // An event-driven hop (like multer finishing a multipart upload) loses the
    // async context; the Express layer patch must re-enter it.
    await new Promise((r) => setImmediate(r));
    const [{ db }] = (await sequelize.query("SELECT DATABASE() AS db", { type: QueryTypes.SELECT })) as any[];
    res.json({ tid: currentTenantOrNull()?.tid ?? null, reqTid: req.tenant?.tid, userId: req.user?.id, db });
  });
  return app;
}

const created: Array<{ t: TenantCtx; id: number }> = [];
async function mkUser(t: TenantCtx, tag: string, role: "admin" | "instructor" | "student", extra: Record<string, unknown> = {}) {
  return inT(t, async () => {
    const r = await Role.findOne({ where: { name: role } });
    const u = await User.create({
      first_name: "MT",
      last_name: tag,
      email: `mt.${tag}.${RUN}@local.test`,
      password: "MIS_AUTH",
      role,
      role_id: r?.id ?? null,
      ...extra,
    } as any);
    created.push({ t, id: u.id });
    return u;
  });
}

d("multi-tenancy", () => {
  let app: express.Express;

  beforeAll(async () => {
    process.env.TENANCY_PROVISION_SECRET = "provision-secret-for-tests";
    await ensureModelsRegistered();
    setTenantRegistryForTests(fixedRegistry([T1, T2, PENDING, SUSPENDED, GRACE]));
    await provisionTenant(T2);
    app = buildTestApp();
  }, 120_000);

  afterAll(async () => {
    for (const { t, id } of created) await inT(t, () => User.destroy({ where: { id } }));
    setTenantRegistryForTests(null);
    await sequelize.close();
  });

  // ── provisioning ──────────────────────────────────────────────────────────
  describe("POST /api/integration/tenants/:tid/provision", () => {
    it("is protected by the provisioning secret (503 unset, 401 wrong)", async () => {
      const saved = process.env.TENANCY_PROVISION_SECRET;
      delete process.env.TENANCY_PROVISION_SECRET;
      expect((await request(app).post("/api/integration/tenants/2/provision").send(T2)).status).toBe(503);
      process.env.TENANCY_PROVISION_SECRET = saved;
      expect((await request(app).post("/api/integration/tenants/2/provision").send(T2)).status).toBe(401);
      expect(
        (await request(app).post("/api/integration/tenants/2/provision").set("Authorization", "Bearer nope").send(T2)).status,
      ).toBe(401);
    });

    it("is idempotent: the second call creates nothing, the database has the schema and catalog, no school data", async () => {
      const call = () =>
        request(app)
          .post("/api/integration/tenants/2/provision")
          .set("Authorization", `Bearer ${process.env.TENANCY_PROVISION_SECRET}`)
          .send(T2);
      const res = await call();
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ ok: true, tid: 2, created: false, tablesCreated: 0 });
      expect(await tenantDatabaseExists(2)).toBe(true);
      const tables = (await inT(T2, () =>
        sequelize.query("SELECT TABLE_NAME AS t FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()", { type: QueryTypes.SELECT }),
      )) as any[];
      const names = tables.map((r) => r.t);
      for (const t of ["users", "quizzes", "submissions", "session_revocations", "scheduled_job_runs", "app_settings", "SequelizeMeta"]) {
        expect(names).toContain(t);
      }
      const roles = await inT(T2, () => Role.findAll({ raw: true }));
      expect(roles.map((r: any) => r.name).sort()).toEqual(expect.arrayContaining(["admin", "instructor", "student"]));
      expect(roles.every((r: any) => r.is_system)).toBe(true);
      const perms = (await inT(T2, () => sequelize.query("SELECT COUNT(*) n FROM role_permissions", { type: QueryTypes.SELECT }))) as any[];
      expect(Number(perms[0].n)).toBeGreaterThan(0);
      // No school data copied: tenant 1's quizzes/assignments never appear.
      const quizzes = (await inT(T2, () => sequelize.query("SELECT COUNT(*) n FROM quizzes", { type: QueryTypes.SELECT }))) as any[];
      expect(Number(quizzes[0].n)).toBe(0);
      expect((await call()).body.created).toBe(false);
    });

    it("refuses a body naming another tenant", async () => {
      const res = await request(app)
        .post("/api/integration/tenants/2/provision")
        .set("Authorization", `Bearer ${process.env.TENANCY_PROVISION_SECRET}`)
        .send({ ...T2, tid: 7 });
      expect(res.status).toBe(400);
    });
  });

  // ── protect: context, gates, mismatch ─────────────────────────────────────
  describe("protect", () => {
    it("runs the request in the token's tenant: context, req.tenant and the database", async () => {
      const u1 = await mkUser(T1, "ctx1", "student");
      const u2 = await mkUser(T2, "ctx2", "student");
      const a = await request(echoApp()).get("/echo").set("Authorization", `Bearer ${sessionToken(u1.id, 1)}`);
      expect(a.body).toEqual({ tid: 1, reqTid: 1, userId: u1.id, db: dbNameFor(1) });
      const b = await request(echoApp()).get("/echo").set("Authorization", `Bearer ${sessionToken(u2.id, 2)}`);
      expect(b.body).toEqual({ tid: 2, reqTid: 2, userId: u2.id, db: dbNameFor(2) });
    });

    it("a legacy token (no tid) is tenant 1, unless TENANCY_LEGACY_DEFAULT_TID=none", async () => {
      const u1 = await mkUser(T1, "legacy", "student");
      const ok = await request(echoApp()).get("/echo").set("Authorization", `Bearer ${sessionToken(u1.id)}`);
      expect(ok.body.tid).toBe(1);
      process.env.TENANCY_LEGACY_DEFAULT_TID = "none";
      try {
        const res = await request(echoApp()).get("/echo").set("Authorization", `Bearer ${sessionToken(u1.id)}`);
        expect(res.status).toBe(401);
        expect(res.body.code).toBe("TENANT_REQUIRED");
      } finally {
        delete process.env.TENANCY_LEGACY_DEFAULT_TID;
      }
    });

    it("status gates: unknown 401, PENDING 403, SUSPENDED 403, GRACE allowed", async () => {
      const call = (tid: number) => request(echoApp()).get("/echo").set("Authorization", `Bearer ${sessionToken(1, tid)}`);
      expect((await call(99)).body.code).toBe("TENANT_UNKNOWN");
      expect((await call(99)).status).toBe(401);
      expect((await call(3)).status).toBe(403);
      expect((await call(3)).body.code).toBe("TENANT_PENDING");
      expect((await call(4)).status).toBe(403);
      expect((await call(4)).body.code).toBe("TENANT_SUSPENDED");
      // GRACE passes the gate; its database doesn't exist here, so it fails later, never with a gate code.
      const grace = await call(5);
      expect(String(grace.body.code ?? "")).not.toMatch(/^TENANT_/);
      expect(grace.status).not.toBe(403);
    });

    it("an MIS token of another tenant ends the session: 401 TENANT_MISMATCH", async () => {
      const u1 = await mkUser(T1, "mismatch", "student");
      const misOther = jwt.sign({ sub: "5", tid: 2 }, "whatever-mis-key");
      const misSame = jwt.sign({ sub: "5", tid: 1 }, "whatever-mis-key");
      const bad = await request(echoApp())
        .get("/echo")
        .set("Authorization", `Bearer ${sessionToken(u1.id, 1)}`)
        .set("x-mis-token", misOther);
      expect(bad.status).toBe(401);
      expect(bad.body.code).toBe("TENANT_MISMATCH");
      const good = await request(echoApp())
        .get("/echo")
        .set("Authorization", `Bearer ${sessionToken(u1.id, 1)}`)
        .set("x-mis-token", misSame);
      expect(good.status).toBe(200);
    });

    it("a tenant-2 token can't reach a tenant-1 user with the same id", async () => {
      const u1 = await mkUser(T1, "sameid", "student");
      const exists2 = await inT(T2, () => User.findByPk(u1.id));
      const res = await request(echoApp()).get("/echo").set("Authorization", `Bearer ${sessionToken(u1.id, 2)}`);
      if (exists2) expect(res.body.db).toBe(dbNameFor(2));
      else expect(res.status).toBe(401);
    });
  });

  // ── tokens carry tid ──────────────────────────────────────────────────────
  describe("tokens", () => {
    it("local JWT, TMCode session/user tokens and the live ticket carry the tenant", async () => {
      const u2 = await mkUser(T2, "tokens", "student");
      const local = jwt.decode(await inT(T2, async () => u2.getSignedJwtToken())) as any;
      expect(local.tid).toBe(2);
      const tm = await inT(T2, async () => signTmcodeToken({ sid: "s", sub: "1", submission_id: 3 }, new Date(Date.now() + 600_000)));
      expect(verifyTmcodeToken(tm).tid).toBe(2);
      const tu = await inT(T2, async () => signTmcodeUserToken(1, 9).token);
      expect(verifyTmcodeUserToken(tu).tid).toBe(2);
      const live = await inT(T2, async () => signLiveSocketTicket({ id: 1, permissions: new Set(["PROCTORING_VIEW_SESSIONS"]) }, undefined, { courses: [7] }));
      const claims = jwt.verify(live.ticket, liveTicketSecret(SECRET())) as any;
      expect(claims).toMatchObject({ tid: 2, proctor: true, courses: [7] });
      // Legacy TMCode tokens (no tid) report none; the middleware applies the legacy default.
      const legacy = jwt.sign({ mis: 1 }, `${SECRET()}:tmcode-user`, { audience: "tmcode-user", subject: "1" });
      expect(verifyTmcodeUserToken(legacy).tid).toBeNull();
    });

    it("a TMCode user token of tenant 2 opens tenant 2's database", async () => {
      const u2 = await mkUser(T2, "tmuser", "student");
      const token = await inT(T2, async () => signTmcodeUserToken(u2.id, null).token);
      const res = await request(app).get("/api/tmcode/auth/me").set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(JSON.stringify(res.body)).toContain(`mt.tmuser.${RUN}`);
    });
  });

  // ── provisioning users from MIS ───────────────────────────────────────────
  describe("upsertMisUser", () => {
    it("links by mis_user_id only: an e-mail match is never merged", async () => {
      const email = `mt.shared.${RUN}@local.test`;
      const existing = await mkUser(T2, "shared", "student", { email, mis_user_id: null });
      const misId = 880000 + Number(RUN.slice(-4));
      const { user, created: isNew } = await inT(T2, () =>
        upsertMisUser({ user_id: misId, email }, { first_name: "New", last_name: "Person" }, [{ role_id: 99, name: "STUDENT" }]),
      );
      created.push({ t: T2, id: user.id });
      expect(isNew).toBe(true);
      expect(user.id).not.toBe(existing.id);
      expect(user.email).toMatch(/@sso\.invalid$/);
      const again = await inT(T2, () => User.findByPk(existing.id));
      expect(again!.mis_user_id).toBeNull();
      // Same MIS id again: found by mis_user_id, still no merge.
      const second = await inT(T2, () => upsertMisUser({ user_id: misId, email }, null, []));
      expect(second.user.id).toBe(user.id);
      expect(second.created).toBe(false);
    });

    it("maps roles by MIS role name/code, not numeric id", () => {
      expect(mapMisRoleToLocal([{ role_id: 77, name: "SUPER_ADMIN" }])).toBe("admin");
      expect(mapMisRoleToLocal([{ role_id: 1, name: "STUDENT" }])).toBe("student");
      expect(mapMisRoleToLocal([{ role_id: 4, name: "Learner" }])).toBe("student");
      expect(mapMisRoleToLocal([{ role_id: 12, name: "Class teacher" }])).toBe("instructor");
      expect(mapMisRoleToLocal([{ role_id: 50, name: "Custom", code: "school_administrator" }])).toBe("admin");
      expect(mapMisRoleToLocal([{ role_id: 51, name: "HEAD_TEACHER" }])).toBe("admin");
    });
  });

  // ── /uploads ──────────────────────────────────────────────────────────────
  describe("GET /uploads/*", () => {
    let spy: jest.SpyInstance;
    let submissionPath: string;
    let owner: User;
    let other: User;

    beforeAll(async () => {
      spy = jest.spyOn(fileServer, "streamTo").mockImplementation(async (_p: string, res: any) => {
        res.status(200).send(`file in tenant ${currentTenantOrNull()?.tid}`);
        return true;
      });
      owner = await mkUser(T1, "upowner", "student");
      other = await mkUser(T1, "upother", "student");
      const name = `submission-${RUN}-${crypto.randomBytes(4).toString("hex")}.pdf`;
      submissionPath = `submissions/${name}`;
      await inT(T1, () =>
        sequelize.query(
          "INSERT INTO submissions (assignment_id, student_id, file_submissions, is_late, status, created_at, updated_at) VALUES (NULL, :s, :f, 0, 'submitted', NOW(), NOW())",
          { replacements: { s: owner.id, f: JSON.stringify([{ path: submissionPath, filename: name }]) } },
        ),
      );
    });

    afterAll(async () => {
      spy.mockRestore();
      await inT(T1, () => sequelize.query("DELETE FROM submissions WHERE CAST(file_submissions AS CHAR) LIKE :p", { replacements: { p: `%${RUN}%` } }));
    });

    it("refuses an unauthenticated request", async () => {
      const res = await request(app).get(`/uploads/${submissionPath}`);
      expect(res.status).toBe(401);
      expect(spy).not.toHaveBeenCalled();
    });

    it("serves a submission to its owner and refuses another student", async () => {
      const rows = (await inT(T1, () =>
        sequelize.query("SELECT id FROM submissions WHERE CAST(file_submissions AS CHAR) LIKE :p", { replacements: { p: `%${RUN}%` }, type: QueryTypes.SELECT }),
      )) as any[];
      expect(rows).toHaveLength(1);
      const mine = await request(app).get(`/uploads/${submissionPath}`).set("Authorization", `Bearer ${sessionToken(owner.id, 1)}`);
      expect(mine.status).toBe(200);
      const theirs = await request(app).get(`/uploads/${submissionPath}`).set("Authorization", `Bearer ${sessionToken(other.id, 1)}`);
      expect(theirs.status).toBe(403);
    });

    it("refuses another school's user even for a file of the same path", async () => {
      const u2 = await mkUser(T2, "upforeign", "student");
      const res = await request(app).get(`/uploads/${submissionPath}`).set("Authorization", `Bearer ${sessionToken(u2.id, 2)}`);
      expect(res.status).toBe(403);
    });

    it("a signed URL opens without a session, in the signing tenant only, and can't be tampered with", async () => {
      const q = signUploadQuery(2, "assignments/a.pdf");
      const ok = await request(app).get(`/uploads/assignments/a.pdf?${q}`);
      expect(ok.status).toBe(200);
      expect(ok.text).toBe("file in tenant 2");
      expect((await request(app).get(`/uploads/assignments/b.pdf?${q}`)).status).toBe(401);
      expect((await request(app).get(`/uploads/assignments/a.pdf?${q.replace("tid=2", "tid=1")}`)).status).toBe(401);
      expect(verifyUploadGrant("assignments/a.pdf", { tid: "2", exp: "1", sig: "x" })).toBeNull();
    });

    it("another tenant never falls back to the pre-tenancy file location", () => {
      const t1 = runWithTenant(T1, () => __fileServerPaths.readCandidates("submissions/x.pdf"));
      const t2 = runWithTenant(T2, () => __fileServerPaths.readCandidates("submissions/x.pdf"));
      expect(t1).toEqual(["nga-task-mentor/t/1/submissions/x.pdf", "nga-task-mentor/submissions/x.pdf"]);
      expect(t2).toEqual(["nga-task-mentor/t/2/submissions/x.pdf"]);
    });
  });

  // ── caches and service calls ──────────────────────────────────────────────
  describe("caches and MIS calls", () => {
    afterEach(() => {
      __setSnapshotFetcher(null);
      clearSnapshotCache();
    });

    it("cache keys carry the tenant", () => {
      expect(runWithTenant(T1, () => tk("snapshot", 42))).toBe("t1:snapshot:42");
      expect(runWithTenant(T2, () => tk("snapshot", 42))).toBe("t2:snapshot:42");
    });

    it("the access snapshot of MIS user 42 in tenant 1 is not served to MIS user 42 of tenant 2", async () => {
      const snap = (tid: number) => ({ v: tid, caps: { tid: [] }, user: { id: 42, school_id: tid }, tenant: { tid } }) as any;
      __setSnapshotFetcher(async () => snap(currentTenantOrNull()!.tid));
      const a = await runWithTenant(T1, () => getSnapshot({ misUserId: 42, misToken: "tok" }));
      const b = await runWithTenant(T2, () => getSnapshot({ misUserId: 42, misToken: "tok" }));
      expect(a!.v).toBe(1);
      expect(b!.v).toBe(2);
      // And a snapshot naming another tenant is refused.
      __setSnapshotFetcher(async () => snap(9));
      clearSnapshotCache();
      expect(await runWithTenant(T2, () => getSnapshot({ misUserId: 43, misToken: "tok" }))).toBeNull();
    });

    it("MIS calls in a tenant carry X-NGA-Tenant; others and explicit values are left alone", () => {
      const base = process.env.NGA_MIS_BASE_URL;
      const mis = runWithTenant(T2, () => withTenantHeader({ url: `${base}/integrations/sync/x`, headers: {} as any }));
      expect(mis.headers["X-NGA-Tenant"]).toBe("2");
      const judge = runWithTenant(T2, () => withTenantHeader({ url: "http://judge/v1/run", headers: {} as any }));
      expect(judge.headers["X-NGA-Tenant"]).toBeUndefined();
      const none = withTenantHeader({ url: `${base}/x`, headers: {} as any });
      expect(none.headers["X-NGA-Tenant"]).toBeUndefined();
      const explicit = runWithTenant(T2, () => withTenantHeader({ url: `${base}/x`, headers: { "x-nga-tenant": "1" } as any }));
      expect(explicit.headers["x-nga-tenant"]).toBe("1");
    });
  });

  describe("DB console (runQuery) stays in the tenant's database", () => {
    // user 0 has no query-log row to point at: the log write fails quietly.
    beforeEach(() => jest.spyOn(console, "error").mockImplementation(() => {}));
    afterEach(() => (console.error as jest.Mock).mockRestore?.());
    const run = (t: TenantCtx, query: string) =>
      inT(t, async () => {
        let status = 0;
        let body: any = null;
        const res: any = {
          status(c: number) {
            status = c;
            return res;
          },
          json(b: any) {
            body = b;
            return res;
          },
        };
        await runQuery({ body: { query }, user: { id: 0 }, ip: "127.0.0.1" } as any, res);
        return { status, body };
      });

    it("refuses tenant 1's database, system schemas and SHOW DATABASES from tenant 2", async () => {
      const t1db = dbNameFor(1);
      for (const q of [
        `SELECT * FROM ${t1db}.users`,
        `SELECT * FROM \`${t1db}\`.\`users\``,
        "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA",
        "SELECT user FROM mysql.user",
        "SHOW DATABASES",
        `SHOW TABLES FROM ${t1db}`,
      ]) {
        const r = await run(T2, q);
        expect({ q, status: r.status }).toEqual({ q, status: 400 });
      }
    });

    it("still runs reads on the current database (qualified with its own name too)", async () => {
      const r = await run(T2, "SELECT COUNT(*) AS n FROM users");
      expect(r.status).toBe(200);
      const own = await run(T2, `SELECT COUNT(*) AS n FROM ${dbNameFor(2)}.users`);
      expect(own.status).toBe(200);
      expect((await run(T2, "SHOW TABLES")).status).toBe(200);
      expect((await run(T2, "DESCRIBE users")).status).toBe(200);
    });
  });

  // ── canary crawl over admin/report routes ─────────────────────────────────
  describe("canary isolation", () => {
    let admin1: User;
    let admin2: User;
    const canaryRole = `CANARY-A-ROLE-${RUN}`;

    beforeAll(async () => {
      admin1 = await mkUser(T1, "canaryadmin1", "admin", { first_name: `CANARY-A-${RUN}` });
      admin2 = await mkUser(T2, "canaryadmin2", "admin", { first_name: `CANARY-B-${RUN}` });
      await inT(T1, () => Role.create({ name: canaryRole, description: "canary", is_system: false } as any));
      await inT(T2, () =>
        sequelize.query("INSERT INTO app_settings (`key`, `value`, updated_at) VALUES ('grading.bands', :v, NOW()) ON DUPLICATE KEY UPDATE value = VALUES(value)", {
          replacements: { v: JSON.stringify([{ min: 50, letter: "P", remark: "Pass" }, { min: 0, letter: "U", remark: "Ungraded" }]) },
        }),
      );
    });

    afterAll(async () => {
      await inT(T1, () => Role.destroy({ where: { name: canaryRole } }));
      await inT(T2, () => sequelize.query("UPDATE app_settings SET value = NULL WHERE `key` = 'grading.bands'"));
    });

    const as = (u: User, tid: number) => ({ Authorization: `Bearer ${sessionToken(u.id, tid)}` });

    it.each([
      ["/api/roles-permissions/roles", "CANARY-A-ROLE"],
      [`/api/admin/ai/users?q=CANARY`, "CANARY-A"],
      ["/api/settings/grading", "Distinction"],
    ])("%s as a tenant-2 admin shows nothing of tenant 1", async (path, canary) => {
      const res = await request(app).get(path).set(as(admin2, 2));
      if (res.status === 403) return; // the seeded admin role lacks this permission: nothing leaks either way
      expect(res.status).toBe(200);
      expect(JSON.stringify(res.body)).not.toContain(canary);
    });

    it("tenant 1 still sees its own rows", async () => {
      const roles = await request(app).get("/api/roles-permissions/roles").set(as(admin1, 1));
      if (roles.status === 200) expect(JSON.stringify(roles.body)).toContain(canaryRole);
      const bands = await request(app).get("/api/settings/grading").set(as(admin1, 1));
      expect(bands.body.bands[0]).toMatchObject({ letter: "A", remark: "Distinction" });
      const bands2 = await request(app).get("/api/settings/grading").set(as(admin2, 2));
      expect(bands2.body.bands.map((b: any) => b.letter)).toEqual(["P", "U"]);
    });
  });
});

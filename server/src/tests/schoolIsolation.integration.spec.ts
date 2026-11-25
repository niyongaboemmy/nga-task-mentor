import "./isolationEnv";
import "reflect-metadata";
import crypto from "crypto";
import axios from "axios";
import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { sequelize } from "../config/database";
import { protect, requireDbStepUp } from "../middleware/auth";
import { Quiz, Role, User } from "../models";
import authRoutes from "../routes/auth";
import fileServer, { __fileServerPaths } from "../utils/fileServer";
import { fixedRegistry, setTenantRegistryForTests } from "../tenancy/registry";
import { provisionTenant } from "../tenancy/provision";
import { fallbackReport, resetFallbacksForTests } from "../tenancy/fallbacks";
import { revokeSessionsForMisSid, revokeSessionsForMisUser, resetRevocationCacheForTests } from "../services/sessionRevocation";
import { LOGOUT_EVENT, setJwksFetcher } from "../utils/ssoLogout";
import { createMisUserIdResolver } from "../activity/session";
import {
  DB_STEP_UP_AUDIENCE,
  SESSION_AUDIENCE,
  signDbStepUpToken,
  signSessionToken,
  verifySessionToken,
} from "../utils/sessionToken";
import { primaryTenantCtx, runWithTenant, TenantCtx } from "../vendor/nga-tenancy";
import { buildTestApp, ensureModelsRegistered } from "./testApp";
// The live-server's own handshake check, run on the very tokens this API mints.
import { verifySocketToken } from "../../../live-server/src/socketAuth";

/**
 * School isolation audit 2026-11-25 -- Task Mentor findings, one block per
 * finding ID, against two real tenant databases (DB_NAME = school 1,
 * `${DB_NAME}_t2` = school 2). Runs only on a throw-away tm_mt_* database.
 */

const safe = /^tm_mt_/.test(process.env.DB_NAME || "");
const d = safe ? describe : describe.skip;

const T1 = primaryTenantCtx();
const T2: TenantCtx = { ...T1, tid: 2, slug: "school-two", name: "School Two", isPrimary: false, pkg: "starter" };
const RUN = `${Date.now()}`.slice(-7);
const SECRET = () => process.env.JWT_SECRET!;
const inT = <R>(t: TenantCtx, fn: () => Promise<R>) => runWithTenant(t, fn);

/** A session as Task Mentor signs it today (typ + aud). */
const session = (u: { id: number }, t: TenantCtx, extra: { sid?: string } = {}) =>
  signSessionToken({ id: u.id, role: "admin", tid: t.tid, sid: extra.sid });
/** A session as Task Mentor signed it before this change (tid, no typ/aud). */
const legacySession = (id: number, tid: number, extra: Record<string, unknown> = {}) =>
  jwt.sign({ id, role: "admin", tid, ...extra }, SECRET(), { expiresIn: "1h" });
/** The pre-fix step-up token: {id, dbAccess} with JWT_SECRET, no tid. */
const oldStepUp = (id: number) => jwt.sign({ id, dbAccess: true }, SECRET(), { expiresIn: 1200 });

const created: Array<{ t: TenantCtx; id: number }> = [];
async function mkUser(t: TenantCtx, tag: string, role: "admin" | "instructor" | "student", extra: Record<string, unknown> = {}) {
  return inT(t, async () => {
    const r = await Role.findOne({ where: { name: role } });
    const u = await User.create({
      first_name: "ISO",
      last_name: tag,
      email: `iso.${tag}.${RUN}@local.test`,
      password: "MIS_AUTH",
      role,
      role_id: r?.id ?? null,
      ...extra,
    } as any);
    created.push({ t, id: u.id });
    return u;
  });
}

d("school isolation (2026-11-25 audit, Task Mentor)", () => {
  let app: express.Express;
  let admin2: User; // school 2's admin -- the attacker in TM-ISO-1
  let victim1: User; // school 1's user with the SAME local id
  let admin1: User;
  let quiz1: Quiz;
  let postSpy: jest.SpyInstance;

  beforeAll(async () => {
    await ensureModelsRegistered();
    setTenantRegistryForTests(fixedRegistry([T1, T2]));
    await provisionTenant(T2);
    app = buildTestApp();
    app.use("/api/auth", authRoutes);

    admin2 = await mkUser(T2, "admin2", "admin", { mis_user_id: 700000 + Number(RUN.slice(-4)) });
    // School 1's account that shares admin2's local id: the NGA user the old
    // step-up token turned admin2 into.
    victim1 =
      (await inT(T1, () => User.findByPk(admin2.id))) ??
      (await mkUser(T1, "victim1", "admin", { id: admin2.id }));
    admin1 = await mkUser(T1, "admin1", "admin");
    quiz1 = await inT(T1, () =>
      Quiz.create({ title: `CANARY-T1-QUIZ-${RUN}`, description: "t1", created_by: admin1.id, status: "published" } as any),
    );
    // MIS /auth/login (the password re-check) answers 200 for these tests.
    postSpy = jest.spyOn(axios, "post").mockImplementation(async (url: string) => {
      if (String(url).endsWith("/auth/login")) return { status: 200, data: { data: {} } } as any;
      throw new Error(`unexpected POST ${url}`);
    });
  }, 120_000);

  afterAll(async () => {
    postSpy.mockRestore();
    await inT(T1, () => Quiz.scope("withDeleted").destroy({ where: { id: quiz1.id }, force: true } as any));
    for (const { t, id } of created) await inT(t, () => User.destroy({ where: { id } }));
    setTenantRegistryForTests(null);
    await sequelize.close();
  });

  const confirm = (token: string) =>
    request(app).post("/api/auth/confirm-db-access").set("Authorization", `Bearer ${token}`).send({ password: "pw" });

  // ── TM-ISO-1 ──────────────────────────────────────────────────────────────
  describe("TM-ISO-1: the DB step-up token is not a session", () => {
    let stepUp2: string;

    beforeAll(async () => {
      const res = await confirm(session(admin2, T2));
      expect(res.status).toBe(200);
      stepUp2 = res.body.dbAccessToken;
    });

    it("TM-ISO-1: confirm-db-access mints a typed, school-bound token signed with its own key", () => {
      const claims = jwt.decode(stepUp2) as any;
      expect(claims).toMatchObject({ id: admin2.id, tid: 2, typ: "db-step-up", aud: DB_STEP_UP_AUDIENCE });
      expect(claims.dbAccess).toBeUndefined();
      expect(claims.exp - claims.iat).toBeLessThanOrEqual(1200);
      expect(() => jwt.verify(stepUp2, SECRET())).toThrow(); // not JWT_SECRET
    });

    it("TM-ISO-1: the school-2 step-up token does not open /api/auth/me (as school 1 or otherwise)", async () => {
      expect(victim1.id).toBe(admin2.id);
      for (const t of [stepUp2, oldStepUp(admin2.id)]) {
        const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${t}`);
        expect(res.status).toBe(401);
        expect(JSON.stringify(res.body)).not.toContain(victim1.email);
        const cookie = await request(app).get("/api/auth/me").set("Cookie", `tm_auth_token=${t}`);
        expect(cookie.status).toBe(401);
      }
      // Control: admin2's real session works, in school 2.
      const ok = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${session(admin2, T2)}`);
      expect(ok.status).toBe(200);
      expect(JSON.stringify(ok.body)).toContain(admin2.email);
    });

    it("TM-ISO-1: the step-up token does not read school 1's quiz", async () => {
      for (const t of [stepUp2, oldStepUp(admin2.id)]) {
        const res = await request(app).get(`/api/quizzes/${quiz1.id}`).set("Authorization", `Bearer ${t}`);
        expect(res.status).toBe(401);
        expect(JSON.stringify(res.body)).not.toContain("CANARY-T1-QUIZ");
      }
      // Control: school 1's admin reads it.
      const ok = await request(app).get(`/api/quizzes/${quiz1.id}`).set("Authorization", `Bearer ${session(admin1, T1)}`);
      expect(ok.status).toBe(200);
      expect(JSON.stringify(ok.body)).toContain("CANARY-T1-QUIZ");
    });

    it("TM-ISO-1: the step-up token can't be refreshed into a 30-day session", async () => {
      for (const t of [stepUp2, oldStepUp(admin2.id)]) {
        const res = await request(app).post("/api/auth/refresh-token").set("Cookie", `tm_auth_token=${t}`);
        expect(res.status).toBe(401);
        expect(res.body.token).toBeUndefined();
        expect(res.headers["set-cookie"]).toBeUndefined();
      }
    });

    it("TM-ISO-1: the live-server, the activity relay and TMCode refuse it", async () => {
      for (const t of [stepUp2, oldStepUp(admin2.id)]) {
        expect(() => verifySocketToken(t, SECRET())).toThrow("Invalid token");
        const resolve = createMisUserIdResolver({ findMisUserId: async () => 1, revokedAt: async () => null });
        expect(await resolve({ headers: { authorization: `Bearer ${t}` } } as any)).toBeNull();
        const tm = await request(app).get("/api/tmcode/auth/me").set("Authorization", `Bearer ${t}`);
        expect(tm.status).toBe(401);
      }
      // Control: a real session passes the live-server check, in its own school.
      expect(verifySocketToken(session(admin2, T2), SECRET())).toMatchObject({ userId: admin2.id, tid: 2, via: "session" });
    });

    describe("TM-ISO-1: it still does its own job, in its own school only", () => {
      const stepApp = () => {
        const a = express();
        a.get("/step", protect, requireDbStepUp, (req, res) => res.json({ ok: true, tid: req.tenant?.tid }));
        return a;
      };

      it("TM-ISO-1: a school-2 step-up passes requireDbStepUp with the school-2 session that asked for it", async () => {
        const res = await request(stepApp())
          .get("/step")
          .set("Authorization", `Bearer ${session(admin2, T2)}`)
          .set("X-Db-Access-Token", stepUp2);
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ ok: true, tid: 2 });
      });

      it("TM-ISO-1: refused with school 1's session of the same id, another user, or the old token shape", async () => {
        const call = (sessionToken: string, stepUp: string) =>
          request(stepApp()).get("/step").set("Authorization", `Bearer ${sessionToken}`).set("X-Db-Access-Token", stepUp);
        expect((await call(session(victim1, T1), stepUp2)).status).toBe(401); // other school, same id
        expect((await call(session(admin2, T2), signDbStepUpToken(admin2.id + 1, 2))).status).toBe(401);
        expect((await call(session(admin2, T2), oldStepUp(admin2.id))).status).toBe(401);
        expect((await call(session(admin2, T2), session(admin2, T2))).status).toBe(401); // a session is no step-up
      });

      it("TM-ISO-1: the DB console is school-1 only -- a school-2 admin can't use it even with a valid step-up", async () => {
        const saved = process.env.DB_CONSOLE_ENABLED;
        process.env.DB_CONSOLE_ENABLED = "true";
        try {
          const s2 = await request(app)
            .get("/api/database/tables")
            .set("Authorization", `Bearer ${session(admin2, T2)}`)
            .set("X-Db-Access-Token", stepUp2);
          expect(s2.status).toBe(404);
          expect(s2.body.code).toBe("DB_CONSOLE_DISABLED");
          // School 1: the step-up from its own confirm opens the console...
          const step1 = (await confirm(session(admin1, T1))).body.dbAccessToken;
          const s1 = await request(app)
            .get("/api/database/tables")
            .set("Authorization", `Bearer ${session(admin1, T1)}`)
            .set("X-Db-Access-Token", step1);
          expect(s1.status).toBe(200);
          // ...and a school-2 step-up never does, even for the same local id.
          const cross = await request(app)
            .get("/api/database/tables")
            .set("Authorization", `Bearer ${session(victim1, T1)}`)
            .set("X-Db-Access-Token", stepUp2);
          expect(cross.status).toBe(401);
        } finally {
          if (saved === undefined) delete process.env.DB_CONSOLE_ENABLED;
          else process.env.DB_CONSOLE_ENABLED = saved;
        }
      });
    });
  });

  // ── TM-ISO-2 ──────────────────────────────────────────────────────────────
  describe("TM-ISO-2: session tokens are typed; refresh checks like protect", () => {
    it("TM-ISO-2: every session TM signs carries typ=session and aud=task-mentor (and the school)", async () => {
      const t = await inT(T2, async () => admin2.getSignedJwtToken(5, 6, "sidABCDEF1"));
      expect(jwt.decode(t)).toMatchObject({ id: admin2.id, tid: 2, typ: "session", aud: SESSION_AUDIENCE, termId: 5, academicYearId: 6, sid: "sidABCDEF1" });
      expect(verifySessionToken(t).id).toBe(admin2.id);
    });

    it("TM-ISO-2: legacy compatibility -- an old-shape session (tid, no typ) still works; an old token with dbAccess doesn't", async () => {
      const legacy = legacySession(admin2.id, 2);
      const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${legacy}`);
      expect(me.status).toBe(200);
      const refreshed = await request(app).post("/api/auth/refresh-token").set("Cookie", `tm_auth_token=${legacy}`);
      expect(refreshed.status).toBe(200);
      expect(jwt.decode(refreshed.body.token)).toMatchObject({ id: admin2.id, tid: 2, typ: "session" });
      expect(verifySocketToken(legacy, SECRET())).toMatchObject({ userId: admin2.id, tid: 2 });

      for (const bad of [
        legacySession(admin2.id, 2, { dbAccess: true }),
        legacySession(admin2.id, 2, { purpose: "anything" }),
        legacySession(admin2.id, 2, { typ: "db-step-up" }),
        jwt.sign({ id: admin2.id, tid: 2, typ: "session" }, SECRET()), // typ session without our audience
        jwt.sign({ id: admin2.id, tid: 2 }, SECRET(), { audience: "elsewhere" }),
      ]) {
        expect((await request(app).get("/api/auth/me").set("Authorization", `Bearer ${bad}`)).status).toBe(401);
        expect((await request(app).post("/api/auth/refresh-token").set("Cookie", `tm_auth_token=${bad}`)).status).toBe(401);
      }
    });

    it("TM-ISO-2: refresh-token refuses an MIS token of another school (TENANT_MISMATCH)", async () => {
      const misOther = jwt.sign({ sub: "5", tid: 1 }, "any-mis-key");
      const res = await request(app)
        .post("/api/auth/refresh-token")
        .set("Cookie", [`tm_auth_token=${session(admin2, T2)}`, `misToken=${misOther}`]);
      expect(res.status).toBe(401);
      expect(res.body.code).toBe("TENANT_MISMATCH");
      const misSame = jwt.sign({ sub: "5", tid: 2 }, "any-mis-key");
      const ok = await request(app)
        .post("/api/auth/refresh-token")
        .set("Cookie", [`tm_auth_token=${session(admin2, T2)}`, `misToken=${misSame}`]);
      expect(ok.status).toBe(200);
    });

    it("TM-ISO-2: refresh-token refuses a session ended by back-channel logout (sid, then the whole user)", async () => {
      const u = await mkUser(T2, "revoked", "student", { mis_user_id: 710000 + Number(RUN.slice(-4)) });
      const sidToken = session(u, T2, { sid: "sidREVOKE01" });
      const otherSid = session(u, T2, { sid: "sidKEEP0001" });
      await inT(T2, () => revokeSessionsForMisSid(String(u.mis_user_id), "sidREVOKE01", new Date(Date.now() + 5_000)));
      const r1 = await request(app).post("/api/auth/refresh-token").set("Cookie", `tm_auth_token=${sidToken}`);
      expect(r1.status).toBe(401);
      expect(r1.body.code).toBe("SESSION_ENDED");
      expect((await request(app).post("/api/auth/refresh-token").set("Cookie", `tm_auth_token=${otherSid}`)).status).toBe(200);
      // The same user id in school 1 is untouched by school 2's revocation.
      const sameIdT1 = (await inT(T1, () => User.findByPk(u.id))) ?? (await mkUser(T1, "revokedtwin", "student", { id: u.id }));
      expect((await request(app).post("/api/auth/refresh-token").set("Cookie", `tm_auth_token=${session(sameIdT1, T1)}`)).status).toBe(200);
      await inT(T2, () => revokeSessionsForMisUser(String(u.mis_user_id), new Date(Date.now() + 5_000)));
      const r2 = await request(app).post("/api/auth/refresh-token").set("Cookie", `tm_auth_token=${otherSid}`);
      expect(r2.status).toBe(401);
      expect(r2.body.code).toBe("SESSION_ENDED");
      resetRevocationCacheForTests();
    });
  });

  // ── TM-ISO-3 / TM-ISO-8 ───────────────────────────────────────────────────
  describe("TM-ISO-3/8: back-channel logout must name the school", () => {
    const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
    const jwk = { ...(publicKey.export({ format: "jwk" }) as object), kid: "iso1", alg: "RS256", use: "sig" };
    const logoutToken = (claims: Record<string, unknown>) =>
      jwt.sign(
        { iss: process.env.NGA_MIS_BASE_URL, aud: process.env.SSO_CLIENT_ID || "taskmentor_app", jti: crypto.randomUUID(), events: { [LOGOUT_EVENT]: {} }, ...claims },
        privateKey,
        { algorithm: "RS256", keyid: "iso1", expiresIn: 120 },
      );

    beforeAll(() => setJwksFetcher(async () => ({ keys: [jwk as any] })));
    afterAll(() => setJwksFetcher(null));

    it("TM-ISO-3/8: a logout token without tid is refused and counted as payload_no_tid; nothing is revoked", async () => {
      const u = await mkUser(T1, "bclnotid", "student", { mis_user_id: 720000 + Number(RUN.slice(-4)) });
      resetFallbacksForTests();
      const res = await request(app).post("/api/auth/backchannel-logout").send({ logout_token: logoutToken({ sub: String(u.mis_user_id) }) });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("invalid_request");
      expect(fallbackReport().counts.payload_no_tid).toBe(1);
      // School 1's session of that MIS id still works.
      expect((await request(app).get("/api/auth/me").set("Authorization", `Bearer ${session(u, T1)}`)).status).toBe(200);
    });

    it("TM-ISO-3/8: with tid it ends that school's sessions only", async () => {
      const mis = 730000 + Number(RUN.slice(-4));
      const u1 = await mkUser(T1, "bcl1", "student", { mis_user_id: mis });
      const u2 = await mkUser(T2, "bcl2", "student", { mis_user_id: mis });
      const t1 = session(u1, T1);
      const t2 = session(u2, T2);
      await new Promise((r) => setTimeout(r, 1100)); // revocation is per second
      const res = await request(app).post("/api/auth/backchannel-logout").send({ logout_token: logoutToken({ sub: String(mis), tid: 2 }) });
      expect(res.status).toBe(200);
      resetRevocationCacheForTests();
      expect((await request(app).get("/api/auth/me").set("Authorization", `Bearer ${t2}`)).status).toBe(401);
      expect((await request(app).get("/api/auth/me").set("Authorization", `Bearer ${t1}`)).status).toBe(200);
    });
  });

  // ── TM-ISO-4 / TM-ISO-7 ───────────────────────────────────────────────────
  describe("TM-ISO-4/7: legacy media and cache headers", () => {
    let spy: jest.SpyInstance;
    const seen: Array<{ tid: number | null; candidates: string[] }> = [];

    beforeAll(() => {
      spy = jest.spyOn(fileServer, "streamTo").mockImplementation(async (p: string, res: any, candidates?: string[]) => {
        const { currentTenantOrNull } = await import("../vendor/nga-tenancy");
        const list = candidates ?? __fileServerPaths.readCandidates(p);
        seen.push({ tid: currentTenantOrNull()?.tid ?? null, candidates: list });
        res.status(200).send(`served ${list.join(",")}`);
        return true;
      });
    });
    afterAll(() => spy.mockRestore());
    beforeEach(() => (seen.length = 0));

    const img = "editor-images/legacy-canary.png";

    it("TM-ISO-4: an anonymous request still gets legacy (school 1) editor images -- by design", async () => {
      const res = await request(app).get(`/uploads/${img}`);
      expect(res.status).toBe(200);
      expect(seen[0].tid).toBe(1);
    });

    it("TM-ISO-4: a request carrying any sign of another school gets 404, never school 1's legacy media", async () => {
      const mis2 = jwt.sign({ sub: "9", tid: 2 }, "any-mis-key");
      const probes = [
        request(app).get(`/uploads/${img}`).set("Cookie", `misToken=${mis2}`),
        request(app).get(`/uploads/${img}`).set("x-mis-token", mis2),
        request(app).get(`/uploads/${img}`).set("Cookie", "nga_school=2.abcdefgh12"),
        request(app).get(`/uploads/${img}`).set("X-NGA-Tenant", "2"),
        request(app).get(`/uploads/${img}?tid=2`),
        request(app).get(`/uploads/${img}?t=2`),
      ];
      for (const res of await Promise.all(probes)) expect(res.status).toBe(404);
      expect(seen).toHaveLength(0);
      // School 1 hints are fine.
      expect((await request(app).get(`/uploads/${img}`).set("Cookie", "nga_school=1.abcdefgh12")).status).toBe(200);
    });

    it("TM-ISO-4: a school-2 session reads only school 2's namespace; a school-1 session may read legacy", async () => {
      const s2 = await request(app).get(`/uploads/${img}`).set("Authorization", `Bearer ${session(admin2, T2)}`);
      expect(s2.status).toBe(200);
      expect(seen[0].tid).toBe(2);
      expect(seen[0].candidates).toEqual([__fileServerPaths.namespaced(img, 2)]);
      const s1 = await request(app).get(`/uploads/${img}`).set("Authorization", `Bearer ${session(admin1, T1)}`);
      expect(s1.status).toBe(200);
      expect(seen[1].tid).toBe(1);
      expect(seen[1].candidates).toEqual([__fileServerPaths.namespaced(img, 1), __fileServerPaths.legacyNamespaced(img)]);
    });

    it("TM-ISO-7: /uploads responses are private, no-store and vary on Authorization/Cookie", async () => {
      for (const res of [
        await request(app).get(`/uploads/${img}`),
        await request(app).get(`/uploads/${img}`).set("Authorization", `Bearer ${session(admin2, T2)}`),
        await request(app).get(`/uploads/submissions/none.pdf`),
      ]) {
        expect(res.headers["cache-control"]).toBe("private, no-store");
        expect(res.headers.vary).toMatch(/Authorization/);
        expect(res.headers.vary).toMatch(/Cookie/);
      }
    });
  });
});

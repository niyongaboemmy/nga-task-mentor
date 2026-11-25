import crypto from "crypto";
import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import {
  isSessionClaims,
  PREVIEW_AUDIENCE,
  PREVIEW_TYP,
  previewSecret,
  signDbStepUpToken,
  signPreviewToken,
  signSessionToken,
  verifyPreviewToken,
  verifySessionToken,
} from "../sessionToken";
import { servePreview } from "../../controllers/tmcodePracticals.controller";
import { ProjectRevision } from "../../models";
import { fixedRegistry, setTenantRegistryForTests } from "../../tenancy/registry";
import { currentTenantOrNull, primaryTenantCtx, TenantCtx } from "../../vendor/nga-tenancy";

/**
 * TMCode web preview tokens: their own derived key, a `typ`, and the school
 * (`tid`) they were made in. A token from school A only ever reads school A,
 * and a preview token is never a session.
 */

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-for-preview-tokens";
const SECRET = () => process.env.JWT_SECRET!;

describe("TMCode preview tokens", () => {
  it("round-trips project, revision and school", () => {
    expect(verifyPreviewToken(signPreviewToken({ p: 7, r: 41, tid: 2 }))).toEqual({ p: 7, r: 41, tid: 2 });
  });

  it("refuses to sign without a school", () => {
    expect(() => signPreviewToken({ p: 7, r: 41, tid: 0 })).toThrow();
    expect(() => signPreviewToken({ p: 7, r: 41, tid: undefined as unknown as number })).toThrow();
  });

  it("is signed with its own derived key, not JWT_SECRET", () => {
    const t = signPreviewToken({ p: 7, r: 41, tid: 2 });
    expect(() => jwt.verify(t, SECRET())).toThrow(/invalid signature/);
    expect(() => jwt.verify(t, previewSecret())).not.toThrow();
  });

  it("never passes as a session", () => {
    const t = signPreviewToken({ p: 7, r: 41, tid: 2 });
    expect(() => verifySessionToken(t)).toThrow();
    // Even if it were somehow signed with the session key, its claims are not a session.
    expect(isSessionClaims(jwt.decode(t))).toBe(false);
    const sameClaimsSessionKey = jwt.sign({ id: 7, p: 7, r: 41, tid: 2, typ: PREVIEW_TYP }, SECRET(), { audience: PREVIEW_AUDIENCE });
    expect(() => verifySessionToken(sameClaimsSessionKey)).toThrow();
  });

  it("refuses sessions, step-up tokens and the old untyped HMAC token", () => {
    expect(verifyPreviewToken(signSessionToken({ id: 7, role: "admin", tid: 2 }))).toBeNull();
    expect(verifyPreviewToken(signDbStepUpToken(7, 2))).toBeNull();
    const payload = Buffer.from(JSON.stringify({ p: 7, r: 41, e: Date.now() + 60_000 })).toString("base64url");
    const oldSig = crypto.createHmac("sha256", SECRET()).update(payload).digest("base64url");
    expect(verifyPreviewToken(`${payload}.${oldSig}`)).toBeNull();
  });

  it("refuses a token with the right key but the wrong kind, audience or no school", () => {
    const opts = { audience: PREVIEW_AUDIENCE, expiresIn: 60 };
    expect(verifyPreviewToken(jwt.sign({ p: 7, r: 41, tid: 2, typ: "session" }, previewSecret(), opts))).toBeNull();
    expect(verifyPreviewToken(jwt.sign({ p: 7, r: 41, typ: PREVIEW_TYP }, previewSecret(), opts))).toBeNull();
    expect(verifyPreviewToken(jwt.sign({ p: 7, r: 41, tid: 2, typ: PREVIEW_TYP }, previewSecret(), { audience: "task-mentor", expiresIn: 60 }))).toBeNull();
  });
});

describe("GET /api/tmcode/preview/:token/* reads the token's school only", () => {
  const T1 = primaryTenantCtx();
  const T2: TenantCtx = { ...T1, tid: 2, slug: "school-two", name: "School Two", isPrimary: false, pkg: "starter" };
  const app = express();
  app.get("/api/tmcode/preview/:token/*", servePreview);
  let seenTid: number | null | undefined;
  let spy: jest.SpyInstance;

  beforeAll(() => setTenantRegistryForTests(fixedRegistry([T1, T2])));
  afterAll(() => setTenantRegistryForTests(null));
  beforeEach(() => {
    seenTid = undefined;
    spy = jest.spyOn(ProjectRevision, "findByPk").mockImplementation(async () => {
      seenTid = currentTenantOrNull()?.tid ?? null;
      return null;
    });
  });
  afterEach(() => spy.mockRestore());

  it("looks the revision up inside the school the token names", async () => {
    const t = signPreviewToken({ p: 7, r: 41, tid: 2 });
    const res = await request(app).get(`/api/tmcode/preview/${t}/index.html`);
    expect(res.status).toBe(404); // the mocked revision doesn't exist
    expect(spy).toHaveBeenCalledWith(41);
    expect(seenTid).toBe(2);
  });

  it("refuses a request that names another school, without reading anything", async () => {
    const t = signPreviewToken({ p: 7, r: 41, tid: 2 });
    expect((await request(app).get(`/api/tmcode/preview/${t}/index.html`).set("X-NGA-Tenant", "1")).status).toBe(404);
    expect((await request(app).get(`/api/tmcode/preview/${t}/index.html?tid=1`)).status).toBe(404);
    expect(spy).not.toHaveBeenCalled();
  });

  it("refuses an unknown school, a session token and the old token shape", async () => {
    const unknown = signPreviewToken({ p: 7, r: 41, tid: 99 });
    expect((await request(app).get(`/api/tmcode/preview/${unknown}/index.html`)).status).toBe(401);
    const sessionTok = signSessionToken({ id: 7, role: "admin", tid: 2 });
    expect((await request(app).get(`/api/tmcode/preview/${sessionTok}/index.html`)).status).toBe(410);
    const payload = Buffer.from(JSON.stringify({ p: 7, r: 41, e: Date.now() + 60_000 })).toString("base64url");
    const oldSig = crypto.createHmac("sha256", SECRET()).update(payload).digest("base64url");
    expect((await request(app).get(`/api/tmcode/preview/${payload}.${oldSig}/index.html`)).status).toBe(410);
    expect(spy).not.toHaveBeenCalled();
  });
});

import crypto from "crypto";
import jwt from "jsonwebtoken";

/**
 * School switching on the server (TENANT_SWITCHING_PLAN.md Appendix A):
 * sid-scoped back-channel revocation (A.3), the fallback counter and its
 * report to MIS (A.6), and the automatic strict flag (A.6).
 */

// In-memory stand-ins for the two revocation tables and the users table.
const userRows = new Map<number, Date>();
const sidRows = new Map<string, Date>();
const users = [{ id: 11 }, { id: 12 }];

jest.mock("../config/database", () => ({
  sequelize: {
    query: jest.fn(async (sql: string, opts: any = {}) => {
      const r = opts.replacements ?? [];
      if (/^CREATE TABLE/i.test(sql.trim())) return [[], 0];
      if (/INSERT INTO session_sid_revocations/.test(sql)) {
        sidRows.set(`${r[0]}|${r[1]}`, r[2]);
        return [[], 1];
      }
      if (/INSERT INTO session_revocations/.test(sql)) {
        userRows.set(r[0], r[1]);
        return [[], 1];
      }
      if (/FROM session_sid_revocations/.test(sql)) {
        const at = sidRows.get(`${r[0]}|${r[1]}`);
        return at ? [{ revoked_at: at }] : [];
      }
      if (/FROM session_revocations/.test(sql)) {
        const at = userRows.get(r[0]);
        return at ? [{ revoked_at: at }] : [];
      }
      throw new Error(`unexpected SQL ${sql}`);
    }),
  },
}));
jest.mock("../models/User.model", () => ({
  User: { findAll: jest.fn(async () => users) },
}));
jest.mock("axios");

import axios from "axios";
import {
  getRevokedAt,
  normalizeSid,
  resetRevocationCacheForTests,
  revokeSessionsForMisSid,
  revokeSessionsForMisUser,
} from "../services/sessionRevocation";
import { issuedBeforeRevocation, LOGOUT_EVENT, setJwksFetcher, verifyLogoutTokenSubject } from "../utils/ssoLogout";
import { countFallback, fallbackReport, reportFallbacks, resetFallbacksForTests } from "../tenancy/fallbacks";
import { applyRegistryStrict, setStrictForTests, strictActive, strictFlagFromBody } from "../tenancy/strict";
import { legacyDefaultTid, tenancyMode } from "../tenancy/config";
import { loadTenantsFromMis, setTenantRegistryForTests } from "../tenancy/registry";
import { misTokenSid, tidOfClaims } from "../tenancy/request";
import { tidOrPrimary } from "../tenancy/keys";
import { normalizeMySchools } from "../services/schoolSwitch";
import { primaryTenantCtx, runWithTenant } from "../vendor/nga-tenancy";

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("sid-scoped single sign-out (A.3)", () => {
  beforeEach(() => {
    userRows.clear();
    sidRows.clear();
    resetRevocationCacheForTests();
  });

  const iatBefore = (ms: number) => Math.floor((Date.now() - ms) / 1000);

  it("a logout with sid ends that MIS session and sessions without a sid, nothing else", async () => {
    const at = new Date(Date.now() + 5_000); // later than every token below
    await revokeSessionsForMisSid("42", "sidAAAA1", at);
    const iat = iatBefore(1000);
    expect(issuedBeforeRevocation(iat, await getRevokedAt(11, "sidAAAA1"))).toBe(true);
    expect(issuedBeforeRevocation(iat, await getRevokedAt(11, null))).toBe(true); // no sid: can't tell apart
    expect(issuedBeforeRevocation(iat, await getRevokedAt(11))).toBe(true);
    expect(issuedBeforeRevocation(iat, await getRevokedAt(11, "sidBBBB2"))).toBe(false); // other device
    expect(issuedBeforeRevocation(iat, await getRevokedAt(12, "sidBBBB2"))).toBe(false);
  });

  it("a logout without sid still ends every session (current behaviour)", async () => {
    const at = new Date(Date.now() + 5_000);
    await revokeSessionsForMisUser("42", at);
    expect(issuedBeforeRevocation(iatBefore(1000), await getRevokedAt(11, "sidBBBB2"))).toBe(true);
    expect(issuedBeforeRevocation(iatBefore(1000), await getRevokedAt(12, null))).toBe(true);
  });

  it("an empty or malformed sid falls back to ending every session", async () => {
    const at = new Date(Date.now() + 5_000);
    await revokeSessionsForMisSid("42", "", at);
    expect(issuedBeforeRevocation(iatBefore(1000), await getRevokedAt(11, "sidBBBB2"))).toBe(true);
    expect(normalizeSid("bad sid!")).toBe("");
    expect(normalizeSid("ok_sid-1")).toBe("ok_sid-1");
  });

  it("a sign-in after the logout stays valid", async () => {
    await revokeSessionsForMisSid("42", "sidAAAA1", new Date(Date.now() - 10_000));
    expect(issuedBeforeRevocation(Math.floor(Date.now() / 1000), await getRevokedAt(11, "sidAAAA1"))).toBe(false);
  });

  it("reads sid from the logout token and from an MIS token", async () => {
    const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
    const jwk = { ...(publicKey.export({ format: "jwk" }) as object), kid: "k1", alg: "RS256" };
    setJwksFetcher(async () => ({ keys: [jwk as any] }));
    const MIS = "https://api.amashuri.com";
    const sign = (extra: Record<string, unknown>) =>
      jwt.sign(
        { iss: MIS, aud: "taskmentor_app", jti: crypto.randomUUID(), sub: "42", tid: 2, events: { [LOGOUT_EVENT]: {} }, ...extra },
        privateKey,
        { algorithm: "RS256", keyid: "k1", expiresIn: 120 },
      );
    const cfg = { misBaseUrl: MIS, clientId: "taskmentor_app" };
    await expect(verifyLogoutTokenSubject(sign({ sid: "sidAAAA1" }), cfg)).resolves.toEqual({ sub: "42", tid: 2, sid: "sidAAAA1" });
    await expect(verifyLogoutTokenSubject(sign({}), cfg)).resolves.toEqual({ sub: "42", tid: 2, sid: null });
    setJwksFetcher(null);

    expect(misTokenSid(jwt.sign({ sub: "5", tid: 2, sid: "abcDEF12" }, "k"))).toBe("abcDEF12");
    expect(misTokenSid(jwt.sign({ sub: "5", tid: 2 }, "k"))).toBeNull();
    expect(misTokenSid("not-a-jwt")).toBeNull();
  });
});

describe("fallback counter and report (A.6)", () => {
  const env = { NGA_MIS_BASE_URL: "https://mis.test/", SSO_CLIENT_ID: "taskmentor_app", SSO_CLIENT_SECRET: "s", TENANCY_REGISTRY: "mis" } as any;

  beforeEach(() => {
    resetFallbacksForTests(() => new Date("2026-11-25T10:00:00Z"));
    mockedAxios.post.mockReset();
  });
  afterAll(() => resetFallbacksForTests());

  it("counts by kind with up to 10 sites, cumulative for the UTC day", () => {
    expect(fallbackReport()).toEqual({ app: "taskmentor", day: "2026-11-25", counts: { no_context: 0, legacy_tid: 0, payload_no_tid: 0 } });
    countFallback("no_context", "dbRouter");
    countFallback("no_context", "dbRouter");
    countFallback("legacy_tid", "session-token");
    countFallback("payload_no_tid");
    for (let i = 0; i < 20; i++) countFallback("no_context", `site${i}`);
    const r = fallbackReport();
    expect(r.counts).toEqual({ no_context: 22, legacy_tid: 1, payload_no_tid: 1 });
    expect(r.sites).toHaveLength(10);
    expect(r.sites?.[0]).toBe("no_context:dbRouter");
  });

  it("starts again at a new UTC day", () => {
    let now = new Date("2026-11-25T23:59:00Z");
    resetFallbacksForTests(() => now);
    countFallback("legacy_tid");
    now = new Date("2026-11-26T00:01:00Z");
    expect(fallbackReport()).toEqual({ app: "taskmentor", day: "2026-11-26", counts: { no_context: 0, legacy_tid: 0, payload_no_tid: 0 } });
  });

  it("counts the shared fallback sites", () => {
    expect(tidOrPrimary("unit")).toBe(1);
    expect(runWithTenant({ ...primaryTenantCtx(), tid: 3 }, () => tidOrPrimary("unit"))).toBe(3);
    expect(tidOfClaims({ tid: 2 })).toBe(2);
    expect(tidOfClaims({})).toBe(1);
    expect(fallbackReport().counts).toEqual({ no_context: 1, legacy_tid: 1, payload_no_tid: 0 });
  });

  it("posts the report with the registry's service credentials, even when all zero", async () => {
    mockedAxios.post.mockResolvedValueOnce({ status: 204, data: {} });
    await expect(reportFallbacks(env)).resolves.toBe("sent");
    const [url, body, opts] = mockedAxios.post.mock.calls[0];
    expect(url).toBe("https://mis.test/platform/tenancy/fallbacks");
    expect(body).toEqual({ app: "taskmentor", day: "2026-11-25", counts: { no_context: 0, legacy_tid: 0, payload_no_tid: 0 } });
    expect((opts as any).headers.Authorization).toBe(`Basic ${Buffer.from("taskmentor_app:s").toString("base64")}`);
  });

  it("never throws when MIS refuses or lacks the endpoint, and skips without MIS", async () => {
    mockedAxios.post.mockRejectedValueOnce(Object.assign(new Error("Not Found"), { response: { status: 404 } }));
    await expect(reportFallbacks(env)).resolves.toBe("failed");
    mockedAxios.post.mockRejectedValueOnce(Object.assign(new Error("Forbidden"), { response: { status: 403 } }));
    await expect(reportFallbacks(env)).resolves.toBe("failed");
    await expect(reportFallbacks({ ...env, TENANCY_REGISTRY: "static" })).resolves.toBe("skipped");
    await expect(reportFallbacks({ TENANCY_REGISTRY: "mis" } as any)).resolves.toBe("skipped");
    expect(mockedAxios.post).toHaveBeenCalledTimes(2);
  });
});

describe("automatic strict mode (A.6)", () => {
  afterEach(() => setStrictForTests(false));

  it("reads tenancy.strict.taskmentor from the registry body", () => {
    expect(strictFlagFromBody({ tenants: [] })).toBe(false);
    expect(strictFlagFromBody({ tenancy: { strict: { taskmentor: true } } })).toBe(true);
    expect(strictFlagFromBody({ data: { tenancy: { strict: { taskmentor: true } } } })).toBe(true);
    expect(strictFlagFromBody({ tenancy: { strict: { tendo: true, taskmentor: false } } })).toBe(false);
    expect(strictFlagFromBody({ tenancy: { strict: { taskmentor: "yes" } } })).toBe(false);
    expect(strictFlagFromBody(null)).toBe(false);
  });

  it("acts as legacy tid none + enforce unless TENANCY_STRICT=off", () => {
    expect(tenancyMode({} as any)).toBe("shadow");
    expect(legacyDefaultTid({} as any)).toBe(1);
    applyRegistryStrict({ tenancy: { strict: { taskmentor: true } } });
    expect(strictActive({} as any)).toBe(true);
    expect(tenancyMode({} as any)).toBe("enforce");
    expect(legacyDefaultTid({ TENANCY_LEGACY_DEFAULT_TID: "1" } as any)).toBeNull();
    expect(tenancyMode({ TENANCY_STRICT: "off" } as any)).toBe("shadow");
    expect(legacyDefaultTid({ TENANCY_STRICT: "OFF" } as any)).toBe(1);
    applyRegistryStrict({ tenants: [] }); // an MIS without `tenancy` turns it off
    expect(tenancyMode({} as any)).toBe("shadow");
  });

  it("is applied from the registry fetch, and an old MIS without `tenancy` still loads", async () => {
    const env = { NGA_MIS_BASE_URL: "https://mis.test", SSO_CLIENT_ID: "a", SSO_CLIENT_SECRET: "b", TENANCY_REGISTRY: "mis" } as any;
    setTenantRegistryForTests(null);
    mockedAxios.get.mockResolvedValueOnce({
      data: { tenants: [{ tid: 1, slug: "nga", name: "NGA", status: "ACTIVE" }], tenancy: { strict: { taskmentor: true } } },
    });
    await loadTenantsFromMis(env);
    expect(strictActive({} as any)).toBe(true);
    mockedAxios.get.mockResolvedValueOnce({ data: { tenants: [{ tid: 1, slug: "nga", name: "NGA", status: "ACTIVE" }] } });
    const tenants = await loadTenantsFromMis(env);
    expect(tenants.map((t) => t.tid)).toEqual([1]);
    expect(strictActive({} as any)).toBe(false);
  });
});

describe("my-schools normalisation (A.4)", () => {
  it("keeps valid unique schools and marks the current one", () => {
    const schools = normalizeMySchools(
      { data: { schools: [{ tid: 1, slug: "nga", name: "NGA", logoUrl: "https://x/l.png" }, { tid: 2, name: "Other", current: false }, { tid: 2 }, { tid: "x" }] } },
      2,
    );
    expect(schools).toEqual([
      { tid: 1, slug: "nga", name: "NGA", logoUrl: "https://x/l.png", current: false },
      { tid: 2, slug: null, name: "Other", logoUrl: null, current: true },
    ]);
    expect(normalizeMySchools({ data: {} }, 1)).toEqual([]);
    expect(normalizeMySchools(null, 1)).toEqual([]);
  });
});

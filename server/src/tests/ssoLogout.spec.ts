import crypto from "crypto";
import jwt from "jsonwebtoken";
import { issuedBeforeRevocation, LOGOUT_EVENT, setJwksFetcher, verifyLogoutToken } from "../utils/ssoLogout";

/**
 * Single sign-out: the logout-token checks every NGA app runs on MIS's
 * back-channel POST (OIDC Back-Channel Logout 1.0 §2.6).
 */
const MIS = "https://api.amashuri.com";
const cfg = { misBaseUrl: MIS, clientId: "taskmentor_app" };
const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const kid = "k1";
const jwk = { ...(publicKey.export({ format: "jwk" }) as object), kid, alg: "RS256", use: "sig" };

const token = (claims: Record<string, unknown> = {}, opts: jwt.SignOptions = {}, key: crypto.KeyObject = privateKey) =>
  jwt.sign(
    { iss: MIS, aud: "taskmentor_app", jti: crypto.randomUUID(), sub: "42", events: { [LOGOUT_EVENT]: {} }, ...claims },
    key,
    { algorithm: "RS256", keyid: kid, expiresIn: 120, ...opts },
  );

describe("verifyLogoutToken", () => {
  beforeEach(() => setJwksFetcher(async () => ({ keys: [jwk as any] })));
  afterAll(() => setJwksFetcher(null));

  it("accepts a valid token once and returns the MIS user id", async () => {
    const t = token();
    await expect(verifyLogoutToken(t, cfg)).resolves.toBe("42");
    await expect(verifyLogoutToken(t, cfg)).rejects.toThrow(/already used/);
  });

  it("rejects the wrong audience, issuer, key or event", async () => {
    await expect(verifyLogoutToken(token({ aud: "tupo" }), cfg)).rejects.toThrow(/invalid/);
    await expect(verifyLogoutToken(token({ iss: "https://evil.example" }), cfg)).rejects.toThrow(/invalid/);
    const other = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey;
    await expect(verifyLogoutToken(token({}, {}, other), cfg)).rejects.toThrow(/invalid/);
    await expect(verifyLogoutToken(token({ events: { other: {} } }), cfg)).rejects.toThrow(/not a logout event/);
    await expect(verifyLogoutToken(token({ nonce: "n" }), cfg)).rejects.toThrow(/nonce/);
    await expect(verifyLogoutToken(token({ sub: undefined }), cfg)).rejects.toThrow(/subject/);
  });

  it("rejects expired tokens, HS256 and garbage", async () => {
    await expect(verifyLogoutToken(token({}, { expiresIn: -600 }), cfg)).rejects.toThrow(/invalid/);
    const hs = jwt.sign({ iss: MIS, aud: "taskmentor_app", sub: "42", events: { [LOGOUT_EVENT]: {} } }, "secret", { keyid: kid });
    await expect(verifyLogoutToken(hs, cfg)).rejects.toThrow(/algorithm/);
    await expect(verifyLogoutToken("nope", cfg)).rejects.toThrow(/missing/);
    await expect(verifyLogoutToken(undefined, cfg)).rejects.toThrow(/missing/);
  });

  it("refetches keys when MIS rotates", async () => {
    let calls = 0;
    setJwksFetcher(async () => {
      calls++;
      return { keys: calls === 1 ? [] : [jwk as any] };
    });
    await expect(verifyLogoutToken(token(), cfg)).resolves.toBe("42");
    expect(calls).toBe(2);
  });
});

describe("issuedBeforeRevocation", () => {
  it("ends tokens issued before (or in the same second as) the sign-out", () => {
    const revoked = new Date("2026-09-30T10:00:00.400Z");
    expect(issuedBeforeRevocation(Date.parse("2026-09-30T09:59:00Z") / 1000, revoked)).toBe(true);
    expect(issuedBeforeRevocation(Date.parse("2026-09-30T10:00:00Z") / 1000, revoked)).toBe(true);
    expect(issuedBeforeRevocation(Date.parse("2026-09-30T10:00:01Z") / 1000, revoked)).toBe(false);
    expect(issuedBeforeRevocation(Date.parse("2026-09-30T10:00:02Z") / 1000, revoked)).toBe(false);
    expect(issuedBeforeRevocation(1, null)).toBe(false);
  });
});

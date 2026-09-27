import jwt from "jsonwebtoken";
import {
  extractHandshakeToken,
  LIVE_TICKET_TYPE,
  liveTicketSecret,
  resolveAllowedOrigins,
  resolveProctoringRole,
  SocketAuthError,
  verifySocketToken,
} from "../src/socketAuth";

const SECRET = "unit-test-secret";

const sessionToken = (payload: object, secret = SECRET, opts: jwt.SignOptions = {}) =>
  jwt.sign(payload, secret, { expiresIn: "1h", ...opts });

const ticket = (payload: object, secret = liveTicketSecret(SECRET), opts: jwt.SignOptions = {}) =>
  jwt.sign({ typ: LIVE_TICKET_TYPE, ...payload }, secret, { expiresIn: 120, ...opts });

describe("extractHandshakeToken", () => {
  it("prefers auth.token", () => {
    expect(
      extractHandshakeToken({
        auth: { token: "from-auth" },
        headers: { authorization: "Bearer from-header", cookie: "tm_auth_token=from-cookie" },
      }),
    ).toBe("from-auth");
  });

  it("falls back to the Authorization header, then the tm_auth_token cookie", () => {
    expect(extractHandshakeToken({ headers: { authorization: "Bearer abc" } })).toBe("abc");
    expect(
      extractHandshakeToken({ headers: { cookie: "a=1; tm_auth_token=xyz%3D; b=2" } }),
    ).toBe("xyz=");
  });

  it("ignores placeholder values and returns undefined when nothing is present", () => {
    expect(extractHandshakeToken({ auth: { token: "null" } })).toBeUndefined();
    expect(extractHandshakeToken({ auth: { token: "undefined" }, headers: {} })).toBeUndefined();
    expect(extractHandshakeToken({ headers: { cookie: "tm_auth_token=none" } })).toBeUndefined();
    expect(extractHandshakeToken({})).toBeUndefined();
  });
});

describe("verifySocketToken", () => {
  it("rejects a missing token", () => {
    expect(() => verifySocketToken(undefined, SECRET)).toThrow("Authentication required");
  });

  it("rejects everything when the server has no secret configured", () => {
    expect(() => verifySocketToken(sessionToken({ id: 1 }), undefined)).toThrow(SocketAuthError);
  });

  it("rejects a token signed with a different secret", () => {
    expect(() => verifySocketToken(sessionToken({ id: 1 }, "other"), SECRET)).toThrow("Invalid token");
  });

  it("rejects an expired session token", () => {
    const expired = jwt.sign({ id: 1, exp: Math.floor(Date.now() / 1000) - 10 }, SECRET);
    expect(() => verifySocketToken(expired, SECRET)).toThrow("Token expired");
  });

  it("rejects an expired live ticket", () => {
    const expired = jwt.sign(
      { typ: LIVE_TICKET_TYPE, id: 1, proctor: true, exp: Math.floor(Date.now() / 1000) - 10 },
      liveTicketSecret(SECRET),
    );
    expect(() => verifySocketToken(expired, SECRET)).toThrow("Live ticket expired");
  });

  it("rejects a token without a user id", () => {
    expect(() => verifySocketToken(sessionToken({ role: "admin" }), SECRET)).toThrow(SocketAuthError);
  });

  it("accepts a session JWT as a non-proctor identity, even if it claims an admin role", () => {
    expect(verifySocketToken(sessionToken({ id: 42, role: "admin" }), SECRET)).toEqual({
      userId: 42,
      isProctor: false,
      via: "session",
    });
  });

  it("accepts a proctor live ticket", () => {
    expect(verifySocketToken(ticket({ id: 7, proctor: true }), SECRET)).toEqual({
      userId: 7,
      isProctor: true,
      via: "ticket",
    });
  });

  it("accepts a non-proctor live ticket", () => {
    expect(verifySocketToken(ticket({ id: 8, proctor: false }), SECRET).isProctor).toBe(false);
  });

  it("does not grant proctor from a proctor claim signed with the plain session key", () => {
    // Same claims as a ticket but signed with JWT_SECRET instead of the derived
    // ticket key: it verifies only as a session token, so no proctor bit.
    const forged = jwt.sign({ typ: LIVE_TICKET_TYPE, id: 9, proctor: true }, SECRET);
    expect(verifySocketToken(forged, SECRET)).toEqual({ userId: 9, isProctor: false, via: "session" });
  });

  it("rejects a ticket-key token with the wrong typ", () => {
    const wrongTyp = jwt.sign({ typ: "something-else", id: 3, proctor: true }, liveTicketSecret(SECRET));
    expect(() => verifySocketToken(wrongTyp, SECRET)).toThrow("Invalid live ticket");
  });
});

describe("resolveProctoringRole", () => {
  const proctor = { userId: 1, isProctor: true, via: "ticket" as const };
  const student = { userId: 2, isProctor: false, via: "session" as const };

  it("allows a proctor to join as dashboard", () => {
    expect(resolveProctoringRole(proctor, "dashboard")).toEqual({ allowed: true, role: "dashboard" });
  });

  it("denies a non-proctor claiming dashboard", () => {
    expect(resolveProctoringRole(student, "dashboard").allowed).toBe(false);
    expect(resolveProctoringRole(undefined, "dashboard").allowed).toBe(false);
  });

  it("keeps lower-privilege roles and defaults to student", () => {
    expect(resolveProctoringRole(student, "student")).toEqual({ allowed: true, role: "student" });
    expect(resolveProctoringRole(student, "monitor")).toEqual({ allowed: true, role: "monitor" });
    expect(resolveProctoringRole(student, undefined)).toEqual({ allowed: true, role: "student" });
    expect(resolveProctoringRole(proctor, "student")).toEqual({ allowed: true, role: "student" });
  });
});

describe("resolveAllowedOrigins", () => {
  it("merges the main API's CORS env vars", () => {
    expect(
      resolveAllowedOrigins({
        CORS_ORIGIN: "https://a.example, https://b.example/",
        FRONTEND_URL: "https://a.example",
        ALLOWED_ORIGINS: "https://c.example",
      } as NodeJS.ProcessEnv),
    ).toEqual(["https://c.example", "https://a.example", "https://b.example"]);
  });

  it("only allows * when explicitly configured", () => {
    expect(resolveAllowedOrigins({ CORS_ORIGIN: "*" } as NodeJS.ProcessEnv)).toBe("*");
  });

  it("defaults to local dev origins outside production and to none in production", () => {
    expect(resolveAllowedOrigins({ NODE_ENV: "development" } as NodeJS.ProcessEnv)).toContain(
      "http://localhost:5174",
    );
    expect(resolveAllowedOrigins({ NODE_ENV: "production" } as NodeJS.ProcessEnv)).toEqual([]);
  });
});

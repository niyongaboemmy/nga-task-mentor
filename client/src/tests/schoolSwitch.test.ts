import { describe, it, expect, vi, beforeEach } from "vitest";

/** School switching on the Task Mentor client (TENANT_SWITCHING_PLAN.md §4.2, §4.5, A.1). */

const sso = vi.hoisted(() => ({ beginSsoLogin: vi.fn() }));
vi.mock("../utils/ssoState", () => sso);
vi.mock("../utils/misLinks", () => ({ misHomeUrl: () => "https://mis.amashuri.com" }));

class MemoryStorage {
  private m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  key(i: number) {
    return Array.from(this.m.keys())[i] ?? null;
  }
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  clear() {
    this.m.clear();
  }
}
vi.stubGlobal("localStorage", new MemoryStorage());
vi.stubGlobal("sessionStorage", new MemoryStorage());

import {
  allowSwitchAttempt,
  isSchoolChangeError,
  misSwitchSchoolUrl,
  parseSchoolCookie,
  resetSchoolGuardForTests,
  runSchoolGuard,
  schoolGuardDecision,
  MAX_SWITCH_ATTEMPTS,
  SWITCH_WINDOW_MS,
} from "../tenancy/schoolGuard";
import { clearUnscopedPersonalKeys, identityFromToken, reconcileStorageIdentity, storageKey } from "../tenancy/storageKey";

const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, "");
const token = (claims: object) => `h.${b64(claims)}.s`;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  sso.beginSsoLogin.mockReset();
  resetSchoolGuardForTests();
  document.getElementById("tm-school-switch-overlay")?.remove();
});

describe("nga_school cookie", () => {
  it("parses <tid>.<sid> and refuses anything else", () => {
    expect(parseSchoolCookie("x=1; nga_school=2.abcdefgh12; y=2")).toEqual({ tid: 2, sid: "abcdefgh12" });
    expect(parseSchoolCookie("nga_school=2%2EabcdefghIJ")).toEqual({ tid: 2, sid: "abcdefghIJ" });
    expect(parseSchoolCookie("nga_school=0.abcdefgh12")).toBeNull();
    expect(parseSchoolCookie("nga_school=2.short")).toBeNull();
    expect(parseSchoolCookie("other=2.abcdefgh12")).toBeNull();
    expect(parseSchoolCookie("")).toBeNull();
  });

  it("only a different school with a session present means switch (A.1)", () => {
    expect(schoolGuardDecision({ tid: 2, sid: "abcdefgh12" }, 1)).toBe("switch");
    expect(schoolGuardDecision({ tid: 1, sid: "abcdefgh12" }, 1)).toBe("ok");
    expect(schoolGuardDecision(null, 1)).toBe("ok"); // MIS not used in this browser
    expect(schoolGuardDecision({ tid: 2, sid: "abcdefgh12" }, null)).toBe("ok"); // no session
  });
});

describe("API answers that mean 'another school'", () => {
  it("are 401 TENANT_MISMATCH/UNKNOWN and 409 SCHOOL_CHANGED only", () => {
    expect(isSchoolChangeError({ response: { status: 401, data: { code: "TENANT_MISMATCH" } } })).toBe(true);
    expect(isSchoolChangeError({ response: { status: 401, data: { code: "TENANT_UNKNOWN" } } })).toBe(true);
    expect(isSchoolChangeError({ response: { status: 409, data: { code: "SCHOOL_CHANGED" } } })).toBe(true);
    expect(isSchoolChangeError({ response: { status: 401, data: { code: "TOKEN_EXPIRED" } } })).toBe(false);
    expect(isSchoolChangeError({ response: { status: 403, data: { code: "PASSWORD_REQUIRED" } } })).toBe(false);
    expect(isSchoolChangeError(new Error("Network Error"))).toBe(false);
  });
});

describe("loop guard", () => {
  it("allows 3 re-sign-ins per 2 minutes", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < MAX_SWITCH_ATTEMPTS; i++) expect(allowSwitchAttempt(t0 + i, localStorage)).toBe(true);
    expect(allowSwitchAttempt(t0 + 10, localStorage)).toBe(false);
    expect(allowSwitchAttempt(t0 + SWITCH_WINDOW_MS + 5, localStorage)).toBe(true);
  });
});

describe("the guard on a page", () => {
  it("re-signs in (overlay, session dropped, MIS SSO) when the cookie names another school", () => {
    localStorage.setItem("tm_auth_token", token({ id: 7, tid: 1 }));
    localStorage.setItem("misToken", "m.t.k");
    Object.defineProperty(document, "cookie", { configurable: true, get: () => "nga_school=2.abcdefgh12" });
    window.history.replaceState({}, "", "/dashboard");
    expect(runSchoolGuard()).toBe("switch");
    expect(localStorage.getItem("tm_auth_token")).toBeNull();
    expect(localStorage.getItem("misToken")).toBeNull();
    expect(sso.beginSsoLogin).toHaveBeenCalledTimes(1);
    expect(document.getElementById("tm-school-switch-overlay")?.textContent).toMatch(/Switching to your other school/);
  });

  it("does nothing for the same school, and never runs on the sign-in pages", () => {
    localStorage.setItem("tm_auth_token", token({ id: 7, tid: 2 }));
    Object.defineProperty(document, "cookie", { configurable: true, get: () => "nga_school=2.abcdefgh12" });
    window.history.replaceState({}, "", "/dashboard");
    expect(runSchoolGuard()).toBe("ok");
    Object.defineProperty(document, "cookie", { configurable: true, get: () => "nga_school=3.abcdefgh12" });
    window.history.replaceState({}, "", "/auth/callback");
    expect(runSchoolGuard()).toBe("ok");
    expect(sso.beginSsoLogin).not.toHaveBeenCalled();
    expect(localStorage.getItem("tm_auth_token")).not.toBeNull();
  });

  it("the switch link goes to MIS and comes back through the SSO entry", () => {
    const url = new URL(misSwitchSchoolUrl());
    expect(url.origin + url.pathname).toBe("https://mis.amashuri.com/switch-school");
    expect(url.searchParams.get("return")).toMatch(/\/login\?sso=1$/);
  });
});

describe("storage keyed by school and person", () => {
  it("keys drafts by tid + uid; a token without tid is school 1", () => {
    expect(storageKey("quiz_5_answers", { tid: 2, uid: 7 })).toBe("quiz_5_answers.t2.u7");
    expect(identityFromToken(token({ id: 7 }))).toEqual({ tid: 1, uid: 7 });
    expect(identityFromToken("garbage")).toBeNull();
    expect(storageKey("quiz_5_answers", null)).toBe("quiz_5_answers.anon");
  });

  it("moves old unscoped drafts under the first identity, and drops them when the identity changes", () => {
    localStorage.setItem("quiz_5_answers", "[1]");
    localStorage.setItem("tm:marks-draft:9", "{}");
    localStorage.setItem("theme", "dark"); // not personal: kept
    expect(reconcileStorageIdentity({ tid: 1, uid: 7 }, localStorage)).toBe("first");
    expect(localStorage.getItem("quiz_5_answers.t1.u7")).toBe("[1]");
    expect(localStorage.getItem("quiz_5_answers")).toBeNull();
    expect(reconcileStorageIdentity({ tid: 1, uid: 7 }, localStorage)).toBe("same");
    localStorage.setItem("quiz_6_answers", "[2]"); // written unscoped by an old tab
    expect(reconcileStorageIdentity({ tid: 2, uid: 7 }, localStorage)).toBe("changed");
    expect(localStorage.getItem("quiz_6_answers")).toBeNull();
    expect(localStorage.getItem("quiz_5_answers.t1.u7")).toBe("[1]"); // school 1's scoped draft stays for school 1
    expect(localStorage.getItem("theme")).toBe("dark");
  });

  it("clearUnscopedPersonalKeys leaves scoped keys alone", () => {
    localStorage.setItem("tm.rank.ack", "1");
    localStorage.setItem("tm.rank.ack.t2.u7", "1");
    localStorage.setItem("quiz_1_answers.anon", "[]");
    clearUnscopedPersonalKeys(localStorage);
    expect(localStorage.getItem("tm.rank.ack")).toBeNull();
    expect(localStorage.getItem("quiz_1_answers.anon")).toBeNull();
    expect(localStorage.getItem("tm.rank.ack.t2.u7")).toBe("1");
  });
});

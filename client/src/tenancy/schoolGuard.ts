/**
 * School guard (TENANT_SWITCHING_PLAN.md §4.2, §4.5 and Appendix A.1).
 *
 * The school a person works in is the one of their NGA MIS browser session.
 * MIS publishes it in the readable cookie `nga_school = <tid>.<sid>` on
 * `.amashuri.com`. When it names another school than this Task Mentor
 * session's, the person switched school elsewhere: we drop this session
 * (without the "signed out" path), drop unscoped personal stores, and redo
 * the normal MIS sign-in, which lands in the MIS session's current school.
 * The same happens when the API answers 401 TENANT_MISMATCH / TENANT_UNKNOWN
 * or 409 SCHOOL_CHANGED.
 *
 * A loop guard allows 3 re-sign-ins per 2 minutes; after that the normal
 * sign-in page is shown.
 */
import { beginSsoLogin } from "../utils/ssoState";
import { misHomeUrl } from "../utils/misLinks";
import { clearUnscopedPersonalKeys, currentIdentity } from "./storageKey";

export const SCHOOL_COOKIE = "nga_school";
const COOKIE_VALUE = /^(\d{1,9})\.([A-Za-z0-9_-]{8,32})$/;

export const SWITCH_ATTEMPTS_KEY = "tm.schoolSwitch.attempts";
export const MAX_SWITCH_ATTEMPTS = 3;
export const SWITCH_WINDOW_MS = 2 * 60 * 1000;

/** `?sso=1` on /login starts the MIS sign-in straight away (the "SSO entry URL"). */
export const SSO_ENTRY_PARAM = "sso";

export interface SchoolCookie {
  tid: number;
  sid: string;
}

/** Parse `nga_school` out of a `document.cookie` string (null when absent or malformed). */
export function parseSchoolCookie(cookieString: string | null | undefined): SchoolCookie | null {
  if (!cookieString) return null;
  for (const part of cookieString.split(";")) {
    const i = part.indexOf("=");
    if (i < 0 || part.slice(0, i).trim() !== SCHOOL_COOKIE) continue;
    let value = part.slice(i + 1).trim();
    try {
      value = decodeURIComponent(value);
    } catch {
      return null;
    }
    const m = COOKIE_VALUE.exec(value);
    if (!m) return null;
    const tid = Number(m[1]);
    return tid > 0 ? { tid, sid: m[2] } : null;
  }
  return null;
}

/**
 * What the guard does (Appendix A.1): only a cookie naming a different school
 * than a present session triggers a re-sign-in. No cookie (MIS not used in
 * this browser, or signed out there -- the verify-mis poll handles that) or
 * no session means nothing to do.
 */
export function schoolGuardDecision(cookie: SchoolCookie | null, sessionTid: number | null): "ok" | "switch" {
  if (!cookie || !sessionTid) return "ok";
  return cookie.tid === sessionTid ? "ok" : "switch";
}

export const SCHOOL_CHANGE_CODES = ["TENANT_MISMATCH", "TENANT_UNKNOWN", "SCHOOL_CHANGED"] as const;

/** Is this API error "your session is for another school" (re-sign-in, not logout)? */
export function isSchoolChangeError(error: unknown): boolean {
  const res = (error as { response?: { status?: number; data?: { code?: unknown } } } | null)?.response;
  const code = res?.data?.code;
  if (res?.status === 401) return code === "TENANT_MISMATCH" || code === "TENANT_UNKNOWN";
  if (res?.status === 409) return code === "SCHOOL_CHANGED";
  return false;
}

const readAttempts = (store: Storage): number[] => {
  try {
    const list = JSON.parse(store.getItem(SWITCH_ATTEMPTS_KEY) || "[]");
    return Array.isArray(list) ? list.filter((n) => typeof n === "number") : [];
  } catch {
    return [];
  }
};

/** Loop guard: records an attempt and says whether it may go ahead (3 per 2 minutes). */
export function allowSwitchAttempt(now: number = Date.now(), store: Storage = localStorage): boolean {
  const recent = readAttempts(store).filter((t) => now - t >= 0 && now - t < SWITCH_WINDOW_MS);
  if (recent.length >= MAX_SWITCH_ATTEMPTS) {
    try {
      store.setItem(SWITCH_ATTEMPTS_KEY, JSON.stringify(recent));
    } catch {
      /* ignore */
    }
    return false;
  }
  recent.push(now);
  try {
    store.setItem(SWITCH_ATTEMPTS_KEY, JSON.stringify(recent));
  } catch {
    /* storage blocked: no loop guard memory, the SSO itself still converges */
  }
  return true;
}

const basePath = () => (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
const loginPath = () => `${basePath()}/login`.replace(/\/+/g, "/");

/** This app's SSO entry URL: the sign-in page that starts MIS SSO by itself. */
export function ssoEntryUrl(): string {
  return `${window.location.origin}${loginPath()}?${SSO_ENTRY_PARAM}=1`;
}

/** The MIS switch page, returning here through the SSO entry (Appendix A.4). */
export function misSwitchSchoolUrl(): string {
  return `${misHomeUrl()}/switch-school?return=${encodeURIComponent(ssoEntryUrl())}`;
}

/** True on pages where the sign-in itself is running (never re-sign-in from there). */
export function onSignInPage(pathname: string = window.location.pathname): boolean {
  return pathname.includes("callback") || pathname.includes("sso") || pathname === loginPath() || pathname === "/login";
}

/** Drop this app's session (tokens, per-tab SSO markers) -- not a user sign-out. */
export function clearSessionForSwitch(): void {
  try {
    localStorage.removeItem("tm_auth_token");
    localStorage.removeItem("misToken");
  } catch {
    /* ignore */
  }
  try {
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith("sso_code_processed_")) sessionStorage.removeItem(key);
    }
  } catch {
    /* ignore */
  }
  clearUnscopedPersonalKeys();
}

const OVERLAY_ID = "tm-school-switch-overlay";

/** The small "Switching to your other school…" overlay (plain DOM: the page is about to navigate). */
export function showSwitchingOverlay(): void {
  if (typeof document === "undefined" || document.getElementById(OVERLAY_ID)) return;
  const dark = document.documentElement.classList.contains("dark");
  const el = document.createElement("div");
  el.id = OVERLAY_ID;
  el.setAttribute("role", "status");
  el.setAttribute("aria-live", "polite");
  el.style.cssText = [
    "position:fixed",
    "inset:0",
    "z-index:2147483647",
    "display:flex",
    "align-items:center",
    "justify-content:center",
    `background:${dark ? "rgba(3,7,18,0.92)" : "rgba(255,255,255,0.94)"}`,
    "font-family:inherit",
  ].join(";");
  const card = document.createElement("div");
  card.style.cssText = [
    "display:flex",
    "align-items:center",
    "gap:12px",
    "padding:14px 18px",
    "border-radius:16px",
    `border:1px solid ${dark ? "#1e3a8a" : "#bfdbfe"}`,
    `background:${dark ? "#0b1220" : "#eff6ff"}`,
    `color:${dark ? "#bfdbfe" : "#1e40af"}`,
    "font-size:14px",
    "font-weight:500",
  ].join(";");
  const spinner = document.createElement("span");
  spinner.style.cssText =
    "width:18px;height:18px;border-radius:9999px;border:2px solid currentColor;border-top-color:transparent;display:inline-block;animation:tm-switch-spin .8s linear infinite";
  const style = document.createElement("style");
  style.textContent = "@keyframes tm-switch-spin{to{transform:rotate(360deg)}}";
  const label = document.createElement("span");
  label.textContent = "Switching to your other school…";
  card.append(spinner, label);
  el.append(style, card);
  document.body.appendChild(el);
}

let inProgress = false;

/**
 * Leave this school's session and sign in again into the MIS session's
 * current school. Returns to the app home (the SSO callback always lands on
 * the dashboard; no deep link from the old school is replayed).
 */
export function resignInToCurrentSchool(reason: string): void {
  if (inProgress) return;
  inProgress = true;
  console.info(`[school] signing in again: ${reason}`);
  if (!allowSwitchAttempt()) {
    // Loop guard: stop redirecting and show the normal sign-in page.
    clearSessionForSwitch();
    window.location.href = loginPath();
    return;
  }
  showSwitchingOverlay();
  clearSessionForSwitch();
  beginSsoLogin();
}

/** Compare `nga_school` with this session; start the re-sign-in on a mismatch. */
export function runSchoolGuard(): "ok" | "switch" {
  if (typeof document === "undefined" || onSignInPage()) return "ok";
  const decision = schoolGuardDecision(parseSchoolCookie(document.cookie), currentIdentity()?.tid ?? null);
  if (decision === "switch") resignInToCurrentSchool("nga_school names another school");
  return decision;
}

/** Tests only. */
export function resetSchoolGuardForTests(): void {
  inProgress = false;
}

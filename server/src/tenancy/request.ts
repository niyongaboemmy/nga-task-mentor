import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import {
  currentTenantOrNull,
  isTenantUsable,
  parseTid,
  runWithTenant,
  TenantClaims,
  TenantCtx,
  tidFromClaims,
} from "../vendor/nga-tenancy";
import { legacyDefaultTid } from "./config";
import { getTenantRegistry } from "./registry";

/**
 * Request-side tenancy (CONTRACT.md §6): the tenant a request speaks for,
 * the status gates, and the MIS-token/session mismatch rule.
 */

declare global {
  namespace Express {
    interface Request {
      /** The tenant this request runs in (set by the auth middlewares). */
      tenant?: TenantCtx;
    }
  }
}

export type TenantGate =
  | { ok: true; tenant: TenantCtx }
  | { ok: false; status: number; code: "TENANT_REQUIRED" | "TENANT_UNKNOWN" | "TENANT_PENDING" | "TENANT_SUSPENDED"; message: string };

/** The tenant id of a token's claims (legacy tokens -> TENANCY_LEGACY_DEFAULT_TID). */
export function tidOfClaims(claims: TenantClaims | null | undefined): number | null {
  return tidFromClaims(claims, legacyDefaultTid());
}

/** Registry lookup + status gates for a tenant id. */
export async function resolveTenant(tid: number | null): Promise<TenantGate> {
  if (!tid) {
    return { ok: false, status: 401, code: "TENANT_REQUIRED", message: "This sign-in does not name a school. Please sign in again." };
  }
  const tenant = await getTenantRegistry().get(tid);
  if (!tenant) return { ok: false, status: 401, code: "TENANT_UNKNOWN", message: "Unknown school. Please sign in again." };
  if (tenant.status === "PENDING") {
    return { ok: false, status: 403, code: "TENANT_PENDING", message: "This school's account is not active yet." };
  }
  if (!isTenantUsable(tenant.status)) {
    return { ok: false, status: 403, code: "TENANT_SUSPENDED", message: "This school's account is suspended." };
  }
  return { ok: true, tenant };
}

export function sendTenantGate(res: Response, gate: Exclude<TenantGate, { ok: true }>) {
  return res.status(gate.status).json({ success: false, code: gate.code, message: gate.message });
}

/** The tid an (unverified) MIS token claims, or null when it carries none. */
export function misTokenTid(misToken: string | null | undefined): number | null {
  if (!misToken) return null;
  try {
    const claims = jwt.decode(String(misToken).replace(/^Bearer /i, "")) as TenantClaims | null;
    if (!claims || typeof claims !== "object") return null;
    return parseTid(claims.tid);
  } catch {
    return null;
  }
}

/** The MIS token a browser request carries (cookie or x-mis-token), unlogged. */
export function requestMisToken(req: Request): string | null {
  const cookie = (req as any).cookies?.misToken;
  if (typeof cookie === "string" && cookie) return cookie.replace(/^Bearer /i, "");
  const header = req.headers["x-mis-token"];
  const value = Array.isArray(header) ? header[0] : header;
  return value ? String(value).replace(/^Bearer /i, "") : null;
}

/** 401 TENANT_MISMATCH when the request's MIS token belongs to another tenant. */
export function misTokenMismatch(req: Request, tid: number): boolean {
  const misTid = misTokenTid(requestMisToken(req));
  return misTid !== null && misTid !== tid;
}

export function sendTenantMismatch(res: Response) {
  return res.status(401).json({
    success: false,
    code: "TENANT_MISMATCH",
    message: "Your NGA session belongs to another school. Please sign in again.",
  });
}

/** Run the rest of the request (and every later middleware) in a tenant. */
export function enterTenant<T>(req: Request, tenant: TenantCtx, fn: () => T): T {
  req.tenant = tenant;
  return runWithTenant(tenant, fn);
}

/** The X-NGA-Tenant header of a service call, or null. */
export function headerTid(req: Request): number | null {
  const raw = req.headers["x-nga-tenant"];
  return parseTid(Array.isArray(raw) ? raw[0] : raw);
}

/**
 * Express middleware for routes that have no user session but belong to a
 * tenant named by the caller (public report-card verification, previews):
 * X-NGA-Tenant or ?tid=, else the legacy default. Status gates apply.
 */
export async function tenantFromCallerHint(req: Request, res: Response, next: NextFunction) {
  if (req.tenant || currentTenantOrNull()) return next();
  const q = parseTid((req.query as Record<string, unknown>)?.tid);
  const gate = await resolveTenant(headerTid(req) ?? q ?? legacyDefaultTid());
  if (!gate.ok) return sendTenantGate(res, gate);
  return enterTenant(req, gate.tenant, () => next());
}

/**
 * The tenant an MIS user-token sign-in belongs to: the `tenant` MIS returns
 * from /auth/verify, /users/me or /sso/token (contract v1), else the token's
 * own `tid` claim, else -- an MIS that predates tenancy -- the legacy default.
 */
export function tidFromMisAuth(misToken: string | null | undefined, ...payloads: unknown[]): number | null {
  for (const p of payloads) {
    const tenant = (p as { tenant?: { tid?: unknown; tenant_id?: unknown } } | null)?.tenant;
    const tid = parseTid(tenant?.tid ?? tenant?.tenant_id);
    if (tid) return tid;
  }
  return misTokenTid(misToken) ?? legacyDefaultTid();
}

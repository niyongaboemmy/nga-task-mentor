import { NextFunction, Request, RequestHandler, Response } from "express";
import { activityRelay } from "./relay";

/**
 * Server-side key events (plan §5.5): counted where the work actually
 * happened, so they don't depend on the browser staying open. Params carry
 * ids and counts only -- never free text.
 */
export type KeyEventParams = Record<string, string | number | boolean | null>;

export interface KeyEventIdentity {
  userId: number | null;
  deviceId: string | null;
  ip: string | null;
}

/** Who did it: the MIS id `protect` put on req.user, the shared device id, the client IP. */
export const keyEventIdentity = (req: Request): KeyEventIdentity => {
  const mis = Number((req as any).user?.mis_user_id);
  return {
    userId: Number.isInteger(mis) && mis > 0 ? mis : null,
    deviceId: activityRelay.deviceIdOf(req),
    ip: String(req.ip || "").replace(/^::ffff:/, "") || null,
  };
};

/** Record a key event for an identity captured earlier (e.g. before a background job). */
export const trackAs = (who: KeyEventIdentity, name: string, params?: KeyEventParams) => {
  try {
    activityRelay.track(who.userId, who.deviceId, name, params, who.ip);
  } catch {
    /* analytics never breaks a request */
  }
};

export const trackKeyEvent = (req: Request, name: string, params?: KeyEventParams) => {
  try {
    trackAs(keyEventIdentity(req), name, params);
  } catch {
    /* analytics never breaks a request */
  }
};

/** A positive integer route/body value, or null. */
export const intOrNull = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/**
 * Route middleware: record `name` once the response has gone out with a 2xx.
 * Params are computed up front, while req.params still belongs to this route.
 */
export const trackOnSuccess =
  (name: string, paramsOf: (req: Request) => KeyEventParams = () => ({})): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const params = paramsOf(req);
      const who = keyEventIdentity(req);
      res.once("finish", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) trackAs(who, name, params);
      });
    } catch {
      /* analytics never breaks a request */
    }
    next();
  };

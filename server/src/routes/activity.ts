import express, { NextFunction, Request, Response, Router } from "express";
import type { ActivityRelay } from "../vendor/nga-activity-relay/relay";
import jwt from "jsonwebtoken";
import { activityRelay } from "../activity/relay";
import { sessionTokenOf } from "../activity/session";
import { resolveTenant, tidOfClaims } from "../tenancy/request";
import { runWithTenant } from "../vendor/nga-tenancy";

/**
 * This route has no auth middleware, so enter the session's school here: the
 * relay stamps each queued event with currentTenant(). Visitors and invalid
 * sessions run without a school (MIS files them under the primary tenant).
 */
const inSessionTenant = async (req: Request, fn: () => unknown): Promise<unknown> => {
  try {
    const token = sessionTokenOf(req);
    const secret = process.env.JWT_SECRET;
    if (token && secret) {
      const gate = await resolveTenant(tidOfClaims(jwt.verify(token, secret) as any));
      if (gate.ok) return runWithTenant(gate.tenant, fn);
    }
  } catch {
    /* visitor */
  }
  return fn();
};

/**
 * /api/activity -- the browser tracker's relay (plan §5.2).
 *
 * Mounted BEFORE the global body parser: it has its own 256 kB parser that also
 * reads `text/plain` (navigator.sendBeacon on page unload). There is no auth
 * middleware here on purpose -- identity comes from the relay's getUserId, and a
 * request without a valid session is simply a public visitor, never a 401.
 */
export const createActivityRouter = (relay: ActivityRelay = activityRelay): Router => {
  const router = Router();

  router.post(
    "/",
    express.json({ limit: "256kb", type: ["application/json", "text/plain"] }),
    (req: Request, res: Response) => void inSessionTenant(req, () => relay.handler(req, res)),
  );
  router.get("/config", (req: Request, res: Response) => void relay.configHandler(req, res));

  // A malformed or oversized batch is dropped quietly, like any other bad batch:
  // the tracker treats a 4xx as final, and analytics must never surface errors.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  router.use((_err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (!res.headersSent) res.status(204).end();
  });

  return router;
};

export default createActivityRouter();

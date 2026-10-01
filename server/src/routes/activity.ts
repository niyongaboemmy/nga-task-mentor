import express, { NextFunction, Request, Response, Router } from "express";
import type { ActivityRelay } from "../vendor/nga-activity-relay/relay";
import { activityRelay } from "../activity/relay";

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
    (req: Request, res: Response) => void relay.handler(req, res),
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

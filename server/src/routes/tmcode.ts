import express, { NextFunction, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { protect, authorizePermission } from "../middleware/auth";
import { tmcodeAuth, tmcodeError } from "../middleware/tmcodeAuth";
import {
  getPackage,
  getProfiles,
  heartbeat,
  launch,
  postSnapshot,
  postTelemetry,
  redeemTicket,
  results,
  serverRun,
  submit,
} from "../controllers/tmcode.controller";

/**
 * /api/tmcode — the TMCode desktop app's API (nga-tmcode/docs/PROTOCOL.md).
 * Mounted with its own JSON parser (snapshots carry whole workspaces).
 */
const router = express.Router();

/** Async handler errors → protocol-shaped 500. */
const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown> | unknown) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res)).catch((e) => {
      console.error("[tmcode]", req.method, req.path, e);
      if (res.headersSent) return next(e);
      tmcodeError(res, 500, "SERVER_ERROR", "Something went wrong on Task Mentor.");
    });

// Server runs hit the judge: 10/min per student (PROTOCOL.md §3).
const serverRunLimiter = rateLimit({
  windowMs: 60_000,
  max: Number(process.env.CODE_RUN_RATE_LIMIT_PER_MIN) || 10,
  keyGenerator: (req) => `tmcode-run:${(req as any).tmcodeSession?.user_id ?? req.ip}`,
  handler: (_req, res) =>
    tmcodeError(res, 429, "RATE_LIMITED", "Too many server runs — wait a minute and try again."),
  standardHeaders: true,
  legacyHeaders: false,
});
export const tmcodeServerRunLimiter = serverRunLimiter;

router.get("/profiles", getProfiles);
router.post("/launch", protect, authorizePermission("TMCODE_USE"), wrap(launch));
router.post("/sessions", wrap(redeemTicket));

const s = "/sessions/:sid";
router.get(`${s}/package`, tmcodeAuth, wrap(getPackage));
router.post(`${s}/snapshots`, tmcodeAuth, wrap(postSnapshot));
router.post(`${s}/telemetry`, tmcodeAuth, wrap(postTelemetry));
router.post(`${s}/heartbeat`, tmcodeAuth, wrap(heartbeat));
router.post(`${s}/server-run`, tmcodeAuth, serverRunLimiter, wrap(serverRun));
router.post(`${s}/submit`, tmcodeAuth, wrap(submit));
router.get(`${s}/results`, tmcodeAuth, wrap(results));

export default router;

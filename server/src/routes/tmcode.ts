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
import { exchange, me } from "../controllers/tmcodeUser.controller";
import * as projects from "../controllers/projects.controller";
import { requireTmPermission, tmcodeUserAuth } from "../middleware/tmcodeUserAuth";
import { projectLimits } from "../tmcode/projects/limits";

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

// ─── Sign-in and Projects (PROJECTS_PLAN.md §1, §3; tmcode/PROJECTS_API.md) ──

const exchangeLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  handler: (_req, res) => tmcodeError(res, 429, "RATE_LIMITED", "Too many sign-in attempts — wait a minute."),
  standardHeaders: true,
  legacyHeaders: false,
});

const use = [tmcodeUserAuth, requireTmPermission("PROJECTS_USE")];
const read = [tmcodeUserAuth];
// Blobs arrive as raw gzip (not JSON); a little over the per-file quota so
// incompressible files still fit.
const rawBlob = (req: Request, res: Response, next: NextFunction) =>
  express.raw({ type: () => true, inflate: false, limit: projectLimits().maxFileBytes + 1024 * 1024 })(req, res, next);

router.post("/auth/exchange", exchangeLimiter, wrap(exchange));
router.get("/auth/me", tmcodeUserAuth, wrap(me));

const p = "/projects/:id(\\d+)";
router.get("/projects", read, wrap(projects.listProjects));
router.post("/projects", use, wrap(projects.createProject));
router.get(p, read, wrap(projects.getProject));
router.patch(p, use, wrap(projects.updateProject));
router.delete(p, use, wrap(projects.deleteProject));
router.get(`${p}/revisions`, read, wrap(projects.listRevisions));
router.post(`${p}/revisions`, use, wrap(projects.commitRevision));
router.get(`${p}/revisions/:rev/manifest`, read, wrap(projects.getManifest));
router.post(`${p}/blobs/missing`, use, wrap(projects.blobsMissing));
router.put(`${p}/blobs/:sha`, use, rawBlob, wrap(projects.putBlobHandler));
router.get(`${p}/blobs/:sha`, read, wrap(projects.getBlob));
router.get(`${p}/files/*`, read, wrap(projects.getFile));
router.put(`${p}/presence`, use, wrap(projects.putPresence));
router.get(`${p}/live`, read, wrap(projects.projectLive));
router.post(`${p}/git`, use, wrap(projects.reportGit));
router.post(`${p}/members`, use, wrap(projects.addMember));
router.delete(`${p}/members/:userId(\\d+)`, read, wrap(projects.removeMember));
router.get(`${p}/open-link`, read, wrap(projects.openLink));
router.post(`${p}/links`, use, wrap(projects.createLink));
router.post(`${p}/links/:linkId(\\d+)/submit`, use, wrap(projects.submitLink));
router.delete(`${p}/links/:linkId(\\d+)`, use, wrap(projects.deleteLink));
router.get("/activities/linkable", use, wrap(projects.linkableActivities));
router.get(
  "/activities/:type/:id(\\d+)/projects",
  tmcodeUserAuth,
  requireTmPermission("PROJECTS_MONITOR", "PROJECTS_VIEW_ALL"),
  wrap(projects.activityProjects),
);
router.get(
  "/monitor/live",
  tmcodeUserAuth,
  requireTmPermission("PROJECTS_MONITOR", "PROJECTS_VIEW_ALL"),
  wrap(projects.monitorLive),
);

export default router;

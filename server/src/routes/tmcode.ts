import express, { NextFunction, Request, Response } from "express";
import { codeSessionEvents, codeSessionInput, stopCodeSession } from "../controllers/codeSession.controller";
import * as activity from "../controllers/tmcodeActivity.controller";
import * as ai from "../controllers/tmcodeAi.controller";
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
import * as settingsSync from "../controllers/tmcodeSettingsSync.controller";
import * as tmAssignments from "../controllers/tmcodeAssignments.controller";
import * as practicals from "../controllers/tmcodePracticals.controller";
import { aiDraftGrade } from "../controllers/tmcodeGradingAi.controller";
import { requireAi } from "../middleware/requireAi";
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
// Settings Sync (TMCode on several computers): the signed-in user's own settings document.
router.get("/settings-sync", tmcodeUserAuth, wrap(settingsSync.getSettingsSync));
router.put("/settings-sync", tmcodeUserAuth, wrap(settingsSync.putSettingsSync));
router.delete("/settings-sync", tmcodeUserAuth, wrap(settingsSync.deleteSettingsSync));

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
router.post(`${p}/activity`, read, wrap(activity.uploadActivity));
router.get(`${p}/activity`, read, wrap(activity.listActivity));
router.post(`${p}/members`, use, wrap(projects.addMember));
router.delete(`${p}/members/:userId(\\d+)`, read, wrap(projects.removeMember));
router.get(`${p}/open-link`, read, wrap(projects.openLink));
router.post(`${p}/links`, use, wrap(projects.createLink));
router.post(`${p}/links/:linkId(\\d+)/submit`, use, wrap(projects.submitLink));
router.delete(`${p}/links/:linkId(\\d+)`, use, wrap(projects.deleteLink));
// Status lifecycle: submit / withdraw (owner), return for changes (teacher), restore (owner).
router.post(`${p}/submit`, use, wrap(projects.submitProject));
router.post(`${p}/withdraw`, use, wrap(projects.withdrawProject));
router.post(`${p}/restore`, use, wrap(projects.restoreProject));
router.post(
  `${p}/return`,
  tmcodeUserAuth,
  requireTmPermission("PROJECTS_MONITOR", "PROJECTS_VIEW_ALL"),
  wrap(projects.returnProject),
);
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

// ─── Practicals and case studies (ASSIGNMENTS_PLAN.md) ───────────────────────

const as = "/assignments/:id(\\d+)";
router.get("/assignments", read, wrap(tmAssignments.listAssignments));
router.get(as, read, wrap(tmAssignments.getAssignment));
router.post(`${as}/start`, use, wrap(tmAssignments.startAssignment));
router.put(`${as}/tmcode`, tmcodeUserAuth, requireTmPermission("ASSIGNMENTS_EDIT"), wrap(tmAssignments.updateAssignmentTmcode));
router.get(`${as}/workspaces`, read, wrap(tmAssignments.assignmentWorkspaces));
router.get(`${as}/open-link`, read, wrap(tmAssignments.assignmentOpenLink));

// ─── Quiz practicals, grading workspace, web preview ─────────────────────────

router.post(
  "/quizzes/:quizId(\\d+)/questions/:questionId(\\d+)/start",
  use,
  wrap(practicals.startQuizPractical),
);
const grader = [tmcodeUserAuth, requireTmPermission("PROJECTS_MONITOR", "PROJECTS_VIEW_ALL")];
router.get("/grading", grader, wrap(practicals.listGradable));
router.get("/grading/:type(assignment|quiz)/:id(\\d+)", grader, wrap(practicals.gradingRoster));
router.put("/grading/:type(assignment|quiz)/:id(\\d+)/students/:studentId(\\d+)", grader, wrap(practicals.saveGrade));
router.post(`${p}/preview`, read, wrap(practicals.createPreview));
// The grading workspace's Run tab (non-web projects on the code runner).
const projectRunLimiter = rateLimit({
  windowMs: 60_000,
  max: Number(process.env.CODE_RUN_RATE_LIMIT_PER_MIN) || 10,
  keyGenerator: (req) => `tmcode-project-run:${(req as any).user?.id ?? req.ip}`,
  handler: (_req, res) => tmcodeError(res, 429, "RATE_LIMITED", "Too many runs — wait a minute and try again."),
  standardHeaders: true,
  legacyHeaders: false,
});
router.get(`${p}/run-targets`, read, wrap(practicals.runTargets));
router.post(`${p}/run`, read, projectRunLimiter, wrap(practicals.runProject));
// The Run tab's live Console: the revision's program started on the code runner (planned like
// /run), then its output, input and stop on the person's own session (/api/code/sessions's handlers).
router.post(`${p}/sessions`, read, projectRunLimiter, wrap(practicals.startProjectSession));
const ps = "/projects/:projectId(\\d+)/sessions/:id([a-f0-9]{8,64})";
router.get(`${ps}/events`, read, codeSessionEvents);
router.post(`${ps}/input`, read, codeSessionInput);
router.delete(ps, read, stopCodeSession);
// A page of a PHP website (the Preview tab): one request on the code runner.
router.post(`${p}/page`, read, projectRunLimiter, wrap(practicals.runPage));
// No auth: the signed, short-lived token in the path is the key (iframes send
// no Authorization header) and responses are sandboxed.
router.get("/preview/:token/*", wrap(practicals.servePreview));

// ─── TMCode AI: free AI only (OpenRouter by default, Auto across free tiers) ──
const aiLimiter = rateLimit({
  windowMs: 60_000,
  max: Number(process.env.TMCODE_AI_RATE_LIMIT_PER_MIN) || 30,
  keyGenerator: (req) => `tmcode-ai:${(req as any).user?.id ?? req.ip}`,
  handler: (_req, res) => tmcodeError(res, 429, "RATE_LIMITED", "Too many AI requests — wait a minute."),
  standardHeaders: true,
  legacyHeaders: false,
});
router.get("/ai/status", read, wrap(ai.aiStatus));
router.get("/ai/events", read, wrap(ai.aiEvents));
router.post("/ai/chat", read, aiLimiter, wrap(ai.aiChat));
router.get("/ai/chat/:id/stream", read, wrap(ai.aiChatStream));
router.post("/ai/complete", read, aiLimiter, wrap(ai.aiComplete));
router.post("/ai/byok/verify", read, aiLimiter, wrap(ai.aiVerifyKey));
// The request interpreter (intent card / Learning's prompt coach) and Prompt Problems.
router.post("/ai/interpret", read, aiLimiter, wrap(ai.aiInterpret));
router.get("/ai/interpret/metrics", read, wrap(ai.aiInterpretMetrics));
router.post("/ai/prompt-problem/check", read, aiLimiter, wrap(ai.aiPromptProblemCheck));
// AI-assisted grading: a draft for one student (saves nothing; GRADING_PREMIUM_CONTRACTS.md).
router.post(
  "/grading/:type(assignment|quiz)/:id(\\d+)/students/:studentId(\\d+)/ai-draft",
  grader,
  requireAi("author", undefined, "tmcode"),
  aiLimiter,
  wrap(aiDraftGrade),
);

export default router;

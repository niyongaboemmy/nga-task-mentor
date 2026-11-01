import { Router, Request, Response } from "express";
import { protect } from "../middleware/auth";
import { decideAiFor, hasAiUse } from "../middleware/requireAi";
import { fromQuery } from "../utils/aiContext";
import { AI_REASON_MESSAGES, aiAppEnabled, type AiReason } from "../vendor/nga-access";
import { getAiPolicy } from "../services/aiPolicy";
import { myRoutesForUi } from "../services/myAiGateway";
import { hasExternalConnect } from "../services/aiHandoff";
import { AiDraft } from "../models/AiDraft.model";

/**
 * /api/ai -- what AI the signed-in user may use (AI_USAGE_CONTROL_PLAN.md §5.7).
 *
 * GET /access?quiz=ID | assignment=ID | project=ID
 *   { allowed, reason, message, mode, features: { assist, complete, hint } }
 *   allowed: some AI is available here (assist, or hints only); reason is the
 *   assist decision's, or HINTS_ONLY when only hints are. mode is the item's
 *   ai_mode when the caller is a learner in it, else null.
 *
 * GET /policy
 *   The school policy as the TM client needs it: whether it is on for Task
 *   Mentor / TMCode, whether teachers' per-item modes are in force
 *   (itemModes: false = "Disabled by the school administrator"), and this
 *   user's authoring decision (AI_USE).
 *
 * GET /drafts?kind=&status=&submission_id=&assignment_id= · GET /drafts/:id · PATCH /drafts/:id
 *   AI drafts the person's own Claude / ChatGPT saved through the NGA connector
 *   (integration/mcpTools.ts). Only the owner sees them; PATCH { status: "applied" |
 *   "discarded" } after the teacher confirmed (or dropped) one in the app.
 *
 * GET /my-routes
 *   My AI (MY_AI_GATEWAY.md): this person's route map from the MIS gateway
 *   (no secrets; 60 s cache) for the "Answers with" control -- { enabled, byTask,
 *   choices }, or { enabled:false } when My AI is off or the MIS can't answer.
 */
const router = Router();
router.use(protect);

router.get("/access", async (req: Request, res: Response) => {
  try {
    const item = await fromQuery(req);
    const [assist, complete, hint] = await Promise.all([
      decideAiFor(req, "assist", item),
      decideAiFor(req, "complete", item),
      decideAiFor(req, "hint", item),
    ]);
    const allowed = assist.allowed || hint.allowed;
    const reason: AiReason = assist.allowed || !hint.allowed ? assist.reason : "HINTS_ONLY";
    res.json({
      success: true,
      data: {
        allowed,
        reason,
        message: AI_REASON_MESSAGES[reason],
        mode: item?.aiMode ?? null,
        features: { assist: assist.allowed, complete: complete.allowed, hint: hint.allowed },
      },
    });
  } catch (err: any) {
    console.error("GET /api/ai/access:", err?.message ?? err);
    res.status(500).json({ success: false, message: "Could not check AI access." });
  }
});

router.get("/policy", async (req: Request, res: Response) => {
  const policy = await getAiPolicy();
  const author = await decideAiFor(req, "author", null);
  const tm = aiAppEnabled(policy, "tm");
  // "Open in my AI ▾" (EXTERNAL_AI_CONTRACT.md §1): shown only when the school allows it
  // and the person holds AI_EXTERNAL_CONNECT (staff).
  const externalOn = tm && !!policy?.external?.handoff;
  const handoff = externalOn && author.allowed && (await hasExternalConnect(req));
  res.json({
    success: true,
    data: {
      available: !!policy,
      enabled: !!policy?.enabled,
      apps: { tm, tmcode: aiAppEnabled(policy, "tmcode") },
      assessments: policy?.assessments ?? "teacher",
      grading: !!policy?.features.grading,
      /** Teachers' Off / Hints / Full choices are in force (else the control is disabled). */
      itemModes: tm && policy?.assessments !== "always_off",
      hasAiUse: hasAiUse(req),
      author: { allowed: author.allowed, reason: author.reason, message: author.message },
      external: {
        handoff,
        pupilNames: handoff ? policy?.external?.pupilNames ?? "never" : "never",
      },
      v: policy?.v ?? null,
    },
  });
});

router.get("/my-routes", async (req: Request, res: Response) => {
  const data = await myRoutesForUi((req as any).user?.mis_user_id);
  res.set("Cache-Control", "no-store");
  res.json({ success: true, data });
});

const DRAFT_KINDS = ["questions", "rubric", "feedback"];
const DRAFT_STATUSES = ["draft", "applied", "discarded"];
const posId = (v: unknown) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

router.get("/drafts", async (req: Request, res: Response) => {
  try {
    const where: any = { user_id: (req as any).user.id };
    const { kind, status, submission_id, assignment_id } = req.query as Record<string, string | undefined>;
    if (kind && DRAFT_KINDS.includes(kind)) where.kind = kind;
    where.status = status && DRAFT_STATUSES.includes(status) ? status : "draft";
    if (posId(submission_id)) where.submission_id = posId(submission_id);
    if (posId(assignment_id)) where.assignment_id = posId(assignment_id);
    const rows = await AiDraft.findAll({ where, order: [["id", "DESC"]], limit: 100 });
    res.set("Cache-Control", "no-store");
    res.json({ success: true, data: rows });
  } catch (err: any) {
    console.error("GET /api/ai/drafts:", err?.message ?? err);
    res.status(500).json({ success: false, message: "Could not load your AI drafts." });
  }
});

router.get("/drafts/:id", async (req: Request, res: Response) => {
  const row = await AiDraft.findOne({ where: { id: posId(req.params.id) ?? 0, user_id: (req as any).user.id } }).catch(() => null);
  if (!row) return res.status(404).json({ success: false, message: "Draft not found." });
  res.set("Cache-Control", "no-store");
  res.json({ success: true, data: row });
});

router.patch("/drafts/:id", async (req: Request, res: Response) => {
  const status = req.body?.status;
  if (!["applied", "discarded"].includes(status)) {
    return res.status(400).json({ success: false, message: 'status must be "applied" or "discarded".' });
  }
  const row = await AiDraft.findOne({ where: { id: posId(req.params.id) ?? 0, user_id: (req as any).user.id } }).catch(() => null);
  if (!row) return res.status(404).json({ success: false, message: "Draft not found." });
  await row.update({ status });
  res.json({ success: true, data: row });
});

export default router;

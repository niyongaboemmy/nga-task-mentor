import { Request, Response } from "express";
import { Op } from "sequelize";
import { z } from "zod";
import { ProjectEvent } from "../models";
import { tmcodeError } from "../middleware/tmcodeAuth";
import { resolveProjectAccess } from "../tmcode/projects/access";

/**
 * A project's activity log from TMCode (nga-tmcode docs/AI_AND_ACTIVITY_PLAN.md C): everything the
 * student did in the folder except typing — files, copy/paste, runs, terminal, git, extensions —
 * and every use of AI, named per event. TMCode uploads in batches; teachers who can see the
 * project read it in grading.
 *
 *   POST /projects/:id/activity { batch, events[] }   owner / members (idempotent per batch id)
 *   GET  /projects/:id/activity?before=&limit=         owner / members / teachers / admins
 *
 * Batches are kept as project_events rows of type "activity" (data: { batch, events }), so no
 * new table is needed; they never reach the project's live event stream.
 */

const Actor = z.object({ type: z.enum(["you", "extension", "tmcode-ai", "outside"]), id: z.string().max(200).optional(), name: z.string().max(200).optional(), ai: z.boolean().optional(), likely: z.string().max(200).optional() });
const Event = z.object({
  t: z.number().int().positive(),
  kind: z.enum(["file", "clipboard", "ai", "run", "terminal", "git", "extension", "project", "editor"]),
  action: z.string().max(40),
  path: z.string().max(500).optional(),
  to: z.string().max(500).optional(),
  text: z.string().max(400),
  data: z.record(z.string().max(40), z.union([z.string().max(600), z.number(), z.boolean(), z.null()])).optional(),
  actor: Actor,
  ai: z.object({ by: z.string().max(200), how: z.string().max(200), model: z.string().max(200).optional() }).optional(),
  count: z.number().int().positive().optional(),
});
const Upload = z.object({ batch: z.string().min(8).max(64), events: z.array(Event).min(1).max(500) });

export async function uploadActivity(req: Request, res: Response) {
  const access = await resolveProjectAccess(req, Number(req.params.id));
  if (!access) return tmcodeError(res, 404, "NOT_FOUND", "Project not found.");
  if (!access.canPresence) return tmcodeError(res, 403, "FORBIDDEN", "Only the project's owner and members record its activity.");
  const parsed = Upload.safeParse(req.body);
  if (!parsed.success) return tmcodeError(res, 400, "VALIDATION", "That activity batch isn't valid.");
  const { batch, events } = parsed.data;
  // A batch sent twice (a retry after a lost reply) is stored once.
  const seen = await ProjectEvent.findOne({ where: { project_id: access.project.id, type: "activity", user_id: req.user.id, data: { batch } } as never, attributes: ["id"] }).catch(() => null);
  if (!seen) {
    await ProjectEvent.create({ project_id: access.project.id, user_id: req.user.id, type: "activity", data: { batch, events }, created_at: new Date() } as never);
  }
  res.status(201).json({ ok: true, stored: events.length });
}

export async function listActivity(req: Request, res: Response) {
  const access = await resolveProjectAccess(req, Number(req.params.id));
  if (!access) return tmcodeError(res, 404, "NOT_FOUND", "Project not found.");
  const limit = Math.min(2000, Math.max(1, Number(req.query.limit) || 500));
  const before = Number(req.query.before) || null;
  const rows = await ProjectEvent.findAll({
    where: { project_id: access.project.id, type: "activity", ...(before ? { id: { [Op.lt]: before } } : {}) },
    order: [["id", "DESC"]],
    limit: 200,
  });
  const events: (z.infer<typeof Event> & { user_id: number | null })[] = [];
  for (const r of rows) {
    const list = ((r.data as { events?: z.infer<typeof Event>[] } | null)?.events ?? []).map((e) => ({ ...e, user_id: r.user_id ?? null }));
    events.push(...list);
  }
  events.sort((a, b) => b.t - a.t);
  const page = events.slice(0, limit);
  const ai = events.filter((e) => e.ai);
  const tools = new Map<string, number>();
  for (const e of ai) tools.set(e.ai!.by, (tools.get(e.ai!.by) ?? 0) + (e.count ?? 1));
  const byKind: Record<string, number> = {};
  for (const e of events) byKind[e.kind] = (byKind[e.kind] ?? 0) + (e.count ?? 1);
  const pastes = events.filter((e) => e.action === "paste");
  res.json({
    events: page,
    next_before: rows.length === 200 ? rows[rows.length - 1].id : null,
    summary: {
      total: events.length,
      ai_events: ai.length,
      ai_tools: [...tools].map(([by, count]) => ({ by, count })).sort((a, b) => b.count - a.count),
      ai_chars: ai.reduce((n, e) => n + (typeof e.data?.chars === "number" ? e.data.chars : 0), 0),
      pastes_outside: pastes.filter((e) => e.data?.origin === "outside").length,
      pastes_from_ai: pastes.filter((e) => e.data?.origin === "ai").length,
      by_kind: byKind,
      first_at: events.length ? events[events.length - 1].t : null,
      last_at: events.length ? events[0].t : null,
    },
  });
}

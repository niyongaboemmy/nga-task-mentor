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
  ai: z.object({ by: z.string().max(200), how: z.string().max(200), model: z.string().max(200).optional(), tier: z.enum(["free", "premium", "byok"]).optional() }).optional(),
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

type StoredEvent = z.infer<typeof Event> & { user_id: number | null };

/** Batches read for the summary: every one a project realistically has (a cap keeps a runaway log cheap). */
const SUMMARY_ROWS = 5000;

/**
 * The teacher's overview of a project's activity, over ALL of it (not just the page shown):
 * how often the student copied, cut and pasted (and where pasted text came from), brought files
 * in, used AI (by tool) or tried to while it was off, ran things, and spent time in other apps.
 * A merged entry (`count`) counts as that many.
 */
export function summarizeActivity(events: StoredEvent[]) {
  const n = (e: StoredEvent) => e.count ?? 1;
  const sum = (list: StoredEvent[], f: (e: StoredEvent) => number = n) => list.reduce((a, e) => a + f(e), 0);
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  const clip = events.filter((e) => e.kind === "clipboard");
  const of = (action: string) => clip.filter((e) => e.action === action);
  const pastes = of("paste");
  const drops = of("drop");
  const pastedIn = [...pastes, ...drops];
  const origin = (o: string) => pastedIn.filter((e) => e.data?.origin === o);
  const ai = events.filter((e) => e.ai);
  const tools = new Map<string, number>();
  for (const e of ai) tools.set(e.ai!.by, (tools.get(e.ai!.by) ?? 0) + n(e));
  const byKind: Record<string, number> = {};
  for (const e of events) byKind[e.kind] = (byKind[e.kind] ?? 0) + n(e);
  const away = events.filter((e) => e.kind === "editor" && e.action === "away");
  const filesIn = (action: string) => sum(events.filter((e) => e.action === action), (e) => (num(e.data?.count) || 1) * n(e));
  return {
    total: events.length,
    ai_events: ai.length,
    ai_tools: [...tools].map(([by, count]) => ({ by, count })).sort((a, b) => b.count - a.count),
    ai_chars: ai.reduce((t, e) => t + num(e.data?.chars), 0),
    ai_blocked: sum(events.filter((e) => e.action === "blocked")),
    copies: sum(of("copy")),
    cuts: sum(of("cut")),
    pastes: sum(pastes),
    drops: sum(drops),
    pastes_inside: sum(origin("inside")),
    pastes_outside: sum(origin("outside")),
    pastes_from_ai: sum(origin("ai")),
    chars_pasted_outside: sum(origin("outside"), (e) => num(e.data?.chars) * n(e)),
    files_copied: filesIn("copy-files"),
    files_cut: filesIn("cut-files"),
    files_imported: filesIn("import"),
    terminal_commands: sum(events.filter((e) => e.kind === "terminal" && e.action === "command")),
    runs: sum(events.filter((e) => e.kind === "run")),
    outside_changes: sum(events.filter((e) => e.action === "outside-change")),
    away_count: sum(away),
    away_seconds: sum(away, (e) => num(e.data?.seconds)),
    by_kind: byKind,
    first_at: events.length ? Math.min(...events.map((e) => e.t)) : null,
    last_at: events.length ? Math.max(...events.map((e) => e.t)) : null,
  };
}

const eventsOf = (rows: ProjectEvent[]): StoredEvent[] =>
  rows.flatMap((r) => ((r.data as { events?: z.infer<typeof Event>[] } | null)?.events ?? []).map((e) => ({ ...e, user_id: r.user_id ?? null })));

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
  const events = eventsOf(rows).sort((a, b) => b.t - a.t);
  // The summary is the whole project's, whichever page is asked for.
  const all = await ProjectEvent.findAll({
    where: { project_id: access.project.id, type: "activity" },
    attributes: ["id", "user_id", "data"],
    order: [["id", "DESC"]],
    limit: SUMMARY_ROWS,
  });
  res.json({
    events: events.slice(0, limit),
    next_before: rows.length === 200 ? rows[rows.length - 1].id : null,
    summary: summarizeActivity(eventsOf(all)),
  });
}

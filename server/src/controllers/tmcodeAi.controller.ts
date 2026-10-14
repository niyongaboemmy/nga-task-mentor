import { randomUUID } from "node:crypto";
import { Request, Response } from "express";
import { Op } from "sequelize";
import { z } from "zod";
import { TmcodeSession } from "../models";
import { tmcodeError } from "../middleware/tmcodeAuth";
import { AiError, catalog, complete, configured, openRouterRemaining, PROVIDERS, remaining, streamChat, userLimit, userUsed, type ChatMessage, type ProviderId } from "../tmcode/ai/service";

/**
 * /api/tmcode/ai — TMCode AI (free AI only; nga-tmcode docs/AI_AND_ACTIVITY_PLAN.md B).
 *   GET  /ai/status           modes, free models, today's allowance and pools
 *   POST /ai/chat             { messages, context?, mode } → { id }
 *   GET  /ai/chat/:id/stream  text/event-stream: meta, delta, done | error
 *   POST /ai/complete         { prefix, suffix, language, path, mode } → { text | null }
 * Never during an exam: a student with an active TMCode exam session is refused.
 */

const userId = (req: Request) => (req.user as { id: number }).id;

async function inExam(id: number) {
  const s = await TmcodeSession.findOne({ where: { user_id: id, status: "active", ended_at: { [Op.is]: null } } as never, attributes: ["id"] });
  return !!s;
}

function refuseInExam(res: Response) {
  return tmcodeError(res, 403, "EXAM_ACTIVE", "TMCode AI is off while you're taking an exam.");
}

export async function aiStatus(req: Request, res: Response) {
  const id = userId(req);
  const pools: Record<string, { label: string; used: number; limit: number; remaining: number }> = {};
  for (const p of Object.keys(PROVIDERS) as ProviderId[]) {
    if (!configured(p)) continue;
    pools[p] = { label: PROVIDERS[p].label, ...(await remaining(p)) };
  }
  const or = await openRouterRemaining();
  res.json({
    enabled: Object.keys(pools).length > 0,
    exam: await inExam(id),
    default_mode: "free",
    modes: [
      { id: "free", label: "Free (OpenRouter)", detail: "OpenRouter's free models. The school shares 50 of these requests a day." },
      { id: "auto", label: "Auto", detail: "Picks a free AI that still has requests left today, and keeps OpenRouter's shared requests for when they're needed." },
    ],
    models: catalog(),
    you: {
      chat: { used: userUsed(id, "chat"), limit: userLimit("chat") },
      complete: { used: userUsed(id, "complete"), limit: userLimit("complete") },
    },
    pools,
    openrouter: or,
  });
}

const ChatSchema = z.object({
  mode: z.string().max(200).default("free"),
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(40_000) }))
    .min(1)
    .max(40),
  context: z
    .object({
      file: z.string().max(500).optional(),
      language: z.string().max(60).optional(),
      selection: z.string().max(20_000).optional(),
      fileText: z.string().max(60_000).optional(),
      problems: z.array(z.string().max(500)).max(30).optional(),
      task: z.string().max(4_000).optional(),
    })
    .optional(),
});

const SYSTEM = `You are TMCode AI, the coding assistant inside TMCode, the code editor of New Generation Academy (a school).
Help the student learn while they code: explain clearly and briefly, show small correct code, and say why it works.
Use Markdown. Put code in fenced blocks with the language, and when a block replaces code in the student's file, write the file name on the line before it.
If the student asks you to do a graded assignment for them entirely, guide them step by step instead of writing all of it.`;

function buildMessages(input: z.infer<typeof ChatSchema>): ChatMessage[] {
  const c = input.context;
  const parts: string[] = [];
  if (c?.task) parts.push(`The task the student is working on:\n${c.task}`);
  if (c?.file) parts.push(`Open file: ${c.file}${c.language ? ` (${c.language})` : ""}`);
  if (c?.selection) parts.push(`Selected code:\n\`\`\`${c.language ?? ""}\n${c.selection}\n\`\`\``);
  else if (c?.fileText) parts.push(`The file:\n\`\`\`${c.language ?? ""}\n${c.fileText}\n\`\`\``);
  if (c?.problems?.length) parts.push(`Problems the editor reports:\n${c.problems.map((p) => `- ${p}`).join("\n")}`);
  const system = parts.length ? `${SYSTEM}\n\n${parts.join("\n\n")}` : SYSTEM;
  return [{ role: "system", content: system }, ...input.messages];
}

const jobs = new Map<string, { user: number; mode: string; messages: ChatMessage[]; at: number }>();

export async function aiChat(req: Request, res: Response) {
  const parsed = ChatSchema.safeParse(req.body);
  if (!parsed.success) return tmcodeError(res, 400, "VALIDATION", "That request isn't valid.");
  const id = userId(req);
  if (await inExam(id)) return refuseInExam(res);
  for (const [k, j] of jobs) if (Date.now() - j.at > 120_000) jobs.delete(k);
  const job = randomUUID();
  jobs.set(job, { user: id, mode: parsed.data.mode, messages: buildMessages(parsed.data), at: Date.now() });
  res.status(201).json({ id: job });
}

export async function aiChatStream(req: Request, res: Response) {
  const job = jobs.get(String(req.params.id));
  if (!job || job.user !== userId(req)) return tmcodeError(res, 404, "NOT_FOUND", "That answer isn't available any more. Ask again.");
  jobs.delete(String(req.params.id));
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();
  const send = (event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  const abort = new AbortController();
  req.on("close", () => abort.abort());
  try {
    const r = await streamChat(job.user, job.mode, job.messages, (m) => send("meta", m), (text) => send("delta", { text }), abort.signal);
    send("done", { ...r, you: { used: userUsed(job.user, "chat"), limit: userLimit("chat") } });
  } catch (e) {
    if (!abort.signal.aborted) {
      const err = e instanceof AiError ? e : new AiError(502, "PROVIDER_FAILED", "The AI didn't answer. Try again.");
      if (!(e instanceof AiError)) console.error("[tmcode-ai]", e);
      send("error", { code: err.code, message: err.message });
    }
  } finally {
    res.end();
  }
}

const CompleteSchema = z.object({
  mode: z.string().max(200).default("free"),
  prefix: z.string().max(20_000),
  suffix: z.string().max(10_000).default(""),
  language: z.string().max(60).default("plaintext"),
  path: z.string().max(500).default(""),
});

export async function aiComplete(req: Request, res: Response) {
  const parsed = CompleteSchema.safeParse(req.body);
  if (!parsed.success) return tmcodeError(res, 400, "VALIDATION", "That request isn't valid.");
  const id = userId(req);
  if (await inExam(id)) return refuseInExam(res);
  const abort = new AbortController();
  req.on("close", () => abort.abort());
  try {
    const r = await complete(id, parsed.data.mode, parsed.data, abort.signal);
    res.json(r ? { text: r.text, provider: r.provider, model: r.model } : { text: null });
  } catch (e) {
    if (e instanceof AiError) return tmcodeError(res, e.status, e.code, e.message);
    throw e;
  }
}

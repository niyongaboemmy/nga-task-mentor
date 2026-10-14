import { randomUUID } from "node:crypto";
import { Request, Response } from "express";
import { Op } from "sequelize";
import { z } from "zod";
import { TmcodeSession } from "../models";
import { tmcodeError } from "../middleware/tmcodeAuth";
import { AiError, catalog, complete, configured, openRouterRemaining, PROVIDERS, remaining, streamChat, userLimit, userUsed, type ChatMessage, type ProviderId, type ToolDef } from "../tmcode/ai/service";

/** Plan mode only ever gets these (the server enforces it, whatever the app sends). */
const READ_ONLY = new Set(["list_files", "read_file", "search", "get_problems"]);

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
      { id: "auto", label: "Auto", detail: "Picks a free AI that still has requests left today, and keeps OpenRouter's shared requests for when they're needed. Best for agent modes (many steps)." },
    ],
    models: catalog(),
    you: {
      chat: { used: userUsed(id, "chat"), limit: userLimit("chat") },
      agent: { used: userUsed(id, "agent"), limit: userLimit("agent") },
      complete: { used: userUsed(id, "complete"), limit: userLimit("complete") },
    },
    pools,
    openrouter: or,
  });
}

const ChatSchema = z.object({
  mode: z.string().max(200).default("free"),
  messages: z
    .array(
      z.union([
        z.object({ role: z.literal("user"), content: z.string().max(60_000) }),
        z.object({
          role: z.literal("assistant"),
          content: z.string().max(60_000).nullable(),
          tool_calls: z
            .array(z.object({ id: z.string().max(200), type: z.literal("function"), function: z.object({ name: z.string().max(80), arguments: z.string().max(200_000) }) }))
            .max(20)
            .optional(),
        }),
        z.object({ role: z.literal("tool"), tool_call_id: z.string().max(200), content: z.string().max(60_000) }),
      ]),
    )
    .min(1)
    .max(160),
  /** An agent (TMCode AI's modes that work on the project): its tools, its mode, which step this is. */
  agent: z
    .object({
      mode: z.enum(["manual", "edit", "plan", "auto"]),
      step: z.number().int().min(0).max(200),
      tools: z
        .array(z.object({ type: z.literal("function"), function: z.object({ name: z.string().max(80), description: z.string().max(2000).optional(), parameters: z.record(z.string(), z.unknown()).optional() }) }))
        .max(24),
    })
    .optional(),
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

const AGENT: Record<"manual" | "edit" | "plan" | "auto", string> = {
  plan: "PLAN MODE: explore with the read-only tools (list_files, read_file, search, get_problems), then answer with a clear, numbered plan of the changes you would make (files, what changes, why). Do not try to change anything.",
  manual: "You work on the student's project with tools. Every change you make is shown to the student to approve first; if one is rejected, ask what they want instead.",
  edit: "You work on the student's project with tools. File edits are applied directly (the student can undo them); commands need the student's approval.",
  auto: "You work on the student's project with tools. Safe actions run directly; risky ones (deleting files, installing, network) wait for the student's approval.",
};

const AGENT_RULES = `You are working inside the student's project folder in TMCode.
- Look before you change: read a file before editing it, search to find where things are.
- Prefer edit_file with a small, exact old_text (copied from the file) over rewriting whole files.
- Keep changes minimal and focused on what was asked. Keep the project's style.
- After changing code, check get_problems (and run tests or the program when that helps).
- When you are done, reply with a short summary of what you changed and why (file names), without repeating the code.`;

function buildMessages(input: z.infer<typeof ChatSchema>): ChatMessage[] {
  const c = input.context;
  const parts: string[] = [];
  if (c?.task) parts.push(`The task the student is working on:\n${c.task}`);
  if (c?.file) parts.push(`Open file: ${c.file}${c.language ? ` (${c.language})` : ""}`);
  if (c?.selection) parts.push(`Selected code:\n\`\`\`${c.language ?? ""}\n${c.selection}\n\`\`\``);
  else if (c?.fileText) parts.push(`The file:\n\`\`\`${c.language ?? ""}\n${c.fileText}\n\`\`\``);
  if (c?.problems?.length) parts.push(`Problems the editor reports:\n${c.problems.map((p) => `- ${p}`).join("\n")}`);
  const agent = input.agent ? `\n\n${AGENT_RULES}\n${AGENT[input.agent.mode]}` : "";
  const system = (parts.length ? `${SYSTEM}\n\n${parts.join("\n\n")}` : SYSTEM) + agent;
  return [{ role: "system", content: system }, ...(input.messages as ChatMessage[])];
}

const jobs = new Map<string, { user: number; mode: string; messages: ChatMessage[]; at: number; agent?: { tools: ToolDef[]; step: number } }>();

export async function aiChat(req: Request, res: Response) {
  const parsed = ChatSchema.safeParse(req.body);
  if (!parsed.success) return tmcodeError(res, 400, "VALIDATION", "That request isn't valid.");
  const id = userId(req);
  if (await inExam(id)) return refuseInExam(res);
  for (const [k, j] of jobs) if (Date.now() - j.at > 120_000) jobs.delete(k);
  const job = randomUUID();
  const a = parsed.data.agent;
  jobs.set(job, { user: id, mode: parsed.data.mode, messages: buildMessages(parsed.data), at: Date.now(), ...(a ? { agent: { tools: (a.mode === "plan" ? a.tools.filter((t) => READ_ONLY.has(t.function.name)) : a.tools) as ToolDef[], step: a.step } } : {}) });
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
    const r = await streamChat(job.user, job.mode, job.messages, (m) => send("meta", m), (text) => send("delta", { text }), abort.signal, job.agent);
    send("done", { ...r, you: { used: userUsed(job.user, "chat"), limit: userLimit("chat") }, steps: { used: userUsed(job.user, "agent"), limit: userLimit("agent") } });
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

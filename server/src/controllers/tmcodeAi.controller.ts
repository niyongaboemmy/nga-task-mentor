import { randomUUID } from "node:crypto";
import { Request, Response } from "express";
import { z } from "zod";
import { tmcodeError } from "../middleware/tmcodeAuth";
import { decideAiFor, type AiVerdict } from "../middleware/requireAi";
import { examContext, forProject, type ItemContext } from "../utils/aiContext";
import { trackAiDenied } from "../utils/aiEvents";
import { getAiPolicy, isAiDisabledError } from "../services/aiPolicy";
import { subscribeAiChanges } from "../services/aiLive";
import type { AiFeature } from "../vendor/nga-access";
import { AiError, catalog, complete, configured, openRouterRemaining, PROVIDERS, remaining, streamChat, userLimit, userUsed, type ChatMessage, type ProviderId, type ToolDef } from "../tmcode/ai/service";

/** Plan mode only ever gets these (the server enforces it, whatever the app sends). */
const READ_ONLY = new Set(["list_files", "read_file", "search", "get_problems"]);

/**
 * /api/tmcode/ai — TMCode AI (free AI only; nga-tmcode docs/AI_AND_ACTIVITY_PLAN.md B).
 *   GET  /ai/status?project_id  modes, free models, today's allowance and pools, and the
 *                               AI decision (allowed, reason, message, mode, features,
 *                               thirdPartyExtensions)
 *   POST /ai/chat             { messages, context?, mode, project_id? } → { id }
 *   GET  /ai/chat/:id/stream  text/event-stream: meta, delta, done | error (the chat's project)
 *   POST /ai/complete         { prefix, suffix, language, path, mode, project_id? } → { text | null }
 *   GET  /ai/events           text/event-stream: hello { v }, then changed { cause, … } whenever
 *                             the school's policy, an item's AI mode or the roles change (the app
 *                             asks for its status again); a ping comment every 20 s
 *
 * Who may use it (AI_USAGE_CONTROL_PLAN.md §5-6, decideAi): the school's AI policy first
 * (TMCode switched on), then -- for a student in an activity -- the teacher's ai_mode of the
 * activity the project belongs to (an open TMCode exam is always the activity, examActive),
 * else the role permission AI_USE. Refused: 403 { error_code: "AI_DISABLED", code: "AI_DISABLED",
 * reason, message }.
 */

const userId = (req: Request) => (req.user as { id: number }).id;

const projectIdOf = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/** The activity a request works in: an open exam first, else the project's activity. */
async function itemFor(req: Request, projectId: number | null): Promise<ItemContext | null> {
  return (await examContext(req)) ?? (projectId ? await forProject(req, projectId) : null);
}

async function verdictFor(req: Request, feature: AiFeature, projectId: number | null): Promise<AiVerdict> {
  return decideAiFor(req, feature, await itemFor(req, projectId), "tmcode");
}

function refuse(req: Request, res: Response, feature: AiFeature, v: Pick<AiVerdict, "reason" | "message" | "item">) {
  trackAiDenied(req, feature, v.reason, v.item);
  return tmcodeError(res, 403, "AI_DISABLED", v.message, { code: "AI_DISABLED", reason: v.reason });
}

/** Open /ai/events lines per user (an app reconnecting quickly may briefly hold two). */
const EVENT_LINES_PER_USER = 4;
const HEARTBEAT_MS = 20_000;
const eventLines = new Map<number, number>();

/**
 * Live "AI settings changed" for TMCode (services/aiLive.ts). It decides nothing: on `changed`
 * the app asks /ai/status again, which applies every rule for that user and project.
 */
export async function aiEvents(req: Request, res: Response) {
  const id = userId(req);
  const open = eventLines.get(id) ?? 0;
  if (open >= EVENT_LINES_PER_USER) return tmcodeError(res, 429, "TOO_MANY_STREAMS", "TMCode is already listening for AI changes.");
  eventLines.set(id, open + 1);
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();
  const send = (event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  const policy = await getAiPolicy();
  send("hello", { v: policy?.v ?? null });
  const unsubscribe = subscribeAiChanges((change) => send("changed", change));
  const heartbeat = setInterval(() => res.write(": ping\n\n"), HEARTBEAT_MS);
  heartbeat.unref?.();
  let closed = false;
  req.on("close", () => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    unsubscribe();
    const left = (eventLines.get(id) ?? 1) - 1;
    if (left > 0) eventLines.set(id, left);
    else eventLines.delete(id);
  });
}

export async function aiStatus(req: Request, res: Response) {
  const id = userId(req);
  const projectId = projectIdOf(req.query.project_id);
  const item = await itemFor(req, projectId);
  const [assist, completeV] = await Promise.all([
    decideAiFor(req, "assist", item, "tmcode"),
    decideAiFor(req, "complete", item, "tmcode"),
  ]);
  const pools: Record<string, { label: string; used: number; limit: number; remaining: number }> = {};
  for (const p of Object.keys(PROVIDERS) as ProviderId[]) {
    if (!configured(p)) continue;
    pools[p] = { label: PROVIDERS[p].label, ...(await remaining(p)) };
  }
  const or = await openRouterRemaining();
  res.json({
    // false also when the AI policy refuses: older TMCode builds only read this flag.
    enabled: Object.keys(pools).length > 0 && (assist.allowed || completeV.allowed),
    exam: !!item?.examActive,
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
    // AI usage control (additive): what this user may use here.
    allowed: assist.allowed,
    reason: assist.reason,
    message: assist.message,
    mode: item?.aiMode ?? null,
    features: { assist: assist.allowed, complete: completeV.allowed },
    thirdPartyExtensions: !!assist.policy?.thirdPartyExtensions && assist.allowed,
  });
}

const ChatSchema = z.object({
  mode: z.string().max(200).default("free"),
  /** The open project (its activity's AI setting applies to a student). */
  project_id: z.number().int().positive().nullable().optional(),
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

const jobs = new Map<string, { user: number; mode: string; messages: ChatMessage[]; at: number; project: number | null; agent?: { tools: ToolDef[]; step: number } }>();

export async function aiChat(req: Request, res: Response) {
  const parsed = ChatSchema.safeParse(req.body);
  if (!parsed.success) return tmcodeError(res, 400, "VALIDATION", "That request isn't valid.");
  const id = userId(req);
  const project = parsed.data.project_id ?? null;
  const v = await verdictFor(req, "assist", project);
  if (!v.allowed) return refuse(req, res, "assist", v);
  for (const [k, j] of jobs) if (Date.now() - j.at > 120_000) jobs.delete(k);
  const job = randomUUID();
  const a = parsed.data.agent;
  jobs.set(job, { user: id, mode: parsed.data.mode, messages: buildMessages(parsed.data), at: Date.now(), project, ...(a ? { agent: { tools: (a.mode === "plan" ? a.tools.filter((t) => READ_ONLY.has(t.function.name)) : a.tools) as ToolDef[], step: a.step } } : {}) });
  res.status(201).json({ id: job });
}

export async function aiChatStream(req: Request, res: Response) {
  const job = jobs.get(String(req.params.id));
  if (!job || job.user !== userId(req)) return tmcodeError(res, 404, "NOT_FOUND", "That answer isn't available any more. Ask again.");
  jobs.delete(String(req.params.id));
  // Checked again: the policy (or the exam) may have changed since the chat was asked.
  const v = await verdictFor(req, "assist", job.project);
  if (!v.allowed) return refuse(req, res, "assist", v);
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
    if (!abort.signal.aborted && isAiDisabledError(e)) {
      send("error", { code: "AI_DISABLED", reason: e.reason, message: e.message });
    } else if (!abort.signal.aborted) {
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
  project_id: z.number().int().positive().nullable().optional(),
});

export async function aiComplete(req: Request, res: Response) {
  const parsed = CompleteSchema.safeParse(req.body);
  if (!parsed.success) return tmcodeError(res, 400, "VALIDATION", "That request isn't valid.");
  const id = userId(req);
  const v = await verdictFor(req, "complete", parsed.data.project_id ?? null);
  if (!v.allowed) return refuse(req, res, "complete", v);
  const abort = new AbortController();
  req.on("close", () => abort.abort());
  try {
    const r = await complete(id, parsed.data.mode, parsed.data, abort.signal);
    res.json(r ? { text: r.text, provider: r.provider, model: r.model } : { text: null });
  } catch (e) {
    if (e instanceof AiError) return tmcodeError(res, e.status, e.code, e.message);
    if (isAiDisabledError(e)) return tmcodeError(res, 403, "AI_DISABLED", e.message, { code: "AI_DISABLED", reason: e.reason });
    throw e;
  }
}

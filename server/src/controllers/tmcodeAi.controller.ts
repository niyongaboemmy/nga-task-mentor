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
import {
  AiError,
  byokProviders,
  catalog,
  complete,
  configured,
  openRouterRemaining,
  premiumModels,
  premiumUsed,
  PROVIDERS,
  remaining,
  scrubSecrets,
  streamChat,
  userLimit,
  userUsed,
  type ChatMessage,
  type PaidAccess,
  type PaidProviderId,
  type ProviderId,
  type ToolDef,
  verifyOwnKey,
  isPaidProvider,
  parseMode,
} from "../tmcode/ai/service";
import { accessFor, byokAllowed, isStaff, premiumEntitlement } from "../services/aiEntitlements";
import { GRADING_AGENT_RULES, GRADING_SYSTEM, gradingContextText } from "../tmcode/ai/grading";
import { decideLayer, layerToken, referenceSolutions, type LayerDecision } from "../tmcode/ai/layers";
import { privacyOf, permittedForStudents, studentRouting } from "../tmcode/ai/privacy";
import { allowanceOf, identifiersOf, LEARNING_TOOLS, LearningFilter, publicPromptProblem, referenceLines, takeQuestion, tutorSystem, type LearningHelp } from "../tmcode/ai/learning";
import { coachPassIsFree, interpretCard, interpretCoach, interpretLimit, interpretUsed, interpreterArm, interpreterSteps, takeInterpret } from "../tmcode/ai/interpreter";
import { checkPromptProblem } from "../tmcode/ai/promptProblem";
import { detectLanguage } from "../tmcode/ai/intent";
import { ProjectEvent } from "../models";
import { Op } from "sequelize";

/** Plan mode only ever gets these (the server enforces it, whatever the app sends). */
const READ_ONLY = new Set(["list_files", "read_file", "search", "get_problems", "repo_map", "find_symbol", "explore", "ask_user"]);

/**
 * /api/tmcode/ai — TMCode AI (free AI only; nga-tmcode docs/AI_AND_ACTIVITY_PLAN.md B).
 *   GET  /ai/status?project_id  modes, free models, today's allowance and pools, and the
 *                               AI decision (allowed, reason, message, mode, features,
 *                               thirdPartyExtensions), staff, tiers, premium_models,
 *                               premium_you, byok_providers
 *   POST /ai/chat             { messages, context?, mode, project_id?, byok? } → { id }
 *   GET  /ai/chat/:id/stream  text/event-stream: meta, delta, done | error (the chat's project)
 *   POST /ai/complete         { prefix, suffix, language, path, mode, project_id? } → { text | null }
 *   POST /ai/byok/verify      { provider, key, model? } → { ok, provider, model } | BYOK_REJECTED
 *   GET  /ai/events           text/event-stream: hello { v }, then changed { cause, … } whenever
 *                             the school's policy, an item's AI mode or the roles change (the app
 *                             asks for its status again); a ping comment every 20 s
 *
 * Who may use it (AI_USAGE_CONTROL_PLAN.md §5-6, decideAi): the school's AI policy first
 * (TMCode switched on), then -- for a student in an activity -- the teacher's ai_mode of the
 * activity the project belongs to (an open TMCode exam is always the activity, examActive),
 * else the role permission AI_USE. Refused: 403 { error_code: "AI_DISABLED", code: "AI_DISABLED",
 * reason, message }.
 *
 * Paid modes (GRADING_PREMIUM_CONTRACTS.md): "premium:<provider>/<model>" for entitled users
 * (403 PREMIUM_REQUIRED otherwise), "byok:<provider>/<model>" with the body's byok {provider, key}
 * (the key is used for that request only: never stored, logged or echoed; a provider's refusal
 * is BYOK_REJECTED). decideAi applies to every mode.
 *
 * AI layers (nga-tmcode reports/TMCode vibe coding proposal 2026.md §8, tmcode/ai/layers.ts): a
 * learner in an item set to "hints" is in Learning -- chat answers come from the tutor with
 * read-only tools and pass the output filter (code removed, counted in `done.filtered`), each
 * question spends the item's allowance (429 LEARNING_ALLOWANCE), and suggestions are refused
 * (403 LAYER_LEARNING). /status says `layer`, the Learning knobs, `own_tools` and a signed
 * `layer_token` for the project (TMCode keeps the layer while signed out).
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
  const [layered, completeL] = await Promise.all([decideLayer(req, "assist", item), decideLayer(req, "complete", item)]);
  const assist = layered.verdict;
  const completeV = completeL.verdict;
  const learning = layered.layer === "learning";
  const pools: Record<string, { label: string; used: number; limit: number; remaining: number }> = {};
  for (const p of Object.keys(PROVIDERS) as ProviderId[]) {
    if (!configured(p)) continue;
    pools[p] = { label: PROVIDERS[p].label, ...(await remaining(p)) };
  }
  const or = await openRouterRemaining();
  const staff = isStaff(req);
  const [entitlement, ownKeys] = await Promise.all([premiumEntitlement(req), byokAllowed()]);
  const premium = premiumModels();
  const premiumOn = entitlement.entitled && premium.length > 0;
  // Staff follow the staff switch; a student in an Industrial item the teacher opened to their own
  // AI tools may use them there (Industrial · Open); Learning never (they can't be filtered).
  const thirdParty = learning ? false : staff ? assist.policy?.thirdPartyExtensionsStaff : (layered.item && layered.ownTools && layered.layer === "industrial") || assist.policy?.thirdPartyExtensions;
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
    // Staff (graders) have their own switch for third-party AI tools (grading with Claude Code…).
    thirdPartyExtensions: !!thirdParty && assist.allowed,
    staff,
    tiers: { free: true, premium: premiumOn, byok: ownKeys && assist.allowed },
    premium_models: entitlement.entitled ? premium : [],
    premium_you: entitlement.entitled ? { used: premiumUsed(id), limit: entitlement.limit } : null,
    byok_providers: byokProviders(),
    // AI layers (additive; older TMCode builds ignore them).
    layer: layered.layer,
    student_routing: studentRouting(),
    hidden_paths: hiddenPaths(layered),
    max_layer: null,
    own_tools: !!layered.item && layered.ownTools,
    learning: learning ? learningInfo(id, layered) : null,
    layer_token: layerToken(projectId, layered),
    // The request interpreter (prompt interpreter report, group Q; additive).
    interpreter: {
      available: assist.allowed && !item?.examActive && layered.layer !== "exam" && interpreterSteps("en", !staff && !!layered.item).length > 0,
      arm: interpreterArm(id, staff),
      stage: layered.help.interpreter,
      show_prompts: layered.help.show_prompts,
      prompt_problem: layered.layer === "industrial" ? publicPromptProblem(layered.help.prompt_problem) : null,
      you: { cards: { used: interpretUsed(id, "card"), limit: interpretLimit("card") }, coach: { used: interpretUsed(id, "coach"), limit: interpretLimit("coach") } },
    },
  });
}

/** The Learning knobs and the allowance left, as /status and `done` report them. */
function learningInfo(user: number, d: LayerDecision) {
  return { strength: d.help.strength, pseudo: d.help.pseudo, syntax: d.help.syntax, allowance: allowanceOf(user, allowanceScope(d), d.help) };
}

/**
 * Files hidden from AI in every layer (teacher-hidden; proposal F6): the school's list
 * (TMCODE_AI_HIDDEN_PATHS, comma-separated globs) for every assignment and quiz project.
 */
function hiddenPaths(d: LayerDecision): string[] {
  if (!d.item) return [];
  return (process.env.TMCODE_AI_HIDDEN_PATHS ?? "tests/hidden/**,.hidden/**,solution/**,reference/**,*.solution.*,marking/**")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 50);
}

/** One allowance per item (a student's questions in Web Project 2 don't use up Quiz 3's). */
const allowanceScope = (d: LayerDecision) => (d.item ? `${d.item.kind}:${d.item.id}` : "none");

/** A BYOK request's key: used for this request only, never stored, logged or echoed. */
export const ByokSchema = z.object({
  provider: z.string().max(40),
  key: z.string().min(8).max(500),
});

const GradingSchema = z.object({
  activity_title: z.string().max(500).default(""),
  brief: z.string().max(12_000).default(""),
  rubric: z
    .array(
      z.object({
        index: z.number().int().min(0).max(100),
        criteria: z.string().max(500),
        description: z.string().max(2_000).nullable().optional(),
        max_score: z.number().min(0).max(10_000),
      }),
    )
    .max(50)
    .default([]),
  student_name: z.string().max(200).default(""),
  question_text: z.string().max(12_000).optional(),
});

/** An image in a question: a data: URL of a png, jpeg, gif or webp (about 5 MB at most). */
const IMAGE_URL = /^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/;
export const MAX_CHAT_IMAGES = 4;
const UserContentSchema = z.union([
  z.string().max(60_000),
  z
    .array(
      z.union([
        z.object({ type: z.literal("text"), text: z.string().max(60_000) }),
        z.object({ type: z.literal("image_url"), image_url: z.object({ url: z.string().max(7_000_000).regex(IMAGE_URL) }) }),
      ]),
    )
    .min(1)
    .max(MAX_CHAT_IMAGES + 4),
]);

export const ChatSchema = z.object({
  mode: z.string().max(200).default("free"),
  byok: ByokSchema.optional(),
  /** The open project (its activity's AI setting applies to a student). */
  project_id: z.number().int().positive().nullable().optional(),
  messages: z
    .array(
      z.union([
        z.object({ role: z.literal("user"), content: UserContentSchema }),
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
    .max(160)
    .refine((messages) => messages.reduce((n, m) => n + (m.role === "user" && Array.isArray(m.content) ? m.content.filter((p) => p.type === "image_url").length : 0), 0) <= MAX_CHAT_IMAGES, {
      message: `At most ${MAX_CHAT_IMAGES} images per question.`,
    }),
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
      // The task brief (with @-mentioned files it can be long).
      task: z.string().max(120_000).optional(),
      /**
       * "grading": a teacher grading a submission (staff only; ignored for anyone else);
       * "terminal": the integrated terminal asking for shell commands (TERMINAL_SYSTEM).
       */
      purpose: z.string().max(40).optional(),
      grading: GradingSchema.optional(),
      /** Industrial · Guided (proposal A6, E7): explain each step, leave TODO(you) gaps. */
      scaffolds: z.boolean().optional(),
      /** Answer in this language (TMCode's "Answer in My Language"; proposal H3). */
      reply_language: z.enum(["English", "French", "Kinyarwanda"]).optional(),
    })
    .optional(),
});

const SYSTEM = `You are TMCode AI, the coding assistant inside TMCode, the code editor of New Generation Academy (a school).
Help the student learn while they code: explain clearly and briefly, show small correct code, and say why it works.
Use Markdown. Put code in fenced blocks with the language, and when a block replaces code in the student's file, write the file name on the line before it.
If the student asks you to do a graded assignment for them entirely, guide them step by step instead of writing all of it.`;

/**
 * The terminal's AI (TMCode ≥ 1.2): plain words in, shell commands out, as one JSON object the app
 * renders as Run / Insert / Copy cards. Nothing runs without the user's click; `risk` makes the app
 * ask twice before a destructive command. The app repeats the format in its question, so an older
 * server (no "terminal" purpose) still answers in it.
 */
export const TERMINAL_SYSTEM = `You are TMCode AI inside the integrated terminal of TMCode, the code editor of New Generation Academy (a school).
The user says in plain words what they want to do in their shell, asks how a command works, or asks why a command failed.
Answer with ONE JSON object and nothing else (no Markdown fence, no text before or after it):
{"commands":[{"command":"<one shell command line>","explanation":"<what it does, one short sentence>"}],"explanation":"<one or two short sentences>","risk":"safe"|"caution"|"danger","question":"<only when you must ask something before you can answer>"}
Rules:
- Write commands for the shell, operating system and folder you are given. Prefer one command; give at most 3 alternatives or steps, in order.
- Use real commands and flags only; prefer tools that come with the system or that the project already uses (package.json scripts, Makefile, git).
- For a failed command, explain the cause in "explanation" and put the corrected command first.
- "risk": "danger" for anything that deletes or overwrites data, force-pushes or rewrites git history, uses sudo or admin rights, formats disks, changes permissions recursively, or pipes a download into a shell; "caution" for installing or removing packages, changing configuration, or network and process changes; else "safe".
- Never include secrets or keys in a command. Use placeholders like <file> when you need a value you don't know, and say so.
- If it isn't a terminal task, answer it briefly in "explanation" with an empty "commands" list.
- Help the student learn: each explanation names the important flags.`;

const AGENT: Record<"manual" | "edit" | "plan" | "auto", string> = {
  plan: "PLAN MODE: explore with the read-only tools (list_files, read_file, search, get_problems), then answer with a clear, numbered plan of the changes you would make (files, what changes, why). Do not try to change anything.",
  manual: "You work on the student's project with tools. Every change you make is shown to the student to approve first; if one is rejected, ask what they want instead.",
  edit: "You work on the student's project with tools. File edits are applied directly (the student can undo them); commands need the student's approval.",
  auto: "You work on the student's project with tools. Safe actions run directly; risky ones (deleting files, installing, network) wait for the student's approval.",
};

const AGENT_RULES = `You are working inside the student's project folder in TMCode.
- Look before you change: in an unfamiliar project start with repo_map; use find_symbol to see where something is defined and used; read a file before editing it.
- For a wide question across many files, hand it to explore (a read-only helper) to keep your context small.
- If the request is ambiguous, call ask_user with one short question and 2-4 choices instead of guessing.
- Prefer edit_file with a small, exact old_text (copied from the file) over rewriting whole files.
- Keep changes minimal and focused on what was asked. Keep the project's style.
- After changing code, check get_problems (and run tests or the program when that helps).
- When you are done, reply with a short summary of what you changed and why (file names), without repeating the code.`;

/** Industrial · Guided scaffolds: the student learns to build with AI, not only to receive code. */
export const GUIDED_SCAFFOLDS = `The student is in Industrial · Guided: you build WITH them.
- Before each tool call, write one plain sentence saying what you are about to do and why.
- In each new function that teaches something (a loop, a condition, a query), leave ONE small, clearly marked gap for the student: a line \`// TODO(you): <what to write and a hint>\` (use the language's comment syntax) instead of writing that line. Never leave a gap in configuration, security or setup code.
- End with a short list: what you built, the TODO(you) gaps you left, and how to check it works.`;

/** Learning's agent: it may look at the student's files to help, never change them. */
const LEARNING_AGENT = `You can look at the student's project with read-only tools (list_files, read_file, search, get_problems, repo_map, find_symbol, explore) to understand their code and their errors. You cannot and must not change anything. Your best move is often ask_user: ask the student what they think should happen, with 2-4 choices. Read what you need, then answer as the tutor: in words, no code.`;

/**
 * A Prompt Problem (prompt interpreter report, Q11): the student's request is the only input; the
 * AI writes the whole entry file from it. The app sends no file text, so the request must say it all.
 */
export const PROMPT_PROBLEM_SYSTEM = `You are TMCode AI answering a PROMPT PROBLEM: a student practises describing a program precisely. Write exactly the program their request describes, nothing more, as the complete contents of the file named in the task, in ONE fenced code block with the language, and nothing else (no explanation).
Follow the request literally: if it is vague or leaves something out, do NOT fill the gap with what the examples suggest -- the student must learn to say it. Define functions at the top level of the file so they can be imported.`;

export function buildMessages(input: z.infer<typeof ChatSchema>, staff = false, learning: LearningHelp | null = null): ChatMessage[] {
  const c = input.context;
  if (!learning && !input.agent && c?.purpose === "prompt-problem") {
    const task = c.task ? `\n\nThe task: ${c.task.slice(0, 4000)}` : "";
    return [{ role: "system", content: PROMPT_PROBLEM_SYSTEM + task }, ...(input.messages as ChatMessage[])];
  }
  const parts: string[] = [];
  const grading = !learning && staff && c?.purpose === "grading";
  if (grading && c?.grading) parts.push(gradingContextText(c.grading));
  if (c?.task) parts.push(grading ? `More about the task:\n${c.task}` : `The task the student is working on:\n${c.task}`);
  if (c?.file) parts.push(`Open file: ${c.file}${c.language ? ` (${c.language})` : ""}`);
  if (c?.selection) parts.push(`Selected code:\n\`\`\`${c.language ?? ""}\n${c.selection}\n\`\`\``);
  else if (c?.fileText) parts.push(`The file:\n\`\`\`${c.language ?? ""}\n${c.fileText}\n\`\`\``);
  if (c?.problems?.length) parts.push(`Problems the editor reports:\n${c.problems.map((p) => `- ${p}`).join("\n")}`);
  if (c?.reply_language) parts.push(`Reply in ${c.reply_language}. Keep English programming keywords and explain each one briefly the first time.`);
  const agent = learning
    ? input.agent
      ? `\n\n${LEARNING_AGENT}`
      : ""
    : input.agent
      ? `\n\n${grading ? GRADING_AGENT_RULES : AGENT_RULES}\n${grading && input.agent.mode !== "plan" ? "" : AGENT[input.agent.mode]}`.trimEnd()
      : "";
  const scaffolds = !learning && !grading && input.agent && c?.scaffolds ? `\n\n${GUIDED_SCAFFOLDS}` : "";
  const base = learning ? tutorSystem(learning) : grading ? GRADING_SYSTEM : c?.purpose === "terminal" && !input.agent ? TERMINAL_SYSTEM : SYSTEM;
  const system = (parts.length ? `${base}\n\n${parts.join("\n\n")}` : base) + agent + scaffolds;
  return [{ role: "system", content: system }, ...(input.messages as ChatMessage[])];
}

/** Asked chats waiting for their stream. A BYOK key stays here (memory only) until its stream starts. */
const jobs = new Map<string, { user: number; mode: string; messages: ChatMessage[]; at: number; project: number | null; agent?: { tools: ToolDef[]; step: number }; access?: PaidAccess; route?: { learning: boolean; student: boolean }; learning?: { identifiers: Set<string>; reference: Set<string>; syntax: boolean; allowance: ReturnType<typeof allowanceOf> } }>();

/** Paid-mode refusals (PREMIUM_REQUIRED, BYOK_DISABLED, BYOK_KEY_REQUIRED, MODEL_UNKNOWN), as JSON. */
async function paidAccessOr(req: Request, res: Response, mode: string, byok: { provider: string; key: string } | undefined): Promise<{ access?: PaidAccess } | null> {
  const a = await accessFor(req, mode, byok);
  if (!a.ok) {
    tmcodeError(res, a.status, a.code, a.message, { code: a.code });
    return null;
  }
  return { access: a.access };
}

export async function aiChat(req: Request, res: Response) {
  const parsed = ChatSchema.safeParse(req.body);
  if (!parsed.success) return tmcodeError(res, 400, "VALIDATION", "That request isn't valid.");
  const id = userId(req);
  const project = parsed.data.project_id ?? null;
  const layered = await decideLayer(req, "assist", await itemFor(req, project));
  const v = layered.verdict;
  if (!v.allowed) return refuse(req, res, "assist", v);
  const learning = layered.layer === "learning";
  const a = parsed.data.agent;
  // Learning: each question (not an agent's later steps) spends the item's allowance.
  let allowance: ReturnType<typeof allowanceOf> | null = null;
  if (learning) {
    if (!a || a.step === 0) {
      const t = takeQuestion(id, allowanceScope(layered), layered.help);
      if (!t.ok) {
        const wait = t.allowance.next_in_s ?? 60;
        return tmcodeError(res, 429, "LEARNING_ALLOWANCE", `You've used your questions for now. One comes back in ${wait < 90 ? `${wait} seconds` : `${Math.ceil(wait / 60)} minutes`}: try the next step yourself meanwhile.`, { code: "LEARNING_ALLOWANCE", allowance: t.allowance });
      }
      allowance = t.allowance;
    } else allowance = allowanceOf(id, allowanceScope(layered), layered.help);
  }
  const paid = await paidAccessOr(req, res, parsed.data.mode, parsed.data.byok);
  if (!paid) return;
  // J4: a student's Learning/Guided request only reaches providers the school's routing permits.
  const student = !isStaff(req) && !!layered.item;
  const paidMode = parseMode(parsed.data.mode);
  if (student && paidMode.tier !== "free" && !permittedForStudents(paidMode.provider, paidMode.tier)) {
    return tmcodeError(res, 403, "PROVIDER_NOT_PERMITTED", `Your school doesn't let student work reach ${paidMode.provider} (its terms or data use). Pick another AI.`, { code: "PROVIDER_NOT_PERMITTED" });
  }
  for (const [k, j] of jobs) if (Date.now() - j.at > 120_000) jobs.delete(k);
  const job = randomUUID();
  const c = parsed.data.context;
  const tools = a ? ((learning ? a.tools.filter((t) => LEARNING_TOOLS.has(t.function.name)) : a.mode === "plan" ? a.tools.filter((t) => READ_ONLY.has(t.function.name)) : a.tools) as ToolDef[]) : null;
  jobs.set(job, {
    user: id,
    mode: parsed.data.mode,
    messages: buildMessages(parsed.data, isStaff(req), learning ? layered.help : null),
    at: Date.now(),
    project,
    ...(a && tools ? { agent: { tools, step: a.step } } : {}),
    ...(paid.access ? { access: paid.access } : {}),
    route: { learning, student },
    ...(learning
      ? { learning: { identifiers: identifiersOf(`${c?.fileText ?? ""}\n${c?.selection ?? ""}`), reference: referenceLines(await referenceSolutions(layered.item)), syntax: layered.help.syntax, allowance: allowance! } }
      : {}),
  });
  // Unclaimed jobs (and any key in them) don't outlive two minutes.
  setTimeout(() => jobs.delete(job), 120_000).unref?.();
  res.status(201).json({ id: job });
}

export async function aiChatStream(req: Request, res: Response) {
  const job = jobs.get(String(req.params.id));
  if (!job || job.user !== userId(req)) return tmcodeError(res, 404, "NOT_FOUND", "That answer isn't available any more. Ask again.");
  jobs.delete(String(req.params.id));
  // Checked again: the policy (or the exam, or the item's layer) may have changed since the chat was asked.
  const layered = await decideLayer(req, "assist", await itemFor(req, job.project));
  const v = layered.verdict;
  if (!v.allowed) return refuse(req, res, "assist", v);
  // Became Learning meanwhile: this answer was asked for Industrial, so it isn't given.
  if (layered.layer === "learning" && !job.learning) return tmcodeError(res, 409, "LAYER_CHANGED", "Your teacher changed this to Learning. Ask again.", { code: "LAYER_CHANGED" });
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();
  const send = (event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  const abort = new AbortController();
  req.on("close", () => abort.abort());
  const access = job.access;
  // The key (BYOK) now lives only in this request's scope, until the stream ends.
  delete job.access;
  const key = access?.tier === "byok" ? access.key : null;
  // Learning: everything the model says passes the filter before the student sees it.
  const filter = job.learning ? new LearningFilter({ identifiers: job.learning.identifiers, reference: job.learning.reference, syntax: job.learning.syntax }) : null;
  const delta = (text: string) => {
    const out = filter ? filter.push(text) : text;
    if (out) send("delta", { text: out });
  };
  try {
    // Each answer says where it came from and what that provider's terms are (J4 badge).
    const meta = (m: { provider: string; model: string; tier: "free" | "premium" | "byok" }) => send("meta", { ...m, privacy: privacyOf(m.provider, m.tier)?.label ?? null });
    const r = await streamChat(job.user, job.mode, job.messages, meta, delta, abort.signal, job.agent, { access, ...(job.route ? { route: job.route } : {}) });
    if (filter) {
      const rest = filter.end();
      if (rest) send("delta", { text: rest });
      // A tool the tutor may not have never reaches the app, whatever the model asked for.
      if (r.tool_calls) r.tool_calls = r.tool_calls.filter((t) => LEARNING_TOOLS.has(t.function.name));
      if (r.tool_calls && !r.tool_calls.length) delete r.tool_calls;
    }
    send("done", {
      ...r,
      ...(filter && job.learning ? { layer: "learning", filtered: { removed: filter.removed }, allowance: job.learning.allowance } : {}),
      you: { used: userUsed(job.user, "chat"), limit: userLimit("chat") },
      steps: { used: userUsed(job.user, "agent"), limit: userLimit("agent") },
      ...(access?.tier === "premium" ? { premium_you: { used: premiumUsed(job.user), limit: access.limit } } : {}),
    });
  } catch (e) {
    if (!abort.signal.aborted && isAiDisabledError(e)) {
      send("error", { code: "AI_DISABLED", reason: e.reason, message: e.message });
    } else if (!abort.signal.aborted) {
      const err = e instanceof AiError ? e : new AiError(502, "PROVIDER_FAILED", "The AI didn't answer. Try again.");
      // Paid requests: the service already turned every failure into a scrubbed AiError.
      if (!(e instanceof AiError) && !access) console.error("[tmcode-ai]", e);
      send("error", { code: err.code, message: scrubSecrets(err.message, key) });
    }
  } finally {
    res.end();
  }
}

const CompleteSchema = z.object({
  mode: z.string().max(200).default("free"),
  byok: ByokSchema.optional(),
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
  const layered = await decideLayer(req, "complete", await itemFor(req, parsed.data.project_id ?? null));
  // Learning: suggestions are generated code. Not AI_DISABLED: the tutor stays on.
  if (layered.layer === "learning") return tmcodeError(res, 403, "LAYER_LEARNING", layered.verdict.message, { code: "LAYER_LEARNING" });
  const v = layered.verdict;
  if (!v.allowed) return refuse(req, res, "complete", v);
  const paid = await paidAccessOr(req, res, parsed.data.mode, parsed.data.byok);
  if (!paid) return;
  const abort = new AbortController();
  req.on("close", () => abort.abort());
  try {
    const r = await complete(id, parsed.data.mode, parsed.data, abort.signal, { access: paid.access });
    res.json(r ? { text: r.text, provider: r.provider, model: r.model, tier: r.tier } : { text: null });
  } catch (e) {
    if (e instanceof AiError) return tmcodeError(res, e.status, e.code, e.message);
    if (isAiDisabledError(e)) return tmcodeError(res, 403, "AI_DISABLED", e.message, { code: "AI_DISABLED", reason: e.reason });
    throw e;
  }
}

const VerifyKeySchema = ByokSchema.extend({ model: z.string().max(200).regex(/^\S*$/).optional() });

/**
 * POST /ai/byok/verify: "Test key" in TMCode's settings. Same rules as an own-key question (AI
 * allowed for this user, own keys allowed by the school); the key is used once and never kept.
 */
export async function aiVerifyKey(req: Request, res: Response) {
  const parsed = VerifyKeySchema.safeParse(req.body);
  if (!parsed.success || !isPaidProvider(parsed.data.provider)) return tmcodeError(res, 400, "VALIDATION", "That request isn't valid.");
  const v = await verdictFor(req, "assist", null);
  if (!v.allowed) return refuse(req, res, "assist", v);
  if (!(await byokAllowed())) return tmcodeError(res, 403, "BYOK_DISABLED", "The school has switched off using your own API keys. Use the free AI.", { code: "BYOK_DISABLED" });
  const abort = new AbortController();
  req.on("close", () => abort.abort());
  const { provider, key, model } = parsed.data;
  try {
    const r = await verifyOwnKey(provider as PaidProviderId, key, model, abort.signal);
    res.json({ ok: true, provider: r.provider, model: r.model });
  } catch (e) {
    const err = e instanceof AiError ? e : new AiError(502, "PROVIDER_FAILED", "The provider didn't answer. Try again.");
    return tmcodeError(res, err.status, err.code, scrubSecrets(err.message, key), { code: err.code });
  }
}

// ── the request interpreter (nga-tmcode reports/TMCode prompt interpreter layer.md, group Q) ──

export const InterpretSchema = z.object({
  text: z.string().trim().min(1).max(4000),
  /** "auto": the layer decides (Learning: the coach; Industrial: the card). */
  purpose: z.enum(["card", "coach", "auto"]).default("auto"),
  reply_language: z.enum(["English", "French", "Kinyarwanda"]).optional(),
  paths: z.array(z.string().max(300)).max(2000).optional(),
  symbols: z.array(z.string().max(120)).max(400).optional(),
  assignment_title: z.string().max(200).optional(),
  project_id: z.number().int().positive().nullable().optional(),
  mode: z.string().max(200).default("free"),
  byok: ByokSchema.optional(),
  /** Q15: two samples, compared (only granted on quota-rich paths). */
  samples: z.union([z.literal(1), z.literal(2)]).default(1),
  /** The draft being coached (QD2: its first coach pass is free). */
  draft_id: z.string().max(80).optional(),
  guided: z.boolean().optional(),
});

function interpreterError(res: Response, e: unknown) {
  if (e instanceof AiError) return tmcodeError(res, e.status, e.code, e.message, { code: e.code });
  if (isAiDisabledError(e)) return tmcodeError(res, 403, "AI_DISABLED", e.message, { code: "AI_DISABLED", reason: e.reason });
  throw e;
}

/**
 * POST /ai/interpret: Industrial → an intent card the user confirms (the agent then receives their
 * words plus the card); Learning → the prompt coach (missing items and the student's own words,
 * never a rewrite; the first pass on a draft is free, the next ones spend a question). Exam: 403
 * LAYER_EXAM -- the app never even loads the interpreter there. Refusals the app treats as "send
 * the words as they are": INTERPRETER_UNAVAILABLE, INTERPRETER_INVALID, INTERPRET_QUOTA, timeouts.
 */
export async function aiInterpret(req: Request, res: Response) {
  const parsed = InterpretSchema.safeParse(req.body);
  if (!parsed.success) return tmcodeError(res, 400, "VALIDATION", "That request isn't valid.");
  const b = parsed.data;
  const id = userId(req);
  const layered = await decideLayer(req, "assist", await itemFor(req, b.project_id ?? null));
  if (layered.item?.examActive || layered.layer === "exam") return tmcodeError(res, 403, "LAYER_EXAM", "No AI in exams, so there is no request check either.", { code: "LAYER_EXAM" });
  const v = layered.verdict;
  if (!v.allowed) return refuse(req, res, "assist", v);
  const staff = isStaff(req);
  const student = !staff && !!layered.item;
  const learning = layered.layer === "learning";
  const u = req.user as { first_name?: string; last_name?: string; name?: string; username?: string };
  const input = {
    text: b.text,
    replyLanguage: b.reply_language ?? null,
    paths: b.paths,
    symbols: b.symbols,
    assignmentTitle: b.assignment_title ?? null,
    names: [u.first_name, u.last_name, u.name, u.username].filter((x): x is string => !!x),
    guided: !!b.guided && !staff,
  };
  const abort = new AbortController();
  req.on("close", () => abort.abort());
  try {
    if (learning || b.purpose === "coach") {
      if (!takeInterpret(id, "coach")) return tmcodeError(res, 429, "INTERPRET_QUOTA", "You've used today's request checks. Ask the tutor directly.", { code: "INTERPRET_QUOTA" });
      let allowance: ReturnType<typeof allowanceOf> | null = null;
      if (learning && !coachPassIsFree(id, b.draft_id ?? b.text.slice(0, 80))) {
        const t = takeQuestion(id, allowanceScope(layered), layered.help);
        if (!t.ok) return tmcodeError(res, 429, "LEARNING_ALLOWANCE", "You've used your questions for now: rewrite your request yourself, then ask.", { code: "LEARNING_ALLOWANCE", allowance: t.allowance });
        allowance = t.allowance;
      }
      const r = await interpretCoach(input, { student, signal: abort.signal });
      return res.json({ kind: "coach", coach: r.coach, provider: r.provider, model: r.model, ms: r.ms, language: r.language, ...(learning ? { allowance: allowance ?? allowanceOf(id, allowanceScope(layered), layered.help) } : {}) });
    }
    if (student && layered.help.interpreter === "off") return tmcodeError(res, 403, "INTERPRETER_OFF", "Your teacher turned the request check off for this work.", { code: "INTERPRETER_OFF" });
    const paidMode = parseMode(b.mode);
    let access: PaidAccess | undefined;
    if (paidMode.tier !== "free") {
      const paid = await paidAccessOr(req, res, b.mode, b.byok);
      if (!paid) return;
      access = paid.access;
      if (student && !permittedForStudents(paidMode.provider, paidMode.tier)) return tmcodeError(res, 403, "PROVIDER_NOT_PERMITTED", `Your school doesn't let student work reach ${paidMode.provider}.`, { code: "PROVIDER_NOT_PERMITTED" });
    }
    if (!takeInterpret(id, "card")) return tmcodeError(res, 429, "INTERPRET_QUOTA", "You've used today's request checks; your words go to the AI as they are.", { code: "INTERPRET_QUOTA" });
    // Two samples only where quota is plentiful: an own key, premium, or most of today's checks left.
    const samples = b.samples === 2 && (paidMode.tier !== "free" || interpretUsed(id, "card") <= interpretLimit("card") / 2) ? 2 : 1;
    const r = await interpretCard(input, { student, signal: abort.signal, mode: paidMode.tier !== "free" ? b.mode : undefined, access, samples });
    res.json({ kind: "card", card: r.card, provider: r.provider, model: r.model, ms: r.ms, language: r.language, notes: r.notes, samples: r.samples, agreed: r.agreed, arm: interpreterArm(id, staff), stage: layered.help.interpreter });
  } catch (e) {
    return interpreterError(res, e);
  }
}

const PromptCheckSchema = z.object({ project_id: z.number().int().positive(), code: z.string().max(100_000) });

/** POST /ai/prompt-problem/check: runs the AI's code for a Prompt Problem against the shown and hidden examples. */
export async function aiPromptProblemCheck(req: Request, res: Response) {
  const parsed = PromptCheckSchema.safeParse(req.body);
  if (!parsed.success) return tmcodeError(res, 400, "VALIDATION", "That request isn't valid.");
  const layered = await decideLayer(req, "assist", await itemFor(req, parsed.data.project_id));
  if (layered.item?.examActive) return tmcodeError(res, 403, "LAYER_EXAM", "No AI in exams.", { code: "LAYER_EXAM" });
  const pp = layered.layer === "industrial" ? layered.help.prompt_problem : null;
  if (!pp) return tmcodeError(res, 404, "NO_PROMPT_PROBLEM", "This work isn't a Prompt Problem.", { code: "NO_PROMPT_PROBLEM" });
  try {
    res.json(await checkPromptProblem(pp, parsed.data.code));
  } catch (e) {
    return tmcodeError(res, 503, "RUNNER_UNAVAILABLE", `The code runner couldn't check it now: ${String((e as Error)?.message ?? e).slice(0, 200)}`, { code: "RUNNER_UNAVAILABLE" });
  }
}

type Flat = { kind?: string; action?: string; t?: number; data?: Record<string, unknown> };

/**
 * GET /ai/interpret/metrics?days=30 (staff): the online evaluation (Q14) from the activity TMCode
 * uploads -- per arm (card / holdout): requests, cards and what users did with them, latency,
 * prompt completeness, and test runs passing; per language and per stage. Metadata only.
 */
export async function aiInterpretMetrics(req: Request, res: Response) {
  if (!isStaff(req)) return tmcodeError(res, 403, "FORBIDDEN", "Staff only.");
  const days = Math.max(1, Math.min(180, Number(req.query.days) || 30));
  const rows = await ProjectEvent.findAll({ where: { type: "activity", created_at: { [Op.gte]: new Date(Date.now() - days * 86_400_000) } } as never, attributes: ["user_id", "data"], order: [["id", "DESC"]], limit: 5000 });
  type Arm = { users: Set<number>; questions: number; cards: number; outcomes: Record<string, number>; ms: number[]; completeness: number[]; runs: number; runsPassed: number; coach: number };
  const arms: Record<string, Arm> = {};
  const languages: Record<string, number> = {};
  const stages: Record<string, number> = {};
  const armOf = new Map<number, string>();
  const get = (a: string) => (arms[a] ??= { users: new Set(), questions: 0, cards: 0, outcomes: {}, ms: [], completeness: [], runs: 0, runsPassed: 0, coach: 0 });
  const all: { user: number; e: Flat }[] = [];
  for (const r of rows) {
    const d = (r as unknown as { user_id: number; data: { events?: Flat[] } }).data;
    for (const e of d?.events ?? []) all.push({ user: (r as unknown as { user_id: number }).user_id, e });
  }
  // A user's arm is what their interpreter events say (holdout students log it on their questions).
  for (const { user, e } of all) if (typeof e.data?.arm === "string") armOf.set(user, String(e.data.arm));
  for (const { user, e } of all) {
    const arm = armOf.get(user);
    if (!arm) continue;
    const a = get(arm);
    a.users.add(user);
    if (e.kind === "ai" && e.action === "chat") a.questions++;
    if (e.kind === "ai" && e.action === "intent") {
      a.cards++;
      const outcome = String(e.data?.outcome ?? "shown");
      a.outcomes[outcome] = (a.outcomes[outcome] ?? 0) + 1;
      if (typeof e.data?.ms === "number") a.ms.push(e.data.ms);
      if (typeof e.data?.completeness === "number") a.completeness.push(e.data.completeness);
      if (typeof e.data?.language === "string") languages[String(e.data.language)] = (languages[String(e.data.language)] ?? 0) + 1;
      if (typeof e.data?.stage === "string") stages[String(e.data.stage)] = (stages[String(e.data.stage)] ?? 0) + 1;
    }
    if (e.kind === "ai" && e.action === "intent-coach") a.coach++;
    if (e.kind === "run") {
      a.runs++;
      if (e.data?.status === "passed" || e.data?.passed === true) a.runsPassed++;
    }
  }
  const pct = (xs: number[], p: number) => (xs.length ? [...xs].sort((x, y) => x - y)[Math.min(xs.length - 1, Math.floor((p / 100) * xs.length))] : null);
  const mean = (xs: number[]) => (xs.length ? Math.round((xs.reduce((x, y) => x + y, 0) / xs.length) * 100) / 100 : null);
  res.json({
    days,
    arms: Object.fromEntries(
      Object.entries(arms).map(([k, a]) => [
        k,
        {
          users: a.users.size,
          questions: a.questions,
          cards: a.cards,
          coach: a.coach,
          outcomes: a.outcomes,
          accept_rate: a.cards ? Math.round(((a.outcomes.accepted ?? 0) / a.cards) * 100) / 100 : null,
          edit_rate: a.cards ? Math.round(((a.outcomes.edited ?? 0) / a.cards) * 100) / 100 : null,
          as_is_rate: a.cards ? Math.round(((a.outcomes["as-is"] ?? 0) / a.cards) * 100) / 100 : null,
          ms_p50: pct(a.ms, 50),
          ms_p95: pct(a.ms, 95),
          completeness_mean: mean(a.completeness),
          runs: a.runs,
          run_pass_rate: a.runs ? Math.round((a.runsPassed / a.runs) * 100) / 100 : null,
        },
      ]),
    ),
    languages,
    stages,
    holdout_pct: Number(process.env.TMCODE_INTERPRETER_HOLDOUT_PCT ?? 15),
  });
}

/** Exported for tests: the language a request was detected in. */
export const requestLanguage = detectLanguage;

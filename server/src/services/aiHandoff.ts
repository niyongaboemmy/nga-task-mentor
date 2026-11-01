import type { Request, Response } from "express";
import axios from "axios";
import crypto from "crypto";
import type { JSONSchema } from "./aiProviders/types";
import { matchesSchema } from "./aiProviders/schemaValidator";
import { getAiPolicy } from "./aiPolicy";
import { externalPupilDataAllowed, type AiPolicy } from "../vendor/nga-access";
import { getMisToken } from "../utils/misUtils";

/**
 * "Open in Claude / ChatGPT" + "Paste the answer" for Task Mentor
 * (nga_central_mis EXTERNAL_AI_CONTRACT.md §1; port of the MIS's services/ai/handoff.ts).
 *
 * A person's own Claude Pro / ChatGPT Plus may never be called by Task Mentor (vendor
 * terms), but the person may take Task Mentor's prompt to their own chat and bring the
 * answer back. Any AI call through generateStructuredContent / generateFreeformJSON can
 * do it, without per-feature code: the request carries `aiHandoff`, and
 *   - mode "prompt": no provider is called; the exact prompt is returned
 *     (HTTP 200 `{ success, handoff: { prompt, expects, schemaName } }`, see sendHandoff);
 *   - mode "import": the pasted answer is validated against the same schema and used as
 *     if a provider had returned it, so the feature's normal post-processing runs.
 *
 * Who: the school policy's AI switches first (assertAiApp), then policy.external.handoff,
 * then AI_EXTERNAL_CONNECT in the person's MIS permissions (staff). Never for the Socratic
 * hint or anything inside an assessment.
 */

export const CAP_EXTERNAL = "AI_EXTERNAL_CONNECT";

export type AiHandoff =
  | { mode: "prompt"; /** The person ticked "Include pupil details" for this request. */ pupilConsent?: boolean }
  | { mode: "import"; text: string };

export interface HandoffPayload {
  prompt: string;
  /** "json": the answer must be JSON (fenced); "text": any text. */
  expects: "json" | "text";
  schemaName?: string;
}

/** Not a failure: the way a prompt-mode request stops before any provider is called. */
export class HandoffPrompt extends Error {
  readonly code = "AI_HANDOFF_PROMPT";
  constructor(readonly payload: HandoffPayload) {
    super("AI hand-off prompt");
    this.name = "HandoffPrompt";
  }
}

export const isHandoffPrompt = (e: unknown): e is HandoffPrompt =>
  (e as any)?.code === "AI_HANDOFF_PROMPT" && !!(e as any)?.payload;

/** A refused hand-off (403) or an answer that can't be used (400). */
export class HandoffError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly statusCode: number = 403,
  ) {
    super(message);
    this.name = "HandoffError";
  }
}

export const isHandoffError = (e: unknown): e is HandoffError => e instanceof HandoffError;

/** What AI catch blocks must re-throw unchanged (they are answers, not provider failures). */
export const isHandoffSignal = (e: unknown) => isHandoffPrompt(e) || isHandoffError(e);

const MAX_PASTE = 200_000;

export const HANDOFF_OFF_MESSAGE = "Open in Claude / ChatGPT is turned off for the school.";
export const HANDOFF_NOT_ALLOWED_MESSAGE = "Your role cannot use your own Claude or ChatGPT with NGA.";
export const HANDOFF_ASSESSMENT_MESSAGE = "Your own Claude or ChatGPT can't be used inside a quiz or assignment.";
export const HANDOFF_PUPIL_MESSAGE =
  'This prompt includes a pupil\'s details. Tick "Include pupil details" to take it to your own AI, or use the school\'s AI.';
export const HANDOFF_BAD_ANSWER_MESSAGE =
  "The pasted answer isn't in the expected format. Paste the whole reply, including the ```json block, or ask your AI to answer again in that format.";

/**
 * `aiHandoff` from a request body (JSON, or a JSON string in a multipart field).
 * Anything malformed is ignored (normal AI call). An empty paste is kept and refused
 * when it is read (readPasted*), so this never throws.
 */
export function parseHandoff(raw: unknown): AiHandoff | undefined {
  let r: any = raw;
  if (typeof r === "string") {
    try {
      r = JSON.parse(r);
    } catch {
      return undefined;
    }
  }
  if (!r || typeof r !== "object" || Array.isArray(r)) return undefined;
  if (r.mode === "prompt") return { mode: "prompt", pupilConsent: r.pupilConsent === true };
  if (r.mode === "import") return { mode: "import", text: typeof r.text === "string" ? r.text : "" };
  return undefined;
}

/** Emails and phone numbers never leave in a prompt (same rules as the MIS chat scrub). */
export function scrub(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]")
    .replace(/(?:\+?250|0)\s?7\d(?:[\s-]?\d){7}/g, "[phone]")
    .replace(/\+\d{1,3}(?:[\s-]?\d){7,12}/g, "[phone]");
}

/** The provider prompt plus an instruction any chat model follows: one fenced JSON object. */
export function jsonHandoffPrompt(prompt: string, schema: JSONSchema): string {
  return [
    prompt.trim(),
    "",
    "Answer with ONLY one JSON object that matches this JSON Schema, inside a ```json code block, with no other text:",
    JSON.stringify(schema),
  ].join("\n");
}

/** For prompts that describe their own JSON shape (generateFreeformJSON). */
export function freeformHandoffPrompt(prompt: string): string {
  return [prompt.trim(), "", "Answer with ONLY the JSON described above, inside a ```json code block, with no other text."].join("\n");
}

function checkPaste(text: string) {
  if (!text.trim()) throw new HandoffError("Paste the answer from your AI first.", "AI_HANDOFF_BAD_ANSWER", 400);
  if (text.length > MAX_PASTE) throw new HandoffError("That answer is too long to import.", "AI_HANDOFF_BAD_ANSWER", 400);
}

const fencedBlocks = (text: string) => [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)].map((m) => m[1].trim());

/**
 * The JSON object in a pasted answer: the last ```json block, else the outermost {...},
 * checked with matchesSchema. Throws a 400 a person can act on.
 */
export function readPastedJson<T>(text: string, schema: JSONSchema): T {
  checkPaste(text);
  const fenced = fencedBlocks(text).filter((s) => s.startsWith("{"));
  const candidates = fenced.length ? fenced.reverse() : [];
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) candidates.push(text.slice(first, last + 1));
  for (const c of candidates) {
    try {
      const parsed = JSON.parse(c);
      if (matchesSchema(parsed, schema)) return parsed as T;
    } catch {
      /* try the next candidate */
    }
  }
  throw new HandoffError(HANDOFF_BAD_ANSWER_MESSAGE, "AI_HANDOFF_BAD_ANSWER", 400);
}

/** Freeform JSON (an object or an array): the last fenced block, else the whole text, parsed leniently. */
export function readPastedFreeform<T>(text: string, parse: (s: string) => any): T {
  checkPaste(text);
  const fenced = fencedBlocks(text).filter((s) => s.startsWith("{") || s.startsWith("["));
  const candidates = [...fenced.reverse(), text];
  for (const c of candidates) {
    try {
      const parsed = parse(c);
      if (parsed && typeof parsed === "object") return parsed as T;
    } catch {
      /* next */
    }
  }
  throw new HandoffError(HANDOFF_BAD_ANSWER_MESSAGE, "AI_HANDOFF_BAD_ANSWER", 400);
}

// ─── Who may hand off ────────────────────────────────────────────────────────

const PERMS_TTL_MS = 60_000;
const permsCache = new Map<string, { at: number; perms: Set<string> }>();
type MisPermsFetcher = (token: string) => Promise<string[]>;

const defaultFetcher: MisPermsFetcher = async (token) => {
  const res = await axios.get(`${process.env.NGA_MIS_BASE_URL}/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
    timeout: 5000,
  });
  const list = res.data?.data?.permissions;
  return Array.isArray(list) ? list.filter((p: unknown) => typeof p === "string") : [];
};
let fetcher: MisPermsFetcher = defaultFetcher;

/** Tests: replace the MIS /users/me permission lookup (null = the real one). */
export function __setMisPermissionsFetcher(fn: MisPermsFetcher | null) {
  fetcher = fn ?? defaultFetcher;
  permsCache.clear();
}

/** The person's MIS permission list (GET /users/me, 60 s cache). Empty when MIS can't answer. */
async function misPermissions(req: Request): Promise<Set<string>> {
  const token = getMisToken(req, { quiet: true });
  if (!token) return new Set();
  // Per MIS user (a new session token of the same person reuses it); else per token.
  const misUserId = Number((req as any).user?.mis_user_id);
  const key = Number.isInteger(misUserId) && misUserId > 0 ? `u${misUserId}` : `t${crypto.createHash("sha256").update(token).digest("hex")}`;
  const hit = permsCache.get(key);
  if (hit && Date.now() - hit.at < PERMS_TTL_MS) return hit.perms;
  try {
    const perms = new Set(await fetcher(token));
    if (permsCache.size > 5000) permsCache.clear();
    permsCache.set(key, { at: Date.now(), perms });
    return perms;
  } catch (err: any) {
    console.warn(`[ai-handoff] MIS permissions unavailable: ${err?.message ?? err}`);
    return new Set();
  }
}

export const isStudentRequest = (req: Request) => String((req as any).user?.role || "").toLowerCase() === "student";

/**
 * AI_EXTERNAL_CONNECT: an MIS capability (legacy-visible), so it is in the person's MIS
 * permission list; under ACCESS_V2_MODE=enforce it is also among req.user.permissions.
 * Students never, whatever a list says.
 */
export async function hasExternalConnect(req: Request): Promise<boolean> {
  if (!(req as any).user) return false;
  if (isStudentRequest(req)) return false;
  const local: Set<string> | undefined = (req as any).user.permissions;
  if (local?.has?.(CAP_EXTERNAL)) return true;
  return (await misPermissions(req)).has(CAP_EXTERNAL);
}

/** The bits of a request a hand-off check needs, captured at request time (jobs run later). */
export interface HandoffContext {
  handoff: AiHandoff;
  /** Resolves AI_EXTERNAL_CONNECT for the person (memoised). */
  externalAllowed: () => Promise<boolean>;
}

export function handoffFrom(req: Request): HandoffContext | undefined {
  const handoff = parseHandoff((req as any).body?.aiHandoff);
  if (!handoff) return undefined;
  let memo: Promise<boolean> | null = null;
  return { handoff, externalAllowed: () => (memo ??= hasExternalConnect(req)) };
}

/**
 * Throws the contract's 403 unless this hand-off may go ahead. The policy's master and
 * Task Mentor switches are checked by the caller (assertAiApp) first.
 */
export async function assertHandoffAllowed(
  ctx: { handoff?: AiHandoff; externalAllowed?: () => Promise<boolean>; task?: string; inAssessment?: boolean },
  policy?: AiPolicy | null,
): Promise<void> {
  // Hints and anything inside an assessment: never, whatever the policy says.
  if (ctx.task === "hint" || ctx.inAssessment) throw new HandoffError(HANDOFF_ASSESSMENT_MESSAGE, "AI_HANDOFF_NOT_ALLOWED");
  const p = policy === undefined ? await getAiPolicy() : policy;
  if (!p?.enabled || !p.external?.handoff) throw new HandoffError(HANDOFF_OFF_MESSAGE, "AI_HANDOFF_OFF");
  if (!ctx.externalAllowed || !(await ctx.externalAllowed())) throw new HandoffError(HANDOFF_NOT_ALLOWED_MESSAGE, "AI_HANDOFF_NOT_ALLOWED");
}

/** Pupil data may leave only with the school's policy and this person's consent. */
export async function assertHandoffPupilData(pupilData: boolean | undefined, consent: boolean | undefined): Promise<void> {
  if (!pupilData) return;
  if (!externalPupilDataAllowed(await getAiPolicy(), consent === true)) {
    throw new HandoffError(HANDOFF_PUPIL_MESSAGE, "AI_HANDOFF_PUPIL_CONSENT");
  }
}

// ─── HTTP ────────────────────────────────────────────────────────────────────

/**
 * Answers a hand-off result or refusal; returns false for anything else. Call first in
 * every AI controller's catch block (sendControllerError already does).
 */
export function sendHandoff(res: Response, err: unknown): boolean {
  if (isHandoffPrompt(err)) {
    res.status(200).json({ success: true, handoff: err.payload });
    return true;
  }
  if (isHandoffError(err)) {
    res.status(err.statusCode).json({ success: false, code: err.code, message: err.message });
    return true;
  }
  return false;
}

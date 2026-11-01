import { createPrivateKey, sign as edSign, type KeyObject } from "node:crypto";

/**
 * The Learning layer of TMCode AI (nga-tmcode reports/TMCode vibe coding proposal 2026.md §8.3):
 * "AI helps you think. You write every line." Task Mentor is the enforcement, not the open-source
 * client: a student working in an item whose ai_mode is "hints" gets
 *
 *   1. read-only tools only (list/read/search/problems), whatever the app sends;
 *   2. the tutor profile: Lead-and-Reveal (ask first, reveal ideas, never code), in their language;
 *   3. the output filter: code (fenced blocks, statement-shaped lines, inline statements, lines that
 *      reuse the student's identifiers or match the reference solution) is cut from the streamed
 *      answer and replaced by a note -- CodeHelp's "rewrite without code" step, done on the text;
 *   4. a question allowance (CS50 hearts: 10, one back every 3 minutes by default);
 *   5. every answer reports how many lines were removed, so the app logs filter hits.
 *
 * The reference solution never reaches the model: it is used only to compare (the Code Council).
 */

// ── the teacher's knobs ──

export interface AiHelpSetting {
  /** "hints": questions and nudges; "tutor": also explanations, error explanations, review comments. */
  strength?: "hints" | "tutor";
  /** Pseudo-code in words. */
  pseudo?: boolean;
  /** A tiny generic syntax example (≤ 2 lines, no project identifiers). */
  syntax?: boolean;
  allowance?: { max?: number; regain_minutes?: number };
}

export interface LearningHelp {
  strength: "hints" | "tutor";
  pseudo: boolean;
  syntax: boolean;
  allowance: { max: number; regain_minutes: number };
  /**
   * The request interpreter for students (prompt interpreter report, Q7): "auto" fades the intent
   * card as their requests improve (full → hint → strip); the teacher may pin a stage or turn it off.
   */
  interpreter: InterpreterStage;
  /** Teachers see the raw text of students' requests in the activity log (QD5; default: metadata only). */
  show_prompts: boolean;
  /** A Prompt Problem (Q11): the student writes a request whose generated code must pass the examples. */
  prompt_problem: PromptProblem | null;
}

export const INTERPRETER_STAGES = ["auto", "full", "hint", "strip", "off"] as const;
export type InterpreterStage = (typeof INTERPRETER_STAGES)[number];

export interface PromptExample {
  input: string;
  output: string;
}

export interface PromptProblem {
  language: "python" | "javascript";
  /** The file the AI's code goes in (solution.py / solution.js). */
  entry: string;
  /** Shown to the student. */
  examples: PromptExample[];
  /** Never leave Task Mentor: the check runs them and reports only how many passed. */
  hidden: PromptExample[];
  instructions: string;
  /** The intent card's quality hints are available while solving (else off: the student is on their own). */
  hints: boolean;
}

/** Proposal D5/D6: pseudo-code on, tiny syntax off, 10 questions regaining 1 every 3 minutes. */
export const LEARNING_DEFAULTS: LearningHelp = { strength: "tutor", pseudo: true, syntax: false, allowance: { max: 10, regain_minutes: 3 }, interpreter: "auto", show_prompts: false, prompt_problem: null };

const examplesOf = (v: unknown, max: number): PromptExample[] =>
  (Array.isArray(v) ? v : [])
    .map((e) => ({ input: String((e as PromptExample)?.input ?? "").slice(0, 400).trim(), output: String((e as PromptExample)?.output ?? "").slice(0, 400).trim() }))
    .filter((e) => e.input)
    .slice(0, max);

/** A teacher's Prompt Problem, made safe (null when it has no example). */
export function normalizePromptProblem(raw: unknown): PromptProblem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const language = r.language === "javascript" ? "javascript" : "python";
  const examples = examplesOf(r.examples, 8);
  if (!examples.length) return null;
  const entry = String(r.entry ?? "").trim();
  return {
    language,
    entry: /^[\w.-]{1,60}$/.test(entry) ? entry : language === "python" ? "solution.py" : "solution.js",
    examples,
    hidden: examplesOf(r.hidden, 20),
    instructions: String(r.instructions ?? "").slice(0, 1000).trim(),
    hints: r.hints !== false,
  };
}

const clampNum = (v: unknown, lo: number, hi: number, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};

export function normalizeHelp(raw: unknown): LearningHelp {
  let r: Record<string, any> = {};
  if (typeof raw === "string") {
    try {
      r = JSON.parse(raw) ?? {};
    } catch {
      r = {};
    }
  } else if (raw && typeof raw === "object") r = raw as Record<string, any>;
  const a = r.allowance && typeof r.allowance === "object" ? r.allowance : {};
  return {
    strength: r.strength === "hints" ? "hints" : "tutor",
    pseudo: r.pseudo !== false,
    syntax: r.syntax === true,
    allowance: { max: Math.round(clampNum(a.max, 1, 100, LEARNING_DEFAULTS.allowance.max)), regain_minutes: clampNum(a.regain_minutes, 0.5, 120, LEARNING_DEFAULTS.allowance.regain_minutes) },
    interpreter: (INTERPRETER_STAGES as readonly string[]).includes(r.interpreter) ? (r.interpreter as InterpreterStage) : "auto",
    show_prompts: r.show_prompts === true,
    prompt_problem: normalizePromptProblem(r.prompt_problem),
  };
}

/** What a student may see of a Prompt Problem: the hidden examples stay on Task Mentor. */
export function publicPromptProblem(p: PromptProblem | null): Omit<PromptProblem, "hidden"> & { hidden_count: number } | null {
  if (!p) return null;
  const { hidden, ...rest } = p;
  return { ...rest, hidden_count: hidden.length };
}

/**
 * A teacher's ai_help from a form (JSON string in multipart, an object in JSON, "" or null to reset):
 * the normalised setting to store, null to use the defaults, or undefined when it wasn't sent.
 */
export function aiHelpInput(v: unknown): LearningHelp | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "" || v === "null") return null;
  return normalizeHelp(v);
}

/** A form's boolean ("true"/"1"/true), or undefined when it wasn't sent. */
export function boolInput(v: unknown): boolean | undefined {
  if (v === undefined || v === "") return undefined;
  return v === true || v === "true" || v === "1" || v === 1;
}

/** The tools the tutor may have (it looks at the student's code; it never changes it). */
export const LEARNING_TOOLS = new Set(["list_files", "read_file", "search", "get_problems", "repo_map", "find_symbol", "explore", "ask_user"]);

// ── the tutor profile ──

export function tutorSystem(help: LearningHelp): string {
  const strength =
    help.strength === "hints"
      ? "Give HINTS only: one guiding question or one small nudge at a time. Do not explain whole concepts unless asked twice."
      : "You may explain concepts, explain error messages the student has already tried to understand, and comment on their code like a reviewer -- always in words.";
  return `You are TMCode AI's tutor inside TMCode, the code editor of New Generation Academy (a school). The student is in the LEARNING layer: "AI helps you think. You write every line."

Absolute rules (a filter removes any code you write, so writing code only wastes the student's question):
- Never write code: no code blocks, no statements, no corrected lines, no tests, no commands, no config. Do not rewrite the student's lines.
- You MAY name keywords, functions and APIs inline in backticks (\`for\`, \`len()\`, \`fetch\`), and give example inputs and outputs ("for [3,1,2] it should return 3").
- ${help.pseudo ? "You MAY describe steps as pseudo-code in plain words (\"loop over the list; keep the largest so far\"), never in a programming language." : "Do NOT give pseudo-code or step lists that solve the task; ask questions that lead the student to the steps."}
- ${help.syntax ? "You MAY show one tiny GENERIC syntax example (at most 2 lines) that uses none of the student's names and does not solve their task." : "Do not show syntax examples; point to the concept or the documentation instead."}

How to help (Lead-and-Reveal):
- First ask what the student thinks should happen next, or what they expect the output to be, unless they already said so.
- Reveal one idea at a time. Prefer a question that makes them notice the problem over telling them.
- For an error: ask what they think it means first; then give a graded hint (the concept, then where to look, then the idea in words).
- ${strength}
- Keep answers short (under 120 words), warm and encouraging. End with one question or one next step for the student to do themselves.
- Reply in the language the student writes in (Kinyarwanda, French or English), keeping English programming keywords and briefly glossing them.
- If the student asks you to write the code or the answer, say kindly that in Learning they write every line, and give the next hint instead.`;
}

// ── the output filter ──

const KEYWORDS = new Set(
  "if else elif for while do return def class function fn func let const var import from export public private protected static void int float double char bool boolean string true false null none nil new this self print println printf console log len range in is not and or try catch except finally throw raise async await yield lambda switch case break continue struct enum interface extends implements package using namespace include main echo select insert update delete where set values table create into join on order by group the a an to of it".split(
    " ",
  ),
);

/** Identifiers worth matching: the student's own names (≥ 3 letters, not keywords). */
export function identifiersOf(text: string | undefined | null): Set<string> {
  const out = new Set<string>();
  if (!text) return out;
  for (const m of text.matchAll(/[A-Za-z_][A-Za-z0-9_]{2,}/g)) {
    const w = m[0];
    if (!KEYWORDS.has(w.toLowerCase())) out.add(w);
    if (out.size > 2000) break;
  }
  return out;
}

const STATEMENT_START = /^(def|class|function|fn|func|public|private|protected|static|import|from\s+\S+\s+import|#include|using|package|let|const|var|return|elif|else\s*:|else\s*\{|try\s*[:{]|except\b|catch\s*\(|switch\s*\(|case\s+.+:|SELECT|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|CREATE\s+TABLE|ALTER\s+TABLE|DROP\s+TABLE)\b/i;
const CONTROL = /^(for|while|if|foreach)\b.*(\)\s*\{?|:)\s*$/;
const ASSIGNMENT = /^[A-Za-z_$][\w$.[\]'"]*\s*(?:[+\-*/%&|^]|\*\*|\/\/|<<|>>)?=(?!=)\s*\S/;
const CALL_STATEMENT = /^[A-Za-z_$][\w$.]*\s*\(.*\)\s*;?\s*$/;
const ENDS_CODE = /(;|\{|\}|\)\s*\{|=>\s*\{?|\]\s*;?)\s*$/;
const HTML_LINE = /^<\/?[a-z][\w-]*(\s[^>]*)?\/?>.*$/i;
const PROSE_WORDS = /\b(the|this|that|your|you|is|are|it|of|to|and|what|why|how|think|should|would|could|try|then|when|which|because)\b/gi;

/** Does one line of an answer read as code rather than prose? (exported for the eval set) */
export function looksLikeCode(raw: string, ids: Set<string> = new Set()): boolean {
  const line = raw.replace(/^\s*(?:[-*+]|\d+[.)]|>)\s+/, "").trim();
  if (!line || line.length < 3) return false;
  // The terminal's JSON answer format ({"commands":[{"command":"…"}]}): a command to run is code.
  if (/"commands?"\s*:/.test(line)) return true;
  const words = (line.match(/[A-Za-z]+/g) ?? []).length;
  const prose = (line.match(PROSE_WORDS) ?? []).length;
  // Mostly English words: prose, even when it mentions `for` or `if`.
  const prosey = words >= 6 && prose / words > 0.25 && !/[;{}]\s*$/.test(line);
  if (prosey) return false;
  if (STATEMENT_START.test(line) && /[(){}:=;,<>[\]"']/.test(line)) return true;
  if (CONTROL.test(line)) return true;
  if (ASSIGNMENT.test(line)) return true;
  if (CALL_STATEMENT.test(line) && !/\s{2,}/.test(line) && words <= 8) return true;
  if (ENDS_CODE.test(line) && /[=(]/.test(line)) return true;
  if (HTML_LINE.test(line) && /<\/?[a-z]/i.test(line)) return true;
  // Reuses the student's names with code punctuation.
  if (ids.size && /[=();{}[\]]/.test(line)) {
    let hits = 0;
    for (const m of line.matchAll(/[A-Za-z_][A-Za-z0-9_]{2,}/g)) if (ids.has(m[0])) hits++;
    if (hits >= 2) return true;
  }
  return false;
}

/** An inline `code span` that is a whole statement rather than a name. */
export function inlineIsStatement(span: string, ids: Set<string> = new Set()): boolean {
  const s = span.trim();
  if (!s) return false;
  if (/^[\w$.]+(\(\))?$/.test(s)) return false; // a name: `len()`, `fetch`, `Array.map`
  if (/^<\/?[a-z][\w-]*>$/i.test(s)) return false; // a tag name: `<div>`
  if (/^[\w.]+\s*\([^()]{0,24}\)$/.test(s) && !/[=;]/.test(s)) return s.length > 28; // a short call example
  if (s.length > 40) return true;
  if (/[;{}]|(?<![=!<>])=(?!=)|=>|\+=|-=/.test(s)) return true;
  if (looksLikeCode(s, ids)) return true;
  return false;
}

/** Normalised lines of the reference solution(s), to catch an answer that copies them. */
export function referenceLines(solutions: string[]): Set<string> {
  const out = new Set<string>();
  for (const sol of solutions)
    for (const l of sol.split("\n")) {
      const n = l.replace(/\s+/g, "").toLowerCase();
      if (n.length >= 8) out.add(n);
    }
  return out;
}

export interface FilterOptions {
  /** The student's identifiers (open file, selection). */
  identifiers?: Set<string>;
  /** Normalised reference-solution lines. */
  reference?: Set<string>;
  /** The teacher allows one tiny generic syntax example (≤ 2 lines, no student names). */
  syntax?: boolean;
}

const NOTE = (n: number) => `_(TMCode removed ${n} line${n === 1 ? "" : "s"} of code here: in Learning you write every line. Ask for the next hint if you're stuck.)_`;

/**
 * Cuts code out of a streamed answer, line by line: `push` returns what may be shown now (whole
 * lines), `end` the rest. `removed` counts the lines cut. Text inside a fence is held until the
 * fence closes, so a removed block never flashes on screen.
 */
export class LearningFilter {
  removed = 0;
  private buf = "";
  private fence: { marker: string; lines: string[] } | null = null;
  private cutRun = 0;
  private readonly ids: Set<string>;
  private readonly ref: Set<string>;

  constructor(private readonly opts: FilterOptions = {}) {
    this.ids = opts.identifiers ?? new Set();
    this.ref = opts.reference ?? new Set();
  }

  push(text: string): string {
    this.buf += text;
    let out = "";
    let nl = this.buf.indexOf("\n");
    while (nl >= 0) {
      out += this.line(this.buf.slice(0, nl), true);
      this.buf = this.buf.slice(nl + 1);
      nl = this.buf.indexOf("\n");
    }
    return out;
  }

  end(): string {
    let out = "";
    if (this.buf) out += this.line(this.buf, false);
    this.buf = "";
    if (this.fence) {
      // An unterminated block: never shown.
      this.removed += this.fence.lines.length;
      this.cutRun += this.fence.lines.length;
      this.fence = null;
    }
    out += this.flushCut();
    return out;
  }

  /** The note for a run of cut lines, once the run ends. */
  private flushCut(): string {
    if (!this.cutRun) return "";
    const n = this.cutRun;
    this.cutRun = 0;
    return `${NOTE(n)}\n`;
  }

  private matchesReference(line: string): boolean {
    if (!this.ref.size) return false;
    const n = line.replace(/\s+/g, "").toLowerCase();
    return n.length >= 8 && this.ref.has(n);
  }

  private keepFence(lines: string[]): boolean {
    if (!this.opts.syntax || lines.length > 2 || !lines.length) return false;
    for (const l of lines) {
      if (this.matchesReference(l)) return false;
      for (const m of l.matchAll(/[A-Za-z_][A-Za-z0-9_]{2,}/g)) if (this.ids.has(m[0])) return false;
    }
    return true;
  }

  private line(raw: string, complete: boolean): string {
    const eol = complete ? "\n" : "";
    const fenceMark = raw.match(/^\s*(`{3,}|~{3,})/);
    if (this.fence) {
      if (fenceMark && fenceMark[1][0] === this.fence.marker[0] && fenceMark[1].length >= this.fence.marker.length && !raw.trim().slice(fenceMark[1].length).trim()) {
        const lines = this.fence.lines;
        const marker = this.fence.marker;
        this.fence = null;
        if (this.keepFence(lines)) return `${this.flushCut()}${marker}\n${lines.join("\n")}\n${marker}${eol}`;
        this.removed += lines.length;
        this.cutRun += Math.max(1, lines.length);
        return "";
      }
      this.fence.lines.push(raw);
      return "";
    }
    if (fenceMark) {
      this.fence = { marker: fenceMark[1], lines: [] };
      return "";
    }
    if (raw.trim() && (looksLikeCode(raw, this.ids) || this.matchesReference(raw))) {
      this.removed++;
      this.cutRun++;
      return "";
    }
    if (!raw.trim() && this.cutRun) return ""; // blank lines inside a run of cut code
    const kept = raw.replace(/(`+)([^`]+?)\1/g, (all, _t: string, inner: string) => {
      if (inlineIsStatement(inner, this.ids) || this.matchesReference(inner)) {
        this.removed++;
        return "`…`";
      }
      return all;
    });
    return `${this.flushCut()}${kept}${eol}`;
  }
}

/** The whole answer at once (tests, the eval runner, non-streamed paths). */
export function filterLearningText(text: string, opts: FilterOptions = {}): { text: string; removed: number } {
  const f = new LearningFilter(opts);
  const out = f.push(text) + f.end();
  return { text: out.replace(/\n{3,}/g, "\n\n").trimEnd(), removed: f.removed };
}

// ── the question allowance (CS50 hearts) ──

const hearts = new Map<string, { tokens: number; at: number }>();

function refill(key: string, max: number, regainMs: number, now: number) {
  const h = hearts.get(key) ?? { tokens: max, at: now };
  if (h.tokens >= max) return { tokens: max, at: now };
  const back = Math.floor((now - h.at) / regainMs);
  if (back <= 0) return h;
  const tokens = Math.min(max, h.tokens + back);
  return { tokens, at: tokens >= max ? now : h.at + back * regainMs };
}

export interface Allowance {
  max: number;
  regain_minutes: number;
  left: number;
  /** Seconds until the next question comes back (null when full). */
  next_in_s: number | null;
}

export function allowanceOf(userId: number, scope: string, help: LearningHelp, now = Date.now()): Allowance {
  const regainMs = help.allowance.regain_minutes * 60_000;
  const h = refill(`${userId}:${scope}`, help.allowance.max, regainMs, now);
  hearts.set(`${userId}:${scope}`, h);
  return { max: help.allowance.max, regain_minutes: help.allowance.regain_minutes, left: h.tokens, next_in_s: h.tokens >= help.allowance.max ? null : Math.max(1, Math.ceil((h.at + regainMs - now) / 1000)) };
}

/** Takes one question; false (and how long to wait) when none is left. */
export function takeQuestion(userId: number, scope: string, help: LearningHelp, now = Date.now()): { ok: boolean; allowance: Allowance } {
  const a = allowanceOf(userId, scope, help, now);
  if (a.left <= 0) return { ok: false, allowance: a };
  const key = `${userId}:${scope}`;
  const h = hearts.get(key)!;
  hearts.set(key, { tokens: h.tokens - 1, at: h.tokens >= help.allowance.max ? now : h.at });
  return { ok: true, allowance: allowanceOf(userId, scope, help, now) };
}

/** Tests only. */
export function resetAllowances() {
  hearts.clear();
}

// ── the sticky signed layer (A9) ──

let cachedKey: { kid: string; key: KeyObject } | null | undefined;

/**
 * TMCODE_LAYER_SIGNING_KEY: an Ed25519 private key, PEM or base64 of the PKCS#8 DER. Without it no
 * token is issued (TMCode then can't keep the layer while signed out; everything else works).
 */
function signingKey(): { kid: string; key: KeyObject } | null {
  if (cachedKey !== undefined) return cachedKey;
  const raw = (process.env.TMCODE_LAYER_SIGNING_KEY ?? "").trim();
  if (!raw) return (cachedKey = null);
  try {
    const key = raw.includes("BEGIN") ? createPrivateKey(raw.replace(/\\n/g, "\n")) : createPrivateKey({ key: Buffer.from(raw, "base64"), format: "der", type: "pkcs8" });
    if (key.asymmetricKeyType !== "ed25519") throw new Error("not an Ed25519 key");
    cachedKey = { kid: (process.env.TMCODE_LAYER_SIGNING_KID ?? "k1").slice(0, 40), key };
  } catch (e) {
    console.error("[tmcode-ai] TMCODE_LAYER_SIGNING_KEY is unusable:", (e as Error).message);
    cachedKey = null;
  }
  return cachedKey;
}

/** Tests only: forget the cached key (after changing the env). */
export function resetSigningKey() {
  cachedKey = undefined;
}

const b64url = (b: Buffer) => b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const GRACE_MS = 14 * 24 * 3600_000;
const NO_DUE_MS = 30 * 24 * 3600_000;

/** A signed { project, ai_mode, own_tools } valid until the due date + 14 days (else 30 days). */
export function signLayer(projectId: number, aiMode: "off" | "hints" | "full", ownTools: boolean, due: Date | null | undefined, now = new Date()): { claims: string; sig: string } | null {
  const k = signingKey();
  if (!k) return null;
  const until = due && !Number.isNaN(+due) && +due > +now ? +due + GRACE_MS : +now + NO_DUE_MS;
  const claims = b64url(Buffer.from(JSON.stringify({ v: 1, project_id: projectId, ai_mode: aiMode, own_tools: ownTools, iat: now.toISOString(), exp: new Date(until).toISOString(), kid: k.kid })));
  const sig = b64url(edSign(null, Buffer.from(claims, "ascii"), k.key));
  return { claims, sig };
}

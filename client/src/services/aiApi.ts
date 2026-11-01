import axios, { isAxiosError } from "../utils/axiosConfig";

/**
 * AI usage control (AI_USAGE_CONTROL_PLAN.md §5.7): what AI the signed-in user
 * may use. The school's AI policy (NGA MIS) comes first; inside a quiz,
 * assignment or project, the teacher's AI setting decides for a student;
 * otherwise the role permission AI_USE.
 */

export type AiMode = "off" | "hints" | "full";

/**
 * The three AI layers (nga-tmcode reports/TMCode vibe coding proposal 2026.md §8.1): the wire
 * value stays off | hints | full; teachers see the layer names.
 */
export const AI_MODE_OPTIONS: { value: AiMode; label: string; short: string; help: string }[] = [
  { value: "off", label: "No AI", short: "No AI", help: "No AI. Students code on their own." },
  { value: "hints", label: "Learning", short: "Learning", help: "AI helps students think; they write every line. The tutor answers in words and never with code (Task Mentor removes any code)." },
  { value: "full", label: "Industrial", short: "Industrial", help: "Full AI writes code with students, through the school's AI, with scaffolds and everything logged." },
];

/** The Learning layer's knobs (stored as ai_help; null: the school's defaults). */
export interface AiHelp {
  strength: "hints" | "tutor";
  pseudo: boolean;
  syntax: boolean;
  allowance: { max: number; regain_minutes: number };
  /** TMCode's request check for students (intent card / Learning's prompt coach): "auto" fades as their requests improve. */
  interpreter: InterpreterStage;
  /** The teacher sees the text of students' requests in the activity log (else only what was checked). */
  show_prompts: boolean;
  /** A Prompt Problem: the student's request must make the AI write code that passes these examples. */
  prompt_problem: PromptProblem | null;
}

export type InterpreterStage = "auto" | "full" | "hint" | "strip" | "off";
export const INTERPRETER_STAGE_OPTIONS: { value: InterpreterStage; label: string; help: string }[] = [
  { value: "auto", label: "Auto (fades)", help: "The full card while students learn, then hints, then a one-line summary as their requests get complete" },
  { value: "full", label: "Always the full card", help: "Every new request gets the card; students fill in one field themselves" },
  { value: "hint", label: "Hints only", help: "TMCode flags what is missing; students fill it in" },
  { value: "strip", label: "One-line summary", help: "Only 'Understood as …', to confirm" },
  { value: "off", label: "Off", help: "Requests go to the AI as typed" },
];

export interface PromptExample {
  input: string;
  output: string;
}

export interface PromptProblem {
  language: "python" | "javascript";
  entry: string;
  examples: PromptExample[];
  hidden: PromptExample[];
  instructions: string;
  hints: boolean;
}

export const AI_HELP_DEFAULTS: AiHelp = { strength: "tutor", pseudo: true, syntax: false, allowance: { max: 10, regain_minutes: 3 }, interpreter: "auto", show_prompts: false, prompt_problem: null };

const STAGES: InterpreterStage[] = ["auto", "full", "hint", "strip", "off"];
const examples = (v: unknown): PromptExample[] => (Array.isArray(v) ? v : []).map((e: any) => ({ input: String(e?.input ?? ""), output: String(e?.output ?? "") }));

/** A stored Prompt Problem, or null. */
export function promptProblemOf(v: unknown): PromptProblem | null {
  if (!v || typeof v !== "object") return null;
  const r = v as Record<string, unknown>;
  const language = r.language === "javascript" ? "javascript" : "python";
  return { language, entry: String(r.entry ?? (language === "python" ? "solution.py" : "solution.js")), examples: examples(r.examples), hidden: examples(r.hidden), instructions: String(r.instructions ?? ""), hints: r.hints !== false };
}

/** A stored ai_help (object, JSON text or null) with every field filled. */
export function aiHelpOf(v: unknown): AiHelp {
  let r: any = v;
  if (typeof v === "string") {
    try {
      r = JSON.parse(v);
    } catch {
      r = null;
    }
  }
  if (!r || typeof r !== "object") return { ...AI_HELP_DEFAULTS, allowance: { ...AI_HELP_DEFAULTS.allowance } };
  return {
    strength: r.strength === "hints" ? "hints" : "tutor",
    pseudo: r.pseudo !== false,
    syntax: r.syntax === true,
    allowance: { max: Number(r.allowance?.max) || AI_HELP_DEFAULTS.allowance.max, regain_minutes: Number(r.allowance?.regain_minutes) || AI_HELP_DEFAULTS.allowance.regain_minutes },
    interpreter: STAGES.includes(r.interpreter) ? r.interpreter : "auto",
    show_prompts: r.show_prompts === true,
    prompt_problem: promptProblemOf(r.prompt_problem),
  };
}

export type AiReason =
  | "GLOBAL_OFF"
  | "APP_OFF"
  | "FEATURE_OFF"
  | "ASSESSMENT_LOCKED"
  | "TEACHER_OFF"
  | "EXAM_ACTIVE"
  | "HINTS_ONLY"
  | "ROLE_OFF"
  | "ALLOWED_BY_TEACHER"
  | "ALLOWED_BY_ROLE"
  | "ALLOWED_BY_POLICY";

export interface AiAccess {
  allowed: boolean;
  reason: AiReason;
  message: string;
  mode: AiMode | null;
  features: { assist: boolean; complete: boolean; hint: boolean };
}

export interface AiPolicySummary {
  available: boolean;
  enabled: boolean;
  apps: { tm: boolean; tmcode: boolean };
  assessments: "teacher" | "always_off";
  grading: boolean;
  /** Teachers' Off / Hints / Full choices are in force. */
  itemModes: boolean;
  hasAiUse: boolean;
  author: { allowed: boolean; reason: AiReason; message: string };
  v: number | null;
}

export type AiAccessContext = { quiz?: number | null; assignment?: number | null; project?: number | null };

export async function fetchAiAccess(ctx: AiAccessContext = {}): Promise<AiAccess> {
  const params: Record<string, number> = {};
  if (ctx.quiz) params.quiz = ctx.quiz;
  else if (ctx.assignment) params.assignment = ctx.assignment;
  else if (ctx.project) params.project = ctx.project;
  const res = await axios.get("/ai/access", { params });
  return res.data.data as AiAccess;
}

export async function fetchAiPolicy(): Promise<AiPolicySummary> {
  const res = await axios.get("/ai/policy");
  return res.data.data as AiPolicySummary;
}

/** A 403 AI_DISABLED answer from any TM AI route: its user-facing message, else null. */
export function aiDisabledMessage(err: unknown): string | null {
  if (!isAxiosError(err)) return null;
  const d = err.response?.data as { code?: string; message?: string; error?: { code?: string; message?: string } } | undefined;
  if (err.response?.status !== 403) return null;
  if (d?.code === "AI_DISABLED") return d.message || "AI is turned off.";
  if (d?.error?.code === "AI_DISABLED") return d.error.message || "AI is turned off.";
  return null;
}

/** A short label for a refusal, for chips next to a hidden AI button. */
export function aiReasonShort(reason: AiReason | null | undefined, item: "quiz" | "assignment" | "activity" = "activity"): string {
  switch (reason) {
    case "GLOBAL_OFF":
      return "AI is off for the school";
    case "APP_OFF":
      return "AI is off in Task Mentor";
    case "FEATURE_OFF":
      return "This AI feature is off";
    case "ASSESSMENT_LOCKED":
      return "AI is off for quizzes and assignments";
    case "TEACHER_OFF":
      return `AI is off for this ${item}`;
    case "EXAM_ACTIVE":
      return "AI is off during the exam";
    case "HINTS_ONLY":
      return "Hints only";
    case "ROLE_OFF":
      return "AI isn't available to you";
    default:
      return "AI isn't available here";
  }
}

import axios, { isAxiosError } from "../utils/axiosConfig";

/**
 * AI usage control (AI_USAGE_CONTROL_PLAN.md §5.7): what AI the signed-in user
 * may use. The school's AI policy (NGA MIS) comes first; inside a quiz,
 * assignment or project, the teacher's AI setting decides for a student;
 * otherwise the role permission AI_USE.
 */

export type AiMode = "off" | "hints" | "full";

export const AI_MODE_OPTIONS: { value: AiMode; label: string; short: string; help: string }[] = [
  { value: "off", label: "Off", short: "Off", help: "Students can't use AI while working on it." },
  { value: "hints", label: "Hints only", short: "Hints", help: "Students can ask for hints that guide them without giving the answer." },
  { value: "full", label: "Full assistant", short: "Full", help: "Students can use the AI assistant (chat and code suggestions)." },
];

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

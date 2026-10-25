import { z } from "zod";
import { htmlToText } from "../../services/ai/misCourseResources";

/**
 * AI-assisted grading in TMCode (GRADING_PREMIUM_CONTRACTS.md, "Task Mentor — AI grading"):
 * the teacher's system prompt for the grading chat, and the structured draft of
 * POST /api/tmcode/grading/:type/:id/students/:sid/ai-draft. The AI only drafts: nothing here
 * saves a grade.
 */

export interface GradingCriterion {
  index: number;
  criteria: string;
  description?: string | null;
  max_score: number;
}

export interface GradingInfo {
  activity_title: string;
  brief: string;
  rubric: GradingCriterion[];
  student_name: string;
  question_text?: string;
  max_points?: number;
}

/** Looks like rich HTML (the brief's description is), not Markdown that merely contains "<". */
const looksHtml = (s: string) => /<\/?(p|div|br|h[1-6]|ul|ol|li|span|strong|em|pre|code|table|img|a)\b[^>]*>/i.test(s);
export const briefText = (s: string | null | undefined) => {
  const t = String(s ?? "");
  return (looksHtml(t) ? htmlToText(t) : t).trim();
};

export const GRADING_SYSTEM = `You are TMCode AI, helping a TEACHER at New Generation Academy (a school) grade a student's coding work in TMCode's grading workspace. You are talking to the teacher, not to the student.
- Assess the work against the rubric: for each criterion, a score from 0 to its maximum (half points allowed) and why.
- Cite the evidence with file paths and line numbers (for example src/app.js:12-20). Look at the files before you judge; never invent code that isn't there.
- Point out what the teacher should check: failing tests, missing parts, code that doesn't answer the brief, signs of copied work.
- You only draft. Never say you saved, submitted or released a grade: the teacher reviews the draft and clicks Save.
- When the teacher asks you to grade (or to fill in the grade), call the propose_grade tool with rubric_scores (one per criterion: index, score, comment), score (only when there is no rubric), feedback (to the student: kind, specific, "you"), teacher_notes (for the teacher only) and confidence ("low", "medium" or "high").
Use Markdown.`;

export const GRADING_AGENT_RULES = `You work in the review folder of a student's submission.
- Read, search and run to understand the work; never edit, delete or create the student's files, and never submit anything.
- When you have assessed the work, call propose_grade, then reply with a short summary for the teacher.`;

export function rubricTable(rubric: GradingCriterion[]): string {
  if (!rubric.length) return "(no rubric: one overall score)";
  return rubric
    .map((c) => `${c.index}. ${c.criteria} (max ${c.max_score})${c.description ? `: ${String(c.description).replace(/\s+/g, " ").trim()}` : ""}`)
    .join("\n");
}

/** The grading context for the chat's system prompt. */
export function gradingContextText(g: GradingInfo): string {
  const parts = [
    `ACTIVITY: ${g.activity_title || "(untitled)"}`,
    g.student_name ? `STUDENT: ${g.student_name}` : "",
    g.question_text ? `QUESTION:\n${briefText(g.question_text)}` : "",
    g.brief ? `BRIEF (what the student was asked to do):\n${briefText(g.brief)}` : "",
    `RUBRIC (index. criterion (max)):\n${rubricTable(g.rubric)}`,
  ];
  return parts.filter(Boolean).join("\n\n");
}

// ── the draft ──

export interface TestsSummary {
  passed: number;
  failed: number;
  total: number;
  summary?: string;
}

export interface DraftPromptInput {
  info: GradingInfo;
  instructions?: string;
  tests?: TestsSummary | null;
  files: { path: string; text: string }[];
  filesNote?: string;
}

export function buildDraftMessages(p: DraftPromptInput): { role: "system" | "user"; content: string }[] {
  const max = p.info.max_points ?? p.info.rubric.reduce((n, c) => n + c.max_score, 0);
  const shape = `{
  "rubric_scores": [{ "index": 0, "score": 0, "comment": "why, citing file:line" }],
  "score": null,
  "feedback": "to the student",
  "teacher_notes": "for the teacher only",
  "confidence": "low" | "medium" | "high",
  "off_topic": false
}`;
  const system = `You are an experienced programming teacher at New Generation Academy (a secondary school in Rwanda) drafting a grade for a colleague. The teacher checks and edits your draft before anything is saved or shown to the student.

RULES:
- Mark only what is in the files. Apply the rubric fairly; don't reward length.
- rubric_scores: exactly one entry per rubric criterion (its index), score 0 to that criterion's max in half points, and a comment for the teacher that cites file paths and line numbers.
- score: only when there is no rubric (0 to ${max}); otherwise null.
- feedback: to the student ("you"), kind and specific, 3-6 sentences, what went well and clear next steps. No mark numbers.
- teacher_notes: what the teacher should check (failing tests, missing parts, possible copying, files you couldn't read).
- confidence: "low" when the work is short, unclear, untested or the rubric is hard to apply.
- If the work doesn't answer the brief, set off_topic to true and mark low.
- Write in the language of the brief.
Reply with ONE JSON object only, no prose and no code fences, in this shape:
${shape}`;
  const tests = p.tests
    ? `TESTS: ${p.tests.passed} passed, ${p.tests.failed} failed, ${p.tests.total} in all.${p.tests.summary ? `\n${p.tests.summary}` : ""}`
    : "TESTS: not run (judge the code by reading it).";
  const files = p.files.length ? p.files.map((f) => `FILE ${f.path}:\n\`\`\`\n${numbered(f.text)}\n\`\`\``).join("\n\n") : "(no readable files)";
  const user = [
    gradingContextText(p.info),
    `TOTAL MARKS: ${max}`,
    p.instructions ? `THE TEACHER ASKS YOU TO FOCUS ON:\n${p.instructions}` : "",
    tests,
    `THE STUDENT'S FILES${p.filesNote ? ` (${p.filesNote})` : ""}:\n${files}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

/** Line numbers, so the AI can cite them. */
function numbered(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const w = String(lines.length).length;
  return lines.map((l, i) => `${String(i + 1).padStart(w, " ")}| ${l}`).join("\n");
}

/** The first JSON object in a model's answer (fences, prose around it, trailing commas). Pure. */
export function extractJson(text: string): unknown {
  const t = String(text ?? "").trim();
  const candidates: string[] = [];
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(t);
  if (fence) candidates.push(fence[1].trim());
  candidates.push(t);
  for (const c of candidates) {
    try {
      return JSON.parse(c);
    } catch {
      /* next */
    }
    // Balanced braces from each "{", strings respected.
    for (let start = c.indexOf("{"); start >= 0; start = c.indexOf("{", start + 1)) {
      const end = matchingBrace(c, start);
      if (end < 0) continue;
      const slice = c.slice(start, end + 1);
      for (const s of [slice, slice.replace(/,\s*([}\]])/g, "$1")]) {
        try {
          return JSON.parse(s);
        } catch {
          /* next */
        }
      }
    }
  }
  return null;
}

function matchingBrace(s: string, start: number): number {
  let depth = 0;
  let inStr = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (ch === "\\") i++;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return i;
  }
  return -1;
}

/** Half marks between 0 and max (as services/ai/feedbackDrafter.ts snaps them). Pure. */
export function snap(score: unknown, max: number): number {
  const n = Number(score);
  if (!Number.isFinite(n) || !(max > 0)) return 0;
  return Math.min(max, Math.max(0, Math.round(n * 2) / 2));
}

const num = z.preprocess((v) => (typeof v === "string" && v.trim() !== "" ? Number(v) : v), z.number().finite());
const RawDraft = z
  .object({
    rubric_scores: z.array(z.object({ index: num.optional(), score: num.optional().catch(undefined), comment: z.any().optional() }).passthrough()).optional().catch([]),
    criteria: z.array(z.any()).optional().catch(undefined),
    score: num.nullable().optional().catch(null),
    overall_score: num.nullable().optional().catch(null),
    feedback: z.any().optional(),
    teacher_notes: z.any().optional(),
    confidence: z.any().optional(),
    off_topic: z.any().optional(),
  })
  .passthrough();

export interface GradeDraft {
  rubric_scores: { index: number; score: number; comment: string }[];
  score: number | null;
  feedback: string;
  teacher_notes: string;
  confidence: "low" | "medium" | "high";
  warnings: string[];
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v : Array.isArray(v) ? v.map(String).join("\n") : v == null ? "" : String(v)).trim().slice(0, max);

/**
 * The model's JSON as a draft the grading form takes: one score per criterion (by index, else by
 * position), clamped to 0..max in half points; an overall score only without a rubric. Null when
 * there is nothing usable. Pure.
 */
export function normalizeDraft(raw: unknown, rubric: GradingCriterion[], maxPoints: number): GradeDraft | null {
  const parsed = RawDraft.safeParse(raw);
  if (!parsed.success) return null;
  const d = parsed.data;
  const list = (d.rubric_scores?.length ? d.rubric_scores : (d.criteria as any[] | undefined)) ?? [];
  const byIndex = new Map<number, { score?: unknown; comment?: unknown }>();
  list.forEach((c: any, pos: number) => {
    const i = Number.isInteger(Number(c?.index)) ? Number(c.index) : pos;
    if (!byIndex.has(i)) byIndex.set(i, c ?? {});
  });
  const warnings: string[] = [];
  let missing = 0;
  const rubric_scores = rubric.map((c) => {
    const r = byIndex.get(c.index);
    if (!r || r.score == null || !Number.isFinite(Number(r.score))) missing++;
    return { index: c.index, score: snap(r?.score, Number(c.max_score) || 0), comment: str(r?.comment, 1000) };
  });
  if (missing) warnings.push(`The AI gave no score for ${missing} criterion${missing === 1 ? "" : "s"}: those are 0 in the draft.`);
  const overall = d.score ?? d.overall_score ?? null;
  const score = rubric.length ? null : overall == null ? null : snap(overall, maxPoints);
  const feedback = str(d.feedback, 4000);
  const teacher_notes = str(d.teacher_notes, 4000);
  if (!feedback && !teacher_notes && rubric_scores.every((s) => !s.comment) && score == null) return null;
  const c = String(d.confidence ?? "").toLowerCase();
  const confidence = c === "low" || c === "medium" || c === "high" ? c : "medium";
  if (d.off_topic === true || d.off_topic === "true") warnings.push("The AI thinks this work may not answer the brief.");
  return { rubric_scores, score, feedback, teacher_notes, confidence, warnings };
}

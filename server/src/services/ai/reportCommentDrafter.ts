import { generateStructuredContent, JSONSchema } from "../aiProviders";
import { preferredOrder } from "../aiProviders/registry";

/**
 * AI draft of a class teacher's report-card comment for one student, from the
 * term's subject results, the general attributes the teacher rated and
 * attendance. The AI never sees the student's name: it writes [NAME], which
 * the teacher's screen fills in. Nothing is saved; the teacher edits the text
 * in the comment box and saves the card as usual.
 */

export const NAME_TOKEN = "[NAME]";
export const COMMENT_TONES = ["encouraging", "balanced", "concise"] as const;
export type CommentTone = (typeof COMMENT_TONES)[number];

export interface CommentInput {
  term: string;
  academicYear: string;
  /** Subject totals out of 100 (report-card scale); missing = no marks yet. */
  subjects: Array<{ name: string; score: number | null }>;
  attributes: Array<{ attribute_name: string; rating: string }>;
  attendance?: "present" | "absent" | "late" | null;
  tone?: CommentTone;
  /** The teacher's current text, to improve rather than replace. */
  current?: string | null;
  provider?: string | null;
}

export interface CommentDraft {
  comment: string;
  provider_used: string;
}

const schema: JSONSchema = {
  type: "object",
  properties: {
    comment: { type: "string", description: `The comment, 2-4 sentences, using ${NAME_TOKEN} for the student's name` },
  },
  required: ["comment"],
};

const TONE_LINE: Record<CommentTone, string> = {
  encouraging: "warm and encouraging, celebrating effort and progress, then one clear target",
  balanced: "balanced: strengths first, then the most important area to improve",
  concise: "short and precise: two sentences",
};

/** Bands that match how teachers talk about report-card totals. Pure. */
export function band(score: number): string {
  if (score >= 80) return "excellent";
  if (score >= 70) return "very good";
  if (score >= 60) return "good";
  if (score >= 50) return "fair";
  return "needs support";
}

export function buildCommentPrompt(p: CommentInput & { tone: CommentTone }): string {
  const marked = p.subjects.filter((s) => typeof s.score === "number" && Number.isFinite(s.score));
  const results = marked.length
    ? marked
        .slice()
        .sort((a, b) => (b.score as number) - (a.score as number))
        .map((s) => `- ${s.name}: ${Math.round(s.score as number)}/100 (${band(s.score as number)})`)
        .join("\n")
    : "(no marks recorded yet: don't mention results or subjects)";
  const avg = marked.length ? Math.round(marked.reduce((a, s) => a + (s.score as number), 0) / marked.length) : null;
  const attrs = p.attributes.length ? p.attributes.map((a) => `- ${a.attribute_name}: ${a.rating}`).join("\n") : "(not rated)";
  return `You are the class teacher at a secondary school in Rwanda (Competence-Based Curriculum) writing the end-of-term report-card comment for one student.

TERM: ${p.term} ${p.academicYear}
SUBJECT RESULTS:
${results}${avg !== null ? `\nAVERAGE: ${avg}/100` : ""}
GENERAL ATTRIBUTES (rated by the teacher; scale Excellent > Very good > Good):
${attrs}
ATTENDANCE: ${p.attendance ?? "not recorded"}
${p.current?.trim() ? `\nTHE TEACHER'S DRAFT (improve it, keep its points):\n"""${p.current.trim().slice(0, 1000)}"""\n` : ""}
WRITE the comment:
- Tone: ${TONE_LINE[p.tone]}.
- 2-4 sentences, about the student as a learner: name 1-2 real strengths and the one most useful next step, based ONLY on the information above. Never invent events, behaviour or facts.
- Refer to the student as ${NAME_TOKEN} (once, at the start), then "he/she" is NOT allowed: use ${NAME_TOKEN} again or rephrase without pronouns.
- Do not list marks or the average. No generic filler like "keep it up" on its own.
- Formal, kind British English suitable for parents.

Return JSON only.`;
}

/** Tidy the model's text and make sure the name token is used. Pure. */
export function cleanComment(text: string): string {
  let t = String(text || "").replace(/\s+/g, " ").trim();
  // Models sometimes write a bracketed variant.
  t = t.replace(/\[(student(?:'s)? name|name|student)\]|\{name\}|<name>/gi, NAME_TOKEN);
  return t.slice(0, 900);
}

export async function draftComment(input: CommentInput): Promise<CommentDraft> {
  const tone: CommentTone = COMMENT_TONES.includes(input.tone as CommentTone) ? (input.tone as CommentTone) : "balanced";
  const hasSomething = input.subjects.some((s) => typeof s.score === "number") || input.attributes.length > 0 || !!input.current?.trim();
  if (!hasSomething) {
    throw Object.assign(new Error("Rate the general attributes first (or wait for subject marks): the AI needs something to go on."), { statusCode: 400 });
  }
  let data: { comment?: string };
  let providerUsed: string;
  try {
    ({ data, providerUsed } = await generateStructuredContent<{ comment?: string }>(
      { schemaName: "report_comment", schema, prompt: buildCommentPrompt({ ...input, tone }), maxOutputTokens: 600 },
      { providerOrder: preferredOrder(input.provider) },
    ));
  } catch (err: any) {
    throw Object.assign(new Error(err?.message || "The AI service is unavailable."), { statusCode: 503 });
  }
  const comment = cleanComment(data?.comment || "");
  if (comment.length < 20) {
    throw Object.assign(new Error("The AI didn't return a usable comment. Try again."), { statusCode: 502 });
  }
  return { comment, provider_used: providerUsed };
}

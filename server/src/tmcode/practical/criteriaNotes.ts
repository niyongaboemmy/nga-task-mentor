/**
 * Per-criterion notes on a practical grade.
 *
 * Assignment grades keep `submissions.rubric_scores` as the index→score map
 * the web marking modal and the AI marking draft share, and the teacher's note
 * on each criterion travels inside the feedback the student reads, as a
 * "Criteria notes" block. That block is the stored copy of the notes: the
 * grading roster parses it back into `{ index, score, comment }` so a re-save
 * keeps them (before, it came back without comments and Save wiped them).
 * Quiz practicals store `{ index, score, comment }` in grading_details.manual.
 */

export interface RubricScore {
  index: number;
  score: number;
  comment?: string | null;
}

interface NamedCriterion {
  criteria: string;
}

const HEADING = "Criteria notes:";
/** Same split the web and TMCode editors use to show the overall feedback alone. */
const BLOCK = /\n*Criteria notes:\n/;

const nameOf = (rubric: NamedCriterion[], index: number) => rubric[index]?.criteria ?? `Criterion ${index + 1}`;

/** The feedback the student reads: the overall text, then one line per criterion note. */
export function composeFeedback(feedback: string, rubric: NamedCriterion[], scores: RubricScore[]): string {
  const notes = scores
    .map((s) => (s.comment?.trim() ? `• ${nameOf(rubric, s.index)}: ${s.comment.trim()}` : null))
    .filter(Boolean);
  return [overallFeedback(feedback).trim(), notes.length ? `${HEADING}\n${notes.join("\n")}` : ""]
    .filter(Boolean)
    .join("\n\n");
}

/** The feedback without the "Criteria notes" block. */
export function overallFeedback(feedback: string | null | undefined): string {
  return String(feedback ?? "").split(BLOCK)[0] ?? "";
}

/**
 * The notes in a composed feedback, by criterion index. A note line is
 * "• <criterion name>: <note>"; lines that don't start a known criterion
 * continue the previous note (a note can span lines).
 */
export function parseCriteriaNotes(feedback: string | null | undefined, rubric: NamedCriterion[]): Map<number, string> {
  const out = new Map<number, string>();
  const text = String(feedback ?? "");
  const m = BLOCK.exec(text);
  if (!m) return out;
  const block = text.slice(m.index + m[0].length);
  // Longest names first, so "Layout" doesn't claim "Layout and spacing: …".
  const names = rubric
    .map((c, index) => ({ index, prefix: `• ${nameOf(rubric, index)}: ` }))
    .sort((a, b) => b.prefix.length - a.prefix.length);
  let current: number | null = null;
  for (const line of block.split("\n")) {
    let hit = names.find((n) => line.startsWith(n.prefix));
    if (!hit) {
      // A criterion missing from the rubric now ("Criterion 3").
      const fallback = /^• Criterion (\d+): /.exec(line);
      if (fallback) hit = { index: Number(fallback[1]) - 1, prefix: fallback[0] };
    }
    if (hit && !out.has(hit.index)) {
      current = hit.index;
      out.set(current, line.slice(hit.prefix.length));
    } else if (current != null) {
      out.set(current, `${out.get(current)}\n${line}`);
    }
  }
  for (const [k, v] of out) out.set(k, v.trim());
  return out;
}

/**
 * `{ index, score, comment }` for every criterion with a score, from the
 * stored index→score map (or list) and the notes in the feedback. Comments
 * already present (quiz practicals) win over the parsed ones.
 */
export function rubricScoresWithComments(
  raw: unknown,
  feedback: string | null | undefined,
  rubric: NamedCriterion[],
): RubricScore[] | null {
  let value: unknown = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      value = null;
    }
  }
  let scores: RubricScore[];
  if (Array.isArray(value)) {
    scores = value
      .filter((s: any) => s && Number.isFinite(Number(s.index)))
      .map((s: any) => ({ index: Number(s.index), score: Number(s.score), comment: s.comment ?? null }));
  } else if (value && typeof value === "object") {
    scores = Object.entries(value as Record<string, unknown>)
      .filter(([k, v]) => /^\d+$/.test(k) && v != null && Number.isFinite(Number(v)))
      .map(([k, v]) => ({ index: Number(k), score: Number(v), comment: null }));
  } else {
    return null;
  }
  const notes = parseCriteriaNotes(feedback, rubric);
  return scores
    .sort((a, b) => a.index - b.index)
    .map((s) => ({ ...s, comment: s.comment?.trim() ? s.comment : notes.get(s.index) ?? null }));
}

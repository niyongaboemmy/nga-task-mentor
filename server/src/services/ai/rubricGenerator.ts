import { generateStructuredContent, JSONSchema } from "../aiProviders";
import { preferredOrder } from "../aiProviders/registry";
import { htmlToText } from "./misCourseResources";

/**
 * AI rubric builder for the assignment form. The teacher gives the maximum
 * mark; the AI reads the description and either picks up a rubric the teacher
 * already wrote there (criteria, often with their own marks) or proposes one
 * that fits the task. The marks the AI returns are only treated as relative
 * weights: distributeMarks() always makes the final split add up to exactly
 * the teacher's maximum, so a model that can't do arithmetic can't break it.
 */

export const RUBRIC_MIN_CRITERIA = 2;
export const RUBRIC_MAX_CRITERIA = 10;
/** Characters of description text sent to the model. */
const DESCRIPTION_BUDGET = 8000;

export interface GeneratedRubricCriterion {
  criteria: string;
  description: string;
  max_score: number;
}

export interface GeneratedRubric {
  criteria: GeneratedRubricCriterion[];
  /** "description" when the rubric was read out of the description itself. */
  source: "description" | "generated";
  total: number;
  note: string;
  provider_used: string;
}

export interface GenerateRubricParams {
  title?: string;
  description: string;
  maxScore: number;
  /** null/undefined = let the AI decide (or keep the count found in the description). */
  criteriaCount?: number | null;
  instructions?: string;
  provider?: string | null;
}

/**
 * Split `total` across criteria in proportion to `weights`, in whole marks
 * when there are enough of them (half marks otherwise), using the largest
 * remainder method so the parts always add up to exactly `total`. Every
 * criterion gets at least one step when the total allows it.
 */
export function distributeMarks(weights: number[], total: number): number[] {
  const n = weights.length;
  if (n === 0 || !(total > 0)) return weights.map(() => 0);

  const step = total >= n ? 1 : 0.5;
  // Work in integer units so floating point never leaks into the result.
  // A total that isn't a multiple of the step (e.g. 7.5 in whole marks)
  // leaves its fraction on the largest criterion at the end.
  const units = Math.floor(total / step + 1e-9);
  const leftover = Math.round((total - units * step) * 100) / 100;

  const clean = weights.map((w) => (Number.isFinite(w) && w > 0 ? w : 0));
  const sum = clean.reduce((a, b) => a + b, 0);
  const shares = sum > 0 ? clean.map((w) => w / sum) : clean.map(() => 1 / n);

  const raw = shares.map((s) => s * units);
  const alloc = raw.map((r) => Math.floor(r));
  let remaining = units - alloc.reduce((a, b) => a + b, 0);

  // Hand out what's left to the biggest fractional remainders; ties go to the
  // heavier criterion, then to the earlier one, so the result is stable.
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r), share: shares[i] }))
    .sort((a, b) => b.frac - a.frac || b.share - a.share || a.i - b.i);
  for (let k = 0; remaining > 0; k = (k + 1) % n, remaining--) {
    alloc[order[k].i]++;
  }

  // A criterion worth nothing is pointless: when there are enough units,
  // lift each zero to one step, borrowing from the currently largest.
  if (units >= n) {
    for (let i = 0; i < n; i++) {
      if (alloc[i] > 0) continue;
      const donor = alloc.indexOf(Math.max(...alloc));
      alloc[donor]--;
      alloc[i]++;
    }
  }

  const marks = alloc.map((u) => Math.round(u * step * 100) / 100);
  if (leftover > 0) {
    const biggest = marks.indexOf(Math.max(...marks));
    marks[biggest] = Math.round((marks[biggest] + leftover) * 100) / 100;
  }
  return marks;
}

const rubricSchema: JSONSchema = {
  type: "object",
  properties: {
    found_in_description: {
      type: "boolean",
      description:
        "true only when the description itself lists grading/marking criteria",
    },
    criteria: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Short criterion name, max 60 chars",
          },
          description: {
            type: "string",
            description:
              "What the grader looks for, with what full / partial / no marks look like",
          },
          points: {
            type: "number",
            description:
              "Marks for this criterion (as written in the description, or a suggested weight)",
          },
        },
        required: ["name", "description", "points"],
      },
    },
    note: {
      type: "string",
      description:
        "One short sentence for the teacher about how the rubric was built",
    },
  },
  required: ["found_in_description", "criteria", "note"],
};

export function buildRubricPrompt(p: {
  title: string;
  text: string;
  maxScore: number;
  criteriaCount?: number | null;
  instructions?: string;
}): string {
  const count = p.criteriaCount
    ? `exactly ${p.criteriaCount} criteria`
    : `between 3 and 6 criteria (keep the teacher's own count if the description already lists criteria)`;
  return `You are an experienced teacher building a grading rubric for a school assignment.

ASSIGNMENT TITLE: ${p.title || "(untitled)"}
TOTAL MARKS: ${p.maxScore}

ASSIGNMENT DESCRIPTION (written by the teacher):
"""
${p.text}
"""
${p.instructions ? `\nTEACHER'S EXTRA GUIDANCE FOR THE RUBRIC:\n${p.instructions}\n` : ""}
STEPS:
1. Look for a rubric, marking scheme, assessment criteria or "you will be graded on" list inside the description.
   - If there is one, set found_in_description=true and use THOSE criteria, keeping their wording and their marks/percentages/weights.
   - If there is none, set found_in_description=false and design criteria that match the task, the instructions and the deliverables described.
2. Produce ${count}. Criteria must not overlap and must cover what the instructions ask the learner to do.
3. For each criterion give: a short name; a description telling the grader what full, partial and low marks look like; and points.
   Points should add up to ${p.maxScore}. If the description uses percentages or different marks, keep the same proportions.
4. Write the rubric in the same language as the description.

Return JSON only.`;
}

export async function generateRubric(
  params: GenerateRubricParams,
): Promise<GeneratedRubric> {
  const text = htmlToText(params.description)
    .slice(0, DESCRIPTION_BUDGET)
    .trim();
  const title = (params.title || "").trim();
  if (!text && !title) {
    throw Object.assign(
      new Error(
        "Write the assignment description first — the AI reads it to build the rubric.",
      ),
      {
        statusCode: 400,
      },
    );
  }

  type RawRubric = {
    found_in_description?: boolean;
    criteria?: { name?: string; description?: string; points?: number }[];
    note?: string;
  };
  let data: RawRubric;
  let providerUsed: string;
  try {
    ({ data, providerUsed } = await generateStructuredContent<RawRubric>(
      {
        schemaName: "assignment_rubric",
        schema: rubricSchema,
        prompt: buildRubricPrompt({
          title,
          text: text || "(no description — infer from the title)",
          maxScore: params.maxScore,
          criteriaCount: params.criteriaCount,
          instructions: params.instructions,
        }),
        maxOutputTokens: 2500,
      },
      { providerOrder: preferredOrder(params.provider) },
    ));
  } catch (err: any) {
    // Already a teacher-friendly message (quota, not configured, …).
    throw Object.assign(
      new Error(err?.message || "The AI service is unavailable."),
      { statusCode: 503 },
    );
  }

  let rows = (data?.criteria || [])
    .map((c) => ({
      name: String(c?.name || "")
        .trim()
        .slice(0, 120),
      description: String(c?.description || "")
        .trim()
        .slice(0, 1000),
      points: Number(c?.points),
    }))
    .filter((c) => c.name);

  if (rows.length === 0) {
    throw Object.assign(
      new Error(
        "The AI did not return any rubric criteria. Try again, or add more detail to the description.",
      ),
      { statusCode: 502 },
    );
  }
  if (params.criteriaCount && rows.length > params.criteriaCount) {
    rows = rows.slice(0, params.criteriaCount);
  }
  rows = rows.slice(0, RUBRIC_MAX_CRITERIA);

  const marks = distributeMarks(
    rows.map((r) => r.points),
    params.maxScore,
  );
  const criteria = rows.map((r, i) => ({
    criteria: r.name,
    description: r.description,
    max_score: marks[i],
  }));

  return {
    criteria,
    source: data?.found_in_description ? "description" : "generated",
    total: Math.round(marks.reduce((a, b) => a + b, 0) * 100) / 100,
    note: String(data?.note || "")
      .trim()
      .slice(0, 300),
    provider_used: providerUsed,
  };
}

/**
 * The "tmcode_practical" quiz question: the student answers it with a TMCode
 * project (optionally started from the teacher's starter files) and the
 * teacher grades it with criteria. Nothing about it is graded automatically:
 * a submitted project leaves the answer pending until the teacher grades it.
 *
 * question_data:
 *   kind          "practical" | "case_study"
 *   language      string | null           (profile hint for TMCode)
 *   instructions  string                  (shown beside the code)
 *   starter_project_id / starter_revision_id   (null = no starter files)
 *   rubric        [{ criteria, description?, max_score }]   (sums to the question's points)
 *
 * answer (quiz_attempts.submitted_answer):
 *   { project_id, link_id, revision_id, revision_number }  — the frozen submission
 */

export const PRACTICAL_TYPE = "tmcode_practical";

export interface PracticalCriterion {
  criteria: string;
  description?: string | null;
  max_score: number;
}

export interface PracticalQuestionData {
  kind: "practical" | "case_study";
  language: string | null;
  instructions: string;
  starter_project_id: number | null;
  starter_revision_id: number | null;
  rubric: PracticalCriterion[];
}

export interface PracticalAnswer {
  project_id: number;
  link_id: number;
  revision_id: number | null;
  revision_number: number | null;
}

const num = (v: unknown): number | null => {
  const n = Number(v);
  return v === null || v === undefined || v === "" || !Number.isFinite(n) ? null : n;
};

export function parsePracticalData(raw: unknown): PracticalQuestionData {
  const d = (typeof raw === "string" ? safeJson(raw) : raw) as Record<string, any> | null;
  const rubric = Array.isArray(d?.rubric)
    ? d!.rubric
        .map((c: any) => ({
          criteria: String(c?.criteria ?? "").trim(),
          description: c?.description ? String(c.description) : null,
          max_score: Number(c?.max_score) || 0,
        }))
        .filter((c: PracticalCriterion) => c.criteria)
    : [];
  return {
    kind: d?.kind === "case_study" ? "case_study" : "practical",
    language: d?.language ? String(d.language) : null,
    instructions: d?.instructions ? String(d.instructions) : "",
    starter_project_id: num(d?.starter_project_id),
    starter_revision_id: num(d?.starter_revision_id),
    rubric,
  };
}

export function validatePracticalData(raw: unknown): { isValid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const d = (typeof raw === "string" ? safeJson(raw) : raw) as Record<string, any> | null;
  if (!d || typeof d !== "object") {
    return { isValid: false, errors: ["Practical question data is missing."], warnings };
  }
  if (d.kind && !["practical", "case_study"].includes(d.kind)) errors.push("kind must be practical or case_study.");
  if (d.rubric !== undefined && !Array.isArray(d.rubric)) errors.push("rubric must be a list of criteria.");
  const data = parsePracticalData(d);
  if (data.rubric.some((c) => !(c.max_score > 0))) errors.push("Every grading criterion needs marks above 0.");
  if (!data.rubric.length) warnings.push("No grading criteria: the teacher will give one overall mark.");
  if (data.starter_revision_id && !data.starter_project_id) errors.push("A starter revision needs its starter project.");
  return { isValid: errors.length === 0, errors, warnings };
}

export function parsePracticalAnswer(raw: unknown): PracticalAnswer | null {
  const a = (typeof raw === "string" ? safeJson(raw) : raw) as Record<string, any> | null;
  const inner = a && typeof a === "object" && a.answer && typeof a.answer === "object" ? a.answer : a;
  const projectId = num(inner?.project_id);
  const linkId = num(inner?.link_id);
  if (!projectId || !linkId) return null;
  return {
    project_id: projectId,
    link_id: linkId,
    revision_id: num(inner?.revision_id),
    revision_number: num(inner?.revision_number),
  };
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

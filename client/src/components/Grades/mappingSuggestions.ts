import type { AssessmentCategory, ReportCardBuilderKind } from "../../services/reportCardApi";
import { toBuilderCategory } from "../../hooks/useReportCardStructure";

/**
 * The report card category an assessment most likely belongs in, from what
 * it is: a manual mark by its type (class work -> CW, homework -> HW,
 * midterm -> MD, end-of-term exam -> EOT, as the server's provisional card
 * places them), a quiz as class work, an assignment as homework; then read in
 * the Normal builder. A TVET school maps everything to FA by default. Null = no guess.
 */
const MANUAL_TYPE: Record<string, AssessmentCategory> = {
  class_work: "CW",
  group_work: "CW",
  participation: "CW",
  homework: "HW",
  midterm: "MD",
  ca_end_of_term: "EOT",
};

export function suggestCategory(
  row: { kind: "quiz" | "assignment" | "manual"; manualType?: string | null },
  builder: ReportCardBuilderKind,
): AssessmentCategory | null {
  // TVET schools map everything to FA by default (new work is mapped there automatically).
  if (builder === "tvet") return "FA";
  const base: AssessmentCategory | null =
    row.kind === "manual" ? (row.manualType ? (MANUAL_TYPE[row.manualType] ?? null) : null) : row.kind === "quiz" ? "CW" : "HW";
  return base ? toBuilderCategory(builder, base) : null;
}

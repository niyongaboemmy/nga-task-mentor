import type { AssessmentCategory, ReportCardBuilderKind } from "../../services/reportCardApi";
import { toBuilderCategory } from "../../hooks/useReportCardStructure";

/**
 * The report card category an assessment most likely belongs in, from what
 * it is: a manual mark by its type (class work -> CW, homework -> HW,
 * midterm -> MD, end-of-term exam -> EOT, as the server's provisional card
 * places them), a quiz as class work, an assignment as homework; then read in
 * the school's builder (TVET: CW/HW/MD -> FA, EOT -> CA). Null = no guess.
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
  const base: AssessmentCategory | null =
    row.kind === "manual" ? (row.manualType ? (MANUAL_TYPE[row.manualType] ?? null) : null) : row.kind === "quiz" ? "CW" : "HW";
  return base ? toBuilderCategory(builder, base) : null;
}

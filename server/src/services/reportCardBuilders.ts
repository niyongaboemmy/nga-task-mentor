import type { AssessmentCategory, CategoryWeights } from "./reportCardGrader.service";

/**
 * The two report card builder structures a school can choose
 * (scheme.builder):
 *
 *  normal  Class work 15 · Homework 10 · Mid-term 25 · End of term 50
 *          (weights from the scheme, summing to 100), the general-education
 *          card with letter grades.
 *  tvet    RTB / CAMIS learner's assessment report: FA (formative), CA
 *          (comprehensive, end of term) and IA (integrated, any term). Each is
 *          shown out of the module weight (learning hours) and they count
 *          equally, so grading treats them as equal-weight percentages and
 *          the card multiplies by the weight when it renders.
 *
 * Mappings are never rewritten when a school switches: a category from the
 * other builder is read through effectiveCategory().
 */

export type ReportCardBuilderKind = "normal" | "tvet";
export const BUILDER_KINDS: ReportCardBuilderKind[] = ["normal", "tvet"];

export interface BuilderCategory {
  key: AssessmentCategory;
  label: string;
  short: string;
  /** Normal: share of the 100. TVET: marks are out of the module weight (shown as "× weight"). */
  weight: number;
  hint: string;
}

export interface BuilderStructure {
  key: ReportCardBuilderKind;
  label: string;
  description: string;
  categories: BuilderCategory[];
}

/** Equal weights: a TVET module's mark is the average of its assessed component percentages. */
export const TVET_WEIGHTS = { FA: 100, CA: 100, IA: 100 } as const;

export function builderStructure(kind: ReportCardBuilderKind, weights?: Partial<Record<string, number>>): BuilderStructure {
  if (kind === "tvet") {
    return {
      key: "tvet",
      label: "TVET (RTB / CAMIS)",
      description:
        "Learner's assessment report for TSS schools: Formative, Comprehensive and Integrated assessments out of each module's weight, Competent / Not Yet Competent.",
      categories: [
        { key: "FA", label: "Formative Assessment", short: "FA", weight: 100, hint: "Class work, homework, quizzes, mid-term: scored out of the module weight." },
        { key: "CA", label: "Comprehensive Assessment", short: "CA", weight: 100, hint: "The end-of-term assessment: scored out of the module weight." },
        { key: "IA", label: "Integrated Assessment", short: "IA", weight: 100, hint: "Integrated assessment, in any term it is given: scored out of the module weight." },
      ],
    };
  }
  const w = (k: string, d: number) => (weights && Number.isFinite(Number(weights[k])) ? Number(weights[k]) : d);
  return {
    key: "normal",
    label: "Normal",
    description: "General-education report card: weighted categories out of 100, letter grades, class average and position.",
    categories: [
      { key: "CW", label: "Class Work", short: "CW", weight: w("CW", 15), hint: "Class activities and exercises." },
      { key: "HW", label: "Homework", short: "HW", weight: w("HW", 10), hint: "Work done at home." },
      { key: "MD", label: "Mid-Term", short: "MD", weight: w("MD", 25), hint: "Mid-term tests." },
      { key: "EOT", label: "End of Term", short: "EOT", weight: w("EOT", 50), hint: "The end-of-term exam." },
    ],
  };
}

/**
 * The category a mapping counts under in `builder`. TVET reads the Normal
 * categories as FA (CW/HW/MD) and CA (EOT); Normal reads FA as MD and CA as
 * EOT, and has no place for IA (null = not counted).
 */
export function effectiveCategory(builder: ReportCardBuilderKind, category: string): AssessmentCategory | null {
  if (builder === "tvet") {
    if (category === "CW" || category === "HW" || category === "MD" || category === "FA") return "FA";
    if (category === "EOT" || category === "CA") return "CA";
    if (category === "IA") return "IA";
    return null;
  }
  if (category === "CW" || category === "HW" || category === "MD" || category === "EOT") return category;
  if (category === "FA") return "MD";
  if (category === "CA") return "EOT";
  return null;
}

/** What grading needs from the scheme: the builder and its category weights. */
export interface Grading {
  builder: ReportCardBuilderKind;
  weights: CategoryWeights;
}

export function gradingOf(scheme: { builder?: ReportCardBuilderKind; category_weights: Record<string, number> }): Grading {
  const builder = scheme.builder === "tvet" ? "tvet" : "normal";
  const base = scheme.category_weights as Record<string, number>;
  const weights = (builder === "tvet" ? { ...base, ...TVET_WEIGHTS } : { ...base, FA: 0, CA: 0, IA: 0 }) as CategoryWeights;
  return { builder, weights };
}

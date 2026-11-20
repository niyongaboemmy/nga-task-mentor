import { useEffect, useState } from "react";
import { ReportCardWorkflowApi } from "../services/reportCardWorkflowApi";
import type { AssessmentCategory, BuilderStructure, ReportCardBuilderKind } from "../services/reportCardApi";

/**
 * The report card builder the school chose (Normal / TVET) and its mapping
 * categories, from GET /report-cards/structure. Fetched once per session and
 * shared by every mapping surface (report card builder, Grades page picker);
 * `refreshReportCardStructure()` after the school switches builder.
 */

export const NORMAL_STRUCTURE: BuilderStructure = {
  key: "normal",
  label: "Normal",
  description: "General-education report card: weighted categories out of 100, letter grades, class average and position.",
  categories: [
    { key: "CW", label: "Class Work", short: "CW", weight: 15, hint: "Class activities and exercises." },
    { key: "HW", label: "Homework", short: "HW", weight: 10, hint: "Work done at home." },
    { key: "MD", label: "Mid-Term", short: "MD", weight: 25, hint: "Mid-term tests." },
    { key: "EOT", label: "End of Term", short: "EOT", weight: 50, hint: "The end-of-term exam." },
  ],
};

export const TVET_STRUCTURE: BuilderStructure = {
  key: "tvet",
  label: "TVET (RTB / CAMIS)",
  description:
    "Learner's assessment report for TSS schools: Formative, Comprehensive and Integrated assessments out of each module's weight, Competent / Not Yet Competent.",
  categories: [
    { key: "FA", label: "Formative Assessment", short: "FA", weight: 100, hint: "Class work, homework, quizzes, mid-term: scored out of the module weight." },
    { key: "CA", label: "Comprehensive Assessment", short: "CA", weight: 100, hint: "The end-of-term assessment: scored out of the module weight." },
    { key: "IA", label: "Integrated Assessment", short: "IA", weight: 100, hint: "Term 3 integrated assessment: scored out of the module weight; N/A in Terms 1–2." },
  ],
};

/** Mirror of the server's effectiveCategory: where a mapping made under the other builder counts. */
export function toBuilderCategory(builder: ReportCardBuilderKind, category: AssessmentCategory): AssessmentCategory | null {
  if (builder === "tvet") {
    if (category === "CW" || category === "HW" || category === "MD" || category === "FA") return "FA";
    if (category === "EOT" || category === "CA") return "CA";
    return category === "IA" ? "IA" : null;
  }
  if (category === "FA") return "MD";
  if (category === "CA") return "EOT";
  return category === "IA" ? null : category;
}

export interface StructureState {
  builder: ReportCardBuilderKind;
  structure: BuilderStructure;
  categories: AssessmentCategory[];
  loading: boolean;
}

let cache: Promise<BuilderStructure> | null = null;
const listeners = new Set<(s: BuilderStructure) => void>();

function load(): Promise<BuilderStructure> {
  if (!cache) {
    cache = ReportCardWorkflowApi.structure()
      .then((r) => r.data.structure)
      .catch(() => {
        cache = null; // retry next time; meanwhile the Normal structure
        return NORMAL_STRUCTURE;
      });
  }
  return cache;
}

/** Re-reads the structure (after the school switches builder) and updates every mounted user. */
export async function refreshReportCardStructure(next?: BuilderStructure): Promise<void> {
  cache = next ? Promise.resolve(next) : null;
  const s = await load();
  listeners.forEach((l) => l(s));
}

export function useReportCardStructure(): StructureState {
  const [structure, setStructure] = useState<BuilderStructure | null>(null);
  useEffect(() => {
    let live = true;
    const on = (s: BuilderStructure) => live && setStructure(s);
    listeners.add(on);
    void load().then(on);
    return () => {
      live = false;
      listeners.delete(on);
    };
  }, []);
  const s = structure ?? NORMAL_STRUCTURE;
  return { builder: s.key, structure: s, categories: s.categories.map((c) => c.key), loading: structure === null };
}

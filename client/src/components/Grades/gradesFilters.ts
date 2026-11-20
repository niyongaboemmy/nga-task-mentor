/**
 * Grades page filtering: what each assessment row is for every facet, and
 * which rows pass. Counts per option are "faceted": each option counts the
 * rows that would show if it were picked, given every other filter.
 */

export type FacetKey = "type" | "cat" | "marks" | "group";
export type FilterState = Record<FacetKey, string[]> & { from: string; to: string };

export const EMPTY_FILTERS: FilterState = { type: [], cat: [], marks: [], group: [], from: "", to: "" };

export interface FilterableRow {
  kind: "quiz" | "assignment" | "manual";
  manualType?: string | null;
  /** The category it counts under in the school's builder; null = unmapped. */
  category: string | null;
  partOf?: boolean;
  recorded: number;
  enrolled: number | null;
  missing: number;
  date: string | null;
  subjectCode?: string | null;
}

export const MANUAL_TYPE_LABEL: Record<string, string> = {
  class_work: "Class work",
  group_work: "Group work",
  homework: "Homework",
  midterm: "Midterm",
  participation: "Participation",
  ca_end_of_term: "End-of-term exam",
};

/** Assessment type: quiz, assignment, or the manual mark's own type. */
export const typeOf = (r: FilterableRow) => (r.kind === "manual" ? `manual:${r.manualType && MANUAL_TYPE_LABEL[r.manualType] ? r.manualType : "other"}` : r.kind);
export const typeLabel = (v: string) =>
  v === "quiz" ? "Quiz" : v === "assignment" ? "Assignment" : v === "manual:other" ? "Manual (other)" : (MANUAL_TYPE_LABEL[v.slice(7)] ?? v);

export const catOf = (r: FilterableRow) => (r.partOf ? "partof" : (r.category ?? "unmapped"));

/** Marks: missing (finished, some not recorded) · none recorded · all recorded · some recorded. */
export function marksOf(r: FilterableRow): "missing" | "none" | "complete" | "partial" {
  if (r.missing > 0) return "missing";
  if (r.recorded <= 0) return "none";
  if (r.enrolled != null && r.enrolled > 0 && r.recorded >= r.enrolled) return "complete";
  return "partial";
}
export const MARKS_LABEL: Record<string, string> = { missing: "Missing marks", none: "No marks yet", partial: "Some marks recorded", complete: "All marks recorded" };

/** RTB module group from the subject code: CCM… complementary, GEN… general, other trade codes specific. */
export function groupOf(r: FilterableRow): string {
  const c = (r.subjectCode ?? "").trim().toUpperCase();
  if (!c) return "other";
  if (c.startsWith("CCM")) return "complementary";
  if (c.startsWith("GEN")) return "general";
  return /^[A-Z]{3,}/.test(c) ? "specific" : "other";
}
export const GROUP_LABEL: Record<string, string> = { specific: "Specific modules", general: "General modules", complementary: "Complementary modules", other: "Other subjects" };

const keyOf: Record<FacetKey, (r: FilterableRow) => string> = { type: typeOf, cat: catOf, marks: marksOf, group: groupOf };

const inDates = (r: FilterableRow, f: FilterState) => {
  if (!f.from && !f.to) return true;
  if (!r.date) return false;
  const d = r.date.slice(0, 10);
  return (!f.from || d >= f.from) && (!f.to || d <= f.to);
};

/** Does the row pass every filter (optionally ignoring one facet, for its counts)? */
export function passes(r: FilterableRow, f: FilterState, except?: FacetKey): boolean {
  for (const k of ["type", "cat", "marks", "group"] as FacetKey[]) {
    if (k === except || f[k].length === 0) continue;
    if (!f[k].includes(keyOf[k](r))) return false;
  }
  return inDates(r, f);
}

/** Option -> how many rows it would show, given the other filters. */
export function facetCounts(rows: FilterableRow[], f: FilterState, facet: FacetKey): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of rows) {
    if (!passes(r, f, facet)) continue;
    const k = keyOf[facet](r);
    out.set(k, (out.get(k) ?? 0) + 1);
  }
  return out;
}

export const isFiltering = (f: FilterState) => f.type.length + f.cat.length + f.marks.length + f.group.length > 0 || !!f.from || !!f.to;

/** URL <-> filters (f_type=quiz,manual:midterm&f_from=2026-09-01 ...). */
export function filtersFromParams(p: URLSearchParams): FilterState {
  const list = (k: string) => (p.get(k) ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  const date = (k: string) => (/^\d{4}-\d{2}-\d{2}$/.test(p.get(k) ?? "") ? (p.get(k) as string) : "");
  return { type: list("f_type"), cat: list("f_cat"), marks: list("f_marks"), group: list("f_group"), from: date("f_from"), to: date("f_to") };
}
export function filtersToParams(p: URLSearchParams, f: FilterState): URLSearchParams {
  const next = new URLSearchParams(p);
  for (const [k, v] of [
    ["f_type", f.type.join(",")],
    ["f_cat", f.cat.join(",")],
    ["f_marks", f.marks.join(",")],
    ["f_group", f.group.join(",")],
    ["f_from", f.from],
    ["f_to", f.to],
  ] as const) {
    if (v) next.set(k, v);
    else next.delete(k);
  }
  return next;
}

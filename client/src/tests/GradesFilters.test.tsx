import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import GradesFilterBar, { type Facet } from "../components/Grades/GradesFilterBar";
import {
  EMPTY_FILTERS,
  facetCounts,
  filtersFromParams,
  filtersToParams,
  groupOf,
  isFiltering,
  marksOf,
  passes,
  typeLabel,
  typeOf,
  type FilterableRow,
} from "../components/Grades/gradesFilters";

const row = (over: Partial<FilterableRow>): FilterableRow => ({ kind: "quiz", category: "FA", recorded: 10, enrolled: 10, missing: 0, date: "2026-10-01", subjectCode: "SPEWI302", ...over });
const ROWS = [
  row({}),
  row({ kind: "assignment", category: null, recorded: 0, date: "2026-10-12" }),
  row({ kind: "manual", manualType: "midterm", category: "CA", missing: 2, recorded: 8, subjectCode: "GENEG302", date: "2026-11-09" }),
  row({ kind: "manual", manualType: "weird", category: "FA", recorded: 4, subjectCode: "CCMKN302", date: "2026-11-15" }),
  row({ kind: "assignment", partOf: true, category: null, subjectCode: null, date: null }),
];

describe("grades filter rules", () => {
  it("reads each row's type, marks state and module group", () => {
    expect(ROWS.map(typeOf)).toEqual(["quiz", "assignment", "manual:midterm", "manual:other", "assignment"]);
    expect([typeLabel("manual:midterm"), typeLabel("manual:other"), typeLabel("quiz")]).toEqual(["Midterm", "Manual (other)", "Quiz"]);
    expect(ROWS.map(marksOf)).toEqual(["complete", "none", "missing", "partial", "complete"]);
    expect(ROWS.map(groupOf)).toEqual(["specific", "specific", "general", "complementary", "other"]);
  });

  it("combines facets (AND across, OR within) and dates, with faceted counts", () => {
    const f = { ...EMPTY_FILTERS, type: ["quiz", "manual:midterm"], cat: ["FA", "CA"] };
    expect(ROWS.filter((r) => passes(r, f)).length).toBe(2);
    // Counts for "type" ignore the type filter itself but keep the category filter.
    expect(Object.fromEntries(facetCounts(ROWS, f, "type"))).toEqual({ quiz: 1, "manual:midterm": 1, "manual:other": 1 });
    const dated = { ...EMPTY_FILTERS, from: "2026-10-10", to: "2026-11-10" };
    expect(ROWS.filter((r) => passes(r, dated)).map(typeOf)).toEqual(["assignment", "manual:midterm"]);
    expect(isFiltering(EMPTY_FILTERS)).toBe(false);
    expect(isFiltering(dated)).toBe(true);
  });

  it("keeps the filters in the URL", () => {
    const p = filtersToParams(new URLSearchParams("attention=missing"), { ...EMPTY_FILTERS, type: ["quiz", "manual:midterm"], marks: ["missing"], from: "2026-09-01" });
    expect(p.get("attention")).toBe("missing");
    expect(filtersFromParams(p)).toEqual({ ...EMPTY_FILTERS, type: ["quiz", "manual:midterm"], marks: ["missing"], from: "2026-09-01" });
    expect(filtersFromParams(new URLSearchParams("f_from=bad")).from).toBe("");
  });
});

describe("GradesFilterBar", () => {
  it("picks options from a menu, shows chips with a result count, and clears", () => {
    const onChange = vi.fn();
    const onClearAll = vi.fn();
    const facet: Facet = {
      key: "type",
      label: "Type",
      selected: ["quiz"],
      onChange,
      options: [
        { value: "quiz", label: "Quiz", count: 3 },
        { value: "assignment", label: "Assignment", count: 0 },
        { value: "manual:midterm", label: "Midterm", count: 2 },
      ],
    };
    render(<GradesFilterBar facets={[facet]} dateFrom="" dateTo="" onDate={vi.fn()} shown={3} total={9} onClearAll={onClearAll} />);
    expect(screen.getByTestId("filter-result")).toHaveTextContent("Showing 3 of 9 assessments");
    expect(screen.getByTestId("filter-chips")).toHaveTextContent("Type: Quiz");
    fireEvent.click(screen.getByTestId("filter-type"));
    expect(screen.getByTestId("filter-type-assignment")).toBeDisabled(); // nothing would show
    fireEvent.click(screen.getByTestId("filter-type-manual:midterm"));
    expect(onChange).toHaveBeenCalledWith(["quiz", "manual:midterm"]);
    fireEvent.click(screen.getByRole("button", { name: "Remove filter Type: Quiz" }));
    expect(onChange).toHaveBeenLastCalledWith([]);
    fireEvent.click(screen.getByTestId("filter-clear"));
    expect(onClearAll).toHaveBeenCalled();
  });
});

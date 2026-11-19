import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import MarksAttentionBar from "../components/Grades/MarksAttentionBar";
import type { MarksAttention } from "../services/instructorOverviewApi";

const data = (totals: MarksAttention["totals"]): MarksAttention => ({ term: "Term 1", academic_year: "2026 - 2027", totals, subjects: [], items: [] });

describe("MarksAttentionBar", () => {
  it("says what needs doing and filters to it", () => {
    const onFilter = vi.fn();
    render(<MarksAttentionBar data={data({ unmapped: 3, incomplete: 2, missing_marks: 5 })} loading={false} error={false} active={null} onFilter={onFilter} />);
    expect(screen.getByTestId("attention-unmapped")).toHaveTextContent("3 not mapped");
    expect(screen.getByTestId("attention-unmapped")).toHaveTextContent("don't count on report cards");
    expect(screen.getByTestId("attention-missing")).toHaveTextContent("5 student marks not recorded");
    fireEvent.click(screen.getByTestId("attention-unmapped"));
    expect(onFilter).toHaveBeenCalledWith("unmapped");
  });

  it("clears an active filter", () => {
    const onFilter = vi.fn();
    render(<MarksAttentionBar data={data({ unmapped: 1, incomplete: 0, missing_marks: 0 })} loading={false} error={false} active="unmapped" onFilter={onFilter} />);
    expect(screen.getByTestId("attention-unmapped")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("attention-missing")).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /Show all assessments/ }));
    expect(onFilter).toHaveBeenCalledWith(null);
  });

  it("confirms when everything is mapped and complete, and shows a skeleton while loading", () => {
    const { rerender } = render(<MarksAttentionBar data={null} loading error={false} active={null} onFilter={vi.fn()} />);
    expect(screen.getByTestId("marks-attention-loading")).toBeInTheDocument();
    rerender(<MarksAttentionBar data={data({ unmapped: 0, incomplete: 0, missing_marks: 0 })} loading={false} error={false} active={null} onFilter={vi.fn()} />);
    expect(screen.getByTestId("marks-attention")).toHaveTextContent("All marks are mapped and complete for Term 1 · 2026 - 2027");
  });
});

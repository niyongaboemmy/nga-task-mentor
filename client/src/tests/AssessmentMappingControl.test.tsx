import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import AssessmentMappingControl from "../components/ReportCard/AssessmentMappingControl";

describe("AssessmentMappingControl", () => {
  it("won't offer mapping for an assignment that is part of another assessment, and says why", () => {
    const onChange = vi.fn();
    render(<AssessmentMappingControl category={null} onChange={onChange} lockedReason='Its marks are part of "Mid term", so it can&apos;t go on the report card.' />);
    const locked = screen.getByTestId("mapping-locked");
    expect(locked).toHaveTextContent("Part of another");
    expect(locked).toHaveAttribute("aria-label", expect.stringContaining('part of "Mid term"'));
    expect(screen.queryByLabelText("Report card category")).toBeNull();
    fireEvent.click(locked);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("offers the categories otherwise", () => {
    render(<AssessmentMappingControl category={null} onChange={vi.fn()} />);
    expect(screen.queryByTestId("mapping-locked")).toBeNull();
  });
});

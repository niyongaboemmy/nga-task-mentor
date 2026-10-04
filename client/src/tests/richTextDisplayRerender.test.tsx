// The quiz page re-renders every second (its clock). Each rich-text block is a
// read-only Tiptap editor; a re-render with the same content must not
// reconfigure it (that was a ProseMirror update per block, per second).
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import RichTextDisplay from "../components/Common/RichTextDisplay";

describe("RichTextDisplay", () => {
  it("doesn't reconfigure its editor when the parent re-renders", async () => {
    const setOptions = vi.spyOn(Editor.prototype, "setOptions");
    const Page = ({ tick }: { tick: number }) => (
      <div data-tick={tick}>
        <RichTextDisplay content="<p>What is <strong>2 + 2</strong>?</p>" />
      </div>
    );
    const { rerender } = render(<Page tick={0} />);
    expect(await screen.findByText("2 + 2")).toBeInTheDocument();
    setOptions.mockClear();
    for (let i = 1; i <= 10; i++) rerender(<Page tick={i} />);
    expect(setOptions).not.toHaveBeenCalled();
    setOptions.mockRestore();
  });

  it("still shows new content", async () => {
    const { rerender } = render(<RichTextDisplay content="<p>First</p>" />);
    expect(await screen.findByText("First")).toBeInTheDocument();
    rerender(<RichTextDisplay content="<p>Second</p>" />);
    expect(await screen.findByText("Second")).toBeInTheDocument();
  });
});

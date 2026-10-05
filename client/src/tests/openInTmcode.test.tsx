import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const axiosMock = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("../utils/axiosConfig", () => ({ default: axiosMock }));

import OpenInTmcode from "../components/Quizzes/OpenInTmcode";

describe("Open in TMCode (TMCode Phase 3)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("asks for a launch ticket and opens the tmcode:// link", async () => {
    const href = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, set href(v: string) { href(v); } },
    });
    axiosMock.post.mockResolvedValue({ data: { deeplink: "tmcode://launch?t=abc&api=https%3A%2F%2Fx" } });
    render(<OpenInTmcode quizId={77} required />);
    expect(screen.getByTestId("open-in-tmcode")).toHaveTextContent(/must be answered in TMCode/);
    fireEvent.click(screen.getByRole("button", { name: /Open in TMCode/ }));
    await waitFor(() => expect(href).toHaveBeenCalledWith("tmcode://launch?t=abc&api=https%3A%2F%2Fx"));
    expect(axiosMock.post).toHaveBeenCalledWith("/tmcode/launch", { quiz_id: 77 });
  });

  it("shows the server's reason when launching is refused", async () => {
    axiosMock.post.mockRejectedValue({ response: { data: { error_code: "TMCODE_NOT_ENABLED", message: "This quiz isn't delivered in TMCode." } } });
    render(<OpenInTmcode quizId={5} />);
    fireEvent.click(screen.getByRole("button", { name: /Open in TMCode/ }));
    expect(await screen.findByText("This quiz isn't delivered in TMCode.")).toBeInTheDocument();
  });
});

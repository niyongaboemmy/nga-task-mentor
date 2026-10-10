import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

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
    render(<OpenInTmcode quizId={77} required />, { wrapper: MemoryRouter });
    expect(screen.getByTestId("open-in-tmcode")).toHaveTextContent(/must be answered in TMCode/);
    fireEvent.click(screen.getByRole("button", { name: /Open in TMCode/ }));
    await waitFor(() => expect(href).toHaveBeenCalledWith("tmcode://launch?t=abc&api=https%3A%2F%2Fx"));
    expect(axiosMock.post).toHaveBeenCalledWith("/tmcode/launch", { quiz_id: 77 });
    // The hint links to the real download page (not /apps) and carries the unsigned-installer tip.
    const hint = await screen.findByTestId("tmcode-fallback");
    expect(hint).toHaveTextContent("Didn't open? Install TMCode");
    expect(screen.getByRole("link", { name: /Install TMCode/ })).toHaveAttribute("href", "/tmcode");
    expect(screen.getByTestId("tmcode-unsigned-tip")).toBeInTheDocument();
  });

  it("before a click, links to the download page", () => {
    render(<OpenInTmcode quizId={77} />, { wrapper: MemoryRouter });
    expect(screen.getByRole("link", { name: "Install TMCode" })).toHaveAttribute("href", "/tmcode");
    expect(document.querySelector('a[href="/apps"]')).toBeNull();
  });

  it("on a phone, says TMCode needs a computer and doesn't start an attempt", async () => {
    const ua = vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
    );
    render(<OpenInTmcode quizId={77} required />, { wrapper: MemoryRouter });
    expect(screen.getByTestId("tmcode-unsupported")).toHaveTextContent("TMCode needs a Windows, macOS or Linux computer");
    fireEvent.click(screen.getByRole("button", { name: /Open in TMCode/ }));
    expect(await screen.findByTestId("tmcode-fallback")).toHaveTextContent("doesn't run on phones or tablets");
    expect(axiosMock.post).not.toHaveBeenCalled();
    ua.mockRestore();
  });

  it("shows the server's reason when launching is refused", async () => {
    axiosMock.post.mockRejectedValue({ response: { data: { error_code: "TMCODE_NOT_ENABLED", message: "This quiz isn't delivered in TMCode." } } });
    render(<OpenInTmcode quizId={5} />, { wrapper: MemoryRouter });
    fireEvent.click(screen.getByRole("button", { name: /Open in TMCode/ }));
    expect(await screen.findByText("This quiz isn't delivered in TMCode.")).toBeInTheDocument();
  });
});

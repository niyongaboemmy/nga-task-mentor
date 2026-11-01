import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, renderHook } from "@testing-library/react";

/**
 * AI usage control on the client (AI_USAGE_CONTROL_PLAN.md §5.6-5.8): the
 * teacher's Off / Hints / Full control (disabled when the school locks it),
 * the AI badge, the 403 AI_DISABLED message, and useAiAccess.
 */

const fetchAiPolicy = vi.fn();
const fetchAiAccess = vi.fn();
vi.mock("../services/aiApi", async (orig) => ({
  ...(await orig<typeof import("../services/aiApi")>()),
  fetchAiPolicy: () => fetchAiPolicy(),
  fetchAiAccess: (ctx: unknown) => fetchAiAccess(ctx),
}));

import { AiModeBadge, AiModeControl } from "../components/ai/AiControls";
import { clearAiAccessCache, useAiAccess } from "../hooks/useAiAccess";
import { aiDisabledMessage, aiReasonShort } from "../services/aiApi";

const policy = (extra: Record<string, unknown> = {}) => ({
  available: true,
  enabled: true,
  apps: { tm: true, tmcode: true },
  assessments: "teacher",
  grading: false,
  itemModes: true,
  hasAiUse: true,
  author: { allowed: true, reason: "ALLOWED_BY_ROLE", message: "AI is available." },
  v: 3,
  ...extra,
});

beforeEach(() => {
  clearAiAccessCache();
  fetchAiPolicy.mockReset();
  fetchAiAccess.mockReset();
});

describe("AiModeControl", () => {
  it("lets the teacher pick No AI / Learning / Industrial, with help text", async () => {
    fetchAiPolicy.mockResolvedValue(policy());
    const onChange = vi.fn();
    render(<AiModeControl idPrefix="quiz" value="off" onChange={onChange} itemLabel="this quiz" />);
    expect(screen.getByText("AI assistance for students")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /^No AI$/ })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("radio", { name: /^Industrial$/i }));
    expect(onChange).toHaveBeenCalledWith("full");
    expect(screen.getByText(/Students code on their own/i)).toBeInTheDocument();
    await waitFor(() => expect(fetchAiPolicy).toHaveBeenCalled());
    expect(screen.getByRole("radio", { name: /^Learning$/i })).not.toBeDisabled();
  });

  it("is shown but disabled when the school has AI off or assessments locked", async () => {
    fetchAiPolicy.mockResolvedValue(policy({ enabled: false, itemModes: false }));
    render(<AiModeControl idPrefix="assignment" value="hints" onChange={vi.fn()} />);
    expect(await screen.findByText(/Disabled by the school administrator/i)).toBeInTheDocument();
    for (const name of [/^No AI$/, /^Learning$/i, /^Industrial$/i]) {
      expect(screen.getByRole("radio", { name })).toBeDisabled();
    }
    // the teacher's choice is still shown (kept for later)
    expect(screen.getByRole("radio", { name: /^Learning$/i })).toHaveAttribute("aria-checked", "true");
  });
});

describe("AiModeBadge", () => {
  it("shows AI: No AI / Learning / Industrial (No AI when unknown)", () => {
    const { rerender } = render(<AiModeBadge mode="full" />);
    expect(screen.getByTestId("ai-mode-badge")).toHaveTextContent("AI: Industrial");
    rerender(<AiModeBadge mode="hints" />);
    expect(screen.getByTestId("ai-mode-badge")).toHaveTextContent("AI: Learning");
    rerender(<AiModeBadge mode={undefined} />);
    expect(screen.getByTestId("ai-mode-badge")).toHaveTextContent("AI: No AI");
  });
});

describe("useAiAccess", () => {
  it("asks once per item and returns the server's decision", async () => {
    fetchAiAccess.mockResolvedValue({
      allowed: true,
      reason: "HINTS_ONLY",
      message: "Only AI hints are allowed for this activity.",
      mode: "hints",
      features: { assist: false, complete: false, hint: true },
    });
    const { result } = renderHook(() => useAiAccess({ quiz: 12 }));
    await waitFor(() => expect(result.current.access?.mode).toBe("hints"));
    expect(result.current.access?.features.hint).toBe(true);
    renderHook(() => useAiAccess({ quiz: 12 }));
    expect(fetchAiAccess).toHaveBeenCalledTimes(1);
    expect(fetchAiAccess).toHaveBeenCalledWith({ quiz: 12 });
  });

  it("no answer means no AI shown", async () => {
    fetchAiAccess.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useAiAccess({ assignment: 4 }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.access).toBeNull();
  });
});

describe("refusal messages", () => {
  it("reads 403 AI_DISABLED (top level or under error) and short reason labels", () => {
    const err = (data: unknown, status = 403) => ({ isAxiosError: true, response: { status, data } });
    expect(aiDisabledMessage(err({ code: "AI_DISABLED", reason: "TEACHER_OFF", message: "Your teacher turned AI off for this activity." }))).toBe(
      "Your teacher turned AI off for this activity.",
    );
    expect(aiDisabledMessage(err({ error: { code: "AI_DISABLED", message: "AI is turned off for the school." } }))).toBe("AI is turned off for the school.");
    expect(aiDisabledMessage(err({ message: "Missing required permission" }))).toBeNull();
    expect(aiDisabledMessage(new Error("x"))).toBeNull();
    expect(aiReasonShort("TEACHER_OFF", "quiz")).toBe("AI is off for this quiz");
    expect(aiReasonShort("GLOBAL_OFF")).toBe("AI is off for the school");
  });
});

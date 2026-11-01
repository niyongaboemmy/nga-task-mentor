/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("../utils/axiosConfig", () => ({
  default: { get: vi.fn(() => Promise.reject(new Error("no network in tests"))) },
  isAxiosError: (e: any) => !!e?.isAxiosError,
}));

import HandoffControl from "../components/ai/HandoffControl";
import { AiAnsweredBy } from "../components/ai/AiSourceControl";
import { PREFILL_MAX, handoffPlan } from "../services/aiHandoffApi";
import type { AiPolicySummary } from "../services/aiApi";
import { optionValues, pickOption } from "./helpers/select";

const POLICY = (external: AiPolicySummary["external"]): AiPolicySummary => ({
  available: true,
  enabled: true,
  apps: { tm: true, tmcode: true },
  assessments: "teacher",
  grading: true,
  itemModes: true,
  hasAiUse: true,
  author: { allowed: true, reason: "ALLOWED" as any, message: "" },
  external,
  v: 1,
});
const ON = POLICY({ handoff: true, pupilNames: "with_consent" });

let open: ReturnType<typeof vi.spyOn>;
let writeText: ReturnType<typeof vi.fn>;

beforeEach(() => {
  open = vi.spyOn(window, "open").mockImplementation(() => null);
  writeText = vi.fn(() => Promise.resolve());
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
});
afterEach(() => open.mockRestore());

const trigger = () => screen.getByRole("combobox", { name: "Open in my AI" });

describe("HandoffControl", () => {
  it("renders nothing unless the school allows hand-off for this person", () => {
    const { container, rerender } = render(<HandoffControl policy={POLICY({ handoff: false, pupilNames: "never" })} request={vi.fn()} onImported={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<HandoffControl policy={null} request={vi.fn()} onImported={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("Claude: asks for the prompt, opens claude.ai prefilled in a new tab (noopener), never submits", async () => {
    const request = vi.fn().mockResolvedValue({ success: true, handoff: { prompt: "Write a rubric", expects: "json" } });
    render(<HandoffControl idPrefix="t" policy={ON} request={request} onImported={vi.fn()} />);
    expect(optionValues(trigger())).toEqual(["", "claude", "chatgpt", "gemini", "copy"]);
    pickOption(trigger(), "claude");
    await waitFor(() => expect(open).toHaveBeenCalled());
    expect(request).toHaveBeenCalledWith({ mode: "prompt" });
    expect(open).toHaveBeenCalledWith(`https://claude.ai/new?q=${encodeURIComponent("Write a rubric")}`, "_blank", "noopener,noreferrer");
    expect(writeText).not.toHaveBeenCalled();
    expect(await screen.findByLabelText("Paste the answer from your AI")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Claude opened with the prompt filled in");
  });

  it("a long prompt is copied and the site opens without it; Gemini always copies", async () => {
    const long = "x".repeat(PREFILL_MAX + 1);
    const request = vi.fn().mockResolvedValue({ success: true, handoff: { prompt: long, expects: "json" } });
    render(<HandoffControl policy={ON} request={request} onImported={vi.fn()} />);
    pickOption(trigger(), "chatgpt");
    await waitFor(() => expect(open).toHaveBeenCalledWith("https://chatgpt.com/", "_blank", "noopener,noreferrer"));
    expect(writeText).toHaveBeenCalledWith(long);

    request.mockResolvedValueOnce({ success: true, handoff: { prompt: "short", expects: "json" } });
    pickOption(trigger(), "gemini");
    await waitFor(() => expect(open).toHaveBeenCalledWith("https://gemini.google.com/app", "_blank", "noopener,noreferrer"));
    expect(writeText).toHaveBeenLastCalledWith("short");
  });

  it("'Paste the answer' imports the pasted text and hands the body back", async () => {
    const body = { success: true, data: { criteria: [] }, ai: { route: "handoff", reason: "HANDOFF" } };
    const request = vi.fn().mockResolvedValue(body);
    const onImported = vi.fn();
    render(<HandoffControl policy={ON} request={request} onImported={onImported} />);
    fireEvent.click(screen.getByRole("button", { name: /Paste the answer/ }));
    fireEvent.change(screen.getByLabelText("Paste the answer from your AI"), { target: { value: '```json\n{"a":1}\n```' } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Use this answer" }));
    });
    expect(request).toHaveBeenCalledWith({ mode: "import", text: '```json\n{"a":1}\n```' });
    expect(onImported).toHaveBeenCalledWith(body);
  });

  it("shows the server's refusal (e.g. pupil consent) instead of opening anything", async () => {
    const err = Object.assign(new Error("403"), {
      isAxiosError: true,
      response: { status: 403, data: { code: "AI_HANDOFF_PUPIL_CONSENT", message: 'Tick "Include pupil details" first.' } },
    });
    const request = vi.fn().mockRejectedValue(err);
    render(<HandoffControl policy={ON} pupilData request={request} onImported={vi.fn()} />);
    pickOption(trigger(), "copy");
    expect(await screen.findByRole("alert")).toHaveTextContent('Tick "Include pupil details" first.');
    expect(open).not.toHaveBeenCalled();
    expect(request).toHaveBeenCalledWith({ mode: "prompt", pupilConsent: false });
  });

  it("pupil-data panels offer 'Include pupil details' (unticked) only when the school allows it", async () => {
    const request = vi.fn().mockResolvedValue({ success: true, handoff: { prompt: "p", expects: "json" } });
    const { rerender } = render(<HandoffControl idPrefix="pd" policy={ON} pupilData request={request} onImported={vi.fn()} />);
    const box = screen.getByTestId("pd-consent") as HTMLInputElement;
    expect(box.checked).toBe(false);
    fireEvent.click(box);
    pickOption(trigger(), "copy");
    await waitFor(() => expect(request).toHaveBeenCalledWith({ mode: "prompt", pupilConsent: true }));

    rerender(<HandoffControl idPrefix="pd" policy={POLICY({ handoff: true, pupilNames: "never" })} pupilData request={request} onImported={vi.fn()} />);
    expect(screen.queryByTestId("pd-consent")).toBeNull();
  });
});

describe("hand-off helpers", () => {
  it("plans prefill links, copies for long prompts, and labels pasted answers", () => {
    expect(handoffPlan("chatgpt", "hi")).toEqual({ url: "https://chatgpt.com/?q=hi", copy: false, prefilled: true });
    expect(handoffPlan("claude", "y".repeat(PREFILL_MAX + 1))).toEqual({ url: "https://claude.ai/new", copy: true, prefilled: false });
    expect(handoffPlan("copy", "hi")).toEqual({ url: null, copy: true, prefilled: false });
    render(<AiAnsweredBy ai={{ route: "handoff", reason: "HANDOFF" }} />);
    expect(screen.getByTestId("ai-answered-by")).toHaveTextContent("via your own AI (pasted)");
  });
});

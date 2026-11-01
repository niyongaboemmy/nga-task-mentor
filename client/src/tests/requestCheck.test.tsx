import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";

/**
 * TMCode's request check on Task Mentor's side (nga-tmcode reports/TMCode prompt interpreter
 * layer.md): the teacher's stage pin and raw-prompt choice in both layers, the Prompt Problem
 * editor (Industrial assignments only), ai_help parsing, and the activity tab's requests trend.
 */

vi.mock("../hooks/useAiAccess", () => ({ useAiPolicy: () => ({ policy: null, loading: false }) }));
const get = vi.fn();
vi.mock("../utils/axiosConfig", () => ({ default: { get: (...a: unknown[]) => get(...a) }, API_BASE_URL: "" }));

import { AiLayerOptions } from "../components/ai/AiControls";
import { AI_HELP_DEFAULTS, aiHelpOf, type AiHelp, type AiMode } from "../services/aiApi";
import { requestTrend } from "../components/Projects/grading/ActivityPane";
import { RequestCheckMetrics } from "../pages/Admin/AiSettingsPage";

function Harness({ mode, quiz, onHelp }: { mode: AiMode; quiz?: boolean; onHelp?: (h: AiHelp) => void }) {
  const [help, setHelp] = useState<AiHelp>(aiHelpOf(null));
  return (
    <AiLayerOptions
      mode={mode}
      quiz={quiz}
      idPrefix="t"
      help={help}
      onHelp={(h) => {
        setHelp(h);
        onHelp?.(h);
      }}
      ownTools={false}
      onOwnTools={() => undefined}
    />
  );
}

describe("ai_help parsing", () => {
  it("defaults: auto stage, metadata only, no Prompt Problem", () => {
    expect(aiHelpOf(null)).toEqual(AI_HELP_DEFAULTS);
    expect(aiHelpOf({ interpreter: "always" }).interpreter).toBe("auto");
  });
  it("reads a stored Prompt Problem", () => {
    const h = aiHelpOf(JSON.stringify({ interpreter: "hint", show_prompts: true, prompt_problem: { language: "javascript", examples: [{ input: "f(1)", output: "2" }] } }));
    expect(h).toMatchObject({ interpreter: "hint", show_prompts: true, prompt_problem: { language: "javascript", entry: "solution.js", examples: [{ input: "f(1)", output: "2" }], hidden: [], hints: true } });
  });
});

describe("the request check controls", () => {
  it("Learning: the coach's stage and the raw-prompt choice; no Prompt Problem", () => {
    const onHelp = vi.fn();
    render(<Harness mode="hints" onHelp={onHelp} />);
    expect(screen.getByTestId("t-ai-request-check")).toHaveTextContent(/never writes the request/);
    fireEvent.change(screen.getByTestId("t-ai-interpreter"), { target: { value: "strip" } });
    expect(onHelp).toHaveBeenLastCalledWith(expect.objectContaining({ interpreter: "strip" }));
    fireEvent.click(screen.getByTestId("t-ai-show-prompts"));
    expect(onHelp).toHaveBeenLastCalledWith(expect.objectContaining({ show_prompts: true }));
    expect(screen.queryByTestId("t-ai-prompt-problem")).toBeNull();
  });
  it("Industrial assignment: a Prompt Problem with shown and hidden examples", () => {
    const onHelp = vi.fn();
    render(<Harness mode="full" onHelp={onHelp} />);
    fireEvent.click(screen.getByTestId("t-pp-toggle"));
    fireEvent.change(screen.getByTestId("t-pp-shown-input-0"), { target: { value: "is_even(4)" } });
    fireEvent.change(screen.getByTestId("t-pp-shown-output-0"), { target: { value: "True" } });
    fireEvent.click(screen.getByTestId("t-pp-add-hidden"));
    fireEvent.change(screen.getByTestId("t-pp-hidden-input-0"), { target: { value: "is_even(7)" } });
    fireEvent.change(screen.getByTestId("t-pp-hidden-output-0"), { target: { value: "False" } });
    expect(onHelp).toHaveBeenLastCalledWith(expect.objectContaining({ prompt_problem: expect.objectContaining({ language: "python", entry: "solution.py", examples: [{ input: "is_even(4)", output: "True" }], hidden: [{ input: "is_even(7)", output: "False" }] }) }));
    fireEvent.change(screen.getByTestId("t-pp-language"), { target: { value: "javascript" } });
    expect(onHelp).toHaveBeenLastCalledWith(expect.objectContaining({ prompt_problem: expect.objectContaining({ language: "javascript", entry: "solution.js" }) }));
    fireEvent.click(screen.getByTestId("t-pp-toggle"));
    expect(onHelp).toHaveBeenLastCalledWith(expect.objectContaining({ prompt_problem: null }));
  });
  it("a quiz has no Prompt Problem; No AI shows nothing", () => {
    const { unmount } = render(<Harness mode="full" quiz />);
    expect(screen.queryByTestId("t-ai-prompt-problem")).toBeNull();
    expect(screen.getByTestId("t-ai-request-check")).toBeInTheDocument();
    unmount();
    render(<Harness mode="off" />);
    expect(screen.queryByTestId("t-ai-request-check")).toBeNull();
  });
});

describe("the activity tab's requests trend", () => {
  it("completeness over time, oldest first, with what the student did", () => {
    const ev = (t: number, completeness: number, outcome: string) => ({ kind: "ai", action: "intent", t, data: { completeness, outcome } }) as never;
    const r = requestTrend([ev(3, 0.83, "accepted"), ev(1, 0.33, "edited"), ev(2, 0.5, "as-is"), { kind: "ai", action: "chat", t: 4 } as never]);
    expect(r).toEqual({ points: [0.33, 0.5, 0.83], checked: 3, confirmed: 2, edited: 1 });
  });
});

describe("the admin's A/B panel", () => {
  it("shows the card arm against the holdout and refetches for another period", async () => {
    const arm = (users: number, accept: number | null) => ({ users, questions: 12, cards: 9, coach: 0, accept_rate: accept, edit_rate: 0.2, as_is_rate: 0.1, ms_p50: 1200, ms_p95: 3400, completeness_mean: 0.66, runs: 10, run_pass_rate: 0.7 });
    get.mockResolvedValue({ data: { arms: { card: arm(20, 0.6), holdout: { ...arm(4, null), cards: 0 } }, languages: { en: 6, mixed: 3 }, stages: { full: 7, hint: 2 }, holdout_pct: 15 } });
    render(<RequestCheckMetrics />);
    expect(await screen.findByTestId("request-check-arm-card")).toHaveTextContent("60%");
    expect(screen.getByTestId("request-check-arm-holdout")).toHaveTextContent("Holdout");
    expect(screen.getByTestId("request-check-metrics")).toHaveTextContent("15% of students");
    expect(screen.getByTestId("request-check-metrics")).toHaveTextContent("mixed 3");
    fireEvent.click(screen.getByTestId("request-check-days-7"));
    expect(get).toHaveBeenLastCalledWith("/tmcode/ai/interpret/metrics", { params: { days: 7 } });
  });
});

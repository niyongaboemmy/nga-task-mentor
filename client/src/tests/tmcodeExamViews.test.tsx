import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

/** TMCode exam surfaces on the web: teacher live sessions (E4), submit warning (E10), policy summary (E12). */

const practicals = { quizSessions: vi.fn() };
vi.mock("../services/practicalsApi", async (orig) => ({
  ...(await orig<typeof import("../services/practicalsApi")>()),
  practicalsApi: new Proxy({}, { get: (_t, k: string) => (...a: unknown[]) => (practicals as any)[k](...a) }),
}));

import TmcodeSessionsPanel from "../components/Quizzes/TmcodeSessionsPanel";
import { tmcodeSubmitWarning } from "../utils/tmcodeSubmitWarning";
import { tmcodePolicySummary } from "../utils/tmcodePolicySummary";

beforeEach(() => practicals.quizSessions.mockReset());

const session = (over: Record<string, unknown> = {}) => ({
  student: { id: 1, name: "Ama" },
  submission_id: 11,
  session_id: "s-1",
  status: "active",
  mode: "monitored",
  started_at: new Date().toISOString(),
  last_heartbeat: new Date().toISOString(),
  last_sync: new Date(Date.now() - 60_000).toISOString(),
  submitted_at: null,
  current_task: { question_id: 5, title: "Add two numbers" },
  focus: "in",
  app_version: "0.12.0",
  os: "mac",
  flags: [],
  ...over,
});

describe("TmcodeSessionsPanel", () => {
  it("lists each student's status, task, version and explained flags", async () => {
    practicals.quizSessions.mockResolvedValue({
      quiz: { id: 3, title: "Exam" },
      generated_at: new Date().toISOString(),
      stale_after_s: 90,
      counts: { total: 2, active: 1, offline: 1, submitted: 0, flagged: 1 },
      sessions: [
        session(),
        session({
          student: { id: 2, name: "Bo" },
          session_id: "s-2",
          status: "offline",
          flags: [{ rule: "journal_tampered", severity: "high", at: null, question_id: 5, explanation: "A saved snapshot didn't match its signature." }],
        }),
      ],
      explanations: {},
    });
    render(<TmcodeSessionsPanel quizId={3} />);
    expect(await screen.findByTestId("tmcode-sessions-panel")).toBeInTheDocument();
    expect(screen.getByTestId("tmcode-sessions-counts")).toHaveTextContent("1 active · 1 offline · 0 submitted · 1 flagged");
    const rows = screen.getAllByTestId("tmcode-session-row");
    expect(rows[0]).toHaveTextContent("Ama");
    expect(rows[0]).toHaveTextContent("Active");
    expect(rows[0]).toHaveTextContent("Add two numbers");
    expect(rows[0]).toHaveTextContent("v0.12.0");
    expect(rows[1]).toHaveTextContent("Offline");
    expect(rows[1]).toHaveTextContent("journal_tampered: A saved snapshot didn't match its signature.");
    expect(practicals.quizSessions).toHaveBeenCalledWith(3);
  });

  it("renders nothing when nobody opened the quiz in TMCode", async () => {
    practicals.quizSessions.mockResolvedValue({ quiz: { id: 3, title: "x" }, generated_at: "", stale_after_s: 90, counts: {}, sessions: [], explanations: {} });
    const { container } = render(<TmcodeSessionsPanel quizId={3} />);
    await waitFor(() => expect(practicals.quizSessions).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

});

describe("tmcodeSubmitWarning", () => {
  it("warns with the last save while the attempt is open in TMCode", () => {
    const w = tmcodeSubmitWarning(
      { submission_id: 1, status: "active", active: true, last_saved_at: "2026-10-10T10:41:00Z", last_heartbeat: null, app_version: "0.12.0" },
      "en-GB",
    );
    expect(w).toMatch(/^Coding questions are open in TMCode: last saved \d{2}:\d{2}\./);
    expect(w).toMatch(/Submitting here ends the attempt/);
  });
  it("says so when TMCode isn't connected or saved nothing", () => {
    expect(tmcodeSubmitWarning({ submission_id: 1, status: "offline", active: false, last_saved_at: null, last_heartbeat: null, app_version: null })).toMatch(
      /not connected now\): nothing saved from TMCode yet/,
    );
  });
  it("is quiet without a session or once submitted", () => {
    expect(tmcodeSubmitWarning(null)).toBeNull();
    expect(tmcodeSubmitWarning({ submission_id: 1, status: "submitted", active: false, last_saved_at: null, last_heartbeat: null, app_version: null })).toBeNull();
  });
});

describe("tmcodePolicySummary", () => {
  const base = { mode: "monitored", intelligence: "basic", paste: "internal_only", terminal: "off", internet_in_preview: false, allow_offline_grace_minutes: 10 } as const;
  it("describes the defaults the way a student meets them", () => {
    const lines = tmcodePolicySummary(base, "tmcode_required");
    expect(lines[0]).toMatch(/desktop app only/);
    expect(lines).toContain("There is no terminal.");
    expect(lines).toContain("The debugger is off; they can still run their code.");
    expect(lines.join(" ")).toMatch(/up to 10 min/);
  });
  it("follows the debugger toggle, and never promises a full terminal outside practice", () => {
    expect(tmcodePolicySummary({ ...base, debugger: true }, "tmcode_optional")).toContain("They can run and debug (breakpoints, stepping).");
    expect(tmcodePolicySummary({ ...base, terminal: "full" }, "tmcode_optional")).toContain("There is no terminal.");
    expect(tmcodePolicySummary({ ...base, mode: "practice", terminal: "full" }, "tmcode_optional")).toContain("They get a full terminal on their computer.");
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ActivityPane from "../components/Projects/grading/ActivityPane";

/** A submission's Activity tab: whole-log counts of copying, pasting, AI and time away; older entries on demand. */

const activity = vi.fn();
vi.mock("../services/projectsApi", async (orig) => ({
  ...(await orig<typeof import("../services/projectsApi")>()),
  projectsApi: { activity: (...a: unknown[]) => activity(...a) },
}));

const t = Date.UTC(2026, 9, 25, 9, 0, 0);
const you = { type: "you" as const };
const summary = {
  total: 230,
  ai_events: 4,
  ai_tools: [
    { by: "TMCode AI", count: 3 },
    { by: "terminal: claude", count: 1 },
  ],
  ai_chars: 0,
  ai_blocked: 1,
  copies: 12,
  cuts: 3,
  pastes: 18,
  drops: 2,
  pastes_inside: 10,
  pastes_outside: 7,
  pastes_from_ai: 3,
  chars_pasted_outside: 1520,
  files_copied: 2,
  files_cut: 1,
  files_imported: 4,
  terminal_commands: 9,
  runs: 6,
  outside_changes: 1,
  away_count: 3,
  away_seconds: 750,
  by_kind: { file: 40 },
  first_at: t - 86_400_000,
  last_at: t,
};

beforeEach(() => {
  activity.mockReset();
});

describe("ActivityPane", () => {
  it("shows the whole log's counts and loads older entries", async () => {
    activity
      .mockResolvedValueOnce({
        events: [
          { t, kind: "clipboard", action: "paste", text: "Pasted 3 lines into app.js (from outside TMCode)", data: { origin: "outside", chars: 60 }, actor: you },
          { t: t - 1000, kind: "editor", action: "away", text: "Away from TMCode for 4 min", data: { seconds: 240 }, actor: you },
        ],
        summary,
        next_before: 77,
      })
      .mockResolvedValueOnce({
        events: [{ t: t - 90_000_000, kind: "clipboard", action: "copy", text: "Copied 1 line in main.py", actor: you }],
        summary,
        next_before: null,
      });
    render(<ActivityPane projectId={5} />);
    expect(await screen.findByTestId("activity-clipboard")).toHaveTextContent("12 · 3 · 20");
    expect(screen.getByTestId("activity-pastes-outside")).toHaveTextContent("7");
    expect(screen.getByTestId("activity-pastes-outside")).toHaveTextContent("1,520 chars");
    expect(screen.getByTestId("activity-files-imported")).toHaveTextContent("4");
    expect(screen.getByTestId("activity-away")).toHaveTextContent("3× · 13 min");
    expect(screen.getByTestId("activity-ai-tools")).toHaveTextContent("terminal: claude (1)");

    // Time away sits under "Away, outside changes & more".
    await userEvent.click(screen.getByTestId("activity-filter-other"));
    expect(screen.getByText("Away from TMCode for 4 min")).toBeInTheDocument();
    expect(screen.queryByText(/Pasted 3 lines/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByTestId("activity-filter-all"));

    // A paste's details say where it came from in words.
    await userEvent.click(screen.getByText(/Pasted 3 lines/));
    expect(screen.getByText("outside TMCode (another app)")).toBeInTheDocument();

    await userEvent.click(screen.getByTestId("activity-load-older"));
    await waitFor(() => expect(screen.getByText("Copied 1 line in main.py")).toBeInTheDocument());
    expect(activity).toHaveBeenLastCalledWith(5, 1000, 77);
    expect(screen.queryByTestId("activity-load-older")).not.toBeInTheDocument();
  });
});

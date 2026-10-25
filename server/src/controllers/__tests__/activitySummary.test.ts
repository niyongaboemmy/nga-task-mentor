import { summarizeActivity } from "../tmcodeActivity.controller";

/** The teacher's activity overview counts every kind of copy, paste and AI use (merged entries by `count`). */

const you = { type: "you" as const };
const ev = (e: Record<string, unknown>) => ({ t: 1_000, actor: you, text: "x", user_id: 1, ...e }) as never;

describe("summarizeActivity", () => {
  it("counts copies, cuts, pastes by origin, drops, files brought in, AI, runs and time away", () => {
    const s = summarizeActivity([
      ev({ kind: "clipboard", action: "copy", count: 3 }),
      ev({ kind: "clipboard", action: "cut" }),
      ev({ kind: "clipboard", action: "paste", data: { origin: "inside", chars: 10 } }),
      ev({ kind: "clipboard", action: "paste", data: { origin: "outside", chars: 40 }, count: 2 }),
      ev({ kind: "clipboard", action: "paste", data: { origin: "ai", chars: 5 }, ai: { by: "TMCode AI", how: "pasted" } }),
      ev({ kind: "clipboard", action: "drop", data: { origin: "outside", chars: 23 } }),
      ev({ kind: "clipboard", action: "copy-files", data: { count: 2 } }),
      ev({ kind: "clipboard", action: "cut-files", data: { count: 1 } }),
      ev({ kind: "file", action: "import", data: { count: 4 } }),
      ev({ kind: "ai", action: "blocked", data: { tool: "claude" }, ai: { by: "terminal: claude", how: "blocked" } }),
      ev({ kind: "ai", action: "chat", ai: { by: "TMCode AI", how: "asked" } }),
      ev({ kind: "terminal", action: "command", count: 5 }),
      ev({ kind: "run", action: "run" }),
      ev({ kind: "file", action: "outside-change" }),
      ev({ kind: "editor", action: "away", data: { seconds: 90 }, t: 500 }),
      ev({ kind: "editor", action: "away", data: { seconds: 40 }, t: 2_000 }),
    ]);
    expect(s).toMatchObject({
      copies: 3,
      cuts: 1,
      pastes: 4,
      drops: 1,
      pastes_inside: 1,
      pastes_outside: 3,
      pastes_from_ai: 1,
      chars_pasted_outside: 40 * 2 + 23,
      files_copied: 2,
      files_cut: 1,
      files_imported: 4,
      ai_events: 3,
      ai_blocked: 1,
      terminal_commands: 5,
      runs: 1,
      outside_changes: 1,
      away_count: 2,
      away_seconds: 130,
      first_at: 500,
      last_at: 2_000,
    });
    expect(s.ai_tools).toEqual([
      { by: "TMCode AI", count: 2 },
      { by: "terminal: claude", count: 1 },
    ]);
  });

  it("is empty for no events", () => {
    expect(summarizeActivity([])).toMatchObject({ total: 0, copies: 0, pastes: 0, first_at: null, last_at: null });
  });
});

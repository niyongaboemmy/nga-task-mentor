import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { KindBadge, LanguageBadge, LinkStatusBadge, LiveDot, LiveIndicator, SyncBadge } from "../components/Projects/ProjectBadges";
import LivePanel from "../components/Projects/LivePanel";
import { formatBytes, freezeTarget, frozenProjectHref, isGithubRepoUrl, presenceLine, timeAgo, submitPreview } from "../components/Projects/projectFormat";
import { normalizePresence } from "../services/projectsApi";

describe("Project status badges", () => {
  it("labels link status with the frozen revision or commit", () => {
    const { rerender } = render(<LinkStatusBadge status="linked" />);
    expect(screen.getByTestId("link-status")).toHaveTextContent("Linked");
    rerender(<LinkStatusBadge status="submitted" revisionNumber={3} />);
    expect(screen.getByTestId("link-status")).toHaveTextContent("Submitted · rev 3");
    rerender(<LinkStatusBadge status="submitted" gitCommit="3f2a9c1d8e7b" />);
    expect(screen.getByTestId("link-status")).toHaveTextContent("Submitted · 3f2a9c1");
  });

  it("names the project kind and language", () => {
    render(
      <>
        <KindBadge kind="github" />
        <KindBadge kind="tm" />
        <LanguageBadge language="cpp" />
        <LanguageBadge language="haskell" />
        <LanguageBadge language={null} />
      </>,
    );
    expect(screen.getAllByTestId("kind-badge").map((b) => b.textContent)).toEqual(["GitHub", "Task Mentor"]);
    expect(screen.getByText("C++")).toBeInTheDocument();
    expect(screen.getByText("haskell")).toBeInTheDocument();
  });

  it("shows each TMCode sync state", () => {
    const { rerender, container } = render(<SyncBadge sync="synced" />);
    expect(screen.getByTestId("sync-badge")).toHaveTextContent("Synced");
    rerender(<SyncBadge sync="local_changes" />);
    expect(screen.getByTestId("sync-badge")).toHaveTextContent("Local changes");
    rerender(<SyncBadge sync="remote_newer" />);
    expect(screen.getByTestId("sync-badge")).toHaveTextContent("Newer in Task Mentor");
    rerender(<SyncBadge sync="conflict" />);
    expect(screen.getByTestId("sync-badge")).toHaveTextContent("Conflict");
    rerender(<SyncBadge sync={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("announces the live stream state", () => {
    const { rerender } = render(<LiveIndicator status="live" />);
    expect(screen.getByRole("status")).toHaveTextContent("Live");
    rerender(<LiveIndicator status="reconnecting" onRetry={() => {}} />);
    expect(screen.getByRole("status")).toHaveTextContent("Reconnecting…");
    expect(screen.getByRole("button", { name: "Retry now" })).toBeInTheDocument();
    rerender(<LiveIndicator status="offline" />);
    expect(screen.getByRole("status")).toHaveTextContent("Offline");
  });

  it("labels the live dot for screen readers", () => {
    render(<LiveDot live />);
    expect(screen.getByRole("img", { name: "Open in TMCode now" })).toBeInTheDocument();
  });
});

describe("Live panel", () => {
  const now = Date.parse("2026-10-06T10:00:00Z");
  const presence = normalizePresence({
    project_id: 1,
    user_id: 2,
    device_id: "mac",
    device_name: "MacBook",
    state: { open: true, file: "src/main.cpp", dirty: ["a", "b"], branch: "main", ahead: 1, sync: "local_changes" },
    last_seen_at: new Date(now - 5000).toISOString(),
  });

  it("summarises a presence row in one line", () => {
    expect(presenceLine(presence)).toBe("Open in TMCode on MacBook · editing src/main.cpp · 2 unsaved · branch main ↑1");
    expect(presenceLine(presence, { short: true })).toContain("editing main.cpp");
  });

  it("shows live devices, and the last-seen time once they close", async () => {
    const { rerender } = render(<LivePanel presence={[presence]} status="live" now={now} />);
    expect(screen.getByTestId("presence-line")).toHaveTextContent("Open in TMCode on MacBook · editing src/main.cpp");
    expect(screen.getByText("Open in TMCode now")).toBeInTheDocument();

    rerender(<LivePanel presence={[{ ...presence, state: { ...presence.state, open: false } }]} status="reconnecting" now={now} />);
    // The row leaves with an exit animation.
    await waitFor(() => expect(screen.queryByTestId("presence-line")).toBeNull());
    expect(screen.getByText("Not open in TMCode")).toBeInTheDocument();
    expect(screen.getByText("Last open just now.")).toBeInTheDocument();
    expect(screen.getByTestId("live-indicator")).toHaveTextContent("Reconnecting…");
  });
});

describe("project formatting helpers", () => {
  it("formats sizes and relative times", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(6120)).toBe("6.0 KB");
    expect(formatBytes(50 * 1024 * 1024)).toBe("50 MB");
    const now = Date.parse("2026-10-06T10:00:00Z");
    expect(timeAgo(new Date(now - 5 * 60_000).toISOString(), now)).toBe("5 min ago");
    expect(timeAgo(null)).toBe("never");
  });

  it("validates GitHub repository URLs", () => {
    expect(isGithubRepoUrl("https://github.com/johndoe/portfolio")).toBe(true);
    expect(isGithubRepoUrl("https://github.com/johndoe/portfolio.git")).toBe(true);
    expect(isGithubRepoUrl("http://github.com/a/b")).toBe(false);
    expect(isGithubRepoUrl("https://gitlab.com/a/b")).toBe(false);
  });

  it("says what a submission freezes and where the teacher opens it", () => {
    expect(freezeTarget({ kind: "tm", head: null, git: null })).toBeNull();
    expect(freezeTarget({ kind: "tm", head: { number: 3 } as never, git: null })).toBe("version 3");
    expect(freezeTarget({ kind: "github", head: null, git: { head_commit: "abcdef123456" } })).toBe("commit abcdef1");
    expect(frozenProjectHref({ link: { revision_id: 9003 } as never, project: { id: 1, kind: "tm" } as never })).toBe("/projects/1?tab=files&rev=9003");
    expect(frozenProjectHref({ link: {} as never, project: { id: 2, kind: "github" } as never })).toBe("/projects/2?tab=git");
  });
});

describe("submitPreview (web Submit)", () => {
  const now = new Date("2026-10-10T14:30:00Z").getTime();
  const live = (over: Record<string, unknown>) => ({
    project_id: 1,
    user_id: 1,
    device_id: "d1",
    online: true,
    last_seen_at: new Date(now - 10_000).toISOString(),
    state: { open: true },
    ...over,
  });
  it("names the version and when it was saved", () => {
    const r = submitPreview({ kind: "tm", head: { number: 4, created_at: "2026-10-10T14:02:00Z" } as never, git: null, presence: [] }, now);
    expect(r.what).toMatch(/^Submitting version 4, saved \d{1,2}[:.]02/);
    expect(r.unsavedOn).toEqual([]);
  });
  it("warns about live TMCode windows with unsaved changes, by device", () => {
    const r = submitPreview(
      {
        kind: "tm",
        head: null,
        git: null,
        presence: [
          live({ device_name: "MacBook", state: { open: true, dirty: ["main.py"] } }),
          live({ device_id: "d2", state: { open: true, device_name: "Lab PC", changes: 2 } }),
          live({ device_id: "d3", device_name: "Old", last_seen_at: new Date(now - 600_000).toISOString(), state: { open: true, dirty: 3 } }),
          live({ device_id: "d4", device_name: "Clean", state: { open: true, dirty: 0 } }),
        ] as never,
      },
      now,
    );
    expect(r.what).toBeNull();
    expect(r.unsavedOn).toEqual(["MacBook", "Lab PC"]);
  });
});

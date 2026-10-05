import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { first_name: "Ada", last_name: "L", systems: [] }, isAuthenticated: false, logoutUser: vi.fn() }),
}));
vi.mock("../hooks/usePermissions", () => ({ usePermissions: () => ({ can: () => false }) }));
vi.mock("../components/ThemeToggle", () => ({ ThemeToggle: () => null }));
vi.mock("../components/Layout/SystemsMenu", () => ({ default: () => null }));
vi.mock("../components/Layout/AcademicPeriodSwitcher", () => ({ default: () => null }));

import {
  detectOs,
  fetchLatestRelease,
  releaseNoteLines,
  RELEASE_CACHE_MS,
  TMCODE_DOWNLOADS,
  TMCODE_LATEST_API,
} from "../utils/tmcodeRelease";
import TmcodeDownloadPage from "../pages/TmcodeDownloadPage";
import TopBar from "../components/Layout/TopBar";

// Node's own localStorage shadows jsdom's in this setup: use a Map-backed one.
class MemoryStorage {
  private store = new Map<string, string>();
  get length() {
    return this.store.size;
  }
  key(i: number) {
    return Array.from(this.store.keys())[i] ?? null;
  }
  getItem(k: string) {
    return this.store.has(k) ? this.store.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.store.set(k, String(v));
  }
  removeItem(k: string) {
    this.store.delete(k);
  }
  clear() {
    this.store.clear();
  }
}
const storage = new MemoryStorage();
vi.stubGlobal("localStorage", storage);

const RELEASE = {
  tag_name: "v0.1.0",
  published_at: "2026-10-06T08:00:00Z",
  body: "## Highlights\n- Run **Python** and [Java](https://x)\n- <script>alert(1)</script>Web preview\n",
  html_url: "https://github.com/niyongaboemmy/nga-tmcode/releases/tag/v0.1.0",
};

const okFetch = () =>
  vi.fn(async () => ({ ok: true, json: async () => RELEASE }) as unknown as Response);

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});
afterEach(() => {
  // undo per-test fetch/navigator stubs, keep the storage stub
  vi.unstubAllGlobals();
  vi.stubGlobal("localStorage", storage);
});

describe("detectOs", () => {
  it.each([
    [{ userAgentData: { platform: "macOS", mobile: false } }, "mac"],
    [{ userAgentData: { platform: "Windows", mobile: false } }, "windows"],
    [{ userAgentData: { platform: "Linux", mobile: false } }, "linux"],
    [{ userAgentData: { platform: "Android", mobile: true } }, "mobile"],
    [{ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) Safari/605", maxTouchPoints: 0 }, "mac"],
    [{ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) Safari/605", maxTouchPoints: 5 }, "mobile"],
    [{ userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Firefox/131" }, "windows"],
    [{ userAgent: "Mozilla/5.0 (X11; Ubuntu; Linux x86_64) Firefox/131" }, "linux"],
    [{ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)" }, "mobile"],
    [{ userAgent: "Mozilla/5.0 (Linux; Android 14) Mobile" }, "mobile"],
    [{ userAgent: "SomethingElse/1.0" }, "unknown"],
  ])("%j → %s", (nav, os) => {
    expect(detectOs(nav)).toBe(os);
  });
});

describe("fetchLatestRelease", () => {
  it("fetches once and serves the cache for an hour", async () => {
    const f = okFetch();
    const now = 1_000_000;
    expect((await fetchLatestRelease(f, now))?.tag_name).toBe("v0.1.0");
    expect(f).toHaveBeenCalledWith(TMCODE_LATEST_API, expect.any(Object));
    await fetchLatestRelease(f, now + RELEASE_CACHE_MS - 1);
    expect(f).toHaveBeenCalledTimes(1);
    await fetchLatestRelease(f, now + RELEASE_CACHE_MS + 1);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("resolves null on rate limit, network failure or a bad body (and caches nothing)", async () => {
    const limited = vi.fn(async () => ({ ok: false, status: 403, json: async () => ({}) }) as unknown as Response);
    expect(await fetchLatestRelease(limited)).toBeNull();
    expect(await fetchLatestRelease(vi.fn(async () => Promise.reject(new Error("offline"))))).toBeNull();
    expect(await fetchLatestRelease(vi.fn(async () => ({ ok: true, json: async () => ({}) }) as unknown as Response))).toBeNull();
    expect(localStorage.getItem("tmcode_latest_release_v1")).toBeNull();
  });
});

describe("releaseNoteLines", () => {
  it("turns Markdown into plain headings/bullets with no HTML or link syntax", () => {
    expect(releaseNoteLines(RELEASE.body)).toEqual([
      { kind: "heading", text: "Highlights" },
      { kind: "bullet", text: "Run Python and Java" },
      { kind: "bullet", text: "alert(1)Web preview" },
    ]);
  });
});

function renderPage() {
  return render(
    <MemoryRouter>
      <TmcodeDownloadPage />
    </MemoryRouter>,
  );
}

describe("TmcodeDownloadPage", () => {
  it("still offers every fixed download link when the GitHub API fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));
    renderPage();
    await waitFor(() => expect(screen.getByTestId("tmcode-version")).toHaveTextContent("Latest version"));
    const hrefs = Array.from(document.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    for (const d of TMCODE_DOWNLOADS) expect(hrefs).toContain(d.url);
    expect(screen.queryByTestId("tmcode-notes")).toBeNull();
  });

  it("shows the version, date and plain-text notes when GitHub answers", async () => {
    vi.stubGlobal("fetch", okFetch());
    renderPage();
    await waitFor(() => expect(screen.getByTestId("tmcode-version")).toHaveTextContent(/Version 0\.1\.0 · released/));
    expect(screen.getByTestId("tmcode-notes")).toHaveTextContent("Run Python and Java");
    expect(document.querySelector("script")).toBeNull();
  });

  it("has a big download button for the visitor's OS", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" });
    renderPage();
    const primary = await screen.findByTestId("tmcode-primary-download");
    expect(primary).toHaveTextContent("Download for Windows");
    expect(primary).toHaveAttribute("href", expect.stringContaining("TMCode-Windows-Setup.exe"));
  });

  it("on a phone says it's a desktop app and still lists all links", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)" });
    renderPage();
    expect(await screen.findByTestId("tmcode-mobile-note")).toBeInTheDocument();
    expect(screen.queryByTestId("tmcode-primary-download")).toBeNull();
    expect(screen.getByTestId("tmcode-downloads").querySelectorAll("a")).toHaveLength(TMCODE_DOWNLOADS.length);
  });
});

describe("app header", () => {
  it("has a Get TMCode button linking to /tmcode", () => {
    render(
      <MemoryRouter>
        <TopBar onOpenMobileMenu={() => {}} />
      </MemoryRouter>,
    );
    const btn = screen.getByTestId("get-tmcode-button");
    expect(btn).toHaveAttribute("href", "/tmcode");
    expect(btn).toHaveAccessibleName("Get TMCode");
  });
});

describe("TmcodeDownloadPage hides app-level extras", () => {
  it("turns on focus mode so the Task Mentor install card doesn't cover the page", async () => {
    const { isFocusModeActive } = await import("../utils/focusMode");
    const { default: Page } = await import("../pages/TmcodeDownloadPage");
    const { MemoryRouter } = await import("react-router-dom");
    const { render } = await import("@testing-library/react");
    const React = await import("react");
    const view = render(React.createElement(MemoryRouter, null, React.createElement(Page)));
    expect(isFocusModeActive()).toBe(true);
    view.unmount();
    expect(isFocusModeActive()).toBe(false);
  });
});


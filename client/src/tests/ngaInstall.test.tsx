import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

// Fresh module state per test (the install prompt keeps module-level state).
const load = async () => {
  vi.resetModules();
  return import("../pwa/ngaInstall");
};

const setUrl = (path: string) => window.history.replaceState(null, "", path);

// Node 25's own (method-less) global localStorage shadows jsdom's; give the
// component a working in-memory one.
const memoryStorage = () => {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => void data.set(k, String(v)),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
    key: (i: number) => Array.from(data.keys())[i] ?? null,
    get length() {
      return data.size;
    },
  };
};

describe("NgaInstallPrompt (install this app when opened from the installed NGA app)", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStorage());
    vi.stubGlobal("sessionStorage", memoryStorage());
    setUrl("/");
  });

  it("stays hidden for normal visits", async () => {
    const m = await load();
    m.initNgaInstall();
    render(<m.NgaInstallPrompt appName="Task Mentor" />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("asks immediately when launched from the NGA app, and removes the marker from the address", async () => {
    setUrl("/dashboard?nga_launch=app&tab=1");
    const m = await load();
    m.initNgaInstall();
    expect(window.location.search).toBe("?tab=1");
    render(<m.NgaInstallPrompt appName="Task Mentor" />);
    expect(screen.getByRole("dialog", { name: "Install Task Mentor as an app" })).toBeInTheDocument();
    // No browser prompt captured yet -> step-by-step instructions.
    expect(screen.getByRole("list")).toBeInTheDocument();
  });

  it("keeps an OAuth callback URL intact for the callback page", async () => {
    setUrl("/sso/callback?code=abc&state=s&nga_launch=app");
    const m = await load();
    m.initNgaInstall();
    expect(window.location.search).toContain("code=abc");
    expect(sessionStorage.getItem("nga.launchedFromApp")).toBe("1");
  });

  it("offers the browser's one-click install and stops asking once accepted", async () => {
    setUrl("/?nga_launch=app");
    const m = await load();
    m.initNgaInstall();
    render(<m.NgaInstallPrompt appName="Task Mentor" />);

    const prompt = vi.fn().mockResolvedValue(undefined);
    const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
      prompt,
      userChoice: Promise.resolve({ outcome: "accepted" }),
    });
    act(() => {
      window.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Install Task Mentor" }));
    });
    expect(prompt).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(localStorage.getItem("nga.appInstalled")).toBe("1");
  });

  it("'Continue in the browser' dismisses it for this session", async () => {
    setUrl("/?nga_launch=app");
    const m = await load();
    m.initNgaInstall();
    const { unmount } = render(<m.NgaInstallPrompt appName="Task Mentor" />);
    fireEvent.click(screen.getByRole("button", { name: "Continue in the browser" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    unmount();
    render(<m.NgaInstallPrompt appName="Task Mentor" />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

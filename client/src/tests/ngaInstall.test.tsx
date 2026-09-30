import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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

const CHROME_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36";

describe("NgaInstallPrompt — asks on load until the app is installed", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStorage());
    vi.stubGlobal("sessionStorage", memoryStorage());
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(CHROME_UA);
    setUrl("/");
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete (navigator as any).getInstalledRelatedApps;
  });

  it("shows automatically on a normal browser load", async () => {
    const m = await load();
    m.initNgaInstall();
    render(<m.NgaInstallPrompt appName="Task Mentor" />);
    expect(await screen.findByRole("dialog", { name: "Install Task Mentor as an app" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Install all NGA apps" })).toHaveAttribute("href", "https://mis.amashuri.com/apps");
  });

  it("stays quiet when the browser reports the app installed here", async () => {
    (navigator as any).getInstalledRelatedApps = vi.fn().mockResolvedValue([{ platform: "webapp", url: "/manifest.webmanifest" }]);
    const m = await load();
    m.initNgaInstall();
    render(<m.NgaInstallPrompt appName="Task Mentor" />);
    await act(async () => undefined);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(localStorage.getItem("nga.appInstalled")).toBe("1");
  });

  it("'Not now' hides the card for this browser session only", async () => {
    const m = await load();
    m.initNgaInstall();
    const { unmount } = render(<m.NgaInstallPrompt appName="Task Mentor" />);
    fireEvent.click(await screen.findByRole("button", { name: "Not now" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(sessionStorage.getItem("nga.installDismissedThisSession")).toBe("1");
    unmount();
    render(<m.NgaInstallPrompt appName="Task Mentor" />);
    await act(async () => undefined);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("clears an old 24-hour snooze so the card comes back", async () => {
    localStorage.setItem("nga.installSnoozedUntil", String(Date.now() + 20 * 3_600_000));
    const m = await load();
    m.initNgaInstall();
    expect(localStorage.getItem("nga.installSnoozedUntil")).toBeNull();
    render(<m.NgaInstallPrompt appName="Task Mentor" />);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("after 'Not now' the corner Install button stays, and reopens the card", async () => {
    const m = await load();
    m.initNgaInstall();
    render(<m.NgaInstallPrompt appName="Task Mentor" />);
    act(() => {
      window.dispatchEvent(
        Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
          prompt: vi.fn().mockResolvedValue(undefined),
          userChoice: Promise.resolve({ outcome: "dismissed" }),
        }),
      );
    });
    fireEvent.click(await screen.findByRole("button", { name: "Not now" }));
    const corner = await screen.findByRole("button", { name: /Install Task Mentor/ });
    fireEvent.click(corner);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("the NGA installer overrides 'Not now' and gets a safe way back", async () => {
    sessionStorage.setItem("nga.installDismissedThisSession", "1");
    setUrl("/?nga_install=1&return=" + encodeURIComponent("https://mis.amashuri.com/apps?step=2"));
    const m = await load();
    m.initNgaInstall();
    expect(window.location.search).toBe("");
    render(<m.NgaInstallPrompt appName="Task Mentor" />);
    await screen.findByRole("dialog");
    expect(screen.getByRole("link", { name: /back to the NGA installer/ })).toHaveAttribute("href", "https://mis.amashuri.com/apps?step=2");
  });

  it("refuses to send people to a foreign 'return' address", async () => {
    const m = await load();
    expect(m.safeReturnUrl("https://evil.example/apps")).toBeNull();
    expect(m.safeReturnUrl("http://mis.amashuri.com/apps")).toBeNull();
    expect(m.safeReturnUrl("javascript:alert(1)")).toBeNull();
    expect(m.safeReturnUrl("https://tupo.amashuri.com/app")).toBe("https://tupo.amashuri.com/app");
  });

  it("offers the browser's one-click install and stops asking once accepted", async () => {
    const m = await load();
    m.initNgaInstall();
    render(<m.NgaInstallPrompt appName="Task Mentor" />);
    await screen.findByRole("dialog");
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
      fireEvent.click(screen.getByRole("button", { name: "Install & open Task Mentor" }));
    });
    expect(prompt).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(localStorage.getItem("nga.appInstalled")).toBe("1");
  });

  it("a stale 'installed' note is dropped when the browser says the app is installable", async () => {
    localStorage.setItem("nga.appInstalled", "1"); // installed once, uninstalled later
    const m = await load();
    m.initNgaInstall();
    render(<m.NgaInstallPrompt appName="Task Mentor" />);
    await act(async () => undefined);
    expect(screen.queryByRole("dialog")).toBeNull();

    const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
      prompt: vi.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: "dismissed" }),
    });
    act(() => {
      window.dispatchEvent(event);
    });
    expect(localStorage.getItem("nga.appInstalled")).toBeNull();
    expect(await screen.findByRole("button", { name: "Install & open Task Mentor" })).toBeInTheDocument();
  });

  it("the late browser signal still respects 'Not now' (but offers the corner button)", async () => {
    sessionStorage.setItem("nga.installDismissedThisSession", "1");
    const m = await load();
    m.initNgaInstall();
    render(<m.NgaInstallPrompt appName="Task Mentor" />);
    act(() => {
      window.dispatchEvent(
        Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
          prompt: vi.fn(),
          userChoice: Promise.resolve({ outcome: "dismissed" }),
        }),
      );
    });
    await act(async () => undefined);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: /Install Task Mentor/ })).toBeInTheDocument();
  });

  it("decides purely from the inputs", async () => {
    const { shouldOffer, shouldShowInstallButton } = await load();
    const base = { standalone: false, knownInstalled: false, platform: "chromium" as const, forced: false, dismissedThisSession: false };
    expect(shouldOffer(base)).toBe(true);
    expect(shouldOffer({ ...base, standalone: true })).toBe(false);
    expect(shouldOffer({ ...base, knownInstalled: true, forced: true })).toBe(false);
    expect(shouldOffer({ ...base, platform: "firefox-other" })).toBe(false);
    expect(shouldOffer({ ...base, dismissedThisSession: true })).toBe(false);
    expect(shouldOffer({ ...base, dismissedThisSession: true, forced: true })).toBe(true);

    const btn = { standalone: false, installed: false, platform: "chromium" as const, canPrompt: true, cardOpen: false, hidden: false };
    expect(shouldShowInstallButton(btn)).toBe(true);
    expect(shouldShowInstallButton({ ...btn, canPrompt: false })).toBe(false); // Chromium: installed or not installable
    expect(shouldShowInstallButton({ ...btn, canPrompt: false, platform: "ios" })).toBe(true);
    expect(shouldShowInstallButton({ ...btn, standalone: true })).toBe(false);
    expect(shouldShowInstallButton({ ...btn, cardOpen: true })).toBe(false);
    expect(shouldShowInstallButton({ ...btn, hidden: true })).toBe(false);
  });
});

describe("NgaInstallPrompt — reports back to the NGA installer", () => {
  const RETURN = "https://mis.amashuri.com/apps?done=taskmentor";
  let opener: { postMessage: ReturnType<typeof vi.fn>; focus: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStorage());
    vi.stubGlobal("sessionStorage", memoryStorage());
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(CHROME_UA);
    opener = { postMessage: vi.fn(), focus: vi.fn() };
    Object.defineProperty(window, "opener", { value: opener, configurable: true, writable: true });
    setUrl("/dashboard?nga_install=1&return=" + encodeURIComponent(RETURN));
  });
  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, "opener", { value: null, configurable: true, writable: true });
    delete (navigator as any).getInstalledRelatedApps;
  });

  it("an accepted install is reported to the installer tab, only to its origin", async () => {
    const m = await load();
    m.initNgaInstall();
    render(<m.NgaInstallPrompt appName="Task Mentor" />);
    await screen.findByRole("dialog");
    act(() => {
      window.dispatchEvent(
        Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
          prompt: vi.fn().mockResolvedValue(undefined),
          userChoice: Promise.resolve({ outcome: "accepted" }),
        }),
      );
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Install & open Task Mentor" }));
    });
    expect(opener.postMessage).toHaveBeenCalledWith({ type: "nga-install", app: "taskmentor", status: "installed" }, "https://mis.amashuri.com");
    expect(screen.getByRole("heading", { name: "Task Mentor is installed" })).toBeInTheDocument();
  });

  it("skipping is reported as skipped -- never as installed", async () => {
    const m = await load();
    m.initNgaInstall();
    render(<m.NgaInstallPrompt appName="Task Mentor" />);
    const skip = await screen.findByRole("link", { name: /Skip — back to the NGA installer/ });
    expect(skip).toHaveAttribute("href", "https://mis.amashuri.com/apps?skipped=taskmentor");
    const close = vi.spyOn(window, "close").mockImplementation(() => undefined);
    fireEvent.click(skip);
    expect(opener.postMessage).toHaveBeenCalledWith({ type: "nga-install", app: "taskmentor", status: "skipped" }, "https://mis.amashuri.com");
    expect(close).toHaveBeenCalled();
  });

  it("already installed: says so and tells the installer, instead of showing nothing", async () => {
    localStorage.setItem("nga.appInstalled", "1");
    const m = await load();
    m.initNgaInstall();
    render(<m.NgaInstallPrompt appName="Task Mentor" />);
    expect(await screen.findByRole("heading", { name: "Task Mentor is installed" })).toBeInTheDocument();
    expect(opener.postMessage).toHaveBeenCalledWith({ type: "nga-install", app: "taskmentor", status: "already" }, "https://mis.amashuri.com");
  });

  it("a stale 'installed' note gives way when the browser offers installation", async () => {
    localStorage.setItem("nga.appInstalled", "1");
    const m = await load();
    m.initNgaInstall();
    render(<m.NgaInstallPrompt appName="Task Mentor" />);
    await screen.findByRole("heading", { name: "Task Mentor is installed" });
    act(() => {
      window.dispatchEvent(
        Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
          prompt: vi.fn().mockResolvedValue(undefined),
          userChoice: Promise.resolve({ outcome: "dismissed" }),
        }),
      );
    });
    expect(await screen.findByRole("button", { name: "Install & open Task Mentor" })).toBeInTheDocument();
  });

  it("without an opener it falls back to the return link", async () => {
    Object.defineProperty(window, "opener", { value: null, configurable: true, writable: true });
    const m = await load();
    expect(m.notifyInstaller("installed", RETURN)).toBe(false);
    expect(m.installerKeyFrom(RETURN)).toBe("taskmentor");
    expect(m.skipReturnUrl(RETURN)).toBe("https://mis.amashuri.com/apps?skipped=taskmentor");
  });

  it("already installed: one click opens the app window (a real link, which Chrome sends to the app)", async () => {
    localStorage.setItem("nga.appInstalled", "1");
    const m = await load();
    m.initNgaInstall();
    render(<m.NgaInstallPrompt appName="Task Mentor" startPath="/dashboard?source=pwa" />);
    const open = await screen.findByRole("link", { name: "Open the Task Mentor app" });
    expect(open).toHaveAttribute("href", `${window.location.origin}/dashboard?source=pwa`);
    expect(open).toHaveAttribute("target", "_blank");
    vi.useFakeTimers();
    const close = vi.spyOn(window, "close").mockImplementation(() => undefined);
    fireEvent.click(open);
    vi.advanceTimersByTime(700);
    vi.useRealTimers();
    expect(close).toHaveBeenCalled();
    expect(opener.postMessage).toHaveBeenCalledWith({ type: "nga-install", app: "taskmentor", status: "already" }, "https://mis.amashuri.com");
  });

  it("running as the installed app: no card at all, just a quiet report to the installer", async () => {
    const original = window.matchMedia;
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: (q: string) => ({ matches: q.includes("standalone"), media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() }) as unknown as MediaQueryList,
    });
    try {
      const m = await load();
      m.initNgaInstall();
      render(<m.NgaInstallPrompt appName="Task Mentor" />);
      await act(async () => undefined);
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(opener.postMessage).toHaveBeenCalledWith({ type: "nga-install", app: "taskmentor", status: "already" }, "https://mis.amashuri.com");
    } finally {
      Object.defineProperty(window, "matchMedia", { configurable: true, writable: true, value: original });
    }
  });
});

describe("NgaInstallPrompt — installed app visited in a browser tab", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStorage());
    vi.stubGlobal("sessionStorage", memoryStorage());
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(CHROME_UA);
    setUrl("/");
  });
  afterEach(() => vi.restoreAllMocks());

  afterEach(() => {
    delete (navigator as any).getInstalledRelatedApps;
  });

  it("offers 'Open in the app' instead of 'Install' -- when the browser confirms it's installed", async () => {
    (navigator as any).getInstalledRelatedApps = vi.fn().mockResolvedValue([{ platform: "webapp", id: "https://taskmentor.amashuri.com/" }]);
    const m = await load();
    m.initNgaInstall();
    render(<m.NgaInstallPrompt appName="Task Mentor" startPath="/dashboard?source=pwa" />);
    const link = await screen.findByRole("link", { name: /Open in the Task Mentor app/ });
    expect(link).toHaveAttribute("href", `${window.location.origin}/dashboard?source=pwa`);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("also leaves a short report cookie on .amashuri.com (reaches the installer without an opener)", async () => {
    const m = await load();
    const set: string[] = [];
    const spy = vi.spyOn(document, "cookie", "set").mockImplementation((v: string) => void set.push(v));
    m.writeReportCookie("taskmentor", "installed", "taskmentor.amashuri.com", 1700000000000);
    m.writeReportCookie("tupo", "already", "localhost", 1700000000000);
    spy.mockRestore();
    expect(set[0]).toBe("nga_inst_taskmentor=installed.1700000000000; path=/; max-age=900; samesite=lax; domain=.amashuri.com; secure");
    expect(set[1]).toBe("nga_inst_tupo=already.1700000000000; path=/; max-age=900; samesite=lax");
  });

  it("a removed app is not 'installed', whatever an old note says: no 'Open' button, the install card returns", async () => {
    localStorage.setItem("nga.appInstalled", "1");
    (navigator as any).getInstalledRelatedApps = vi.fn().mockResolvedValue([]);
    const m = await load();
    m.initNgaInstall();
    render(<m.NgaInstallPrompt appName="Task Mentor" />);
    expect(await screen.findByRole("dialog", { name: "Install Task Mentor as an app" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Open in the Task Mentor app/ })).toBeNull();
    expect(localStorage.getItem("nga.appInstalled")).toBeNull();
    expect(m.getLiveCheck()).toBe("no");
  });

  it("synced to the Chrome account but not on this device: the browser's install offer wins", async () => {
    (navigator as any).getInstalledRelatedApps = vi.fn().mockResolvedValue([{ platform: "webapp", id: "https://taskmentor.amashuri.com/" }]);
    const m = await load();
    m.initNgaInstall();
    act(() => {
      window.dispatchEvent(
        Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
          prompt: vi.fn().mockResolvedValue(undefined),
          userChoice: Promise.resolve({ outcome: "dismissed" }),
        }),
      );
    });
    expect(await m.refreshLiveCheck()).toBe("no");
    render(<m.NgaInstallPrompt appName="Task Mentor" />);
    expect(await screen.findByRole("button", { name: "Install & open Task Mentor" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Open in the Task Mentor app/ })).toBeNull();
  });
});

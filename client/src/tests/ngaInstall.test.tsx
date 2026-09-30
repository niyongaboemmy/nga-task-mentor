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

  it("'Not now' snoozes it for a day", async () => {
    const m = await load();
    m.initNgaInstall();
    const { unmount } = render(<m.NgaInstallPrompt appName="Task Mentor" />);
    fireEvent.click(await screen.findByRole("button", { name: "Not now" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(Number(localStorage.getItem("nga.installSnoozedUntil"))).toBeGreaterThan(Date.now() + 23 * 3_600_000);
    unmount();
    render(<m.NgaInstallPrompt appName="Task Mentor" />);
    await act(async () => undefined);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("the NGA installer overrides the snooze and gets a safe way back", async () => {
    localStorage.setItem("nga.installSnoozedUntil", String(Date.now() + 10 * 3_600_000));
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
      fireEvent.click(screen.getByRole("button", { name: "Install Task Mentor" }));
    });
    expect(prompt).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(localStorage.getItem("nga.appInstalled")).toBe("1");
  });

  it("decides purely from the inputs", async () => {
    const { shouldOffer } = await load();
    const base = { standalone: false, knownInstalled: false, platform: "chromium" as const, forced: false, snoozedUntil: 0, now: 1000 };
    expect(shouldOffer(base)).toBe(true);
    expect(shouldOffer({ ...base, standalone: true })).toBe(false);
    expect(shouldOffer({ ...base, knownInstalled: true, forced: true })).toBe(false);
    expect(shouldOffer({ ...base, platform: "firefox-other" })).toBe(false);
    expect(shouldOffer({ ...base, snoozedUntil: 5000 })).toBe(false);
    expect(shouldOffer({ ...base, snoozedUntil: 5000, forced: true })).toBe(true);
  });
});

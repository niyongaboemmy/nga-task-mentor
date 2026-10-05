/**
 * TMCode desktop editor downloads (public GitHub Releases of
 * niyongaboemmy/nga-tmcode). The `releases/latest/download/<asset>` links
 * always point at the newest release, so the page works even when the
 * GitHub API (60 requests/hour per IP — a whole school lab shares one) can't
 * be reached; the API only adds the version and release notes.
 */

const REPO = "https://github.com/niyongaboemmy/nga-tmcode";
const LATEST = `${REPO}/releases/latest/download`;

export const TMCODE_RELEASES_URL = `${REPO}/releases`;
export const TMCODE_LATEST_API = "https://api.github.com/repos/niyongaboemmy/nga-tmcode/releases/latest";

export type DesktopOs = "mac" | "windows" | "linux";
export type DetectedOs = DesktopOs | "mobile" | "unknown";

export interface DownloadLink {
  id: string;
  os: DesktopOs;
  label: string;
  detail: string;
  url: string;
}

export const TMCODE_DOWNLOADS: DownloadLink[] = [
  {
    id: "mac-dmg",
    os: "mac",
    label: "macOS",
    detail: "Universal .dmg (Apple Silicon and Intel)",
    url: `${LATEST}/TMCode-macOS.dmg`,
  },
  {
    id: "win-setup",
    os: "windows",
    label: "Windows",
    detail: "Installer (.exe)",
    url: `${LATEST}/TMCode-Windows-Setup.exe`,
  },
  {
    id: "win-msi",
    os: "windows",
    label: "Windows MSI",
    detail: "For IT and computer labs (.msi)",
    url: `${LATEST}/TMCode-Windows.msi`,
  },
  {
    id: "linux-appimage",
    os: "linux",
    label: "Linux AppImage",
    detail: "Runs on most distributions",
    url: `${LATEST}/TMCode-Linux.AppImage`,
  },
  {
    id: "linux-deb",
    os: "linux",
    label: "Linux .deb",
    detail: "Ubuntu, Debian and derivatives",
    url: `${LATEST}/TMCode-Linux.deb`,
  },
];

/** The main download for each desktop OS. */
export const PRIMARY_DOWNLOAD: Record<DesktopOs, string> = {
  mac: "mac-dmg",
  windows: "win-setup",
  linux: "linux-appimage",
};

interface NavigatorLike {
  userAgent?: string;
  platform?: string;
  maxTouchPoints?: number;
  userAgentData?: { platform?: string; mobile?: boolean };
}

/**
 * The visitor's OS: User-Agent Client Hints when the browser has them
 * (Chromium), else the user agent string. Phones and tablets (including an
 * iPad that reports itself as a Mac) are "mobile": TMCode is desktop only.
 */
export function detectOs(nav: NavigatorLike | undefined = typeof navigator !== "undefined" ? navigator : undefined): DetectedOs {
  if (!nav) return "unknown";
  const hints = nav.userAgentData;
  const ua = nav.userAgent ?? "";
  if (hints?.mobile) return "mobile";
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return "mobile";
  const platform = (hints?.platform || "").toLowerCase();
  if (platform) {
    if (platform.includes("android") || platform.includes("ios")) return "mobile";
    if (platform.includes("mac")) return "mac";
    if (platform.includes("win")) return "windows";
    if (platform.includes("linux") || platform.includes("chrome os")) return "linux";
  }
  if (/Macintosh|Mac OS X/i.test(ua)) {
    // iPadOS asks for the desktop site but has a touch screen.
    return (nav.maxTouchPoints ?? 0) > 1 ? "mobile" : "mac";
  }
  if (/Windows/i.test(ua)) return "windows";
  if (/Linux|X11|CrOS/i.test(ua)) return "linux";
  return "unknown";
}

export interface TmcodeRelease {
  tag_name: string;
  published_at: string | null;
  body: string;
  html_url: string;
}

const CACHE_KEY = "tmcode_latest_release_v1";
export const RELEASE_CACHE_MS = 60 * 60 * 1000;

function readCache(now: number): TmcodeRelease | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; release: TmcodeRelease };
    if (!parsed?.release || now - parsed.at > RELEASE_CACHE_MS) return null;
    return parsed.release;
  } catch {
    return null;
  }
}

function writeCache(release: TmcodeRelease, now: number) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ at: now, release }));
  } catch {
    // storage full or blocked: just don't cache
  }
}

/**
 * The latest release (version, date, notes), cached in localStorage for an
 * hour. Resolves null when GitHub can't be reached or rate-limits us — the
 * download links don't depend on it.
 */
export async function fetchLatestRelease(
  fetchImpl: typeof fetch = fetch,
  now: number = Date.now(),
): Promise<TmcodeRelease | null> {
  const cached = readCache(now);
  if (cached) return cached;
  try {
    const res = await fetchImpl(TMCODE_LATEST_API, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || typeof data.tag_name !== "string") return null;
    const release: TmcodeRelease = {
      tag_name: data.tag_name,
      published_at: typeof data.published_at === "string" ? data.published_at : null,
      body: typeof data.body === "string" ? data.body : "",
      html_url: typeof data.html_url === "string" ? data.html_url : TMCODE_RELEASES_URL,
    };
    writeCache(release, now);
    return release;
  } catch {
    return null;
  }
}

export interface NoteLine {
  kind: "heading" | "bullet" | "text";
  text: string;
}

/**
 * Release notes (Markdown from GitHub) as plain lines for safe rendering:
 * headings and bullets are recognised, inline Markdown/HTML is stripped, and
 * nothing is ever injected as HTML.
 */
export function releaseNoteLines(body: string, max = 12): NoteLine[] {
  const clean = (s: string) =>
    s
      .replace(/<[^>]*>/g, "")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/[`*_~]+/g, "")
      .trim();
  const out: NoteLine[] = [];
  for (const raw of (body || "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const h = line.match(/^#{1,6}\s+(.*)$/);
    const b = line.match(/^(?:[-*+]|\d+\.)\s+(.*)$/);
    const text = clean(h ? h[1] : b ? b[1] : line);
    if (!text) continue;
    out.push({ kind: h ? "heading" : b ? "bullet" : "text", text });
    if (out.length >= max) break;
  }
  return out;
}

import React, { useEffect, useMemo, useState } from "react";
import {
  Apple,
  Code2,
  Download,
  ExternalLink,
  Globe,
  Laptop,
  MonitorSmartphone,
  Play,
  ShieldCheck,
  Terminal,
  WifiOff,
} from "lucide-react";
import HomeNavbar from "../components/HomeNavbar";
import {
  type DesktopOs,
  type DetectedOs,
  PRIMARY_DOWNLOAD,
  TMCODE_DOWNLOADS,
  TMCODE_RELEASES_URL,
  type TmcodeRelease,
  detectOs,
  fetchLatestRelease,
  releaseNoteLines,
} from "../utils/tmcodeRelease";

/**
 * /tmcode — public download page for TMCode, the NGA desktop code editor
 * (VS Code-style; required for TMCode coding exams, usable on its own).
 * Works without signing in and without the GitHub API (fixed "latest" links).
 */

const OS_NAME: Record<DesktopOs, string> = { mac: "macOS", windows: "Windows", linux: "Linux" };

const OsIcon: React.FC<{ os: DesktopOs; className?: string }> = ({ os, className }) =>
  os === "mac" ? <Apple className={className} /> : os === "windows" ? <Laptop className={className} /> : <Terminal className={className} />;

const INSTALL_STEPS: Record<DesktopOs, React.ReactNode[]> = {
  mac: [
    "Open the downloaded TMCode-macOS.dmg and drag TMCode into Applications.",
    "The first time, macOS says TMCode “can’t be opened” (it isn’t code-signed yet).",
    <>Open <strong>System Settings › Privacy &amp; Security</strong>, scroll down and click <strong>Open Anyway</strong>. On older macOS: right-click TMCode › <strong>Open</strong>.</>,
  ],
  windows: [
    "Run TMCode-Windows-Setup.exe (labs and IT can use the .msi).",
    <>If Windows SmartScreen appears, click <strong>More info › Run anyway</strong> (the installer isn’t code-signed yet).</>,
    "Open TMCode from the Start menu.",
  ],
  linux: [
    <>AppImage: <code className="px-1 rounded bg-gray-100 dark:bg-gray-800">chmod +x TMCode-Linux.AppImage</code>, then run it.</>,
    <>Debian/Ubuntu: <code className="px-1 rounded bg-gray-100 dark:bg-gray-800">sudo apt install ./TMCode-Linux.deb</code></>,
  ],
};

const FEATURES = [
  { icon: Code2, title: "A VS Code-style editor", text: "Files, tabs, search and a familiar layout — for practice or any project." },
  { icon: Play, title: "Run your code", text: "Python, JavaScript, TypeScript, C, C++ and Java, with your program’s output and tests." },
  { icon: Globe, title: "Web preview", text: "See HTML, CSS and JavaScript pages update as you type." },
  { icon: WifiOff, title: "Works offline", text: "Keeps working without internet and syncs exam work when you’re back online." },
];

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

const TmcodeDownloadPage: React.FC = () => {
  const os: DetectedOs = useMemo(() => detectOs(), []);
  const [release, setRelease] = useState<TmcodeRelease | null>(null);
  const [releaseState, setReleaseState] = useState<"loading" | "ready" | "unavailable">("loading");

  useEffect(() => {
    let alive = true;
    fetchLatestRelease().then((r) => {
      if (!alive) return;
      setRelease(r);
      setReleaseState(r ? "ready" : "unavailable");
    });
    return () => {
      alive = false;
    };
  }, []);

  const desktop = os === "mac" || os === "windows" || os === "linux" ? os : null;
  const primary = desktop ? TMCODE_DOWNLOADS.find((d) => d.id === PRIMARY_DOWNLOAD[desktop]) : null;
  const others = TMCODE_DOWNLOADS.filter((d) => d.id !== primary?.id);
  const notes = release ? releaseNoteLines(release.body) : [];
  const published = formatDate(release?.published_at ?? null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-blue-50 to-white dark:from-gray-950 dark:via-gray-950 dark:to-gray-950 flex flex-col">
      <HomeNavbar />

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
        {/* Hero */}
        <section className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 text-white shadow-lg">
            <Code2 className="w-8 h-8" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">Get TMCode</h1>
          <p className="max-w-2xl mx-auto text-base sm:text-lg text-gray-600 dark:text-gray-300">
            The NGA desktop code editor. Use it for practice and your own projects — and it’s required for
            coding exams delivered in TMCode.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400" data-testid="tmcode-version">
            {releaseState === "ready" && release
              ? `Version ${release.tag_name.replace(/^v/i, "")}${published ? ` · released ${published}` : ""}`
              : releaseState === "loading"
                ? "Checking the latest version…"
                : "Latest version"}
          </p>

          {os === "mobile" && (
            <div
              className="mx-auto max-w-xl flex items-start gap-3 text-left rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-300"
              data-testid="tmcode-mobile-note"
            >
              <MonitorSmartphone className="w-5 h-5 shrink-0 mt-0.5" />
              TMCode is a desktop app for Windows, macOS and Linux. Open this page on a computer to install it — the
              links are below.
            </div>
          )}

          {primary && (
            <div className="pt-2 flex flex-col items-center gap-2">
              <a
                href={primary.url}
                className="inline-flex items-center gap-3 rounded-2xl bg-blue-600 hover:bg-blue-700 px-6 sm:px-8 py-4 text-white text-lg font-semibold shadow-lg transition-colors"
                data-testid="tmcode-primary-download"
              >
                <Download className="w-6 h-6" />
                Download for {OS_NAME[primary.os]}
              </a>
              <span className="text-xs text-gray-500 dark:text-gray-400">{primary.detail}</span>
            </div>
          )}
        </section>

        {/* All downloads */}
        <section className="bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl rounded-2xl border border-gray-200 dark:border-gray-800 p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {primary ? "Other platforms" : "Downloads"}
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="tmcode-downloads">
            {others.map((d) => (
              <li key={d.id}>
                <a
                  href={d.url}
                  className="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3 hover:border-blue-400 hover:bg-blue-50/60 dark:hover:bg-blue-900/20 transition-colors"
                >
                  <OsIcon os={d.os} className="w-5 h-5 text-gray-500 dark:text-gray-400 shrink-0" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-gray-900 dark:text-white">{d.label}</span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400 truncate">{d.detail}</span>
                  </span>
                  <Download className="w-4 h-4 ml-auto text-blue-600 dark:text-blue-400 shrink-0" />
                </a>
              </li>
            ))}
          </ul>
          <a
            href={release?.html_url || TMCODE_RELEASES_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            All releases <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </section>

        {/* What it is */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">What’s TMCode?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div
                key={title}
                className="flex gap-3 rounded-2xl bg-white/70 dark:bg-gray-900/70 border border-gray-200 dark:border-gray-800 p-4"
              >
                <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">{title}</div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Install steps */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Installing</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            The installers aren’t code-signed yet, so your computer asks once. After that TMCode updates itself with
            signed updates.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(Object.keys(INSTALL_STEPS) as DesktopOs[]).map((key) => (
              <div
                key={key}
                className={`rounded-2xl border p-4 bg-white/70 dark:bg-gray-900/70 ${
                  key === desktop ? "border-blue-400 dark:border-blue-600" : "border-gray-200 dark:border-gray-800"
                }`}
              >
                <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-gray-900 dark:text-white">
                  <OsIcon os={key} className="w-4 h-4" /> {OS_NAME[key]}
                </div>
                <ol className="list-decimal list-inside space-y-1.5 text-sm text-gray-600 dark:text-gray-300">
                  {INSTALL_STEPS[key].map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </section>

        {/* Release notes (plain text, never HTML from GitHub) */}
        {notes.length > 0 && (
          <section className="rounded-2xl bg-white/70 dark:bg-gray-900/70 border border-gray-200 dark:border-gray-800 p-5">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">What’s new</h2>
            <div className="space-y-1.5 text-sm text-gray-700 dark:text-gray-300" data-testid="tmcode-notes">
              {notes.map((n, i) =>
                n.kind === "heading" ? (
                  <h3 key={i} className="pt-2 font-semibold text-gray-900 dark:text-white">
                    {n.text}
                  </h3>
                ) : n.kind === "bullet" ? (
                  <p key={i} className="pl-4 relative before:content-['•'] before:absolute before:left-0">
                    {n.text}
                  </p>
                ) : (
                  <p key={i}>{n.text}</p>
                ),
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default TmcodeDownloadPage;

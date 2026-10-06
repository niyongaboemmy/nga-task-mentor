import type { ActivityProject, PresenceState, ProjectDetail, ProjectPresence, SyncState } from "../../services/projectsApi";

/** Display helpers shared by the Projects pages. */

export function formatBytes(bytes: number | null | undefined): string {
  const b = Number(bytes) || 0;
  if (b < 1024) return `${b} B`;
  const units = ["KB", "MB", "GB"];
  let v = b / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v >= 10 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

export function timeAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "never";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t) || t <= 0) return "never";
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} d ago`;
  return new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export const formatDateTime = (iso: string | null | undefined): string =>
  iso
    ? new Date(iso).toLocaleString(undefined, {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

export const shortSha = (sha: string | null | undefined): string => (sha ? sha.slice(0, 7) : "—");

export const dirtyCount = (dirty: PresenceState["dirty"]): number =>
  Array.isArray(dirty) ? dirty.length : Number(dirty) || 0;

const basename = (path: string) => path.split("/").pop() || path;

/**
 * One line for a live presence row, e.g.
 * "Open in TMCode on MacBook · editing src/main.cpp · 2 unsaved · branch main ↑1".
 */
export function presenceParts(p: ProjectPresence, opts: { short?: boolean } = {}): string[] {
  const s = p.state;
  const parts: string[] = [`Open in TMCode${p.device_name ? ` on ${p.device_name}` : ""}`];
  if (s.file) parts.push(`editing ${opts.short ? basename(s.file) : s.file}`);
  const dirty = dirtyCount(s.dirty);
  if (dirty > 0) parts.push(`${dirty} unsaved`);
  if (s.branch) {
    const ahead = Number(s.ahead) || 0;
    const behind = Number(s.behind) || 0;
    parts.push(`branch ${s.branch}${ahead ? ` ↑${ahead}` : ""}${behind ? ` ↓${behind}` : ""}`);
  }
  return parts;
}

export const presenceLine = (p: ProjectPresence, opts?: { short?: boolean }) => presenceParts(p, opts).join(" · ");

export const SYNC_META: Record<string, { label: string; tone: Tone }> = {
  synced: { label: "Synced", tone: "emerald" },
  local_changes: { label: "Local changes", tone: "amber" },
  remote_newer: { label: "Newer in Task Mentor", tone: "blue" },
  conflict: { label: "Conflict", tone: "rose" },
  saving: { label: "Saving…", tone: "violet" },
};

export const syncMeta = (sync: SyncState | null | undefined) =>
  sync ? (SYNC_META[sync] ?? { label: String(sync).replace(/_/g, " "), tone: "slate" as Tone }) : null;

export type Tone = "emerald" | "amber" | "blue" | "rose" | "violet" | "slate" | "sky" | "orange";

export const TONE_CLASSES: Record<Tone, string> = {
  emerald:
    "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/25 dark:text-emerald-300 dark:ring-emerald-800/60",
  amber: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-900/25 dark:text-amber-300 dark:ring-amber-800/60",
  blue: "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-900/25 dark:text-blue-300 dark:ring-blue-800/60",
  rose: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-900/25 dark:text-rose-300 dark:ring-rose-800/60",
  violet:
    "bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-900/25 dark:text-violet-300 dark:ring-violet-800/60",
  slate: "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-white/[0.06] dark:text-slate-300 dark:ring-white/10",
  sky: "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-900/25 dark:text-sky-300 dark:ring-sky-800/60",
  orange:
    "bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-900/25 dark:text-orange-300 dark:ring-orange-800/60",
};

/** Language label + dot colour (GitHub linguist-ish). Unknown languages fall back to their own text. */
const LANGUAGES: Record<string, { label: string; color: string }> = {
  cpp: { label: "C++", color: "#f34b7d" },
  "c++": { label: "C++", color: "#f34b7d" },
  c: { label: "C", color: "#555555" },
  python: { label: "Python", color: "#3572A5" },
  javascript: { label: "JavaScript", color: "#e5c100" },
  typescript: { label: "TypeScript", color: "#3178c6" },
  react: { label: "React", color: "#61dafb" },
  "react-vite": { label: "React", color: "#61dafb" },
  node: { label: "Node.js", color: "#3c873a" },
  "node-express": { label: "Node.js", color: "#3c873a" },
  java: { label: "Java", color: "#b07219" },
  html: { label: "HTML/CSS/JS", color: "#e34c26" },
  web: { label: "HTML/CSS/JS", color: "#e34c26" },
  go: { label: "Go", color: "#00ADD8" },
  rust: { label: "Rust", color: "#dea584" },
  csharp: { label: "C#", color: "#178600" },
  php: { label: "PHP", color: "#4F5D95" },
  ruby: { label: "Ruby", color: "#701516" },
  kotlin: { label: "Kotlin", color: "#A97BFF" },
  sql: { label: "SQL", color: "#e38c00" },
};

export const languageMeta = (language: string | null | undefined): { label: string; color: string } | null => {
  if (!language) return null;
  return LANGUAGES[language.toLowerCase()] ?? { label: language, color: "#94a3b8" };
};

/** Common choices for the New project dialog (free text is allowed too). */
export const LANGUAGE_CHOICES = [
  ["cpp", "C++"],
  ["python", "Python"],
  ["javascript", "JavaScript"],
  ["typescript", "TypeScript"],
  ["react", "React"],
  ["node", "Node.js"],
  ["java", "Java"],
  ["html", "HTML/CSS/JS"],
  ["c", "C"],
  ["go", "Go"],
  ["rust", "Rust"],
] as const;

/** Monaco language id for a file path. */
export function monacoLanguage(path: string): string {
  const name = path.toLowerCase();
  if (name.endsWith("cmakelists.txt")) return "plaintext";
  if (name.endsWith("dockerfile")) return "dockerfile";
  const ext = name.includes(".") ? name.split(".").pop()! : "";
  const map: Record<string, string> = {
    c: "c",
    h: "cpp",
    hpp: "cpp",
    cc: "cpp",
    cpp: "cpp",
    cxx: "cpp",
    py: "python",
    js: "javascript",
    mjs: "javascript",
    cjs: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    java: "java",
    kt: "kotlin",
    go: "go",
    rs: "rust",
    cs: "csharp",
    php: "php",
    rb: "ruby",
    html: "html",
    htm: "html",
    css: "css",
    scss: "scss",
    json: "json",
    md: "markdown",
    yml: "yaml",
    yaml: "yaml",
    xml: "xml",
    sql: "sql",
    sh: "shell",
    toml: "ini",
    ini: "ini",
  };
  return map[ext] ?? "plaintext";
}

/** Initials for an avatar bubble. */
export const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "?";

const GITHUB_URL = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?(\.git)?\/?$/;

/** https://github.com/owner/repo (optionally .git or a trailing slash). */
export const isGithubRepoUrl = (url: string): boolean => GITHUB_URL.test(url.trim());

/** What submitting will freeze, in words; null when there is nothing to freeze yet. */
export function freezeTarget(project: Pick<ProjectDetail, "kind" | "head" | "git">): string | null {
  if (project.kind === "tm") return project.head ? `revision #${project.head.number}` : null;
  return project.git?.head_commit ? `commit ${shortSha(project.git.head_commit)}` : null;
}


/** Where "Open" goes: the project page at the frozen revision (TM) or its Git tab. */
export const frozenProjectHref = (row: Pick<ActivityProject, "link" | "project">): string => {
  const rev = row.link.revision_id;
  if (row.project.kind === "tm") return `/projects/${row.project.id}?tab=files${rev ? `&rev=${rev}` : ""}`;
  return `/projects/${row.project.id}?tab=git`;
};

import path from "path";
import { Judge0Service } from "../../services/Judge0Service";
import { profileById, profileIdForLanguage } from "../profiles";

/**
 * Running a submitted (non-web) project from the grading workspace: which
 * language it is, which file is the program, and which files go to the code
 * runner. Pure helpers; the controller reads the blobs and calls the runner.
 */

/** File extension → Task Mentor language key (the runners' keys). */
const EXT_LANGUAGE: Record<string, string> = {
  py: "python",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  ts: "typescript",
  mts: "typescript",
  c: "c",
  cpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  java: "java",
  cs: "csharp",
  rb: "ruby",
  go: "go",
  rs: "rust",
  php: "php",
  kt: "kotlin",
  swift: "swift",
};

/** Headers and other files a program needs that aren't entry points themselves. */
const SUPPORT_EXT = new Set(["h", "hpp", "hh", "txt", "csv", "json", "md", "in", "dat", "xml", "yml", "yaml", "toml", "properties"]);

/** Folders never sent to the runner (dependencies, build output, editor state). */
const IGNORED = /(^|\/)(node_modules|\.git|\.tmcode|\.vscode|\.idea|dist|build|out|target|bin|obj|__pycache__|\.venv|venv)\//;

export const MAX_RUN_FILES = 80;
export const MAX_RUN_BYTES = 512 * 1024;
export const MAX_STDIN_BYTES = 64 * 1024;

export const extOf = (p: string) => path.extname(p).slice(1).toLowerCase();

export function languageOfPath(p: string): string | null {
  return EXT_LANGUAGE[extOf(p)] ?? null;
}

export const isIgnoredPath = (p: string) => IGNORED.test(p);

export interface RunCandidate {
  path: string;
  language: string;
  size: number;
}

/** Every source file the runner could start from, grouped by language. */
export function runCandidates(files: { path: string; size: number }[]): RunCandidate[] {
  return files
    .filter((f) => !isIgnoredPath(f.path))
    .map((f) => ({ path: f.path, size: f.size, language: languageOfPath(f.path) }))
    .filter((f): f is RunCandidate => !!f.language);
}

/**
 * The language to run: the one asked for, else the project's own language
 * when it has files in it, else the language with the most source files.
 */
export function pickLanguage(candidates: RunCandidate[], projectLanguage: string | null, asked?: string | null): string | null {
  const norm = (l: unknown) => Judge0Service.normalizeLanguage(l);
  const has = (l: string | null) => !!l && candidates.some((c) => c.language === l);
  const wanted = norm(asked);
  if (has(wanted)) return wanted;
  const own = norm(projectLanguage);
  if (has(own)) return own;
  const counts = new Map<string, number>();
  for (const c of candidates) counts.set(c.language, (counts.get(c.language) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
}

/** A program's entry point, by what its source declares. */
const MAIN_PATTERNS: Record<string, RegExp> = {
  c: /\bint\s+main\s*\(/,
  cpp: /\bint\s+main\s*\(/,
  java: /\bstatic\s+void\s+main\s*\(/,
  csharp: /\bstatic\s+(async\s+)?[\w<>]+\s+Main\s*\(/,
  python: /__name__\s*==\s*["']__main__["']/,
  go: /\bfunc\s+main\s*\(/,
  rust: /\bfn\s+main\s*\(/,
  kotlin: /\bfun\s+main\s*\(/,
};

const ENTRY_NAMES = ["main", "index", "app", "program", "solution", "server"];

/**
 * Ranks the candidates of one language as entry points: a declared main
 * first, then the profile's entry file, then conventional names, then the
 * shallowest path. `sources` maps a path to its text when it was read.
 */
export function rankEntries(candidates: RunCandidate[], language: string, sources: Map<string, string>): string[] {
  const profileEntry = profileById(profileIdForLanguage(language) ?? "")?.entry_point ?? null;
  const main = MAIN_PATTERNS[language];
  const score = (c: RunCandidate) => {
    const base = path.basename(c.path, path.extname(c.path)).toLowerCase();
    let s = 0;
    const src = sources.get(c.path);
    if (main && src && main.test(src)) s += 100;
    if (profileEntry && c.path === profileEntry) s += 50;
    const named = ENTRY_NAMES.indexOf(base);
    if (named >= 0) s += 30 - named;
    // Test files often declare their own main: never ahead of the program.
    if (/(^|\/)(tests?|spec|__tests__)\//i.test(c.path) || /[._-](test|spec)$|^(test|spec)[._-]/i.test(base)) s -= 200;
    s -= c.path.split("/").length * 2;
    return s;
  };
  return candidates
    .filter((c) => c.language === language)
    .map((c) => ({ c, s: score(c) }))
    .sort((a, b) => b.s - a.s || a.c.path.localeCompare(b.c.path))
    .map((x) => x.c.path);
}

/**
 * The files sent with a run: the entry first, then the language's other
 * sources and small support files, within the file and byte caps.
 */
export function filesToSend(
  files: { path: string; size: number }[],
  language: string,
  entry: string,
): { paths: string[]; skipped: number } {
  const wanted = files.filter(
    (f) => !isIgnoredPath(f.path) && (languageOfPath(f.path) === language || SUPPORT_EXT.has(extOf(f.path))),
  );
  const ordered = [...wanted].sort((a, b) => (a.path === entry ? -1 : b.path === entry ? 1 : a.path.localeCompare(b.path)));
  const paths: string[] = [];
  let bytes = 0;
  for (const f of ordered) {
    if (paths.length >= MAX_RUN_FILES || bytes + f.size > MAX_RUN_BYTES) continue;
    paths.push(f.path);
    bytes += f.size;
  }
  if (!paths.includes(entry)) paths.unshift(entry);
  return { paths, skipped: wanted.length - paths.length };
}

/** Looks like text (not a binary file) — runners take UTF-8 sources only. */
export const isProbablyText = (buf: Buffer) => !buf.subarray(0, 8000).includes(0);

/** Languages whose sources are compiled together: another program's files break the build. */
const COMPILED_TOGETHER = new Set(["java", "c", "cpp", "csharp", "go", "kotlin", "swift", "rust"]);

const dirOf = (p: string) => (p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "");
const within = (p: string, dir: string) => dir === "" || p.startsWith(`${dir}/`);

/** Whether a source file is a program of its own (declares main; Swift: a main.swift). */
function declaresMain(p: string, language: string, src: string | undefined): boolean {
  if (language === "swift") return path.basename(p).toLowerCase() === "main.swift";
  const main = MAIN_PATTERNS[language];
  return !!main && !!src && main.test(src);
}

/** A Java file's `package a.b;` ("" for none), comments ignored. */
export function javaPackage(src: string | undefined): string {
  const code = (src ?? "").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
  return /^\s*package\s+([\w$]+(?:\s*\.\s*[\w$]+)*)\s*;/m.exec(code)?.[1].replace(/\s+/g, "") ?? "";
}

/**
 * Java without a build tool: the entry's source root (its folder, or the
 * folder its `package` line points back to) and the classes there whose
 * package matches their folder. Classes in the default package share one
 * namespace, so Task3/Task3.java's `class Pet` never meets Task7's.
 */
function javaProgramFiles<T extends { path: string }>(files: T[], entry: string, sources: Map<string, string>): T[] {
  const pkg = javaPackage(sources.get(entry));
  const entryDir = dirOf(entry);
  const pkgPath = pkg.replace(/\./g, "/");
  const root = !pkg ? entryDir : entryDir === pkgPath || entryDir.endsWith(`/${pkgPath}`) ? entryDir.slice(0, entryDir.length - pkgPath.length).replace(/\/$/, "") : null;
  return files.filter((f) => {
    if (f.path === entry || languageOfPath(f.path) !== "java") return true;
    const own = javaPackage(sources.get(f.path));
    if (root === null) return dirOf(f.path) === entryDir && own === pkg;
    if (!within(f.path, root)) return false;
    const rel = root === "" ? dirOf(f.path) : dirOf(f.path).slice(root.length + 1);
    return own === rel.replace(/\//g, ".");
  });
}

/**
 * Only the program the entry starts: a project of independent exercises
 * (Task1/Task1.java … Task7/Task7.java, ex1/main.c, ex2/main.c) runs one of
 * them, the way the playground runs the file on screen, instead of compiling
 * every exercise together (duplicate classes, two mains). For the compiled
 * languages other than Java, left out are other files that declare their own
 * main, and every file in a folder holding another program unless that
 * folder contains the entry (a program at the root keeps the helpers beside
 * it). Interpreted languages only load what they import: they keep every file.
 */
export function programFiles<T extends { path: string }>(files: T[], language: string, entry: string, sources: Map<string, string>): T[] {
  if (!COMPILED_TOGETHER.has(language)) return files;
  if (language === "java") return javaProgramFiles(files, entry, sources);
  const isMain = (p: string) => p !== entry && languageOfPath(p) === language && declaresMain(p, language, sources.get(p));
  const otherPrograms = new Set(files.filter((f) => isMain(f.path)).map((f) => dirOf(f.path)).filter((dir) => !within(entry, dir)));
  return files.filter((f) => f.path === entry || (!isMain(f.path) && ![...otherPrograms].some((dir) => within(f.path, dir))));
}

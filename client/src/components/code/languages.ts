/** File extension → Monaco language, and display names (CODE_RUNNER_PLAN.md §13). */

const MONACO: Record<string, string> = {
  py: "python",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "typescript",
  c: "c",
  h: "c",
  cpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  hpp: "cpp",
  java: "java",
  kt: "kotlin",
  cs: "csharp",
  go: "go",
  rs: "rust",
  php: "php",
  rb: "ruby",
  swift: "swift",
  dart: "dart",
  lua: "lua",
  r: "r",
  sql: "sql",
  sh: "shell",
  json: "json",
  md: "markdown",
  html: "html",
  htm: "html",
  css: "css",
  xml: "xml",
  yml: "yaml",
  yaml: "yaml",
  toml: "ini",
};

export const extOf = (path: string) => (path.split("/").pop() ?? "").split(".").slice(1).pop()?.toLowerCase() ?? "";

export function monacoLanguage(path: string): string {
  const base = path.split("/").pop() ?? "";
  if (base === "Makefile" || base === "makefile") return "makefile";
  if (base === "Dockerfile") return "dockerfile";
  return MONACO[extOf(path)] ?? "plaintext";
}

export const LANGUAGE_LABEL: Record<string, string> = {
  python: "Python",
  javascript: "JavaScript",
  typescript: "TypeScript",
  c: "C",
  cpp: "C++",
  java: "Java",
  go: "Go",
  rust: "Rust",
  csharp: "C#",
  kotlin: "Kotlin",
  php: "PHP",
  ruby: "Ruby",
  swift: "Swift",
};

export const languageLabel = (key: string | null | undefined) => (key ? LANGUAGE_LABEL[key] ?? key : "");

const CODE_EXT = new Set(["py", "js", "mjs", "cjs", "jsx", "ts", "tsx", "c", "cpp", "cc", "cxx", "java", "kt", "cs", "go", "rs", "php", "rb", "swift", "dart", "lua", "r", "sql", "sh", "html"]);
const MAIN_NAMES = ["main", "index", "app", "program", "solution"];

/** The file to show first: the tests' entry, else a main-looking program, else any program. */
export function firstFileToOpen(paths: string[], entry?: string | null): string | undefined {
  if (entry && paths.includes(entry)) return entry;
  const code = paths.filter((p) => CODE_EXT.has(extOf(p)));
  const base = (p: string) => (p.split("/").pop() ?? "").replace(/\.[^.]+$/, "").toLowerCase();
  return (
    code.find((p) => MAIN_NAMES.includes(base(p))) ??
    [...code].sort((a, b) => a.split("/").length - b.split("/").length)[0] ??
    paths.find((p) => !/^readme\.md$/i.test(p)) ??
    paths[0]
  );
}

const LANGUAGE_EXT: Record<string, string> = {
  python: "py",
  javascript: "js",
  typescript: "ts",
  c: "c",
  cpp: "cpp",
  java: "java",
  go: "go",
  rust: "rs",
  csharp: "cs",
  kotlin: "kt",
  php: "php",
  ruby: "rb",
  swift: "swift",
};

/** The file name a single-file answer gets (Java's is Main.java). */
export const entryFileFor = (language: string | null | undefined) =>
  language === "java" ? "Main.java" : `main.${LANGUAGE_EXT[language ?? ""] ?? "txt"}`;

/** Source extension → catalog language key (for files without a declared language). */
const SOURCE_LANGUAGE: Record<string, string> = {
  py: "python", js: "javascript", cjs: "javascript", mjs: "javascript", jsx: "javascript", ts: "typescript", tsx: "typescript",
  java: "java", kt: "kotlin", go: "go", rs: "rust", c: "c", cpp: "cpp", cc: "cpp", cxx: "cpp", cs: "csharp", rb: "ruby",
  php: "php", swift: "swift", dart: "dart", scala: "scala", ex: "elixir", exs: "elixir", hs: "haskell", jl: "julia",
  lua: "lua", r: "r", sh: "bash", sql: "sql",
};

/** The language most of the source files are in. */
export function guessLanguage(paths: string[]): string | null {
  const count = new Map<string, number>();
  for (const p of paths) {
    const lang = SOURCE_LANGUAGE[extOf(p)];
    if (lang) count.set(lang, (count.get(lang) ?? 0) + 1);
  }
  return [...count].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

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

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

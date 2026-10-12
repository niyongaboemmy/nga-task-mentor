/** Display helpers for the grading workspace. */

const LANG_ALIAS: Record<string, string> = {
  js: "javascript",
  node: "javascript",
  nodejs: "javascript",
  ts: "typescript",
  py: "python",
  python3: "python",
  "c++": "cpp",
  html: "web",
  css: "web",
};
const LANG_LABEL: Record<string, string> = {
  javascript: "JavaScript",
  typescript: "TypeScript",
  python: "Python",
  cpp: "C++",
  c: "C",
  java: "Java",
  web: "HTML & CSS",
  react: "React",
  csharp: "C#",
  php: "PHP",
  go: "Go",
  rust: "Rust",
  kotlin: "Kotlin",
  swift: "Swift",
  ruby: "Ruby",
};
export const normLang = (l: string | null | undefined) => {
  const k = String(l ?? "").trim().toLowerCase();
  return k ? LANG_ALIAS[k] ?? k : null;
};
export const languageLabel = (l: string | null | undefined) => {
  const k = normLang(l);
  return k ? LANG_LABEL[k] ?? k : "—";
};

/** "2 h 5 min", "3 days 4 h". */
export function duration(ms: number): string {
  const m = Math.max(1, Math.round(ms / 60000));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h${m % 60 ? ` ${m % 60} min` : ""}`;
  const d = Math.floor(h / 24);
  return `${d} ${d === 1 ? "day" : "days"}${h % 24 ? ` ${h % 24} h` : ""}`;
}

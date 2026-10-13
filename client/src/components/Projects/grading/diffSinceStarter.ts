import type { CodeFile } from "../../../services/codeApi";

/** One file the student added, changed or deleted compared with the starter. */
export type Change = { path: string; kind: "added" | "changed" | "deleted"; before: string; after: string };

const hidden = (p: string) => p.startsWith(".nga/") || p.startsWith(".tmcode/");

export function diffFiles(starter: CodeFile[], work: CodeFile[]): Change[] {
  const before = new Map(starter.filter((f) => !hidden(f.path)).map((f) => [f.path, f.content]));
  const after = new Map(work.filter((f) => !hidden(f.path)).map((f) => [f.path, f.content]));
  const out: Change[] = [];
  for (const [path, content] of after) {
    if (!before.has(path)) out.push({ path, kind: "added", before: "", after: content });
    else if (before.get(path) !== content) out.push({ path, kind: "changed", before: before.get(path)!, after: content });
  }
  for (const [path, content] of before) if (!after.has(path)) out.push({ path, kind: "deleted", before: content, after: "" });
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

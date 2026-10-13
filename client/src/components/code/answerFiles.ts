import type { CodeFile } from "../../services/codeApi";
import { entryFileFor } from "./languages";

/** An answer's code as files: a project answer is a JSON list of {name|path, content}. */
export function answerToFiles(code: string, language: string | null | undefined): CodeFile[] {
  const t = code.trim();
  if (t.startsWith("[") && t.endsWith("]")) {
    try {
      const list = JSON.parse(t);
      if (Array.isArray(list) && list.length) {
        return list
          .filter((f) => f && typeof f === "object")
          .map((f: Record<string, unknown>) => ({ path: String(f.path ?? f.name ?? "main"), content: String(f.content ?? "") }));
      }
    } catch {
      // one file
    }
  }
  return [{ path: entryFileFor(language), content: code }];
}

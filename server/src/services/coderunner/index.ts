import { Judge0Runner } from "./judge0Runner";
import { TmJudgeRunner } from "./tmJudgeRunner";
import { CodeRunner, RunFile } from "./types";
import { profileById, profileIdForLanguage } from "../../tmcode/profiles";

export * from "./types";
export { Judge0Runner, TmJudgeRunner };

const runners = { judge0: new Judge0Runner(), tmjudge: new TmJudgeRunner() };

/**
 * The engine in use: CODERUNNER_ENGINE=tmjudge|judge0 (default judge0 until
 * tm-judge is deployed). Read on every call, so tests and ops can switch it.
 */
export function getCodeRunner(): CodeRunner {
  return process.env.CODERUNNER_ENGINE === "tmjudge" ? runners.tmjudge : runners.judge0;
}

/** File name of a single-file answer: the profile's entry point when known. */
export function entryFileName(language: string): string {
  const id = profileIdForLanguage(language);
  return (id && profileById(id)?.entry_point) || "main";
}

/**
 * An answer's `code` as files: a project-mode answer is a JSON array of
 * {name|path, content, is_entry_point}; anything else is one file.
 */
export function answerFiles(
  code: string,
  language: string,
): { files: RunFile[]; entry: string } {
  const trimmed = code.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const files = parsed
          .filter((f: any) => f && typeof f === "object")
          .map((f: any) => ({ path: String(f.path ?? f.name ?? "main"), content: String(f.content ?? "") }));
        const entryFile = parsed.find((f: any) => f?.is_entry_point);
        const entry = String(entryFile?.path ?? entryFile?.name ?? "") ||
          files.find((f) => f.path === entryFileName(language))?.path ||
          files[0].path;
        return { files, entry };
      }
    } catch {
      // not a file list: one file
    }
  }
  const name = entryFileName(language);
  return { files: [{ path: name, content: code }], entry: name };
}

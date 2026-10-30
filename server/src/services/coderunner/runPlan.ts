import { Judge0Service } from "../Judge0Service";
import { isWebLanguage } from "../../utils/codeLanguages";
import { filesToSend, isIgnoredPath, languageOfPath, pickLanguage, programFiles, rankEntries, runCandidates } from "../../tmcode/practical/run";
import { hasManifest } from "./tmJudgeRunner";
import { detectProject, type DetectedProject } from "./projectKind";
import { judgeHas, judgeRunsLanguage } from "./judgeInfo";
import type { ConfiguredRunner, RunFile } from "./index";

/**
 * What a run sends to the code runner, for every place that runs a set of
 * files: the MIS Code Playground and the project editor (practiceRun), and
 * the grading workspace's Run tab (a revision's files, live or with saved
 * inputs). One answer, so a program that runs in the playground runs the same
 * way when its teacher grades it.
 *
 *  - A project with a build file, or a language only the runner's catalog
 *    knows, goes as a project: tm-judge detects the kind, builds and runs it.
 *  - Anything else runs as its language: the entry file (the one asked for,
 *    else the likeliest) with the language's other sources and small support
 *    files.
 *  - Java: the entry is named after its public class, as the playground does,
 *    so `public class Calculator` in Main.java still compiles.
 */

export interface RunPlanInput {
  files: RunFile[];
  /** The language asked for (a picker), if any. */
  language?: string | null;
  /** The project's own language, used when none is asked for. */
  projectLanguage?: string | null;
  kind?: string | null;
  entry?: string | null;
  /** The runner's detection when the caller already has it (skips asking again). */
  detected?: DetectedProject | null;
}

export type RunPlan =
  | {
      ok: true;
      /** "project": a catalog kind on tm-judge; "language": one language's sources. */
      mode: "project" | "language";
      language: string;
      kind: string | null;
      /** The file the program starts from (as sent), null when the runner decides. */
      entry: string | null;
      /** The entry as the student named it, when it was renamed for Java. */
      original_entry: string | null;
      files: RunFile[];
      /** Files left out by the caps. */
      skipped: number;
    }
  | { ok: false; status: number; code: string; message: string; extra?: Record<string, unknown> };

const LABEL = new Map(Judge0Service.supportedLanguages().map((l) => [l.key, l.label]));
const labelOf = (language: string) => LABEL.get(language) ?? language;

const fail = (status: number, code: string, message: string, extra?: Record<string, unknown>): RunPlan => ({ ok: false, status, code, message, ...(extra ? { extra } : {}) });

const JAVA_PUBLIC_CLASS = /\bpublic\s+(?:final\s+|abstract\s+)*(?:class|interface|enum|record)\s+([A-Za-z_$][\w$]*)/;

/** Where a Java file must be to compile: named after its public class (comments ignored). */
export function javaFilePath(path: string, source: string): string {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
  const cls = JAVA_PUBLIC_CLASS.exec(code)?.[1];
  if (!cls) return path;
  const slash = path.lastIndexOf("/");
  return `${slash >= 0 ? path.slice(0, slash + 1) : ""}${cls}.java`;
}

/** Renames a Java entry to its public class's file when no other file has that name. */
function namedForJava(files: RunFile[], entry: string | null): { files: RunFile[]; entry: string | null } {
  if (!entry || !/\.java$/i.test(entry)) return { files, entry };
  const file = files.find((f) => f.path === entry);
  if (!file) return { files, entry };
  const wanted = javaFilePath(entry, file.content);
  if (wanted === entry || files.some((f) => f.path === wanted)) return { files, entry };
  return { files: files.map((f) => (f === file ? { path: wanted, content: f.content } : f)), entry: wanted };
}

export async function planRun(input: RunPlanInput, runner: ConfiguredRunner): Promise<RunPlan> {
  const asked = input.language ?? null;
  if (asked && isWebLanguage(asked)) return fail(422, "USE_PREVIEW", "Web pages run in the Preview, not here.");

  const meta = input.files.map((f) => ({ path: f.path, size: Buffer.byteLength(f.content, "utf8") }));
  const candidates = runCandidates(meta);
  const detected = pickLanguage(candidates, input.projectLanguage ?? asked, asked);
  // No source file this server knows by its extension (Lua, Dart, SQL…): the project's own
  // language, when the runner's catalog runs it.
  const fallback = !detected && input.projectLanguage && judgeRunsLanguage(input.projectLanguage) ? input.projectLanguage : null;
  const language = asked ?? detected ?? fallback;

  // A project with a build file, or a language only the catalog knows: tm-judge detects the
  // kind and entry, builds it, and runs it. The files may suggest another language than the
  // one asked (an Arduino sketch with a helper .cpp looks like C++): a language the runner's
  // catalog runs is taken at its word.
  const asProject =
    !!language && judgeHas("projects") && judgeRunsLanguage(language) && (!!input.kind || hasManifest(input.files) || !detected || (!!asked && detected !== asked));
  if (asProject) {
    const files = input.files.filter((f) => !isIgnoredPath(f.path));
    const kind = input.kind ?? null;
    const project = kind ? null : input.detected !== undefined ? input.detected : await detectProject(files).catch(() => null);
    // A web app (React, Vue, Angular…) has no program to run: say so plainly.
    if (project && (project.webApp || !project.actions.includes("run"))) {
      return fail(422, "NOT_A_PROGRAM", `This is a ${project.label}: it runs in a browser, not as a program with inputs.${project.actions.includes("test") ? " Its unit tests can run." : ""}`, {
        kind: project.kind,
      });
    }
    if (project && !project.available) {
      return fail(422, "RUNTIME_UNAVAILABLE", `This is a ${project.label}, and the school's code runner can't build those yet. Open it in TMCode to run it.`, { kind: project.kind });
    }
    const entry = input.entry && files.some((f) => f.path === input.entry) ? input.entry : null;
    // Without a build file, only the entry's own program (independent exercises in folders).
    const start = entry ?? (project?.entry && files.some((f) => f.path === project.entry) ? project.entry : null);
    const sources = new Map(files.map((f) => [f.path, f.content]));
    const own = start && !hasManifest(files) ? programFiles(files, language, start, sources) : files;
    const named = namedForJava(own, entry);
    return { ok: true, mode: "project", language, kind, entry: named.entry, original_entry: named.entry !== entry ? entry : null, files: named.files, skipped: 0 };
  }

  if (!detected) return fail(422, "NOTHING_TO_RUN", "There's no program to run here (no source files found).");
  if (!runner.supportsLanguage(detected)) {
    return fail(422, "UNSUPPORTED_LANGUAGE", `${labelOf(detected)} can't be run here yet.`, { supported: runner.languages() });
  }
  const sources = new Map(input.files.map((f) => [f.path, f.content]));
  const entry =
    input.entry && languageOfPath(input.entry) === detected && sources.has(input.entry) ? input.entry : rankEntries(candidates, detected, sources)[0];
  if (!entry) return fail(422, "NOTHING_TO_RUN", "Pick the file to run.");

  // Only the entry's own program: independent exercises in folders run one at a time.
  const { paths, skipped } = filesToSend(programFiles(meta, detected, entry, sources), detected, entry);
  const files = paths.filter((p) => sources.has(p)).map((p) => ({ path: p, content: sources.get(p)! }));
  const named = namedForJava(files, entry);
  return { ok: true, mode: "language", language: detected, kind: null, entry: named.entry, original_entry: named.entry !== entry ? entry : null, files: named.files, skipped };
}

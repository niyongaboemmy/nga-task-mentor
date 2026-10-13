import { Judge0Runner } from "./judge0Runner";
import { TmJudgeRunner } from "./tmJudgeRunner";
import { CodeRunner, RunFile, RunRequest, RunResult } from "./types";
import { JudgeUnavailableError, QuotaExceededError } from "../Judge0Service";
import { recordRun } from "./stats";
import { profileById, profileIdForLanguage } from "../../tmcode/profiles";

export * from "./types";
export { Judge0Runner, TmJudgeRunner };

const runners = { judge0: new Judge0Runner(), tmjudge: new TmJudgeRunner() };

const judge0Configured = () => !!process.env.JUDGE0_API_KEY || !!process.env.JUDGE0_URL;

/**
 * With CODERUNNER_ENGINE=tmjudge: our own judge first; Judge0 only for the
 * languages tm-judge doesn't run yet, and as a fallback when tm-judge can't
 * be reached (not when it refused the run or is over quota). Every run is
 * recorded for Admin → Code runner.
 */
export class RoutedRunner implements CodeRunner {
  readonly name = "tmjudge" as const;

  constructor(
    private primary: CodeRunner = runners.tmjudge,
    private fallback: CodeRunner = runners.judge0,
    private fallbackEnabled: () => boolean = judge0Configured,
  ) {}

  /** Which engine runs this language. */
  engineFor(language: unknown): "tmjudge" | "judge0" | null {
    if (this.primary.supportsLanguage(language)) return this.primary.name;
    if (this.fallbackEnabled() && this.fallback.supportsLanguage(language)) return this.fallback.name;
    return null;
  }

  supportsLanguage(language: unknown) {
    return this.engineFor(language) !== null;
  }

  languages() {
    const own = this.primary.languages();
    const extra = this.fallbackEnabled() ? this.fallback.languages().filter((l) => !own.includes(l)) : [];
    return [...own, ...extra];
  }

  async run(req: RunRequest): Promise<RunResult> {
    if (this.engineFor(req.language) === this.fallback.name) return this.fallback.run(req);
    try {
      return await this.primary.run(req);
    } catch (e) {
      // Judge0 can't build projects or run unit tests: those wait for tm-judge.
      const fallbackOk =
        !req.kind &&
        !req.actions &&
        e instanceof JudgeUnavailableError &&
        !(e instanceof QuotaExceededError) &&
        this.fallbackEnabled() &&
        this.fallback.supportsLanguage(req.language);
      if (!fallbackOk) throw e;
      console.warn(`[coderunner] ${this.primary.name} unavailable, running ${req.language} on ${this.fallback.name}`);
      return this.fallback.run(req);
    }
  }
}

/** Records each run's engine, language, duration and outcome (no code, no output). */
class RecordedRunner implements CodeRunner {
  constructor(private inner: CodeRunner) {}
  get name() {
    return this.inner.name;
  }
  engineFor(language: unknown) {
    const routed = this.inner as RoutedRunner;
    return typeof routed.engineFor === "function" ? routed.engineFor(language) : this.inner.supportsLanguage(language) ? this.inner.name : null;
  }
  supportsLanguage(language: unknown) {
    return this.inner.supportsLanguage(language);
  }
  languages() {
    return this.inner.languages();
  }
  async run(req: RunRequest): Promise<RunResult> {
    const started = Date.now();
    const base = { at: new Date().toISOString(), language: String(req.language), tests: req.tests.length };
    try {
      const result = await this.inner.run(req);
      recordRun({ ...base, engine: result.engine, ms: Date.now() - started, outcome: "ok" });
      return result;
    } catch (e: any) {
      recordRun({
        ...base,
        engine: this.engineFor(req.language) ?? this.inner.name,
        ms: Date.now() - started,
        outcome: String(e?.code ?? "ERROR"),
        message: String(e?.message ?? e).slice(0, 300),
      });
      throw e;
    }
  }
}

const recorded = {
  judge0: new RecordedRunner(runners.judge0),
  tmjudge: new RecordedRunner(new RoutedRunner()),
};

/** The configured engine: CODERUNNER_ENGINE=tmjudge (routed, see RoutedRunner) or judge0 (default). */
export type ConfiguredRunner = CodeRunner & { engineFor(language: unknown): "tmjudge" | "judge0" | null };

/**
 * The engine in use: CODERUNNER_ENGINE=tmjudge|judge0 (default judge0 until
 * tm-judge is configured). Read on every call, so tests and ops can switch it.
 */
export function getCodeRunner(): ConfiguredRunner {
  return process.env.CODERUNNER_ENGINE === "tmjudge" ? recorded.tmjudge : recorded.judge0;
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

/**
 * The CodeRunner interface (plan §8.3): everything that runs student code —
 * grading, "Run tests", TMCode server runs — goes through it, so the engine
 * (RapidAPI/Judge0 today, our own tm-judge from Phase 3) is a config switch
 * (CODERUNNER_ENGINE), not a code change.
 */

export interface RunFile {
  path: string;
  content: string;
}

export interface RunTest {
  id: string;
  input: string;
  /** Omit for a plain run (verdict "ok"). */
  expected_output?: string | null;
}

export interface RunLimits {
  time_s?: number;
  wall_s?: number;
  memory_mb?: number;
  output_kb?: number;
}

export interface RunRequest {
  /** Task Mentor language key ("python", "cpp", …); mapped per engine. */
  language: string;
  files: RunFile[];
  /** Path of the file to run; defaults to the profile's entry point. */
  entry?: string;
  tests: RunTest[];
  limits?: RunLimits;
  /**
   * Interactive run ("Run", "Run tests" in the web editor): the engine may
   * use its synchronous path. Grading leaves it off.
   */
  interactive?: boolean;
  /**
   * Catalog projects (tm-judge with "projects"): the kind ("java/maven"…;
   * detected when absent), the steps to run, and a unit-test filter.
   */
  kind?: string;
  actions?: ("build" | "run" | "test")[];
  test_filter?: string;
}

/** Same verdicts as tm-judge (PROTOCOL.md §5). */
export type Verdict =
  | "accepted"
  | "wrong-answer"
  | "ok"
  | "runtime-error"
  | "time-limit"
  | "memory-limit"
  | "output-limit"
  | "compile-error"
  | "package-not-available"
  | "internal-error";

export interface TestOutcome {
  id: string;
  verdict: Verdict;
  passed: boolean;
  stdout: string | null;
  stderr: string | null;
  exit_code?: number | null;
  time_ms: number | null;
  memory_kb: number | null;
  /** Engine's own status text, for display. */
  status?: string;
}

/** One unit test from the framework's report (tm-judge PROTOCOL.md §5.2). */
export interface UnitTestCase {
  id: string;
  name: string;
  group: string | null;
  file: string | null;
  line: number | null;
  status: "passed" | "failed" | "skipped" | "error";
  durationMs: number | null;
  message: string | null;
  details: string | null;
}

export interface UnitReport {
  framework: string | null;
  verdict: "passed" | "failed" | "error" | "time-limit" | "memory-limit" | "package-not-available" | "internal-error";
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  errors: number;
  time_ms: number | null;
  /** The test command's output, for when there are no per-test results. */
  output: string;
  truncated: boolean;
  tests: UnitTestCase[];
}

export interface RunResult {
  engine: string;
  compile: { ok: boolean; output: string; time_ms?: number } | null;
  tests: TestOutcome[];
  /** Catalog projects: the kind that ran, unit-test results, a missing package. */
  kind?: string;
  unit?: UnitReport | null;
  error?: { code: string; manager?: string; package?: string | null; message: string } | null;
}

export interface CodeRunner {
  readonly name: "judge0" | "tmjudge";
  /** Whether this engine can run code in a Task Mentor language. */
  supportsLanguage(language: unknown): boolean;
  /** Task Mentor language keys this engine runs (for authors). */
  languages(): string[];
  /**
   * Runs `files` against each test. Throws JudgeUnavailableError when the
   * engine can't be reached (callers leave grading pending) and
   * UnsupportedLanguageError for a language it doesn't run.
   */
  run(req: RunRequest): Promise<RunResult>;
}

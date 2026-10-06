import {
  Judge0Result,
  Judge0Service,
  UnsupportedLanguageError,
} from "../Judge0Service";
import { CodeRunner, RunRequest, RunResult, TestOutcome, Verdict } from "./types";

/**
 * Judge0 (RapidAPI's judge0-ce today) behind the CodeRunner interface.
 * Judge0 CE runs one source file, so a multi-file answer runs its entry file
 * only (the "multi-file" language 89 + zip isn't used — tm-judge takes all
 * files natively).
 */

const normalizeOutput = (s: string | null | undefined) =>
  (s ?? "").replace(/\r\n/g, "\n").trimEnd();

/** Judge0 status id → verdict. */
function verdictOf(statusId: number | undefined, hasExpected: boolean): Verdict {
  switch (statusId) {
    case 3:
      return hasExpected ? "accepted" : "ok";
    case 4:
      return "wrong-answer";
    case 5:
      return "time-limit";
    case 6:
      return "compile-error";
    case 7:
    case 8:
    case 9:
    case 10:
    case 11:
    case 12:
      return "runtime-error";
    default:
      return "internal-error";
  }
}

const outcome = (id: string, r: Judge0Result, verdict: Verdict, passed: boolean): TestOutcome => ({
  id,
  verdict,
  passed,
  stdout: r.stdout ?? null,
  stderr: r.stderr || r.compile_output || r.message || null,
  time_ms: r.time !== null && r.time !== undefined ? parseFloat(r.time) * 1000 : null,
  memory_kb: r.memory ?? null,
  status: r.status?.description,
});

export class Judge0Runner implements CodeRunner {
  readonly name = "judge0" as const;

  supportsLanguage(language: unknown) {
    return Judge0Service.getLanguageId(language) !== null;
  }

  languages() {
    return Judge0Service.supportedLanguages().map((l) => l.key);
  }

  async run(req: RunRequest): Promise<RunResult> {
    const languageId = Judge0Service.getLanguageId(req.language);
    if (!languageId) throw new UnsupportedLanguageError(req.language);
    const entry =
      req.files.find((f) => f.path === req.entry) ?? req.files[0] ?? { path: "", content: "" };
    const cpu = req.limits?.time_s ?? 5;
    const memoryKb = (req.limits?.memory_mb ?? 256) * 1024;

    const tests: TestOutcome[] = [];
    let compile: RunResult["compile"] = null;
    for (const t of req.tests) {
      const hasExpected = t.expected_output !== undefined && t.expected_output !== null;
      let r: Judge0Result;
      if (req.interactive) {
        // Synchronous run (wait=true) and our own comparison.
        r = await Judge0Service.runSingle(entry.content, req.language, t.input ?? "", cpu, memoryKb);
      } else {
        // Grading: Judge0 compares against expected_output itself.
        const token = await Judge0Service.submit({
          source_code: entry.content,
          language_id: languageId,
          stdin: t.input,
          ...(hasExpected ? { expected_output: t.expected_output as string } : {}),
          cpu_limit: cpu,
          memory_limit: memoryKb,
        });
        r = await Judge0Service.waitAndGetResult(token);
      }
      const statusId = r.status?.id;
      let verdict = verdictOf(statusId, hasExpected);
      // Our comparison (CRLF/trailing whitespace) when Judge0 didn't compare.
      if (hasExpected && (statusId === 3 || statusId === 4) && req.interactive) {
        verdict =
          normalizeOutput(r.stdout) === normalizeOutput(t.expected_output) ? "accepted" : "wrong-answer";
      }
      if (statusId === 6) compile = { ok: false, output: r.compile_output || r.message || "" };
      tests.push(outcome(t.id, r, verdict, verdict === "accepted" || verdict === "ok"));
    }
    return { engine: this.name, compile, tests };
  }
}

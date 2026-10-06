import axios from "axios";
import { JudgeUnavailableError, UnsupportedLanguageError } from "../Judge0Service";
import { PROFILES, isWebProfile, profileById, profileIdForLanguage } from "../../tmcode/profiles";
import { CodeRunner, RunRequest, RunResult, TestOutcome, Verdict } from "./types";

/**
 * tm-judge (nga-tmcode/services/judge, PROTOCOL.md §5): our own sandboxed
 * judge on a private host. `POST /v1/run` takes every file of the answer and
 * all tests in one call. Configured by TMJUDGE_URL (default
 * http://127.0.0.1:5010) and TMJUDGE_TOKEN (sent as a Bearer token).
 */

const VERDICTS: Verdict[] = [
  "accepted",
  "wrong-answer",
  "ok",
  "runtime-error",
  "time-limit",
  "memory-limit",
  "output-limit",
  "internal-error",
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class TmJudgeRunner implements CodeRunner {
  readonly name = "tmjudge" as const;

  private get baseUrl() {
    return (process.env.TMJUDGE_URL || "http://127.0.0.1:5010").replace(/\/+$/, "");
  }

  private get headers() {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (process.env.TMJUDGE_TOKEN) h.Authorization = `Bearer ${process.env.TMJUDGE_TOKEN}`;
    return h;
  }

  /** tm-judge runs every non-web profile. */
  private profileFor(language: unknown) {
    const id = profileIdForLanguage(language);
    return id && !isWebProfile(id) ? profileById(id) ?? null : null;
  }

  supportsLanguage(language: unknown) {
    return this.profileFor(language) !== null;
  }

  languages() {
    return ["python", "javascript", "typescript", "c", "cpp", "java"].filter((l) =>
      PROFILES.some((p) => p.id === profileIdForLanguage(l)),
    );
  }

  async run(req: RunRequest): Promise<RunResult> {
    const profile = this.profileFor(req.language);
    if (!profile) throw new UnsupportedLanguageError(req.language);

    const body = {
      language: profile.id,
      entry: req.entry || profile.entry_point,
      files: req.files.map((f) => ({ path: f.path, content: f.content })),
      tests: req.tests.map((t) => ({
        id: t.id,
        input: t.input ?? "",
        ...(t.expected_output !== undefined && t.expected_output !== null
          ? { expected_output: t.expected_output }
          : {}),
      })),
      limits: {
        time_s: req.limits?.time_s ?? profile.limits.cpu_s,
        wall_s: req.limits?.wall_s ?? profile.limits.wall_s,
        memory_mb: req.limits?.memory_mb ?? profile.limits.memory_mb,
        output_kb: req.limits?.output_kb ?? profile.limits.output_kb,
      },
    };

    const data = await this.post(body);
    const compile =
      data?.compile && typeof data.compile === "object"
        ? { ok: !!data.compile.ok, output: String(data.compile.output ?? ""), time_ms: data.compile.time_ms }
        : null;
    const byId = new Map<string, any>((data?.tests ?? []).map((t: any) => [String(t.id), t]));
    const tests: TestOutcome[] = req.tests.map((t) => {
      const r = byId.get(t.id);
      if (!r) {
        return {
          id: t.id,
          verdict: compile && !compile.ok ? "compile-error" : "internal-error",
          passed: false,
          stdout: null,
          stderr: compile && !compile.ok ? compile.output : "No result from the judge",
          time_ms: null,
          memory_kb: null,
        };
      }
      const verdict: Verdict = VERDICTS.includes(r.verdict) ? r.verdict : "internal-error";
      return {
        id: t.id,
        verdict,
        passed: r.passed === true,
        stdout: r.stdout ?? null,
        stderr: r.stderr || (compile && !compile.ok ? compile.output : null) || null,
        exit_code: r.exit_code ?? null,
        time_ms: r.time_ms ?? null,
        memory_kb: r.memory_kb ?? null,
        status: verdict,
      };
    });
    return { engine: this.name, compile, tests };
  }

  /** POST /v1/run with retries on network errors, 429 and 5xx. */
  private async post(body: unknown): Promise<any> {
    const maxRetries = Number(process.env.JUDGE0_MAX_RETRIES ?? 3);
    const base = Number(process.env.JUDGE0_RETRY_BASE_MS ?? 500);
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await axios.post(`${this.baseUrl}/v1/run`, body, {
          headers: this.headers,
          timeout: 120_000,
        });
        return res.data;
      } catch (error: any) {
        const status = error?.response?.status;
        const retryable = !status || status === 429 || status >= 500;
        if (!retryable) throw new Error(`tm-judge run failed (${status})`);
        if (attempt >= maxRetries) {
          throw new JudgeUnavailableError(`tm-judge unavailable (${status ?? error?.code ?? "network"})`, status);
        }
        await sleep(base * 2 ** attempt);
      }
    }
  }
}

import axios from "axios";
import { JudgeUnavailableError, QuotaExceededError, RunnerRejectedError, UnsupportedLanguageError } from "../Judge0Service";
import { PROFILES, isWebProfile, profileById, profileIdForLanguage } from "../../tmcode/profiles";
import { CodeRunner, RunRequest, RunResult, TestOutcome, UnitReport, Verdict } from "./types";
import { judgeHas, judgeInfo, judgeRunsLanguage } from "./judgeInfo";

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
  "compile-error",
  "package-not-available",
  "internal-error",
];

/** Build files: such a project goes through the catalog (build, dependencies), not a profile. */
const MANIFEST = /(^|\/)(pom\.xml|build\.gradle(\.kts)?|package\.json|Cargo\.toml|go\.mod|CMakeLists\.txt|Makefile|makefile|[^/]+\.csproj|pyproject\.toml|requirements\.txt|composer\.json|Gemfile|mix\.exs|pubspec\.yaml|Package\.swift|build\.sbt|stack\.yaml|[^/]+\.cabal)$/;
export const hasManifest = (files: { path: string }[]) => files.some((f) => MANIFEST.test(f.path));

const UNIT_VERDICTS: UnitReport["verdict"][] = ["passed", "failed", "error", "time-limit", "memory-limit", "package-not-available", "internal-error"];
function unitOf(u: any): UnitReport | null {
  if (!u || typeof u !== "object") return null;
  const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  return {
    framework: u.framework ?? null,
    verdict: UNIT_VERDICTS.includes(u.verdict) ? u.verdict : "internal-error",
    total: n(u.total),
    passed: n(u.passed),
    failed: n(u.failed),
    skipped: n(u.skipped),
    errors: n(u.errors),
    time_ms: u.time_ms ?? null,
    output: String(u.output ?? ""),
    truncated: !!u.truncated,
    tests: (Array.isArray(u.tests) ? u.tests : []).slice(0, 500).map((t: any) => ({
      id: String(t.id ?? t.name ?? ""),
      name: String(t.name ?? t.id ?? ""),
      group: t.group ?? null,
      file: t.file ?? null,
      line: t.line ?? null,
      status: ["passed", "failed", "skipped", "error"].includes(t.status) ? t.status : "error",
      durationMs: t.durationMs ?? null,
      message: t.message ?? null,
      details: t.details ?? null,
    })),
  };
}

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

  /** A fixed profile, or (tm-judge with "projects") any catalog language it has. */
  supportsLanguage(language: unknown) {
    return this.profileFor(language) !== null || (typeof language === "string" && judgeRunsLanguage(language));
  }

  languages() {
    const own = ["python", "javascript", "typescript", "c", "cpp", "java"].filter((l) => PROFILES.some((p) => p.id === profileIdForLanguage(l)));
    const catalog = judgeHas("projects") ? [...judgeInfo().languages].filter((l) => !own.includes(l) && l !== "web" && l !== "logic") : [];
    return [...own, ...catalog];
  }

  async run(req: RunRequest): Promise<RunResult> {
    const profile = this.profileFor(req.language);
    const asProject = judgeHas("projects") && (!!req.kind || !!req.actions?.includes("test") || !profile || hasManifest(req.files));
    if (asProject) return this.runProject(req);
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

  /** GET /v1/health: is tm-judge up, which toolchains it found, its queue. */
  async health(): Promise<{ ok: boolean; status?: number; error?: string; data?: any }> {
    try {
      const res = await axios.get(`${this.baseUrl}/v1/health`, { headers: this.headers, timeout: 3000 });
      return { ok: true, status: res.status, data: res.data };
    } catch (error: any) {
      return { ok: false, status: error?.response?.status, error: error?.code || error?.message || "unreachable" };
    }
  }

  /** A catalog project (PROTOCOL.md §5.2): build, run the I/O tests and/or the unit tests. */
  private async runProject(req: RunRequest): Promise<RunResult> {
    if (!req.kind && !judgeRunsLanguage(req.language)) throw new UnsupportedLanguageError(req.language);
    const body = {
      ...(req.kind ? { kind: req.kind } : {}),
      language: req.language,
      ...(req.entry ? { entry: req.entry } : {}),
      files: req.files.map((f) => ({ path: f.path, content: f.content })),
      // Tests run on a built project: tm-judge's "test" alone skips the build step,
      // which CMake/Make projects need (ctest only runs what was built). Kinds
      // without a build step ignore "build".
      ...(req.actions ? { actions: req.actions.includes("test") && !req.actions.includes("build") ? ["build", ...req.actions] : req.actions } : {}),
      tests: req.tests.map((t) => ({
        id: t.id,
        input: t.input ?? "",
        ...(t.expected_output !== undefined && t.expected_output !== null ? { expected_output: t.expected_output } : {}),
      })),
      ...(req.test_filter ? { test_filter: req.test_filter } : {}),
      ...(req.limits ? { limits: req.limits } : {}),
    };
    const data = await this.post(body, 150_000);
    const compile =
      data?.compile && typeof data.compile === "object" ? { ok: !!data.compile.ok, output: String(data.compile.output ?? ""), time_ms: data.compile.time_ms } : null;
    const byId = new Map<string, any>((data?.tests ?? []).map((t: any) => [String(t.id), t]));
    const tests: TestOutcome[] = req.tests.map((t) => {
      const r = byId.get(t.id);
      const verdict: Verdict = r && VERDICTS.includes(r.verdict) ? r.verdict : compile && !compile.ok ? "compile-error" : "internal-error";
      return {
        id: t.id,
        verdict,
        passed: r?.passed === true,
        stdout: r?.stdout ?? null,
        stderr: r?.stderr || (compile && !compile.ok ? compile.output : null) || (r ? null : "No result from the judge"),
        exit_code: r?.exit_code ?? null,
        time_ms: r?.time_ms ?? null,
        memory_kb: r?.memory_kb ?? null,
        status: verdict,
      };
    });
    return {
      engine: this.name,
      kind: data?.kind ?? req.kind,
      compile,
      tests,
      unit: unitOf(data?.unit),
      error: data?.error && typeof data.error === "object" ? { code: String(data.error.code), manager: data.error.manager, package: data.error.package ?? null, message: String(data.error.message ?? "") } : null,
    };
  }

  /** POST /v1/run with retries on network errors, 429 and 5xx. */
  private async post(body: unknown, timeoutMs = 120_000): Promise<any> {
    const maxRetries = Number(process.env.JUDGE0_MAX_RETRIES ?? 3);
    const base = Number(process.env.JUDGE0_RETRY_BASE_MS ?? 500);
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await axios.post(`${this.baseUrl}/v1/run`, body, {
          headers: this.headers,
          timeout: timeoutMs,
        });
        return res.data;
      } catch (error: any) {
        const status = error?.response?.status;
        const retryable = !status || status === 429 || status >= 500;
        if (!retryable) {
          const detail = typeof error?.response?.data?.error === "string" ? error.response.data.error : "";
          throw new RunnerRejectedError(`The code runner refused the request (${status})${detail ? `: ${detail}` : ""}.`, status, detail);
        }
        if (attempt >= maxRetries) {
          if (status === 429) throw new QuotaExceededError();
          throw new JudgeUnavailableError(`tm-judge unavailable (${status ?? error?.code ?? "network"})`, status);
        }
        await sleep(base * 2 ** attempt);
      }
    }
  }
}

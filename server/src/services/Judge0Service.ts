import axios, { AxiosResponse } from "axios";
import dotenv from "dotenv";

dotenv.config();

export interface Judge0Submission {
  source_code: string;
  language_id: number;
  stdin?: string;
  expected_output?: string;
  cpu_limit?: number;
  memory_limit?: number;
}

export interface Judge0Result {
  stdout: string | null;
  time: string | null;
  memory: number | null;
  stderr: string | null;
  token: string;
  compile_output: string | null;
  message: string | null;
  status: {
    id: number;
    description: string;
  };
}

/** A language the judge can run (GET /api/quizzes/code-languages). */
export interface SupportedLanguage {
  /** Key stored on questions and answers, e.g. "python". */
  key: string;
  label: string;
  judge_language_id: number;
  /** The judge's own runtime name, e.g. "Python (3.8.1)", when known. */
  runtime: string | null;
}

/** Thrown when a run asks for a language the judge has no runtime for. */
export class UnsupportedLanguageError extends Error {
  code = "UNSUPPORTED_LANGUAGE" as const;
  constructor(public language: unknown) {
    super(`Unsupported language: ${String(language)}`);
  }
}

/**
 * The judge couldn't be reached or is overloaded (network error, 429, 5xx,
 * or no result in time), after retries. Grading treats this as "not graded
 * yet" (grade_status pending, re-graded later), never as a wrong answer.
 */
export class JudgeUnavailableError extends Error {
  code = "JUDGE_UNAVAILABLE" as const;
  constructor(message = "Judge unavailable", public status?: number) {
    super(message);
  }
}

/** Other spellings of the canonical keys below. */
const LANGUAGE_ALIASES: Record<string, string> = {
  js: "javascript",
  node: "javascript",
  nodejs: "javascript",
  ts: "typescript",
  py: "python",
  python3: "python",
  "c++": "cpp",
  "c#": "csharp",
  cs: "csharp",
  rb: "ruby",
  rs: "rust",
  golang: "go",
  kt: "kotlin",
};

/**
 * Language ids of the stock Judge0 CE image (the RapidAPI-hosted judge).
 * Only used until (or when) the judge's own GET /languages can't be read —
 * see Judge0Service.loadLanguages, which picks the newest runtime instead.
 */
const FALLBACK_LANGUAGE_IDS: Record<string, number> = {
  javascript: 63, // Node.js 12.14.0
  typescript: 74, // TypeScript 3.7.4
  python: 71, // Python 3.8.1
  java: 62, // Java (OpenJDK 13.0.1)
  cpp: 54, // C++ (GCC 9.2.0)
  c: 50, // C (GCC 9.2.0)
  csharp: 51, // C# (Mono 6.6.0.161)
  ruby: 72, // Ruby 2.7.0
  go: 60, // Go 1.13.5
  rust: 73, // Rust 1.40.0
  php: 68, // PHP 7.4.1
  kotlin: 78, // Kotlin 1.3.70
  swift: 83, // Swift 5.2.3
};

/**
 * How each language's runtimes are named in the judge's GET /languages, with
 * the version captured: e.g. "Python (3.8.1)", "JavaScript (Node.js
 * 12.14.0)", "C++ (GCC 9.2.0)", "Java (OpenJDK 13.0.1)". The newest version
 * per language wins.
 */
const RUNTIME_PATTERNS: Record<string, RegExp> = {
  javascript: /^JavaScript \(Node\.js ([\d.]+)\)/i,
  typescript: /^TypeScript \(([\d.]+)\)/i,
  python: /^Python \((3[\d.]*)\)/i,
  java: /^Java \((?:OpenJDK|JDK) ([\d.]+)\)/i,
  cpp: /^C\+\+ \(GCC ([\d.]+)\)/i,
  c: /^C \(GCC ([\d.]+)\)/i,
  csharp: /^C# \(Mono ([\d.]+)\)/i,
  ruby: /^Ruby \(([\d.]+)\)/i,
  go: /^Go \(([\d.]+)\)/i,
  rust: /^Rust \(([\d.]+)\)/i,
  php: /^PHP \(([\d.]+)\)/i,
  kotlin: /^Kotlin \(([\d.]+)\)/i,
  swift: /^Swift \(([\d.]+)\)/i,
};

/** -1 / 0 / 1 comparing dotted versions numerically ("3.11.2" > "3.8.1"). */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

/** The newest runtime per language from a GET /languages list. */
export function pickNewestRuntimes(
  list: Array<{ id: number; name: string }>,
): Record<string, { id: number; name: string; version: string }> {
  const out: Record<string, { id: number; name: string; version: string }> = {};
  for (const lang of list) {
    if (!lang || typeof lang.id !== "number" || typeof lang.name !== "string") continue;
    for (const [key, re] of Object.entries(RUNTIME_PATTERNS)) {
      const m = lang.name.match(re);
      if (!m) continue;
      const cur = out[key];
      if (!cur || compareVersions(m[1], cur.version) > 0) {
        out[key] = { id: lang.id, name: lang.name, version: m[1] };
      }
    }
  }
  return out;
}

/** Quota headers RapidAPI adds to judge responses. */
export interface JudgeQuota {
  remaining: number;
  limit: number;
  header: string;
  at: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const LANGUAGE_LABELS: Record<string, string> = {
  javascript: "JavaScript",
  typescript: "TypeScript",
  python: "Python",
  java: "Java",
  cpp: "C++",
  c: "C",
  csharp: "C#",
  ruby: "Ruby",
  go: "Go",
  rust: "Rust",
  php: "PHP",
  kotlin: "Kotlin",
  swift: "Swift",
};

export class Judge0Service {
  private static readonly BASE_URL =
    process.env.JUDGE0_URL || "http://localhost:2358";
  private static readonly API_KEY = process.env.JUDGE0_API_KEY || "";

  /** Runtimes read from the judge (GET /languages); null = static fallback. */
  private static runtimes: Record<string, { id: number; name: string; version: string }> | null =
    null;
  private static quota: JudgeQuota | null = null;
  private static lastQuotaWarning = 0;

  private static get headers() {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.API_KEY) {
      headers["x-rapidapi-key"] = this.API_KEY;
      headers["x-rapidapi-host"] =
        process.env.JUDGE0_RAPIDAPI_HOST || "judge0-ce.p.rapidapi.com";
    }
    return headers;
  }

  // ─── Resilience: retries, quota ────────────────────────────────────────────

  private static get maxRetries() {
    const n = Number(process.env.JUDGE0_MAX_RETRIES);
    return Number.isFinite(n) && n >= 0 ? n : 3;
  }

  private static get retryBaseMs() {
    const n = Number(process.env.JUDGE0_RETRY_BASE_MS);
    return Number.isFinite(n) && n >= 0 ? n : 500;
  }

  /** Network errors, 429 and 5xx are worth retrying; other 4xx are not. */
  private static isRetryable(error: any): boolean {
    const status = error?.response?.status;
    return !status || status === 429 || status >= 500;
  }

  /**
   * Run a judge request, retrying network errors, 429 and 5xx with
   * exponential backoff (honouring Retry-After, capped at 10 s). Throws
   * JudgeUnavailableError when the judge stays unavailable.
   */
  private static async request<T>(what: string, fn: () => Promise<AxiosResponse<T>>): Promise<T> {
    let attempt = 0;
    for (;;) {
      try {
        const response = await fn();
        this.recordQuota(response.headers);
        return response.data;
      } catch (error: any) {
        this.recordQuota(error?.response?.headers);
        const status = error?.response?.status;
        if (!this.isRetryable(error)) {
          console.error(`Judge0 ${what} error:`, error.response?.data || error.message);
          throw new Error(`Judge0 ${what} failed (${status})`);
        }
        if (attempt >= this.maxRetries) {
          console.error(
            `Judge0 ${what} unavailable after ${attempt + 1} tries:`,
            status ?? error?.code ?? error?.message,
          );
          throw new JudgeUnavailableError(`Judge unavailable (${status ?? error?.code ?? "network"})`, status);
        }
        const retryAfter = Number(error?.response?.headers?.["retry-after"]);
        const backoff = Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(retryAfter * 1000, 10_000)
          : this.retryBaseMs * 2 ** attempt;
        attempt++;
        await sleep(backoff);
      }
    }
  }

  /** Remember RapidAPI's quota headers; warn when under 20 % is left. */
  private static recordQuota(headers: any) {
    if (!headers) return;
    for (const kind of ["submissions", "requests"]) {
      const remaining = Number(headers[`x-ratelimit-${kind}-remaining`]);
      const limit = Number(headers[`x-ratelimit-${kind}-limit`]);
      if (!Number.isFinite(remaining) || !Number.isFinite(limit) || limit <= 0) continue;
      this.quota = { remaining, limit, header: kind, at: new Date().toISOString() };
      const now = Date.now();
      if (remaining / limit < 0.2 && now - this.lastQuotaWarning > 10 * 60_000) {
        this.lastQuotaWarning = now;
        console.warn(
          `[judge0] quota low: ${remaining}/${limit} ${kind} left (under 20 %). ` +
            "Exam grading will be left pending if it runs out.",
        );
      }
      return;
    }
  }

  /** The last quota the judge reported (null for a self-hosted judge). */
  static quotaStatus(): JudgeQuota | null {
    return this.quota;
  }

  // ─── Languages ─────────────────────────────────────────────────────────────

  /**
   * Read the judge's GET /languages and map each language to the newest
   * runtime it offers (logged). Keeps the static ids when the judge can't be
   * reached. Called at server start and by the daily health check.
   */
  static async loadLanguages(): Promise<boolean> {
    try {
      const list = await this.request<Array<{ id: number; name: string }>>("languages", () =>
        axios.get(`${this.BASE_URL}/languages`, { headers: this.headers, timeout: 15_000 }),
      );
      const picked = pickNewestRuntimes(Array.isArray(list) ? list : []);
      if (Object.keys(picked).length === 0) throw new Error("no known runtimes in /languages");
      this.runtimes = picked;
      console.log(
        "[judge0] runtimes:",
        Object.entries(picked)
          .map(([k, v]) => `${k}=${v.id} ${v.name}`)
          .join("; "),
      );
      return true;
    } catch (error: any) {
      console.warn(
        "[judge0] couldn't read /languages, using the built-in language ids:",
        error?.message,
      );
      return false;
    }
  }

  /** Test hook: forget what loadLanguages read. */
  static resetLanguageCache() {
    this.runtimes = null;
    this.quota = null;
    this.lastQuotaWarning = 0;
  }

  /**
   * Daily check: the judge answers and still has quota. Logs a warning
   * otherwise (the admin alert channel is the server log for now).
   */
  static async healthCheck(): Promise<{ ok: boolean; quota: JudgeQuota | null }> {
    const ok = await this.loadLanguages();
    if (!ok) console.warn("[judge0] health check failed: the judge is unreachable");
    const q = this.quota;
    if (q) console.log(`[judge0] quota: ${q.remaining}/${q.limit} ${q.header} left`);
    return { ok, quota: q };
  }

  /**
   * Canonical key for a language name as stored on questions/answers
   * ("py" → "python", "C++" → "cpp"), or null when it isn't a language the
   * judge runs.
   */
  static normalizeLanguage(language: unknown): string | null {
    if (typeof language !== "string") return null;
    const raw = language.trim().toLowerCase();
    if (!raw) return null;
    const key = LANGUAGE_ALIASES[raw] ?? raw;
    return Object.prototype.hasOwnProperty.call(FALLBACK_LANGUAGE_IDS, key)
      ? key
      : null;
  }

  /**
   * Judge0 language id for a language — the newest runtime the judge
   * offers — or null when the judge has no runtime for it. There is
   * deliberately no default: running a Python answer as Node.js (the old
   * `|| 63`) silently mis-graded it. Callers refuse with
   * UNSUPPORTED_LANGUAGE (runs) or leave the answer for manual review
   * (grading).
   */
  static getLanguageId(language: unknown): number | null {
    const key = this.normalizeLanguage(language);
    if (!key) return null;
    if (this.runtimes) return this.runtimes[key]?.id ?? null;
    return FALLBACK_LANGUAGE_IDS[key];
  }

  /** Every language the judge can run, with its runtime when known. */
  static supportedLanguages(): SupportedLanguage[] {
    return Object.keys(FALLBACK_LANGUAGE_IDS)
      .filter((key) => !this.runtimes || this.runtimes[key])
      .map((key) => ({
        key,
        label: LANGUAGE_LABELS[key] ?? key,
        judge_language_id: this.runtimes?.[key]?.id ?? FALLBACK_LANGUAGE_IDS[key],
        runtime: this.runtimes?.[key]?.name ?? null,
      }));
  }

  // ─── Running code ──────────────────────────────────────────────────────────

  /**
   * Submits code to Judge0 for execution
   */
  static async submit(submission: Judge0Submission): Promise<string> {
    const data = await this.request<{ token: string }>("submission", () =>
      axios.post(
        `${this.BASE_URL}/submissions?base64_encoded=false&wait=false`,
        submission,
        { headers: this.headers },
      ),
    );
    return data.token;
  }

  /**
   * Fetches the result of a submission by token
   */
  static async getResult(token: string): Promise<Judge0Result> {
    return this.request<Judge0Result>("result", () =>
      axios.get(`${this.BASE_URL}/submissions/${token}?base64_encoded=false`, {
        headers: this.headers,
      }),
    );
  }

  /**
   * Waits for a submission to complete and returns the result. No result in
   * time means the judge is overloaded: JudgeUnavailableError.
   */
  static async waitAndGetResult(
    token: string,
    maxRetries = 10,
  ): Promise<Judge0Result> {
    let retries = 0;
    while (retries < maxRetries) {
      const result = await this.getResult(token);
      // Status IDs 1 (In Queue) and 2 (Processing) mean it's not done yet
      if (result.status.id > 2) {
        return result;
      }
      retries++;
      await sleep(1000);
    }
    throw new JudgeUnavailableError("Judge0 execution timed out");
  }

  /**
   * Synchronously runs a single snippet of code with optional stdin.
   * Uses wait=true for instant low-latency "Run" feature.
   */
  static async runSingle(
    code: string,
    language: string,
    stdin?: string,
    cpuLimit = 5,
    memoryLimit = 262144,
  ): Promise<Judge0Result> {
    const languageId = this.getLanguageId(language);
    if (!languageId) throw new UnsupportedLanguageError(language);
    return this.request<Judge0Result>("run", () =>
      axios.post(
        `${this.BASE_URL}/submissions?base64_encoded=false&wait=true`,
        {
          source_code: code,
          language_id: languageId,
          stdin: stdin || "",
          cpu_time_limit: cpuLimit,
          memory_limit: memoryLimit,
        },
        { headers: this.headers },
      ),
    );
  }
}

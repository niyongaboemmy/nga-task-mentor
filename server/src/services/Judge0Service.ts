import axios from "axios";
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

  /**
   * Submits code to Judge0 for execution
   */
  static async submit(submission: Judge0Submission): Promise<string> {
    try {
      const response = await axios.post(
        `${this.BASE_URL}/submissions?base64_encoded=false&wait=false`,
        submission,
        { headers: this.headers },
      );
      return response.data.token;
    } catch (error: any) {
      console.error(
        "Judge0 submission error:",
        error.response?.data || error.message,
      );
      throw new Error("Failed to submit code to Judge0");
    }
  }

  /**
   * Fetches the result of a submission by token
   */
  static async getResult(token: string): Promise<Judge0Result> {
    try {
      const response = await axios.get(
        `${this.BASE_URL}/submissions/${token}?base64_encoded=false`,
        { headers: this.headers },
      );
      return response.data;
    } catch (error: any) {
      console.error(
        "Judge0 fetch error:",
        error.response?.data || error.message,
      );
      throw new Error("Failed to fetch result from Judge0");
    }
  }

  /**
   * Waits for a submission to complete and returns the result
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
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error("Judge0 execution timed out");
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
   * Judge0 language id for a language, or null when the judge has no runtime
   * for it. There is deliberately no default: running a Python answer as
   * Node.js (the old `|| 63`) silently mis-graded it. Callers refuse with
   * UNSUPPORTED_LANGUAGE (runs) or leave the answer for manual review
   * (grading).
   */
  static getLanguageId(language: unknown): number | null {
    const key = this.normalizeLanguage(language);
    return key ? FALLBACK_LANGUAGE_IDS[key] : null;
  }

  /** Every language the judge can run, for authors and validation. */
  static supportedLanguages(): SupportedLanguage[] {
    return Object.keys(FALLBACK_LANGUAGE_IDS).map((key) => ({
      key,
      label: LANGUAGE_LABELS[key] ?? key,
      judge_language_id: FALLBACK_LANGUAGE_IDS[key],
      runtime: null,
    }));
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
    try {
      const response = await axios.post(
        `${this.BASE_URL}/submissions?base64_encoded=false&wait=true`,
        {
          source_code: code,
          language_id: languageId,
          stdin: stdin || "",
          cpu_time_limit: cpuLimit,
          memory_limit: memoryLimit,
        },
        { headers: this.headers },
      );
      return response.data as Judge0Result;
    } catch (error: any) {
      console.error(
        "Judge0 runSingle error:",
        error.response?.data || error.message,
      );
      throw new Error("Failed to execute code");
    }
  }
}

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

export class Judge0Service {
  private static readonly BASE_URL =
    process.env.JUDGE0_URL || "http://localhost:2358";
  private static readonly API_KEY = process.env.JUDGE0_API_KEY || "";

  private static get headers() {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.API_KEY) {
      headers["X-Auth-Token"] = this.API_KEY;
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
   * Maps common language names to Judge0 language IDs
   * Note: These IDs are based on the default Judge0 configuration.
   * You might want to fetch these dynamically from /languages in a production environment.
   */
  static getLanguageId(language: string): number {
    const mapping: Record<string, number> = {
      javascript: 63, // Node.js 12.14.0
      js: 63,
      typescript: 74, // TypeScript 3.7.4
      ts: 74,
      python: 71, // Python 3.8.1
      py: 71,
      java: 62, // Java (OpenJDK 13.0.1)
      cpp: 54, // C++ (GCC 9.2.0)
      "c++": 54,
      c: 50, // C (GCC 9.2.0)
      csharp: 51, // C# (Mono 6.6.0.161)
      "c#": 51,
      ruby: 72, // Ruby 2.7.0
      rb: 72,
      go: 60, // Go 1.13.5
      rust: 73, // Rust 1.40.0
      rs: 73,
      php: 68, // PHP 7.4.1
      kotlin: 78, // Kotlin 1.3.70
      swift: 83, // Swift 5.2.3
    };
    return mapping[language.toLowerCase()] || 63; // Default to Node.js
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

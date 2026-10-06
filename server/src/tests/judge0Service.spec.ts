import axios from "axios";
import {
  Judge0Service,
  JudgeUnavailableError,
  compareVersions,
  pickNewestRuntimes,
} from "../services/Judge0Service";
import { aiService } from "../services/ai/aiService";
import { AdvancedQuizGrader, isPendingGrade } from "../utils/quizGrader";

/**
 * TM-FIX-6 interim: runtimes from the judge's own /languages, retries with
 * backoff, quota logging, and "judge down" never scoring 0. axios is
 * stubbed: nothing here reaches RapidAPI.
 */

// The judge's GET /languages on an instance with old and new runtimes.
const LANGUAGES = [
  { id: 63, name: "JavaScript (Node.js 12.14.0)" },
  { id: 93, name: "JavaScript (Node.js 18.15.0)" },
  { id: 70, name: "Python (2.7.17)" },
  { id: 71, name: "Python (3.8.1)" },
  { id: 92, name: "Python (3.11.2)" },
  { id: 62, name: "Java (OpenJDK 13.0.1)" },
  { id: 91, name: "Java (JDK 17.0.6)" },
  { id: 54, name: "C++ (GCC 9.2.0)" },
  { id: 105, name: "C++ (GCC 14.1.0)" },
  { id: 76, name: "C++ (Clang 7.0.1)" },
  { id: 50, name: "C (GCC 9.2.0)" },
  { id: 82, name: "SQL (SQLite 3.27.2)" },
];

const axiosError = (status: number, headers: Record<string, string> = {}) =>
  Object.assign(new Error(`HTTP ${status}`), { response: { status, headers, data: {} } });

const ok = (data: any, headers: Record<string, string> = {}) => ({
  data,
  headers,
  status: 200,
  statusText: "OK",
  config: {} as any,
});

const ACCEPTED = {
  stdout: "3",
  stderr: null,
  compile_output: null,
  message: null,
  time: "0.01",
  memory: 1,
  token: "t",
  status: { id: 3, description: "Accepted" },
};

beforeEach(() => {
  jest.restoreAllMocks();
  Judge0Service.resetLanguageCache();
  process.env.JUDGE0_RETRY_BASE_MS = "1";
  process.env.JUDGE0_MAX_RETRIES = "3";
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});

describe("runtimes from GET /languages", () => {
  it("compareVersions", () => {
    expect(compareVersions("3.11.2", "3.8.1")).toBe(1);
    expect(compareVersions("12.14.0", "18.15.0")).toBe(-1);
    expect(compareVersions("1.0", "1.0.0")).toBe(0);
  });

  it("picks the newest runtime per language (Python 3 only, GCC for C/C++)", () => {
    const picked = pickNewestRuntimes(LANGUAGES);
    expect(picked.javascript.id).toBe(93);
    expect(picked.python.id).toBe(92);
    expect(picked.java.id).toBe(91);
    expect(picked.cpp.id).toBe(105);
    expect(picked.c.id).toBe(50);
  });

  it("loadLanguages: getLanguageId and the authors' list use the judge's newest runtimes", async () => {
    const get = jest.spyOn(axios, "get").mockResolvedValue(ok(LANGUAGES));
    expect(await Judge0Service.loadLanguages()).toBe(true);
    expect(get.mock.calls[0][0]).toMatch(/\/languages$/);
    expect(Judge0Service.getLanguageId("python")).toBe(92);
    expect(Judge0Service.getLanguageId("js")).toBe(93);
    const py = Judge0Service.supportedLanguages().find((l) => l.key === "python");
    expect(py).toEqual({ key: "python", label: "Python", judge_language_id: 92, runtime: "Python (3.11.2)" });
    // languages this judge doesn't offer are not offered to authors
    expect(Judge0Service.supportedLanguages().map((l) => l.key)).not.toContain("rust");
    expect(Judge0Service.getLanguageId("rust")).toBeNull();
  });

  it("falls back to the built-in ids when the judge can't be reached", async () => {
    jest.spyOn(axios, "get").mockRejectedValue(axiosError(503));
    expect(await Judge0Service.loadLanguages()).toBe(false);
    expect(Judge0Service.getLanguageId("python")).toBe(71);
    expect(Judge0Service.supportedLanguages().find((l) => l.key === "rust")?.runtime).toBeNull();
  });
});

describe("retries and quota", () => {
  it("retries 429/5xx with backoff, then succeeds", async () => {
    const post = jest
      .spyOn(axios, "post")
      .mockRejectedValueOnce(axiosError(429))
      .mockRejectedValueOnce(axiosError(502))
      .mockResolvedValueOnce(ok(ACCEPTED));
    const r = await Judge0Service.runSingle("print(3)", "python");
    expect(r.status.id).toBe(3);
    expect(post).toHaveBeenCalledTimes(3);
  });

  it("gives up with JudgeUnavailableError when the judge stays down", async () => {
    const post = jest.spyOn(axios, "post").mockRejectedValue(axiosError(503));
    await expect(Judge0Service.runSingle("print(3)", "python")).rejects.toBeInstanceOf(
      JudgeUnavailableError,
    );
    expect(post).toHaveBeenCalledTimes(4); // 1 + 3 retries
  });

  it("network errors count as unavailable too", async () => {
    jest.spyOn(axios, "post").mockRejectedValue(Object.assign(new Error("ECONNRESET"), { code: "ECONNRESET" }));
    await expect(Judge0Service.submit({ source_code: "x", language_id: 71 })).rejects.toBeInstanceOf(
      JudgeUnavailableError,
    );
  });

  it("doesn't retry other 4xx (a bad request won't get better)", async () => {
    const post = jest.spyOn(axios, "post").mockRejectedValue(axiosError(422));
    await expect(Judge0Service.runSingle("x", "python")).rejects.not.toBeInstanceOf(
      JudgeUnavailableError,
    );
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("records RapidAPI quota headers and warns under 20 %", async () => {
    jest.spyOn(axios, "post").mockResolvedValue(
      ok(ACCEPTED, {
        "x-ratelimit-submissions-remaining": "15",
        "x-ratelimit-submissions-limit": "100",
      }),
    );
    await Judge0Service.runSingle("print(3)", "python");
    expect(Judge0Service.quotaStatus()).toMatchObject({ remaining: 15, limit: 100, header: "submissions" });
    expect(console.warn).toHaveBeenCalledWith(expect.stringMatching(/quota low: 15\/100/));
  });
});

describe("grading while the judge is down", () => {
  it("leaves the answer pending ('will re-grade'), never 0 as if wrong", async () => {
    jest.spyOn(aiService, "gradeCoding").mockRejectedValue(new Error("no AI"));
    jest.spyOn(axios, "post").mockRejectedValue(axiosError(429));
    const r = await AdvancedQuizGrader.gradeWithConfig(
      {
        id: 1,
        points: 5,
        questionBank: {
          question_type: "coding",
          question_data: {
            language: "python",
            test_cases: [{ id: "t", input: "1", expected_output: "1", points: 1 }],
          },
        },
      } as any,
      { code: "print(1)", language: "python" },
    );
    expect(isPendingGrade(r)).toBe(true);
    expect(r.feedback).toBe("Judge unavailable – will re-grade.");
    expect((r.detailed_feedback as any).judge_unavailable).toBe(true);
  });
});

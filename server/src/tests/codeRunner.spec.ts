import axios from "axios";
import { aiService } from "../services/ai/aiService";
import { Judge0Service, JudgeUnavailableError, RunnerRejectedError } from "../services/Judge0Service";
import { answerFiles, getCodeRunner, RoutedRunner, TmJudgeRunner } from "../services/coderunner";
import { resetRunStats, runStats } from "../services/coderunner/stats";
import { AdvancedQuizGrader, isPendingGrade } from "../utils/quizGrader";

/** CodeRunner (plan §8.3): engine switch, tm-judge wire format, grading through it. */

const ENV = { ...process.env };

beforeEach(() => {
  jest.restoreAllMocks();
  process.env.JUDGE0_RETRY_BASE_MS = "1";
  process.env.JUDGE0_MAX_RETRIES = "2";
  process.env.TMJUDGE_URL = "http://judge.test:5010";
  process.env.TMJUDGE_TOKEN = "secret-token";
  jest.spyOn(aiService, "gradeCoding").mockRejectedValue(new Error("no AI"));
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});
afterAll(() => {
  process.env = ENV;
});

const judgeResponse = (tests: Array<{ id: string; passed: boolean; stdout?: string }>) => ({
  data: {
    language: "python-3",
    sandbox: "isolate",
    compile: null,
    tests: tests.map((t) => ({
      id: t.id,
      verdict: t.passed ? "accepted" : "wrong-answer",
      passed: t.passed,
      stdout: t.stdout ?? "",
      stderr: "",
      exit_code: 0,
      time_ms: 12,
      memory_kb: 7000,
    })),
  },
});

function question(data: Record<string, any>, points = 4) {
  return {
    id: 1,
    points,
    questionBank: {
      question_type: "coding",
      question_text: "Sum",
      question_data: {
        language: "python",
        test_cases: [
          { id: "a", input: "1 2", expected_output: "3", points: 1, is_hidden: false },
          { id: "b", input: "2 2", expected_output: "4", points: 3, is_hidden: true },
        ],
        ...data,
      },
    },
  } as any;
}

describe("engine switch", () => {
  it("CODERUNNER_ENGINE picks the runner (default judge0)", () => {
    delete process.env.CODERUNNER_ENGINE;
    expect(getCodeRunner().name).toBe("judge0");
    process.env.CODERUNNER_ENGINE = "tmjudge";
    expect(getCodeRunner().name).toBe("tmjudge");
  });

  it("tm-judge runs the TMCode profile languages only", () => {
    const r = new TmJudgeRunner();
    expect(r.supportsLanguage("python")).toBe(true);
    expect(r.supportsLanguage("c++")).toBe(true);
    expect(r.supportsLanguage("go")).toBe(false);
    expect(r.supportsLanguage("html")).toBe(false); // web grader, not the judge
  });
});

describe("answerFiles", () => {
  it("one file named after the profile's entry point", () => {
    expect(answerFiles("print(1)", "python")).toEqual({
      files: [{ path: "main.py", content: "print(1)" }],
      entry: "main.py",
    });
    expect(answerFiles("class Main{}", "java").entry).toBe("Main.java");
  });
  it("a project-mode answer keeps every file and its entry point", () => {
    const code = JSON.stringify([
      { name: "util.py", content: "X=1" },
      { name: "app.py", content: "import util", is_entry_point: true },
    ]);
    expect(answerFiles(code, "python")).toEqual({
      files: [
        { path: "util.py", content: "X=1" },
        { path: "app.py", content: "import util" },
      ],
      entry: "app.py",
    });
  });
});

describe("grading on tm-judge", () => {
  beforeEach(() => {
    process.env.CODERUNNER_ENGINE = "tmjudge";
  });

  it("sends every file and all tests in one POST /v1/run with the profile id", async () => {
    const post = jest
      .spyOn(axios, "post")
      .mockResolvedValue(judgeResponse([{ id: "a", passed: true }, { id: "b", passed: false }]) as any);
    const code = JSON.stringify([
      { name: "main.py", content: "import helper", is_entry_point: true },
      { name: "helper.py", content: "def f(): pass" },
    ]);
    const r = await AdvancedQuizGrader.gradeWithConfig(question({ project_mode: true }), {
      code,
      language: "python",
    });
    expect(post).toHaveBeenCalledTimes(1);
    const [url, body, cfg] = post.mock.calls[0] as any[];
    expect(url).toBe("http://judge.test:5010/v1/run");
    expect(cfg.headers.Authorization).toBe("Bearer secret-token");
    expect(body).toMatchObject({
      language: "python-3",
      entry: "main.py",
      files: [
        { path: "main.py", content: "import helper" },
        { path: "helper.py", content: "def f(): pass" },
      ],
      tests: [
        { id: "a", input: "1 2", expected_output: "3" },
        { id: "b", input: "2 2", expected_output: "4" },
      ],
    });
    // weighted by test points: 1 of 4
    expect(r.points_earned).toBe(1);
    const d: any = r.detailed_feedback;
    expect(d.testResults.map((t: any) => t.passed)).toEqual([true, false]);
    expect(d.testResults[1]).toMatchObject({ is_hidden: true, verdict: "wrong-answer" });
  });

  it("tm-judge down → pending (judge_unavailable), never 0 as if wrong", async () => {
    jest.spyOn(axios, "post").mockRejectedValue(
      Object.assign(new Error("503"), { response: { status: 503, headers: {} } }),
    );
    const r = await AdvancedQuizGrader.gradeWithConfig(question({}), { code: "print(3)", language: "python" });
    expect(isPendingGrade(r)).toBe(true);
    expect((r.detailed_feedback as any).judge_unavailable).toBe(true);
  });

  it("a language tm-judge doesn't run is left for review, not run elsewhere", async () => {
    const post = jest.spyOn(axios, "post");
    const submit = jest.spyOn(Judge0Service, "submit");
    const r = await AdvancedQuizGrader.gradeWithConfig(question({ language: "go" }), {
      code: "package main",
      language: "go",
    });
    expect(post).not.toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
    expect(isPendingGrade(r)).toBe(true);
  });

  it("the runner surfaces JudgeUnavailableError", async () => {
    jest.spyOn(axios, "post").mockRejectedValue(Object.assign(new Error("x"), { code: "ECONNREFUSED" }));
    await expect(
      new TmJudgeRunner().run({ language: "python", files: [{ path: "main.py", content: "" }], tests: [] }),
    ).rejects.toBeInstanceOf(JudgeUnavailableError);
  });
});

describe("routing between tm-judge and Judge0", () => {
  const ok = (engine: string) => ({ engine, compile: null, tests: [{ id: "1", verdict: "ok", passed: true, stdout: "hi", stderr: null, time_ms: 1, memory_kb: 1 }] }) as any;
  const fake = (name: "tmjudge" | "judge0", langs: string[], run: jest.Mock) =>
    ({ name, supportsLanguage: (l: unknown) => langs.includes(String(l)), languages: () => langs, run }) as any;
  const req = (language: string) => ({ language, files: [{ path: "main", content: "x" }], tests: [{ id: "1", input: "" }] });

  it("tm-judge runs its languages; Judge0 the ones tm-judge lacks", async () => {
    const tm = jest.fn().mockResolvedValue(ok("tmjudge"));
    const j0 = jest.fn().mockResolvedValue(ok("judge0"));
    const r = new RoutedRunner(fake("tmjudge", ["python"], tm), fake("judge0", ["python", "go"], j0), () => true);
    expect(r.engineFor("python")).toBe("tmjudge");
    expect(r.engineFor("go")).toBe("judge0");
    expect(r.engineFor("cobol")).toBeNull();
    expect(r.languages()).toEqual(["python", "go"]);
    expect((await r.run(req("python"))).engine).toBe("tmjudge");
    expect((await r.run(req("go"))).engine).toBe("judge0");
  });

  it("falls back to Judge0 only when tm-judge can't be reached", async () => {
    const j0 = jest.fn().mockResolvedValue(ok("judge0"));
    const down = new RoutedRunner(fake("tmjudge", ["python"], jest.fn().mockRejectedValue(new JudgeUnavailableError("down"))), fake("judge0", ["python"], j0), () => true);
    expect((await down.run(req("python"))).engine).toBe("judge0");

    const refused = new RoutedRunner(
      fake("tmjudge", ["python"], jest.fn().mockRejectedValue(new RunnerRejectedError("refused", 400))),
      fake("judge0", ["python"], j0),
      () => true,
    );
    await expect(refused.run(req("python"))).rejects.toBeInstanceOf(RunnerRejectedError);

    const noFallback = new RoutedRunner(fake("tmjudge", ["python"], jest.fn().mockRejectedValue(new JudgeUnavailableError("down"))), fake("judge0", ["python", "go"], j0), () => false);
    await expect(noFallback.run(req("python"))).rejects.toBeInstanceOf(JudgeUnavailableError);
    expect(noFallback.engineFor("go")).toBeNull();
  });

  it("records each run's engine and outcome for the admin page (no code, no output)", async () => {
    resetRunStats();
    process.env.CODERUNNER_ENGINE = "judge0";
    jest.spyOn(Judge0Service, "runSingle").mockRejectedValueOnce(new RunnerRejectedError("refused (403)", 403));
    await getCodeRunner().run({ ...req("python"), interactive: true }).catch(() => undefined);
    const stats = runStats();
    expect(stats.by_outcome.RUNNER_REJECTED).toBe(1);
    expect(stats.recent_errors[0]).toMatchObject({ engine: "judge0", language: "python", outcome: "RUNNER_REJECTED" });
    expect(JSON.stringify(stats)).not.toContain('"x"');
  });
});

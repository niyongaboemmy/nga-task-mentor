import {
  AdvancedQuizGrader,
  isPendingGrade,
  looksLikeSourceCode,
} from "../utils/quizGrader";
import { Judge0Service } from "../services/Judge0Service";
import { aiService } from "../services/ai/aiService";
import { studentGradingDetails } from "../utils/quizStudentView";

/**
 * Coding/algorithmic grading without a judge: Judge0Service and the AI
 * rubric are stubbed. A test "passes" when the stubbed judge says Accepted.
 */

const TESTS = [
  { id: "t1", input: "1 2", expected_output: "3", is_hidden: false, points: 1 },
  { id: "t2", input: "2 2", expected_output: "4", is_hidden: false, points: 1 },
  { id: "h1", input: "secret-in", expected_output: "secret-out", is_hidden: true, points: 2 },
];

function question(type: "coding" | "algorithmic", data: Record<string, any> = {}) {
  return {
    id: 1,
    points: 4,
    questionBank: {
      question_type: type,
      question_text: "Add two numbers",
      question_data: { language: "python", test_cases: TESTS, ...data },
    },
  } as any;
}

/** Accepted for every stdin except the ones listed. */
function stubJudge(failing: string[] = []) {
  jest
    .spyOn(Judge0Service, "submit")
    .mockImplementation(async (s: any) => `tok:${s.stdin}`);
  jest.spyOn(Judge0Service, "waitAndGetResult").mockImplementation(async (token: string) => {
    const stdin = token.slice(4);
    const ok = !failing.includes(stdin);
    return {
      stdout: ok ? "ok" : "nope",
      stderr: null,
      compile_output: null,
      message: null,
      time: "0.01",
      memory: 100,
      token,
      status: ok ? { id: 3, description: "Accepted" } : { id: 4, description: "Wrong Answer" },
    };
  });
}

beforeEach(() => {
  jest.restoreAllMocks();
  jest.spyOn(aiService, "gradeCoding").mockRejectedValue(new Error("no AI in tests"));
});

describe("AdvancedQuizGrader keeps per-test results (TM-FIX-1)", () => {
  it("coding: testResults, passedTests and totalTests survive the advanced wrapper", async () => {
    stubJudge(["secret-in"]);
    const r = await AdvancedQuizGrader.gradeWithConfig(question("coding"), {
      code: "print(1)",
      language: "python",
    });
    const d: any = r.detailed_feedback;
    expect(d.strategy_used).toBe("weighted_partial");
    expect(d.testResults).toHaveLength(3);
    expect(d.passedTests).toBe(2);
    expect(d.totalTests).toBe(3);
    expect(d.testResults[2]).toMatchObject({ testCaseId: "h1", is_hidden: true, passed: false, points: 2 });
    // 2 of 4 weighted points
    expect(r.points_earned).toBeCloseTo(2);
  });

  it("algorithmic: per-test results are kept too", async () => {
    stubJudge();
    const r = await AdvancedQuizGrader.gradeWithConfig(question("algorithmic"), {
      code: "print(1)",
      language: "python",
    });
    expect((r.detailed_feedback as any).testResults).toHaveLength(3);
    expect(r.points_earned).toBe(4);
    expect(r.is_correct).toBe(true);
  });
});

describe("studentGradingDetails", () => {
  const stored = {
    strategy_used: "weighted_partial",
    breakdown: { test_cases: 2 },
    passedTests: 2,
    totalTests: 3,
    testResults: [
      { testCaseId: "t1", is_hidden: false, passed: true, points: 1, input: "1 2", expected: "3", actual: "3" },
      { testCaseId: "t2", is_hidden: false, passed: true, points: 1, input: "2 2", expected: "4", actual: "4" },
      {
        testCaseId: "h1",
        is_hidden: true,
        passed: false,
        points: 2,
        input: "secret-in",
        expected: "secret-out",
        actual: "nope",
        error: "Wrong Answer for secret-in",
      },
    ],
  };

  it("never exposes a hidden test's input, expected output, output or error", () => {
    const out = studentGradingDetails(stored, { includeHidden: true })!;
    expect(JSON.stringify(out)).not.toContain("secret");
    expect(out.testResults[2]).toEqual({ testCaseId: "h1", is_hidden: true, passed: false, points: 2 });
    expect(out.testResults[0].input).toBe("1 2");
    expect(out.passedTests).toBe(2);
    expect(out.totalTests).toBe(3);
    expect(out.breakdown).toEqual({ test_cases: 2 });
  });

  it("without the score released, hidden tests and score details are left out", () => {
    const out = studentGradingDetails(stored, { includeHidden: false })!;
    expect(out.testResults).toHaveLength(2);
    expect(out.totalTests).toBe(2);
    expect(out.passedTests).toBe(2);
    expect(out.breakdown).toBeUndefined();
    expect(out.strategy_used).toBeUndefined();
  });

  it("returns null for nothing stored", () => {
    expect(studentGradingDetails(null, { includeHidden: true })).toBeNull();
    expect(studentGradingDetails("not json", { includeHidden: true })).toBeNull();
  });
});

describe("algorithmic answers are code (TM-FIX-2)", () => {
  const q = () => question("algorithmic", { language: undefined, allowed_languages: ["python", "javascript"] });

  it("{code, language}: graded on the judge, full marks when every test passes", async () => {
    stubJudge();
    const r = await AdvancedQuizGrader.gradeWithConfig(q(), {
      code: "a, b = map(int, input().split())\nprint(a + b)",
      language: "python",
    });
    expect(r.points_earned).toBe(4);
    expect(r.is_correct).toBe(true);
    const sub = (Judge0Service.submit as jest.Mock).mock.calls[0][0];
    expect(sub.language_id).toBe(71); // python, not the Node.js default
  });

  it("{solution: <code>} from an old client is mapped onto code", async () => {
    stubJudge();
    const r = await AdvancedQuizGrader.gradeWithConfig(q(), {
      solution: "console.log(3);",
      language: "javascript",
    });
    expect(r.points_earned).toBe(4);
    expect((Judge0Service.submit as jest.Mock).mock.calls[0][0].language_id).toBe(63);
  });

  it.each([
    { solution: "Algorithm progress", language: "algorithm", score: 100 },
    { solution: "Algorithm predictions completed", language: "algorithm", submitted: true, score: 100 },
    { solution: "", language: "algorithm" },
    {},
  ])("widget placeholder %p → pending with feedback, never scored", async (answer) => {
    stubJudge();
    const r = await AdvancedQuizGrader.gradeWithConfig(q(), answer as any);
    expect(Judge0Service.submit).not.toHaveBeenCalled();
    expect(r.points_earned).toBe(0);
    expect(isPendingGrade(r)).toBe(true);
    expect(r.feedback).toBe("No code submitted – needs manual review.");
  });

  it("normalizeAnswer stores {solution: <code>} as {code, language}", () => {
    expect(
      AdvancedQuizGrader.normalizeAnswer({ solution: "print(1)", language: "python" } as any, "algorithmic").data,
    ).toEqual({ code: "print(1)", language: "python" });
    const widget = { solution: "Algorithm progress", language: "algorithm" };
    expect(AdvancedQuizGrader.normalizeAnswer(widget as any, "algorithmic").data).toBe(widget);
  });

  it("looksLikeSourceCode", () => {
    expect(looksLikeSourceCode("print(1)")).toBe(true);
    expect(looksLikeSourceCode("x = 1")).toBe(true);
    expect(looksLikeSourceCode("Algorithm trace completed")).toBe(false);
    expect(looksLikeSourceCode("just words")).toBe(false);
  });
});

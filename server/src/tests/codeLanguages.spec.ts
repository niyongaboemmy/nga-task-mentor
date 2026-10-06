import { Judge0Service } from "../services/Judge0Service";
import { aiService } from "../services/ai/aiService";
import { AdvancedQuizGrader, isPendingGrade } from "../utils/quizGrader";
import { resolveAnswerLanguage } from "../utils/codeLanguages";
import { QuestionValidator } from "../utils/questionValidation";

/** TM-FIX-4: languages fail closed — nothing runs under a runtime it didn't declare. */

describe("Judge0Service.getLanguageId", () => {
  it.each([
    ["javascript", 63],
    ["js", 63],
    ["typescript", 74],
    ["python", 71],
    ["py", 71],
    ["Python", 71],
    ["java", 62],
    ["cpp", 54],
    ["c++", 54],
    ["c", 50],
    ["csharp", 51],
    ["c#", 51],
    ["ruby", 72],
    ["go", 60],
    ["rust", 73],
    ["php", 68],
    ["kotlin", 78],
    ["swift", 83],
  ])("%s → %i", (lang, id) => {
    expect(Judge0Service.getLanguageId(lang)).toBe(id);
  });

  it.each(["sql", "html", "react", "brainfuck", "", "  ", undefined, null, 42])(
    "unknown %p → null (no Node.js fallback)",
    (lang) => {
      expect(Judge0Service.getLanguageId(lang as any)).toBeNull();
    },
  );

  it("runSingle refuses an unknown language before calling the judge", async () => {
    await expect(Judge0Service.runSingle("x", "sql")).rejects.toMatchObject({
      code: "UNSUPPORTED_LANGUAGE",
    });
  });
});

describe("resolveAnswerLanguage", () => {
  const qd = { language: "python", allowed_languages: ["python", "java"] };
  it("uses the student's pick when allowed", () => {
    expect(resolveAnswerLanguage(qd, "java")).toBe("java");
  });
  it("falls back to the question's language otherwise", () => {
    expect(resolveAnswerLanguage(qd, "go")).toBe("python");
    expect(resolveAnswerLanguage(qd, undefined)).toBe("python");
  });
  it("accepts any judge language when the question names none", () => {
    expect(resolveAnswerLanguage({}, "go")).toBe("go");
    expect(resolveAnswerLanguage({}, "sql")).toBeNull();
  });
});

describe("question save validation", () => {
  const tc = [{ id: "t", input: "1", expected_output: "1", points: 1, is_hidden: false }];
  it("rejects an unsupported coding language", () => {
    const r = QuestionValidator.validateQuestionData("coding", { language: "sql", test_cases: tc });
    expect(r.isValid).toBe(false);
    expect(r.errors.join()).toMatch(/Unsupported language "sql"/);
  });
  it("accepts a web project language for coding", () => {
    const r = QuestionValidator.validateQuestionData("coding", { language: "html", test_cases: tc });
    expect(r.isValid).toBe(true);
  });
  it("rejects unsupported allowed_languages", () => {
    const r = QuestionValidator.validateQuestionData("coding", {
      language: "python",
      allowed_languages: ["python", "cobol"],
      test_cases: tc,
    });
    expect(r.errors.join()).toMatch(/cobol/);
  });
  it("algorithmic: a web language is not allowed; a missing one only warns", () => {
    const base = { algorithm_description: "d", input_format: "i", output_format: "o", test_cases: tc };
    expect(
      QuestionValidator.validateQuestionData("algorithmic", { ...base, language: "html" }).isValid,
    ).toBe(false);
    const r = QuestionValidator.validateQuestionData("algorithmic", base);
    expect(r.isValid).toBe(true);
    expect(r.warnings?.length).toBe(1);
  });
});

describe("grading an answer in an unsupported language", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(aiService, "gradeCoding").mockRejectedValue(new Error("no AI"));
  });

  it("is left for manual review (pending), and never reaches the judge", async () => {
    const submit = jest.spyOn(Judge0Service, "submit");
    const r = await AdvancedQuizGrader.gradeWithConfig(
      {
        id: 1,
        points: 5,
        questionBank: {
          question_type: "coding",
          question_data: {
            language: "sql",
            test_cases: [{ id: "t", input: "", expected_output: "1", points: 1 }],
          },
        },
      } as any,
      { code: "SELECT 1;", language: "sql" },
    );
    expect(submit).not.toHaveBeenCalled();
    expect(r.points_earned).toBe(0);
    expect(isPendingGrade(r)).toBe(true);
    expect((r.detailed_feedback as any).pending_reason).toMatch(/Unsupported language "sql"/);
  });
});

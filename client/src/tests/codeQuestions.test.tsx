import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Monaco can't run in jsdom: a textarea stands in for the editor.
vi.mock("@monaco-editor/react", () => ({
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea data-testid="monaco" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
  useMonaco: () => null,
}));
vi.mock("../components/Common/RichTextDisplay", () => ({
  default: ({ content }: { content: string }) => <div>{content}</div>,
}));
const quizApi = vi.hoisted(() => ({
  runCode: vi.fn(),
  runTests: vi.fn(),
  submitQuestionAnswer: vi.fn(),
}));
vi.mock("../services/quizApi", () => ({ QuizApiService: quizApi }));

import { QuestionRenderer } from "../components/Quizzes/QuestionRenderer";
import { pickOption, selectValue, optionValues } from "./helpers/select";

const algorithmic = {
  id: 11,
  question_type: "algorithmic",
  question_text: "Sum two numbers",
  question_data: {
    algorithm_description: "Read two integers and print their sum",
    input_format: "two integers a b",
    output_format: "a + b",
    constraints: "|a|, |b| <= 1000",
    language: "python",
    allowed_languages: ["javascript"],
    starter_code: "# your code",
    test_cases: [
      { id: "t1", input: "1 2", expected_output: "3", is_hidden: false, points: 1 },
    ],
  },
} as any;

describe("algorithmic questions use the code editor (TM-FIX-2)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the problem header and the code editor, not the trace widget", () => {
    render(<QuestionRenderer question={algorithmic} onAnswerChange={() => {}} />);
    expect(screen.getByTestId("algorithmic-header")).toHaveTextContent("two integers a b");
    expect(screen.getByTestId("monaco")).toHaveValue("# your code");
    expect(screen.queryByText(/Trace/i)).toBeNull();
    expect(screen.queryByText(/Predict/i)).toBeNull();
  });

  it("emits {code, language} as the student types and switches language", () => {
    const onAnswerChange = vi.fn();
    render(<QuestionRenderer question={algorithmic} onAnswerChange={onAnswerChange} />);

    fireEvent.change(screen.getByTestId("monaco"), {
      target: { value: "a, b = map(int, input().split())\nprint(a + b)" },
    });
    expect(onAnswerChange).toHaveBeenLastCalledWith({
      code: "a, b = map(int, input().split())\nprint(a + b)",
      language: "python",
    });

    // Only the question's languages are offered.
    const picker = screen.getByTestId("code-language-picker");
    expect(optionValues(picker)).toEqual(["python", "javascript"]);
    pickOption(picker, "javascript");
    expect(onAnswerChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ language: "javascript" }),
    );
  });

  it("ignores an answer saved by the retired widget (no code) and starts from the starter", () => {
    render(
      <QuestionRenderer
        question={algorithmic}
        answer={{ solution: "Algorithm progress", language: "algorithm", score: 100 } as any}
        onAnswerChange={() => {}}
      />,
    );
    expect(screen.getByTestId("monaco")).toHaveValue("# your code");
  });

  it("shows the submitted code read-only on results pages", () => {
    render(
      <QuestionRenderer
        question={algorithmic}
        answer={{ code: "print(3)", language: "python" } as any}
        onAnswerChange={() => {}}
        disabled
        readOnlyReview
      />,
    );
    expect(screen.getByTestId("code-answer-view")).toHaveTextContent("print(3)");
    expect(screen.queryByTestId("monaco")).toBeNull();
  });
});

const coding = {
  id: 12,
  question_type: "coding",
  question_text: "Add two numbers",
  question_data: {
    language: "python",
    starter_code: "print(3)",
    test_cases: [{ id: "v1", input: "1 2", expected_output: "3", is_hidden: false, points: 1 }],
  },
} as any;

describe("Run tests (TM-FIX-7)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("runs the visible tests through the run endpoint and never saves a graded answer", async () => {
    quizApi.runTests.mockResolvedValue({
      success: true,
      data: {
        results: [
          { testCaseId: "v1", passed: true, input: "1 2", expected: "3", actual: "3", error: null, executionTime: 12, memoryUsed: 1, status: "Accepted", is_hidden: false },
        ],
        passed: 1,
        total: 1,
      },
    });
    render(<QuestionRenderer question={coding} onAnswerChange={() => {}} submissionId={77} />);
    fireEvent.click(screen.getByText("Test"));
    expect(await screen.findByText(/1\/1 visible tests passed/)).toBeInTheDocument();
    expect(quizApi.runTests).toHaveBeenCalledWith(12, { code: "print(3)", language: "python" });
    expect(quizApi.submitQuestionAnswer).not.toHaveBeenCalled();
  });
});

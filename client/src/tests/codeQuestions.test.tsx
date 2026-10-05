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
    const picker = screen.getByTestId("code-language-picker") as HTMLSelectElement;
    expect(Array.from(picker.options).map((o) => o.value)).toEqual(["python", "javascript"]);
    fireEvent.change(picker, { target: { value: "javascript" } });
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

import {
  AiProvider,
  AIGradingResult,
  AICodingGradingResult,
  AIQuizQuestion,
  AIFeedback,
  AISummary,
  AITestCase,
} from "../types";

export class MockProvider implements AiProvider {
  async gradeShortAnswer(
    questionText: string,
    studentAnswer: string,
    correctAnswer: string,
    maxPoints: number,
  ): Promise<AIGradingResult> {
    console.log("[AI] MockProvider: gradeShortAnswer");
    const isCorrect = studentAnswer.length > 5;
    // If correct, award at least half the points or 1 point minimum
    const pointsEarned = isCorrect
      ? Math.max(
          1,
          Math.floor(maxPoints * 0.5 + Math.random() * (maxPoints * 0.5)),
        )
      : Math.floor(Math.random() * Math.floor(maxPoints * 0.3)); // Partial credit for effort
    return {
      is_correct: isCorrect,
      points_earned: Math.min(pointsEarned, maxPoints),
      feedback:
        "Mock feedback: The answer seems reasonable but could be more detailed.",
    };
  }

  async gradeNumerical(
    questionText: string,
    studentAnswer: string | number,
    correctValue: number,
    tolerance: number,
    maxPoints: number,
  ): Promise<AIGradingResult> {
    console.log("[AI] MockProvider: gradeNumerical");
    const val =
      typeof studentAnswer === "string"
        ? parseFloat(studentAnswer)
        : studentAnswer;
    const isCorrect = Math.abs(val - correctValue) <= tolerance;
    return {
      is_correct: isCorrect,
      points_earned: isCorrect ? maxPoints : 0,
      feedback: isCorrect
        ? "Correct numerical answer."
        : "Value is outside the allowed tolerance.",
    };
  }

  async gradeCoding(
    questionText: string,
    studentCode: string,
    language: string,
    testResults: any[],
    maxPoints: number,
  ): Promise<AICodingGradingResult> {
    console.log("[AI] MockProvider: gradeCoding");
    const passed = testResults.filter((r) => r.passed).length;
    const total = testResults.length;
    const ratio = total > 0 ? passed / total : 0;

    return {
      is_correct: ratio === 1,
      points_earned: Math.round(ratio * maxPoints),
      feedback: `Mock feedback: Your code passed ${passed}/${total} test cases. Efficiency looks good.`,
      quality_score: 15,
      efficiency_score: 18,
      correctness_score: Math.round(ratio * 60),
    };
  }

  async getSocraticHint(): Promise<string> {
    console.log("[AI] MockProvider: getSocraticHint");
    return "Mock hint: Have you considered using a more efficient data structure for this problem?";
  }

  async generateCodingTestCases(): Promise<AITestCase[]> {
    console.log("[AI] MockProvider: generateCodingTestCases");
    return [
      {
        id: "m1",
        input: "5",
        expected_output: "5",
        is_hidden: false,
        points: 20,
        explanation: "Basic test case.",
      },
      {
        id: "m2",
        input: "0",
        expected_output: "0",
        is_hidden: true,
        points: 30,
        explanation: "Edge case: zero input.",
      },
    ];
  }

  async generateQuiz(): Promise<AIQuizQuestion[]> {
    console.log("[AI] MockProvider: generateQuiz");
    return [
      {
        question: "What is the capital of France?",
        options: ["Paris", "London", "Berlin", "Madrid"],
        correctAnswer: "Paris",
        explanation: "Paris is the capital and most populous city of France.",
      },
    ];
  }

  async giveFeedback(studentName: string): Promise<AIFeedback> {
    console.log("[AI] MockProvider: giveFeedback");
    return {
      summary: `Great progress, ${studentName}!`,
      strengths: ["Logical thinking", "Syntax accuracy"],
      improvements: ["Time complexity optimization"],
      encouragement:
        "Keep practicing and you'll master these concepts in no time!",
    };
  }

  async summarizeLesson(): Promise<AISummary> {
    console.log("[AI] MockProvider: summarizeLesson");
    return {
      summary:
        "This lesson covers the fundamentals of programming logic and structure.",
      keyPoints: [
        "Variable declarations",
        "Control flow",
        "Function definitions",
      ],
      vocabulary: ["Variable", "Function", "Loop"],
    };
  }
}

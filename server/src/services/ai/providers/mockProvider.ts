import {
  AiProvider,
  AIGradingResult,
  AICodingGradingResult,
  AIQuizQuestion,
  AIFeedback,
  AISummary,
  AITestCase,
  AIGenerateFromDocumentParams,
  AIGeneratedQuestion,
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

  async generateQuestionsFromDocument(
    params: AIGenerateFromDocumentParams,
  ): Promise<AIGeneratedQuestion[]> {
    console.log("[AI] MockProvider: generateQuestionsFromDocument");
    const results: AIGeneratedQuestion[] = [];
    for (const type of params.questionTypes) {
      for (let i = 0; i < params.countPerType; i++) {
        results.push(this.buildMockQuestion(type, params.difficulty, i));
      }
    }
    return results;
  }

  private buildMockQuestion(
    type: string,
    difficulty: string,
    index: number,
  ): AIGeneratedQuestion {
    const base = {
      question_type: type,
      question_text: `[Mock] Sample ${type.replace(/_/g, " ")} question #${index + 1} generated from your document.`,
      difficulty_level: difficulty,
      explanation: "This is a mock explanation for testing purposes.",
      tags: ["mock", "document"],
      time_limit_seconds: 60,
    };

    const dataMap: Record<string, { question_data: any; correct_answer: any }> =
      {
        single_choice: {
          question_data: {
            options: ["Option A", "Option B", "Option C", "Option D"],
            correct_option_index: 0,
          },
          correct_answer: { selected_option_index: 0 },
        },
        multiple_choice: {
          question_data: {
            options: ["Option A", "Option B", "Option C", "Option D"],
            correct_option_indices: [0, 2],
          },
          correct_answer: { selected_option_indices: [0, 2] },
        },
        true_false: {
          question_data: { correct_answer: true },
          correct_answer: { selected_answer: true },
        },
        fill_blank: {
          question_data: {
            text_with_blanks: "The {{blank}} is a key concept.",
            acceptable_answers: [
              {
                blank_index: 0,
                answers: ["answer", "Answer"],
                case_sensitive: false,
              },
            ],
          },
          correct_answer: { answers: [{ blank_index: 0, answer: "answer" }] },
        },
        matching: {
          question_data: {
            left_items: [
              { id: "l1", text: "Term A" },
              { id: "l2", text: "Term B" },
            ],
            right_items: [
              { id: "r1", text: "Definition A" },
              { id: "r2", text: "Definition B" },
            ],
            correct_matches: { l1: "r1", l2: "r2" },
          },
          correct_answer: { matches: { l1: "r1", l2: "r2" } },
        },
        dropdown: {
          question_data: {
            text_with_dropdowns:
              "The correct answer is {{dropdown}}.",
            dropdown_options: [
              {
                dropdown_index: 0,
                options: ["Option A", "Option B", "Option C"],
              },
            ],
          },
          correct_answer: {
            selections: [{ dropdown_index: 0, selected_option: "Option A" }],
          },
        },
        numerical: {
          question_data: {
            correct_answer: 42,
            tolerance: 1,
            units: "units",
            precision: 0,
          },
          correct_answer: { answer: 42, units: "units" },
        },
        short_answer: {
          question_data: {
            max_length: 500,
            keywords: ["key", "concept", "topic"],
            sample_answer: "A sample answer demonstrating key concepts.",
          },
          correct_answer: null,
        },
        ordering: {
          question_data: {
            items: [
              { id: "i1", text: "First step", order: 1 },
              { id: "i2", text: "Second step", order: 2 },
              { id: "i3", text: "Third step", order: 3 },
            ],
          },
          correct_answer: { ordered_item_ids: ["i1", "i2", "i3"] },
        },
        drag_drop: {
          question_data: {
            drop_zones: [
              {
                id: "z1",
                x: 0,
                y: 0,
                width: 200,
                height: 80,
                correct_items: ["d1"],
                label: "Zone 1",
              },
              {
                id: "z2",
                x: 220,
                y: 0,
                width: 200,
                height: 80,
                correct_items: ["d2"],
                label: "Zone 2",
              },
            ],
            draggable_items: [
              { id: "d1", text: "Item 1", value: "item_1" },
              { id: "d2", text: "Item 2", value: "item_2" },
            ],
          },
          correct_answer: { placements: { z1: "d1", z2: "d2" } },
        },
        coding: {
          question_data: {
            language: "python",
            starter_code: "def solution(n):\n    pass",
            test_cases: [
              {
                id: "tc1",
                input: "5",
                expected_output: "25",
                is_hidden: false,
                points: 100,
              },
            ],
            constraints: "Time limit: 1s",
          },
          correct_answer: null,
        },
        algorithmic: {
          question_data: {
            algorithm_description: "Mock algorithmic problem",
            input_format: "Integer n",
            output_format: "Result integer",
            constraints: "n >= 0",
            test_cases: [
              {
                id: "tc1",
                input: "5",
                expected_output: "25",
                is_hidden: false,
                points: 100,
              },
            ],
          },
          correct_answer: null,
        },
        logical_expression: {
          question_data: {
            expression_format: "A AND B",
            variables: [
              { name: "A", description: "First condition", type: "boolean" },
              { name: "B", description: "Second condition", type: "boolean" },
            ],
            correct_expression: "A AND B",
          },
          correct_answer: { expression: "A AND B" },
        },
      };

    const typeData = dataMap[type] || dataMap["single_choice"];
    return { ...base, ...typeData };
  }
}

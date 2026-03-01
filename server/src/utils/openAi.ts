import { aiService } from "../services/ai/aiService";
import { AIGradingResult, AICodingGradingResult } from "../services/ai/types";

export { AIGradingResult };

/**
 * @deprecated Use aiService from src/services/ai/aiService instead.
 * This class is kept for backward compatibility and wraps the new AiService.
 */
export class QuestionAiGrader {
  /**
   * Grades a short answer question.
   */
  static async gradeShortAnswer(
    questionText: string,
    studentAnswer: string,
    correctAnswer: string,
    maxPoints: number,
    rubric?: string,
  ): Promise<AIGradingResult> {
    return aiService.gradeShortAnswer(
      questionText,
      studentAnswer,
      correctAnswer,
      maxPoints,
      rubric,
    );
  }

  /**
   * Grades a numerical question.
   */
  static async gradeNumerical(
    questionText: string,
    studentAnswer: string | number,
    correctValue: number,
    tolerance: number,
    maxPoints: number,
    units?: string,
  ): Promise<AIGradingResult> {
    return aiService.gradeNumerical(
      questionText,
      studentAnswer,
      correctValue,
      tolerance,
      maxPoints,
      units,
    );
  }

  /**
   * Grades a coding question.
   */
  static async gradeCoding(
    questionText: string,
    studentCode: string,
    language: string,
    testResults: any[],
    maxPoints: number,
    constraints?: string,
  ): Promise<AICodingGradingResult> {
    return aiService.gradeCoding(
      questionText,
      studentCode,
      language,
      testResults,
      maxPoints,
      constraints,
    );
  }

  /**
   * Provides a Socratic hint.
   */
  static async getSocraticHint(
    questionText: string,
    studentCode: string,
    language: string,
    chatHistory: { role: "user" | "assistant"; content: string }[],
    lastError?: string,
  ): Promise<string> {
    return aiService.getSocraticHint(
      questionText,
      studentCode,
      language,
      chatHistory,
      lastError,
    );
  }

  /**
   * Generates intelligent test cases for a coding problem.
   */
  static async generateCodingTestCases(
    problemDescription: string,
    language: string,
    starterCode?: string,
  ): Promise<any[]> {
    return aiService.generateCodingTestCases(
      problemDescription,
      language,
      starterCode,
    );
  }
}

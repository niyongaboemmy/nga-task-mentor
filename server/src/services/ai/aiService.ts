import { GeminiProvider } from "./providers/geminiProvider";
import { OpenaiProvider } from "./providers/openaiProvider";
import { MockProvider } from "./providers/mockProvider";
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
  AISqlQueryContext,
  AISqlQueryResult,
} from "./types";

class AiServiceManager implements AiProvider {
  private primary: AiProvider;
  private secondary: AiProvider;
  private fallback: AiProvider;

  constructor() {
    this.primary = new GeminiProvider();
    this.secondary = new OpenaiProvider();
    this.fallback = new MockProvider();
  }

  private async executeWithFallback<T>(
    operation: (provider: AiProvider) => Promise<T>,
    operationName: string,
  ): Promise<T> {
    // 1. Try Primary (Gemini)
    try {
      if (process.env.GEMINI_API_KEY) {
        console.log(`[AI] Using Primary (Gemini) for ${operationName}`);
        return await operation(this.primary);
      }
    } catch (error: any) {
      console.error(
        `[AI] Primary (Gemini) failed for ${operationName}:`,
        error.message,
      );
    }

    // 2. Try Secondary (OpenAI)
    try {
      if (process.env.OPENAI_API_KEY) {
        console.log(`[AI] Using Secondary (OpenAI) for ${operationName}`);
        return await operation(this.secondary);
      }
    } catch (error: any) {
      console.error(
        `[AI] Secondary (OpenAI) failed for ${operationName}:`,
        error.message,
      );
    }

    // 3. Final Fallback (Mock)
    console.log(`[AI] Using Fallback (Mock) for ${operationName}`);
    return await operation(this.fallback);
  }

  async gradeShortAnswer(
    questionText: string,
    studentAnswer: string,
    correctAnswer: string,
    maxPoints: number,
    rubric?: string,
  ): Promise<AIGradingResult> {
    return this.executeWithFallback(
      (p) =>
        p.gradeShortAnswer(
          questionText,
          studentAnswer,
          correctAnswer,
          maxPoints,
          rubric,
        ),
      "gradeShortAnswer",
    );
  }

  async gradeNumerical(
    questionText: string,
    studentAnswer: string | number,
    correctValue: number,
    tolerance: number,
    maxPoints: number,
    units?: string,
  ): Promise<AIGradingResult> {
    return this.executeWithFallback(
      (p) =>
        p.gradeNumerical(
          questionText,
          studentAnswer,
          correctValue,
          tolerance,
          maxPoints,
          units,
        ),
      "gradeNumerical",
    );
  }

  async gradeCoding(
    questionText: string,
    studentCode: string,
    language: string,
    testResults: any[],
    maxPoints: number,
    constraints?: string,
  ): Promise<AICodingGradingResult> {
    return this.executeWithFallback(
      (p) =>
        p.gradeCoding(
          questionText,
          studentCode,
          language,
          testResults,
          maxPoints,
          constraints,
        ),
      "gradeCoding",
    );
  }

  async getSocraticHint(
    questionText: string,
    studentCode: string,
    language: string,
    chatHistory: { role: "user" | "assistant"; content: string }[],
    lastError?: string,
  ): Promise<string> {
    return this.executeWithFallback(
      (p) =>
        p.getSocraticHint(
          questionText,
          studentCode,
          language,
          chatHistory,
          lastError,
        ),
      "getSocraticHint",
    );
  }

  async generateCodingTestCases(
    problemDescription: string,
    language: string,
    starterCode?: string,
  ): Promise<AITestCase[]> {
    return this.executeWithFallback(
      (p) =>
        p.generateCodingTestCases(problemDescription, language, starterCode),
      "generateCodingTestCases",
    );
  }

  async generateQuiz(
    topic: string,
    difficulty: "easy" | "medium" | "hard",
    count: number,
    questionType: "mcq" | "open-ended" | "true-false",
  ): Promise<AIQuizQuestion[]> {
    return this.executeWithFallback(
      (p) => p.generateQuiz(topic, difficulty, count, questionType),
      "generateQuiz",
    );
  }

  async giveFeedback(
    studentName: string,
    subject: string,
    performanceData: { scores: number[]; weakAreas: string[] },
  ): Promise<AIFeedback> {
    return this.executeWithFallback(
      (p) => p.giveFeedback(studentName, subject, performanceData),
      "giveFeedback",
    );
  }

  async summarizeLesson(
    lessonContent: string,
    targetAudience: "student" | "teacher",
    length: "short" | "medium" | "detailed",
  ): Promise<AISummary> {
    return this.executeWithFallback(
      (p) => p.summarizeLesson(lessonContent, targetAudience, length),
      "summarizeLesson",
    );
  }

  async generateQuestionsFromDocument(
    params: AIGenerateFromDocumentParams,
  ): Promise<AIGeneratedQuestion[]> {
    return this.executeWithFallback(
      (p) => p.generateQuestionsFromDocument(params),
      "generateQuestionsFromDocument",
    );
  }

  // Kept separate from executeWithFallback (rather than reusing it) so the caller can
  // see which provider actually answered — the Database Management AI panel surfaces
  // this to the admin, unlike the other operations here which don't need it.
  async generateSqlQuery(
    prompt: string,
    context: AISqlQueryContext,
  ): Promise<AISqlQueryResult & { providerUsed: string }> {
    if (process.env.GEMINI_API_KEY) {
      try {
        console.log("[AI] Using Primary (Gemini) for generateSqlQuery");
        const result = await this.primary.generateSqlQuery(prompt, context);
        return { ...result, providerUsed: "gemini" };
      } catch (error: any) {
        console.error("[AI] Primary (Gemini) failed for generateSqlQuery:", error.message);
      }
    }

    if (process.env.OPENAI_API_KEY) {
      try {
        console.log("[AI] Using Secondary (OpenAI) for generateSqlQuery");
        const result = await this.secondary.generateSqlQuery(prompt, context);
        return { ...result, providerUsed: "openai" };
      } catch (error: any) {
        console.error("[AI] Secondary (OpenAI) failed for generateSqlQuery:", error.message);
      }
    }

    console.log("[AI] Using Fallback (Mock) for generateSqlQuery");
    const result = await this.fallback.generateSqlQuery(prompt, context);
    return { ...result, providerUsed: "mock" };
  }

  getProviderStatus() {
    return {
      gemini: !!process.env.GEMINI_API_KEY,
      openai: !!process.env.OPENAI_API_KEY,
      mock: true,
    };
  }
}

export const aiService = new AiServiceManager();
export default aiService;

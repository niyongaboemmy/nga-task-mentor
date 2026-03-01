export interface AIGradingResult {
  is_correct: boolean;
  points_earned: number;
  feedback: string;
}

export interface AICodingGradingResult extends AIGradingResult {
  quality_score: number;
  efficiency_score: number;
  correctness_score: number;
}

export interface AIQuizQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export interface AIFeedback {
  summary: string;
  strengths: string[];
  improvements: string[];
  encouragement: string;
}

export interface AISummary {
  summary: string;
  keyPoints: string[];
  vocabulary: string[];
}

export interface AITestCase {
  id: string;
  input: string;
  expected_output: string;
  is_hidden: boolean;
  points: number;
  explanation: string;
}

export interface AiProvider {
  /**
   * Grades a short answer question.
   */
  gradeShortAnswer(
    questionText: string,
    studentAnswer: string,
    correctAnswer: string,
    maxPoints: number,
    rubric?: string,
  ): Promise<AIGradingResult>;

  /**
   * Grades a numerical question.
   */
  gradeNumerical(
    questionText: string,
    studentAnswer: string | number,
    correctValue: number,
    tolerance: number,
    maxPoints: number,
    units?: string,
  ): Promise<AIGradingResult>;

  /**
   * Grades a coding question.
   */
  gradeCoding(
    questionText: string,
    studentCode: string,
    language: string,
    testResults: any[],
    maxPoints: number,
    constraints?: string,
  ): Promise<AICodingGradingResult>;

  /**
   * Provides a Socratic hint.
   */
  getSocraticHint(
    questionText: string,
    studentCode: string,
    language: string,
    chatHistory: { role: "user" | "assistant"; content: string }[],
    lastError?: string,
  ): Promise<string>;

  /**
   * Generates intelligent test cases for a coding problem.
   */
  generateCodingTestCases(
    problemDescription: string,
    language: string,
    starterCode?: string,
  ): Promise<AITestCase[]>;

  /**
   * New: Generate quiz questions.
   */
  generateQuiz(
    topic: string,
    difficulty: "easy" | "medium" | "hard",
    count: number,
    questionType: "mcq" | "open-ended" | "true-false",
  ): Promise<AIQuizQuestion[]>;

  /**
   * New: Give feedback to students.
   */
  giveFeedback(
    studentName: string,
    subject: string,
    performanceData: { scores: number[]; weakAreas: string[] },
  ): Promise<AIFeedback>;

  /**
   * New: Summarize lessons.
   */
  summarizeLesson(
    lessonContent: string,
    targetAudience: "student" | "teacher",
    length: "short" | "medium" | "detailed",
  ): Promise<AISummary>;
}

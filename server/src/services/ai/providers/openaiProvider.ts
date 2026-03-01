import OpenAI from "openai";
import {
  AiProvider,
  AIGradingResult,
  AICodingGradingResult,
  AIQuizQuestion,
  AIFeedback,
  AISummary,
  AITestCase,
} from "../types";

export class OpenaiProvider implements AiProvider {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 30000, // 30 seconds
    });
  }

  async gradeShortAnswer(
    questionText: string,
    studentAnswer: string,
    correctAnswer: string,
    maxPoints: number,
    rubric?: string,
  ): Promise<AIGradingResult> {
    const response = await this.openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an expert academic grader. Grade the student's answer based on the provided question and correct answer/rubric. 
          Respond ONLY with valid JSON with these keys: 
          - is_correct (boolean)
          - points_earned (number out of ${maxPoints})
          - feedback (string)`,
        },
        {
          role: "user",
          content: `Question: ${questionText}
          Correct/Rubric: ${correctAnswer || rubric || "Not provided"}
          Student: ${studentAnswer}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    return {
      is_correct: !!result.is_correct,
      points_earned: Number(result.points_earned) || 0,
      feedback: result.feedback || "Graded by OpenAI.",
    };
  }

  async gradeNumerical(
    questionText: string,
    studentAnswer: string | number,
    correctValue: number,
    tolerance: number,
    maxPoints: number,
    units?: string,
  ): Promise<AIGradingResult> {
    const response = await this.openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a math and science grader. Respond ONLY with valid JSON:
          - is_correct: boolean
          - points_earned: number (out of ${maxPoints})
          - feedback: string`,
        },
        {
          role: "user",
          content: `Question: ${questionText}
          Correct: ${correctValue} (Tolerance: ${tolerance}, Units: ${units || "None"})
          Student: ${studentAnswer}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    return {
      is_correct: !!result.is_correct,
      points_earned: Number(result.points_earned) || 0,
      feedback: result.feedback || "Graded by OpenAI.",
    };
  }

  async gradeCoding(
    questionText: string,
    studentCode: string,
    language: string,
    testResults: any[],
    maxPoints: number,
    constraints?: string,
  ): Promise<AICodingGradingResult> {
    const passedTests = testResults.filter((r) => r.passed).length;
    const totalTests = testResults.length;
    const correctnessRatio = totalTests > 0 ? passedTests / totalTests : 0;

    const response = await this.openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Rate code (60/20/20). Respond ONLY with valid JSON:
          - quality_score: number (out of 20)
          - efficiency_score: number (out of 20)
          - correctness_score: number (out of 60, use ${Math.round(correctnessRatio * 60)})
          - feedback: string
          - is_correct: boolean`,
        },
        {
          role: "user",
          content: `Problem: ${questionText}
          Language: ${language}
          Constraints: ${constraints || "None"}
          Code: ${studentCode}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    const totalScore =
      (result.quality_score || 0) +
      (result.efficiency_score || 0) +
      (result.correctness_score || 0);

    return {
      is_correct: !!result.is_correct,
      points_earned: (totalScore / 100) * maxPoints,
      feedback: result.feedback || "Graded by OpenAI.",
      quality_score: result.quality_score || 0,
      efficiency_score: result.efficiency_score || 0,
      correctness_score: result.correctness_score || 0,
    };
  }

  async getSocraticHint(
    questionText: string,
    studentCode: string,
    language: string,
    chatHistory: { role: "user" | "assistant"; content: string }[],
    lastError?: string,
  ): Promise<string> {
    const response = await this.openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are a Socratic tutor. NEVER provide code. Use leading questions.",
        },
        ...chatHistory,
        {
          role: "user",
          content: `Problem: ${questionText}\nLanguage: ${language}\nCode: ${studentCode}\nError: ${lastError || "None"}`,
        },
      ],
    });
    return response.choices[0].message.content || "Keep thinking!";
  }

  async generateCodingTestCases(
    problemDescription: string,
    language: string,
    starterCode?: string,
  ): Promise<AITestCase[]> {
    const response = await this.openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Expert challenge creator. Generate 3-5 test cases. Respond ONLY with valid JSON array of objects:
          - id: string
          - input: string
          - expected_output: string
          - is_hidden: boolean
          - points: number
          - explanation: string`,
        },
        {
          role: "user",
          content: `Problem: ${problemDescription}\nLanguage: ${language}\nStarter: ${starterCode || "None"}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const parsed = JSON.parse(response.choices[0].message.content || "{}");
    return Array.isArray(parsed)
      ? parsed
      : parsed.testcases || parsed.test_cases || [];
  }

  async generateQuiz(
    topic: string,
    difficulty: "easy" | "medium" | "hard",
    count: number,
    questionType: string,
  ): Promise<AIQuizQuestion[]> {
    const response = await this.openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Generate ${count} ${difficulty} ${questionType} questions. Respond ONLY with valid JSON array of objects:
          - question: string
          - options: string[]
          - correctAnswer: string
          - explanation: string`,
        },
        {
          role: "user",
          content: `Topic: ${topic}`,
        },
      ],
      response_format: { type: "json_object" },
    });
    const parsed = JSON.parse(response.choices[0].message.content || "{}");
    return Array.isArray(parsed) ? parsed : parsed.questions || [];
  }

  async giveFeedback(
    studentName: string,
    subject: string,
    performanceData: { scores: number[]; weakAreas: string[] },
  ): Promise<AIFeedback> {
    const response = await this.openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Encouraging mentor. Respond ONLY with valid JSON: summary, strengths, improvements, encouragement.",
        },
        {
          role: "user",
          content: `Student: ${studentName}, Subject: ${subject}, Scores: ${performanceData.scores.join(", ")}, Weak Areas: ${performanceData.weakAreas.join(", ")}`,
        },
      ],
      response_format: { type: "json_object" },
    });
    return JSON.parse(response.choices[0].message.content || "{}");
  }

  async summarizeLesson(
    lessonContent: string,
    targetAudience: string,
    length: string,
  ): Promise<AISummary> {
    const response = await this.openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Efficient summarizer for ${targetAudience}. Length: ${length}. Respond ONLY with valid JSON: summary, keyPoints, vocabulary.`,
        },
        {
          role: "user",
          content: lessonContent,
        },
      ],
      response_format: { type: "json_object" },
    });
    return JSON.parse(response.choices[0].message.content || "{}");
  }
}

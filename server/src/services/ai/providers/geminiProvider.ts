import { GoogleGenerativeAI } from "@google/generative-ai";
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
} from "../types";
import { buildGenerateFromDocumentPrompt } from "../prompts/generateFromDocumentPrompt";

export class GeminiProvider implements AiProvider {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
    // gemini-2.5-flash: latest stable, 1M input tokens, 65K output, thinking support
    this.model = this.genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
    });
  }

  private async generateJson(
    prompt: string,
    timeoutMs: number = 30000,
  ): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const result = await this.model.generateContent(prompt, {
        signal: controller.signal,
      });
      const response = await result.response;
      clearTimeout(timeoutId);
      const text = response.text();
      // ...
      // Strip markdown code fences if Gemini wraps the JSON in them
      const cleaned = text
        .replace(/^```(?:json)?\s*/m, "")
        .replace(/\s*```\s*$/m, "")
        .trim();
      try {
        return JSON.parse(cleaned);
      } catch {
        // Try extracting the first JSON array from partial response
        const arrMatch = cleaned.match(/\[[\s\S]*\]/);
        if (arrMatch) return JSON.parse(arrMatch[0]);
        const objMatch = cleaned.match(/\{[\s\S]*\}/);
        if (objMatch) return JSON.parse(objMatch[0]);
        throw new Error("Failed to parse Gemini JSON response");
      }
    } catch (error: any) {
      console.error("[Gemini Error]", error.message);
      throw error;
    }
  }

  async gradeShortAnswer(
    questionText: string,
    studentAnswer: string,
    correctAnswer: string,
    maxPoints: number,
    rubric?: string,
  ): Promise<AIGradingResult> {
    const prompt = `You are an expert academic grader. Grade the student's answer. Respond ONLY with valid JSON, no markdown, no extra text.
Question: ${questionText}
Correct Answer/Rubric: ${correctAnswer || rubric || "Not provided"}
Student's Answer: ${studentAnswer}
Max Points: ${maxPoints}
JSON format: {"is_correct": boolean, "points_earned": number, "feedback": string}`;

    const result = await this.generateJson(prompt);
    return {
      is_correct: !!result.is_correct,
      points_earned: Math.min(Number(result.points_earned) || 0, maxPoints),
      feedback: result.feedback || "Graded by Gemini.",
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
    const prompt = `Grade this numerical answer. Respond ONLY with valid JSON, no markdown, no extra text.
Question: ${questionText}
Correct Value: ${correctValue} (Tolerance: ±${tolerance}${units ? `, Units: ${units}` : ""})
Student's Answer: ${studentAnswer}
Max Points: ${maxPoints}
JSON format: {"is_correct": boolean, "points_earned": number, "feedback": string}`;

    const result = await this.generateJson(prompt);
    return {
      is_correct: !!result.is_correct,
      points_earned: Math.min(Number(result.points_earned) || 0, maxPoints),
      feedback: result.feedback || "Graded by Gemini.",
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
    // Correctness is already determined by test runners, we fix It.
    const correctnessScore = Math.round(correctnessRatio * 60);

    const prompt = `You are a senior software engineer grading code (60/20/20 rubric). Respond ONLY with valid JSON, no markdown.
Problem: ${questionText}
Language: ${language}
Constraints: ${constraints || "None"}
Test Results: ${passedTests}/${totalTests} passed.
Student Code:
${studentCode}

Grade quality (0-20) and efficiency (0-20). Correctness is fixed at ${correctnessScore}/60.
JSON format: {"quality_score": number, "efficiency_score": number, "correctness_score": ${correctnessScore}, "feedback": string, "is_correct": ${passedTests === totalTests && totalTests > 0}}`;

    const result = await this.generateJson(prompt);
    const qualityScore = Math.min(
      Math.max(Number(result.quality_score) || 0, 0),
      20,
    );
    const efficiencyScore = Math.min(
      Math.max(Number(result.efficiency_score) || 0, 0),
      20,
    );
    const totalScore = qualityScore + efficiencyScore + correctnessScore;

    return {
      is_correct: passedTests === totalTests && totalTests > 0,
      points_earned: (totalScore / 100) * maxPoints,
      feedback: result.feedback || "Graded by Gemini.",
      quality_score: qualityScore,
      efficiency_score: efficiencyScore,
      correctness_score: correctnessScore,
    };
  }

  async getSocraticHint(
    questionText: string,
    studentCode: string,
    language: string,
    chatHistory: { role: "user" | "assistant"; content: string }[],
    lastError?: string,
  ): Promise<string> {
    // Socratic hints are plain text, not JSON
    const textModel = this.genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
    });
    const lastMessages = chatHistory
      .slice(-4)
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n");
    const prompt = `You are a Socratic programming tutor. NEVER provide code solutions. Use leading questions to guide the student.
Problem: ${questionText}
Language: ${language}
Recent conversation:
${lastMessages}
Student's current code:
${studentCode}
${lastError ? `Error: ${lastError}` : ""}
Give a single helpful question or hint:`;

    const result = await textModel.generateContent(prompt);
    return (
      result.response.text() ||
      "Have you considered breaking the problem into smaller parts?"
    );
  }

  async generateCodingTestCases(
    problemDescription: string,
    language: string,
    starterCode?: string,
  ): Promise<AITestCase[]> {
    const prompt = `You are an expert in creating programming challenge test cases. Respond ONLY with valid JSON, no markdown.
Problem: ${problemDescription}
Language: ${language}
${starterCode ? `Starter Code:\n${starterCode}` : ""}

Generate 3-5 high-quality test cases including a basic test, an edge case, and a hidden performance test.
JSON format: [{"id": "string", "input": "string", "expected_output": "string", "is_hidden": boolean, "points": number, "explanation": "string"}]
Points must sum to 100.`;

    const result = await this.generateJson(prompt);
    // Handle both direct array and wrapped object formats
    const cases = Array.isArray(result)
      ? result
      : result.testcases || result.test_cases || result.cases || [];
    // Normalize each test case to ensure correct types
    return cases.map((tc: any, i: number) => ({
      id: String(tc.id || `tc${i + 1}`),
      input: String(tc.input ?? ""),
      expected_output: String(tc.expected_output ?? ""),
      is_hidden: !!tc.is_hidden,
      points: Number(tc.points) || 0,
      explanation: String(tc.explanation || ""),
    }));
  }

  async generateQuiz(
    topic: string,
    difficulty: "easy" | "medium" | "hard",
    count: number,
    questionType: string,
  ): Promise<AIQuizQuestion[]> {
    const prompt = `Generate ${count} ${difficulty} ${questionType} quiz questions about "${topic}". Respond ONLY with valid JSON, no markdown.
JSON format: [{"question": "string", "options": ["string"], "correctAnswer": "string", "explanation": "string"}]`;

    const result = await this.generateJson(prompt);
    return Array.isArray(result) ? result : result.questions || [];
  }

  async giveFeedback(
    studentName: string,
    subject: string,
    performanceData: { scores: number[]; weakAreas: string[] },
  ): Promise<AIFeedback> {
    const avgScore =
      performanceData.scores.length > 0
        ? (
            performanceData.scores.reduce((a, b) => a + b, 0) /
            performanceData.scores.length
          ).toFixed(1)
        : "N/A";
    const prompt = `Provide encouraging teacher feedback. Respond ONLY with valid JSON, no markdown.
Student: ${studentName}, Subject: ${subject}
Average Score: ${avgScore}, Weak Areas: ${performanceData.weakAreas.join(", ")}
JSON format: {"summary": "string", "strengths": ["string"], "improvements": ["string"], "encouragement": "string"}`;

    return await this.generateJson(prompt);
  }

  async summarizeLesson(
    lessonContent: string,
    targetAudience: string,
    length: string,
  ): Promise<AISummary> {
    const prompt = `Summarize this lesson for a ${targetAudience} at ${length} depth. Respond ONLY with valid JSON, no markdown.
Content: ${lessonContent.slice(0, 3000)}
JSON format: {"summary": "string", "keyPoints": ["string"], "vocabulary": ["string"]}`;

    return await this.generateJson(prompt);
  }

  async generateQuestionsFromDocument(
    params: AIGenerateFromDocumentParams,
  ): Promise<AIGeneratedQuestion[]> {
    const prompt = buildGenerateFromDocumentPrompt(params);
    // Use 90s timeout — large documents need more processing time
    const result = await this.generateJson(prompt, 90000);
    const arr = Array.isArray(result)
      ? result
      : result.questions || result.data || [];
    return this.normalizeGeneratedQuestions(arr, params.difficulty);
  }

  async generateSqlQuery(
    prompt: string,
    context: AISqlQueryContext,
  ): Promise<AISqlQueryResult> {
    const structureLine = context.tableColumns?.length
      ? `\nThe admin is currently viewing a table with these columns: ${context.tableColumns.join(", ")}.`
      : "";
    const fullPrompt = `You are a senior MySQL database administrator helping write a single SQL query for a
school platform database (MySQL 8). Respond ONLY with valid JSON, no markdown, no extra text.

Available tables: ${context.tableNames.join(", ")}${structureLine}

The admin's request, in their own words:
"""
${prompt}
"""

Write ONE single valid MySQL statement fulfilling this request. Prefer SELECT unless the request explicitly
asks to insert, update, delete, or alter data. Never produce DROP DATABASE, DROP SCHEMA, GRANT, REVOKE, CREATE
USER, DROP USER, ALTER USER, SET GLOBAL, or SHUTDOWN. Do not wrap the SQL in markdown code fences, no trailing
semicolon.
JSON format: {"sql": string, "explanation": string}`;

    const result = await this.generateJson(fullPrompt);
    return {
      sql: String(result.sql || "").trim(),
      explanation: result.explanation ? String(result.explanation) : undefined,
    };
  }

  private normalizeGeneratedQuestions(
    raw: any[],
    difficulty: string,
  ): AIGeneratedQuestion[] {
    return raw
      .filter(
        (q) =>
          q &&
          typeof q.question_type === "string" &&
          typeof q.question_text === "string" &&
          q.question_data &&
          typeof q.question_data === "object",
      )
      .map((q) => ({
        question_type: q.question_type,
        question_text: String(q.question_text),
        question_data: q.question_data,
        correct_answer: q.correct_answer ?? null,
        explanation: q.explanation || "",
        difficulty_level: q.difficulty_level || difficulty,
        tags: Array.isArray(q.tags) ? q.tags : [],
        time_limit_seconds: Number(q.time_limit_seconds) || 60,
      }));
  }
}

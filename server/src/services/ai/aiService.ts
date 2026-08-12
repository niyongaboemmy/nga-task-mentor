import {
  generateStructuredContent,
  generateFreeformJSON,
  JSONSchema,
} from "../aiProviders";
import { getProviderStatus } from "../aiProviders/registry";
import { buildGenerateFromDocumentPrompt } from "./prompts/generateFromDocumentPrompt";
import {
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

// Every method below used to fan out across separate Gemini/OpenAI/Mock provider
// classes (each reimplementing the same prompt). They now all go through the shared
// aiProviders engine (server/src/services/aiProviders, ported from nga_central_mis),
// which tries providers in AI_PROVIDER_ORDER (gemini/groq/glm/openai) with automatic
// fallback and quota cooldown — same engine used by the Database Management AI panel.

const gradingSchema: JSONSchema = {
  type: "object",
  properties: {
    is_correct: { type: "boolean" },
    points_earned: { type: "number" },
    feedback: { type: "string" },
  },
  required: ["is_correct", "points_earned", "feedback"],
};

class AiServiceManager {
  async gradeShortAnswer(
    questionText: string,
    studentAnswer: string,
    correctAnswer: string,
    maxPoints: number,
    rubric?: string,
  ): Promise<AIGradingResult> {
    const { data } = await generateStructuredContent<AIGradingResult>({
      schemaName: "grading_result",
      schema: gradingSchema,
      prompt: `You are an expert academic grader. Grade the student's answer.
Question: ${questionText}
Correct Answer/Rubric: ${correctAnswer || rubric || "Not provided"}
Student's Answer: ${studentAnswer}
Max Points: ${maxPoints}`,
    });
    return {
      is_correct: !!data.is_correct,
      points_earned: Math.min(Number(data.points_earned) || 0, maxPoints),
      feedback: data.feedback || "Graded by AI.",
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
    const { data } = await generateStructuredContent<AIGradingResult>({
      schemaName: "grading_result",
      schema: gradingSchema,
      prompt: `Grade this numerical answer.
Question: ${questionText}
Correct Value: ${correctValue} (Tolerance: ±${tolerance}${units ? `, Units: ${units}` : ""})
Student's Answer: ${studentAnswer}
Max Points: ${maxPoints}`,
    });
    return {
      is_correct: !!data.is_correct,
      points_earned: Math.min(Number(data.points_earned) || 0, maxPoints),
      feedback: data.feedback || "Graded by AI.",
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
    // Correctness is determined by the test runner, not the AI — fixed here.
    const correctnessScore = Math.round(correctnessRatio * 60);

    const schema: JSONSchema = {
      type: "object",
      properties: {
        quality_score: { type: "number" },
        efficiency_score: { type: "number" },
        feedback: { type: "string" },
      },
      required: ["quality_score", "efficiency_score", "feedback"],
    };

    const { data } = await generateStructuredContent<{
      quality_score: number;
      efficiency_score: number;
      feedback: string;
    }>({
      schemaName: "coding_grading_result",
      schema,
      prompt: `You are a senior software engineer grading code (60/20/20 rubric).
Problem: ${questionText}
Language: ${language}
Constraints: ${constraints || "None"}
Test Results: ${passedTests}/${totalTests} passed.
Student Code:
${studentCode}

Grade quality (0-20) and efficiency (0-20). Correctness is fixed at ${correctnessScore}/60.`,
    });

    const qualityScore = Math.min(Math.max(Number(data.quality_score) || 0, 0), 20);
    const efficiencyScore = Math.min(Math.max(Number(data.efficiency_score) || 0, 0), 20);
    const totalScore = qualityScore + efficiencyScore + correctnessScore;

    return {
      is_correct: passedTests === totalTests && totalTests > 0,
      points_earned: (totalScore / 100) * maxPoints,
      feedback: data.feedback || "Graded by AI.",
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
    const lastMessages = chatHistory
      .slice(-4)
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n");

    const schema: JSONSchema = {
      type: "object",
      properties: { hint: { type: "string" } },
      required: ["hint"],
    };

    const { data } = await generateStructuredContent<{ hint: string }>({
      schemaName: "socratic_hint",
      schema,
      prompt: `You are a Socratic programming tutor. NEVER provide code solutions. Use leading questions to guide the student.
Problem: ${questionText}
Language: ${language}
Recent conversation:
${lastMessages}
Student's current code:
${studentCode}
${lastError ? `Error: ${lastError}` : ""}
Give a single helpful question or hint, as the "hint" field.`,
    });

    return data.hint || "Have you considered breaking the problem into smaller parts?";
  }

  async generateCodingTestCases(
    problemDescription: string,
    language: string,
    starterCode?: string,
  ): Promise<AITestCase[]> {
    const schema: JSONSchema = {
      type: "object",
      properties: {
        testcases: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              input: { type: "string" },
              expected_output: { type: "string" },
              is_hidden: { type: "boolean" },
              points: { type: "number" },
              explanation: { type: "string" },
            },
            required: ["id", "input", "expected_output", "is_hidden", "points", "explanation"],
          },
        },
      },
      required: ["testcases"],
    };

    const { data } = await generateStructuredContent<{ testcases: any[] }>({
      schemaName: "coding_test_cases",
      schema,
      prompt: `You are an expert in creating programming challenge test cases.
Problem: ${problemDescription}
Language: ${language}
${starterCode ? `Starter Code:\n${starterCode}` : ""}

Generate 3-5 high-quality test cases including a basic test, an edge case, and a hidden performance test.
Points must sum to 100.`,
    });

    return (data.testcases || []).map((tc: any, i: number) => ({
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
    questionType: "mcq" | "open-ended" | "true-false",
  ): Promise<AIQuizQuestion[]> {
    const schema: JSONSchema = {
      type: "object",
      properties: {
        questions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              question: { type: "string" },
              options: { type: "array", items: { type: "string" } },
              correctAnswer: { type: "string" },
              explanation: { type: "string" },
            },
            required: ["question", "options", "correctAnswer", "explanation"],
          },
        },
      },
      required: ["questions"],
    };

    const { data } = await generateStructuredContent<{ questions: AIQuizQuestion[] }>({
      schemaName: "quiz_questions",
      schema,
      prompt: `Generate ${count} ${difficulty} ${questionType} quiz questions about "${topic}".`,
    });

    return data.questions || [];
  }

  async giveFeedback(
    studentName: string,
    subject: string,
    performanceData: { scores: number[]; weakAreas: string[] },
  ): Promise<AIFeedback> {
    const avgScore =
      performanceData.scores.length > 0
        ? (
            performanceData.scores.reduce((a, b) => a + b, 0) / performanceData.scores.length
          ).toFixed(1)
        : "N/A";

    const schema: JSONSchema = {
      type: "object",
      properties: {
        summary: { type: "string" },
        strengths: { type: "array", items: { type: "string" } },
        improvements: { type: "array", items: { type: "string" } },
        encouragement: { type: "string" },
      },
      required: ["summary", "strengths", "improvements", "encouragement"],
    };

    const { data } = await generateStructuredContent<AIFeedback>({
      schemaName: "student_feedback",
      schema,
      prompt: `Provide encouraging teacher feedback.
Student: ${studentName}, Subject: ${subject}
Average Score: ${avgScore}, Weak Areas: ${performanceData.weakAreas.join(", ")}`,
    });

    return data;
  }

  async summarizeLesson(
    lessonContent: string,
    targetAudience: "student" | "teacher",
    length: "short" | "medium" | "detailed",
  ): Promise<AISummary> {
    const schema: JSONSchema = {
      type: "object",
      properties: {
        summary: { type: "string" },
        keyPoints: { type: "array", items: { type: "string" } },
        vocabulary: { type: "array", items: { type: "string" } },
      },
      required: ["summary", "keyPoints", "vocabulary"],
    };

    const { data } = await generateStructuredContent<AISummary>({
      schemaName: "lesson_summary",
      schema,
      prompt: `Summarize this lesson for a ${targetAudience} at ${length} depth.
Content: ${lessonContent.slice(0, 3000)}`,
    });

    return data;
  }

  async generateQuestionsFromDocument(
    params: AIGenerateFromDocumentParams,
  ): Promise<AIGeneratedQuestion[]> {
    // Question shape (question_data/correct_answer) differs per question_type, which
    // can't be expressed as one fixed JSON Schema — uses the freeform (prompt-only JSON)
    // path instead of constrained decoding, but still goes through the same provider
    // order/fallback/cooldown chain as every other operation here.
    const prompt = buildGenerateFromDocumentPrompt(params);
    const { data } = await generateFreeformJSON<any>(prompt, 8000);
    const arr = Array.isArray(data) ? data : data.questions || data.data || [];
    return this.normalizeGeneratedQuestions(arr, params.difficulty);
  }

  async generateSqlQuery(
    prompt: string,
    context: AISqlQueryContext,
  ): Promise<AISqlQueryResult & { providerUsed: string }> {
    const structureLine = context.tableColumns?.length
      ? `\nThe admin is currently viewing a table with these columns: ${context.tableColumns.join(", ")}.`
      : "";

    const schema: JSONSchema = {
      type: "object",
      properties: {
        sql: { type: "string" },
        explanation: { type: "string" },
      },
      required: ["sql", "explanation"],
    };

    const { data, providerUsed } = await generateStructuredContent<AISqlQueryResult>({
      schemaName: "database_sql_query",
      schema,
      maxOutputTokens: 800,
      prompt: `You are a senior MySQL database administrator helping write a single SQL query for a
school platform database (MySQL 8).

Available tables: ${context.tableNames.join(", ")}${structureLine}

The admin's request, in their own words:
"""
${prompt}
"""

Write ONE single valid MySQL statement fulfilling this request. Prefer SELECT unless the request explicitly
asks to insert, update, delete, or alter data. Never produce DROP DATABASE, DROP SCHEMA, GRANT, REVOKE, CREATE
USER, DROP USER, ALTER USER, SET GLOBAL, or SHUTDOWN. Do not wrap the SQL in markdown code fences, no trailing
semicolon.`,
    });

    return {
      sql: String(data.sql || "").trim(),
      explanation: data.explanation ? String(data.explanation) : undefined,
      providerUsed,
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

  getProviderStatus() {
    return getProviderStatus();
  }
}

export const aiService = new AiServiceManager();
export default aiService;

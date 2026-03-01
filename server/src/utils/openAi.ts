import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface AIGradingResult {
  is_correct: boolean;
  points_earned: number;
  feedback: string;
}

export class QuestionAiGrader {
  /**
   * Grades a short answer question using OpenAI.
   */
  static async gradeShortAnswer(
    questionText: string,
    studentAnswer: string,
    correctAnswer: string,
    maxPoints: number,
    rubric?: string,
  ): Promise<AIGradingResult> {
    if (!process.env.OPENAI_API_KEY) {
      console.warn("OPENAI_API_KEY is missing. AI grading skipped.");
      return {
        is_correct: false,
        points_earned: 0,
        feedback:
          "AI grading unavailable (API key missing). Manual grading required.",
      };
    }

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini", // Cost-effective and capable for grading
        messages: [
          {
            role: "system",
            content: `You are an expert academic grader. Grade the student's answer based on the provided question and correct answer/rubric. 
            Provide a response in JSON format with the following keys:
            - is_correct: boolean (true if the answer is substantially correct)
            - points_earned: number (out of ${maxPoints})
            - feedback: string (brief explanation of the grade)
            Be fair and consider partial credit if the answer is partially correct.`,
          },
          {
            role: "user",
            content: `Question: ${questionText}
            Correct Answer/Rubric: ${correctAnswer || rubric || "Not provided"}
            Student's Answer: ${studentAnswer}
            Max Points: ${maxPoints}`,
          },
        ],
        response_format: { type: "json_object" },
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");
      return {
        is_correct: !!result.is_correct,
        points_earned: Number(result.points_earned) || 0,
        feedback: result.feedback || "Graded by AI.",
      };
    } catch (error) {
      console.error("OpenAI grading error:", error);
      return {
        is_correct: false,
        points_earned: 0,
        feedback:
          "Error occurred during AI grading. Manual grading may be required.",
      };
    }
  }

  /**
   * Grades a numerical question using OpenAI for complex cases (e.g., units, conversions).
   */
  static async gradeNumerical(
    questionText: string,
    studentAnswer: string | number,
    correctValue: number,
    tolerance: number,
    maxPoints: number,
    units?: string,
  ): Promise<AIGradingResult> {
    if (!process.env.OPENAI_API_KEY) {
      return {
        is_correct: false,
        points_earned: 0,
        feedback:
          "AI grading unavailable. Manual grading recommended for unit checks.",
      };
    }

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a math and science grader. Grade the student's numerical answer.
            Consider units if provided. The correct value is ${correctValue} with a tolerance of ${tolerance}.
            Provide a response in JSON format:
            - is_correct: boolean
            - points_earned: number (out of ${maxPoints})
            - feedback: string`,
          },
          {
            role: "user",
            content: `Question: ${questionText}
            Correct Value: ${correctValue}
            Tolerance: ${tolerance}
            Units required: ${units || "None"}
            Student's Answer: ${studentAnswer}`,
          },
        ],
        response_format: { type: "json_object" },
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");
      return {
        is_correct: !!result.is_correct,
        points_earned: Number(result.points_earned) || 0,
        feedback: result.feedback || "Graded by AI.",
      };
    } catch (error) {
      console.error("OpenAI numerical grading error:", error);
      return {
        is_correct: false,
        points_earned: 0,
        feedback: "Error in AI numerical evaluation.",
      };
    }
  }

  /**
   * Grades a coding question using OpenAI for quality and efficiency.
   * Correctness is typically handled via Judge0 test cases.
   */
  static async gradeCoding(
    questionText: string,
    studentCode: string,
    language: string,
    testResults: any[],
    maxPoints: number,
    constraints?: string,
  ): Promise<
    AIGradingResult & {
      quality_score: number;
      efficiency_score: number;
      correctness_score: number;
    }
  > {
    if (!process.env.OPENAI_API_KEY) {
      return {
        is_correct: false,
        points_earned: 0,
        feedback: "AI grading unavailable.",
        quality_score: 0,
        efficiency_score: 0,
        correctness_score: 0,
      };
    }

    try {
      const passedTests = testResults.filter((r) => r.passed).length;
      const totalTests = testResults.length;
      const correctnessRatio = totalTests > 0 ? passedTests / totalTests : 0;

      const response = await openai.chat.completions.create({
        model: "gpt-4o", // Use more capable model for code analysis
        messages: [
          {
            role: "system",
            content: `You are an elite software engineer and technical interviewer. Grade the student's solution.
            Follow the 60/20/20 grading rule:
            - Correctness (60%): Already calculated as ${Math.round(correctnessRatio * 60)}% based on test cases.
            - Code Quality (20%): Cleanliness, naming, structure, idiomatic usage.
            - Efficiency (20%): Time and space complexity, optimal approach.

            Provide a response in JSON format:
            - quality_score: number (out of 20)
            - efficiency_score: number (out of 20)
            - correctness_score: number (out of 60, use ${Math.round(correctnessRatio * 60)})
            - feedback: string (comprehensive breakdown)
            - is_correct: boolean (true if correctness_score == 60)`,
          },
          {
            role: "user",
            content: `Problem: ${questionText}
            Constraints: ${constraints || "None provided"}
            Language: ${language}
            Student Code:
            \`\`\`${language}
            ${studentCode}
            \`\`\`
            Test Results: ${JSON.stringify(testResults.map((r) => ({ passed: r.passed, error: r.error })))}`,
          },
        ],
        response_format: { type: "json_object" },
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");
      const totalScore =
        (result.quality_score || 0) +
        (result.efficiency_score || 0) +
        (result.correctness_score || 0);
      const pointsEarned = (totalScore / 100) * maxPoints;

      return {
        is_correct: !!result.is_correct,
        points_earned: pointsEarned,
        feedback: result.feedback || "Graded by AI.",
        quality_score: result.quality_score || 0,
        efficiency_score: result.efficiency_score || 0,
        correctness_score: result.correctness_score || 0,
      };
    } catch (error) {
      console.error("OpenAI coding grading error:", error);
      return {
        is_correct: false,
        points_earned: 0,
        feedback: "Error in AI code evaluation.",
        quality_score: 0,
        efficiency_score: 0,
        correctness_score: 0,
      };
    }
  }

  /**
   * Provides a Socratic hint to a student without giving the solution.
   */
  static async getSocraticHint(
    questionText: string,
    studentCode: string,
    language: string,
    chatHistory: { role: "user" | "assistant"; content: string }[],
    lastError?: string,
  ): Promise<string> {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a Socratic programming tutor. Your goal is to help the student find the solution themselves.
            RULES:
            1. NEVER provide full code blocks or direct solutions.
            2. Use leading questions to guide their thinking.
            3. If they have a syntax error, explain the concept, not the fix.
            4. If they are stuck on logic, suggest a edge case or a simplified version of the problem.
            5. Keep responses concise and encouraging.`,
          },
          ...chatHistory,
          {
            role: "user",
            content: `Problem: ${questionText}
            Language: ${language}
            My current code:
            \`\`\`${language}
            ${studentCode}
            \`\`\`
            ${lastError ? `Latest Error: ${lastError}` : ""}
            Help me move forward.`,
          },
        ],
      });

      return (
        response.choices[0].message.content ||
        "I'm here to help! What part of the problem is most confusing right now?"
      );
    } catch (error) {
      console.error("Socratic hint error:", error);
      return "I'm having trouble connecting to my brain right now. Try reviewing the problem constraints!";
    }
  }

  /**
   * Generates intelligent test cases for a coding problem.
   */
  static async generateCodingTestCases(
    problemDescription: string,
    language: string,
    starterCode?: string,
  ): Promise<any[]> {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is missing.");
    }

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert programming challenge creator. 
            Generate 3-5 high-quality test cases for the given problem description and language.
            Include:
            1. Basic functional test
            2. Edge case (e.g., empty input, large numbers, special characters, null/undefined)
            3. Hidden test for complexity or performance (e.g., large data set, O(n) requirement)

            Return ONLY a JSON array of test case objects. DO NOT include any markdown formatting or introductory text.
            Each test case object MUST have:
            - id: unique string
            - input: string (the EXACT input to be passed to the program, formatted correctly for the language)
            - expected_output: string (the EXACT expected stdout or return value)
            - is_hidden: boolean (true for edge cases and complex tests)
            - points: number (out of 100 total, divide appropriately between cases)
            - explanation: brief description of what is being tested`,
          },
          {
            role: "user",
            content: `Problem Description: ${problemDescription}
            Language: ${language}
            ${starterCode ? `Starter Code:\n\`\`\`${language}\n${starterCode}\n\`\`\`` : ""}`,
          },
        ],
        response_format: { type: "json_object" },
      });

      const content =
        response.choices[0].message.content || '{"testcases": []}';
      const parsed = JSON.parse(content);

      // Extract the array, handling both direct array and { "testcases": [...] } formats
      const testCases = Array.isArray(parsed)
        ? parsed
        : parsed.testcases || parsed.test_cases || [];

      return testCases;
    } catch (error: any) {
      console.error("AI Test Case Generation error:", error);

      // Check if it's a quota or rate limit error
      const isQuotaError =
        error.status === 429 ||
        error.code === "insufficient_quota" ||
        error.message?.includes("quota");

      if (isQuotaError) {
        console.warn("OpenAI quota exceeded. Falling back to mock generator.");
        return this.generateMockTestCases(problemDescription, language);
      }

      throw error;
    }
  }

  /**
   * Fallback mock generator when AI is unavailable.
   */
  private static generateMockTestCases(
    description: string,
    lang: string,
  ): any[] {
    const cases: any[] = [];
    const descLower = description.toLowerCase();

    if (descLower.includes("fibonacci") || descLower.includes("sequence")) {
      cases.push(
        {
          id: "m1",
          input: "5",
          expected_output: "5",
          is_hidden: false,
          points: 20,
          explanation: "Basic Fibonacci check",
        },
        {
          id: "m2",
          input: "10",
          expected_output: "55",
          is_hidden: false,
          points: 30,
          explanation: "Larger Fibonacci number",
        },
        {
          id: "m3",
          input: "0",
          expected_output: "0",
          is_hidden: true,
          points: 50,
          explanation: "Edge case: zero input",
        },
      );
    } else if (descLower.includes("palindrome")) {
      cases.push(
        {
          id: "m1",
          input: '"racecar"',
          expected_output: "true",
          is_hidden: false,
          points: 30,
          explanation: "Basic palindrome",
        },
        {
          id: "m2",
          input: '"hello"',
          expected_output: "false",
          is_hidden: false,
          points: 30,
          explanation: "Non-palindrome check",
        },
        {
          id: "m3",
          input: '"A man a plan a canal Panama"',
          expected_output: "true",
          is_hidden: true,
          points: 40,
          explanation: "Palindrome with spaces and mixed case",
        },
      );
    } else {
      // Default fallback
      cases.push(
        {
          id: "d1",
          input: "Default Input 1",
          expected_output: "Expected Output 1",
          is_hidden: false,
          points: 50,
          explanation: "Generic functional test",
        },
        {
          id: "d2",
          input: "Default Input 2",
          expected_output: "Expected Output 2",
          is_hidden: true,
          points: 50,
          explanation: "Generic edge case test",
        },
      );
    }

    return cases;
  }
}

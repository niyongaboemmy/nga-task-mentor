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
}

import { QuizQuestion, QuizAttempt } from "../models";
import {
  AnswerDataType,
  QuestionDataType,
  GradingResult,
} from "../types/quiz.types";
import {
  QuestionGradingConfig,
  GradingResult as AdvancedGradingResult,
  NormalizedAnswer,
  NormalizedCorrectAnswer,
  QuizGradingConfig,
  BaseGradingConfig,
  MultipleChoiceGradingConfig,
  ShortAnswerGradingConfig,
  CodingGradingConfig,
  NumericalGradingConfig,
  MatchingGradingConfig,
  OrderingGradingConfig,
  FillBlankGradingConfig,
  TrueFalseGradingConfig,
  AlgorithmicGradingConfig,
} from "../types/grading.types";
import { CodeExecutor, TestCase } from "./codeExecutor";
import { Judge0Service } from "../services/Judge0Service";
import { aiService } from "../services/ai/aiService";

// Category-based grading functions
/**
 * Utility to strip HTML tags and LaTeX artifacts from strings for cleaner comparison
 */
const stripHtml = (html: any): string => {
  if (html === null || html === undefined) return "";
  if (typeof html !== "string") return String(html);

  // 1. Strip HTML tags
  let text = html.replace(/<[^>]*>?/gm, "");

  // 2. Replace common HTML entities BEFORE stripping LaTeX
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // 3. Strip LaTeX delimiters and common formatting commands while preserving content
  // Remove delimiters: \( \), \[ \], $ $
  text = text.replace(/\\\(|\\\)|\\\[|\\\]|\$/g, "");

  // Remove LaTeX commands but try to keep text inside common text wrappers
  text = text.replace(
    /\\(text|mathrm|mathbf|mathsf|mathtt|mathit|textbf|textit|texttt|textrm)\{([^}]*)\}/g,
    "$2",
  );

  // Remove other common LaTeX commands and mathematical artifacts
  // We remove the commands but keep the structure if possible.
  // For things like \frac{a}{b}, we keep a and b.
  text = text.replace(/\\(frac|tfrac|dfrac)\{([^}]*)\}\{([^}]*)\}/g, "$2 $3");
  text = text.replace(/\\(sqrt|overline|underline)\{([^}]*)\}/g, "$2");

  // Remove stylistic/layout commands
  text = text.replace(
    /\\(displaystyle|bold|color|underset|overset|left|right|big|Big|cell|row|column|hline|vline|\[|\]|tiny|small|large|Large|huge|Huge|\\|&)/g,
    "",
  );

  // 4. Normalize whitespace: replace newlines, carriage returns, tabs and multiple spaces
  return text
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

export class ChoiceQuestionGrader {
  static gradeSingleChoice(
    question: QuizQuestion,
    answerData: AnswerDataType,
  ): GradingResult {
    // Validate inputs
    if (!question || !answerData) {
      return {
        is_correct: false,
        points_earned: 0,
        feedback: "Invalid question or answer data",
      };
    }

    // Parse answerData if it's a JSON string from database
    let parsedAnswerData = answerData;
    if (typeof answerData === "string") {
      try {
        parsedAnswerData = JSON.parse(answerData);
      } catch (e) {
        return {
          is_correct: false,
          points_earned: 0,
          feedback: "Invalid answer format",
        };
      }
    }

    const answer = parsedAnswerData as {
      selected_option_index: number | string;
    };

    // Normalize correct answer from question
    const normalizedCorrect =
      AdvancedQuizGrader.normalizeCorrectAnswer(question);
    const correctAnswerData = normalizedCorrect.data;

    // Validate answer format and convert to number if needed
    let answerIndex: number;
    if (typeof answer.selected_option_index === "string") {
      answerIndex = parseInt(answer.selected_option_index, 10);
      if (isNaN(answerIndex)) {
        return {
          is_correct: false,
          points_earned: 0,
          feedback:
            "Invalid answer format - selected_option_index must be a number",
        };
      }
    } else if (typeof answer.selected_option_index === "number") {
      answerIndex = answer.selected_option_index;
    } else {
      return {
        is_correct: false,
        points_earned: 0,
        feedback: `Invalid answer format - selected_option_index must be a number. Received: ${JSON.stringify(
          answer.selected_option_index,
        )} of type ${typeof answer.selected_option_index}`,
      };
    }

    // Validate correct answer format
    if (
      !correctAnswerData ||
      typeof correctAnswerData !== "object" ||
      typeof correctAnswerData.selected_option_index !== "number"
    ) {
      return {
        is_correct: false,
        points_earned: 0,
        feedback: `Question has no valid correct answer. correctAnswerData: ${JSON.stringify(
          correctAnswerData,
        )}, question_data: ${JSON.stringify(
          question.questionBank?.question_data,
        )}, correct_answer: ${JSON.stringify(question.questionBank?.correct_answer)}`,
      };
    }

    const correctAnswer = correctAnswerData.selected_option_index;
    const isCorrect = String(answerIndex) === String(correctAnswer);

    console.log(`[Basic Grader] Single Choice Match:`, {
      student: answerIndex,
      correct: correctAnswer,
      isCorrect,
    });

    return {
      is_correct: isCorrect,
      points_earned: isCorrect ? parseFloat(String(question.points || 0)) : 0,
      feedback: isCorrect ? "Correct!" : "Incorrect selection",
    };
  }

  static gradeMultipleChoice(
    question: QuizQuestion,
    answerData: AnswerDataType,
  ): GradingResult {
    // Validate inputs
    if (!question || !answerData) {
      return {
        is_correct: false,
        points_earned: 0,
        feedback: "Invalid question or answer data",
      };
    }

    // Parse answerData if it's a JSON string from database
    let parsedAnswerData = answerData;
    if (typeof answerData === "string") {
      try {
        parsedAnswerData = JSON.parse(answerData);
      } catch (e) {
        return {
          is_correct: false,
          points_earned: 0,
          feedback: "Invalid answer format",
        };
      }
    }

    const answer = parsedAnswerData as {
      selected_option_indices: (number | string)[];
    };

    // Normalize correct answer from question
    const normalizedCorrect =
      AdvancedQuizGrader.normalizeCorrectAnswer(question);
    const correctAnswerData = normalizedCorrect.data;

    // Validate answer format and convert to numbers if needed
    if (!Array.isArray(answer.selected_option_indices)) {
      return {
        is_correct: false,
        points_earned: 0,
        feedback: "Invalid answer format",
      };
    }

    const answerIndices: number[] = [];
    for (const idx of answer.selected_option_indices) {
      if (typeof idx === "string") {
        const parsed = parseInt(idx, 10);
        if (isNaN(parsed)) {
          return {
            is_correct: false,
            points_earned: 0,
            feedback:
              "Invalid answer format - selected_option_indices must contain numbers",
          };
        }
        answerIndices.push(parsed);
      } else if (typeof idx === "number") {
        answerIndices.push(idx);
      } else {
        return {
          is_correct: false,
          points_earned: 0,
          feedback:
            "Invalid answer format - selected_option_indices must contain numbers",
        };
      }
    }

    // Validate correct answer format
    if (
      !correctAnswerData ||
      typeof correctAnswerData !== "object" ||
      !Array.isArray(correctAnswerData.selected_option_indices)
    ) {
      return {
        is_correct: false,
        points_earned: 0,
        feedback: "Question has no valid correct answer",
      };
    }

    const correctAnswer = correctAnswerData.selected_option_indices;

    // Sort both arrays for comparison
    const correctAnswers = [...correctAnswer].sort();
    const studentAnswers = [...answerIndices].sort();

    // Check if arrays are identical
    const isCorrect =
      correctAnswers.length === studentAnswers.length &&
      correctAnswers.every((val, index) => val === studentAnswers[index]);

    // For partial credit, calculate based on correct selections
    let pointsEarned = 0;
    const questionPoints = parseFloat(String(question.points || 0));
    if (isCorrect) {
      pointsEarned = questionPoints;
    } else {
      // Give partial credit for correct selections (if any)
      const correctSelections = studentAnswers.filter((index) =>
        correctAnswers.includes(index),
      ).length;

      if (correctSelections > 0) {
        pointsEarned = Math.round(
          (correctSelections / correctAnswers.length) * questionPoints,
        );
      }
    }

    return {
      is_correct: isCorrect,
      points_earned: pointsEarned,
      feedback: isCorrect
        ? "All selections correct!"
        : "Some selections incorrect",
    };
  }

  static gradeTrueFalse(
    question: QuizQuestion,
    answerData: AnswerDataType,
  ): GradingResult {
    // Validate inputs
    if (!question || !answerData) {
      return {
        is_correct: false,
        points_earned: 0,
        feedback: "Invalid question or answer data",
      };
    }

    // Parse answerData if it's a JSON string from database
    let parsedAnswerData = answerData;
    if (typeof answerData === "string") {
      try {
        parsedAnswerData = JSON.parse(answerData);
      } catch (e) {
        return {
          is_correct: false,
          points_earned: 0,
          feedback: "Invalid answer format",
        };
      }
    }

    const answer = parsedAnswerData as { selected_answer: boolean | string };

    // Normalize correct answer from question
    const normalizedCorrect =
      AdvancedQuizGrader.normalizeCorrectAnswer(question);
    const correctAnswerData = normalizedCorrect.data;

    // Validate answer format and convert to boolean if needed
    let answerBool: boolean;
    if (typeof answer.selected_answer === "string") {
      if (answer.selected_answer.toLowerCase() === "true") {
        answerBool = true;
      } else if (answer.selected_answer.toLowerCase() === "false") {
        answerBool = false;
      } else {
        return {
          is_correct: false,
          points_earned: 0,
          feedback: "Invalid answer format - selected_answer must be a boolean",
        };
      }
    } else if (typeof answer.selected_answer === "boolean") {
      answerBool = answer.selected_answer;
    } else {
      return {
        is_correct: false,
        points_earned: 0,
        feedback: "Invalid answer format - selected_answer must be a boolean",
      };
    }

    // Validate correct answer format
    if (!correctAnswerData || typeof correctAnswerData !== "object") {
      return {
        is_correct: false,
        points_earned: 0,
        feedback: "Question has no valid correct answer data",
      };
    }

    const rawCorrect = correctAnswerData.selected_answer;
    let correctAnswer: boolean;

    if (typeof rawCorrect === "boolean") {
      correctAnswer = rawCorrect;
    } else if (typeof rawCorrect === "string") {
      correctAnswer = rawCorrect.toLowerCase() === "true";
    } else {
      return {
        is_correct: false,
        points_earned: 0,
        feedback: "Invalid correct answer format - must be boolean or string",
      };
    }

    const isCorrect = answerBool === correctAnswer;

    console.log(`[Basic Grader] True/False Match:`, {
      student: answerBool,
      correct: correctAnswer,
      isCorrect,
    });

    return {
      is_correct: isCorrect,
      points_earned: isCorrect ? parseFloat(String(question.points || 0)) : 0,
      feedback: isCorrect ? "Correct!" : "Incorrect answer",
    };
  }
}

export class TextInputGrader {
  static async gradeNumerical(
    question: QuizQuestion,
    answerData: AnswerDataType,
  ): Promise<GradingResult> {
    console.log("\n[DEBUG] ========== NUMERICAL GRADING START ==========");
    console.log("[DEBUG] Raw answerData:", JSON.stringify(answerData, null, 2));
    console.log("[DEBUG] answerData type:", typeof answerData);
    console.log(
      "[DEBUG] question.questionBank:",
      question.questionBank ? "exists" : "missing",
    );
    console.log(
      "[DEBUG] question.questionBank.correct_answer:",
      question.questionBank?.correct_answer,
    );
    console.log(
      "[DEBUG] question.questionBank.question_data:",
      JSON.stringify(question.questionBank?.question_data, null, 2),
    );

    // Validate question data structure
    if (!question || !question.questionBank?.question_data) {
      console.log("[DEBUG] FAIL: Invalid question data structure");
      return {
        is_correct: false,
        points_earned: 0,
        feedback: "Numerical question: Invalid question data",
      };
    }

    let questionData = question.questionBank?.question_data as any;
    // If question_data is stored as a string, parse it
    if (typeof questionData === "string") {
      console.log("[DEBUG] questionData is string, parsing...");
      try {
        questionData = JSON.parse(questionData);
        console.log(
          "[DEBUG] Parsed questionData:",
          JSON.stringify(questionData, null, 2),
        );
      } catch (e) {
        console.log("[DEBUG] FAIL: Could not parse questionData");
        return {
          is_correct: false,
          points_earned: 0,
          feedback: "Numerical question: Invalid question data format",
        };
      }
    }

    // Validate answer data
    if (!answerData) {
      console.log("[DEBUG] FAIL: No answerData provided");
      return {
        is_correct: false,
        points_earned: 0,
        feedback: "Numerical question: No answer provided",
      };
    }

    const answer = answerData as any;
    console.log("[DEBUG] answer object:", JSON.stringify(answer, null, 2));
    console.log("[DEBUG] answer.answer type:", typeof answer.answer);
    console.log("[DEBUG] answer.answer value:", answer.answer);

    // Validate answer structure
    if (
      typeof answer.answer !== "number" &&
      typeof answer.answer !== "string"
    ) {
      console.log("[DEBUG] FAIL: answer.answer is neither number nor string");
      return {
        is_correct: false,
        points_earned: 0,
        feedback:
          "Numerical question: Invalid answer format - expected numeric value",
      };
    }

    // Helper function to parse LaTeX fractions and convert to numeric value
    const parseLatexNumber = (text: string): number | null => {
      const trimmed = text.trim();

      // Handle LaTeX fractions: \frac{a}{b} -> a/b
      const fracMatch = trimmed.match(/\\frac\{([^}]*)\}\{([^}]*)\}/);
      if (fracMatch) {
        const numerator = parseFloat(fracMatch[1]);
        const denominator = parseFloat(fracMatch[2]);
        if (!isNaN(numerator) && !isNaN(denominator) && denominator !== 0) {
          return numerator / denominator;
        }
      }

      // Handle inline fractions: a/b or a÷b
      const inlineFracMatch = trimmed.match(/([\d.]+)\s*[\/÷]\s*([\d.]+)/);
      if (inlineFracMatch) {
        const numerator = parseFloat(inlineFracMatch[1]);
        const denominator = parseFloat(inlineFracMatch[2]);
        if (!isNaN(numerator) && !isNaN(denominator) && denominator !== 0) {
          return numerator / denominator;
        }
      }

      // Handle percentages: 50% -> 0.5
      const percentMatch = trimmed.match(/([\d.]+)\s*%/);
      if (percentMatch) {
        const value = parseFloat(percentMatch[1]);
        if (!isNaN(value)) {
          return value / 100;
        }
      }

      // Handle scientific notation: 1e5, 1E5, 1×10^5
      const sciMatch = trimmed.match(/([\d.]+)\s*[×x]\s*10\^?([\d-]+)/i);
      if (sciMatch) {
        const base = parseFloat(sciMatch[1]);
        const exp = parseInt(sciMatch[2], 10);
        if (!isNaN(base) && !isNaN(exp)) {
          return base * Math.pow(10, exp);
        }
      }

      return null;
    };

    // Convert string to number if needed
    let studentAnswer: number;
    const cleanStudentText = stripHtml(answer.answer);

    if (typeof answer.answer === "string") {
      // First try to parse LaTeX expressions
      const latexResult = parseLatexNumber(cleanStudentText);
      if (latexResult !== null) {
        studentAnswer = latexResult;
      } else {
        // Standard parsing
        studentAnswer = parseFloat(cleanStudentText);

        // Second pass parsing: if parseFloat fails, strip ALL non-numeric chars except . and -
        if (isNaN(studentAnswer)) {
          const numericOnly = cleanStudentText.replace(/[^0-9.-]/g, "");
          studentAnswer = parseFloat(numericOnly);
        }

        if (isNaN(studentAnswer)) {
          return {
            is_correct: false,
            points_earned: 0,
            feedback: `Numerical question: Could not parse "${cleanStudentText}" as a number`,
          };
        }
      }
    } else {
      studentAnswer = answer.answer;
    }

    // Validate question configuration
    let correctValue: number;
    // Check both questionBank.correct_answer and question_data.correct_answer
    // Use explicit undefined/null checks to handle 0
    const rawCorrect =
      question.questionBank?.correct_answer !== undefined &&
      question.questionBank?.correct_answer !== null
        ? question.questionBank.correct_answer
        : questionData.correct_answer;

    if (typeof rawCorrect === "number") {
      correctValue = rawCorrect;
    } else if (rawCorrect !== undefined && rawCorrect !== null) {
      // Handle string or object formatted correct answer
      let strCorrect = "";
      if (typeof rawCorrect === "object") {
        const val =
          (rawCorrect as any).answer !== undefined &&
          (rawCorrect as any).answer !== null
            ? (rawCorrect as any).answer
            : (rawCorrect as any).value;
        strCorrect = String(val !== undefined && val !== null ? val : "");
      } else {
        strCorrect = String(rawCorrect);
      }

      const cleanCorrectText = stripHtml(strCorrect);

      // Try LaTeX parsing first for correct answer
      const latexResult = parseLatexNumber(cleanCorrectText);
      if (latexResult !== null) {
        correctValue = latexResult;
      } else {
        correctValue = parseFloat(cleanCorrectText);

        // Second pass for correct answer too
        if (isNaN(correctValue)) {
          const numericOnly = cleanCorrectText.replace(/[^0-9.-]/g, "");
          correctValue = parseFloat(numericOnly);
        }
      }
    } else {
      return {
        is_correct: false,
        points_earned: 0,
        feedback: "Numerical question: No correct answer defined",
      };
    }

    if (isNaN(correctValue)) {
      return {
        is_correct: false,
        points_earned: 0,
        feedback: "Numerical question: Correct answer is not a valid number",
      };
    }
    const tolerance =
      typeof questionData.tolerance === "number" ? questionData.tolerance : 0;

    // Check if within tolerance
    const isCorrect = Math.abs(studentAnswer - correctValue) <= tolerance;

    // Check if within acceptable range if specified
    let rangeCheck = true;
    if (
      questionData.acceptable_range &&
      typeof questionData.acceptable_range === "object"
    ) {
      if (
        typeof questionData.acceptable_range.min === "number" &&
        typeof questionData.acceptable_range.max === "number"
      ) {
        rangeCheck =
          studentAnswer >= questionData.acceptable_range.min &&
          studentAnswer <= questionData.acceptable_range.max;
      }
    }

    const finalIsCorrect = isCorrect && rangeCheck;

    console.log(`[Basic Grader] Numerical Match:`, {
      student: studentAnswer,
      correct: correctValue,
      tolerance,
      rangeCheck,
      finalIsCorrect,
    });

    // If units are required, we might want to use AI to verify them if simple checks aren't enough
    // But for now, we'll return the base result.
    return {
      is_correct: finalIsCorrect,
      points_earned: finalIsCorrect
        ? parseFloat(String(question.points || 0))
        : 0,
      feedback: finalIsCorrect
        ? "Correct numerical answer!"
        : `Expected ${correctValue}${
            questionData.units ? ` ${questionData.units}` : ""
          } (tolerance: ±${tolerance})`,
    };
  }

  static gradeFillBlank(
    question: QuizQuestion,
    answerData: AnswerDataType,
  ): GradingResult {
    console.log("\n[DEBUG] ========== FILL_BLANK GRADING START ==========");
    console.log("[DEBUG] Raw answerData:", JSON.stringify(answerData, null, 2));
    console.log("[DEBUG] answerData type:", typeof answerData);
    console.log(
      "[DEBUG] question.questionBank:",
      question.questionBank ? "exists" : "missing",
    );
    console.log(
      "[DEBUG] question.questionBank.question_data:",
      JSON.stringify(question.questionBank?.question_data, null, 2),
    );

    // Validate question data structure
    if (!question || !question.questionBank?.question_data) {
      console.log("[DEBUG] FAIL: Invalid question data structure");
      return {
        is_correct: false,
        points_earned: 0,
        feedback: "Fill blank question: Invalid question data",
      };
    }

    let questionData = question.questionBank?.question_data as any;
    // If question_data is stored as a string, parse it
    if (typeof questionData === "string") {
      console.log("[DEBUG] questionData is string, parsing...");
      try {
        questionData = JSON.parse(questionData);
        console.log(
          "[DEBUG] Parsed questionData:",
          JSON.stringify(questionData, null, 2),
        );
      } catch (e) {
        console.log("[DEBUG] FAIL: Could not parse questionData");
        return {
          is_correct: false,
          points_earned: 0,
          feedback: "Fill blank question: Invalid question data format",
        };
      }
    }

    // Validate answer data
    if (!answerData) {
      console.log("[DEBUG] FAIL: No answerData provided");
      return {
        is_correct: false,
        points_earned: 0,
        feedback: "Fill blank question: No answer provided",
      };
    }

    const answer = answerData as any;
    console.log("[DEBUG] answer object:", JSON.stringify(answer, null, 2));
    console.log("[DEBUG] answer.answers:", answer.answers);
    console.log("[DEBUG] answer.answer:", answer.answer);

    // Validate answer structure - handle both 'answers' array and single answer object
    let answerArray: any[] = [];
    if (Array.isArray(answer.answers)) {
      console.log("[DEBUG] Found answer.answers array");
      answerArray = answer.answers;
    } else if (typeof answer.answer === "string") {
      console.log(
        "[DEBUG] Found single answer.answer string, wrapping in array",
      );
      // Single blank case - wrap in array format
      answerArray = [{ blank_index: 0, answer: answer.answer }];
    } else if (typeof answer === "string") {
      console.log("[DEBUG] Found direct string answer, wrapping in array");
      // Direct string answer for single blank
      answerArray = [{ blank_index: 0, answer: answer }];
    }

    console.log(
      "[DEBUG] Final answerArray:",
      JSON.stringify(answerArray, null, 2),
    );

    if (answerArray.length === 0) {
      console.log("[DEBUG] FAIL: answerArray is empty");
      return {
        is_correct: false,
        points_earned: 0,
        feedback:
          "Fill blank question: Invalid answer format - expected answers array",
      };
    }

    // Validate question configuration
    if (
      !questionData.acceptable_answers ||
      !Array.isArray(questionData.acceptable_answers)
    ) {
      console.log("[DEBUG] FAIL: No acceptable_answers in questionData");
      console.log(
        "[DEBUG] questionData.acceptable_answers:",
        questionData.acceptable_answers,
      );
      return {
        is_correct: false,
        points_earned: 0,
        feedback:
          "Fill blank question: No acceptable answers defined in question configuration",
      };
    }

    console.log(
      "[DEBUG] acceptable_answers:",
      JSON.stringify(questionData.acceptable_answers, null, 2),
    );

    // Validate text_with_blanks exists
    if (
      !questionData.text_with_blanks ||
      typeof questionData.text_with_blanks !== "string"
    ) {
      return {
        is_correct: false,
        points_earned: 0,
        feedback:
          "Fill blank question: Question text with blanks is missing or invalid",
      };
    }

    let correctBlanks = 0;
    const totalBlanks = questionData.acceptable_answers.length;

    // Validate each blank has proper configuration
    for (let index = 0; index < totalBlanks; index++) {
      const blank = questionData.acceptable_answers[index];

      if (
        !blank ||
        !Array.isArray(blank.answers) ||
        blank.answers.length === 0
      ) {
        return {
          is_correct: false,
          points_earned: 0,
          feedback: `Fill blank question: Blank ${
            index + 1
          } has no acceptable answers defined`,
        };
      }

      const studentAnswer = answerArray.find(
        (a: any) => a && typeof a === "object" && a.blank_index === index,
      );

      if (
        studentAnswer &&
        (typeof studentAnswer.answer === "string" ||
          typeof studentAnswer.answer === "number")
      ) {
        // Strip HTML/LaTeX from student answer and convert to string
        const studentAnsStr = stripHtml(String(studentAnswer.answer));

        const isCorrect = blank.answers.some((acceptableAnswer: any) => {
          // Handle both string and object acceptable answers
          let acceptableStr: string;
          if (
            typeof acceptableAnswer === "object" &&
            acceptableAnswer !== null
          ) {
            acceptableStr = String(
              acceptableAnswer.text ||
                acceptableAnswer.value ||
                acceptableAnswer.answer ||
                "",
            );
          } else {
            acceptableStr = String(acceptableAnswer);
          }

          // Strip HTML/LaTeX from acceptable answer
          const acceptableAnsClean = stripHtml(acceptableStr);

          // Case-insensitive comparison by default, unless case_sensitive is explicitly true
          const match = blank.case_sensitive
            ? studentAnsStr === acceptableAnsClean
            : studentAnsStr.toLowerCase() === acceptableAnsClean.toLowerCase();

          console.log(`[Grader] FillBlank Match [${index}]:`, {
            student: studentAnsStr,
            acceptable: acceptableAnsClean,
            caseSensitive: !!blank.case_sensitive,
            match,
          });

          return match;
        });

        if (isCorrect) {
          correctBlanks++;
        }
      }
    }

    const pointsEarned = Math.round(
      (correctBlanks / totalBlanks) * parseFloat(String(question.points || 0)),
    );

    return {
      is_correct: correctBlanks === totalBlanks,
      points_earned: pointsEarned,
      feedback: `${correctBlanks}/${totalBlanks} blanks correct`,
    };
  }

  static async gradeShortAnswer(
    question: QuizQuestion,
    answerData: AnswerDataType,
  ): Promise<GradingResult> {
    console.log("\n[DEBUG] ========== SHORT_ANSWER GRADING START ==========");
    console.log("[DEBUG] question.points:", question.points);
    console.log(
      "[DEBUG] question.questionBank:",
      question.questionBank ? "exists" : "missing",
    );

    let questionData = question.questionBank?.question_data as any;
    // If question_data is stored as a string, parse it
    if (typeof questionData === "string") {
      try {
        questionData = JSON.parse(questionData);
      } catch (e) {
        questionData = {};
      }
    }
    let answer = answerData as any;
    // If answer_data is stored as a string, parse it
    if (typeof answer === "string") {
      try {
        answer = JSON.parse(answer);
      } catch (e) {
        answer = {};
      }
    }

    console.log("[DEBUG] answer.answer:", answer.answer);

    if (typeof answer.answer !== "string") {
      return {
        is_correct: false,
        points_earned: 0,
        feedback: "Invalid answer format",
      };
    }

    // Check length constraints
    if (
      questionData.max_length &&
      answer.answer.length > questionData.max_length
    ) {
      return {
        is_correct: false,
        points_earned: 0,
        feedback: "Answer exceeds maximum length",
      };
    }

    const maxPoints = parseFloat(String(question.points || 0));
    console.log("[DEBUG] maxPoints being passed to AI:", maxPoints);

    try {
      const aiResult = await aiService.gradeShortAnswer(
        question.questionBank?.question_text || "",
        answer.answer,
        questionData.correct_answer || "",
        maxPoints,
        questionData.rubric,
      );
      console.log("[DEBUG] AI result:", JSON.stringify(aiResult, null, 2));
      return aiResult;
    } catch (error) {
      console.log("[DEBUG] AI grading failed, falling back to keyword-based");
      // Fallback to keyword-based grading if AI completely fails
    }

    // Fallback: keyword-based grading
    if (questionData.keywords && questionData.keywords.length > 0) {
      const answerLower = answer.answer.toLowerCase();
      const foundKeywords = questionData.keywords.filter((keyword: string) =>
        answerLower.includes(keyword.toLowerCase()),
      );

      const keywordScore =
        (foundKeywords.length / questionData.keywords.length) * question.points;

      return {
        is_correct: foundKeywords.length === questionData.keywords.length,
        points_earned: Math.round(keywordScore),
        feedback: `Found ${foundKeywords.length}/${questionData.keywords.length} key concepts`,
      };
    }

    return {
      is_correct: false,
      points_earned: 0,
      feedback: "Manual grading recommended (AI/Keywords missing)",
    };
  }
}

export class InteractiveGrader {
  static gradeMatching(
    question: QuizQuestion,
    answerData: AnswerDataType,
  ): GradingResult {
    // Validate question data structure
    if (!question || !question.questionBank?.question_data) {
      return {
        is_correct: false,
        points_earned: 0,
        feedback: "Matching question: Invalid question data",
      };
    }

    let questionData = question.questionBank?.question_data as any;
    // If question_data is stored as a string, parse it
    if (typeof questionData === "string") {
      try {
        questionData = JSON.parse(questionData);
      } catch (e) {
        return {
          is_correct: false,
          points_earned: 0,
          feedback: "Matching question: Invalid question data format",
        };
      }
    }

    // Validate answer data
    if (!answerData) {
      return {
        is_correct: false,
        points_earned: 0,
        feedback: "Matching question: No answer provided",
      };
    }

    const answer = answerData as any;

    // Validate answer structure
    if (!answer.matches || typeof answer.matches !== "object") {
      return {
        is_correct: false,
        points_earned: 0,
        feedback:
          "Matching question: Invalid answer format - expected matches object",
      };
    }

    // Validate question configuration - check for left and right items
    if (
      !questionData.left_items ||
      !Array.isArray(questionData.left_items) ||
      questionData.left_items.length === 0
    ) {
      return {
        is_correct: false,
        points_earned: 0,
        feedback: "Matching question: No left items defined",
      };
    }

    if (
      !questionData.right_items ||
      !Array.isArray(questionData.right_items) ||
      questionData.right_items.length === 0
    ) {
      return {
        is_correct: false,
        points_earned: 0,
        feedback: "Matching question: No right items defined",
      };
    }

    // Check for correct answer in question_data first, then in correct_answer
    let correctMappings: Record<string, string> | undefined;

    if (
      questionData &&
      questionData.correct_matches &&
      typeof questionData.correct_matches === "object"
    ) {
      correctMappings = questionData.correct_matches;
    } else if (
      question.questionBank?.correct_answer &&
      (question.questionBank?.correct_answer as any).mappings &&
      typeof (question.questionBank?.correct_answer as any).mappings ===
        "object"
    ) {
      correctMappings = (question.questionBank?.correct_answer as any).mappings;
    }

    if (!correctMappings || Object.keys(correctMappings).length === 0) {
      return {
        is_correct: false,
        points_earned: 0,
        feedback: "Matching question: No correct matches defined",
      };
    }

    // Validate that all required matches are present
    const totalMatches = Object.keys(correctMappings).length;
    const providedMatches = Object.keys(answer.matches).length;

    if (providedMatches === 0) {
      return {
        is_correct: false,
        points_earned: 0,
        feedback: "Matching question: No matches provided",
      };
    }

    let correctMatches = 0;

    // Validate each mapping
    Object.entries(correctMappings).forEach(([leftId, rightId]) => {
      const studentRightId = String(answer.matches[leftId]);
      const targetRightId = String(rightId);
      if (studentRightId === targetRightId) {
        correctMatches++;
      }
    });

    console.log(`[Basic Grader] Matching Match:`, {
      totalMatches,
      correctMatches,
      isCorrect: correctMatches === totalMatches,
    });

    const pointsEarned = Math.round(
      (correctMatches / totalMatches) *
        parseFloat(String(question.points || 0)),
    );

    return {
      is_correct: correctMatches === totalMatches,
      points_earned: pointsEarned,
      feedback: `${correctMatches}/${totalMatches} matches correct`,
    };
  }

  static gradeOrdering(
    question: QuizQuestion,
    answerData: AnswerDataType,
  ): GradingResult {
    let questionData = question.questionBank?.question_data as any;
    // If question_data is stored as a string, parse it
    if (typeof questionData === "string") {
      try {
        questionData = JSON.parse(questionData);
      } catch (e) {
        questionData = {};
      }
    }
    const answer = answerData as any;

    if (!Array.isArray(answer.ordered_item_ids)) {
      return {
        is_correct: false,
        points_earned: 0,
        feedback: "Invalid answer format",
      };
    }

    // Validate question has items
    if (!Array.isArray(questionData.items) || questionData.items.length === 0) {
      return {
        is_correct: false,
        points_earned: 0,
        feedback: "Ordering question: No items defined",
      };
    }

    // Build the canonical correct order list. We prefer using each item's `order`
    // field when present, but we treat it as relative ordering only (0-based or
    // 1-based doesn't matter) by sorting and comparing IDs by position.
    const itemsWithOrder = questionData.items
      .map((item: any) => {
        const orderRaw =
          typeof item.order === "number"
            ? item.order
            : parseInt(String(item.order), 10);
        return {
          item,
          order: Number.isFinite(orderRaw) ? orderRaw : null,
          idStr: String(item.id),
          textKey: stripHtml(item.text || item.content || "").toLowerCase(),
        };
      })
      .filter((x: any) => x.idStr);

    const canSortByOrder = itemsWithOrder.every((x: any) => x.order !== null);

    const sorted = canSortByOrder
      ? [...itemsWithOrder].sort(
          (a: any, b: any) => (a.order as number) - (b.order as number),
        )
      : [...itemsWithOrder];

    const correctOrderedIds = sorted.map((x: any) => x.idStr);
    const correctTextToIndex: Record<string, number> = {};
    sorted.forEach((x: any, idx: number) => {
      if (x.textKey) correctTextToIndex[x.textKey] = idx;
    });

    let correctPositions = 0;
    const totalItems = questionData.items.length;

    // Check if answer has the right number of items
    if (answer.ordered_item_ids.length !== totalItems) {
      return {
        is_correct: false,
        points_earned: 0,
        feedback: `Invalid answer: expected ${totalItems} items, got ${answer.ordered_item_ids.length}`,
      };
    }

    // Check each item position by comparing against the canonical ordered list.
    // If the student's array contains text instead of IDs, fall back to text matching.
    answer.ordered_item_ids.forEach((itemId: any, index: number) => {
      const studentToken = String(itemId);

      const expectedIdAtIndex = correctOrderedIds[index];
      const isByIdCorrect =
        expectedIdAtIndex !== undefined && studentToken === expectedIdAtIndex;

      let isByTextCorrect = false;
      if (!isByIdCorrect) {
        const stripped = stripHtml(studentToken).toLowerCase();
        const expectedIndex = correctTextToIndex[stripped];
        isByTextCorrect = expectedIndex === index;
      }

      if (isByIdCorrect || isByTextCorrect) {
        correctPositions++;
      }
    });

    console.log(`[Basic Grader] Ordering Match:`, {
      totalItems,
      correctPositions,
      isCorrect: correctPositions === totalItems,
    });

    const pointsEarned = Math.round(
      (correctPositions / totalItems) *
        parseFloat(String(question.points || 0)),
    );

    return {
      is_correct: correctPositions === totalItems,
      points_earned: pointsEarned,
      feedback: `${correctPositions}/${totalItems} items in correct order`,
    };
  }

  static gradeDropdown(
    question: QuizQuestion,
    answerData: AnswerDataType,
  ): GradingResult {
    let questionData = question.questionBank?.question_data as any;
    if (typeof questionData === "string") {
      try {
        questionData = JSON.parse(questionData);
      } catch (e) {
        questionData = {};
      }
    }
    const correctAnswer = question.questionBank?.correct_answer as any;
    const answer = answerData as any;

    // Validate answer structure - handle multiple formats
    let selectionsArray: any[] = [];
    if (answer) {
      if (Array.isArray(answer.selections)) {
        selectionsArray = answer.selections;
      } else if (Array.isArray(answer)) {
        // Direct array format: ["option1", "option2"]
        selectionsArray = answer.map((opt: any, idx: number) => ({
          dropdown_index: idx,
          selected_option: typeof opt === "object" ? opt.selected_option : opt,
        }));
      } else if (typeof answer === "object") {
        // Object with numeric keys: { "0": "option1", "1": "option2" }
        selectionsArray = Object.entries(answer)
          .filter(([key]) => !isNaN(parseInt(key)))
          .map(([key, val]) => ({
            dropdown_index: parseInt(key),
            selected_option: val,
          }));
      }
    }

    if (selectionsArray.length === 0) {
      return {
        is_correct: false,
        points_earned: 0,
        feedback: "Invalid answer format - no selections provided",
      };
    }

    const dropdownOptions = questionData.dropdown_options || [];

    if (dropdownOptions.length === 0) {
      return {
        is_correct: false,
        points_earned: 0,
        feedback: "No dropdown options defined in question",
      };
    }

    let correctSelections = 0;

    // Build a map of correct answers for each dropdown
    const correctAnswersMap: Record<number, string> = {};

    // 1. Parse correct_answer column (multiple formats)
    let parsedCorrectAnswer = correctAnswer;
    if (typeof correctAnswer === "string") {
      try {
        parsedCorrectAnswer = JSON.parse(correctAnswer);
      } catch (e) {
        // Keep as string if not JSON
      }
    }

    // Handle array format: ["answer1", "answer2"]
    if (Array.isArray(parsedCorrectAnswer)) {
      parsedCorrectAnswer.forEach((item: any, idx: number) => {
        if (typeof item === "object" && item.selected_option !== undefined) {
          correctAnswersMap[item.dropdown_index ?? idx] = String(
            item.selected_option,
          );
        } else {
          correctAnswersMap[idx] = String(item);
        }
      });
    }
    // Handle object with selections array
    else if (
      parsedCorrectAnswer &&
      Array.isArray(parsedCorrectAnswer.selections)
    ) {
      parsedCorrectAnswer.selections.forEach((item: any) => {
        if (
          item.dropdown_index !== undefined &&
          item.selected_option !== undefined
        ) {
          correctAnswersMap[item.dropdown_index] = String(item.selected_option);
        }
      });
    }
    // Handle object with numeric keys
    else if (parsedCorrectAnswer && typeof parsedCorrectAnswer === "object") {
      Object.entries(parsedCorrectAnswer)
        .filter(([key]) => !isNaN(parseInt(key)))
        .forEach(([key, val]) => {
          correctAnswersMap[parseInt(key)] = String(val);
        });
    }

    // 2. Fallback to questionData.correct_selections
    if (
      Object.keys(correctAnswersMap).length === 0 &&
      questionData.correct_selections &&
      Array.isArray(questionData.correct_selections)
    ) {
      questionData.correct_selections.forEach((val: any, idx: number) => {
        correctAnswersMap[idx] = String(val);
      });
    }

    // 3. Fallback to questionData.acceptable_answers
    if (
      Object.keys(correctAnswersMap).length === 0 &&
      questionData.acceptable_answers &&
      Array.isArray(questionData.acceptable_answers)
    ) {
      questionData.acceptable_answers.forEach((acc: any, idx: number) => {
        if (Array.isArray(acc.answers)) {
          correctAnswersMap[idx] = String(acc.answers[0]);
        } else if (acc.answer) {
          correctAnswersMap[idx] = String(acc.answer);
        }
      });
    }

    // 4. Fallback to individual dropdown.correct_answer
    if (Object.keys(correctAnswersMap).length === 0) {
      dropdownOptions.forEach((dropdown: any, idx: number) => {
        if (dropdown.correct_answer !== undefined) {
          correctAnswersMap[idx] = String(dropdown.correct_answer);
        } else if (dropdown.correct_option_index !== undefined) {
          // Handle index-based correct answer
          const optIdx = dropdown.correct_option_index;
          if (dropdown.options && dropdown.options[optIdx] !== undefined) {
            const opt = dropdown.options[optIdx];
            correctAnswersMap[idx] =
              typeof opt === "object"
                ? String(opt.text || opt.value)
                : String(opt);
          }
        }
      });
    }

    // 5. Last resort: use first option of each dropdown as correct (for backwards compatibility)
    if (Object.keys(correctAnswersMap).length === 0) {
      console.warn(
        "[Grader] Dropdown: No correct answers found, using first option as fallback",
      );
      dropdownOptions.forEach((dropdown: any, idx: number) => {
        if (dropdown.options && dropdown.options.length > 0) {
          const opt = dropdown.options[0];
          correctAnswersMap[idx] =
            typeof opt === "object"
              ? String(opt.text || opt.value)
              : String(opt);
        }
      });
    }

    // Now compare student selections with correct answers
    dropdownOptions.forEach((dropdown: any, index: number) => {
      // Find student selection for this dropdown
      const studentSelection = selectionsArray.find((s: any) => {
        const selIdx = s.dropdown_index;
        // Match by dropdown_index or by array position
        return (
          selIdx === index ||
          selIdx === dropdown.dropdown_index ||
          (selIdx === undefined && selectionsArray.indexOf(s) === index)
        );
      });

      const correctOption =
        correctAnswersMap[index] || correctAnswersMap[dropdown.dropdown_index];

      if (studentSelection && correctOption !== undefined) {
        // Get student value - handle both string and object formats
        let studentVal: string;
        if (
          typeof studentSelection.selected_option === "object" &&
          studentSelection.selected_option !== null
        ) {
          studentVal = String(
            studentSelection.selected_option.text ||
              studentSelection.selected_option.value ||
              studentSelection.selected_option,
          );
        } else {
          studentVal = String(studentSelection.selected_option || "");
        }

        // Strip HTML/LaTeX and normalize for comparison
        const studentValClean = stripHtml(studentVal).toLowerCase();
        const correctValClean = stripHtml(correctOption).toLowerCase();

        const isMatch = studentValClean === correctValClean;

        console.log(`[Grader] Dropdown Match [${index}]:`, {
          student: studentValClean,
          correct: correctValClean,
          isMatch,
        });

        if (isMatch) {
          correctSelections++;
        }
      } else {
        console.log(
          `[Grader] Dropdown [${index}]: No student selection or correct option found`,
          {
            hasStudentSelection: !!studentSelection,
            correctOption,
          },
        );
      }
    });

    const totalDropdowns = dropdownOptions.length;
    const pointsEarned =
      totalDropdowns > 0
        ? Math.round(
            (correctSelections / totalDropdowns) *
              parseFloat(String(question.points || 0)),
          )
        : 0;

    return {
      is_correct: totalDropdowns > 0 && correctSelections === totalDropdowns,
      points_earned: pointsEarned,
      feedback: `${correctSelections}/${totalDropdowns} dropdowns correct`,
    };
  }

  static async gradeAlgorithmic(
    question: QuizQuestion,
    answerData: AnswerDataType,
  ): Promise<GradingResult> {
    // Algorithmic questions use the same logic as coding questions for test case execution
    // but the data structure and UI are slightly different.
    return CodingGrader.gradeCoding(question, answerData);
  }

  static gradeLogicalExpression(
    question: QuizQuestion,
    answerData: AnswerDataType,
  ): GradingResult {
    let questionData = question.questionBank?.question_data as any;
    if (typeof questionData === "string") {
      try {
        questionData = JSON.parse(questionData);
      } catch (e) {
        questionData = {};
      }
    }
    const answer = answerData as any;

    const normalize = (expr: string) =>
      expr
        .replace(/\s+/g, "")
        .toLowerCase()
        .replace(/\u00ac/g, "!") // ¬
        .replace(/\u2227/g, "&&") // ∧
        .replace(/\u2228/g, "||") // ∨
        .replace(/\u2192/g, "->") // →
        .replace(/\u2194/g, "<->"); // ↔

    const extractVariables = (expr: string): string[] => {
      const vars = new Set<string>();
      const normalized = expr.replace(/\s+/g, "");
      const matches = normalized.match(/[a-zA-Z][a-zA-Z0-9_]*/g) || [];
      for (const m of matches) {
        const t = m.toLowerCase();
        if (
          t === "and" ||
          t === "or" ||
          t === "not" ||
          t === "true" ||
          t === "false"
        ) {
          continue;
        }
        vars.add(m);
      }
      return Array.from(vars);
    };

    const toJsBooleanExpr = (expr: string): string => {
      let e = normalize(expr);
      // Word operators
      e = e.replace(/\band\b/g, "&&");
      e = e.replace(/\bor\b/g, "||");
      e = e.replace(/\bnot\b/g, "!");
      // Common single-char operators
      e = e.replace(/\*/g, "&&");
      e = e.replace(/\+/g, "||");
      // Implication / equivalence
      // a -> b === (!a || b)
      e = e.replace(/([a-zA-Z0-9_\)]+)->([a-zA-Z0-9_\(]+)/g, "(!$1||$2)");
      // a <-> b === (a===b)
      e = e.replace(/([a-zA-Z0-9_\)]+)<->([a-zA-Z0-9_\(]+)/g, "($1===$2)");
      return e;
    };

    const safeEvalBoolean = (
      expr: string,
      env: Record<string, boolean>,
    ): boolean => {
      const js = toJsBooleanExpr(expr);
      const fn = new Function(
        ...Object.keys(env),
        `"use strict"; return Boolean(${js});`,
      ) as (...args: boolean[]) => boolean;
      return fn(...Object.keys(env).map((k) => env[k]));
    };

    if (!answer || typeof answer.expression !== "string") {
      return {
        is_correct: false,
        points_earned: 0,
        feedback: "Invalid answer format - expression is required",
      };
    }

    const correctExpression =
      (typeof questionData?.correct_expression === "string"
        ? questionData.correct_expression
        : undefined) ||
      (typeof question.questionBank?.correct_answer === "string"
        ? question.questionBank?.correct_answer
        : "");

    // Prefer semantic equivalence when variables exist; otherwise fall back to normalized string compare
    let isCorrect = false;
    try {
      const vars = extractVariables(
        `${answer.expression} ${correctExpression}`,
      );
      if (vars.length === 0) {
        isCorrect =
          normalize(answer.expression) === normalize(correctExpression);
      } else {
        const limitedVars = vars.slice(0, 6); // cap to avoid exponential blowup
        const combos = 1 << limitedVars.length;
        isCorrect = true;
        for (let mask = 0; mask < combos; mask++) {
          const env: Record<string, boolean> = {};
          for (let i = 0; i < limitedVars.length; i++) {
            env[limitedVars[i]] = Boolean(mask & (1 << i));
          }
          const aVal = safeEvalBoolean(answer.expression, env);
          const cVal = safeEvalBoolean(correctExpression, env);
          if (aVal !== cVal) {
            isCorrect = false;
            break;
          }
        }
      }
    } catch (e) {
      isCorrect = normalize(answer.expression) === normalize(correctExpression);
    }

    return {
      is_correct: isCorrect,
      points_earned: isCorrect ? parseFloat(String(question.points)) : 0,
      feedback: isCorrect
        ? "Expression is correct!"
        : "Expression is incorrect",
    };
  }

  static gradeDragDrop(
    question: QuizQuestion,
    answerData: AnswerDataType,
  ): GradingResult {
    let questionData = question.questionBank?.question_data as any;
    if (typeof questionData === "string") {
      try {
        questionData = JSON.parse(questionData);
      } catch (e) {
        questionData = {};
      }
    }
    const answer = answerData as any;

    if (
      !answer ||
      !answer.placements ||
      typeof answer.placements !== "object"
    ) {
      return {
        is_correct: false,
        points_earned: 0,
        feedback: "Invalid answer format - placements are required",
      };
    }

    let correctPlacements = 0;
    const totalZones = questionData.drop_zones.length;

    questionData.drop_zones.forEach((zone: any) => {
      const studentItemId = answer.placements[zone.id];
      if (studentItemId && zone.correct_items.includes(studentItemId)) {
        correctPlacements++;
      }
    });

    const pointsEarned = Math.round(
      (correctPlacements / totalZones) * parseFloat(String(question.points)),
    );

    return {
      is_correct: correctPlacements === totalZones,
      points_earned: pointsEarned,
      feedback: `${correctPlacements}/${totalZones} items correctly placed`,
    };
  }
}

export class CodingGrader {
  static async gradeCoding(
    question: QuizQuestion,
    answerData: AnswerDataType,
  ): Promise<GradingResult> {
    let questionData = question.questionBank?.question_data as any;
    if (!questionData) {
      return {
        is_correct: false,
        points_earned: 0,
        feedback: "Question metadata (question_data) is missing.",
      };
    }

    if (typeof questionData === "string") {
      try {
        questionData = JSON.parse(questionData);
      } catch (e) {
        questionData = {};
      }
    }
    const answer = answerData as any;

    if (!answer || typeof answer.code !== "string") {
      return {
        is_correct: false,
        points_earned: 0,
        feedback: "Invalid answer format - code is required",
      };
    }

    // Detect if this is a "project mode" answer (JSON string of files)
    let finalCode = answer.code;
    if (finalCode.trim().startsWith("[") && finalCode.trim().endsWith("]")) {
      try {
        const files = JSON.parse(finalCode);
        if (Array.isArray(files)) {
          // Find entry point or just pick the first file for grading
          const entryFile =
            files.find((f: any) => f.is_entry_point) || files[0];
          if (entryFile) {
            finalCode = entryFile.content || "";
          }
        }
      } catch (e) {
        // Not actually a JSON array, keep as is
      }
    }

    const testCases = questionData.test_cases || [];
    if (!Array.isArray(testCases) || testCases.length === 0) {
      return {
        is_correct: false,
        points_earned: 0,
        feedback: "No test cases defined for this coding question.",
      };
    }

    const testResults: any[] = [];
    const language = questionData.language || "javascript";
    let languageId: number | null = null;
    try {
      languageId = Judge0Service.getLanguageId(language);
    } catch (e) {
      languageId = null;
    }

    if (!languageId) {
      return {
        is_correct: false,
        points_earned: 0,
        feedback:
          "Coding auto-grading is not available (unsupported language configuration).",
      };
    }

    try {
      // Execute each test case via Judge0
      for (const tc of testCases) {
        const submission = {
          source_code: finalCode,
          language_id: languageId,
          stdin: tc.input,
          expected_output: tc.expected_output,
          cpu_limit: tc.time_limit || questionData.time_limit || 5,
          memory_limit:
            (tc.memory_limit || questionData.memory_limit || 256) * 1024,
        };

        const token = await Judge0Service.submit(submission);
        const result = await Judge0Service.waitAndGetResult(token);

        testResults.push({
          testCaseId: tc.id,
          passed: result.status.id === 3, // 3 is "Accepted"
          input: tc.input,
          expected: tc.expected_output,
          actual: result.stdout,
          error: result.stderr || result.compile_output || result.message,
          executionTime: result.time,
          memoryUsed: result.memory,
          status: result.status.description,
        });
      }

      const passedTests = testResults.filter((r) => r.passed).length;
      const totalTests = testResults.length;
      const allPassed = totalTests > 0 && passedTests === totalTests;

      // Perform AI Analysis for Code Quality and Efficiency (40% of score)
      // Uses provider chain: Gemini → OpenAI → Mock
      // Ensure correctness is deterministic: only fully correct if all tests pass.
      // AI can help with partial credit/feedback but should not override correctness.
      let aiResult:
        | {
            is_correct: boolean;
            points_earned: number;
            feedback: string;
            quality_score?: number;
            efficiency_score?: number;
            correctness_score?: number;
          }
        | undefined;
      try {
        aiResult = await aiService.gradeCoding(
          question.questionBank?.question_text || "",
          finalCode,
          language,
          testResults,
          parseFloat(String(question.points || 0)),
          questionData.constraints,
        );
      } catch (e) {
        aiResult = undefined;
      }

      const maxPoints = parseFloat(String(question.points || 0));
      const testPoints =
        totalTests > 0 ? (passedTests / totalTests) * maxPoints : 0;

      const aiPoints =
        typeof aiResult?.points_earned === "number"
          ? aiResult.points_earned
          : 0;

      const combinedPoints = Math.max(testPoints, aiPoints);
      const pointsEarned = Math.max(0, Math.min(combinedPoints, maxPoints));

      return {
        is_correct: allPassed,
        points_earned: pointsEarned,
        feedback:
          aiResult?.feedback ||
          (allPassed
            ? "All test cases passed."
            : `${passedTests}/${totalTests} test cases passed.`),
        detailed_feedback: {
          testResults,
          quality_score: aiResult?.quality_score,
          efficiency_score: aiResult?.efficiency_score,
          correctness_score: aiResult?.correctness_score,
          passedTests,
          totalTests,
        },
      };
    } catch (error: any) {
      console.error("Coding grading failed:", error);
      return {
        is_correct: false,
        points_earned: 0,
        feedback:
          "Coding auto-grading failed. Please try again later or contact your instructor.",
      };
    }
  }
}

// Advanced Configurable Grading System
export class AdvancedQuizGrader {
  private static defaultConfigs: Record<string, QuestionGradingConfig> = {
    single_choice: {
      type: "single_choice",
      config: {
        strategy: "all_or_nothing",
        enable_partial_credit: false,
        minimum_score_percentage: 0,
        maximum_penalty_percentage: 0,
        explanation_required: false,
        explanation_bonus: 0,
      },
    },
    multiple_choice: {
      type: "multiple_choice",
      config: {
        strategy: "partial_credit",
        enable_partial_credit: true,
        minimum_score_percentage: 0,
        maximum_penalty_percentage: 50,
        penalty_per_wrong_selection: 0.5,
        allow_negative_score: false,
      },
    },
    true_false: {
      type: "true_false",
      config: {
        strategy: "all_or_nothing",
        enable_partial_credit: false,
        minimum_score_percentage: 0,
        maximum_penalty_percentage: 0,
        explanation_required: false,
        explanation_bonus: 0,
      },
    },
    short_answer: {
      type: "short_answer",
      config: {
        strategy: "partial_credit",
        enable_partial_credit: true,
        minimum_score_percentage: 0,
        maximum_penalty_percentage: 0,
        keyword_matching_mode: "partial",
        minimum_keywords_required: 1,
        case_sensitive: false,
        allow_synonyms: false,
      },
    },
    numerical: {
      type: "numerical",
      config: {
        strategy: "all_or_nothing",
        enable_partial_credit: false,
        minimum_score_percentage: 0,
        maximum_penalty_percentage: 0,
        tolerance_mode: "absolute",
        absolute_tolerance: 0.01,
        units_required: false,
        units_penalty: 0,
      },
    },
    fill_blank: {
      type: "fill_blank",
      config: {
        strategy: "partial_credit",
        enable_partial_credit: true,
        minimum_score_percentage: 0,
        maximum_penalty_percentage: 0,
        blank_independence: true,
        partial_blank_credit: true,
      },
    },
    matching: {
      type: "matching",
      config: {
        strategy: "partial_credit",
        enable_partial_credit: true,
        minimum_score_percentage: 0,
        maximum_penalty_percentage: 0,
        allow_partial_matches: true,
        bonus_for_perfect_order: 0,
      },
    },
    ordering: {
      type: "ordering",
      config: {
        strategy: "partial_credit",
        enable_partial_credit: true,
        minimum_score_percentage: 0,
        maximum_penalty_percentage: 0,
        position_weight_mode: "equal",
        adjacency_bonus: 0,
      },
    },
    dropdown: {
      type: "dropdown",
      config: {
        strategy: "all_or_nothing",
        enable_partial_credit: false,
        minimum_score_percentage: 0,
        maximum_penalty_percentage: 0,
      },
    },
    coding: {
      type: "coding",
      config: {
        strategy: "weighted_partial",
        enable_partial_credit: true,
        minimum_score_percentage: 0,
        maximum_penalty_percentage: 100,
        compilation_penalty: 20,
        test_case_weights: "equal",
        runtime_penalty: 10,
        memory_penalty: 5,
      },
    },
    algorithmic: {
      type: "algorithmic",
      config: {
        strategy: "weighted_partial",
        enable_partial_credit: true,
        minimum_score_percentage: 0,
        maximum_penalty_percentage: 100,
        test_case_weights: "equal",
      },
    },
    logical_expression: {
      type: "logical_expression",
      config: {
        strategy: "all_or_nothing",
        enable_partial_credit: false,
        minimum_score_percentage: 0,
        maximum_penalty_percentage: 0,
      },
    },
    drag_drop: {
      type: "drag_drop",
      config: {
        strategy: "partial_credit",
        enable_partial_credit: true,
        minimum_score_percentage: 0,
        maximum_penalty_percentage: 0,
      },
    },
  };

  static getDefaultConfig(questionType: string): QuestionGradingConfig {
    return (
      this.defaultConfigs[questionType] || this.defaultConfigs["single_choice"]
    );
  }

  static normalizeAnswer(
    answerData: AnswerDataType,
    questionType: string,
  ): NormalizedAnswer {
    return {
      type: questionType,
      data: answerData,
    };
  }

  static normalizeCorrectAnswer(
    question: QuizQuestion,
  ): NormalizedCorrectAnswer {
    let questionData = question.questionBank?.question_data as any;
    if (typeof questionData === "string") {
      try {
        questionData = JSON.parse(questionData);
      } catch (e) {
        questionData = {};
      }
    }

    let correctAnswer = question.questionBank?.correct_answer as any;
    if (typeof correctAnswer === "string") {
      try {
        correctAnswer = JSON.parse(correctAnswer);
      } catch (e) {
        // Keep as string
      }
    }

    let normalizedData: any;

    switch (question.questionBank?.question_type) {
      case "single_choice":
        let correctOptionIndex: number | null = null;

        // Check question_data.correct_option_index first (primary source)
        if (
          questionData &&
          typeof questionData.correct_option_index === "number"
        ) {
          correctOptionIndex = questionData.correct_option_index;
        }
        // Check if question_data.correct_answer is a number
        else if (
          questionData &&
          typeof questionData.correct_answer === "number"
        ) {
          correctOptionIndex = questionData.correct_answer;
        }
        // Check if question_data.correct_answer is a string that can be parsed to number
        else if (
          questionData &&
          typeof questionData.correct_answer === "string"
        ) {
          const parsed = parseInt(questionData.correct_answer, 10);
          if (!isNaN(parsed)) {
            correctOptionIndex = parsed;
          }
        }
        // Check if question_data has selected_option_index (alternative format)
        else if (
          questionData &&
          typeof questionData.selected_option_index === "number"
        ) {
          correctOptionIndex = questionData.selected_option_index;
        }
        // Check if question_data.correct_answer is an object with selected_option_index
        else if (
          questionData &&
          questionData.correct_answer &&
          typeof questionData.correct_answer === "object" &&
          typeof questionData.correct_answer.selected_option_index === "number"
        ) {
          correctOptionIndex =
            questionData.correct_answer.selected_option_index;
        }

        // Fallback to question.questionBank?.correct_answer column
        if (
          correctOptionIndex === null &&
          correctAnswer !== undefined &&
          correctAnswer !== null
        ) {
          if (typeof correctAnswer === "number") {
            correctOptionIndex = correctAnswer;
          } else if (typeof correctAnswer === "string") {
            // Try to parse as number first
            const parsed = parseInt(correctAnswer, 10);
            if (!isNaN(parsed)) {
              correctOptionIndex = parsed;
            } else {
              // Try to parse as JSON object
              try {
                const parsedObj = JSON.parse(correctAnswer);
                if (
                  parsedObj &&
                  typeof parsedObj === "object" &&
                  typeof parsedObj.selected_option_index === "number"
                ) {
                  correctOptionIndex = parsedObj.selected_option_index;
                }
              } catch (e) {
                // Not a valid JSON string
              }
            }
          } else if (correctAnswer && typeof correctAnswer === "object") {
            if (typeof correctAnswer.selected_option_index === "number") {
              correctOptionIndex = correctAnswer.selected_option_index;
            } else if (typeof correctAnswer.correct_option_index === "number") {
              correctOptionIndex = correctAnswer.correct_option_index;
            }
          }
        }

        normalizedData =
          correctOptionIndex !== null
            ? { selected_option_index: correctOptionIndex }
            : null;
        break;

      case "multiple_choice":
        let correctOptionIndices: number[] | null = null;
        if (
          questionData &&
          Array.isArray(questionData.correct_option_indices)
        ) {
          correctOptionIndices = questionData.correct_option_indices
            .map((idx: any) =>
              typeof idx === "string" ? parseInt(idx, 10) : idx,
            )
            .filter((idx: any) => !isNaN(idx));
        } else if (questionData && Array.isArray(questionData.correct_answer)) {
          correctOptionIndices = questionData.correct_answer
            .map((idx: any) =>
              typeof idx === "string" ? parseInt(idx, 10) : idx,
            )
            .filter((idx: any) => !isNaN(idx));
        } else if (correctAnswer !== undefined && correctAnswer !== null) {
          // Handle different formats of correct_answer
          if (Array.isArray(correctAnswer)) {
            correctOptionIndices = correctAnswer
              .map((idx: any) =>
                typeof idx === "string" ? parseInt(idx, 10) : idx,
              )
              .filter((idx: any) => !isNaN(idx));
          } else if (
            correctAnswer &&
            typeof correctAnswer === "object" &&
            Array.isArray(correctAnswer.correct_option_indices)
          ) {
            correctOptionIndices = correctAnswer.correct_option_indices
              .map((idx: any) =>
                typeof idx === "string" ? parseInt(idx, 10) : idx,
              )
              .filter((idx: any) => !isNaN(idx));
          }
        }
        normalizedData = correctOptionIndices
          ? { selected_option_indices: correctOptionIndices }
          : null;
        break;

      case "true_false":
        let correctBool: boolean | null = null;
        if (questionData && questionData.correct_answer !== undefined) {
          const val = questionData.correct_answer;
          if (typeof val === "boolean") {
            correctBool = val;
          } else if (typeof val === "string") {
            const lowVal = val.toLowerCase().trim();
            correctBool = lowVal === "true";
          } else if (typeof val === "number") {
            correctBool = val === 1;
          }
        } else if (correctAnswer !== undefined && correctAnswer !== null) {
          // Handle different formats of correct_answer
          if (typeof correctAnswer === "boolean") {
            correctBool = correctAnswer;
          } else if (typeof correctAnswer === "number") {
            correctBool = correctAnswer === 1;
          } else if (typeof correctAnswer === "string") {
            correctBool = correctAnswer.toLowerCase() === "true";
          } else if (
            correctAnswer &&
            typeof correctAnswer === "object" &&
            correctAnswer.answer !== undefined
          ) {
            const val = correctAnswer.answer;
            if (typeof val === "boolean") {
              correctBool = val;
            } else if (typeof val === "string") {
              const lowVal = val.toLowerCase().trim();
              correctBool = lowVal === "true";
            } else if (typeof val === "number") {
              correctBool = val === 1;
            }
          }
        }

        normalizedData =
          correctBool !== null ? { selected_answer: correctBool } : null;
        break;

      case "numerical":
        let numCorrectAnswer: number | null = null;
        let numTolerance: number = 0;
        let numUnits: string = "";

        // Check correct_answer column first
        if (correctAnswer !== undefined && correctAnswer !== null) {
          if (typeof correctAnswer === "number") {
            numCorrectAnswer = correctAnswer;
          } else if (typeof correctAnswer === "object") {
            numCorrectAnswer =
              correctAnswer.answer !== undefined ? correctAnswer.answer : null;
            numTolerance = correctAnswer.tolerance || 0;
            numUnits = correctAnswer.units || "";
          }
        }

        // Fallback to question_data
        if (numCorrectAnswer === null && questionData) {
          if (typeof questionData.correct_answer === "number") {
            numCorrectAnswer = questionData.correct_answer;
          } else if (typeof questionData.correct_answer === "string") {
            const parsed = parseFloat(questionData.correct_answer);
            if (!isNaN(parsed)) {
              numCorrectAnswer = parsed;
            }
          }
          numTolerance = questionData.tolerance || numTolerance;
          numUnits = questionData.units || numUnits;
        }

        normalizedData =
          numCorrectAnswer !== null
            ? {
                answer: numCorrectAnswer,
                tolerance: numTolerance,
                units: numUnits,
              }
            : null;
        break;

      case "fill_blank":
        normalizedData =
          questionData && questionData.acceptable_answers
            ? {
                answers: questionData.acceptable_answers.map(
                  (blank: any, index: number) => ({
                    blank_index: index,
                    answer: blank.answers
                      ? blank.answers[0]
                      : blank.correct_answer,
                  }),
                ),
              }
            : null;
        break;

      case "matching":
        let correctMappings: Record<string, string> | null = null;
        if (questionData && questionData.correct_matches) {
          correctMappings = questionData.correct_matches;
        } else if (correctAnswer && correctAnswer.mappings) {
          correctMappings = correctAnswer.mappings;
        }
        normalizedData = correctMappings ? { matches: correctMappings } : null;
        break;

      case "ordering":
        let correctOrder: string[] | null = null;
        if (correctAnswer && Array.isArray(correctAnswer.ordered_item_ids)) {
          correctOrder = correctAnswer.ordered_item_ids;
        } else if (
          questionData &&
          questionData.items &&
          Array.isArray(questionData.items)
        ) {
          correctOrder = questionData.items
            .sort((a: any, b: any) => a.order - b.order)
            .map((item: any) => item.id);
        }
        normalizedData = correctOrder
          ? { ordered_item_ids: correctOrder }
          : null;
        break;

      case "coding":
        // For coding questions, correct answer is typically test cases, not code
        normalizedData =
          questionData && questionData.expected_code
            ? { code: questionData.expected_code }
            : null;
        break;

      case "dropdown":
        normalizedData =
          correctAnswer && Array.isArray(correctAnswer)
            ? {
                selections: correctAnswer.map(
                  (option: string, index: number) => ({
                    dropdown_index: index,
                    selected_option: option,
                  }),
                ),
              }
            : null;
        break;

      case "logical_expression":
        normalizedData =
          questionData && questionData.correct_expression
            ? { expression: questionData.correct_expression }
            : null;
        break;

      case "drag_drop":
        normalizedData =
          questionData && questionData.drop_zones
            ? {
                placements: questionData.drop_zones.reduce(
                  (acc: any, zone: any) => {
                    if (zone.correct_items && zone.correct_items.length > 0) {
                      acc[zone.id] = zone.correct_items[0];
                    }
                    return acc;
                  },
                  {},
                ),
              }
            : null;
        break;

      case "algorithmic":
        normalizedData =
          questionData && questionData.expected_code
            ? { solution: questionData.expected_code }
            : null;
        break;

      default:
        normalizedData = correctAnswer || questionData.correct_answer;
    }

    return {
      type: question.questionBank?.question_type,
      data: normalizedData,
      explanation: question.questionBank?.explanation || undefined,
    };
  }

  static async gradeWithConfig(
    question: QuizQuestion,
    answerData: AnswerDataType,
    config?: QuestionGradingConfig,
  ): Promise<AdvancedGradingResult> {
    const gradingConfig =
      config || this.getDefaultConfig(question.questionBank?.question_type);
    const maxPoints = parseFloat(String(question.points || 0));

    // ─── AI Usage Policy ────────────────────────────────────────────────────
    // AI grading (via aiService) is ONLY used for open-ended question types
    // where semantic understanding is required. All deterministic types
    // (choice, matching, ordering, drag_drop, dropdown, logical_expression,
    // fill_blank) are graded algorithmically WITHOUT consuming AI tokens.
    // AI types: short_answer, numerical (for non-numeric answers), coding, algorithmic
    // ────────────────────────────────────────────────────────────────────────

    switch (gradingConfig.type) {
      case "single_choice":
      case "true_false":
        return this.gradeChoiceQuestion(
          question,
          answerData,
          gradingConfig.config as TrueFalseGradingConfig,
          maxPoints,
        );

      case "multiple_choice":
        return this.gradeMultipleChoice(
          question,
          answerData,
          gradingConfig.config as MultipleChoiceGradingConfig,
          maxPoints,
        );

      case "short_answer":
        return await this.gradeShortAnswer(
          question,
          answerData,
          gradingConfig.config as ShortAnswerGradingConfig,
          maxPoints,
        );

      case "numerical":
        return await this.gradeNumerical(
          question,
          answerData,
          gradingConfig.config as NumericalGradingConfig,
          maxPoints,
        );

      case "fill_blank":
        return this.gradeFillBlank(
          question,
          answerData,
          gradingConfig.config as FillBlankGradingConfig,
          maxPoints,
        );

      case "matching":
        return this.gradeMatching(
          question,
          answerData,
          gradingConfig.config as MatchingGradingConfig,
          maxPoints,
        );

      case "ordering":
        return this.gradeOrdering(
          question,
          answerData,
          gradingConfig.config as OrderingGradingConfig,
          maxPoints,
        );

      case "dropdown":
        return this.gradeDropdown(
          question,
          answerData,
          gradingConfig.config as BaseGradingConfig,
          maxPoints,
        );

      case "coding":
        return await this.gradeCoding(
          question,
          answerData,
          gradingConfig.config as CodingGradingConfig,
          maxPoints,
        );

      default:
        // Fallback to basic grading
        const basicResult = await QuizGrader.gradeQuestion(
          question,
          answerData,
        );
        return {
          is_correct: basicResult.is_correct,
          points_earned: basicResult.points_earned,
          max_points: maxPoints,
          percentage:
            maxPoints > 0 ? (basicResult.points_earned / maxPoints) * 100 : 0,
          feedback: basicResult.feedback || "Graded",
        };
    }
  }

  private static gradeChoiceQuestion(
    question: QuizQuestion,
    answerData: AnswerDataType,
    config: TrueFalseGradingConfig,
    maxPoints: number,
  ): AdvancedGradingResult {
    const isTrueFalse = question.questionBank?.question_type === "true_false";

    // Correctly route to the right basic grader
    const basicResult = isTrueFalse
      ? ChoiceQuestionGrader.gradeTrueFalse(question, answerData)
      : ChoiceQuestionGrader.gradeSingleChoice(question, answerData);

    console.log(
      `[Grading] ${isTrueFalse ? "True/False" : "Single Choice"} Result:`,
      {
        question_id: question.id,
        is_correct: basicResult.is_correct,
        points_earned: basicResult.points_earned,
        feedback: basicResult.feedback,
      },
    );

    let pointsEarned = basicResult.points_earned;
    const breakdown: Record<string, number> = { base_score: pointsEarned };
    const bonuses: Record<string, number> = {};

    // Apply minimum score
    const minPoints = (config.minimum_score_percentage / 100) * maxPoints;
    pointsEarned = Math.max(pointsEarned, minPoints);

    // Apply explanation bonus if required and provided
    if (config.explanation_required && config.explanation_bonus > 0) {
      // For now, assume explanation is provided if answer is correct
      // In a real implementation, you'd check for explanation in answerData
      if (basicResult.is_correct) {
        const bonus = (config.explanation_bonus / 100) * maxPoints;
        pointsEarned += bonus;
        bonuses.explanation = bonus;
      }
    }

    return {
      is_correct: basicResult.is_correct,
      points_earned: Math.min(pointsEarned, maxPoints), // Cap at max points
      max_points: maxPoints,
      percentage: maxPoints > 0 ? (pointsEarned / maxPoints) * 100 : 0,
      feedback: basicResult.feedback || "Graded",
      detailed_feedback: {
        strategy_used: config.strategy,
        breakdown,
        bonuses_earned: bonuses,
      },
    };
  }

  private static gradeMultipleChoice(
    question: QuizQuestion,
    answerData: AnswerDataType,
    config: MultipleChoiceGradingConfig,
    maxPoints: number,
  ): AdvancedGradingResult {
    const basicResult = ChoiceQuestionGrader.gradeMultipleChoice(
      question,
      answerData,
    );

    let pointsEarned = basicResult.points_earned;
    const breakdown: Record<string, number> = { base_score: pointsEarned };
    const penalties: Record<string, number> = {};

    // Apply penalty for wrong selections if configured
    if (config.penalty_per_wrong_selection > 0 && !basicResult.is_correct) {
      let questionData = question.questionBank?.question_data as any;
      if (typeof questionData === "string") {
        try {
          questionData = JSON.parse(questionData);
        } catch (e) {
          questionData = {};
        }
      }

      const answer = answerData as any;
      // Normalize both arrays to numbers to prevent string/number type mismatch
      const correctIndices: number[] = (
        questionData.correct_option_indices || []
      ).map(Number);
      const studentIndices: number[] = (
        answer.selected_option_indices || []
      ).map(Number);

      const wrongSelections = studentIndices.filter(
        (idx: number) => !correctIndices.includes(idx),
      ).length;
      const penalty = wrongSelections * config.penalty_per_wrong_selection;
      pointsEarned = Math.max(0, pointsEarned - penalty); // Apply penalty

      if (penalty > 0) {
        penalties.wrong_selections = penalty;
      }
    }

    // Apply minimum score
    const minPoints = (config.minimum_score_percentage / 100) * maxPoints;
    pointsEarned = Math.max(pointsEarned, minPoints);

    // Prevent negative scores unless allowed
    if (!config.allow_negative_score) {
      pointsEarned = Math.max(0, pointsEarned);
    }

    return {
      is_correct: basicResult.is_correct,
      points_earned: pointsEarned,
      max_points: maxPoints,
      percentage: maxPoints > 0 ? (pointsEarned / maxPoints) * 100 : 0,
      feedback: basicResult.feedback || "Graded",
      detailed_feedback: {
        strategy_used: config.strategy,
        breakdown,
        penalties_applied: penalties,
      },
    };
  }

  private static async gradeShortAnswer(
    question: QuizQuestion,
    answerData: AnswerDataType,
    config: ShortAnswerGradingConfig,
    maxPoints: number,
  ): Promise<AdvancedGradingResult> {
    const basicResult = await TextInputGrader.gradeShortAnswer(
      question,
      answerData,
    );

    let pointsEarned = basicResult.points_earned;
    const breakdown: Record<string, number> = { keyword_score: pointsEarned };

    // Apply minimum score
    const minPoints = (config.minimum_score_percentage / 100) * maxPoints;
    pointsEarned = Math.max(pointsEarned, minPoints);

    return {
      is_correct: basicResult.is_correct,
      points_earned: Math.min(pointsEarned, maxPoints),
      max_points: maxPoints,
      percentage: maxPoints > 0 ? (pointsEarned / maxPoints) * 100 : 0,
      feedback: basicResult.feedback || "Graded",
      detailed_feedback: {
        strategy_used: config.strategy,
        breakdown,
      },
    };
  }

  private static async gradeNumerical(
    question: QuizQuestion,
    answerData: AnswerDataType,
    config: NumericalGradingConfig,
    maxPoints: number,
  ): Promise<AdvancedGradingResult> {
    const basicResult = await TextInputGrader.gradeNumerical(
      question,
      answerData,
    );

    let pointsEarned = basicResult.points_earned;
    const breakdown: Record<string, number> = { base_score: pointsEarned };
    const penalties: Record<string, number> = {};

    // Apply units penalty if configured
    if (config.units_required && config.units_penalty > 0) {
      // For now, assume units are checked in basic grading
    }

    // Apply minimum score
    const minPoints = (config.minimum_score_percentage / 100) * maxPoints;
    pointsEarned = Math.max(pointsEarned, minPoints);

    return {
      is_correct: basicResult.is_correct,
      points_earned: Math.min(pointsEarned, maxPoints),
      max_points: maxPoints,
      percentage: maxPoints > 0 ? (pointsEarned / maxPoints) * 100 : 0,
      feedback: basicResult.feedback || "Graded",
      detailed_feedback: {
        strategy_used: config.strategy,
        breakdown,
        penalties_applied: penalties,
      },
    };
  }

  private static gradeFillBlank(
    question: QuizQuestion,
    answerData: AnswerDataType,
    config: FillBlankGradingConfig,
    maxPoints: number,
  ): AdvancedGradingResult {
    const basicResult = TextInputGrader.gradeFillBlank(question, answerData);

    let pointsEarned = basicResult.points_earned;
    const breakdown: Record<string, number> = { base_score: pointsEarned };

    // Apply minimum score
    const minPoints = (config.minimum_score_percentage / 100) * maxPoints;
    pointsEarned = Math.max(pointsEarned, minPoints);

    return {
      is_correct: basicResult.is_correct,
      points_earned: Math.min(pointsEarned, maxPoints),
      max_points: maxPoints,
      percentage: maxPoints > 0 ? (pointsEarned / maxPoints) * 100 : 0,
      feedback: basicResult.feedback || "Graded",
      detailed_feedback: {
        strategy_used: config.strategy,
        breakdown,
      },
    };
  }

  private static gradeMatching(
    question: QuizQuestion,
    answerData: AnswerDataType,
    config: MatchingGradingConfig,
    maxPoints: number,
  ): AdvancedGradingResult {
    const basicResult = InteractiveGrader.gradeMatching(question, answerData);

    let pointsEarned = basicResult.points_earned;
    const breakdown: Record<string, number> = { base_score: pointsEarned };
    const bonuses: Record<string, number> = {};

    // Apply perfect order bonus if configured
    if (config.bonus_for_perfect_order > 0 && basicResult.is_correct) {
      const bonus = (config.bonus_for_perfect_order / 100) * maxPoints;
      pointsEarned += bonus;
      bonuses.perfect_order = bonus;
    }

    // Apply minimum score
    const minPoints = (config.minimum_score_percentage / 100) * maxPoints;
    pointsEarned = Math.max(pointsEarned, minPoints);

    return {
      is_correct: basicResult.is_correct,
      points_earned: Math.min(pointsEarned, maxPoints),
      max_points: maxPoints,
      percentage: maxPoints > 0 ? (pointsEarned / maxPoints) * 100 : 0,
      feedback: basicResult.feedback || "Graded",
      detailed_feedback: {
        strategy_used: config.strategy,
        breakdown,
        bonuses_earned: bonuses,
      },
    };
  }

  private static gradeOrdering(
    question: QuizQuestion,
    answerData: AnswerDataType,
    config: OrderingGradingConfig,
    maxPoints: number,
  ): AdvancedGradingResult {
    const basicResult = InteractiveGrader.gradeOrdering(question, answerData);

    let pointsEarned = basicResult.points_earned;
    const breakdown: Record<string, number> = { base_score: pointsEarned };
    const bonuses: Record<string, number> = {};

    // Apply adjacency bonus if configured
    if (config.adjacency_bonus > 0) {
      // For now, use basic calculation
      // In a real implementation, you'd calculate adjacency bonus
    }

    // Apply minimum score
    const minPoints = (config.minimum_score_percentage / 100) * maxPoints;
    pointsEarned = Math.max(pointsEarned, minPoints);

    return {
      is_correct: basicResult.is_correct,
      points_earned: Math.min(pointsEarned, maxPoints),
      max_points: maxPoints,
      percentage: maxPoints > 0 ? (pointsEarned / maxPoints) * 100 : 0,
      feedback: basicResult.feedback || "Graded",
      detailed_feedback: {
        strategy_used: config.strategy,
        breakdown,
        bonuses_earned: bonuses,
      },
    };
  }

  private static gradeDropdown(
    question: QuizQuestion,
    answerData: AnswerDataType,
    config: BaseGradingConfig,
    maxPoints: number,
  ): AdvancedGradingResult {
    const basicResult = InteractiveGrader.gradeDropdown(question, answerData);

    let pointsEarned = basicResult.points_earned;

    // Apply minimum score
    const minPoints = (config.minimum_score_percentage / 100) * maxPoints;
    pointsEarned = Math.max(pointsEarned, minPoints);

    return {
      is_correct: basicResult.is_correct,
      points_earned: Math.min(pointsEarned, maxPoints),
      max_points: maxPoints,
      percentage: maxPoints > 0 ? (pointsEarned / maxPoints) * 100 : 0,
      feedback: basicResult.feedback || "Graded",
      detailed_feedback: {
        strategy_used: config.strategy,
      },
    };
  }

  private static async gradeCoding(
    question: QuizQuestion,
    answerData: AnswerDataType,
    config: CodingGradingConfig,
    maxPoints: number,
  ): Promise<AdvancedGradingResult> {
    const basicResult = await CodingGrader.gradeCoding(question, answerData);

    let pointsEarned = basicResult.points_earned;
    const breakdown: Record<string, number> = { test_cases: pointsEarned };
    const penalties: Record<string, number> = {};

    // Apply compilation penalty if there were compilation errors
    if (config.compilation_penalty > 0 && basicResult.detailed_feedback) {
      // Check if there were compilation errors in the feedback
      const feedback = basicResult.feedback || "";
      const hasCompilationErrors =
        feedback.toLowerCase().includes("compilation") ||
        feedback.toLowerCase().includes("syntax error");
      if (hasCompilationErrors) {
        const penalty = (config.compilation_penalty / 100) * maxPoints;
        pointsEarned = Math.max(0, pointsEarned - penalty);
        penalties.compilation = penalty;
      }
    }

    // Apply runtime/memory penalties if configured
    if (config.runtime_penalty > 0 && basicResult.detailed_feedback) {
      // Check for runtime errors
      const feedback = basicResult.feedback || "";
      const hasRuntimeErrors =
        feedback.toLowerCase().includes("timeout") ||
        feedback.toLowerCase().includes("runtime");
      if (hasRuntimeErrors) {
        const penalty = (config.runtime_penalty / 100) * maxPoints;
        pointsEarned = Math.max(0, pointsEarned - penalty);
        penalties.runtime = penalty;
      }
    }

    if (config.memory_penalty > 0 && basicResult.detailed_feedback) {
      // Check for memory errors
      const feedback = basicResult.feedback || "";
      const hasMemoryErrors =
        feedback.toLowerCase().includes("memory") ||
        feedback.toLowerCase().includes("out of memory");
      if (hasMemoryErrors) {
        const penalty = (config.memory_penalty / 100) * maxPoints;
        pointsEarned = Math.max(0, pointsEarned - penalty);
        penalties.memory = penalty;
      }
    }

    // Apply minimum score
    const minPoints = (config.minimum_score_percentage / 100) * maxPoints;
    pointsEarned = Math.max(pointsEarned, minPoints);

    return {
      is_correct: basicResult.is_correct,
      points_earned: Math.min(pointsEarned, maxPoints),
      max_points: maxPoints,
      percentage: maxPoints > 0 ? (pointsEarned / maxPoints) * 100 : 0,
      feedback: basicResult.feedback || "Graded",
      detailed_feedback: {
        strategy_used: config.strategy,
        breakdown,
        penalties_applied: penalties,
      },
    };
  }

  private static async gradeAlgorithmic(
    question: QuizQuestion,
    answerData: AnswerDataType,
    config: BaseGradingConfig,
    maxPoints: number,
  ): Promise<AdvancedGradingResult> {
    const basicResult = await InteractiveGrader.gradeAlgorithmic(
      question,
      answerData,
    );
    let pointsEarned = basicResult.points_earned;
    const minPoints = (config.minimum_score_percentage / 100) * maxPoints;
    pointsEarned = Math.max(pointsEarned, minPoints);

    return {
      is_correct: basicResult.is_correct,
      points_earned: Math.min(pointsEarned, maxPoints),
      max_points: maxPoints,
      percentage: maxPoints > 0 ? (pointsEarned / maxPoints) * 100 : 0,
      feedback: basicResult.feedback || "Graded",
      detailed_feedback: {
        strategy_used: config.strategy,
      },
    };
  }

  private static gradeLogicalExpression(
    question: QuizQuestion,
    answerData: AnswerDataType,
    config: BaseGradingConfig,
    maxPoints: number,
  ): AdvancedGradingResult {
    const basicResult = InteractiveGrader.gradeLogicalExpression(
      question,
      answerData,
    );
    let pointsEarned = basicResult.points_earned;
    const minPoints = (config.minimum_score_percentage / 100) * maxPoints;
    pointsEarned = Math.max(pointsEarned, minPoints);

    return {
      is_correct: basicResult.is_correct,
      points_earned: Math.min(pointsEarned, maxPoints),
      max_points: maxPoints,
      percentage: maxPoints > 0 ? (pointsEarned / maxPoints) * 100 : 0,
      feedback: basicResult.feedback || "Graded",
      detailed_feedback: {
        strategy_used: config.strategy,
      },
    };
  }

  private static gradeDragDrop(
    question: QuizQuestion,
    answerData: AnswerDataType,
    config: BaseGradingConfig,
    maxPoints: number,
  ): AdvancedGradingResult {
    const basicResult = InteractiveGrader.gradeDragDrop(question, answerData);
    let pointsEarned = basicResult.points_earned;
    const minPoints = (config.minimum_score_percentage / 100) * maxPoints;
    pointsEarned = Math.max(pointsEarned, minPoints);

    return {
      is_correct: basicResult.is_correct,
      points_earned: Math.min(pointsEarned, maxPoints),
      max_points: maxPoints,
      percentage: maxPoints > 0 ? (pointsEarned / maxPoints) * 100 : 0,
      feedback: basicResult.feedback || "Graded",
      detailed_feedback: {
        strategy_used: config.strategy,
      },
    };
  }
}

export class QuizGrader {
  // Deep equality comparison for objects
  private static deepEqual(a: any, b: any): boolean {
    if (a === b) return true;

    if (a == null || b == null) return a === b;

    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (!this.deepEqual(a[i], b[i])) return false;
      }
      return true;
    }

    if (typeof a === "object" && typeof b === "object") {
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);

      if (keysA.length !== keysB.length) return false;

      for (const key of keysA) {
        if (!keysB.includes(key)) return false;
        if (!this.deepEqual(a[key], b[key])) return false;
      }
      return true;
    }

    return false;
  }
  static async gradeQuestion(
    question: QuizQuestion,
    answerData: AnswerDataType,
  ): Promise<GradingResult> {
    try {
      switch (question.questionBank?.question_type) {
        // Choice Questions
        case "single_choice":
          return ChoiceQuestionGrader.gradeSingleChoice(question, answerData);
        case "multiple_choice":
          return ChoiceQuestionGrader.gradeMultipleChoice(question, answerData);
        case "true_false":
          return ChoiceQuestionGrader.gradeTrueFalse(question, answerData);

        // Text Input Questions
        case "numerical":
          return await TextInputGrader.gradeNumerical(question, answerData);
        case "fill_blank":
          return TextInputGrader.gradeFillBlank(question, answerData);
        case "short_answer":
          return await TextInputGrader.gradeShortAnswer(question, answerData);

        // Interactive Questions
        case "matching":
          return InteractiveGrader.gradeMatching(question, answerData);
        case "ordering":
          return InteractiveGrader.gradeOrdering(question, answerData);
        case "dropdown":
          return InteractiveGrader.gradeDropdown(question, answerData);

        // Coding Questions
        case "coding":
          return await CodingGrader.gradeCoding(question, answerData);

        case "algorithmic":
          return await InteractiveGrader.gradeAlgorithmic(question, answerData);

        case "logical_expression":
          return InteractiveGrader.gradeLogicalExpression(question, answerData);

        case "drag_drop":
          return InteractiveGrader.gradeDragDrop(question, answerData);

        default:
          // For question types that require manual grading
          return {
            is_correct: false,
            points_earned: 0,
            feedback: "Manual grading required for this question type",
          };
      }
    } catch (error) {
      console.error("Grading error:", error);
      return {
        is_correct: false,
        points_earned: 0,
        feedback: "Error occurred during automatic grading",
      };
    }
  }

  static async gradeQuizAttempt(attempt: QuizAttempt): Promise<GradingResult> {
    const question = await QuizQuestion.findByPk(attempt.question_id);
    if (!question) {
      return {
        is_correct: false,
        points_earned: 0,
        feedback: "Question not found",
      };
    }

    return this.gradeQuestion(
      question,
      attempt.submitted_answer as AnswerDataType,
    );
  }

  static async autoGradeSubmission(submissionId: number): Promise<{
    totalEarned: number;
    maxPossible: number;
    percentage: number;
    passed: boolean;
    details: Array<{
      question_id: number;
      points_earned: number;
      is_correct: boolean;
      feedback: string;
    }>;
  }> {
    const submission = await QuizAttempt.findAll({
      where: { submission_id: submissionId },
      include: [
        {
          model: QuizQuestion,
          as: "attemptQuestion",
        },
      ],
    });

    if (!submission || submission.length === 0) {
      throw new Error("No attempts found for submission");
    }

    let totalEarned = 0;
    let maxPossible = 0;
    const details: Array<{
      question_id: number;
      points_earned: number;
      is_correct: boolean;
      feedback: string;
    }> = [];

    for (const attempt of submission) {
      if (!attempt.attemptQuestion) continue;

      // Use advanced grading for all question types for consistency and to trigger AI grading
      const gradingResult = await AdvancedQuizGrader.gradeWithConfig(
        attempt.attemptQuestion,
        attempt.submitted_answer as AnswerDataType,
      );

      const isCorrect = gradingResult.is_correct;
      const pointsEarned = gradingResult.points_earned;
      const feedback =
        gradingResult.feedback || (isCorrect ? "Correct!" : "Incorrect");

      totalEarned += pointsEarned;
      maxPossible += parseFloat(String(attempt.attemptQuestion.points)) || 0;

      details.push({
        question_id: attempt.question_id,
        points_earned: pointsEarned,
        is_correct: isCorrect,
        feedback: feedback,
      });

      // Update the attempt with grading results and normalized answers if needed
      // (AdvancedQuizGrader handles normalization internally during grading)
      const normalizedAnswers = AdvancedQuizGrader.normalizeCorrectAnswer(
        attempt.attemptQuestion,
      );
      await attempt.update({
        is_correct: isCorrect,
        points_earned: pointsEarned,
        correct_answer: normalizedAnswers.data, // Store normalized correct answer for reference
      });
    }

    const percentage = maxPossible > 0 ? (totalEarned / maxPossible) * 100 : 0;

    return {
      totalEarned,
      maxPossible,
      percentage,
      passed: percentage >= 60, // Default passing score, should be configurable
      details,
    };
  }
}

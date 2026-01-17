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
} from "../types/grading.types";
import { CodeExecutor, TestCase } from "./codeExecutor";

// Category-based grading functions
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
          question.question_data,
        )}, correct_answer: ${JSON.stringify(question.correct_answer)}`,
      };
    }

    const correctAnswer = correctAnswerData.selected_option_index;
    const isCorrect = answerIndex === correctAnswer;

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
    if (
      !correctAnswerData ||
      typeof correctAnswerData !== "object" ||
      typeof correctAnswerData.selected_answer !== "boolean"
    ) {
      return {
        is_correct: false,
        points_earned: 0,
        feedback: "Question has no valid correct answer",
      };
    }

    const correctAnswer = correctAnswerData.selected_answer;

    const isCorrect = answerBool === correctAnswer;

    return {
      is_correct: isCorrect,
      points_earned: isCorrect ? parseFloat(String(question.points || 0)) : 0,
      feedback: isCorrect ? "Correct!" : "Incorrect answer",
    };
  }
}

export class TextInputGrader {
  static gradeNumerical(
    question: QuizQuestion,
    answerData: AnswerDataType,
  ): GradingResult {
    // Validate question data structure
    if (!question || !question.question_data) {
      return {
        is_correct: false,
        points_earned: 0,
        feedback: "Numerical question: Invalid question data",
      };
    }

    let questionData = question.question_data as any;
    // If question_data is stored as a string, parse it
    if (typeof questionData === "string") {
      try {
        questionData = JSON.parse(questionData);
      } catch (e) {
        return {
          is_correct: false,
          points_earned: 0,
          feedback: "Numerical question: Invalid question data format",
        };
      }
    }

    // Validate answer data
    if (!answerData) {
      return {
        is_correct: false,
        points_earned: 0,
        feedback: "Numerical question: No answer provided",
      };
    }

    const answer = answerData as any;

    // Validate answer structure
    if (
      typeof answer.answer !== "number" &&
      typeof answer.answer !== "string"
    ) {
      return {
        is_correct: false,
        points_earned: 0,
        feedback:
          "Numerical question: Invalid answer format - expected numeric value",
      };
    }

    // Convert string to number if needed
    let studentAnswer: number;
    if (typeof answer.answer === "string") {
      studentAnswer = parseFloat(answer.answer);
      if (isNaN(studentAnswer)) {
        return {
          is_correct: false,
          points_earned: 0,
          feedback: "Numerical question: Invalid number format",
        };
      }
    } else {
      studentAnswer = answer.answer;
    }

    // Validate question configuration
    if (typeof questionData.correct_answer !== "number") {
      return {
        is_correct: false,
        points_earned: 0,
        feedback: "Numerical question: No correct answer defined",
      };
    }

    const correctValue = questionData.correct_answer;
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
    // Validate question data structure
    if (!question || !question.question_data) {
      return {
        is_correct: false,
        points_earned: 0,
        feedback: "Fill blank question: Invalid question data",
      };
    }

    let questionData = question.question_data as any;
    // If question_data is stored as a string, parse it
    if (typeof questionData === "string") {
      try {
        questionData = JSON.parse(questionData);
      } catch (e) {
        return {
          is_correct: false,
          points_earned: 0,
          feedback: "Fill blank question: Invalid question data format",
        };
      }
    }

    // Validate answer data
    if (!answerData) {
      return {
        is_correct: false,
        points_earned: 0,
        feedback: "Fill blank question: No answer provided",
      };
    }

    const answer = answerData as any;

    // Validate answer structure
    if (!Array.isArray(answer.answers)) {
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
      return {
        is_correct: false,
        points_earned: 0,
        feedback:
          "Fill blank question: No acceptable answers defined in question configuration",
      };
    }

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

      const studentAnswer = answer.answers.find(
        (a: any) => a && typeof a === "object" && a.blank_index === index,
      );

      if (studentAnswer && typeof studentAnswer.answer === "string") {
        const isCorrect = blank.answers.some((acceptableAnswer: string) => {
          if (typeof acceptableAnswer !== "string") return false;

          if (blank.case_sensitive) {
            return studentAnswer.answer === acceptableAnswer;
          } else {
            return (
              studentAnswer.answer.toLowerCase() ===
              acceptableAnswer.toLowerCase()
            );
          }
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

  static gradeShortAnswer(
    question: QuizQuestion,
    answerData: AnswerDataType,
  ): GradingResult {
    let questionData = question.question_data as any;
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

    // For now, we'll do keyword-based grading
    // In a production system, you might want to use NLP or AI for better grading
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

    // Default: require manual grading
    return {
      is_correct: false,
      points_earned: 0,
      feedback: "Manual grading required",
    };
  }
}

export class InteractiveGrader {
  static gradeMatching(
    question: QuizQuestion,
    answerData: AnswerDataType,
  ): GradingResult {
    // Validate question data structure
    if (!question || !question.question_data) {
      return {
        is_correct: false,
        points_earned: 0,
        feedback: "Matching question: Invalid question data",
      };
    }

    let questionData = question.question_data as any;
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
      question.correct_answer &&
      (question.correct_answer as any).mappings &&
      typeof (question.correct_answer as any).mappings === "object"
    ) {
      correctMappings = (question.correct_answer as any).mappings;
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
      const studentRightId = answer.matches[leftId];
      if (studentRightId === rightId) {
        correctMatches++;
      }
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
    let questionData = question.question_data as any;
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

    // Create a mapping of item ID to correct order
    const correctOrderMap: Record<string, number> = {};
    questionData.items.forEach((item: any) => {
      correctOrderMap[item.id] = item.order;
    });

    let correctPositions = 0;
    const totalItems = questionData.items.length;

    // Check if each item is in the correct position
    answer.ordered_item_ids.forEach((itemId: string, index: number) => {
      if (correctOrderMap[itemId] === index + 1) {
        correctPositions++;
      }
    });

    const pointsEarned = Math.round(
      (correctPositions / totalItems) * parseFloat(String(question.points)),
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
    let questionData = question.question_data as any;
    // If question_data is stored as a string, parse it
    if (typeof questionData === "string") {
      try {
        questionData = JSON.parse(questionData);
      } catch (e) {
        questionData = {};
      }
    }
    const correctAnswer = question.correct_answer as any;
    const answer = answerData as any;

    if (!Array.isArray(answer.selections)) {
      return {
        is_correct: false,
        points_earned: 0,
        feedback: "Invalid answer format",
      };
    }

    let correctSelections = 0;

    questionData.dropdown_options.forEach((dropdown: any, index: number) => {
      const studentSelection = answer.selections.find(
        (s: any) => s.dropdown_index === index,
      );
      if (studentSelection) {
        // Check against correct answers - prioritize correct_answer column
        let correctOption = "";

        // Check correct_answer column first (array of objects format)
        if (correctAnswer && Array.isArray(correctAnswer)) {
          const correctItem = correctAnswer.find(
            (item: any) => item.dropdown_index === index,
          );
          if (correctItem && correctItem.selected_option) {
            correctOption = String(correctItem.selected_option);
          }
        }
        // Fallback to question_data.correct_selections
        else if (
          questionData.correct_selections &&
          Array.isArray(questionData.correct_selections) &&
          questionData.correct_selections[index]
        ) {
          correctOption = String(questionData.correct_selections[index]);
        }

        const isCorrect =
          correctOption &&
          String(correctOption).toLowerCase() ===
            String(studentSelection.selected_option).toLowerCase();

        if (isCorrect) {
          correctSelections++;
        }
      }
    });

    const pointsEarned = Math.round(
      (correctSelections / questionData.dropdown_options.length) *
        parseFloat(String(question.points)),
    );

    return {
      is_correct: correctSelections === questionData.dropdown_options.length,
      points_earned: pointsEarned,
      feedback: `${correctSelections}/${questionData.dropdown_options.length} dropdowns correct`,
    };
  }
}

export class CodingGrader {
  static async gradeCoding(
    question: QuizQuestion,
    answerData: AnswerDataType,
  ): Promise<GradingResult> {
    let questionData = question.question_data as any;
    // If question_data is stored as a string, parse it
    if (typeof questionData === "string") {
      try {
        questionData = JSON.parse(questionData);
      } catch (e) {
        questionData = {};
      }
    }
    const answer = answerData as any;

    // Validate answer format
    if (!answer || typeof answer.code !== "string") {
      return {
        is_correct: false,
        points_earned: 0,
        feedback: "Invalid answer format - code is required",
      };
    }

    // Basic validation - check if code is not empty
    if (answer.code.trim().length === 0) {
      return {
        is_correct: false,
        points_earned: 0,
        feedback: "No code submitted",
      };
    }

    // Use the CodeExecutor for proper test execution
    let passedTests = 0;
    let totalTests = 0;
    const testResults: any[] = [];

    if (questionData.test_cases && Array.isArray(questionData.test_cases)) {
      totalTests = questionData.test_cases.length;

      try {
        const executionResults = await CodeExecutor.executeTests({
          language: questionData.language || "javascript",
          code: answer.code,
          testCases: questionData.test_cases.map((tc: any, index: number) => ({
            id: tc.id || `test_${index}`,
            input: tc.input,
            expected_output: tc.expected_output,
            is_hidden: tc.is_hidden || false,
            points: tc.points || 1,
            time_limit: tc.time_limit || questionData.time_limit || 5,
            memory_limit: tc.memory_limit || questionData.memory_limit || 256,
          })),
          timeLimit: questionData.time_limit || 5,
          memoryLimit: questionData.memory_limit || 256,
        });

        for (const result of executionResults) {
          testResults.push({
            testCase: result.testCaseId,
            passed: result.passed,
            input: questionData.test_cases.find(
              (tc: any) => tc.id === result.testCaseId,
            )?.input,
            expected: questionData.test_cases.find(
              (tc: any) => tc.id === result.testCaseId,
            )?.expected_output,
            actual: result.output,
            error: result.error,
            executionTime: result.executionTime,
            memoryUsed: result.memoryUsed,
          });

          if (result.passed) {
            passedTests++;
          }
        }
      } catch (error) {
        return {
          is_correct: false,
          points_earned: 0,
          feedback: `Code execution failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        };
      }
    }

    // Calculate score based on passed tests
    let scorePercentage = 0;
    let pointsEarned = 0;

    if (totalTests > 0) {
      scorePercentage = (passedTests / totalTests) * 100;
      pointsEarned = Math.round(
        (passedTests / totalTests) * parseFloat(String(question.points)),
      );
    } else {
      // No test cases defined - cannot auto-grade
      return {
        is_correct: false,
        points_earned: 0,
        feedback:
          "No test cases defined for this coding question. Manual grading required.",
      };
    }

    // Generate feedback
    let feedback = `Passed ${passedTests}/${totalTests} test cases`;
    if (passedTests === totalTests && totalTests > 0) {
      feedback += " - Excellent work!";
    } else if (passedTests > 0) {
      feedback += " - Good progress, review failed test cases";
    } else {
      feedback += " - All tests failed, check your implementation";
    }

    return {
      is_correct: passedTests === totalTests && totalTests > 0,
      points_earned: pointsEarned,
      feedback,
      detailed_feedback: {
        testResults,
        passedTests,
        totalTests,
        scorePercentage,
      },
    };
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
    let questionData = question.question_data as any;
    if (typeof questionData === "string") {
      try {
        questionData = JSON.parse(questionData);
      } catch (e) {
        questionData = {};
      }
    }

    let correctAnswer = question.correct_answer as any;
    if (typeof correctAnswer === "string") {
      try {
        correctAnswer = JSON.parse(correctAnswer);
      } catch (e) {
        // Keep as string
      }
    }

    let normalizedData: any;

    switch (question.question_type) {
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

        // Fallback to question.correct_answer column
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
          correctOptionIndices = questionData.correct_option_indices.map(
            (idx: any) => (typeof idx === "string" ? parseInt(idx, 10) : idx),
          );
        } else if (questionData && Array.isArray(questionData.correct_answer)) {
          correctOptionIndices = questionData.correct_answer.map((idx: any) =>
            typeof idx === "string" ? parseInt(idx, 10) : idx,
          );
        } else if (correctAnswer !== undefined && correctAnswer !== null) {
          // Handle different formats of correct_answer
          if (Array.isArray(correctAnswer)) {
            correctOptionIndices = correctAnswer.map((idx: any) =>
              typeof idx === "string" ? parseInt(idx, 10) : idx,
            );
          } else if (
            correctAnswer &&
            typeof correctAnswer === "object" &&
            Array.isArray(correctAnswer.correct_option_indices)
          ) {
            correctOptionIndices = correctAnswer.correct_option_indices.map(
              (idx: any) => (typeof idx === "string" ? parseInt(idx, 10) : idx),
            );
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
            correctBool = val.toLowerCase() === "true";
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
              correctBool = val.toLowerCase() === "true";
            } else if (typeof val === "number") {
              correctBool = val === 1;
            }
          }
        }

        normalizedData =
          correctBool !== null ? { selected_answer: correctBool } : null;
        break;

      case "numerical":
        normalizedData =
          questionData && questionData.correct_answer !== undefined
            ? { answer: questionData.correct_answer }
            : null;
        break;

      case "short_answer":
        normalizedData =
          questionData && questionData.correct_answer !== undefined
            ? { answer: questionData.correct_answer }
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

      default:
        normalizedData = correctAnswer || questionData.correct_answer;
    }

    return {
      type: question.question_type,
      data: normalizedData,
      explanation: question.explanation,
    };
  }

  static async gradeWithConfig(
    question: QuizQuestion,
    answerData: AnswerDataType,
    config?: QuestionGradingConfig,
  ): Promise<AdvancedGradingResult> {
    const gradingConfig =
      config || this.getDefaultConfig(question.question_type);
    const maxPoints = parseFloat(String(question.points));

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
        return this.gradeShortAnswer(
          question,
          answerData,
          gradingConfig.config as ShortAnswerGradingConfig,
          maxPoints,
        );

      case "numerical":
        return this.gradeNumerical(
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
    const basicResult = ChoiceQuestionGrader.gradeSingleChoice(
      question,
      answerData,
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
      let questionData = question.question_data as any;
      if (typeof questionData === "string") {
        try {
          questionData = JSON.parse(questionData);
        } catch (e) {
          questionData = {};
        }
      }

      const answer = answerData as any;
      const correctIndices = questionData.correct_option_indices || [];
      const studentIndices = answer.selected_option_indices || [];

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

  private static gradeShortAnswer(
    question: QuizQuestion,
    answerData: AnswerDataType,
    config: ShortAnswerGradingConfig,
    maxPoints: number,
  ): AdvancedGradingResult {
    const basicResult = TextInputGrader.gradeShortAnswer(question, answerData);

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

  private static gradeNumerical(
    question: QuizQuestion,
    answerData: AnswerDataType,
    config: NumericalGradingConfig,
    maxPoints: number,
  ): AdvancedGradingResult {
    const basicResult = TextInputGrader.gradeNumerical(question, answerData);

    let pointsEarned = basicResult.points_earned;
    const breakdown: Record<string, number> = { base_score: pointsEarned };
    const penalties: Record<string, number> = {};

    // Apply units penalty if configured
    if (config.units_required && config.units_penalty > 0) {
      // For now, assume units are checked in basic grading
      // In a real implementation, you'd check units separately
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
      switch (question.question_type) {
        // Choice Questions
        case "single_choice":
          return ChoiceQuestionGrader.gradeSingleChoice(question, answerData);
        case "multiple_choice":
          return ChoiceQuestionGrader.gradeMultipleChoice(question, answerData);
        case "true_false":
          return ChoiceQuestionGrader.gradeTrueFalse(question, answerData);

        // Text Input Questions
        case "numerical":
          return TextInputGrader.gradeNumerical(question, answerData);
        case "fill_blank":
          return TextInputGrader.gradeFillBlank(question, answerData);
        case "short_answer":
          return TextInputGrader.gradeShortAnswer(question, answerData);

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

  private static gradeSingleChoice(
    question: QuizQuestion,
    answerData: AnswerDataType,
  ): GradingResult {
    return ChoiceQuestionGrader.gradeSingleChoice(question, answerData);
  }

  private static gradeMultipleChoice(
    question: QuizQuestion,
    answerData: AnswerDataType,
  ): GradingResult {
    return ChoiceQuestionGrader.gradeMultipleChoice(question, answerData);
  }

  private static gradeTrueFalse(
    question: QuizQuestion,
    answerData: AnswerDataType,
  ): GradingResult {
    return ChoiceQuestionGrader.gradeTrueFalse(question, answerData);
  }

  private static gradeNumerical(
    question: QuizQuestion,
    answerData: AnswerDataType,
  ): GradingResult {
    const questionData = question.question_data as any;
    const answer = answerData as any;

    if (typeof answer.answer !== "number") {
      return {
        is_correct: false,
        points_earned: 0,
        feedback: "Invalid answer format",
      };
    }

    const studentAnswer = answer.answer;
    const correctValue = questionData.correct_answer;
    const tolerance = questionData.tolerance || 0;

    // Check if within tolerance
    const isCorrect = Math.abs(studentAnswer - correctValue) <= tolerance;

    // Check if within acceptable range if specified
    let rangeCheck = true;
    if (questionData.acceptable_range) {
      rangeCheck =
        studentAnswer >= questionData.acceptable_range.min &&
        studentAnswer <= questionData.acceptable_range.max;
    }

    const finalIsCorrect = isCorrect && rangeCheck;

    return {
      is_correct: finalIsCorrect,
      points_earned: finalIsCorrect ? parseFloat(String(question.points)) : 0,
      feedback: finalIsCorrect
        ? "Correct numerical answer!"
        : `Expected ${correctValue}${
            questionData.units ? ` ${questionData.units}` : ""
          }`,
    };
  }

  private static gradeFillBlank(
    question: QuizQuestion,
    answerData: AnswerDataType,
  ): GradingResult {
    const questionData = question.question_data as any;
    const answer = answerData as any;

    if (!Array.isArray(answer.answers)) {
      return {
        is_correct: false,
        points_earned: 0,
        feedback: "Invalid answer format",
      };
    }

    if (
      !questionData.acceptable_answers ||
      !Array.isArray(questionData.acceptable_answers)
    ) {
      return {
        is_correct: false,
        points_earned: 0,
        feedback:
          "Question grading configuration error - no acceptable answers defined",
      };
    }

    let correctBlanks = 0;
    let totalPoints = 0;

    questionData.acceptable_answers.forEach((blank: any, index: number) => {
      const studentAnswer = answer.answers.find(
        (a: any) => a.blank_index === index,
      );
      if (studentAnswer) {
        const isCorrect = blank.answers.some((acceptableAnswer: string) => {
          if (blank.case_sensitive) {
            return studentAnswer.answer === acceptableAnswer;
          } else {
            return (
              studentAnswer.answer.toLowerCase() ===
              acceptableAnswer.toLowerCase()
            );
          }
        });

        if (isCorrect) {
          correctBlanks++;
        }
      }
      totalPoints +=
        Number(question.points) / questionData.acceptable_answers.length;
    });

    const pointsEarned = Math.round(
      (correctBlanks / questionData.acceptable_answers.length) *
        parseFloat(String(question.points)),
    );

    return {
      is_correct: correctBlanks === questionData.acceptable_answers.length,
      points_earned: pointsEarned,
      feedback: `${correctBlanks}/${questionData.acceptable_answers.length} blanks correct`,
    };
  }

  private static gradeShortAnswer(
    question: QuizQuestion,
    answerData: AnswerDataType,
  ): GradingResult {
    const questionData = question.question_data as any;
    const answer = answerData as any;

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

    // For now, we'll do keyword-based grading
    // In a production system, you might want to use NLP or AI for better grading
    if (questionData.keywords && questionData.keywords.length > 0) {
      const answerLower = answer.answer.toLowerCase();
      const foundKeywords = questionData.keywords.filter((keyword: string) =>
        answerLower.includes(keyword.toLowerCase()),
      );

      const keywordScore =
        (foundKeywords.length / questionData.keywords.length) *
        parseFloat(String(question.points));

      return {
        is_correct: foundKeywords.length === questionData.keywords.length,
        points_earned: Math.round(keywordScore),
        feedback: `Found ${foundKeywords.length}/${questionData.keywords.length} key concepts`,
      };
    }

    // Default: require manual grading
    return {
      is_correct: false,
      points_earned: 0,
      feedback: "Manual grading required",
    };
  }

  private static gradeMatching(
    question: QuizQuestion,
    answerData: AnswerDataType,
  ): GradingResult {
    const questionData = question.question_data as any;
    const correctAnswer = question.correct_answer as any;
    const answer = answerData as any;

    if (!answer.matches || typeof answer.matches !== "object") {
      return {
        is_correct: false,
        points_earned: 0,
        feedback: "Invalid answer format",
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
      correctAnswer &&
      correctAnswer.mappings &&
      typeof correctAnswer.mappings === "object"
    ) {
      correctMappings = correctAnswer.mappings;
    }

    if (!correctMappings) {
      return {
        is_correct: false,
        points_earned: 0,
        feedback: "Question grading configuration error",
      };
    }

    let correctMatches = 0;
    const totalMatches = Object.keys(correctMappings).length;

    Object.entries(correctMappings).forEach(([leftId, rightId]) => {
      if (answer.matches[leftId] === rightId) {
        correctMatches++;
      }
    });

    const pointsEarned = Math.round(
      (correctMatches / totalMatches) * question.points,
    );

    return {
      is_correct: correctMatches === totalMatches,
      points_earned: pointsEarned,
      feedback: `${correctMatches}/${totalMatches} matches correct`,
    };
  }

  private static gradeOrdering(
    question: QuizQuestion,
    answerData: AnswerDataType,
  ): GradingResult {
    const questionData = question.question_data as any;
    const correctAnswer = question.correct_answer as any;
    const answer = answerData as any;

    if (!Array.isArray(answer.ordered_item_ids)) {
      return {
        is_correct: false,
        points_earned: 0,
        feedback: "Invalid answer format",
      };
    }

    // Check for correct answer in question_data first, then in correct_answer
    let correctOrder: string[] | undefined;

    if (correctAnswer && Array.isArray(correctAnswer.ordered_item_ids)) {
      correctOrder = correctAnswer.ordered_item_ids;
    } else if (
      questionData &&
      questionData.items &&
      Array.isArray(questionData.items)
    ) {
      // Use the order from question_data.items
      correctOrder = questionData.items
        .sort((a: any, b: any) => a.order - b.order)
        .map((item: any) => item.id);
    }

    if (!correctOrder) {
      return {
        is_correct: false,
        points_earned: 0,
        feedback: "Question grading configuration error",
      };
    }

    let correctPositions = 0;
    const totalItems = correctOrder.length;

    // Check if each item is in the correct position
    answer.ordered_item_ids.forEach((itemId: string, index: number) => {
      if (correctOrder[index] === itemId) {
        correctPositions++;
      }
    });

    const pointsEarned = Math.round(
      (correctPositions / totalItems) * question.points,
    );

    return {
      is_correct: correctPositions === totalItems,
      points_earned: pointsEarned,
      feedback: `${correctPositions}/${totalItems} items in correct order`,
    };
  }

  private static gradeDropdown(
    question: QuizQuestion,
    answerData: AnswerDataType,
  ): GradingResult {
    // Validate question data structure
    if (!question || !question.question_data) {
      return {
        is_correct: false,
        points_earned: 0,
        feedback: "Dropdown question: Invalid question data",
      };
    }

    let questionData = question.question_data as any;
    // If question_data is stored as a string, parse it
    if (typeof questionData === "string") {
      try {
        questionData = JSON.parse(questionData);
      } catch (e) {
        return {
          is_correct: false,
          points_earned: 0,
          feedback: "Dropdown question: Invalid question data format",
        };
      }
    }

    // Validate answer data
    if (!answerData) {
      return {
        is_correct: false,
        points_earned: 0,
        feedback: "Dropdown question: No answer provided",
      };
    }

    const answer = answerData as any;

    // Validate answer structure
    if (!Array.isArray(answer.selections)) {
      return {
        is_correct: false,
        points_earned: 0,
        feedback:
          "Dropdown question: Invalid answer format - expected selections array",
      };
    }

    // Validate question configuration
    if (
      !questionData.dropdown_options ||
      !Array.isArray(questionData.dropdown_options)
    ) {
      return {
        is_correct: false,
        points_earned: 0,
        feedback: "Dropdown question: No dropdown options defined",
      };
    }

    if (
      !questionData.text_with_dropdowns ||
      typeof questionData.text_with_dropdowns !== "string"
    ) {
      return {
        is_correct: false,
        points_earned: 0,
        feedback: "Dropdown question: Question text is missing or invalid",
      };
    }

    let correctSelections = 0;
    const totalDropdowns = questionData.dropdown_options.length;

    questionData.dropdown_options.forEach((dropdown: any, index: number) => {
      if (!dropdown || typeof dropdown.dropdown_index !== "number") {
        return; // Skip invalid dropdown configuration
      }

      const studentSelection = answer.selections.find(
        (s: any) => s && typeof s === "object" && s.dropdown_index === index,
      );

      if (
        studentSelection &&
        typeof studentSelection.selected_option === "string"
      ) {
        // Check against correct answers - handle different formats
        let correctOptions: string[] = [];

        // First check question_data.correct_selections
        if (
          questionData.correct_selections &&
          Array.isArray(questionData.correct_selections)
        ) {
          if (questionData.correct_selections[index]) {
            const correctValue = questionData.correct_selections[index];
            correctOptions = Array.isArray(correctValue)
              ? correctValue.map(String)
              : [String(correctValue)];
          }
        }
        // Then check correct_answer column
        else if (
          question.correct_answer &&
          Array.isArray(question.correct_answer)
        ) {
          const correctItem = (question.correct_answer as any[]).find(
            (item: any) =>
              item && typeof item === "object" && item.dropdown_index === index,
          );
          if (correctItem && correctItem.selected_option) {
            correctOptions = [String(correctItem.selected_option)];
          }
        }
        // Fallback: assume first option is correct (for demo purposes)
        else if (
          dropdown.options &&
          Array.isArray(dropdown.options) &&
          dropdown.options.length > 0
        ) {
          correctOptions = [String(dropdown.options[0])];
        }

        const isCorrect = correctOptions.some(
          (option: string) =>
            option.toLowerCase() ===
            studentSelection.selected_option.toLowerCase(),
        );

        if (isCorrect) {
          correctSelections++;
        }
      }
    });

    const pointsEarned = Math.round(
      (correctSelections / totalDropdowns) *
        parseFloat(String(question.points || 0)),
    );

    return {
      is_correct: correctSelections === totalDropdowns,
      points_earned: pointsEarned,
      feedback: `${correctSelections}/${totalDropdowns} dropdowns correct`,
    };
  }
  private static async gradeCoding(
    question: QuizQuestion,
    answerData: AnswerDataType,
  ): Promise<GradingResult> {
    const questionData = question.question_data as any;
    const answer = answerData as any;

    // Validate answer format
    if (!answer || typeof answer.code !== "string") {
      return {
        is_correct: false,
        points_earned: 0,
        feedback: "Invalid answer format - code is required",
      };
    }

    // Basic validation - check if code is not empty
    if (answer.code.trim().length === 0) {
      return {
        is_correct: false,
        points_earned: 0,
        feedback: "No code submitted",
      };
    }

    // Use the CodeExecutor for proper test execution
    let passedTests = 0;
    let totalTests = 0;
    const testResults: any[] = [];

    if (questionData.test_cases && Array.isArray(questionData.test_cases)) {
      totalTests = questionData.test_cases.length;

      try {
        const executionResults = await CodeExecutor.executeTests({
          language: questionData.language || "javascript",
          code: answer.code,
          testCases: questionData.test_cases.map((tc: any, index: number) => ({
            id: tc.id || `test_${index}`,
            input: tc.input,
            expected_output: tc.expected_output,
            is_hidden: tc.is_hidden || false,
            points: tc.points || 1,
            time_limit: tc.time_limit || questionData.time_limit || 5,
            memory_limit: tc.memory_limit || questionData.memory_limit || 256,
          })),
          timeLimit: questionData.time_limit || 5,
          memoryLimit: questionData.memory_limit || 256,
        });

        for (const result of executionResults) {
          testResults.push({
            testCase: result.testCaseId,
            passed: result.passed,
            input: questionData.test_cases.find(
              (tc: any) => tc.id === result.testCaseId,
            )?.input,
            expected: questionData.test_cases.find(
              (tc: any) => tc.id === result.testCaseId,
            )?.expected_output,
            actual: result.output,
            error: result.error,
            executionTime: result.executionTime,
            memoryUsed: result.memoryUsed,
          });

          if (result.passed) {
            passedTests++;
          }
        }
      } catch (error) {
        return {
          is_correct: false,
          points_earned: 0,
          feedback: `Code execution failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        };
      }
    }

    // Calculate score based on passed tests
    let scorePercentage = 0;
    let pointsEarned = 0;

    if (totalTests > 0) {
      scorePercentage = (passedTests / totalTests) * 100;
      pointsEarned = Math.round((passedTests / totalTests) * question.points);
    } else {
      // No test cases defined - cannot auto-grade
      return {
        is_correct: false,
        points_earned: 0,
        feedback:
          "No test cases defined for this coding question. Manual grading required.",
      };
    }

    // Generate feedback
    let feedback = `Passed ${passedTests}/${totalTests} test cases`;
    if (passedTests === totalTests && totalTests > 0) {
      feedback += " - Excellent work!";
    } else if (passedTests > 0) {
      feedback += " - Good progress, review failed test cases";
    } else {
      feedback += " - All tests failed, check your implementation";
    }

    return {
      is_correct: passedTests === totalTests && totalTests > 0,
      points_earned: pointsEarned,
      feedback,
      detailed_feedback: {
        testResults,
        passedTests,
        totalTests,
        scorePercentage,
      },
    };
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
      if (!attempt.question) continue;

      // Normalize answers for consistent comparison
      const normalizedSubmittedAnswer = AdvancedQuizGrader.normalizeAnswer(
        attempt.submitted_answer as AnswerDataType,
        attempt.question.question_type,
      );
      const normalizedCorrectAnswer = AdvancedQuizGrader.normalizeCorrectAnswer(
        attempt.question,
      );

      // Compare normalized answers directly for accurate grading
      let isCorrect = false;
      let pointsEarned = 0;
      let feedback = "Incorrect";

      if (normalizedSubmittedAnswer.data && normalizedCorrectAnswer.data) {
        // For exact match questions (single_choice, true_false)
        if (
          [
            "single_choice",
            "true_false",
            "numerical",
            "short_answer",
            "fill_blank",
            "matching",
            "ordering",
            "dropdown",
          ].includes(attempt.question.question_type)
        ) {
          // Parse JSON if stored as strings and compare objects
          let submitted = normalizedSubmittedAnswer.data;
          let correct = normalizedCorrectAnswer.data;

          if (typeof submitted === "string") {
            try {
              submitted = JSON.parse(submitted);
            } catch (e) {
              submitted = {};
            }
          }
          if (typeof correct === "string") {
            try {
              correct = JSON.parse(correct);
            } catch (e) {
              correct = {};
            }
          }

          isCorrect = this.deepEqual(submitted, correct);
          pointsEarned = isCorrect
            ? parseFloat(String(attempt.question.points))
            : 0;
          feedback = isCorrect ? "Correct!" : "Incorrect";
        }
        // For multiple_choice, use advanced grading for partial credit
        else if (attempt.question.question_type === "multiple_choice") {
          const gradingResult = await AdvancedQuizGrader.gradeWithConfig(
            attempt.question,
            attempt.submitted_answer as AnswerDataType,
          );
          isCorrect = gradingResult.is_correct;
          pointsEarned = gradingResult.points_earned;
          feedback = gradingResult.feedback;
        }
        // For coding, use existing grading
        else if (attempt.question.question_type === "coding") {
          const gradingResult = await AdvancedQuizGrader.gradeWithConfig(
            attempt.question,
            attempt.submitted_answer as AnswerDataType,
          );
          isCorrect = gradingResult.is_correct;
          pointsEarned = gradingResult.points_earned;
          feedback = gradingResult.feedback;
        }
      }

      totalEarned += pointsEarned;
      maxPossible += parseFloat(String(attempt.question.points)) || 0;

      details.push({
        question_id: attempt.question_id,
        points_earned: pointsEarned,
        is_correct: isCorrect,
        feedback: feedback,
      });

      // Update the attempt with normalized answers and grading results
      await attempt.update({
        submitted_answer: normalizedSubmittedAnswer.data,
        correct_answer: normalizedCorrectAnswer.data,
        is_correct: isCorrect,
        points_earned: pointsEarned,
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

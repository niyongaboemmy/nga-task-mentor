// Test script for fill_blank grading (updated with new requirements)
function stripHtml(html) {
  if (html === null || html === undefined) return "";
  if (typeof html !== "string") return String(html);

  let text = html.replace(/<[^>]*>?/gm, "");

  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, '"')
    .replace(/'/g, "'");

  text = text.replace(/\\\(|\\\)|\\\[|\\\]|\$/g, "");

  text = text.replace(
    /\\(text|mathrm|mathbf|mathsf|mathtt|mathit|textbf|textit|texttt|textrm)\{([^}]*)\}/g,
    "$2",
  );

  text = text.replace(/\\(frac|tfrac|dfrac)\{([^}]*)\}\{([^}]*)\}/g, "$2 $3");
  text = text.replace(/\\(sqrt|overline|underline)\{([^}]*)\}/g, "$2");

  text = text.replace(
    /\\(displaystyle|bold|color|underset|overset|left|right|big|Big|cell|row|column|hline|vline|\[|\]|tiny|small|large|Large|huge|Huge|\\|&)/g,
    "",
  );

  return text
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function gradeFillBlank(question, answerData) {
  if (!question || !question.questionBank?.question_data) {
    return {
      is_correct: false,
      points_earned: 0,
      feedback: "Fill blank question: Invalid question data",
    };
  }

  let questionData = question.questionBank?.question_data;
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

  if (!answerData) {
    return {
      is_correct: false,
      points_earned: 0,
      feedback: "Fill blank question: No answer provided",
    };
  }

  const answer = answerData;

  let answerArray = [];
  if (Array.isArray(answer.answers)) {
    answerArray = answer.answers;
  } else if (typeof answer.answer === "string") {
    answerArray = [{ blank_index: 0, answer: answer.answer }];
  } else if (typeof answer === "string") {
    answerArray = [{ blank_index: 0, answer: answer }];
  }

  if (answerArray.length === 0) {
    return {
      is_correct: false,
      points_earned: 0,
      feedback:
        "Fill blank question: Invalid answer format - expected answers array",
    };
  }

  if (
    !questionData.acceptable_answers ||
    !Array.isArray(questionData.acceptable_answers)
  ) {
    return {
      is_correct: false,
      points_earned: 0,
      feedback: "Fill blank question: No acceptable answers defined",
    };
  }

  let correctBlanks = 0;
  const totalBlanks = questionData.acceptable_answers.length;

  for (let index = 0; index < totalBlanks; index++) {
    const blank = questionData.acceptable_answers[index];

    if (!blank || !Array.isArray(blank.answers) || blank.answers.length === 0) {
      return {
        is_correct: false,
        points_earned: 0,
        feedback: `Fill blank question: Blank ${index + 1} has no acceptable answers defined`,
      };
    }

    const studentAnswer = answerArray.find(
      (a) => a && typeof a === "object" && a.blank_index === index,
    );

    if (
      studentAnswer &&
      (typeof studentAnswer.answer === "string" ||
        typeof studentAnswer.answer === "number")
    ) {
      const studentAnsStr = stripHtml(String(studentAnswer.answer));

      const isCorrect = blank.answers.some((acceptableAnswer) => {
        let acceptableStr;
        if (typeof acceptableAnswer === "object" && acceptableAnswer !== null) {
          acceptableStr = String(
            acceptableAnswer.text ||
              acceptableAnswer.value ||
              acceptableAnswer.answer ||
              "",
          );
        } else {
          acceptableStr = String(acceptableAnswer);
        }

        const acceptableAnsClean = stripHtml(acceptableStr);

        const match = blank.case_sensitive
          ? studentAnsStr === acceptableAnsClean
          : studentAnsStr.toLowerCase() === acceptableAnsClean.toLowerCase();

        return match;
      });

      if (isCorrect) {
        correctBlanks++;
      }
    }
  }

  const pointsEarned = parseFloat(
    (
      (correctBlanks / totalBlanks) *
      parseFloat(String(question.points || 0))
    ).toFixed(2),
  );

  const finalIsCorrect = pointsEarned > 0;

  return {
    is_correct: finalIsCorrect,
    points_earned: pointsEarned,
    feedback: `${correctBlanks}/${totalBlanks} blanks correct`,
  };
}

// Test cases
const testCase1 = {
  question: {
    points: 10,
    questionBank: {
      question_data: {
        text_with_blanks:
          "The capital of France is [blank1] and the capital of Germany is [blank2]",
        acceptable_answers: [
          { answers: ["Paris"], case_sensitive: false },
          { answers: ["Berlin"], case_sensitive: false },
        ],
      },
    },
  },
  answerData: {
    answers: [
      { blank_index: 0, answer: "Paris" },
      { blank_index: 1, answer: "Berlin" },
    ],
  },
};

const testCase2 = {
  question: {
    points: 10,
    questionBank: {
      question_data: {
        text_with_blanks:
          "The capital of France is [blank1] and the capital of Germany is [blank2]",
        acceptable_answers: [
          { answers: ["Paris"], case_sensitive: false },
          { answers: ["Berlin"], case_sensitive: false },
        ],
      },
    },
  },
  answerData: {
    answers: [
      { blank_index: 0, answer: "Paris" },
      { blank_index: 1, answer: "London" },
    ],
  },
};

const testCase3 = {
  question: {
    points: 10,
    questionBank: {
      question_data: {
        text_with_blanks:
          "The capital of France is [blank1] and the capital of Germany is [blank2]",
        acceptable_answers: [
          { answers: ["Paris"], case_sensitive: false },
          { answers: ["Berlin"], case_sensitive: false },
        ],
      },
    },
  },
  answerData: {
    answers: [
      { blank_index: 0, answer: "London" },
      { blank_index: 1, answer: "Madrid" },
    ],
  },
};

// Run tests
console.log("=== Fill Blank Grading Test ===");
console.log("\nTest Case 1: All blanks correct");
const result1 = gradeFillBlank(testCase1.question, testCase1.answerData);
console.log(`Result: ${result1.is_correct ? "Correct" : "Incorrect"}`);
console.log(`Points Earned: ${result1.points_earned}`);

console.log("\nTest Case 2: One blank correct");
const result2 = gradeFillBlank(testCase2.question, testCase2.answerData);
console.log(`Result: ${result2.is_correct ? "Correct" : "Incorrect"}`);
console.log(`Points Earned: ${result2.points_earned}`);

console.log("\nTest Case 3: All blanks incorrect");
const result3 = gradeFillBlank(testCase3.question, testCase3.answerData);
console.log(`Result: ${result3.is_correct ? "Correct" : "Incorrect"}`);
console.log(`Points Earned: ${result3.points_earned}`);

// Test script for multiple choice grading (updated with new requirements)
function gradeMultipleChoice(question, answerData) {
  // Validate inputs
  if (!question || !answerData) {
    return {
      is_correct: false,
      points_earned: 0,
      feedback: "Invalid question or answer data",
    };
  }

  // Parse answerData
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

  const answer = parsedAnswerData;

  if (!Array.isArray(answer.selected_option_indices)) {
    return {
      is_correct: false,
      points_earned: 0,
      feedback: "Invalid answer format",
    };
  }

  // Normalize correct answer
  const questionData = question.questionBank?.question_data;
  const correctAnswer = questionData.correct_option_indices;
  const correctAnswers = [...correctAnswer].sort();

  const answerIndices = [];
  for (const idx of answer.selected_option_indices) {
    if (typeof idx === "string") {
      const parsed = parseInt(idx, 10);
      if (isNaN(parsed)) {
        return {
          is_correct: false,
          points_earned: 0,
          feedback: "Invalid answer format",
        };
      }
      answerIndices.push(parsed);
    } else if (typeof idx === "number") {
      answerIndices.push(idx);
    } else {
      return {
        is_correct: false,
        points_earned: 0,
        feedback: "Invalid answer format",
      };
    }
  }

  const studentAnswers = [...answerIndices].sort();

  // Check if arrays are identical
  const isCorrect =
    correctAnswers.length === studentAnswers.length &&
    correctAnswers.every((val, index) => val === studentAnswers[index]);

  // Calculate points
  let pointsEarned = 0;
  const questionPoints = parseFloat(String(question.points || 0));

  if (isCorrect) {
    pointsEarned = questionPoints;
  } else {
    const correctSelections = studentAnswers.filter((index) =>
      correctAnswers.includes(index),
    ).length;
    const wrongSelections = studentAnswers.filter(
      (index) => !correctAnswers.includes(index),
    ).length;

    const netCorrect = correctSelections - wrongSelections;

    if (netCorrect > 0) {
      pointsEarned = parseFloat(
        ((netCorrect / correctAnswers.length) * questionPoints).toFixed(2),
      );
    } else {
      pointsEarned = 0;
    }
  }

  const finalIsCorrect = pointsEarned > 0;

  return {
    is_correct: finalIsCorrect,
    points_earned: pointsEarned,
    feedback: finalIsCorrect
      ? "Some selections correct!"
      : "All selections incorrect",
  };
}

// Test cases
const testCase1 = {
  question: {
    points: 10,
    questionBank: {
      question_data: {
        correct_option_indices: [0, 2],
      },
    },
  },
  answerData: {
    selected_option_indices: [0],
  },
};

const testCase2 = {
  question: {
    points: 10,
    questionBank: {
      question_data: {
        correct_option_indices: [0, 2],
      },
    },
  },
  answerData: {
    selected_option_indices: [0, 1],
  },
};

const testCase3 = {
  question: {
    points: 10,
    questionBank: {
      question_data: {
        correct_option_indices: [0, 2],
      },
    },
  },
  answerData: {
    selected_option_indices: [0, 2],
  },
};

// Run tests
console.log("=== Multiple Choice Grading Test ===");
console.log("\nTest Case 1: One correct answer");
const result1 = gradeMultipleChoice(testCase1.question, testCase1.answerData);
console.log(`Result: ${result1.is_correct ? "Correct" : "Incorrect"}`);
console.log(`Points Earned: ${result1.points_earned}`);

console.log("\nTest Case 2: One correct, one wrong");
const result2 = gradeMultipleChoice(testCase2.question, testCase2.answerData);
console.log(`Result: ${result2.is_correct ? "Correct" : "Incorrect"}`);
console.log(`Points Earned: ${result2.points_earned}`);

console.log("\nTest Case 3: All correct answers");
const result3 = gradeMultipleChoice(testCase3.question, testCase3.answerData);
console.log(`Result: ${result3.is_correct ? "Correct" : "Incorrect"}`);
console.log(`Points Earned: ${result3.points_earned}`);

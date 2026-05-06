// Test script for dropdown grading (updated with new requirements)
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

function gradeDropdown(question, answerData) {
  let questionData = question.questionBank?.question_data;
  if (typeof questionData === "string") {
    try {
      questionData = JSON.parse(questionData);
    } catch (e) {
      questionData = {};
    }
  }

  const correctAnswer = question.questionBank?.correct_answer;
  const answer = answerData;

  let selectionsArray = [];
  if (answer) {
    if (Array.isArray(answer.selections)) {
      selectionsArray = answer.selections;
    } else if (Array.isArray(answer)) {
      selectionsArray = answer.map((opt, idx) => ({
        dropdown_index: idx,
        selected_option: typeof opt === "object" ? opt.selected_option : opt,
      }));
    } else if (typeof answer === "object") {
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

  const correctAnswersMap = {};

  let parsedCorrectAnswer = correctAnswer;
  if (typeof correctAnswer === "string") {
    try {
      parsedCorrectAnswer = JSON.parse(correctAnswer);
    } catch (e) {}
  }

  if (Array.isArray(parsedCorrectAnswer)) {
    parsedCorrectAnswer.forEach((item, idx) => {
      if (typeof item === "object" && item.selected_option !== undefined) {
        correctAnswersMap[item.dropdown_index ?? idx] = String(
          item.selected_option,
        );
      } else {
        correctAnswersMap[idx] = String(item);
      }
    });
  } else if (
    parsedCorrectAnswer &&
    Array.isArray(parsedCorrectAnswer.selections)
  ) {
    parsedCorrectAnswer.selections.forEach((item) => {
      if (
        item.dropdown_index !== undefined &&
        item.selected_option !== undefined
      ) {
        correctAnswersMap[item.dropdown_index] = String(item.selected_option);
      }
    });
  } else if (parsedCorrectAnswer && typeof parsedCorrectAnswer === "object") {
    Object.entries(parsedCorrectAnswer)
      .filter(([key]) => !isNaN(parseInt(key)))
      .forEach(([key, val]) => {
        correctAnswersMap[parseInt(key)] = String(val);
      });
  }

  if (
    Object.keys(correctAnswersMap).length === 0 &&
    questionData.correct_selections &&
    Array.isArray(questionData.correct_selections)
  ) {
    questionData.correct_selections.forEach((val, idx) => {
      correctAnswersMap[idx] = String(val);
    });
  }

  if (
    Object.keys(correctAnswersMap).length === 0 &&
    questionData.acceptable_answers &&
    Array.isArray(questionData.acceptable_answers)
  ) {
    questionData.acceptable_answers.forEach((acc, idx) => {
      if (Array.isArray(acc.answers)) {
        correctAnswersMap[idx] = String(acc.answers[0]);
      } else if (acc.answer) {
        correctAnswersMap[idx] = String(acc.answer);
      }
    });
  }

  if (Object.keys(correctAnswersMap).length === 0) {
    dropdownOptions.forEach((dropdown, idx) => {
      if (dropdown.correct_answer !== undefined) {
        correctAnswersMap[idx] = String(dropdown.correct_answer);
      } else if (dropdown.correct_option_index !== undefined) {
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

  if (Object.keys(correctAnswersMap).length === 0) {
    dropdownOptions.forEach((dropdown, idx) => {
      if (dropdown.options && dropdown.options.length > 0) {
        const opt = dropdown.options[0];
        correctAnswersMap[idx] =
          typeof opt === "object" ? String(opt.text || opt.value) : String(opt);
      }
    });
  }

  dropdownOptions.forEach((dropdown, index) => {
    const studentSelection = selectionsArray.find((s) => {
      const selIdx = s.dropdown_index;
      return (
        selIdx === index ||
        selIdx === dropdown.dropdown_index ||
        (selIdx === undefined && selectionsArray.indexOf(s) === index)
      );
    });

    const correctOption =
      correctAnswersMap[index] || correctAnswersMap[dropdown.dropdown_index];

    if (studentSelection && correctOption !== undefined) {
      let studentVal;
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

      const studentValClean = stripHtml(studentVal).toLowerCase();
      const correctValClean = stripHtml(correctOption).toLowerCase();

      const isMatch = studentValClean === correctValClean;

      if (isMatch) {
        correctSelections++;
      }
    }
  });

  const totalDropdowns = dropdownOptions.length;
  const pointsEarned =
    totalDropdowns > 0
      ? parseFloat(
          (
            (correctSelections / totalDropdowns) *
            parseFloat(String(question.points || 0))
          ).toFixed(2),
        )
      : 0;

  const finalIsCorrect = pointsEarned > 0;

  return {
    is_correct: finalIsCorrect,
    points_earned: pointsEarned,
    feedback: `${correctSelections}/${totalDropdowns} dropdowns correct`,
  };
}

// Test cases
const testCase1 = {
  question: {
    points: 10,
    questionBank: {
      question_data: {
        dropdown_options: [
          {
            dropdown_index: 0,
            options: ["Apple", "Banana", "Orange"],
            correct_answer: "Banana",
          },
          {
            dropdown_index: 1,
            options: ["Red", "Blue", "Green"],
            correct_answer: "Blue",
          },
        ],
      },
    },
  },
  answerData: {
    selections: [
      { dropdown_index: 0, selected_option: "Banana" },
      { dropdown_index: 1, selected_option: "Blue" },
    ],
  },
};

const testCase2 = {
  question: {
    points: 10,
    questionBank: {
      question_data: {
        dropdown_options: [
          {
            dropdown_index: 0,
            options: ["Apple", "Banana", "Orange"],
            correct_answer: "Banana",
          },
          {
            dropdown_index: 1,
            options: ["Red", "Blue", "Green"],
            correct_answer: "Blue",
          },
        ],
      },
    },
  },
  answerData: {
    selections: [
      { dropdown_index: 0, selected_option: "Banana" },
      { dropdown_index: 1, selected_option: "Red" },
    ],
  },
};

const testCase3 = {
  question: {
    points: 10,
    questionBank: {
      question_data: {
        dropdown_options: [
          {
            dropdown_index: 0,
            options: ["Apple", "Banana", "Orange"],
            correct_answer: "Banana",
          },
          {
            dropdown_index: 1,
            options: ["Red", "Blue", "Green"],
            correct_answer: "Blue",
          },
        ],
      },
    },
  },
  answerData: {
    selections: [
      { dropdown_index: 0, selected_option: "Apple" },
      { dropdown_index: 1, selected_option: "Red" },
    ],
  },
};

// Run tests
console.log("=== Dropdown Grading Test ===");
console.log("\nTest Case 1: All dropdowns correct");
const result1 = gradeDropdown(testCase1.question, testCase1.answerData);
console.log(`Result: ${result1.is_correct ? "Correct" : "Incorrect"}`);
console.log(`Points Earned: ${result1.points_earned}`);

console.log("\nTest Case 2: One dropdown correct");
const result2 = gradeDropdown(testCase2.question, testCase2.answerData);
console.log(`Result: ${result2.is_correct ? "Correct" : "Incorrect"}`);
console.log(`Points Earned: ${result2.points_earned}`);

console.log("\nTest Case 3: All dropdowns incorrect");
const result3 = gradeDropdown(testCase3.question, testCase3.answerData);
console.log(`Result: ${result3.is_correct ? "Correct" : "Incorrect"}`);
console.log(`Points Earned: ${result3.points_earned}`);

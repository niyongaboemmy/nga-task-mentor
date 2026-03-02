// Test script to verify the new ordering question grading logic
const fs = require("fs");
const path = require("path");

// Copy of the updated grading function
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

function gradeOrdering(question, answerData) {
  // Mock data
  const questionData = question.questionBank?.question_data;
  const answer = answerData;

  if (!Array.isArray(answer.ordered_item_ids)) {
    return {
      is_correct: false,
      points_earned: 0,
      feedback: "Invalid answer format",
    };
  }

  if (!Array.isArray(questionData.items) || questionData.items.length === 0) {
    return {
      is_correct: false,
      points_earned: 0,
      feedback: "Ordering question: No items defined",
    };
  }

  const itemsWithOrder = questionData.items
    .map((item) => {
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
    .filter((x) => x.idStr);

  const canSortByOrder = itemsWithOrder.every((x) => x.order !== null);

  const sorted = canSortByOrder
    ? [...itemsWithOrder].sort((a, b) => a.order - b.order)
    : [...itemsWithOrder];

  const correctOrderedIds = sorted.map((x) => x.idStr);
  const correctTextToIndex = {};
  sorted.forEach((x, idx) => {
    if (x.textKey) correctTextToIndex[x.textKey] = idx;
  });

  let correctPositions = 0;
  const totalItems = questionData.items.length;

  if (answer.ordered_item_ids.length !== totalItems) {
    return {
      is_correct: false,
      points_earned: 0,
      feedback: `Invalid answer: expected ${totalItems} items, got ${answer.ordered_item_ids.length}`,
    };
  }

  answer.ordered_item_ids.forEach((itemId, index) => {
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

  const isCorrect = correctPositions === totalItems;
  const pointsEarned = isCorrect ? parseFloat(String(question.points || 0)) : 0;

  return {
    is_correct: isCorrect,
    points_earned: pointsEarned,
    feedback: isCorrect ? "All items in correct order!" : "Incorrect order",
  };
}

// Test cases
const testCases = [
  {
    name: "All items in correct order",
    question: {
      points: 10,
      questionBank: {
        question_data: {
          items: [
            { id: 1, text: "First", order: 1 },
            { id: 2, text: "Second", order: 2 },
            { id: 3, text: "Third", order: 3 },
          ],
        },
      },
    },
    answer: { ordered_item_ids: [1, 2, 3] },
    expectedPoints: 10,
  },
  {
    name: "One item in wrong position",
    question: {
      points: 10,
      questionBank: {
        question_data: {
          items: [
            { id: 1, text: "First", order: 1 },
            { id: 2, text: "Second", order: 2 },
            { id: 3, text: "Third", order: 3 },
          ],
        },
      },
    },
    answer: { ordered_item_ids: [1, 3, 2] },
    expectedPoints: 0,
  },
  {
    name: "Completely wrong order",
    question: {
      points: 10,
      questionBank: {
        question_data: {
          items: [
            { id: 1, text: "First", order: 1 },
            { id: 2, text: "Second", order: 2 },
            { id: 3, text: "Third", order: 3 },
          ],
        },
      },
    },
    answer: { ordered_item_ids: [3, 2, 1] },
    expectedPoints: 0,
  },
  {
    name: "Text-based matching",
    question: {
      points: 10,
      questionBank: {
        question_data: {
          items: [
            { id: 1, text: "First", order: 1 },
            { id: 2, text: "Second", order: 2 },
            { id: 3, text: "Third", order: 3 },
          ],
        },
      },
    },
    answer: { ordered_item_ids: ["First", "Second", "Third"] },
    expectedPoints: 10,
  },
];

console.log("=== Testing Ordering Question Grading ===");
console.log("");

testCases.forEach((test, index) => {
  console.log(`Test Case ${index + 1}: ${test.name}`);
  console.log(`  Question Points: ${test.question.points}`);

  const result = gradeOrdering(test.question, test.answer);

  const pass = result.points_earned === test.expectedPoints;
  console.log(
    `  Points Earned: ${result.points_earned} (expected: ${test.expectedPoints})`,
  );
  console.log(`  Result: ${pass ? "✅ PASS" : "❌ FAIL"}`);
  console.log("");
});

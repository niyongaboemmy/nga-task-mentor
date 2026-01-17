const { AdvancedQuizGrader } = require("./src/utils/quizGrader");

// Debug normalization
function debugNormalization() {
  console.log("🔍 Debugging Normalization\n");

  const testCases = [
    {
      type: "true_false",
      question: {
        question_type: "true_false",
        points: 10,
        correct_answer: true,
      },
    },
    {
      type: "single_choice",
      question: {
        question_type: "single_choice",
        points: 10,
        correct_answer: 1,
      },
    },
    {
      type: "multiple_choice",
      question: {
        question_type: "multiple_choice",
        points: 10,
        correct_answer: [0, 2],
      },
    },
    {
      type: "numerical",
      question: {
        question_type: "numerical",
        points: 10,
        question_data: { correct_answer: 42 },
      },
    },
  ];

  for (const test of testCases) {
    console.log(`\n--- ${test.type} ---`);
    console.log("Question:", JSON.stringify(test.question, null, 2));

    const normalized = AdvancedQuizGrader.normalizeCorrectAnswer(test.question);
    console.log("Normalized result:", JSON.stringify(normalized, null, 2));
  }
}

debugNormalization();

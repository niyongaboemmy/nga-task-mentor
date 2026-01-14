const { QuizGrader, AdvancedQuizGrader } = require("./src/utils/quizGrader");

// Comprehensive test for the new grading system
async function testComprehensiveGrading() {
  console.log("🧪 Comprehensive Grading System Test\n");

  // Test 1: Full quiz grading with normalized answers
  console.log("1. Testing Full Quiz Grading with Normalized Answers:");

  const quizQuestions = [
    {
      id: 1,
      question_type: "true_false",
      points: 5,
      question_data: { correct_answer: true },
      correct_answer: true,
    },
    {
      id: 2,
      question_type: "single_choice",
      points: 10,
      question_data: { correct_option_index: 1 },
      correct_answer: 1,
    },
    {
      id: 3,
      question_type: "multiple_choice",
      points: 15,
      question_data: { correct_option_indices: [0, 2] },
      correct_answer: [0, 2],
    },
    {
      id: 4,
      question_type: "numerical",
      points: 10,
      question_data: { correct_answer: 42 },
    },
    {
      id: 5,
      question_type: "short_answer",
      points: 8,
      question_data: { correct_answer: "inheritance" },
    },
  ];

  const studentAnswers = [
    { selected_answer: true }, // Correct T/F
    { selected_option_index: 1 }, // Correct single choice
    { selected_option_indices: [0, 2] }, // Correct multiple choice
    { answer: 42 }, // Correct numerical
    { answer: "inheritance" }, // Correct short answer
  ];

  let totalScore = 0;
  let maxScore = 0;
  let correctCount = 0;

  for (let i = 0; i < quizQuestions.length; i++) {
    const question = quizQuestions[i];
    const answer = studentAnswers[i];

    // Normalize answers
    const normalizedSubmitted = AdvancedQuizGrader.normalizeAnswer(
      answer,
      question.question_type
    );
    const normalizedCorrect =
      AdvancedQuizGrader.normalizeCorrectAnswer(question);

    // Check if they match
    const isCorrect =
      JSON.stringify(normalizedSubmitted.data) ===
      JSON.stringify(normalizedCorrect.data);

    if (isCorrect) {
      totalScore += question.points;
      correctCount++;
    }
    maxScore += question.points;

    console.log(
      `   Question ${i + 1} (${question.question_type}): ${
        isCorrect ? "✅" : "❌"
      } (${isCorrect ? question.points : 0}/${question.points})`
    );
  }

  const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
  console.log(`\n   📊 Quiz Results:`);
  console.log(`   Total Score: ${totalScore}/${maxScore} points`);
  console.log(`   Percentage: ${Math.round(percentage)}%`);
  console.log(`   Questions Correct: ${correctCount}/${quizQuestions.length}`);
  console.log(`   Perfect Score: ${percentage === 100 ? "✅ Yes" : "❌ No"}`);

  // Test 2: Partial credit scenarios
  console.log("\n2. Testing Partial Credit Scenarios:");

  // Multiple choice with partial credit
  const partialMCQuestion = {
    question_type: "multiple_choice",
    points: 15,
    question_data: { correct_option_indices: [0, 1, 2] },
    correct_answer: [0, 1, 2],
  };

  const partialMCAnswer = { selected_option_indices: [0, 1] }; // Missing one correct answer

  const result = await QuizGrader.gradeQuestion(
    partialMCQuestion,
    partialMCAnswer
  );
  console.log(
    `   Multiple Choice Partial Credit: ${result.points_earned}/15 points (${result.feedback})`
  );

  // Test 3: Edge cases
  console.log("\n3. Testing Edge Cases:");

  // Empty answer
  const emptyAnswer = {};
  const tfQuestion = {
    question_type: "true_false",
    points: 5,
    question_data: { correct_answer: true },
    correct_answer: true,
  };

  try {
    const emptyResult = await QuizGrader.gradeQuestion(tfQuestion, emptyAnswer);
    console.log(
      `   Empty Answer Handling: ${emptyResult.points_earned}/5 points (${emptyResult.feedback})`
    );
  } catch (error) {
    console.log(`   Empty Answer Handling: Error caught - ${error.message}`);
  }

  // Test 4: Data type consistency
  console.log("\n4. Testing Data Type Consistency:");

  const testCases = [
    {
      name: "String boolean to boolean",
      question: {
        question_type: "true_false",
        points: 5,
        correct_answer: "true",
      },
      answer: { selected_answer: true },
      expected: true,
    },
    {
      name: "Number index to number",
      question: {
        question_type: "single_choice",
        points: 10,
        correct_answer: "1",
      },
      answer: { selected_option_index: 1 },
      expected: true,
    },
    {
      name: "Array strings to numbers",
      question: {
        question_type: "multiple_choice",
        points: 15,
        correct_answer: ["0", "2"],
      },
      answer: { selected_option_indices: [0, 2] },
      expected: true,
    },
  ];

  for (const testCase of testCases) {
    try {
      const result = await QuizGrader.gradeQuestion(
        testCase.question,
        testCase.answer
      );
      const passed = result.is_correct === testCase.expected;
      console.log(
        `   ${testCase.name}: ${passed ? "✅" : "❌"} (${
          result.points_earned
        }/${testCase.question.points})`
      );
    } catch (error) {
      console.log(`   ${testCase.name}: ❌ Error - ${error.message}`);
    }
  }

  // Test 5: Normalization consistency
  console.log("\n5. Testing Normalization Consistency:");

  const consistencyTests = [
    {
      type: "true_false",
      rawCorrect: true,
      normalizedCorrect: { selected_answer: true },
    },
    {
      type: "single_choice",
      rawCorrect: 1,
      normalizedCorrect: { selected_option_index: 1 },
    },
    {
      type: "multiple_choice",
      rawCorrect: [0, 2],
      normalizedCorrect: { selected_option_indices: [0, 2] },
    },
    {
      type: "numerical",
      rawCorrect: 42,
      normalizedCorrect: { answer: 42 },
    },
  ];

  for (const test of consistencyTests) {
    const mockQuestion = {
      question_type: test.type,
      points: 10,
      correct_answer: test.rawCorrect,
    };

    const normalized = AdvancedQuizGrader.normalizeCorrectAnswer(mockQuestion);
    const matches =
      JSON.stringify(normalized.data) ===
      JSON.stringify(test.normalizedCorrect);
    console.log(`   ${test.type} normalization: ${matches ? "✅" : "❌"}`);
  }

  console.log("\n🎉 Comprehensive Grading Tests Completed!");
}

testComprehensiveGrading().catch(console.error);

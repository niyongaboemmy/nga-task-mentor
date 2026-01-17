const { QuizGrader } = require("./server/src/utils/quizGrader");

// Test grading functionality
async function testGrading() {
  console.log("🧪 Testing Quiz Grading System\n");

  // Test single choice question
  console.log("1. Testing Single Choice Question:");
  const singleChoiceQuestion = {
    question_type: "single_choice",
    points: 10,
    question_data: {
      options: ["Option A", "Option B", "Option C"],
    },
    correct_answer: {
      correct_option_index: 1,
    },
  };

  // Correct answer
  let result = await QuizGrader.gradeQuestion(singleChoiceQuestion, {
    selected_option_index: 1,
  });
  console.log(
    `   Correct answer: ${result.is_correct ? "✅" : "❌"} (${
      result.points_earned
    }/${singleChoiceQuestion.points} points)`
  );

  // Wrong answer
  result = await QuizGrader.gradeQuestion(singleChoiceQuestion, {
    selected_option_index: 0,
  });
  console.log(
    `   Wrong answer: ${result.is_correct ? "✅" : "❌"} (${
      result.points_earned
    }/${singleChoiceQuestion.points} points)`
  );

  // Test multiple choice question
  console.log("\n2. Testing Multiple Choice Question:");
  const multipleChoiceQuestion = {
    question_type: "multiple_choice",
    points: 15,
    question_data: {
      options: ["Option A", "Option B", "Option C", "Option D"],
    },
    correct_answer: {
      correct_option_indices: [0, 2],
    },
  };

  // Correct answers
  result = await QuizGrader.gradeQuestion(multipleChoiceQuestion, {
    selected_option_indices: [0, 2],
  });
  console.log(
    `   All correct: ${result.is_correct ? "✅" : "❌"} (${
      result.points_earned
    }/${multipleChoiceQuestion.points} points)`
  );

  // Partial correct
  result = await QuizGrader.gradeQuestion(multipleChoiceQuestion, {
    selected_option_indices: [0],
  });
  console.log(
    `   Partial correct: ${result.is_correct ? "✅" : "❌"} (${
      result.points_earned
    }/${multipleChoiceQuestion.points} points)`
  );

  // Test true/false question
  console.log("\n3. Testing True/False Question:");
  const trueFalseQuestion = {
    question_type: "true_false",
    points: 5,
    question_data: {
      correct_answer: true,
    },
  };

  result = await QuizGrader.gradeQuestion(trueFalseQuestion, {
    selected_answer: true,
  });
  console.log(
    `   Correct answer: ${result.is_correct ? "✅" : "❌"} (${
      result.points_earned
    }/${trueFalseQuestion.points} points)`
  );

  result = await QuizGrader.gradeQuestion(trueFalseQuestion, {
    selected_answer: false,
  });
  console.log(
    `   Wrong answer: ${result.is_correct ? "✅" : "❌"} (${
      result.points_earned
    }/${trueFalseQuestion.points} points)`
  );

  // Test numerical question
  console.log("\n4. Testing Numerical Question:");
  const numericalQuestion = {
    question_type: "numerical",
    points: 10,
    question_data: {
      correct_answer: 42,
      tolerance: 2,
    },
  };

  result = await QuizGrader.gradeQuestion(numericalQuestion, { answer: 42 });
  console.log(
    `   Exact answer: ${result.is_correct ? "✅" : "❌"} (${
      result.points_earned
    }/${numericalQuestion.points} points)`
  );

  result = await QuizGrader.gradeQuestion(numericalQuestion, { answer: 44 });
  console.log(
    `   Within tolerance: ${result.is_correct ? "✅" : "❌"} (${
      result.points_earned
    }/${numericalQuestion.points} points)`
  );

  result = await QuizGrader.gradeQuestion(numericalQuestion, { answer: 50 });
  console.log(
    `   Outside tolerance: ${result.is_correct ? "✅" : "❌"} (${
      result.points_earned
    }/${numericalQuestion.points} points)`
  );

  console.log("\n🎉 Grading tests completed!");
}

testGrading().catch(console.error);

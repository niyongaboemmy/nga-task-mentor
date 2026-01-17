const { QuizGrader } = require("./dist/utils/quizGrader");

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
      correct_option_index: 1,
    },
    correct_answer: 1,
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
      correct_option_indices: [0, 2],
    },
    correct_answer: [0, 2],
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
    correct_answer: true,
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

  // Test quiz with single choice, multiple choice, and true/false questions (100% score)
  console.log(
    "\n5. Testing Quiz with Single Choice, Multiple Choice, and True/False Questions (100% Score):"
  );

  const quizQuestions = [
    {
      id: 1,
      question_type: "single_choice",
      points: 10,
      question_data: { options: ["A", "B", "C"] },
      correct_answer: 1,
    },
    {
      id: 2,
      question_type: "multiple_choice",
      points: 15,
      question_data: {
        options: ["Option A", "Option B", "Option C", "Option D"],
      },
      correct_answer: [0, 2],
    },
    {
      id: 3,
      question_type: "true_false",
      points: 5,
      question_data: {},
      correct_answer: true,
    },
  ];

  const correctAnswers = [
    { selected_option_index: 1 }, // single_choice
    { selected_option_indices: [0, 2] }, // multiple_choice
    { selected_answer: true }, // true_false
  ];

  let totalEarned = 0;
  let maxPossible = 0;
  let correctCount = 0;

  for (let i = 0; i < quizQuestions.length; i++) {
    const question = quizQuestions[i];
    const answer = correctAnswers[i];

    const result = await QuizGrader.gradeQuestion(question, answer);
    totalEarned += result.points_earned;
    maxPossible += question.points;

    if (result.is_correct) {
      correctCount++;
    }

    console.log(
      `   Question ${i + 1} (${question.question_type}): ${
        result.is_correct ? "✅" : "❌"
      } (${result.points_earned}/${question.points} points)`
    );
  }

  const percentage = maxPossible > 0 ? (totalEarned / maxPossible) * 100 : 0;
  const passed = percentage >= 60;

  console.log(`\n   📊 Quiz Results:`);
  console.log(`   Total Score: ${totalEarned}/${maxPossible} points`);
  console.log(`   Percentage: ${Math.round(percentage)}%`);
  console.log(`   Questions Correct: ${correctCount}/${quizQuestions.length}`);
  console.log(`   Passed: ${passed ? "✅ Yes" : "❌ No"}`);

  if (percentage === 100) {
    console.log(`   🎉 PERFECT SCORE! All answers correct!`);
  } else {
    console.log(`   ⚠️ Score is ${Math.round(percentage)}%, expected 100%`);
  }

  // Test grading with JSON strings (as stored in database)
  console.log("\n6. Testing Grading with JSON Strings (Database Format):");

  const jsonStringAnswer = JSON.stringify({ selected_option_index: 1 });
  const jsonResult = await QuizGrader.gradeQuestion(
    singleChoiceQuestion,
    jsonStringAnswer
  );
  console.log(
    `   JSON string answer: ${jsonResult.is_correct ? "✅" : "❌"} (${
      jsonResult.points_earned
    }/${singleChoiceQuestion.points} points)`
  );

  console.log("\n🎉 Grading tests completed!");
}

testGrading().catch(console.error);

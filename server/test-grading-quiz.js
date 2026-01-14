const mysql = require("mysql2/promise");
const { QuizGrader } = require("./dist/utils/quizGrader");

// Test the grading system with the created quiz
async function testGradingQuiz() {
  let connection;

  try {
    // Create connection using environment variables
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT) || 8889,
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASS || "root",
      database: process.env.DB_NAME || "taskmentor_dev",
    });

    console.log("✅ Database connected successfully");

    // Get the grading test quiz
    const [quizzes] = await connection.execute(
      "SELECT * FROM quizzes WHERE title = ? ORDER BY id DESC LIMIT 1",
      ["Grading System Test Quiz"]
    );

    if (quizzes.length === 0) {
      console.log(
        "❌ Grading test quiz not found. Please run create-grading-test-quiz.js first."
      );
      return;
    }

    const quiz = quizzes[0];
    console.log(`📊 Testing quiz: ${quiz.title} (ID: ${quiz.id})`);

    // Get all questions for this quiz
    const [questions] = await connection.execute(
      "SELECT * FROM quiz_questions WHERE quiz_id = ? ORDER BY `order`",
      [quiz.id]
    );

    console.log(`📝 Found ${questions.length} questions`);

    // Test answers for 100% score - ALL CORRECT ANSWERS
    const testAnswers = {
      1: { selected_option_index: 2 }, // Single choice - Paris (correct)
      2: { selected_option_indices: [0, 2] }, // Multiple choice - Python and JavaScript (correct)
      3: { selected_answer: false }, // True/False - False (correct)
      4: { answer: 42 }, // Numerical - 42 (correct)
      5: { answer: 78.54 }, // Numerical with tolerance - exact value (correct)
      6: { answers: [{ blank_index: 0, answer: "fox" }] }, // Fill blank - fox (correct)
      7: { matches: { 1: "1", 2: "2", 3: "3" } }, // Matching - all correct
      8: { ordered_item_ids: ["1", "2", "3", "4", "5"] }, // Ordering - correct order
      9: { selections: [{ dropdown_index: 0, selected_option: "<a>" }] }, // Dropdown - <a> (correct)
      10: { code: "function sum(a, b) {\n  return a + b;\n}" }, // Coding - correct function
      11: {
        answer:
          "Version control systems help with collaboration, maintain history of changes, provide backup, and enable branching for different features.",
      }, // Short answer with all keywords
    };

    let totalEarned = 0;
    let maxPossible = 0;
    let correctCount = 0;

    console.log("\n🧪 Testing individual question grading:");

    for (const question of questions) {
      const questionId = question.id;
      const answer = testAnswers[question.order];

      if (!answer) {
        console.log(`❌ No test answer found for question ${question.order}`);
        continue;
      }

      console.log(
        `\n${
          question.order
        }. ${question.question_type.toUpperCase()}: ${question.question_text.substring(
          0,
          50
        )}...`
      );

      try {
        const result = await QuizGrader.gradeQuestion(question, answer);
        totalEarned += parseFloat(String(result.points_earned));
        maxPossible += parseFloat(String(question.points));

        const isCorrect = result.is_correct;
        if (isCorrect) correctCount++;

        console.log(
          `   ✅ Result: ${isCorrect ? "CORRECT" : "INCORRECT"} - ${
            result.points_earned
          }/${question.points} points`
        );
        console.log(`   💬 Feedback: ${result.feedback}`);

        if (result.detailed_feedback) {
          if (result.detailed_feedback.testResults) {
            console.log(
              `   🧪 Test Results: ${result.detailed_feedback.passedTests}/${result.detailed_feedback.totalTests} tests passed`
            );
          }
        }
      } catch (error) {
        console.log(`   ❌ Error grading question: ${error.message}`);
      }
    }

    const percentage = maxPossible > 0 ? (totalEarned / maxPossible) * 100 : 0;
    const passed = percentage >= quiz.passing_score;

    console.log("\n📊 QUIZ RESULTS SUMMARY:");
    console.log("═".repeat(50));
    console.log(`Total Score: ${totalEarned}/${maxPossible} points`);
    console.log(`Percentage: ${Math.round(percentage * 100) / 100}%`);
    console.log(`Questions Correct: ${correctCount}/${questions.length}`);
    console.log(`Passing Score: ${quiz.passing_score}%`);
    console.log(`Status: ${passed ? "✅ PASSED" : "❌ FAILED"}`);

    if (percentage === 100) {
      console.log(
        "\n🎉 PERFECT SCORE! All grading functionality working correctly!"
      );
    } else if (percentage >= 80) {
      console.log("\n👍 Excellent! Grading system is working well.");
    } else {
      console.log("\n⚠️ Some issues detected. Check the grading logic.");
    }

    // Test partial credit scenarios
    console.log("\n🔄 Testing partial credit scenarios:");

    // Multiple choice with partial answers
    const partialMCQuestion = questions.find(
      (q) => q.question_type === "multiple_choice"
    );
    if (partialMCQuestion) {
      console.log("\nPartial Multiple Choice Test:");
      const partialAnswer = { selected_option_indices: [0] }; // Only Python, missing JavaScript
      const partialResult = await QuizGrader.gradeQuestion(
        partialMCQuestion,
        partialAnswer
      );
      console.log(
        `   Selected 1/2 correct options: ${partialResult.points_earned}/${partialMCQuestion.points} points`
      );
      console.log(`   Feedback: ${partialResult.feedback}`);
    }

    // Numerical with tolerance
    const toleranceQuestion = questions.find(
      (q) =>
        q.question_type === "numerical" &&
        JSON.parse(q.question_data).tolerance > 0
    );
    if (toleranceQuestion) {
      console.log("\nNumerical Tolerance Test:");
      const toleranceAnswer = { answer: 78.6 }; // Slightly outside tolerance
      const toleranceResult = await QuizGrader.gradeQuestion(
        toleranceQuestion,
        toleranceAnswer
      );
      console.log(
        `   Answer 78.6 (expected ~78.54 ±0.1): ${toleranceResult.points_earned}/${toleranceQuestion.points} points`
      );
      console.log(`   Feedback: ${toleranceResult.feedback}`);
    }
  } catch (error) {
    console.error("❌ Error testing grading quiz:", error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

testGradingQuiz();

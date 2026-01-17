const mysql = require("mysql2/promise");
const { QuizGrader } = require("./dist/utils/quizGrader");

// Test case that achieves 100% score
async function testPerfectGrading() {
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

    console.log("🎯 PERFECT GRADING TEST - 100% Score Achievement\n");
    console.log("✅ Database connected successfully");

    // Get the grading test quiz
    const [quizzes] = await connection.execute(
      "SELECT * FROM quizzes WHERE title = ? ORDER BY id DESC LIMIT 1",
      ["Grading System Test Quiz"]
    );

    if (quizzes.length === 0) {
      console.log("❌ Grading test quiz not found");
      return;
    }

    const quiz = quizzes[0];
    console.log(`📊 Quiz: ${quiz.title} (ID: ${quiz.id})`);

    // Get all questions
    const [questions] = await connection.execute(
      "SELECT * FROM quiz_questions WHERE quiz_id = ? ORDER BY `order`",
      [quiz.id]
    );

    console.log(`📝 Questions: ${questions.length}\n`);

    // PERFECT ANSWERS for 100% score
    const perfectAnswers = {
      1: { selected_option_index: 2 }, // Single choice - Paris
      2: { selected_option_indices: [0, 2] }, // Multiple choice - Python and JavaScript
      3: { selected_answer: false }, // True/False - False
      4: { answer: 42 }, // Numerical - 42
      5: { answer: 78.54 }, // Numerical with tolerance - exact value
      6: { answers: [{ blank_index: 0, answer: "fox" }] }, // Fill blank - fox
      7: { matches: { 1: "1", 2: "2", 3: "3" } }, // Matching - all correct
      8: { ordered_item_ids: ["1", "2", "3", "4", "5"] }, // Ordering - correct order
      9: { selections: [{ dropdown_index: 0, selected_option: "<a>" }] }, // Dropdown - <a>
      10: {
        code: `(() => {
  const [a, b] = input.split(',').map(Number);
  return a + b;
})()`,
      }, // Coding - JavaScript expression that parses and sums comma-separated numbers
      11: {
        answer:
          "Version control systems provide collaboration, maintain history of changes, serve as backup, and enable branching for different features.",
      }, // Short answer with all keywords
    };

    let totalEarned = 0;
    let maxPossible = 0;
    let correctCount = 0;
    const questionResults = [];

    console.log("🧪 TESTING PERFECT ANSWERS FOR 100% SCORE:\n");

    for (const question of questions) {
      const questionOrder = question.order;
      const answer = perfectAnswers[questionOrder];

      if (!answer) {
        console.log(
          `❌ No perfect answer defined for question ${questionOrder}`
        );
        continue;
      }

      console.log(
        `${questionOrder}. ${question.question_type.toUpperCase()}: ${question.question_text.substring(
          0,
          60
        )}...`
      );

      try {
        const result = await QuizGrader.gradeQuestion(question, answer);
        const pointsEarned = parseFloat(String(result.points_earned));
        const maxPoints = parseFloat(String(question.points));

        totalEarned += pointsEarned;
        maxPossible += maxPoints;

        const isCorrect = result.is_correct;
        if (isCorrect) correctCount++;

        questionResults.push({
          order: questionOrder,
          type: question.question_type,
          correct: isCorrect,
          points_earned: pointsEarned,
          max_points: maxPoints,
          feedback: result.feedback,
        });

        const status = isCorrect ? "✅ CORRECT" : "❌ INCORRECT";
        console.log(`   ${status} - ${pointsEarned}/${maxPoints} points`);
        console.log(`   💬 ${result.feedback}`);

        if (result.detailed_feedback && result.detailed_feedback.testResults) {
          console.log(
            `   🧪 Test Results: ${result.detailed_feedback.passedTests}/${result.detailed_feedback.totalTests} passed`
          );
        }

        console.log("");
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}\n`);
      }
    }

    const percentage = maxPossible > 0 ? (totalEarned / maxPossible) * 100 : 0;
    const passed = percentage >= quiz.passing_score;

    console.log("🎉 FINAL RESULTS - PERFECT SCORE TEST:");
    console.log("═".repeat(60));
    console.log(`Total Score: ${totalEarned}/${maxPossible} points`);
    console.log(`Percentage: ${Math.round(percentage * 100) / 100}%`);
    console.log(`Questions Correct: ${correctCount}/${questions.length}`);
    console.log(`Passing Score: ${quiz.passing_score}%`);
    console.log(`Status: ${passed ? "✅ PASSED" : "❌ FAILED"}`);

    console.log("\n📋 QUESTION-BY-QUESTION BREAKDOWN:");
    questionResults.forEach((result) => {
      const status = result.correct ? "✅" : "❌";
      console.log(
        `${result.order}. ${status} ${result.points_earned}/${result.max_points}pts - ${result.type}`
      );
    });

    if (percentage === 100) {
      console.log("\n🎯 SUCCESS! 100% SCORE ACHIEVED!");
      console.log("✅ All grading functionality working perfectly");
      console.log("✅ Quiz system ready for production use");
    } else {
      console.log(`\n⚠️ Score: ${percentage}% (Target: 100%)`);
      console.log("❌ Some issues remain - check failed questions");

      const failedQuestions = questionResults.filter((r) => !r.correct);
      console.log("\n❌ Failed Questions:");
      failedQuestions.forEach((q) => {
        console.log(`   Question ${q.order} (${q.type}): ${q.feedback}`);
      });
    }

    console.log("\n🔑 PERFECT ANSWER KEY (for API testing):");
    console.log(JSON.stringify(perfectAnswers, null, 2));
  } catch (error) {
    console.error("❌ Perfect grading test failed:", error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

testPerfectGrading();

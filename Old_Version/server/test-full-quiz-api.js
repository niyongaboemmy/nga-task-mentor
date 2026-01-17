const axios = require("axios");

// JWT token for authentication
const TOKEN =
  "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3NjQwNzQwNjYsImV4cCI6MTc2NjY2NjA2Nn0.67v6P_HRNC82CeTLatg2Rj4JNepDzhIPwV8nRAlQ1s0";

// API base URL
const API_BASE = "http://localhost:3000/api";

// Axios instance with auth header
const api = axios.create({
  baseURL: API_BASE,
  headers: {
    Authorization: TOKEN,
    "Content-Type": "application/json",
  },
});

async function testFullQuizAPI() {
  try {
    console.log("🚀 Starting full quiz API test for 100% score\n");

    // Step 1: Get available quizzes
    console.log("📋 Step 1: Getting available quizzes...");
    const quizzesResponse = await api.get("/quizzes");
    const gradingQuiz = quizzesResponse.data.data.find(
      (q) => q.title === "Grading System Test Quiz"
    );

    if (!gradingQuiz) {
      console.log("❌ Grading test quiz not found");
      return;
    }

    console.log(`✅ Found quiz: ${gradingQuiz.title} (ID: ${gradingQuiz.id})`);

    // Step 2: Start quiz attempt
    console.log("\n🎯 Step 2: Starting quiz attempt...");
    const startResponse = await api.post(`/quizzes/${gradingQuiz.id}/start`);
    const submissionId = startResponse.data.data.submission_id;

    console.log(`✅ Quiz attempt started. Submission ID: ${submissionId}`);

    // Step 3: Get quiz questions
    console.log("\n📝 Step 3: Getting quiz questions...");
    const questionsResponse = await api.get(`/quizzes/${gradingQuiz.id}`);
    const questions = questionsResponse.data.data.questions;

    console.log(`✅ Retrieved ${questions.length} questions`);

    // Step 4: Submit correct answers for all questions
    console.log("\n📤 Step 4: Submitting correct answers...");

    // Correct answers for 100% score
    const correctAnswers = {
      1: { selected_option_index: 2 }, // Single choice - Paris
      2: { selected_option_indices: [0, 2] }, // Multiple choice - Python and JavaScript
      3: { selected_answer: false }, // True/False - False
      4: { answer: 42 }, // Numerical - 42
      5: { answer: 78.54 }, // Numerical with tolerance - exact value
      6: { answers: [{ blank_index: 0, answer: "fox" }] }, // Fill blank - fox
      7: { matches: { 1: "1", 2: "2", 3: "3" } }, // Matching - all correct
      8: { ordered_item_ids: ["1", "2", "3", "4", "5"] }, // Ordering - correct order
      9: { selections: [{ dropdown_index: 0, selected_option: "<a>" }] }, // Dropdown - <a>
      10: { code: "function sum(a, b) {\n  return a + b;\n}" }, // Coding - correct function
      11: {
        answer:
          "Version control systems provide collaboration, maintain history of changes, serve as backup, and enable branching for different features.",
      }, // Short answer
    };

    for (const question of questions) {
      const answer = correctAnswers[question.order];
      if (!answer) {
        console.log(`❌ No answer defined for question ${question.order}`);
        continue;
      }

      try {
        const submitResponse = await api.post(
          `/attempts/${submissionId}/questions/${question.id}/answer`,
          { answer_data: answer }
        );

        console.log(
          `   ✅ Question ${question.order} (${question.question_type}): ${
            submitResponse.data.data.grading_result.is_correct
              ? "CORRECT"
              : "INCORRECT"
          }`
        );
      } catch (error) {
        console.log(
          `   ❌ Question ${question.order} failed: ${
            error.response?.data?.message || error.message
          }`
        );
      }
    }

    // Step 5: Submit the quiz
    console.log("\n🏁 Step 5: Submitting the quiz...");
    const submitResponse = await api.post(
      `/attempts/${submissionId}/submit-all`,
      {
        answers: questions.map((q) => ({
          question_id: q.id,
          answer_data: correctAnswers[q.order],
        })),
      }
    );

    console.log("✅ Quiz submitted successfully!");
    console.log(
      `📊 Final Score: ${submitResponse.data.data.final_score}/${submitResponse.data.data.max_score}`
    );
    console.log(`📊 Percentage: ${submitResponse.data.data.percentage}%`);
    console.log(
      `📊 Status: ${submitResponse.data.data.passed ? "PASSED" : "FAILED"}`
    );

    // Step 6: Get results
    console.log("\n📊 Step 6: Getting quiz results...");
    const resultsResponse = await api.get(`/attempts/${submissionId}/results`);

    console.log("\n🎉 QUIZ RESULTS SUMMARY:");
    console.log("═".repeat(50));
    console.log(`Quiz Title: ${resultsResponse.data.data.quiz_title}`);
    console.log(
      `Final Score: ${resultsResponse.data.data.final_score}/${resultsResponse.data.data.max_score}`
    );
    console.log(`Percentage: ${resultsResponse.data.data.percentage}%`);
    console.log(
      `Status: ${resultsResponse.data.data.passed ? "✅ PASSED" : "❌ FAILED"}`
    );
    console.log(`Grade Status: ${resultsResponse.data.data.grade_status}`);

    console.log("\n📝 Individual Question Results:");
    resultsResponse.data.data.attempts.forEach((attempt, index) => {
      console.log(
        `${index + 1}. ${attempt.is_correct ? "✅" : "❌"} ${
          attempt.points_earned
        } points - ${attempt.question_type}`
      );
    });

    if (resultsResponse.data.data.percentage === 100) {
      console.log("\n🎉 PERFECT SCORE! 100% achieved successfully!");
    } else {
      console.log(
        `\n⚠️ Score: ${resultsResponse.data.data.percentage}% (Expected: 100%)`
      );
    }
  } catch (error) {
    console.error("❌ API test failed:", error.response?.data || error.message);
  }
}

testFullQuizAPI();

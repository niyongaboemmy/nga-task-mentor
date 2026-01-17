const axios = require("axios");

// JWT token for authentication
const TOKEN =
  "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3NjQwNzQwNjYsImV4cCI6MTc2NjY2NjA2Nn0.67v6P_HRNC82CeTLatg2Rj4JNepDzhIPwV8nRAlQ1s0";

// API base URL
const API_BASE = "http://localhost:5001/api";

// Axios instance with auth header
const api = axios.create({
  baseURL: API_BASE,
  headers: {
    Authorization: TOKEN,
    "Content-Type": "application/json",
  },
});

async function testQuiz14API() {
  try {
    console.log("🧪 Testing GET /api/quizzes/14 endpoint\n");

    // Test GET /api/quizzes/14
    console.log("📋 Making GET request to /api/quizzes/14...");
    const response = await api.get("/quizzes/14");

    console.log("✅ Request successful!");
    console.log(`Status: ${response.status}`);
    console.log(`Response keys: ${Object.keys(response.data).join(", ")}`);

    if (response.data.success && response.data.data) {
      const quizData = response.data.data;
      console.log(`\n📊 Quiz Info:`);
      console.log(`Title: ${quizData.title}`);
      console.log(`ID: ${quizData.id}`);
      console.log(`Status: ${quizData.status}`);

      // Check if this quiz has been completed by the student
      if (quizData.questions && quizData.questions.length > 0) {
        const firstQuestion = quizData.questions[0];
        console.log(`\n📝 First Question Info:`);
        console.log(
          `Question: ${firstQuestion.question_text?.substring(0, 50)}...`
        );
        console.log(`Type: ${firstQuestion.question_type}`);
        console.log(`Points: ${firstQuestion.points}`);

        // Check if there are attempts (student has answered)
        if (firstQuestion.attempts && firstQuestion.attempts.length > 0) {
          const attempt = firstQuestion.attempts[0];
          console.log(`\n🎯 Attempt Info:`);
          console.log(`Is Correct: ${attempt.is_correct}`);
          console.log(`Points Earned: ${attempt.points_earned}`);
          console.log(
            `Submitted Answer: ${JSON.stringify(attempt.submitted_answer)}`
          );
          console.log(
            `Correct Answer: ${JSON.stringify(
              attempt.question?.correct_answer
            )}`
          );

          if (attempt.question?.correct_answer) {
            console.log(`✅ SUCCESS: correct_answer is NOT null!`);
          } else {
            console.log(`❌ ISSUE: correct_answer is still null`);
          }
        } else {
          console.log(
            `\n📝 No attempts found - student hasn't answered this question yet`
          );
        }
      }

      // Check if there's a quiz_completed flag (student has completed the quiz)
      if (quizData.quiz_completed) {
        console.log(`\n🏆 Quiz Completed!`);
        console.log(
          `Final Score: ${quizData.final_score}/${quizData.max_score}`
        );
        console.log(`Percentage: ${quizData.percentage}%`);
        console.log(`Passed: ${quizData.passed}`);

        if (quizData.results && quizData.results.length > 0) {
          console.log(`\n📊 Results Array:`);
          const firstResult = quizData.results[0];
          console.log(`Question ID: ${firstResult.question_id}`);
          console.log(
            `User Answer: ${JSON.stringify(firstResult.user_answer)}`
          );
          console.log(
            `Correct Answer: ${JSON.stringify(firstResult.correct_answer)}`
          );
          console.log(`Is Correct: ${firstResult.is_correct}`);
          console.log(`Points Earned: ${firstResult.points_earned}`);

          if (firstResult.correct_answer) {
            console.log(`✅ SUCCESS: correct_answer in results is NOT null!`);
          } else {
            console.log(`❌ ISSUE: correct_answer in results is still null`);
          }
        }
      }
    } else {
      console.log("❌ Response does not have expected structure");
      console.log("Response:", JSON.stringify(response.data, null, 2));
    }
  } catch (error) {
    console.error("❌ API test failed:");
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Data:`, error.response.data);
    } else {
      console.error(`Error:`, error.message);
    }
  }
}

testQuiz14API();

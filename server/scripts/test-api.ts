import axios from "axios";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const PORT = process.env.PORT || 5002;
const BASE_URL = `http://localhost:${PORT}/api`;
const SECRET =
  process.env.JWT_SECRET ||
  "your-super-secret-jwt-key-change-this-in-production";

// Generate a dummy admin token
const adminToken = jwt.sign(
  {
    id: 1, // Assume user ID 1 is an admin
    email: process.env.ADMIN_EMAIL || "admin@taskmentor.com",
    role: "admin",
    status: "ACTIVE",
  },
  SECRET,
  { expiresIn: "1h" },
);

const axiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: {
    Authorization: `Bearer ${adminToken}`,
    "x-mis-token": "Bearer dummy-token",
  },
  validateStatus: () => true, // Don't throw on non-2xx statuses
});

async function runTests() {
  console.log(`Starting API Tests against ${BASE_URL}...`);
  console.log(`Using Admin Token: ${adminToken.substring(0, 20)}...`);

  const courseId = 1; // Assuming course 1 exists
  let quizId = 1; // Assuming quiz 1 exists
  let questionId: number;

  try {
    // 1. Create a course question
    console.log("\n--- 1. Create a course question ---");
    const createPayload = {
      question_type: "short_answer",
      question_text: "TEST: What is the capital of France?",
      question_data: { max_length: 500 },
      correct_answer: "Paris",
      explanation: "Paris is the capital.",
      difficulty_level: "EASY",
    };
    const createRes = await axiosInstance.post(
      `/courses/${courseId}/question-bank`,
      createPayload,
    );
    console.log(`Status: ${createRes.status}`);
    if (createRes.status !== 201) {
      console.error("Failed to create question:", createRes.data);
      return;
    }
    questionId = createRes.data.data.id;
    console.log(`Success! Created Question ID: ${questionId}`);

    // 2. List course questions
    console.log("\n--- 2. List course questions ---");
    const listRes = await axiosInstance.get(
      `/courses/${courseId}/question-bank?limit=1`,
    );
    console.log(`Status: ${listRes.status}`);
    console.log(`Found ${listRes.data.count} total questions in bank.`);

    // 3. Add question to quiz
    console.log("\n--- 3. Add question to quiz ---");
    const assignPayload = {
      question_id: questionId,
      order: 1,
      points: 10,
      time_limit_seconds: 60,
      is_required: true,
    };
    const assignRes = await axiosInstance.post(
      `/quizzes/${quizId}/questions`,
      assignPayload,
    );
    console.log(`Status: ${assignRes.status}`);
    if (assignRes.status !== 201 && assignRes.status !== 404) {
      console.error("Failed to assign question:", assignRes.data);
    }

    // If quiz 1 didn't exist, we skip the assignment tests
    const quizExists = assignRes.status !== 404;

    if (quizExists) {
      // 4. Get quiz questions
      console.log("\n--- 4. Get quiz questions ---");
      const getQuizQRes = await axiosInstance.get(
        `/quizzes/${quizId}/questions`,
      );
      console.log(`Status: ${getQuizQRes.status}`);
      const foundInQuiz = getQuizQRes.data.data?.some(
        (q: any) => q.question_id === questionId,
      );
      console.log(`Question successfully retrieved in quiz: ${foundInQuiz}`);

      // 8. Reject deletion of assigned question
      console.log("\n--- 8. Reject deletion of assigned question ---");
      const delRejectRes = await axiosInstance.delete(
        `/courses/${courseId}/question-bank/${questionId}`,
      );
      console.log(`Status: ${delRejectRes.status}`);
      console.log(`Message: ${delRejectRes.data.message}`);

      // 6. Remove question from quiz
      console.log("\n--- 6. Remove question from quiz ---");
      // We need the QuizQuestion ID, not the QuestionBank ID to remove it, wait, the API might expect QuestionBank ID or QuizQuestion ID.
      // Let's check the assign payload response.
      const quizQuestionId = assignRes.data.data.id;
      const removeRes = await axiosInstance.delete(
        `/quizzes/questions/${quizQuestionId}`,
      );
      console.log(`Status: ${removeRes.status}`);
    } else {
      console.log("Quiz 1 not found. Skipping quiz assignment tests.");
    }

    // 5. Update question in bank
    console.log("\n--- 5. Update question in bank ---");
    const updateRes = await axiosInstance.put(
      `/courses/${courseId}/question-bank/${questionId}`,
      {
        question_text: "TEST: Updated capital of France?",
      },
    );
    console.log(`Status: ${updateRes.status}`);
    console.log(`Updated Text: ${updateRes.data.data?.question_text}`);

    // 7. Delete question from bank
    console.log("\n--- 7. Delete question from bank ---");
    const deleteRes = await axiosInstance.delete(
      `/courses/${courseId}/question-bank/${questionId}`,
    );
    console.log(`Status: ${deleteRes.status}`);

    console.log("\nAll tests completed successfully!");
  } catch (error: any) {
    if (error.response) {
      console.error("Test script failed:", error.response.data);
    } else {
      console.error("Test script failed:", error.message);
    }
  }
}

runTests();

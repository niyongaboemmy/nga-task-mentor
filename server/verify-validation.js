require("dotenv").config();
const axios = require("axios");

const API_URL = process.env.API_URL || "http://localhost:5001/api";
const TOKEN = process.env.TEST_TOKEN; // Ensure you have a valid token in .env

async function testValidation() {
  if (!TOKEN) {
    console.error("TEST_TOKEN is required in .env");
    return;
  }

  const client = axios.create({
    baseURL: API_URL,
    headers: { Authorization: `Bearer ${TOKEN}` },
  });

  console.log("--- Testing Create Assignment Validation ---");

  const testCases = [
    {
      name: "Missing Title",
      data: {
        description: "Test",
        due_date: "2026-12-31T12:00",
        max_score: 100,
      },
      expectedError: "Assignment title is required",
    },
    {
      name: "Past Due Date",
      data: {
        title: "Past Date",
        description: "Test",
        due_date: "2020-01-01T12:00",
        max_score: 100,
      },
      expectedError: "Due date must be in the future",
    },
    {
      name: "Non-positive Max Score",
      data: {
        title: "Bad Score",
        description: "Test",
        due_date: "2026-12-31T12:00",
        max_score: 0,
      },
      expectedError: "A positive maximum score is required",
    },
    {
      name: "Rubric Total Exceeds Max Score",
      data: {
        title: "Bad Rubric",
        description: "Test",
        due_date: "2026-12-31T12:00",
        max_score: 50,
        rubric: JSON.stringify([{ criteria: "Crit 1", max_score: 100 }]),
      },
      expectedError: "Sum of rubric scores",
    },
  ];

  for (const tc of testCases) {
    try {
      // Assuming course_id 1 exists for testing
      await client.post("/courses/1/assignments", tc.data);
      console.log(
        `❌ Test "${tc.name}" failed: Expected error but got success`,
      );
    } catch (error) {
      const message = error.response?.data?.message || "";
      if (message.includes(tc.expectedError)) {
        console.log(
          `✅ Test "${tc.name}" passed: Got expected error "${message}"`,
        );
      } else {
        console.log(
          `❌ Test "${tc.name}" failed: Got different error "${message}" (Expected: "${tc.expectedError}")`,
        );
      }
    }
  }
}

testValidation();

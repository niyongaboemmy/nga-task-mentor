import axios from "axios";

const BASE_URL = "http://localhost:5001";

// Test the proctoring settings endpoint
async function testProctoringEndpoint() {
  console.log("🧪 Testing Proctoring Settings Endpoint\n");

  try {
    // Test without authentication (should fail with 401)
    console.log("Testing without authentication:");
    const response = await axios.get(
      `${BASE_URL}/api/proctoring/quizzes/9/proctoring-settings`
    );
    console.log(`✅ Status: ${response.status}`);
    console.log(`Response: ${JSON.stringify(response.data)}`);
  } catch (error) {
    console.log(`❌ Status: ${error.response?.status || "Unknown"}`);
    console.log(`Error: ${error.response?.data?.message || error.message}`);
  }

  console.log("\n---\n");

  // Test with test token (admin)
  try {
    console.log("Testing with admin token:");
    const response = await axios.get(
      `${BASE_URL}/api/proctoring/quizzes/9/proctoring-settings`,
      {
        headers: {
          Authorization: "Bearer test-token",
        },
      }
    );
    console.log(`✅ Status: ${response.status}`);
    console.log(`Response: ${JSON.stringify(response.data)}`);
  } catch (error) {
    console.log(`❌ Status: ${error.response?.status || "Unknown"}`);
    console.log(`Error: ${error.response?.data?.message || error.message}`);
  }

  console.log("\n---\n");

  // Test with instructor token
  try {
    console.log("Testing with instructor token:");
    const response = await axios.get(
      `${BASE_URL}/api/proctoring/quizzes/9/proctoring-settings`,
      {
        headers: {
          Authorization: "Bearer instructor-token",
        },
      }
    );
    console.log(`✅ Status: ${response.status}`);
    console.log(`Response: ${JSON.stringify(response.data)}`);
  } catch (error) {
    console.log(`❌ Status: ${error.response?.status || "Unknown"}`);
    console.log(`Error: ${error.response?.data?.message || error.message}`);
  }

  console.log("\n---\n");

  // Test with student token (should fail with 403)
  try {
    console.log("Testing with student token:");
    const response = await axios.get(
      `${BASE_URL}/api/proctoring/quizzes/9/proctoring-settings`,
      {
        headers: {
          Authorization: "Bearer student-token",
        },
      }
    );
    console.log(`✅ Status: ${response.status}`);
    console.log(`Response: ${JSON.stringify(response.data)}`);
  } catch (error) {
    console.log(`❌ Status: ${error.response?.status || "Unknown"}`);
    console.log(`Error: ${error.response?.data?.message || error.message}`);
  }
}

testProctoringEndpoint().catch(console.error);

import axios from 'axios';

// Test the grading endpoint
async function testGradingEndpoint() {
  const BASE_URL = 'http://localhost:5000';

  console.log('🧪 Testing Submission Grading Endpoint\n');

  // Test data - replace with actual submission ID
  const submissionId = '1';
  const gradeData = {
    score: 85,
    feedback: 'Great work! Well structured and comprehensive.',
    // maxScore is now optional - will be retrieved from assignment if not provided
    // maxScore: 100, // Optional - gets from assignment.max_score
  };

  try {
    console.log('📤 Testing PATCH /api/submissions/1/grade');
    console.log('Request body:', JSON.stringify(gradeData, null, 2));

    const response = await axios.patch(
      `${BASE_URL}/api/submissions/${submissionId}/grade`,
      gradeData,
      {
        headers: {
          'Content-Type': 'application/json',
          // Add authentication headers here when testing
          // 'Authorization': 'Bearer your-jwt-token'
        },
        timeout: 5000
      }
    );

    console.log('✅ Success!');
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.log('❌ Failed!');

    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Error:', error.response.data?.message || 'Unknown error');
    } else if (error.code === 'ECONNREFUSED') {
      console.log('Error: Server not running on', BASE_URL);
      console.log('💡 Make sure to start the server first: npm run dev');
    } else {
      console.log('Error:', error.message);
    }
  }
}

// Expected API behavior:
// 1. Only instructors/admins can grade submissions
// 2. Grade is stored as string in format "score/maxScore" (e.g., "85/100")
// 3. Status is updated to 'graded'
// 4. Feedback is also stored
// 5. Returns the updated submission with new grade

console.log('Expected behavior:');
console.log('- Only instructors/admins can access this endpoint');
console.log('- Grade stored as string: "85/100"');
console.log('- Status updated to "graded"');
console.log('- Feedback stored separately');
console.log('- Returns updated submission data\n');

testGradingEndpoint().catch(console.error);

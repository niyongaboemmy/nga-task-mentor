import axios from 'axios';

const BASE_URL = 'http://localhost:5001';

async function testEndpoints() {
  console.log('🧪 Testing TaskMentor Backend Endpoints\n');

  const endpoints = [
    // Health check
    { method: 'GET', path: '/health', description: 'Health check' },

    // Auth endpoints
    { method: 'POST', path: '/api/auth/register', description: 'User registration' },
    { method: 'POST', path: '/api/auth/login', description: 'User login' },

    // Course endpoints (public)
    { method: 'GET', path: '/api/courses', description: 'Get all courses (public)' },
    { method: 'GET', path: '/api/courses/1', description: 'Get course by ID (public)' },

    // Assignment endpoints (public)
    { method: 'GET', path: '/api/assignments', description: 'Get all assignments (public)' },
    { method: 'GET', path: '/api/assignments/1', description: 'Get assignment by ID (public)' },

    // Dashboard endpoints (protected)
    { method: 'GET', path: '/api/dashboard/instructor/stats', description: 'Instructor dashboard stats' },
    { method: 'GET', path: '/api/dashboard/instructor/courses', description: 'Instructor courses overview' },
    { method: 'GET', path: '/api/dashboard/instructor/pending-grading', description: 'Instructor pending grading' },
    { method: 'GET', path: '/api/dashboard/student/stats', description: 'Student dashboard stats' },
    { method: 'GET', path: '/api/dashboard/activity', description: 'Recent activity' },
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await axios({
        method: endpoint.method,
        url: `${BASE_URL}${endpoint.path}`,
        timeout: 5000
      });

      console.log(`✅ ${endpoint.method} ${endpoint.path}`);
      console.log(`   ${endpoint.description}`);
      console.log(`   Status: ${response.status}`);
      if (response.data) {
        console.log(`   Response: ${JSON.stringify(response.data).substring(0, 100)}...`);
      }
      console.log('');
    } catch (error) {
      console.log(`❌ ${endpoint.method} ${endpoint.path}`);
      console.log(`   ${endpoint.description}`);
      if (error.response) {
        console.log(`   Status: ${error.response.status}`);
        console.log(`   Error: ${error.response.data?.message || 'Unknown error'}`);
      } else if (error.code === 'ECONNREFUSED') {
        console.log(`   Error: Connection refused - Server not running`);
      } else {
        console.log(`   Error: ${error.message}`);
      }
      console.log('');
    }
  }
}

testEndpoints().catch(console.error);

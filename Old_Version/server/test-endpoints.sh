#!/bin/bash

BASE_URL="http://localhost:5001"
echo "🧪 Testing TaskMentor Backend Endpoints"
echo "=================================="

# Test health endpoint
echo ""
echo "Testing health endpoint..."
curl -s -w "\nStatus: %{http_code}\n" "$BASE_URL/health" || echo "❌ Health check failed"

# Test public course endpoints
echo ""
echo "Testing public course endpoints..."
curl -s -w "\nStatus: %{http_code}\n" "$BASE_URL/api/courses" || echo "❌ Get courses failed"
curl -s -w "\nStatus: %{http_code}\n" "$BASE_URL/api/courses/1" || echo "❌ Get course by ID failed"

# Test public assignment endpoints
echo ""
echo "Testing public assignment endpoints..."
curl -s -w "\nStatus: %{http_code}\n" "$BASE_URL/api/assignments" || echo "❌ Get assignments failed"
curl -s -w "\nStatus: %{http_code}\n" "$BASE_URL/api/assignments/1" || echo "❌ Get assignment by ID failed"

# Test auth endpoints (should fail without credentials)
echo ""
echo "Testing auth endpoints (should require authentication)..."
curl -s -w "\nStatus: %{http_code}\n" -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123"}' || echo "❌ Login failed"

# Test protected endpoints (should fail without authentication)
echo ""
echo "Testing protected endpoints (should require authentication)..."
curl -s -w "\nStatus: %{http_code}\n" "$BASE_URL/api/users" || echo "❌ Get users failed"
curl -s -w "\nStatus: %{http_code}\n" -X POST "$BASE_URL/api/courses" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Course"}' || echo "❌ Create course failed"

echo ""
echo "✅ Endpoint testing completed!"
echo ""
echo "📋 Summary:"
echo "   - Health check: Test basic server connectivity"
echo "   - Public endpoints: Should return data without authentication"
echo "   - Auth endpoints: Should return 401/403 without proper credentials"
echo "   - Protected endpoints: Should return 401/403 without authentication"
echo ""
echo "🔧 If endpoints return unexpected status codes, check:"
echo "   - Server is running on port 5001"
echo "   - Database connection is working"
echo "   - Authentication middleware is properly configured"

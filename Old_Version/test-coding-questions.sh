#!/bin/bash

# Comprehensive Coding Question Implementation Test Script
# This script tests the complete coding question workflow including
# creation, submission, grading, and result verification

echo "=== Comprehensive Coding Question Test Suite ==="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counter
TESTS_RUN=0
TESTS_PASSED=0

run_test() {
    local test_name="$1"
    local test_cmd="$2"

    echo -e "${BLUE}Running: ${test_name}${NC}"
    TESTS_RUN=$((TESTS_RUN + 1))

    if eval "$test_cmd"; then
        echo -e "${GREEN}✓ PASSED${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗ FAILED${NC}"
    fi
    echo ""
}

echo "1. Testing Backend Implementation Status:"
echo "   ================================="

# Check if QuizGrader has gradeCoding method
run_test "QuizGrader gradeCoding method exists" "
    grep -q 'gradeCoding' spwms/server/src/utils/quizGrader.ts
"

# Check if quiz controller handles coding questions properly
run_test "Quiz controller handles coding submissions" "
    grep -q 'coding.*grade' spwms/server/src/controllers/quiz.controller.ts
"

# Check TypeScript types
run_test "CodingData interface exists" "
    grep -q 'interface CodingData' spwms/server/src/types/quiz.types.ts
"

# Check CodingAnswer interface
run_test "CodingAnswer interface exists" "
    grep -q 'interface CodingAnswer' spwms/server/src/types/quiz.types.ts
"

echo "2. Testing Frontend Implementation Status:"
echo "   ================================="

# Check CodingQuestion component
run_test "CodingQuestion component exists" "
    [ -f 'spwms/client/src/components/Quizzes/QuestionTypes/CodingQuestion.tsx' ]
"

# Check CodeEditor component
run_test "CodeEditor component exists" "
    [ -f 'spwms/client/src/components/Quizzes/CodeEditor.tsx' ]
"

# Check CodingQuestionForm
run_test "CodingQuestionForm exists" "
    [ -f 'spwms/client/src/components/Quizzes/QuestionForms/CodingQuestionForm.tsx' ]
"

# Check AI Test Case Generator
run_test "AITestCaseGenerator exists" "
    [ -f 'spwms/client/src/components/Quizzes/AITestCaseGenerator.tsx' ]
"

echo "3. Testing Current Functionality:"
echo "   ==============================="

# Test if server can start (basic compilation check)
run_test "Server TypeScript compilation" "
    cd spwms/server && npm run build > /dev/null 2>&1
"

# Test if client can build
run_test "Client TypeScript compilation" "
    cd spwms/client && npm run build > /dev/null 2>&1
"

echo "4. Testing API Endpoints (Mock Tests):"
echo "   ================================="

# Create a sample coding question payload
CODING_QUESTION_PAYLOAD='{
  "question_type": "coding",
  "question_text": "Write a function to calculate the sum of two numbers",
  "question_data": {
    "language": "javascript",
    "starter_code": "function sum(a, b) {\n  // Your code here\n}",
    "test_cases": [
      {
        "id": "test1",
        "input": "sum(2, 3)",
        "expected_output": "5",
        "is_hidden": false,
        "points": 10
      },
      {
        "id": "test2",
        "input": "sum(10, 20)",
        "expected_output": "30",
        "is_hidden": false,
        "points": 15
      }
    ],
    "constraints": "Function must return a number"
  },
  "points": 25,
  "order": 1,
  "is_required": true
}'

# Test question creation payload validation
run_test "Coding question payload structure" "
    echo '$CODING_QUESTION_PAYLOAD' | jq -e '.question_type == \"coding\"' > /dev/null
"

# Test coding answer payload
CODING_ANSWER_PAYLOAD='{
  "code": "function sum(a, b) {\n  return a + b;\n}",
  "language": "javascript"
}'

run_test "Coding answer payload structure" "
    echo '$CODING_ANSWER_PAYLOAD' | jq -e '.code' > /dev/null
"

echo "5. Testing Grading Logic (Current State):"
echo "   ================================="

# Test current grading behavior (should fail for coding questions)
run_test "Current grading falls back to manual" "
    grep -A 5 -B 5 'default:' spwms/server/src/utils/quizGrader.ts | grep -q 'Manual grading required'
"

echo "6. Testing Frontend Test Execution (Simulation):"
echo "   ================================="

# Check if frontend has test execution logic
run_test "Frontend has test execution simulation" "
    grep -q 'executeCode' spwms/client/src/components/Quizzes/QuestionTypes/CodingQuestion.tsx
"

# Check if test execution uses Function constructor (unsafe)
run_test "Frontend uses Function constructor for execution" "
    grep -q 'new Function' spwms/client/src/components/Quizzes/QuestionTypes/CodingQuestion.tsx
"

echo "7. Required Implementation Status:"
echo "   ==============================="

echo -e "${YELLOW}❌ CRITICAL ISSUES:${NC}"
echo "   - QuizGrader.gradeCoding method missing"
echo "   - No actual test case execution in backend"
echo "   - Frontend test execution is unsafe and limited"
echo "   - No multi-language support"
echo "   - No timeout/resource limits"
echo ""

echo -e "${BLUE}📋 IMPLEMENTATION CHECKLIST:${NC}"
echo "   ☐ Add gradeCoding method to QuizGrader"
echo "   ☐ Implement safe test case execution"
echo "   ☐ Add multi-language support"
echo "   ☐ Update quiz controller for coding submissions"
echo "   ☐ Add security measures"
echo "   ☐ Implement proper scoring based on test results"
echo ""

echo "8. Test Results Summary:"
echo "   ====================="

echo "Tests Run: $TESTS_RUN"
echo "Tests Passed: $TESTS_PASSED"
echo "Tests Failed: $((TESTS_RUN - TESTS_PASSED))"

if [ $TESTS_PASSED -eq $TESTS_RUN ]; then
    echo -e "${GREEN}🎉 All basic checks passed!${NC}"
else
    echo -e "${RED}⚠️  Some issues found. Implementation needed.${NC}"
fi

echo ""
echo "=== Next Steps ==="
echo "1. Implement gradeCoding method in QuizGrader"
echo "2. Add safe test execution service"
echo "3. Update quiz controller submission handling"
echo "4. Add comprehensive integration tests"
echo "5. Test end-to-end workflow"
echo ""

echo "📚 Documentation:"
echo "See CODING_QUESTION_ENHANCEMENTS.md for detailed requirements"
echo "See QUIZ_MIGRATION_README.md for database setup"
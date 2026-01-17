#!/usr/bin/env node

// Comprehensive Coding Question Integration Test
// Tests the complete coding question workflow from creation to grading

const { QuizGrader } = require("./server/dist/utils/quizGrader");
const { CodeExecutor } = require("./server/dist/utils/codeExecutor");

console.log("=== Coding Question Integration Test ===\n");

// Mock question data
const mockCodingQuestion = {
  id: 1,
  question_type: "coding",
  question_text: "Write a function to calculate the sum of two numbers",
  points: 25,
  question_data: {
    language: "javascript",
    starter_code: "function sum(a, b) {\n  // Your code here\n}",
    test_cases: [
      {
        id: "test1",
        input: "sum(2, 3)",
        expected_output: "5",
        is_hidden: false,
        points: 10,
      },
      {
        id: "test2",
        input: "sum(10, 20)",
        expected_output: "30",
        is_hidden: false,
        points: 15,
      },
      {
        id: "test3",
        input: "sum(-5, 10)",
        expected_output: "5",
        is_hidden: true,
        points: 0,
      },
    ],
    constraints: "Function must return a number",
    time_limit: 5,
    memory_limit: 256,
  },
};

// Test cases
const testCases = [
  {
    name: "Correct Solution",
    code: "function sum(a, b) {\n  return a + b;\n}",
    expectedPassed: 3,
    expectedPoints: 25,
  },
  {
    name: "Partially Correct Solution",
    code: "function sum(a, b) {\n  return a * b;\n}",
    expectedPassed: 0,
    expectedPoints: 0,
  },
  {
    name: "Wrong Function Name",
    code: "function add(a, b) {\n  return a + b;\n}",
    expectedPassed: 0,
    expectedPoints: 0,
  },
  {
    name: "Syntax Error",
    code: "function sum(a, b) {\n  return a + b\n", // Missing semicolon
    expectedPassed: 0,
    expectedPoints: 0,
  },
  {
    name: "Empty Code",
    code: "",
    expectedPassed: 0,
    expectedPoints: 0,
  },
];

async function runTest(testCase) {
  console.log(`Testing: ${testCase.name}`);

  const answerData = {
    code: testCase.code,
    language: "javascript",
  };

  try {
    const result = await QuizGrader.gradeQuestion(
      mockCodingQuestion,
      answerData
    );

    console.log(`  Result: ${result.is_correct ? "PASS" : "FAIL"}`);
    console.log(
      `  Points: ${result.points_earned}/${mockCodingQuestion.points}`
    );
    console.log(`  Feedback: ${result.feedback}`);

    if (result.detailed_feedback) {
      const { passedTests, totalTests } = result.detailed_feedback;
      console.log(`  Test Results: ${passedTests}/${totalTests} passed`);

      // Check expectations
      const passed =
        passedTests === testCase.expectedPassed &&
        result.points_earned === testCase.expectedPoints;

      console.log(
        `  Expected: ${testCase.expectedPassed} passed, ${testCase.expectedPoints} points`
      );
      console.log(`  ${passed ? "✅ CORRECT" : "❌ INCORRECT"}`);
    }
  } catch (error) {
    console.log(`  ❌ ERROR: ${error.message}`);
  }

  console.log("");
}

async function runAllTests() {
  console.log("Running integration tests...\n");

  for (const testCase of testCases) {
    await runTest(testCase);
  }

  console.log("=== CodeExecutor Direct Test ===\n");

  // Test CodeExecutor directly
  const executorTest = {
    language: "javascript",
    code: "function sum(a, b) { return a + b; }",
    testCases: [
      {
        id: "exec_test1",
        input: "sum(2, 3)",
        expected_output: "5",
        is_hidden: false,
        points: 10,
      },
    ],
  };

  try {
    console.log("Testing CodeExecutor directly...");
    const results = await CodeExecutor.executeTests(executorTest);

    console.log("Execution Results:");
    results.forEach((result) => {
      console.log(
        `  Test ${result.testCaseId}: ${result.passed ? "PASS" : "FAIL"}`
      );
      if (result.output) console.log(`    Output: ${result.output}`);
      if (result.error) console.log(`    Error: ${result.error}`);
      console.log(`    Time: ${result.executionTime}ms`);
    });
  } catch (error) {
    console.log(`CodeExecutor test failed: ${error.message}`);
  }

  console.log("\n=== Test Summary ===");
  console.log("Integration tests completed.");
  console.log("Check the output above for detailed results.");
}

// Run tests if this script is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { runAllTests };

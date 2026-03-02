// Test script to reproduce the logical expression grading issue

// Copy the grading functions from quizGrader.ts
function normalize(expr) {
  return expr
    .replace(/\s+/g, "")
    .toLowerCase()
    .replace(/\u00ac/g, "!") // ¬
    .replace(/\u2227/g, "&&") // ∧
    .replace(/\u2228/g, "||") // ∨
    .replace(/\u2192/g, "->") // →
    .replace(/\u2194/g, "<->"); // ↔
}

function toJsBooleanExpr(expr) {
  let e = expr;
  // Handle HTML-encoded operators FIRST (before normalize)
  e = e.replace(/&&/g, " && ");
  e = e.replace(/&\|\|/g, " || ");
  e = e.replace(/&/g, " & ");
  // Now normalize
  e = e.replace(/\s+/g, "").toLowerCase();
  // Word operators - handle both uppercase and lowercase
  e = e.replace(/\b(and|AND)\b/g, "&&");
  e = e.replace(/\b(or|OR)\b/g, "||");
  e = e.replace(/\b(not|NOT)\b/g, "!");
  e = e.replace(/\b(xor|XOR)\b/g, "!=="); // XOR as inequality
  // Common single-char operators
  e = e.replace(/\*/g, "&&");
  e = e.replace(/\+/g, "||");
  // Implication / equivalence
  // a -> b === (!a || b)
  e = e.replace(/([a-zA-Z0-9_\)]+)->([a-zA-Z0-9_\(]+)/g, "(!$1||$2)");
  // a <-> b === (a===b)
  e = e.replace(/([a-zA-Z0-9_\)]+)<->([a-zA-Z0-9_\(]+)/g, "($1===$2)");
  return e;
}

function safeEvalBoolean(expr, env) {
  const js = toJsBooleanExpr(expr);
  const fn = new Function(
    ...Object.keys(env),
    `"use strict"; return Boolean(${js});`,
  );
  return fn(...Object.keys(env).map((k) => env[k]));
}

function extractVariables(expr) {
  const vars = new Set();
  // Handle HTML-encoded operators FIRST (before normalize)
  let normalized = expr;
  normalized = normalized
    .replace(/&&/g, " ")
    .replace(/&\|\|/g, " ")
    .replace(/&/g, " ");
  // Now normalize spaces and extract variables
  normalized = normalized.replace(/\s+/g, "");
  // Replace logical operators with spaces before extracting variables
  normalized = normalized
    .replace(/&&/g, " ")
    .replace(/\|\|/g, " ")
    .replace(/!==/g, " ")
    .replace(/===/g, " ")
    .replace(/!/g, " ")
    .replace(/\(/g, " ")
    .replace(/\)/g, " ");

  const matches = normalized.match(/[a-zA-Z][a-zA-Z0-9_]*/g) || [];
  for (const m of matches) {
    const t = m.toLowerCase();
    if (
      t === "and" ||
      t === "or" ||
      t === "not" ||
      t === "xor" ||
      t === "true" ||
      t === "false"
    ) {
      continue;
    }
    vars.add(m);
  }
  return Array.from(vars);
}

// Test case based on client output
const testCases = [
  {
    questionData: {
      correct_expression: "A AND B",
      variables: [
        { name: "A", type: "boolean", description: "Variable A" },
        { name: "B", type: "boolean", description: "Variable B" },
      ],
    },
    studentAnswer: {
      expression: "A AND B", // This is what the client sends
      variables: [
        { name: "A", value: true },
        { name: "B", value: false },
      ],
    },
  },
  {
    questionData: {
      correct_expression: "A OR B",
      variables: [
        { name: "A", type: "boolean", description: "Variable A" },
        { name: "B", type: "boolean", description: "Variable B" },
      ],
    },
    studentAnswer: {
      expression: "A OR B",
      variables: [
        { name: "A", value: true },
        { name: "B", value: false },
      ],
    },
  },
];

console.log("=== Testing Logical Expression Grading ===");
console.log("");

testCases.forEach((test, index) => {
  console.log(
    `Test Case ${index + 1}: Correct Expression = "${test.questionData.correct_expression}"`,
  );
  console.log(`Student Answer: "${test.studentAnswer.expression}"`);

  try {
    const vars = extractVariables(
      `${test.studentAnswer.expression} ${test.questionData.correct_expression}`,
    );
    console.log("Extracted Variables:", vars);

    if (vars.length === 0) {
      const isCorrect =
        normalize(test.studentAnswer.expression) ===
        normalize(test.questionData.correct_expression);
      console.log(`String Comparison Result: ${isCorrect}`);
    } else {
      const limitedVars = vars.slice(0, 6);
      const combos = 1 << limitedVars.length;
      let isCorrect = true;

      for (let mask = 0; mask < combos; mask++) {
        const env = {};
        for (let i = 0; i < limitedVars.length; i++) {
          env[limitedVars[i]] = Boolean(mask & (1 << i));
        }

        const studentVal = safeEvalBoolean(test.studentAnswer.expression, env);
        const correctVal = safeEvalBoolean(
          test.questionData.correct_expression,
          env,
        );

        console.log(`Combo ${mask + 1}/${combos}: ${JSON.stringify(env)}`);
        console.log(`  Student: ${studentVal}, Correct: ${correctVal}`);

        if (studentVal !== correctVal) {
          isCorrect = false;
          console.log("  MISMATCH!");
        }
      }

      console.log(
        `\nFinal Result: ${isCorrect ? "✅ CORRECT" : "❌ INCORRECT"}`,
      );
    }
  } catch (error) {
    console.error("\nError during evaluation:", error);
    const fallbackResult =
      normalize(test.studentAnswer.expression) ===
      normalize(test.questionData.correct_expression);
    console.log(`Fallback String Comparison: ${fallbackResult}`);
  }

  console.log("");
  console.log("==========================================");
  console.log("");
});

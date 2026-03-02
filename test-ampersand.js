// Test script to see how "P & Q" is evaluated
const fs = require("fs");
const path = require("path");

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

function extractVariables(expr) {
  const vars = new Set();
  // Handle HTML-encoded operators FIRST (before normalize)
  let normalized = expr;
  normalized = normalized
    .replace(/&&/g, " ")
    .replace(/&\|\|/g, " ")
    .replace(/&/g, " ");

  // Replace word operators with spaces BEFORE normalizing whitespace
  normalized = normalized
    .replace(/\b(and|or|not|xor|true|false)\b/gi, " ")
    .replace(/&&/g, " ")
    .replace(/\|\|/g, " ")
    .replace(/!==/g, " ")
    .replace(/===/g, " ")
    .replace(/!/g, " ")
    .replace(/\(/g, " ")
    .replace(/\)/g, " ")
    .replace(/->/g, " ")
    .replace(/<->/g, " ");

  // Normalize spaces
  normalized = normalized.replace(/\s+/g, " ").trim();

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
    vars.add(t); // Convert all variables to lowercase for consistency
  }
  return Array.from(vars);
}

function toJsBooleanExpr(expr) {
  let e = expr;
  // Handle HTML-encoded operators FIRST (before normalize)
  e = e.replace(/&&/g, " && ");
  e = e.replace(/&\|\|/g, " || ");
  e = e.replace(/&/g, " & ");

  // Handle word operators BEFORE removing whitespace
  e = e.replace(/\b(and|AND)\b/g, "&&");
  e = e.replace(/\b(or|OR)\b/g, "||");
  e = e.replace(/\b(not|NOT)\b/g, "!");
  e = e.replace(/\b(xor|XOR)\b/g, "!=="); // XOR as inequality

  // Now normalize
  e = e.replace(/\s+/g, "").toLowerCase();

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
  console.log("Converted to JS:", js);
  const fn = new Function(
    ...Object.keys(env),
    `"use strict"; return Boolean(${js});`,
  );
  return fn(...Object.keys(env).map((k) => env[k]));
}

// Test case
const testCase = {
  questionData: {
    correct_expression: "P && Q",
    variables: [
      { name: "P", type: "boolean" },
      { name: "Q", type: "boolean" },
    ],
  },
  studentAnswer: {
    expression: "P & Q",
  },
};

console.log("=== Testing P & Q ===");
console.log("Correct Expression:", testCase.questionData.correct_expression);
console.log("Student Answer:", testCase.studentAnswer.expression);
console.log("");

try {
  const decodedCorrectExpression = testCase.questionData.correct_expression
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, '"')
    .replace(/'/g, "'");
  console.log("Decoded Correct Expression:", decodedCorrectExpression);
  console.log("");

  const vars = extractVariables(
    `${testCase.studentAnswer.expression} ${decodedCorrectExpression}`,
  );
  console.log("Extracted Variables:", vars);

  if (vars.length === 0) {
    const isCorrect =
      normalize(testCase.studentAnswer.expression) ===
      normalize(decodedCorrectExpression);
    console.log(`String Comparison Result: ${isCorrect}`);
  } else {
    const limitedVars = vars.slice(0, 6);
    const combos = 1 << limitedVars.length;
    let isCorrect = true;

    console.log(`Testing ${combos} combinations:`);
    for (let mask = 0; mask < combos; mask++) {
      const env = {};
      for (let i = 0; i < limitedVars.length; i++) {
        env[limitedVars[i]] = Boolean(mask & (1 << i));
      }

      const studentVal = safeEvalBoolean(
        testCase.studentAnswer.expression,
        env,
      );
      const correctVal = safeEvalBoolean(decodedCorrectExpression, env);

      console.log(
        `Combo ${mask + 1}: ${JSON.stringify(env)} -> Student: ${studentVal}, Correct: ${correctVal}`,
      );

      if (studentVal !== correctVal) {
        isCorrect = false;
      }
    }

    console.log("");
    console.log(`Final Result: ${isCorrect ? "✅ CORRECT" : "❌ INCORRECT"}`);
  }
} catch (error) {
  console.error("\nError during evaluation:", error);
  const fallbackResult =
    normalize(testCase.studentAnswer.expression) ===
    normalize(testCase.questionData.correct_expression);
  console.log(`Fallback String Comparison: ${fallbackResult}`);
}

// Test script to verify all logical operators are handled correctly
const fs = require("fs");
const path = require("path");

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
  let normalized = expr;
  normalized = normalized
    .replace(/&&&/g, " ")
    .replace(/&\|\|/g, " ")
    .replace(/&/g, " ");

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
    vars.add(t);
  }
  return Array.from(vars);
}

function toJsBooleanExpr(expr) {
  let e = expr;
  e = e.replace(/&&&/g, " && ");
  e = e.replace(/&\|\|/g, " || ");
  e = e.replace(/&/g, " & ");

  e = e.replace(/\b(and|AND)\b/g, "&&");
  e = e.replace(/\b(or|OR)\b/g, "||");
  e = e.replace(/\b(not|NOT)\b/g, "!");
  e = e.replace(/\b(xor|XOR)\b/g, "!==");

  e = e.replace(/\s+/g, "").toLowerCase();

  e = e.replace(/\*/g, "&&");
  e = e.replace(/\+/g, "||");

  e = e.replace(/([a-zA-Z0-9_\)]+)->([a-zA-Z0-9_\(]+)/g, "(!$1||$2)");
  e = e.replace(/([a-zA-Z0-9_\)]+)<->([a-zA-Z0-9_\(]+)/g, "($1===$2)");

  if (e.includes("&") && !e.includes("&&")) {
    throw new Error(
      "Single & is not a valid logical operator. Use && instead.",
    );
  }

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

function gradeLogicalExpression(questionData, answerData) {
  const answer = answerData;

  if (!answer || typeof answer.expression !== "string") {
    return {
      is_correct: false,
      points_earned: 0,
      feedback: "Invalid answer format - expression is required",
    };
  }

  const correctExpression = questionData.correct_expression;

  const decodedCorrectExpression = correctExpression
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, '"')
    .replace(/'/g, "'");

  let isCorrect = false;
  try {
    const vars = extractVariables(
      `${answer.expression} ${decodedCorrectExpression}`,
    );

    if (vars.length === 0) {
      isCorrect =
        normalize(answer.expression) === normalize(decodedCorrectExpression);
    } else {
      const limitedVars = vars.slice(0, 6);
      const combos = 1 << limitedVars.length;
      isCorrect = true;

      for (let mask = 0; mask < combos; mask++) {
        const env = {};
        for (let i = 0; i < limitedVars.length; i++) {
          env[limitedVars[i]] = Boolean(mask & (1 << i));
        }

        const aVal = safeEvalBoolean(answer.expression, env);
        const cVal = safeEvalBoolean(decodedCorrectExpression, env);

        if (aVal !== cVal) {
          isCorrect = false;
          break;
        }
      }
    }
  } catch (e) {
    console.log(
      "[DEBUG] Error during evaluation, falling back to string comparison:",
      e,
    );
    isCorrect =
      normalize(answer.expression) === normalize(decodedCorrectExpression);
  }

  return {
    is_correct: isCorrect,
    points_earned: isCorrect ? 10 : 0,
    feedback: isCorrect ? "Expression is correct!" : "Expression is incorrect",
  };
}

// Test all logical operators
const testCases = [
  {
    name: "NOT operator",
    correct: "!P",
    student: "NOT P",
    expected: true,
  },
  {
    name: "OR operator",
    correct: "P || Q",
    student: "P OR Q",
    expected: true,
  },
  {
    name: "XOR operator",
    correct: "P !== Q",
    student: "P XOR Q",
    expected: true,
  },
  {
    name: "AND operator",
    correct: "P && Q",
    student: "P AND Q",
    expected: true,
  },
  {
    name: "Implication",
    correct: "!P || Q",
    student: "P -> Q",
    expected: true,
  },
  {
    name: "Equivalence",
    correct: "P === Q",
    student: "P <-> Q",
    expected: true,
  },
  {
    name: "Complex expression",
    correct: "(P && Q) || (!R)",
    student: "(P AND Q) OR (NOT R)",
    expected: true,
  },
  {
    name: "Invalid single &",
    correct: "P && Q",
    student: "P & Q",
    expected: false,
  },
  {
    name: "Mismatch operator",
    correct: "P && Q",
    student: "P || Q",
    expected: false,
  },
];

console.log("=== Testing All Logical Operators ===");
console.log("");

testCases.forEach((test, index) => {
  console.log(`Test Case ${index + 1}: ${test.name}`);
  console.log(`  Correct: ${test.correct}`);
  console.log(`  Student: ${test.student}`);

  const result = gradeLogicalExpression(
    {
      correct_expression: test.correct,
      variables: test.correct
        .match(/[A-Z]/g)
        .map((c) => ({ name: c, type: "boolean" })),
    },
    { expression: test.student },
  );

  const pass = result.is_correct === test.expected;
  console.log(`  Result: ${pass ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`  Details: ${result.feedback}`);
  console.log("");
});

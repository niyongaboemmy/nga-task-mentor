// Test script that closely mimics the server's grading logic
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
  console.log("Converted to JS:", js);
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

  console.log("[DEBUG] Logical Expression Grading:");
  console.log("[DEBUG] answer.expression:", answer.expression);
  console.log("[DEBUG] correctExpression:", correctExpression);
  console.log("[DEBUG] decodedCorrectExpression:", decodedCorrectExpression);

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

      console.log(
        "[DEBUG] Truth table validation for",
        limitedVars.length,
        "variables",
      );
      console.log("[DEBUG] Total combinations to test:", combos);

      for (let mask = 0; mask < combos; mask++) {
        const env = {};
        for (let i = 0; i < limitedVars.length; i++) {
          env[limitedVars[i]] = Boolean(mask & (1 << i));
        }

        const aVal = safeEvalBoolean(answer.expression, env);
        const cVal = safeEvalBoolean(decodedCorrectExpression, env);

        console.log(
          `[DEBUG] Combo ${mask + 1}/${combos}:`,
          env,
          "Student:",
          aVal,
          "Correct:",
          cVal,
        );

        if (aVal !== cVal) {
          console.log(
            "[DEBUG] MISMATCH found at combination",
            mask,
            "- answer is INCORRECT",
          );
          isCorrect = false;
          break;
        }
      }

      if (isCorrect) {
        console.log("[DEBUG] All combinations matched - answer is CORRECT");
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

// Test the issue case where P or Q is incorrectly graded as correct for P && Q
console.log("=== Test Case 1: P or Q ===");
const test1 = gradeLogicalExpression(
  {
    correct_expression: "P && Q",
    variables: [
      { name: "P", type: "boolean" },
      { name: "Q", type: "boolean" },
    ],
  },
  {
    expression: "P or Q",
  },
);
console.log("Result:", test1);
console.log("");

// Test the P & Q case
console.log("=== Test Case 2: P & Q ===");
const test2 = gradeLogicalExpression(
  {
    correct_expression: "P && Q",
    variables: [
      { name: "P", type: "boolean" },
      { name: "Q", type: "boolean" },
    ],
  },
  {
    expression: "P & Q",
  },
);
console.log("Result:", test2);
console.log("");

// Test a correct case
console.log("=== Test Case 3: P && Q ===");
const test3 = gradeLogicalExpression(
  {
    correct_expression: "P && Q",
    variables: [
      { name: "P", type: "boolean" },
      { name: "Q", type: "boolean" },
    ],
  },
  {
    expression: "P && Q",
  },
);
console.log("Result:", test3);

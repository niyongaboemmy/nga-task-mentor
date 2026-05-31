/**
 * Single-choice stress test.
 * Run: npm run test:grader:stress  (or see package.json)
 */
import { ChoiceQuestionGrader } from "./quizGrader";

let _p = 0, _f = 0;
function expect(desc: string, actual: any, matcher: (v: any) => boolean, hint?: string) {
  if (matcher(actual)) {
    console.log(`  \x1b[32m✓\x1b[0m ${desc}`);
    _p++;
  } else {
    console.log(`  \x1b[31m✗\x1b[0m ${desc}`);
    if (hint) console.log(`    \x1b[33mhint:\x1b[0m ${hint}`);
    console.log(`    \x1b[90mgot: ${JSON.stringify(actual)}\x1b[0m`);
    _f++;
  }
}
const eq  = (e: any) => (v: any) => v === e;
const neq = (e: any) => (v: any) => v !== e;

function q(qData: any, correctAnswer: any = null, points = 10): any {
  return {
    id: 99,
    points,
    questionBank: {
      question_type: "single_choice",
      question_data: qData,
      correct_answer: correctAnswer,
      question_text: "Stress test",
      explanation: null,
    },
  };
}
const grade = (question: any, answer: any) =>
  ChoiceQuestionGrader.gradeSingleChoice(question, answer);

// ── GROUP 1: Correct-answer resolution edge cases ────────────────────────────
console.log("\n\x1b[34m▸ correct-answer resolution\x1b[0m");
{
  // correct_answer column as array [0]
  const r1 = grade(q({ options: ["A","B","C"] }, [0]), { selected_option_index: 0 });
  expect("correct_answer=[0] (array with index) resolves", r1.is_correct, eq(true),
    "array format [0] not handled by level 3 fallback");

  // correct_answer as { answer: 0 }  (non-standard key)
  const r2 = grade(q({ options: ["A","B","C"] }, { answer: 0 }), { selected_option_index: 0 });
  expect("correct_answer={answer:0} resolves via object path", r2.is_correct, eq(true),
    "object with 'answer' key not handled");

  // Substring must NOT match: "Paris" must not match "Paris Nord"
  // (none of the options exactly match "Paris", so correctIndex stays null → "not configured")
  const r3q = q({ options: ["Paris Nord","London","Berlin"] }, "Paris");
  const r3wrong = grade(r3q, { selected_option_index: 0 });
  expect("'Paris' does NOT substring-match 'Paris Nord' (no false positive at index 0)",
    r3wrong.is_correct, eq(false));
  expect("when text match fails entirely → 0 pts (not configured), no crash",
    grade(r3q, { selected_option_index: 1 }).points_earned, eq(0));

  // Leading/trailing whitespace in correct_answer
  const r4 = grade(q({ options: ["Paris","London"] }, "  Paris  "), { selected_option_index: 0 });
  expect("correct_answer with surrounding spaces resolves", r4.is_correct, eq(true));

  // Case-insensitive correct_answer text
  const r5 = grade(q({ options: ["Paris","London"] }, "PARIS"), { selected_option_index: 0 });
  expect("correct_answer 'PARIS' matches option 'Paris' case-insensitively", r5.is_correct, eq(true));

  // question_data.correct_answer as number
  const r6 = grade(q({ options: ["A","B","C"], correct_answer: 2 }), null);
  const r6b = grade(q({ options: ["A","B","C"], correct_answer: 2 }), { selected_option_index: 2 });
  expect("question_data.correct_answer as number resolves index", r6b.is_correct, eq(true));

  // Two options flagged correct:true — first wins, second is wrong
  const r7q = q({ options: [{ text:"A", correct:true },{ text:"B", correct:true },{ text:"C", correct:false }] });
  expect("multiple correct:true — first flagged wins (index 0)", grade(r7q, { selected_option_index: 0 }).is_correct, eq(true));
  expect("multiple correct:true — second option marked wrong", grade(r7q, { selected_option_index: 1 }).is_correct, eq(false));

  // Empty options array with text correct_answer — no crash
  const r8 = grade(q({ options: [] }, "Paris"), { selected_option_index: 0 });
  expect("empty options + text correct_answer → no crash", r8.points_earned, eq(0));

  // correct_option_index = NaN
  const r9 = grade(q({ options:["A","B"], correct_option_index: NaN }), { selected_option_index: 0 });
  expect("correct_option_index=NaN gracefully falls through", r9.points_earned, eq(0));

  // correct_option_index negative: -1 must never be a valid correct index
  const r10 = grade(q({ options:["A","B"], correct_option_index: -1 }), { selected_option_index: 0 });
  expect("correct_option_index=-1 → student at 0 is wrong (no false positive)", r10.is_correct, eq(false),
    "toIndex(-1) returns -1; -1 !== 0 so already correct — but -1 is an invalid index and should be rejected");

  // correct_option_index out of bounds — student picks valid index 0 → wrong
  const r11 = grade(q({ options:["A","B"], correct_option_index: 5 }), { selected_option_index: 0 });
  expect("out-of-bounds correct_option_index=5 → index 0 is wrong", r11.is_correct, eq(false));

  // Float correct_option_index 1.5 — must NOT match integer index 1
  const r12 = grade(q({ options:["A","B","C"], correct_option_index: 1.5 }), { selected_option_index: 1 });
  expect("float correct_option_index=1.5 does NOT match student index 1", r12.is_correct, eq(false),
    "toIndex(1.5) returns 1.5; 1.5 !== 1 so already correct — but float indices are invalid");
}

// ── GROUP 2: Student answer edge cases ──────────────────────────────────────
console.log("\n\x1b[34m▸ student answer formats\x1b[0m");
{
  const baseQ = q({ options:["Paris","London","Berlin"], correct_option_index: 0 });

  // Empty object {}
  expect("{} answer → 0 pts, no crash",
    grade(baseQ, {}).points_earned, eq(0));

  // { answer: 0 } (wrong key)
  expect("{ answer:0 } (wrong key) → not matched as index",
    grade(baseQ, { answer: 0 }).is_correct, eq(false));

  // Boolean true
  expect("boolean true → 0 pts, no crash",
    grade(baseQ, true).points_earned, eq(0));

  // Boolean false
  expect("boolean false → 0 pts, no crash",
    grade(baseQ, false).points_earned, eq(0));

  // Array [0]
  expect("array [0] student answer → 0 pts or graceful",
    grade(baseQ, [0]).points_earned, eq(0));

  // Float student index 0.5 must NOT match correct index 0
  expect("float selected_option_index=0.5 does NOT match index 0",
    grade(baseQ, { selected_option_index: 0.5 }).is_correct, eq(false),
    "0.5 !== 0 — already works, confirming");

  // Negative student index -1
  expect("negative selected_option_index=-1 → wrong",
    grade(baseQ, { selected_option_index: -1 }).is_correct, eq(false));

  // undefined selected_option_index
  expect("{ selected_option_index: undefined } → 0 pts",
    grade(baseQ, { selected_option_index: undefined }).points_earned, eq(0));

  // null selected_option_index
  expect("{ selected_option_index: null } → 0 pts",
    grade(baseQ, { selected_option_index: null }).points_earned, eq(0));

  // Text in selected_option_index field: { selected_option_index: "Paris" }
  const r10 = grade(baseQ, { selected_option_index: "Paris" });
  expect("{ selected_option_index:'Paris' } (text-in-index-field) → no crash",
    r10.points_earned, neq(undefined));
  // Note: parseInt("Paris") = NaN → null; no text match in object path → 0 pts
  expect("{ selected_option_index:'Paris' } → 0 pts (text not matched in object path)",
    r10.points_earned, eq(0));

  // String: wrong option text
  expect("student sends wrong option text 'London' → wrong",
    grade(baseQ, "London").is_correct, eq(false));

  // String: correct option text uppercase
  expect("student sends 'PARIS' (uppercase correct) → correct",
    grade(baseQ, "PARIS").is_correct, eq(true));

  // String: HTML-wrapped correct option
  expect("student sends '<p>Paris</p>' → correct",
    grade(baseQ, "<p>Paris</p>").is_correct, eq(true));

  // String: out-of-range numeric string "99"
  expect("student sends '99' (out-of-range index) → wrong",
    grade(baseQ, "99").is_correct, eq(false));

  // String: whitespace-padded correct option
  expect("student sends '  Paris  ' (padded) → correct",
    grade(baseQ, "  Paris  ").is_correct, eq(true));
}

// ── GROUP 3: Degenerate question shapes ─────────────────────────────────────
console.log("\n\x1b[34m▸ degenerate question shapes\x1b[0m");
{
  // question_data is null
  const nullDataQ = { id:1, points:10, questionBank:{ question_type:"single_choice", question_data:null, correct_answer:0, question_text:"Q", explanation:null }};
  expect("question_data=null → falls back to correct_answer=0",
    grade(nullDataQ, { selected_option_index: 0 }).is_correct, eq(true));

  // question_data is a raw number (corrupt DB value)
  expect("question_data=42 (corrupt) → 0 pts, no crash",
    grade({ id:1, points:10, questionBank:{ question_type:"single_choice", question_data:42, correct_answer:null, question_text:"Q", explanation:null }}, { selected_option_index:0 }).points_earned, eq(0));

  // questionBank is null
  expect("questionBank=null → 0 pts, no crash",
    grade({ id:1, points:10, questionBank:null }, { selected_option_index:0 }).points_earned, eq(0));

  // question itself is null
  expect("null question → 0 pts, no crash",
    ChoiceQuestionGrader.gradeSingleChoice(null as any, { selected_option_index:0 }).points_earned, eq(0));

  // Options array contains null items
  expect("options with null item at index 0 → still grades correct index 1",
    grade(q({ options:[null,"Paris","Berlin"], correct_option_index:1 }), { selected_option_index:1 }).is_correct, eq(true));

  // Single-option question
  expect("single-option question grades correctly",
    grade(q({ options:["Only option"], correct_option_index:0 }), { selected_option_index:0 }).is_correct, eq(true));

  // correct_answer is empty string "" — matches empty-string option
  expect("correct_answer='' matches empty option at index 0",
    grade(q({ options:["","Paris","Berlin"] }, ""), { selected_option_index:0 }).is_correct, eq(true));

  // Duplicate option text — text match must lock to FIRST occurrence
  const dupQ = q({ options:["Paris","Paris","Berlin"] }, "Paris");
  expect("duplicate option text — text match resolves to first (index 0)",
    grade(dupQ, { selected_option_index:0 }).is_correct, eq(true));
  expect("duplicate option text — index 1 is NOT also graded correct",
    grade(dupQ, { selected_option_index:1 }).is_correct, eq(false),
    "correctIndex should be locked to 0 by findIndex");

  // Zero-point question
  const zeroQ = q({ options:["A","B"], correct_option_index:0 }, null, 0);
  expect("0-point question: correct answer is detected (is_correct=true)",
    grade(zeroQ, { selected_option_index:0 }).is_correct, eq(true));
  expect("0-point question: points_earned = 0",
    grade(zeroQ, { selected_option_index:0 }).points_earned, eq(0));

  // String-encoded JSON question_data (DB sometimes returns as string)
  const jsonDataQ = { id:1, points:10, questionBank:{ question_type:"single_choice", question_data: JSON.stringify({ options:["X","Y","Z"], correct_option_index:2 }), correct_answer:null, question_text:"Q", explanation:null }};
  expect("question_data stored as JSON string → parsed and graded",
    grade(jsonDataQ, { selected_option_index:2 }).is_correct, eq(true));
}

// ── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(60)}`);
console.log(`  \x1b[32m✓ ${_p} passed\x1b[0m   \x1b[31m✗ ${_f} failed\x1b[0m`);
console.log("─".repeat(60));
process.exit(_f > 0 ? 1 : 0);

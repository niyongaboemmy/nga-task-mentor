/**
 * Single-choice stress test — ROUND 2
 * Probes: AdvancedQuizGrader path, real-world DB shapes, answer-format variants,
 * HTML/entity handling, realistic option objects, and boundary conditions.
 *
 * Run:
 *   npx ts-node --transpile-only --require ./test-grader-mock.cjs src/utils/scStress2.test.ts
 */
import {
  ChoiceQuestionGrader,
  AdvancedQuizGrader,
} from "./quizGrader";

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
const eq  = (e: any)      => (v: any) => v === e;
const gt  = (n: number)   => (v: any) => typeof v === "number" && v > n;
const has = (s: string)   => (v: any) => typeof v === "string" && v.includes(s);
const isStr = ()          => (v: any) => typeof v === "string";

function q(qData: any, correctAnswer: any = null, points = 10): any {
  return {
    id: 99,
    points,
    questionBank: {
      question_type: "single_choice",
      question_data: qData,
      correct_answer: correctAnswer,
      question_text: "Stress test Q",
      explanation: null,
    },
  };
}
const grade  = (question: any, answer: any) =>
  ChoiceQuestionGrader.gradeSingleChoice(question, answer);
const gradeA = async (question: any, answer: any) =>
  AdvancedQuizGrader.gradeWithConfig(question, answer);

// ── GROUP 1: AdvancedQuizGrader.gradeWithConfig path ────────────────────────
// This is what the controller actually calls — test it end-to-end.
console.log("\n\x1b[34m▸ AdvancedQuizGrader.gradeWithConfig (controller path)\x1b[0m");
(async () => {
  const baseQ = q({ options: ["Paris","London","Berlin"], correct_option_index: 0 });

  const a1 = await gradeA(baseQ, { selected_option_index: 0 });
  expect("[Advanced] correct answer → is_correct true",   a1.is_correct,     eq(true));
  expect("[Advanced] correct answer → full points (10)",  a1.points_earned,  eq(10));
  expect("[Advanced] has max_points field",               a1.max_points,     eq(10));
  expect("[Advanced] percentage = 100",                   a1.percentage,     eq(100));
  expect("[Advanced] feedback is a string",               a1.feedback,       isStr());

  const a2 = await gradeA(baseQ, { selected_option_index: 1 });
  expect("[Advanced] wrong answer → is_correct false",    a2.is_correct,     eq(false));
  expect("[Advanced] wrong answer → 0 points",            a2.points_earned,  eq(0));
  expect("[Advanced] wrong answer → percentage 0",        a2.percentage,     eq(0));

  const a3 = await gradeA(baseQ, null);
  expect("[Advanced] null answer → 0 pts no crash",       a3.points_earned,  eq(0));

  // Correct via text answer through advanced path
  const a4 = await gradeA(baseQ, "Paris");
  expect("[Advanced] text answer 'Paris' → correct",      a4.is_correct,     eq(true));

  // JSON string answer through advanced path
  const a5 = await gradeA(baseQ, '{"selected_option_index":0}');
  expect("[Advanced] JSON string answer → correct",       a5.is_correct,     eq(true));

// ── GROUP 2: Real-world DB correct_answer shapes ─────────────────────────────
console.log("\n\x1b[34m▸ real-world correct_answer shapes from DB\x1b[0m");
  {
    // { answer: "Paris" } — object with text in .answer key
    const r1 = grade(q({ options:["Paris","London"] }, { answer: "Paris" }), { selected_option_index: 0 });
    expect("correct_answer={answer:'Paris'} (text in .answer key) resolves", r1.is_correct, eq(true),
      "object path now checks .answer key; text match should find index 0");

    // { selected_option_index: "0" } — string index in object
    const r2 = grade(q({ options:["A","B","C"] }, { selected_option_index: "0" }), { selected_option_index: 0 });
    expect("correct_answer={selected_option_index:'0'} (string) resolves", r2.is_correct, eq(true));

    // { selected_option_indices: [0] } — multiple-choice key used by mistake
    const r3 = grade(q({ options:["A","B"] }, { selected_option_indices: [0] }), { selected_option_index: 0 });
    expect("correct_answer={selected_option_indices:[0]} (wrong plural key) → not configured",
      r3.points_earned, eq(0),
      "plural key not supported; instructor data error → graceful 0 pts");

    // ["Paris"] — array of text strings
    const r4 = grade(q({ options:["Paris","London"] }, ["Paris"]), { selected_option_index: 0 });
    expect("correct_answer=['Paris'] (array of text strings) → graceful",
      r4.points_earned, eq(0),
      "'Paris' is ca[0]; toIndex('Paris')=null — no text fallback in array path currently");

    // correct_answer stored as integer 0 as a string "0"
    const r5 = grade(q({ options:["A","B"] }, "0"), { selected_option_index: 0 });
    expect("correct_answer='0' (string integer) resolves", r5.is_correct, eq(true));

    // correct_answer as boolean true (garbage data)
    const r6 = grade(q({ options:["A","B"] }, true), { selected_option_index: 0 });
    expect("correct_answer=true (boolean garbage) → graceful 0 pts", r6.points_earned, eq(0));

    // correct_answer as boolean false
    const r7 = grade(q({ options:["A","B"] }, false), { selected_option_index: 0 });
    expect("correct_answer=false (boolean garbage) → graceful 0 pts", r7.points_earned, eq(0));

    // question_data.correct_answer as object { selected_option_index: 2 }
    const r8 = grade(
      q({ options:["A","B","C"], correct_answer: { selected_option_index: 2 } }),
      { selected_option_index: 2 },
    );
    expect("question_data.correct_answer={selected_option_index:2} resolves", r8.is_correct, eq(true));
  }

// ── GROUP 3: Options with rich object shapes ─────────────────────────────────
console.log("\n\x1b[34m▸ rich option object shapes\x1b[0m");
  {
    // Realistic option objects: { id, text, image }
    const richOpts = [
      { id: "opt_a", text: "Paris",  image: null },
      { id: "opt_b", text: "London", image: null },
      { id: "opt_c", text: "Berlin", image: null },
    ];

    // Graded by index — most common path
    const r1 = grade(q({ options: richOpts, correct_option_index: 2 }), { selected_option_index: 2 });
    expect("rich {id,text,image} options + index → correct", r1.is_correct, eq(true));

    // Graded by text (correct_answer = text of correct option)
    const r2 = grade(q({ options: richOpts }, "Berlin"), { selected_option_index: 2 });
    expect("rich options + text correct_answer 'Berlin' → resolves index 2", r2.is_correct, eq(true));

    // Correct flag on rich objects
    const r3q = q({ options: [
      { id:"a", text:"Paris",  correct: false },
      { id:"b", text:"London", correct: false },
      { id:"c", text:"Berlin", correct: true  },
    ]});
    expect("rich options with correct:true flag → index 2 is correct", grade(r3q, { selected_option_index: 2 }).is_correct, eq(true));
    expect("rich options with correct:true flag → index 0 is wrong",   grade(r3q, { selected_option_index: 0 }).is_correct, eq(false));

    // Options with HTML in text field: "<b>Paris</b>" stored in DB
    const htmlOpts = [
      { text: "<b>Paris</b>" },
      { text: "<em>London</em>" },
    ];
    const r4 = grade(q({ options: htmlOpts, correct_option_index: 0 }), { selected_option_index: 0 });
    expect("HTML option text + index → correct", r4.is_correct, eq(true));

    // Text-based match against HTML-wrapped option text
    const r5 = grade(q({ options: htmlOpts }, "<b>Paris</b>"), { selected_option_index: 0 });
    expect("correct_answer='<b>Paris</b>' matches HTML option at index 0", r5.is_correct, eq(true));

    // Stripped text match: correct_answer="Paris" matches option text "<b>Paris</b>"
    const r6 = grade(q({ options: htmlOpts }, "Paris"), { selected_option_index: 0 });
    expect("correct_answer='Paris' (plain) matches HTML option '<b>Paris</b>'", r6.is_correct, eq(true),
      "both sides stripped → 'paris' === 'paris'");

    // Options with HTML entities: "Paris &amp; Co"
    const entityOpts = ["Paris &amp; Co", "London", "Berlin"];
    const r7 = grade(q({ options: entityOpts }, "Paris & Co"), { selected_option_index: 0 });
    expect("correct_answer='Paris & Co' matches option 'Paris &amp; Co' after entity decode",
      r7.is_correct, eq(true));
  }

// ── GROUP 4: Student answer variants not covered in round 1 ─────────────────
console.log("\n\x1b[34m▸ additional student answer variants\x1b[0m");
  {
    const baseQ = q({ options:["Paris","London","Berlin"], correct_option_index: 0 });

    // { selected_option_index: 0, extra: "metadata" } — extra fields must be ignored
    expect("extra fields on answer object ignored",
      grade(baseQ, { selected_option_index: 0, extra: "metadata" }).is_correct, eq(true));

    // { correct_option_index: 0 } — old-style key (client bug, still supported)
    expect("student sends { correct_option_index:0 } (old-style key) → correct",
      grade(baseQ, { correct_option_index: 0 }).is_correct, eq(true));

    // selected_option_indices: [0] — multi-choice format, should not accidentally grade as correct
    expect("student sends { selected_option_indices:[0] } (wrong key) → 0 pts",
      grade(baseQ, { selected_option_indices: [0] }).points_earned, eq(0));

    // Double-JSON-encoded answer: '"{\"selected_option_index\":0}"'
    const doubleJson = JSON.stringify(JSON.stringify({ selected_option_index: 0 }));
    const r4 = grade(baseQ, doubleJson);
    expect("double-JSON-encoded answer → 0 pts (outer parse gives string, parseInt fails)",
      r4.points_earned, eq(0),
      "double-encoding is a client bug; graceful 0 pts is correct");

    // Infinity / -Infinity
    expect("Infinity as index → 0 pts",
      grade(baseQ, { selected_option_index: Infinity }).points_earned, eq(0));
    expect("-Infinity as index → 0 pts",
      grade(baseQ, { selected_option_index: -Infinity }).points_earned, eq(0));

    // NaN as student index
    expect("NaN as index → 0 pts",
      grade(baseQ, { selected_option_index: NaN }).points_earned, eq(0));

    // points field is string (Sequelize sometimes returns DECIMAL as string)
    const strPointsQ = { id:1, points: "7.5", questionBank: { question_type:"single_choice", question_data:{ options:["A","B"], correct_option_index:1 }, correct_answer:null, question_text:"Q", explanation:null }};
    const rSP = grade(strPointsQ, { selected_option_index: 1 });
    expect("points='7.5' (string) → points_earned=7.5 (numeric)", rSP.points_earned, eq(7.5));

    // Very long option text
    const longOpt = "A".repeat(10000);
    const r9 = grade(q({ options:[longOpt,"B"], correct_option_index:0 }), { selected_option_index: 0 });
    expect("very long option text (10k chars) → grades correctly", r9.is_correct, eq(true));

    // Unicode option texts
    const r10 = grade(q({ options:["Παρίσι","Λονδίνο"], correct_option_index:0 }), { selected_option_index: 0 });
    expect("unicode option text (Greek) → grades correctly", r10.is_correct, eq(true));

    // Options with special regex chars: "(City)" should not cause regex errors
    const r11 = grade(q({ options:["Paris (City)","London (City)"] }, "Paris (City)"), { selected_option_index: 0 });
    expect("option with regex-special chars '(City)' → text match works", r11.is_correct, eq(true));
  }

// ── GROUP 5: Scoring precision ───────────────────────────────────────────────
console.log("\n\x1b[34m▸ scoring precision\x1b[0m");
  {
    // Non-integer points: 3.33
    const q1 = q({ options:["A","B"], correct_option_index:0 }, null, 3.33);
    expect("3.33-point question → earns exactly 3.33", grade(q1, { selected_option_index:0 }).points_earned, eq(3.33));

    // points = "3.33" (string from DB)
    const q2 = { id:1, points:"3.33", questionBank:{ question_type:"single_choice", question_data:{ options:["A","B"], correct_option_index:0 }, correct_answer:null, question_text:"Q", explanation:null }};
    expect("points='3.33' string → earns 3.33", grade(q2, { selected_option_index:0 }).points_earned, eq(3.33));

    // Wrong answer always earns 0 regardless of points
    const q3 = q({ options:["A","B","C"], correct_option_index:0 }, null, 999);
    expect("wrong answer on 999-point question → 0 pts", grade(q3, { selected_option_index:1 }).points_earned, eq(0));
  }

// ── GROUP 6: Feedback messages ───────────────────────────────────────────────
console.log("\n\x1b[34m▸ feedback messages\x1b[0m");
  {
    const baseQ = q({ options:["Paris","London"], correct_option_index:0 });

    expect("correct → feedback says 'Correct'",
      grade(baseQ, { selected_option_index:0 }).feedback, eq("Correct"));
    expect("wrong → feedback says 'Incorrect'",
      grade(baseQ, { selected_option_index:1 }).feedback, eq("Incorrect"));
    expect("null answer → feedback says 'No answer provided'",
      grade(baseQ, null).feedback, eq("No answer provided"));
    expect("no correct answer configured → specific feedback message",
      grade(q({ options:["A","B"] }), { selected_option_index:0 }).feedback,
      has("not configured"));
    expect("{} answer → 'Answer did not match' feedback",
      grade(baseQ, {}).feedback, has("did not match"));
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log(`\n${"─".repeat(60)}`);
  console.log(`  \x1b[32m✓ ${_p} passed\x1b[0m   \x1b[31m✗ ${_f} failed\x1b[0m`);
  console.log("─".repeat(60));
  process.exit(_f > 0 ? 1 : 0);
})();

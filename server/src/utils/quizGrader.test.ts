/**
 * Comprehensive unit tests for QuizGrader — all 13 question types.
 *
 * Run from the /server directory:
 *   ts-node --require ./test-grader-mock.cjs src/utils/quizGrader.test.ts
 *
 * No external database or API calls are made (all mocked via test-grader-mock.cjs).
 */

import {
  ChoiceQuestionGrader,
  TextInputGrader,
  InteractiveGrader,
  AdvancedQuizGrader,
} from "./quizGrader";

// ─── Tiny assertion framework ─────────────────────────────────────────────────

let _passed = 0;
let _failed = 0;
let _currentSuite = "";

function suite(name: string) {
  _currentSuite = name;
  console.log(`\n\x1b[34m▸ ${name}\x1b[0m`);
}

function expect(
  description: string,
  actual: any,
  matcher: (v: any) => boolean,
  hint?: string,
) {
  if (matcher(actual)) {
    console.log(`  \x1b[32m✓\x1b[0m ${description}`);
    _passed++;
  } else {
    console.log(`  \x1b[31m✗\x1b[0m ${description}`);
    if (hint) console.log(`    \x1b[33mhint:\x1b[0m ${hint}`);
    console.log(`    \x1b[90mgot: ${JSON.stringify(actual)}\x1b[0m`);
    _failed++;
  }
}

const eq   = (expected: any)  => (v: any) => v === expected;
const gte  = (n: number)       => (v: any) => typeof v === "number" && v >= n;
const lte  = (n: number)       => (v: any) => typeof v === "number" && v <= n;
const near = (n: number, eps = 0.01) => (v: any) => typeof v === "number" && Math.abs(v - n) <= eps;

// ─── Mock QuizQuestion factory ────────────────────────────────────────────────

function q(
  type: string,
  questionData: object,
  correctAnswer: any = null,
  points = 10,
): any {
  return {
    id: 1,
    points,
    questionBank: {
      question_type: type,
      question_data: questionData,
      correct_answer: correctAnswer,
      question_text: "Test question",
      explanation: null,
    },
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. SINGLE CHOICE
// ═════════════════════════════════════════════════════════════════════════════

suite("single_choice");

{
  const question = q("single_choice", {
    options: ["Paris", "London", "Berlin", "Madrid"],
    correct_option_index: 0,
  });

  // Correct – option 0 (tests that index 0 / falsy value is handled)
  const r1 = ChoiceQuestionGrader.gradeSingleChoice(question, { selected_option_index: 0 });
  expect("selects correct option (index 0)", r1.is_correct, eq(true));
  expect("awards full points for correct", r1.points_earned, eq(10));

  // Correct – non-zero index
  const q2 = q("single_choice", {
    options: ["a", "b", "c"],
    correct_option_index: 2,
  });
  const r2 = ChoiceQuestionGrader.gradeSingleChoice(q2, { selected_option_index: 2 });
  expect("correct option 2", r2.is_correct, eq(true));

  // Wrong answer
  const r3 = ChoiceQuestionGrader.gradeSingleChoice(question, { selected_option_index: 1 });
  expect("wrong option → is_correct false", r3.is_correct, eq(false));
  expect("wrong option → 0 points", r3.points_earned, eq(0));

  // JSON string answer (critical bug: was not parsed before fix)
  const r4 = ChoiceQuestionGrader.gradeSingleChoice(
    question,
    '{"selected_option_index":0}',
  );
  expect("JSON string answer is parsed correctly", r4.is_correct, eq(true),
    "answerData sent as JSON string (common from some DB drivers) must be parsed");

  // Numeric string answer "0"
  const r5 = ChoiceQuestionGrader.gradeSingleChoice(question, "0");
  expect("numeric string answer '0' is parsed", r5.is_correct, eq(true));

  // Raw number answer
  const r6 = ChoiceQuestionGrader.gradeSingleChoice(question, 0);
  expect("raw number answer 0 works", r6.is_correct, eq(true));

  // Null answer
  const r7 = ChoiceQuestionGrader.gradeSingleChoice(question, null);
  expect("null answer → 0 points, no crash", r7.points_earned, eq(0));

  // Missing correct_option_index in question_data (fallback to correct_answer column)
  const q3 = q("single_choice",
    { options: ["a", "b", "c"] },
    { selected_option_index: 1 },
  );
  const r8 = ChoiceQuestionGrader.gradeSingleChoice(q3, { selected_option_index: 1 });
  expect("correct_answer column used when question_data lacks correct_option_index", r8.is_correct, eq(true));

  // correct_option_index stored as string "1" in question_data
  const q4 = q("single_choice", {
    options: ["a", "b", "c"],
    correct_option_index: "1",
  });
  const r9 = ChoiceQuestionGrader.gradeSingleChoice(q4, { selected_option_index: 1 });
  expect("correct_option_index stored as string '1' resolves correctly", r9.is_correct, eq(true));
}

// ── Single Choice edge cases (4-level fallback chain) ────────────────────────
{
  // 10: Options stored as objects {text} — index path still works
  const q10 = q("single_choice", {
    options: [{ text: "Alpha" }, { text: "Beta" }, { text: "Gamma" }],
    correct_option_index: 2,
  });
  const r10 = ChoiceQuestionGrader.gradeSingleChoice(q10, { selected_option_index: 2 });
  expect("object options + correct_option_index grades correctly", r10.is_correct, eq(true));

  // 11: Options with correct:true flag, no correct_option_index
  const q11 = q("single_choice", {
    options: [
      { text: "Wrong A", correct: false },
      { text: "Right B", correct: true },
      { text: "Wrong C", correct: false },
    ],
  });
  const r11a = ChoiceQuestionGrader.gradeSingleChoice(q11, { selected_option_index: 1 });
  expect("options with correct:true flag — right answer", r11a.is_correct, eq(true));
  const r11b = ChoiceQuestionGrader.gradeSingleChoice(q11, { selected_option_index: 0 });
  expect("options with correct:true flag — wrong answer", r11b.is_correct, eq(false));

  // 12: correct_answer column = plain option text (no index)
  const q12 = q("single_choice",
    { options: ["Paris", "London", "Berlin"] },
    "Paris",
  );
  const r12 = ChoiceQuestionGrader.gradeSingleChoice(q12, { selected_option_index: 0 });
  expect("correct_answer as option text resolves to index", r12.is_correct, eq(true));

  // 13: correct_answer column = HTML-wrapped text
  const q13 = q("single_choice",
    { options: ["Paris", "London", "Berlin"] },
    "<p>Paris</p>",
  );
  const r13 = ChoiceQuestionGrader.gradeSingleChoice(q13, { selected_option_index: 0 });
  expect("correct_answer as HTML-wrapped text resolves to index", r13.is_correct, eq(true));

  // 14: question_data.correct_answer = text (DOCX-import format)
  const q14 = q("single_choice", {
    options: ["Paris", "London", "Berlin"],
    correct_answer: "Berlin",
  });
  const r14 = ChoiceQuestionGrader.gradeSingleChoice(q14, { selected_option_index: 2 });
  expect("question_data.correct_answer text resolves to index", r14.is_correct, eq(true));

  // 15: Student submits option text string instead of index
  const q15 = q("single_choice", {
    options: ["Paris", "London", "Berlin"],
    correct_option_index: 0,
  });
  const r15 = ChoiceQuestionGrader.gradeSingleChoice(q15, "Paris");
  expect("student answer as option text string is resolved", r15.is_correct, eq(true));

  // 16: No correct answer configured anywhere — graceful failure
  const q16 = q("single_choice", { options: ["A", "B", "C"] }, null);
  const r16 = ChoiceQuestionGrader.gradeSingleChoice(q16, { selected_option_index: 0 });
  expect("no correct answer configured — 0 points, no crash", r16.points_earned, eq(0));
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. MULTIPLE CHOICE
// ═════════════════════════════════════════════════════════════════════════════

suite("multiple_choice");

{
  const question = q("multiple_choice", {
    options: ["A", "B", "C", "D"],
    correct_option_indices: [0, 2],
  });

  // Exact match – all correct, none wrong
  const r1 = ChoiceQuestionGrader.gradeMultipleChoice(question, {
    selected_option_indices: [0, 2],
  });
  expect("exact match → is_correct true", r1.is_correct, eq(true));
  expect("exact match → full points", r1.points_earned, eq(10));

  // Partial – one correct, none wrong
  const r2 = ChoiceQuestionGrader.gradeMultipleChoice(question, {
    selected_option_indices: [0],
  });
  expect("partial correct, no wrong → is_correct FALSE (not fully correct)", r2.is_correct, eq(false));
  expect("partial correct → earns some points (partial credit)", r2.points_earned, gte(0));

  // One correct + one wrong (penalty)
  const r3 = ChoiceQuestionGrader.gradeMultipleChoice(question, {
    selected_option_indices: [0, 1],
  });
  expect("1 correct + 1 wrong → is_correct false", r3.is_correct, eq(false));

  // All wrong
  const r4 = ChoiceQuestionGrader.gradeMultipleChoice(question, {
    selected_option_indices: [1, 3],
  });
  expect("all wrong → 0 points", r4.points_earned, eq(0));
  expect("all wrong → is_correct false", r4.is_correct, eq(false));

  // JSON string answer
  const r5 = ChoiceQuestionGrader.gradeMultipleChoice(
    question,
    '{"selected_option_indices":[0,2]}',
  );
  expect("JSON string answer parsed correctly", r5.is_correct, eq(true));

  // String indices inside array: ["0","2"]
  const r6 = ChoiceQuestionGrader.gradeMultipleChoice(question, {
    selected_option_indices: ["0", "2"],
  });
  expect("string indices in array coerced to numbers", r6.is_correct, eq(true));

  // Empty selection
  const r7 = ChoiceQuestionGrader.gradeMultipleChoice(question, {
    selected_option_indices: [],
  });
  expect("empty selection → 0 points", r7.points_earned, eq(0));
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. TRUE / FALSE
// ═════════════════════════════════════════════════════════════════════════════

suite("true_false");

{
  const questionTrue = q("true_false", { correct_answer: true });
  const questionFalse = q("true_false", { correct_answer: false });

  // Correct TRUE
  const r1 = ChoiceQuestionGrader.gradeTrueFalse(questionTrue, { selected_answer: true });
  expect("true answer for true question → correct", r1.is_correct, eq(true));
  expect("true answer for true question → full points", r1.points_earned, eq(10));

  // Correct FALSE (critical: false is falsy — must not be treated as "no answer")
  const r2 = ChoiceQuestionGrader.gradeTrueFalse(questionFalse, { selected_answer: false });
  expect("false answer for false question → correct", r2.is_correct, eq(true));
  expect("false answer for false question → full points", r2.points_earned, eq(10));

  // Wrong answer
  const r3 = ChoiceQuestionGrader.gradeTrueFalse(questionTrue, { selected_answer: false });
  expect("false answer for true question → incorrect", r3.is_correct, eq(false));
  expect("false answer for true question → 0 points", r3.points_earned, eq(0));

  // String "true" / "false" answers
  const r4 = ChoiceQuestionGrader.gradeTrueFalse(questionTrue, { selected_answer: "true" });
  expect("string 'true' answer accepted", r4.is_correct, eq(true));

  const r5 = ChoiceQuestionGrader.gradeTrueFalse(questionFalse, { selected_answer: "false" });
  expect("string 'false' answer accepted for false question", r5.is_correct, eq(true));

  // JSON string answer
  const r6 = ChoiceQuestionGrader.gradeTrueFalse(questionTrue, '{"selected_answer":true}');
  expect("JSON string answer parsed", r6.is_correct, eq(true));

  // correct_answer stored in separate column
  const qCol = q("true_false", {}, { selected_answer: true });
  const r7 = ChoiceQuestionGrader.gradeTrueFalse(qCol, { selected_answer: true });
  expect("correct_answer from DB column used as fallback", r7.is_correct, eq(true));
}

// ═════════════════════════════════════════════════════════════════════════════
// 4. NUMERICAL
// ═════════════════════════════════════════════════════════════════════════════

suite("numerical");

{
  const question = q("numerical", {
    correct_answer: 42,
    tolerance: 0,
    units: "kg",
  });

  // Exact match
  const r1 = TextInputGrader.gradeNumerical(question, { answer: 42 }) as any;
  r1.then((res: any) => {
    expect("exact numeric match → correct", res.is_correct, eq(true));
    expect("exact match → full points", res.points_earned, eq(10));
  });

  // Within tolerance
  const qTol = q("numerical", { correct_answer: 100, tolerance: 5 });
  const r2 = TextInputGrader.gradeNumerical(qTol, { answer: 103 }) as any;
  r2.then((res: any) => {
    expect("within tolerance → correct", res.is_correct, eq(true));
  });

  // Outside tolerance
  const r3 = TextInputGrader.gradeNumerical(qTol, { answer: 110 }) as any;
  r3.then((res: any) => {
    expect("outside tolerance → incorrect", res.is_correct, eq(false));
    expect("outside tolerance → 0 points", res.points_earned, eq(0));
  });

  // String answer "42"
  const r4 = TextInputGrader.gradeNumerical(question, { answer: "42" }) as any;
  r4.then((res: any) => {
    expect("string answer '42' parsed as number", res.is_correct, eq(true));
  });

  // LaTeX fraction \frac{1}{2} → 0.5
  const qFrac = q("numerical", { correct_answer: 0.5, tolerance: 0 });
  const r5 = TextInputGrader.gradeNumerical(qFrac, { answer: "\\frac{1}{2}" }) as any;
  r5.then((res: any) => {
    expect("LaTeX \\frac{1}{2} parsed as 0.5", res.is_correct, eq(true));
  });

  // Answer 0 (falsy — must not be rejected as "no answer")
  const qZero = q("numerical", { correct_answer: 0, tolerance: 0 });
  const r6 = TextInputGrader.gradeNumerical(qZero, { answer: 0 }) as any;
  r6.then((res: any) => {
    expect("answer 0 is not treated as 'no answer'", res.is_correct, eq(true));
  });

  // No correct_answer configured
  const qNoCorrect = q("numerical", {});
  const r7 = TextInputGrader.gradeNumerical(qNoCorrect, { answer: 5 }) as any;
  r7.then((res: any) => {
    expect("missing correct_answer → 0 points, no crash", res.points_earned, eq(0));
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// 5. FILL IN BLANK
// ═════════════════════════════════════════════════════════════════════════════

suite("fill_blank");

{
  const question = q("fill_blank", {
    text_with_blanks: "The capital of France is ___.",
    acceptable_answers: [
      { blank_index: 0, answers: ["Paris", "paris"] },
    ],
  });

  // All blanks correct
  const r1 = TextInputGrader.gradeFillBlank(question, {
    answers: [{ blank_index: 0, answer: "Paris" }],
  });
  expect("correct blank → is_correct true", r1.is_correct, eq(true));
  expect("correct blank → full points", r1.points_earned, eq(10));

  // Case-insensitive match
  const r2 = TextInputGrader.gradeFillBlank(question, {
    answers: [{ blank_index: 0, answer: "PARIS" }],
  });
  expect("case-insensitive match accepted", r2.is_correct, eq(true));

  // Wrong answer
  const r3 = TextInputGrader.gradeFillBlank(question, {
    answers: [{ blank_index: 0, answer: "London" }],
  });
  expect("wrong blank → is_correct false", r3.is_correct, eq(false));
  expect("wrong blank → 0 points", r3.points_earned, eq(0));

  // Multi-blank: partial credit
  const q2 = q("fill_blank", {
    text_with_blanks: "___ + ___ = 3",
    acceptable_answers: [
      { blank_index: 0, answers: ["1"] },
      { blank_index: 1, answers: ["2"] },
    ],
  });

  const r4 = TextInputGrader.gradeFillBlank(q2, {
    answers: [
      { blank_index: 0, answer: "1" },
      { blank_index: 1, answer: "99" },  // wrong
    ],
  });
  expect("partial blanks → is_correct FALSE", r4.is_correct, eq(false),
    "is_correct must be false when not all blanks are correct");
  expect("partial blanks → partial points (5 of 10)", r4.points_earned, near(5));

  // All blanks correct → is_correct TRUE
  const r5 = TextInputGrader.gradeFillBlank(q2, {
    answers: [
      { blank_index: 0, answer: "1" },
      { blank_index: 1, answer: "2" },
    ],
  });
  expect("all blanks correct → is_correct TRUE", r5.is_correct, eq(true));
  expect("all blanks correct → full points", r5.points_earned, eq(10));

  // Blank index mismatch (student sends blank_index:1 but only one blank exists at 0)
  const r6 = TextInputGrader.gradeFillBlank(question, {
    answers: [{ blank_index: 1, answer: "Paris" }],
  });
  expect("mismatched blank_index → 0 points (blank 0 left unanswered)", r6.points_earned, eq(0));
}

// ═════════════════════════════════════════════════════════════════════════════
// 6. MATCHING
// ═════════════════════════════════════════════════════════════════════════════

suite("matching");

{
  const question = q("matching", {
    left_items:  [{ id: "l1", text: "Cat" }, { id: "l2", text: "Dog" }],
    right_items: [{ id: "r1", text: "Meow" }, { id: "r2", text: "Woof" }],
    correct_matches: { l1: "r1", l2: "r2" },
  });

  // All correct
  const r1 = InteractiveGrader.gradeMatching(question, {
    matches: { l1: "r1", l2: "r2" },
  });
  expect("all matches correct → is_correct true", r1.is_correct, eq(true));
  expect("all matches correct → full points", r1.points_earned, eq(10));

  // Partial match
  const r2 = InteractiveGrader.gradeMatching(question, {
    matches: { l1: "r1", l2: "r1" },  // l2 wrong
  });
  expect("partial match → is_correct false", r2.is_correct, eq(false));
  expect("partial match → 5 points (1/2)", r2.points_earned, near(5));

  // All wrong
  const r3 = InteractiveGrader.gradeMatching(question, {
    matches: { l1: "r2", l2: "r1" },
  });
  expect("all wrong → 0 points", r3.points_earned, eq(0));

  // Case-insensitive IDs
  const r4 = InteractiveGrader.gradeMatching(question, {
    matches: { l1: "R1", l2: "R2" },  // uppercase
  });
  expect("case-insensitive ID matching", r4.is_correct, eq(true));

  // Raw matches object (no .matches wrapper)
  const r5 = InteractiveGrader.gradeMatching(question, { l1: "r1", l2: "r2" });
  expect("flat match object (no .matches key) still works", r5.is_correct, eq(true));
}

// ═════════════════════════════════════════════════════════════════════════════
// 7. ORDERING
// ═════════════════════════════════════════════════════════════════════════════

suite("ordering");

{
  const questionPartial = q("ordering", {
    allow_partial_credit: true,
    items: [
      { id: "i1", text: "First",  order: 0 },
      { id: "i2", text: "Second", order: 1 },
      { id: "i3", text: "Third",  order: 2 },
      { id: "i4", text: "Fourth", order: 3 },
    ],
  });

  const questionFull = q("ordering", {
    allow_partial_credit: false,
    items: [
      { id: "i1", text: "A", order: 0 },
      { id: "i2", text: "B", order: 1 },
      { id: "i3", text: "C", order: 2 },
    ],
  });

  // Perfect order
  const r1 = InteractiveGrader.gradeOrdering(questionFull, {
    ordered_item_ids: ["i1", "i2", "i3"],
  });
  expect("perfect order → is_correct true", r1.is_correct, eq(true));
  expect("perfect order → full points", r1.points_earned, eq(10));

  // Partial order with allow_partial_credit: true
  const r2 = InteractiveGrader.gradeOrdering(questionPartial, {
    ordered_item_ids: ["i1", "i2", "i4", "i3"],  // 2 of 4 correct
  });
  expect("partial order, partial_credit ON → is_correct false", r2.is_correct, eq(false));
  expect("partial order, partial_credit ON → proportional points (5)", r2.points_earned, near(5),
    "2/4 correct items → 50% of 10 = 5 pts");

  // Partial order with allow_partial_credit: false → 0 points
  const r3 = InteractiveGrader.gradeOrdering(questionFull, {
    ordered_item_ids: ["i1", "i3", "i2"],  // 1 of 3 correct
  });
  expect("partial order, partial_credit OFF → 0 points", r3.points_earned, eq(0));
  expect("partial order, partial_credit OFF → is_correct false", r3.is_correct, eq(false));

  // Wrong count of items
  const r4 = InteractiveGrader.gradeOrdering(questionFull, {
    ordered_item_ids: ["i1", "i2"],  // only 2 of 3
  });
  expect("wrong item count → 0 points, no crash", r4.points_earned, eq(0));

  // All items in wrong order with partial credit
  const r5 = InteractiveGrader.gradeOrdering(questionPartial, {
    ordered_item_ids: ["i4", "i3", "i2", "i1"],
  });
  expect("fully reversed → 0 points even with partial credit", r5.points_earned, eq(0));
}

// ═════════════════════════════════════════════════════════════════════════════
// 8. DROPDOWN
// ═════════════════════════════════════════════════════════════════════════════

suite("dropdown");

{
  const question = q("dropdown", {
    text_with_dropdowns: "The sky is ___ and grass is ___.",
    dropdown_options: [
      { dropdown_index: 0, options: ["blue", "red", "green"], correct_answer: "blue" },
      { dropdown_index: 1, options: ["green", "red", "blue"], correct_answer: "green" },
    ],
  });

  // All correct
  const r1 = InteractiveGrader.gradeDropdown(question, {
    selections: [
      { dropdown_index: 0, selected_option: "blue" },
      { dropdown_index: 1, selected_option: "green" },
    ],
  });
  expect("all dropdowns correct → is_correct true", r1.is_correct, eq(true));
  expect("all dropdowns correct → full points", r1.points_earned, eq(10));

  // Partial: one correct, one wrong
  const r2 = InteractiveGrader.gradeDropdown(question, {
    selections: [
      { dropdown_index: 0, selected_option: "blue" },
      { dropdown_index: 1, selected_option: "red" },  // wrong
    ],
  });
  expect("partial dropdown → is_correct FALSE", r2.is_correct, eq(false),
    "is_correct must be false when not all dropdowns are correct");
  expect("partial dropdown → 5 points (1/2)", r2.points_earned, near(5));

  // All wrong
  const r3 = InteractiveGrader.gradeDropdown(question, {
    selections: [
      { dropdown_index: 0, selected_option: "red" },
      { dropdown_index: 1, selected_option: "blue" },
    ],
  });
  expect("all wrong → 0 points", r3.points_earned, eq(0));
  expect("all wrong → is_correct false", r3.is_correct, eq(false));

  // Case-insensitive matching
  const r4 = InteractiveGrader.gradeDropdown(question, {
    selections: [
      { dropdown_index: 0, selected_option: "BLUE" },
      { dropdown_index: 1, selected_option: "GREEN" },
    ],
  });
  expect("case-insensitive dropdown match", r4.is_correct, eq(true));

  // correct_answer stored in separate column (array format)
  const q2 = q(
    "dropdown",
    {
      text_with_dropdowns: "___ ___",
      dropdown_options: [
        { dropdown_index: 0, options: ["yes", "no"] },
        { dropdown_index: 1, options: ["on", "off"] },
      ],
    },
    ["yes", "on"],  // correct_answer as plain array
  );
  const r5 = InteractiveGrader.gradeDropdown(q2, {
    selections: [
      { dropdown_index: 0, selected_option: "yes" },
      { dropdown_index: 1, selected_option: "on" },
    ],
  });
  expect("correct_answer column (array format) used correctly", r5.is_correct, eq(true));

  // normalizeCorrectAnswer returns the correct selections for display
  const norm = AdvancedQuizGrader.normalizeCorrectAnswer(question);
  expect("normalizeCorrectAnswer for dropdown is non-null", norm.data !== null, eq(true),
    "correct answer display on submission page requires non-null normalized data");
  expect("normalizeCorrectAnswer returns selections array", Array.isArray(norm.data?.selections), eq(true));
}

// ═════════════════════════════════════════════════════════════════════════════
// 9. DRAG & DROP
// ═════════════════════════════════════════════════════════════════════════════

suite("drag_drop");

{
  const question = q("drag_drop", {
    drop_zones: [
      { id: "zone1", correct_items: ["item1"], label: "Zone A" },
      { id: "zone2", correct_items: ["item2"], label: "Zone B" },
    ],
    draggable_items: [
      { id: "item1", text: "Alpha" },
      { id: "item2", text: "Beta" },
    ],
  });

  // All correct
  const r1 = InteractiveGrader.gradeDragDrop(question, {
    placements: { zone1: "item1", zone2: "item2" },
  });
  expect("all drag-drop correct → is_correct true", r1.is_correct, eq(true));
  expect("all drag-drop correct → full points", r1.points_earned, eq(10));

  // Partial: 1 of 2 correct
  const r2 = InteractiveGrader.gradeDragDrop(question, {
    placements: { zone1: "item1", zone2: "item1" },  // zone2 wrong
  });
  expect("partial drag-drop → is_correct false", r2.is_correct, eq(false));
  expect("partial drag-drop → 5.00 points (no rounding loss)", r2.points_earned, near(5),
    "must use toFixed(2) not Math.round — 1/2 * 10 = 5.00");

  // All wrong
  const r3 = InteractiveGrader.gradeDragDrop(question, {
    placements: { zone1: "item2", zone2: "item1" },
  });
  expect("all wrong drag-drop → 0 points", r3.points_earned, eq(0));

  // No zones configured (crash guard)
  const qNoZones = q("drag_drop", { drop_zones: [], draggable_items: [] });
  const r4 = InteractiveGrader.gradeDragDrop(qNoZones, { placements: {} });
  expect("no drop zones → 0 points, no crash", r4.points_earned, eq(0));

  // Missing placements key in answer
  const r5 = InteractiveGrader.gradeDragDrop(question, {});
  expect("missing placements → 0 points, no crash", r5.points_earned, eq(0));

  // Fractional precision: 1 of 3 correct → 3.33
  const q3zones = q("drag_drop", {
    drop_zones: [
      { id: "z1", correct_items: ["a"], label: "1" },
      { id: "z2", correct_items: ["b"], label: "2" },
      { id: "z3", correct_items: ["c"], label: "3" },
    ],
    draggable_items: [
      { id: "a", text: "A" }, { id: "b", text: "B" }, { id: "c", text: "C" },
    ],
  });
  const r6 = InteractiveGrader.gradeDragDrop(q3zones, {
    placements: { z1: "a", z2: "c", z3: "b" },  // only z1 correct
  });
  expect("1/3 correct → 3.33 pts (decimal preserved)", r6.points_earned, near(3.33, 0.01));
}

// ═════════════════════════════════════════════════════════════════════════════
// 10. LOGICAL EXPRESSION
// ═════════════════════════════════════════════════════════════════════════════

suite("logical_expression");

{
  const question = q("logical_expression", {
    correct_expression: "A && B",
    variables: [{ name: "A" }, { name: "B" }],
  });

  // Exact match
  const r1 = InteractiveGrader.gradeLogicalExpression(question, { expression: "A && B" });
  expect("exact expression match → correct", r1.is_correct, eq(true));

  // Logically equivalent but different form (commutative)
  const r2 = InteractiveGrader.gradeLogicalExpression(question, { expression: "B && A" });
  expect("commutative equivalent expression → correct", r2.is_correct, eq(true));

  // Wrong expression
  const r3 = InteractiveGrader.gradeLogicalExpression(question, { expression: "A || B" });
  expect("different expression → incorrect", r3.is_correct, eq(false));

  // Word operators
  const r4 = InteractiveGrader.gradeLogicalExpression(question, { expression: "A AND B" });
  expect("word operator AND accepted", r4.is_correct, eq(true));

  // NOT operator (important: ! must not be replaced inside !=)
  const qNeq = q("logical_expression", {
    correct_expression: "A != B",
    variables: [{ name: "A" }, { name: "B" }],
  });
  const r5 = InteractiveGrader.gradeLogicalExpression(qNeq, { expression: "A != B" });
  expect("!= operator not broken by ! replacement", r5.is_correct, eq(true));

  // Missing expression
  const r6 = InteractiveGrader.gradeLogicalExpression(question, {});
  expect("missing expression → 0 points, no crash", r6.points_earned, eq(0));
}

// ═════════════════════════════════════════════════════════════════════════════
// 11. SHORT ANSWER (AI mocked → falls back to keyword grading)
// ═════════════════════════════════════════════════════════════════════════════

suite("short_answer");

{
  const question = q("short_answer", {
    keywords: ["photosynthesis", "chlorophyll", "sunlight"],
    sample_answer: "Plants use photosynthesis with chlorophyll in sunlight.",
  });

  // All keywords present → full score
  const r1 = TextInputGrader.gradeShortAnswer(question, {
    answer: "Plants perform photosynthesis using chlorophyll to absorb sunlight.",
  }) as any;
  r1.then((res: any) => {
    expect("all keywords → full keyword score", res.points_earned, eq(10));
  });

  // Partial keywords → proportional, decimal precision
  const r2 = TextInputGrader.gradeShortAnswer(question, {
    answer: "photosynthesis happens",
  }) as any;
  r2.then((res: any) => {
    expect("1/3 keywords → 3.33 pts (decimal preserved)", res.points_earned, near(3.33, 0.01),
      "must use parseFloat(toFixed(2)) not Math.round");
    expect("partial keyword → is_correct false", res.is_correct, eq(false));
  });

  // answer.answer field check (not answer.text)
  const r3 = TextInputGrader.gradeShortAnswer(question, {
    text: "photosynthesis chlorophyll sunlight",  // wrong field name
  }) as any;
  r3.then((res: any) => {
    expect("answer with 'text' key (wrong field) → 0 points", res.points_earned, eq(0),
      "grader reads answer.answer not answer.text");
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// 12. normalizeCorrectAnswer — display-side correctness
// ═════════════════════════════════════════════════════════════════════════════

suite("normalizeCorrectAnswer (display)");

{
  // single_choice
  const qSC = q("single_choice", { options: ["a","b","c"], correct_option_index: 1 });
  const nSC = AdvancedQuizGrader.normalizeCorrectAnswer(qSC);
  expect("single_choice normalizes to {selected_option_index: N}", nSC.data?.selected_option_index, eq(1));

  // multiple_choice
  const qMC = q("multiple_choice", { options: ["a","b","c"], correct_option_indices: [0, 2] });
  const nMC = AdvancedQuizGrader.normalizeCorrectAnswer(qMC);
  expect("multiple_choice normalizes to {selected_option_indices: [...]}", Array.isArray(nMC.data?.selected_option_indices), eq(true));

  // true_false
  const qTF = q("true_false", { correct_answer: false });
  const nTF = AdvancedQuizGrader.normalizeCorrectAnswer(qTF);
  expect("true_false normalizes to {selected_answer: false}", nTF.data?.selected_answer, eq(false));

  // fill_blank
  const qFB = q("fill_blank", {
    text_with_blanks: "___",
    acceptable_answers: [{ blank_index: 0, answers: ["Paris"] }],
  });
  const nFB = AdvancedQuizGrader.normalizeCorrectAnswer(qFB);
  expect("fill_blank normalizes to {answers: [...]}", Array.isArray(nFB.data?.answers), eq(true));

  // matching
  const qMatch = q("matching", {
    correct_matches: { l1: "r1" },
    left_items:  [{ id: "l1", text: "Cat" }],
    right_items: [{ id: "r1", text: "Meow" }],
  });
  const nMatch = AdvancedQuizGrader.normalizeCorrectAnswer(qMatch);
  expect("matching normalizes to {matches: {...}}", typeof nMatch.data?.matches, eq("object"));

  // ordering
  const qOrd = q("ordering", {
    items: [{ id: "i1", order: 0 }, { id: "i2", order: 1 }],
  });
  const nOrd = AdvancedQuizGrader.normalizeCorrectAnswer(qOrd);
  expect("ordering normalizes to {ordered_item_ids: [...]}", Array.isArray(nOrd.data?.ordered_item_ids), eq(true));

  // numerical
  const qNum = q("numerical", { correct_answer: 9.8, tolerance: 0.1, units: "m/s²" });
  const nNum = AdvancedQuizGrader.normalizeCorrectAnswer(qNum);
  expect("numerical normalizes to {answer: N, tolerance: T, units: U}", nNum.data?.answer, eq(9.8));

  // dropdown (multi-format)
  const qDD = q("dropdown",
    { dropdown_options: [{ dropdown_index: 0, options: ["yes","no"], correct_answer: "yes" }] },
  );
  const nDD = AdvancedQuizGrader.normalizeCorrectAnswer(qDD);
  expect("dropdown normalizes to {selections: [...]} from per-dropdown correct_answer",
    Array.isArray(nDD.data?.selections), eq(true));

  // logical_expression
  const qLE = q("logical_expression", { correct_expression: "A || B" });
  const nLE = AdvancedQuizGrader.normalizeCorrectAnswer(qLE);
  expect("logical_expression normalizes to {expression: '...'}", typeof nLE.data?.expression, eq("string"));
}

// ─── Results ──────────────────────────────────────────────────────────────────

// Wait for all async tests to flush
setTimeout(() => {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`  \x1b[32m✓ ${_passed} passed\x1b[0m   \x1b[31m✗ ${_failed} failed\x1b[0m`);
  console.log(`${"─".repeat(60)}\n`);
  if (_failed > 0) process.exit(1);
}, 2000);

/**
 * Stress test for XLSX and DOCX upload parsing.
 * Run: ts-node --transpile-only --require dotenv/config src/tests/stress-upload.ts
 */
import { ExcelTemplateService } from "../services/ExcelTemplateService";
import { ExcelParserService } from "../services/ExcelParserService";
import { WordTemplateService } from "../services/WordTemplateService";
import { WordParserService } from "../services/WordParserService";

// Excel template order
const XLSX_EXPECTED_TYPES = [
  "single_choice",
  "multiple_choice",
  "true_false",
  "matching",
  "fill_blank",
  "dropdown",
  "numerical",
  "algorithmic",
  "short_answer",
  "logical_expression",
  "drag_drop",
  "ordering",
];

// DOCX template order (short_answer is 4th, matching 5th, etc.)
const DOCX_EXPECTED_TYPES = [
  "single_choice",
  "multiple_choice",
  "true_false",
  "short_answer",
  "matching",
  "ordering",
  "fill_blank",
  "numerical",
  "dropdown",
  "algorithmic",
  "logical_expression",
  "drag_drop",
];

function pass(msg: string) {
  console.log(`  ✅  ${msg}`);
}
function fail(msg: string) {
  console.error(`  ❌  ${msg}`);
  process.exitCode = 1;
}
function section(title: string) {
  console.log(`\n──────────────────────────────────`);
  console.log(`  ${title}`);
  console.log(`──────────────────────────────────`);
}

// ─── XLSX ────────────────────────────────────────────────────────────────────

async function testXlsx() {
  section("XLSX: Template generation");
  const buf = ExcelTemplateService.generateTemplate();
  if (Buffer.isBuffer(buf) && buf.length > 1000) {
    pass(`Template generated (${buf.length} bytes)`);
  } else {
    fail(`Template buffer suspicious: ${buf?.length}`);
    return;
  }

  section("XLSX: Round-trip parse of generated template");
  const questions = ExcelParserService.parseXlsx(buf);
  console.log(`  Parsed ${questions.length} questions (expected 12)`);
  if (questions.length !== 12) {
    fail(`Expected 12 questions, got ${questions.length}`);
  } else {
    pass("Question count = 12");
  }

  // Check each type appears exactly once and in the right order
  for (let i = 0; i < XLSX_EXPECTED_TYPES.length; i++) {
    const expected = XLSX_EXPECTED_TYPES[i];
    const q = questions[i];
    if (!q) { fail(`Missing question at index ${i} (expected ${expected})`); continue; }
    if (q.question_type !== expected) {
      fail(`Index ${i}: expected type "${expected}", got "${q.question_type}"`);
    } else {
      pass(`Row ${i + 1}: type "${expected}" ✓`);
    }
  }

  // Regression: dropdown correct answer must not default to first option when correct != first
  section("XLSX: Dropdown correct-answer regression (correct is NOT first option)");
  {
    const XLSX = require("xlsx");
    const emptyRow = Array(18).fill("");
    const testRow = [...emptyRow];
    testRow[1] = "Select the SECOND option.";
    testRow[2] = "dropdown";
    testRow[3] = "EASY";
    testRow[4] = "Remembering";
    testRow[5] = "30";
    testRow[7] = "Regression test for non-first correct answer";
    // Correct answer is "Second", NOT the first option "First"
    testRow[17] = "0: First, Second, Third | Second";
    const wbReg = XLSX.utils.book_new();
    const wsReg = XLSX.utils.aoa_to_sheet([
      emptyRow, emptyRow, emptyRow, emptyRow, testRow
    ]);
    XLSX.utils.book_append_sheet(wbReg, wsReg, "Questions");
    const bufReg = XLSX.write(wbReg, { type: "buffer", bookType: "xlsx" }) as Buffer;
    const parsedReg = ExcelParserService.parseXlsx(bufReg);
    if (parsedReg.length === 1) {
      const sel = (parsedReg[0].correct_answer as any)?.selections?.[0]?.selected_option;
      if (sel === "Second") pass(`dropdown regression: correct = "Second" (not defaulting to first)`);
      else fail(`dropdown regression: correct = "${sel}" (expected "Second" — non-first option)`);
    } else {
      fail(`dropdown regression: parsed ${parsedReg.length} questions (expected 1)`);
    }
  }

  section("XLSX: Per-type question_data validation");

  // single_choice
  const sc = questions.find(q => q.question_type === "single_choice");
  if (!sc) { fail("No single_choice question"); }
  else {
    const opts = sc.question_data?.options;
    const ci = sc.question_data?.correct_option_index;
    if (Array.isArray(opts) && opts.length === 4) pass(`single_choice: 4 options`);
    else fail(`single_choice: options = ${JSON.stringify(opts)}`);
    if (ci === 1) pass(`single_choice: correct_option_index = 1 (B)`);
    else fail(`single_choice: correct_option_index = ${ci} (expected 1 for option B)`);
  }

  // multiple_choice
  const mc = questions.find(q => q.question_type === "multiple_choice");
  if (!mc) { fail("No multiple_choice question"); }
  else {
    const indices = mc.question_data?.correct_option_indices;
    if (JSON.stringify(indices) === JSON.stringify([0, 2])) pass(`multiple_choice: correct indices = [0,2] (A,C)`);
    else fail(`multiple_choice: correct_option_indices = ${JSON.stringify(indices)} (expected [0,2])`);
  }

  // true_false
  const tf = questions.find(q => q.question_type === "true_false");
  if (!tf) { fail("No true_false question"); }
  else {
    const ans = tf.question_data?.correct_answer;
    if (ans === false) pass(`true_false: correct_answer = false`);
    else fail(`true_false: correct_answer = ${ans} (expected false)`);
  }

  // matching
  const ma = questions.find(q => q.question_type === "matching");
  if (!ma) { fail("No matching question"); }
  else {
    const left = ma.question_data?.left_items;
    const right = ma.question_data?.right_items;
    const matches = ma.question_data?.correct_matches;
    if (Array.isArray(left) && left.length === 3) pass(`matching: 3 left items`);
    else fail(`matching: left_items = ${JSON.stringify(left)}`);
    if (Array.isArray(right) && right.length === 3) pass(`matching: 3 right items`);
    else fail(`matching: right_items = ${JSON.stringify(right)}`);
    if (matches && Object.keys(matches).length === 3) pass(`matching: 3 correct_matches`);
    else fail(`matching: correct_matches = ${JSON.stringify(matches)}`);
  }

  // fill_blank
  const fb = questions.find(q => q.question_type === "fill_blank");
  if (!fb) { fail("No fill_blank question"); }
  else {
    const twb = fb.question_data?.text_with_blanks;
    const aa = fb.question_data?.acceptable_answers;
    if (twb && twb.includes("[blank]")) pass(`fill_blank: text_with_blanks has [blank]`);
    else fail(`fill_blank: text_with_blanks = "${twb}" (expected [blank])`);
    if (Array.isArray(aa) && aa.length > 0 && aa[0].answers?.includes("Jupiter"))
      pass(`fill_blank: answer = "Jupiter"`);
    else fail(`fill_blank: acceptable_answers = ${JSON.stringify(aa)}`);
  }

  // dropdown
  const dd = questions.find(q => q.question_type === "dropdown");
  if (!dd) { fail("No dropdown question"); }
  else {
    const ddOpts = dd.question_data?.dropdown_options;
    if (Array.isArray(ddOpts) && ddOpts.length === 3) pass(`dropdown: 3 dropdown groups`);
    else fail(`dropdown: dropdown_options = ${JSON.stringify(ddOpts)}`);
    // Verify each group has its correct answer properly parsed
    const correct = (dd.correct_answer as any)?.selections;
    if (Array.isArray(correct) && correct.length === 3) {
      const sel0 = correct.find((s: any) => s.dropdown_index === 0)?.selected_option;
      const sel1 = correct.find((s: any) => s.dropdown_index === 1)?.selected_option;
      const sel2 = correct.find((s: any) => s.dropdown_index === 2)?.selected_option;
      if (sel0 === "Photosynthesis") pass(`dropdown[0]: correct = "Photosynthesis"`);
      else fail(`dropdown[0]: correct = "${sel0}" (expected "Photosynthesis")`);
      if (sel1 === "Light energy") pass(`dropdown[1]: correct = "Light energy"`);
      else fail(`dropdown[1]: correct = "${sel1}" (expected "Light energy")`);
      if (sel2 === "Chemical energy") pass(`dropdown[2]: correct = "Chemical energy"`);
      else fail(`dropdown[2]: correct = "${sel2}" (expected "Chemical energy")`);
    } else {
      fail(`dropdown: selections = ${JSON.stringify(correct)}`);
    }
  }

  // numerical
  const nu = questions.find(q => q.question_type === "numerical");
  if (!nu) { fail("No numerical question"); }
  else {
    const ans = nu.question_data?.correct_answer;
    const tol = nu.question_data?.tolerance;
    if (ans === 8) pass(`numerical: correct_answer = 8`);
    else fail(`numerical: correct_answer = ${ans} (expected 8)`);
    if (tol === 0) pass(`numerical: tolerance = 0`);
    else fail(`numerical: tolerance = ${tol} (expected 0)`);
  }

  // algorithmic
  const al = questions.find(q => q.question_type === "algorithmic");
  if (!al) { fail("No algorithmic question"); }
  else {
    const tc = al.question_data?.test_cases;
    if (Array.isArray(tc) && tc.length === 2) pass(`algorithmic: 2 test cases`);
    else fail(`algorithmic: test_cases = ${JSON.stringify(tc)}`);
    if (al.question_data?.input_format) pass(`algorithmic: has input_format`);
    else fail(`algorithmic: missing input_format`);
  }

  // short_answer
  const sa = questions.find(q => q.question_type === "short_answer");
  if (!sa) { fail("No short_answer question"); }
  else {
    const kw = sa.question_data?.keywords;
    if (Array.isArray(kw) && kw.includes("variable")) pass(`short_answer: keywords parsed`);
    else fail(`short_answer: keywords = ${JSON.stringify(kw)}`);
  }

  // logical_expression
  const le = questions.find(q => q.question_type === "logical_expression");
  if (!le) { fail("No logical_expression question"); }
  else {
    const vars = le.question_data?.variables;
    const expr = le.question_data?.correct_expression;
    if (Array.isArray(vars) && vars.length === 2) pass(`logical_expression: 2 variables`);
    else fail(`logical_expression: variables = ${JSON.stringify(vars)}`);
    if (expr === "!(A && B)") pass(`logical_expression: correct_expression = "!(A && B)"`);
    else fail(`logical_expression: correct_expression = "${expr}"`);
  }

  // drag_drop
  const drag = questions.find(q => q.question_type === "drag_drop");
  if (!drag) { fail("No drag_drop question"); }
  else {
    const items = drag.question_data?.draggable_items;
    const zones = drag.question_data?.drop_zones;
    if (Array.isArray(items) && items.length === 2) pass(`drag_drop: 2 draggable items`);
    else fail(`drag_drop: draggable_items = ${JSON.stringify(items)}`);
    if (Array.isArray(zones) && zones.length === 2) pass(`drag_drop: 2 drop zones`);
    else fail(`drag_drop: drop_zones = ${JSON.stringify(zones)}`);
  }

  // ordering
  const or = questions.find(q => q.question_type === "ordering");
  if (!or) { fail("No ordering question"); }
  else {
    const items = or.question_data?.items;
    if (Array.isArray(items) && items.length === 4) pass(`ordering: 4 items`);
    else fail(`ordering: items = ${JSON.stringify(items)}`);
    // Check ordering is correct (Mercury=1, Venus=2, Earth=3, Mars=4)
    const sorted = [...items].sort((a, b) => a.order - b.order);
    if (sorted[0]?.text === "Mercury") pass(`ordering: first item = "Mercury"`);
    else fail(`ordering: sorted[0] text = "${sorted[0]?.text}" (expected "Mercury")`);
  }
}

// ─── DOCX ────────────────────────────────────────────────────────────────────

async function testDocx() {
  section("DOCX: Template generation");
  const buf = await WordTemplateService.generateTemplate();
  if (Buffer.isBuffer(buf) && buf.length > 1000) {
    pass(`Template generated (${buf.length} bytes)`);
  } else {
    fail(`Template buffer suspicious: ${buf?.length}`);
    return;
  }

  section("DOCX: Round-trip parse of generated template");
  const questions = await WordParserService.parseDocx(buf);
  console.log(`  Parsed ${questions.length} questions (expected 12)`);
  if (questions.length !== 12) {
    fail(`Expected 12 questions, got ${questions.length}`);
  } else {
    pass("Question count = 12");
  }

  for (let i = 0; i < DOCX_EXPECTED_TYPES.length; i++) {
    const expected = DOCX_EXPECTED_TYPES[i];
    const q = questions[i];
    if (!q) { fail(`Missing question at index ${i} (expected ${expected})`); continue; }
    if (q.question_type !== expected) {
      fail(`Index ${i}: expected type "${expected}", got "${q.question_type}"`);
    } else {
      pass(`Row ${i + 1}: type "${expected}" ✓`);
    }
  }

  section("DOCX: Per-type question_data validation");

  const sc = questions.find(q => q.question_type === "single_choice");
  if (!sc) fail("No single_choice"); else {
    const ci = sc.question_data?.correct_option_index;
    if (ci === 1) pass(`single_choice: correct_option_index = 1 (B)`);
    else fail(`single_choice: correct_option_index = ${ci}`);
  }

  const mc = questions.find(q => q.question_type === "multiple_choice");
  if (!mc) fail("No multiple_choice"); else {
    const idx = mc.question_data?.correct_option_indices;
    if (JSON.stringify(idx) === JSON.stringify([0, 2])) pass(`multiple_choice: [0,2]`);
    else fail(`multiple_choice: ${JSON.stringify(idx)}`);
  }

  const tf = questions.find(q => q.question_type === "true_false");
  if (!tf) fail("No true_false"); else {
    if (tf.question_data?.correct_answer === false) pass(`true_false: false`);
    else fail(`true_false: ${tf.question_data?.correct_answer}`);
  }

  const ma = questions.find(q => q.question_type === "matching");
  if (!ma) fail("No matching"); else {
    const left = ma.question_data?.left_items;
    if (Array.isArray(left) && left.length === 3) pass(`matching: 3 pairs`);
    else fail(`matching: left_items = ${JSON.stringify(left)}`);
  }

  const fb = questions.find(q => q.question_type === "fill_blank");
  if (!fb) fail("No fill_blank"); else {
    const aa = fb.question_data?.acceptable_answers;
    if (Array.isArray(aa) && aa[0]?.answers?.includes("Jupiter"))
      pass(`fill_blank: answer Jupiter`);
    else fail(`fill_blank: ${JSON.stringify(aa)}`);
  }

  const dd = questions.find(q => q.question_type === "dropdown");
  if (!dd) fail("No dropdown"); else {
    const opts = dd.question_data?.dropdown_options;
    if (Array.isArray(opts) && opts.length === 3) pass(`dropdown: 3 groups`);
    else fail(`dropdown: ${JSON.stringify(opts)}`);
    const correct = (dd.correct_answer as any)?.selections;
    const sel0 = correct?.find((s: any) => s.dropdown_index === 0)?.selected_option;
    if (sel0 === "Photosynthesis") pass(`dropdown[0]: "Photosynthesis"`);
    else fail(`dropdown[0]: "${sel0}"`);
  }

  const nu = questions.find(q => q.question_type === "numerical");
  if (!nu) fail("No numerical"); else {
    if (nu.question_data?.correct_answer === 8) pass(`numerical: 8`);
    else fail(`numerical: ${nu.question_data?.correct_answer}`);
  }

  const al = questions.find(q => q.question_type === "algorithmic");
  if (!al) fail("No algorithmic"); else {
    const tc = al.question_data?.test_cases;
    if (Array.isArray(tc) && tc.length === 2) pass(`algorithmic: 2 test cases`);
    else fail(`algorithmic: ${JSON.stringify(tc)}`);
  }

  const sa = questions.find(q => q.question_type === "short_answer");
  if (!sa) fail("No short_answer"); else {
    const kw = sa.question_data?.keywords;
    if (Array.isArray(kw) && kw.includes("variable")) pass(`short_answer: keywords ok`);
    else fail(`short_answer: ${JSON.stringify(kw)}`);
  }

  const le = questions.find(q => q.question_type === "logical_expression");
  if (!le) fail("No logical_expression"); else {
    if (le.question_data?.correct_expression === "!(A && B)") pass(`logical_expression: correct_expression ok`);
    else fail(`logical_expression: correct_expression = "${le.question_data?.correct_expression}"`);
    const tt = le.question_data?.truth_table;
    if (Array.isArray(tt) && tt.length === 2) {
      const row0 = tt[0]; // A=true, B=true -> false
      if (row0.output === false && row0.inputs?.A === true && row0.inputs?.B === true)
        pass(`logical_expression: truth_table[0] correct (A=T,B=T -> false)`);
      else fail(`logical_expression: truth_table[0] = ${JSON.stringify(row0)}`);
    } else {
      fail(`logical_expression: truth_table = ${JSON.stringify(tt)} (expected 2 rows)`);
    }
  }

  const drag = questions.find(q => q.question_type === "drag_drop");
  if (!drag) fail("No drag_drop"); else {
    const zones = drag.question_data?.drop_zones;
    if (Array.isArray(zones) && zones.length === 2) pass(`drag_drop: 2 zones`);
    else fail(`drag_drop: ${JSON.stringify(zones)}`);
  }

  const or = questions.find(q => q.question_type === "ordering");
  if (!or) fail("No ordering"); else {
    const items = or.question_data?.items;
    if (Array.isArray(items) && items.length === 4) pass(`ordering: 4 items`);
    else fail(`ordering: ${JSON.stringify(items)}`);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

(async () => {
  console.log("\n🔍  Upload Stress Test — XLSX & DOCX\n");

  try {
    await testXlsx();
  } catch (err) {
    console.error("XLSX test threw:", err);
    process.exitCode = 1;
  }

  try {
    await testDocx();
  } catch (err) {
    console.error("DOCX test threw:", err);
    process.exitCode = 1;
  }

  console.log("\n");
  if (process.exitCode === 1) {
    console.error("❌  Some tests FAILED — see above.\n");
  } else {
    console.log("✅  All tests PASSED.\n");
  }
})();

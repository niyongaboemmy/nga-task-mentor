/**
 * Unit tests for reportCardGrader.service — grade scaling logic.
 *
 * Run from the /server directory:
 *   ts-node src/tests/reportCardGrader.test.ts
 *
 * No database or mocks needed — pure functions only.
 */

import {
  scaleToCategory,
  averagePercentage,
  calculateSubjectGrade,
  parseAssignmentGrade,
  CATEGORY_WEIGHTS,
  AssessmentScore,
} from "../services/reportCardGrader.service";

// ─── Tiny assertion framework ────────────────────────────────────────────────

let _passed = 0;
let _failed = 0;

function suite(name: string) {
  console.log(`\n\x1b[34m▸ ${name}\x1b[0m`);
}

function expect(description: string, actual: any, matcher: (v: any) => boolean, hint?: string) {
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

const eq    = (expected: any) => (v: any) => v === expected;
const near  = (n: number, eps = 0.001) => (v: any) => typeof v === "number" && Math.abs(v - n) <= eps;
const isNull = () => (v: any) => v === null;
const isObj  = () => (v: any) => v !== null && typeof v === "object";

// ═════════════════════════════════════════════════════════════════════════════
// CATEGORY_WEIGHTS constant
// ═════════════════════════════════════════════════════════════════════════════

suite("CATEGORY_WEIGHTS — contract");

expect("CW weight is 15",  CATEGORY_WEIGHTS.CW,  eq(15));
expect("HW weight is 10",  CATEGORY_WEIGHTS.HW,  eq(10));
expect("MD weight is 25",  CATEGORY_WEIGHTS.MD,  eq(25));
expect("EOT weight is 50", CATEGORY_WEIGHTS.EOT, eq(50));
expect("weights sum to 100", CATEGORY_WEIGHTS.CW + CATEGORY_WEIGHTS.HW + CATEGORY_WEIGHTS.MD + CATEGORY_WEIGHTS.EOT, eq(100));

// ═════════════════════════════════════════════════════════════════════════════
// scaleToCategory
// ═════════════════════════════════════════════════════════════════════════════

suite("scaleToCategory — boundary values");

expect("100% in CW  → 15.00", scaleToCategory(100, "CW"),  near(15));
expect("100% in HW  → 10.00", scaleToCategory(100, "HW"),  near(10));
expect("100% in MD  → 25.00", scaleToCategory(100, "MD"),  near(25));
expect("100% in EOT → 50.00", scaleToCategory(100, "EOT"), near(50));

expect("0% in any category → 0", scaleToCategory(0, "EOT"), near(0));

suite("scaleToCategory — typical values");

expect("80% in CW  → 12.00",  scaleToCategory(80, "CW"),  near(12));
expect("80% in HW  → 8.00",   scaleToCategory(80, "HW"),  near(8));
expect("80% in MD  → 20.00",  scaleToCategory(80, "MD"),  near(20));
expect("80% in EOT → 40.00",  scaleToCategory(80, "EOT"), near(40));

expect("50% in CW  → 7.50",   scaleToCategory(50, "CW"),  near(7.5));
expect("50% in HW  → 5.00",   scaleToCategory(50, "HW"),  near(5));
expect("50% in MD  → 12.50",  scaleToCategory(50, "MD"),  near(12.5));
expect("50% in EOT → 25.00",  scaleToCategory(50, "EOT"), near(25));

expect("60% in EOT → 30.00",  scaleToCategory(60, "EOT"), near(30));
expect("75% in MD  → 18.75",  scaleToCategory(75, "MD"),  near(18.75));
expect("33.33% in HW → 3.33", scaleToCategory(33.33, "HW"), near(3.333, 0.01));

// ═════════════════════════════════════════════════════════════════════════════
// averagePercentage
// ═════════════════════════════════════════════════════════════════════════════

suite("averagePercentage — edge cases");

expect("empty array returns 0",         averagePercentage([]),                          near(0));
expect("single 0/0 entry returns 0",    averagePercentage([{ raw_score: 0, max_score: 0 }]), near(0));
expect("max_score 0 items are ignored", averagePercentage([
  { raw_score: 0, max_score: 0 },
  { raw_score: 8, max_score: 10 },
]), near(80));

suite("averagePercentage — normal usage");

expect("8/10 → 80%",              averagePercentage([{ raw_score: 8,  max_score: 10  }]), near(80));
expect("15/20 → 75%",             averagePercentage([{ raw_score: 15, max_score: 20  }]), near(75));
expect("avg of 80% and 60% → 70%",averagePercentage([
  { raw_score: 8, max_score: 10 },
  { raw_score: 6, max_score: 10 },
]), near(70));
expect("avg of 100% and 0% → 50%", averagePercentage([
  { raw_score: 10, max_score: 10 },
  { raw_score: 0,  max_score: 10 },
]), near(50));
expect("avg of 3 scores: 80, 70, 90 → 80%", averagePercentage([
  { raw_score: 8, max_score: 10 },
  { raw_score: 7, max_score: 10 },
  { raw_score: 9, max_score: 10 },
]), near(80));

// ═════════════════════════════════════════════════════════════════════════════
// parseAssignmentGrade
// ═════════════════════════════════════════════════════════════════════════════

suite("parseAssignmentGrade — valid strings");

expect('"8/10" → { raw_score: 8, max_score: 10 }',
  parseAssignmentGrade("8/10"),
  (v) => v?.raw_score === 8 && v?.max_score === 10,
);
expect('"75.5/100" → { raw_score: 75.5, max_score: 100 }',
  parseAssignmentGrade("75.5/100"),
  (v) => v?.raw_score === 75.5 && v?.max_score === 100,
);
expect('"0/50" → { raw_score: 0, max_score: 50 }',
  parseAssignmentGrade("0/50"),
  (v) => v?.raw_score === 0 && v?.max_score === 50,
);

suite("parseAssignmentGrade — invalid / missing");

expect("null returns null",              parseAssignmentGrade(null),      isNull());
expect("undefined returns null",         parseAssignmentGrade(undefined),  isNull());
expect('empty string returns null',      parseAssignmentGrade(""),         isNull());
expect('"abc/xyz" returns null',         parseAssignmentGrade("abc/xyz"),  isNull());
expect('"10" (no slash) returns null',   parseAssignmentGrade("10"),       isNull());
expect('"10/0" (max=0) returns null',    parseAssignmentGrade("10/0"),     isNull());
expect('"-1/10" parses raw_score -1',    parseAssignmentGrade("-1/10"),    (v) => v?.raw_score === -1 && v?.max_score === 10);

// ═════════════════════════════════════════════════════════════════════════════
// calculateSubjectGrade — integration
// ═════════════════════════════════════════════════════════════════════════════

suite("calculateSubjectGrade — full subject grade");

// Student scores: CW 80%, HW 60%, MD 70%, EOT 80%
// Expected scaled: CW=12, HW=6, MD=17.5, EOT=40 → total=75.5
const fullScores: AssessmentScore[] = [
  { assessment_id: 1, assessment_type: "quiz",       category: "CW",  raw_score: 8,  max_score: 10 },
  { assessment_id: 2, assessment_type: "assignment",  category: "HW",  raw_score: 6,  max_score: 10 },
  { assessment_id: 3, assessment_type: "quiz",       category: "MD",  raw_score: 14, max_score: 20 },
  { assessment_id: 4, assessment_type: "quiz",       category: "EOT", raw_score: 40, max_score: 50 },
];

const fullResult = calculateSubjectGrade(10, fullScores);

expect("subject_id is preserved",          fullResult.subject_id, eq(10));
expect("CW scaled_score = 12.00",          fullResult.categories.CW?.scaled_score,  near(12));
expect("HW scaled_score = 6.00",           fullResult.categories.HW?.scaled_score,  near(6));
expect("MD scaled_score = 17.50",          fullResult.categories.MD?.scaled_score,  near(17.5));
expect("EOT scaled_score = 40.00",         fullResult.categories.EOT?.scaled_score, near(40));
expect("total_score = 75.50",              fullResult.total_score,                  near(75.5));
expect("CW avg_percentage = 80",           fullResult.categories.CW?.avg_percentage, near(80));
expect("EOT has 1 assessment",             fullResult.categories.EOT?.assessments.length, eq(1));

suite("calculateSubjectGrade — multiple assessments per category");

// Two CW quizzes: 80% and 60% → avg 70% → scaled 10.5
const multiCW: AssessmentScore[] = [
  { assessment_id: 1, assessment_type: "quiz", category: "CW", raw_score: 8, max_score: 10 },
  { assessment_id: 2, assessment_type: "quiz", category: "CW", raw_score: 6, max_score: 10 },
];

const multiResult = calculateSubjectGrade(20, multiCW);

expect("avg of two CW scores → 70%",   multiResult.categories.CW?.avg_percentage, near(70));
expect("CW scaled_score = 10.50",       multiResult.categories.CW?.scaled_score,   near(10.5));
expect("CW has 2 assessments",          multiResult.categories.CW?.assessments.length, eq(2));
expect("total_score = 10.50",           multiResult.total_score,                   near(10.5));
expect("HW/MD/EOT categories absent",   Object.keys(multiResult.categories).length, eq(1));

suite("calculateSubjectGrade — perfect score");

const perfectScores: AssessmentScore[] = [
  { assessment_id: 1, assessment_type: "quiz", category: "CW",  raw_score: 10, max_score: 10 },
  { assessment_id: 2, assessment_type: "quiz", category: "HW",  raw_score: 10, max_score: 10 },
  { assessment_id: 3, assessment_type: "quiz", category: "MD",  raw_score: 10, max_score: 10 },
  { assessment_id: 4, assessment_type: "quiz", category: "EOT", raw_score: 10, max_score: 10 },
];

const perfectResult = calculateSubjectGrade(99, perfectScores);
expect("perfect scores total = 100.00", perfectResult.total_score, near(100));

suite("calculateSubjectGrade — zero scores");

const zeroScores: AssessmentScore[] = [
  { assessment_id: 1, assessment_type: "quiz", category: "EOT", raw_score: 0, max_score: 50 },
];

const zeroResult = calculateSubjectGrade(5, zeroScores);
expect("zero score → total = 0.00", zeroResult.total_score, near(0));

suite("calculateSubjectGrade — empty scores array");

const emptyResult = calculateSubjectGrade(1, []);
expect("empty scores → total = 0.00",          emptyResult.total_score, near(0));
expect("empty scores → no categories",          Object.keys(emptyResult.categories).length, eq(0));

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(55)}`);
console.log(
  `\x1b[32m${_passed} passed\x1b[0m  \x1b[31m${_failed} failed\x1b[0m  (${_passed + _failed} total)\n`,
);

if (_failed > 0) process.exit(1);

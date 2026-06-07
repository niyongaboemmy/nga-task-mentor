/**
 * Unit tests for ReportCard module models — schema validation only.
 *
 * Run from the /server directory:
 *   ts-node src/tests/reportCard.test.ts
 *
 * No database connection required; tests exercise static validate() helpers.
 */

import { ReportCard } from "../models/ReportCard.model";
import type { ReportCardCreationAttributes } from "../models/ReportCard.model";
import { ReportCardAttribute } from "../models/ReportCardAttribute.model";
import type { ReportCardAttributeCreationAttributes } from "../models/ReportCardAttribute.model";
import { ReportCardAssessment } from "../models/ReportCardAssessment.model";
import type { ReportCardAssessmentCreationAttributes } from "../models/ReportCardAssessment.model";

// ─── Tiny assertion framework ────────────────────────────────────────────────

let _passed = 0;
let _failed = 0;
let _currentSuite = "";

function suite(name: string) {
  _currentSuite = name;
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
const isTrue = () => (v: any) => v === true;
const isFalse = () => (v: any) => v === false;

function throws(fn: () => void, msgContains?: string): boolean {
  try {
    fn();
    return false;
  } catch (e: any) {
    if (msgContains) return e.message.includes(msgContains);
    return true;
  }
}

function noThrow(fn: () => void): boolean {
  try {
    fn();
    return true;
  } catch {
    return false;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function validCard(): ReportCardCreationAttributes {
  return {
    student_id: 1,
    term: "Term 1",
    academic_year: "2025-2026",
    attendance_present: 50,
    attendance_absent: 3,
    attendance_late: 2,
  };
}

function validAttribute(): ReportCardAttributeCreationAttributes {
  return {
    report_card_id: 1,
    attribute_name: "Punctuality",
    rating: "Excellent",
  };
}

function validAssessment(): ReportCardAssessmentCreationAttributes {
  return {
    report_card_id: 1,
    subject_id: 10,
    assessment_type: "quiz",
    assessment_id: 42,
    category: "EOT",
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// ReportCard
// ═════════════════════════════════════════════════════════════════════════════

suite("ReportCard.validate — valid input");

expect(
  "accepts a fully populated valid record",
  noThrow(() => ReportCard.validate(validCard())),
  isTrue(),
);

expect(
  "accepts a record with optional comment omitted",
  noThrow(() => ReportCard.validate({ ...validCard(), class_teacher_comment: undefined })),
  isTrue(),
);

// ─────────────────────────────────────────────────────────────────────────────
suite("ReportCard.validate — missing required fields");

expect(
  "rejects when student_id is missing",
  throws(() => ReportCard.validate({ ...validCard(), student_id: 0 }), "Student ID"),
  isTrue(),
);

expect(
  "rejects when term is empty string",
  throws(() => ReportCard.validate({ ...validCard(), term: "" }), "Term"),
  isTrue(),
);

expect(
  "rejects when term is whitespace only",
  throws(() => ReportCard.validate({ ...validCard(), term: "   " }), "Term"),
  isTrue(),
);

expect(
  "rejects when academic_year is empty",
  throws(() => ReportCard.validate({ ...validCard(), academic_year: "" }), "Academic year"),
  isTrue(),
);

// ─────────────────────────────────────────────────────────────────────────────
suite("ReportCard.validate — attendance constraints");

expect(
  "rejects negative attendance_present",
  throws(() => ReportCard.validate({ ...validCard(), attendance_present: -1 }), "negative"),
  isTrue(),
);

expect(
  "rejects negative attendance_absent",
  throws(() => ReportCard.validate({ ...validCard(), attendance_absent: -5 }), "negative"),
  isTrue(),
);

expect(
  "rejects negative attendance_late",
  throws(() => ReportCard.validate({ ...validCard(), attendance_late: -2 }), "negative"),
  isTrue(),
);

expect(
  "accepts zero values for all attendance fields",
  noThrow(() =>
    ReportCard.validate({
      ...validCard(),
      attendance_present: 0,
      attendance_absent: 0,
      attendance_late: 0,
    })
  ),
  isTrue(),
);

// ═════════════════════════════════════════════════════════════════════════════
// ReportCardAttribute
// ═════════════════════════════════════════════════════════════════════════════

suite("ReportCardAttribute.validate — valid input");

expect(
  "accepts Excellent rating",
  noThrow(() => ReportCardAttribute.validate({ ...validAttribute(), rating: "Excellent" })),
  isTrue(),
);

expect(
  "accepts Very good rating",
  noThrow(() => ReportCardAttribute.validate({ ...validAttribute(), rating: "Very good" })),
  isTrue(),
);

expect(
  "accepts Good rating",
  noThrow(() => ReportCardAttribute.validate({ ...validAttribute(), rating: "Good" })),
  isTrue(),
);

// ─────────────────────────────────────────────────────────────────────────────
suite("ReportCardAttribute.validate — invalid input");

expect(
  "rejects missing report_card_id",
  throws(() => ReportCardAttribute.validate({ ...validAttribute(), report_card_id: 0 }), "Report card ID"),
  isTrue(),
);

expect(
  "rejects empty attribute_name",
  throws(() => ReportCardAttribute.validate({ ...validAttribute(), attribute_name: "" }), "Attribute name"),
  isTrue(),
);

expect(
  "rejects whitespace-only attribute_name",
  throws(() => ReportCardAttribute.validate({ ...validAttribute(), attribute_name: "  " }), "Attribute name"),
  isTrue(),
);

expect(
  "rejects an invalid rating value",
  throws(
    () => ReportCardAttribute.validate({ ...validAttribute(), rating: "Average" as any }),
    "Rating must be one of"
  ),
  isTrue(),
);

expect(
  "rejects empty-string rating",
  throws(
    () => ReportCardAttribute.validate({ ...validAttribute(), rating: "" as any }),
    "Rating must be one of"
  ),
  isTrue(),
);

// ═════════════════════════════════════════════════════════════════════════════
// ReportCardAssessment
// ═════════════════════════════════════════════════════════════════════════════

suite("ReportCardAssessment.validate — valid input");

const assessmentTypes = ["quiz", "assignment"] as const;
const categories = ["CW", "HW", "MD", "EOT"] as const;

for (const type of assessmentTypes) {
  expect(
    `accepts assessment_type = "${type}"`,
    noThrow(() => ReportCardAssessment.validate({ ...validAssessment(), assessment_type: type })),
    isTrue(),
  );
}

for (const cat of categories) {
  expect(
    `accepts category = "${cat}"`,
    noThrow(() => ReportCardAssessment.validate({ ...validAssessment(), category: cat })),
    isTrue(),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
suite("ReportCardAssessment.validate — invalid input");

expect(
  "rejects missing report_card_id",
  throws(() => ReportCardAssessment.validate({ ...validAssessment(), report_card_id: 0 }), "Report card ID"),
  isTrue(),
);

expect(
  "rejects missing subject_id",
  throws(() => ReportCardAssessment.validate({ ...validAssessment(), subject_id: 0 }), "Subject ID"),
  isTrue(),
);

expect(
  "rejects invalid assessment_type",
  throws(
    () => ReportCardAssessment.validate({ ...validAssessment(), assessment_type: "exam" as any }),
    "Assessment type must be one of"
  ),
  isTrue(),
);

expect(
  "rejects invalid category",
  throws(
    () => ReportCardAssessment.validate({ ...validAssessment(), category: "TEST" as any }),
    "Category must be one of"
  ),
  isTrue(),
);

expect(
  "rejects missing assessment_id",
  throws(() => ReportCardAssessment.validate({ ...validAssessment(), assessment_id: 0 }), "Assessment ID"),
  isTrue(),
);

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(50)}`);
console.log(
  `\x1b[32m${_passed} passed\x1b[0m  \x1b[31m${_failed} failed\x1b[0m  (${_passed + _failed} total)\n`
);

if (_failed > 0) process.exit(1);

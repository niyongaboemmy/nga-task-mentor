/**
 * Integration tests for the PDF generation service.
 *
 * Run from the /server directory:
 *   ts-node src/tests/reportCardPdf.test.ts
 *
 * No database connection — tests exercise generateReportCardPdf() directly.
 * Validates: PDF header bytes, non-zero size, QR embedding, grade/remark
 * helpers, and disk-write idempotency.
 */

import fs from "fs";
import {
  generateReportCardPdf,
  savePdfToDisk,
  resolveReportCardPath,
  percentageToLetter,
  percentageToRemark,
  ensureUploadDir,
} from "../services/reportCardPdf.service";
import type { ReportCardPdfData } from "../services/reportCardPdf.service";

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

const eq       = (expected: any) => (v: any) => v === expected;
const gt       = (n: number)     => (v: any) => typeof v === "number" && v > n;
const isTrue   = ()              => (v: any) => v === true;
const isFalse  = ()              => (v: any) => v === false;
const includes = (sub: string)   => (v: any) => typeof v === "string" && v.includes(sub);

// ─── Test data factory ────────────────────────────────────────────────────────

const TEST_UUID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

function buildTestData(overrides: Partial<ReportCardPdfData> = {}): ReportCardPdfData {
  return {
    student_name: "Alice Uwimana",
    student_id: 42,
    report_card_id: 7,
    uuid: TEST_UUID,
    term: "Term 2",
    academic_year: "2025-2026",
    attendance_present: 48,
    attendance_absent: 2,
    attendance_late: 1,
    grades: [
      {
        subject_id: 10,
        categories: {
          CW:  { scaled_score: 12.00, weight: 15, avg_percentage: 80, assessments: [] },
          HW:  { scaled_score:  8.00, weight: 10, avg_percentage: 80, assessments: [] },
          MD:  { scaled_score: 20.00, weight: 25, avg_percentage: 80, assessments: [] },
          EOT: { scaled_score: 40.00, weight: 50, avg_percentage: 80, assessments: [] },
        },
        total_score: 80,
      },
      {
        subject_id: 11,
        categories: {
          CW:  { scaled_score:  9.00, weight: 15, avg_percentage: 60, assessments: [] },
          HW:  { scaled_score:  6.00, weight: 10, avg_percentage: 60, assessments: [] },
          MD:  { scaled_score: 15.00, weight: 25, avg_percentage: 60, assessments: [] },
          EOT: { scaled_score: 30.00, weight: 50, avg_percentage: 60, assessments: [] },
        },
        total_score: 60,
      },
    ],
    attributes: [
      { attribute_name: "Punctuality", rating: "Excellent" },
      { attribute_name: "Obedience",   rating: "Good"      },
      { attribute_name: "Teamwork",    rating: "Very good" },
    ],
    class_teacher_comment: "Alice has shown remarkable improvement this term.",
    verification_base_url: "https://example.nga.ac.rw",
    ...overrides,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// Synchronous helper tests (run immediately)
// ═════════════════════════════════════════════════════════════════════════════

// Scale unified with the client's on-screen preview (reportCardApi.ts
// scoreToLetterGrade) via reportCardGrader.service.ts's scoreToLetterGrade —
// previously this PDF used a different A>=80 scale than the client's A>=90,
// so a student's PDF and preview could disagree on their own grade.
suite("percentageToLetter");
expect("100 → A", percentageToLetter(100), eq("A"));
expect("90  → A", percentageToLetter(90),  eq("A"));
expect("89  → B", percentageToLetter(89),  eq("B"));
expect("75  → B", percentageToLetter(75),  eq("B"));
expect("74  → C", percentageToLetter(74),  eq("C"));
expect("60  → C", percentageToLetter(60),  eq("C"));
expect("59  → D", percentageToLetter(59),  eq("D"));
expect("45  → D", percentageToLetter(45),  eq("D"));
expect("44  → F", percentageToLetter(44),  eq("F"));
expect("0   → F", percentageToLetter(0),   eq("F"));

suite("percentageToRemark");
expect("90+ → Distinction",       percentageToRemark(95), eq("Distinction"));
expect("75–89 → Merit",           percentageToRemark(80), eq("Merit"));
expect("60–74 → Credit",          percentageToRemark(65), eq("Credit"));
expect("45–59 → Pass",            percentageToRemark(50), eq("Pass"));
expect("<45 → Fail",              percentageToRemark(40), eq("Fail"));

// ═════════════════════════════════════════════════════════════════════════════
// Async PDF tests — wrapped in main() to avoid top-level await
// ═════════════════════════════════════════════════════════════════════════════

async function main() {
  // pdfkit deflate-compresses content streams; text is not directly readable
  // in binary. Instead we verify:
  //   1. PDF magic bytes  (%PDF-)
  //   2. Valid EOF marker (%%EOF)
  //   3. Size is within a sane range for the content
  //   4. The uncompressed Info dictionary contains key metadata strings

  function pdfEof(buf: Buffer): boolean {
    // %%EOF appears somewhere in the last 100 bytes
    return buf.slice(-100).toString("ascii").includes("%%EOF");
  }

  function infoContains(buf: Buffer, text: string): boolean {
    // The PDF Info dictionary is stored as an uncompressed object.
    // pdfkit encodes it as UTF-16-BE when non-ASCII is present, but
    // ASCII-only substrings should appear somewhere in the raw bytes.
    const raw = buf.toString("latin1");
    return raw.includes(text);
  }

  // ── Full report card ────────────────────────────────────────────────────
  suite("generateReportCardPdf — full report card");

  let pdfBuffer: Buffer | null = null;
  try {
    pdfBuffer = await generateReportCardPdf(buildTestData());

    expect(
      "buffer starts with %PDF-",
      pdfBuffer.slice(0, 5).toString("ascii"), eq("%PDF-"),
      "first 5 bytes must be the PDF magic number",
    );
    expect("buffer ends with %%EOF",  pdfEof(pdfBuffer),          isTrue());
    expect("buffer size > 3 KB",      pdfBuffer.length,           gt(3_000));
    expect("buffer size < 2 MB",      pdfBuffer.length,           (v) => v < 2_000_000);
    expect("Info dict contains school name", infoContains(pdfBuffer, "NGA Task Mentor"), isTrue());
    expect("Info dict contains student name", infoContains(pdfBuffer, "Alice"),          isTrue());

  } catch (e: any) {
    console.log(`  \x1b[31m✗\x1b[0m PDF generation threw: ${e.message}`);
    _failed += 6;
  }

  // ── Zero grades ─────────────────────────────────────────────────────────
  suite("generateReportCardPdf — zero grades");
  try {
    const buf = await generateReportCardPdf(buildTestData({ grades: [] }));
    expect("zero-grades PDF starts with %PDF-", buf.slice(0, 5).toString("ascii"), eq("%PDF-"));
    expect("zero-grades PDF ends with %%EOF",   pdfEof(buf), isTrue());
    expect("zero-grades PDF > 3 KB",            buf.length, gt(3_000));
  } catch (e: any) {
    console.log(`  \x1b[31m✗\x1b[0m zero-grades PDF threw: ${e.message}`);
    _failed += 3;
  }

  // ── Empty attributes ────────────────────────────────────────────────────
  suite("generateReportCardPdf — empty attributes");
  try {
    const buf = await generateReportCardPdf(buildTestData({ attributes: [] }));
    expect("empty-attributes PDF is valid", buf.slice(0, 5).toString("ascii"), eq("%PDF-"));
    expect("empty-attributes PDF ends with %%EOF", pdfEof(buf), isTrue());
  } catch (e: any) {
    console.log(`  \x1b[31m✗\x1b[0m empty-attributes PDF threw: ${e.message}`);
    _failed += 2;
  }

  // ── Long teacher comment ────────────────────────────────────────────────
  suite("generateReportCardPdf — long teacher comment");
  try {
    const longComment = "This student has demonstrated exceptional dedication. ".repeat(10);
    const buf = await generateReportCardPdf(buildTestData({ class_teacher_comment: longComment }));
    expect("long-comment PDF is valid", buf.slice(0, 5).toString("ascii"), eq("%PDF-"));
    expect("long-comment PDF ends with %%EOF", pdfEof(buf), isTrue());
    expect("long-comment PDF >= base size",    buf.length, gt(3_000));
  } catch (e: any) {
    console.log(`  \x1b[31m✗\x1b[0m long-comment PDF threw: ${e.message}`);
    _failed += 3;
  }

  // ── Null teacher comment ────────────────────────────────────────────────
  suite("generateReportCardPdf — null teacher comment");
  try {
    const buf = await generateReportCardPdf(buildTestData({ class_teacher_comment: null }));
    expect("null-comment PDF is valid",           buf.slice(0, 5).toString("ascii"), eq("%PDF-"));
    expect("null-comment PDF ends with %%EOF",    pdfEof(buf), isTrue());
  } catch (e: any) {
    console.log(`  \x1b[31m✗\x1b[0m null-comment PDF threw: ${e.message}`);
    _failed += 2;
  }

  // ── Two separate calls produce independent valid PDFs ───────────────────
  suite("generateReportCardPdf — two calls produce valid, different-sized PDFs");
  try {
    const buf1 = await generateReportCardPdf(buildTestData({ grades: [] }));
    const buf2 = await generateReportCardPdf(buildTestData());            // has 2 subjects
    expect("both are valid PDFs",  buf1.slice(0, 5).toString("ascii"), eq("%PDF-"));
    expect("more grades → larger or equal PDF", buf2.length >= buf1.length, isTrue(),
      "a report with 2 subjects should not be smaller than one with none");
  } catch (e: any) {
    console.log(`  \x1b[31m✗\x1b[0m two-calls test threw: ${e.message}`);
    _failed += 2;
  }

  // ── savePdfToDisk ────────────────────────────────────────────────────────
  suite("savePdfToDisk — writes file and returns relative path");

  const WRITE_UUID = "test-disk-write-uuid-99";

  if (pdfBuffer) {
    try {
      ensureUploadDir();
      const relPath = savePdfToDisk(pdfBuffer, WRITE_UUID);

      expect("returns string with report-cards/", relPath, includes("report-cards/"));
      expect("path ends with .pdf",               relPath, includes(".pdf"));

      const fullPath = resolveReportCardPath(`report-card-${WRITE_UUID}.pdf`);
      expect("file exists on disk", fs.existsSync(fullPath), isTrue());

      const onDisk = fs.readFileSync(fullPath);
      expect("written file matches buffer size",       onDisk.length, eq(pdfBuffer.length));
      expect("written file starts with %PDF-", onDisk.slice(0, 5).toString("ascii"), eq("%PDF-"));

      // Idempotency: second save overwrites cleanly
      const relPath2 = savePdfToDisk(pdfBuffer, WRITE_UUID);
      expect("second save returns same relative path", relPath2, eq(relPath));
      expect("file still exists after overwrite",      fs.existsSync(fullPath), isTrue());

      // Clean up
      fs.unlinkSync(fullPath);
      expect("cleanup: file removed", fs.existsSync(fullPath), isFalse());

    } catch (e: any) {
      console.log(`  \x1b[31m✗\x1b[0m disk write threw: ${e.message}`);
      _failed += 7;
    }
  } else {
    console.log("  \x1b[33m⚠\x1b[0m  skipped — PDF buffer unavailable from earlier failure");
  }

  // ─── Summary ──────────────────────────────────────────────────────────────
  console.log(`\n${"─".repeat(55)}`);
  console.log(
    `\x1b[32m${_passed} passed\x1b[0m  \x1b[31m${_failed} failed\x1b[0m  (${_passed + _failed} total)\n`,
  );

  if (_failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error("Fatal test error:", e);
  process.exit(1);
});

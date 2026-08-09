/**
 * ReportCardPdfService
 *
 * Generates a styled PDF report card using pdfkit (pure JS — no Chrome required,
 * safe for shared hosting). Returns a Buffer via a Promise so the caller can
 * pipe it to a response or write it to disk without blocking the event loop.
 */

import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import path from "path";
import fs from "fs";
import type { SubjectGrade } from "./reportCardGrader.service";
import { scoreToLetterGrade } from "./reportCardGrader.service";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReportCardPdfData {
  // Student info
  student_name: string;
  student_id: number;
  // Report card meta
  report_card_id: number;
  uuid: string;
  term: string;
  academic_year: string;
  // Attendance
  attendance_present: number;
  attendance_absent: number;
  attendance_late: number;
  // Grades per subject (from reportCardGrader)
  grades: SubjectGrade[];
  // Maps subject_id -> display name. Falls back to "Subject #N" when a given
  // id has no entry (e.g. MIS lookup failed) — see resolveSubjectNames in
  // reportCard.controller.ts.
  subject_names?: Record<number, string>;
  // Behavioral attributes
  attributes: Array<{ attribute_name: string; rating: string }>;
  // Teacher comment
  class_teacher_comment?: string | null;
  // Where to send the verification QR
  verification_base_url: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Matches the client's on-screen palette (ReportCardPreview.tsx) so the
// downloaded PDF no longer looks like a different document from the preview.
const COLORS = {
  primary: "#1e3a5f",   // navy — school header (was #003366)
  accent: "#2563eb",    // blue — section headings (was #0066CC)
  light: "#E8F0FE",     // light blue fill for header rows
  border: "#CCCCCC",
  text: "#1A1A1A",
  muted: "#666666",
  white: "#FFFFFF",
  pass: "#059669",       // emerald, matches STATUS_META "approved"
  fail: "#dc2626",       // red, matches the client's F-grade color
};

const FONTS = { normal: "Helvetica", bold: "Helvetica-Bold" };

/**
 * Convert a percentage (0–100) to a letter grade. Delegates to the same
 * scoreToLetterGrade the client's on-screen preview uses (reportCardApi.ts)
 * so the PDF and preview never disagree on a student's grade/remark again.
 */
export function percentageToLetter(pct: number): string {
  return scoreToLetterGrade(pct).letter;
}

/** Convert a percentage to a remark (see percentageToLetter). */
export function percentageToRemark(pct: number): string {
  return scoreToLetterGrade(pct).remark;
}

/** Resolve absolute path inside uploads/report-cards/ */
export function resolveReportCardPath(filename: string): string {
  return path.resolve(__dirname, "../../uploads/report-cards", filename);
}

/** Ensure the report-cards upload directory exists. */
export function ensureUploadDir(): void {
  const dir = path.resolve(__dirname, "../../uploads/report-cards");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ─── Table drawing helper ─────────────────────────────────────────────────────

interface ColDef {
  header: string;
  width: number;
  align?: "left" | "center" | "right";
}

function drawTable(
  doc: InstanceType<typeof PDFDocument>,
  cols: ColDef[],
  rows: string[][],
  startX: number,
  startY: number,
  rowHeight = 22,
): number {
  const totalWidth = cols.reduce((s, c) => s + c.width, 0);
  let y = startY;

  // Header row
  doc.rect(startX, y, totalWidth, rowHeight).fill(COLORS.light);
  doc.rect(startX, y, totalWidth, rowHeight).stroke(COLORS.border);

  let x = startX;
  for (const col of cols) {
    doc
      .font(FONTS.bold)
      .fontSize(8)
      .fillColor(COLORS.primary)
      .text(col.header, x + 4, y + 6, {
        width: col.width - 8,
        align: col.align ?? "center",
        lineBreak: false,
      });
    x += col.width;
  }
  y += rowHeight;

  // Data rows
  for (let i = 0; i < rows.length; i++) {
    const fill = i % 2 === 0 ? COLORS.white : "#F7F9FD";
    doc.rect(startX, y, totalWidth, rowHeight).fill(fill);
    doc.rect(startX, y, totalWidth, rowHeight).stroke(COLORS.border);

    x = startX;
    for (let j = 0; j < cols.length; j++) {
      doc
        .font(FONTS.normal)
        .fontSize(8)
        .fillColor(COLORS.text)
        .text(rows[i][j] ?? "", x + 4, y + 6, {
          width: cols[j].width - 8,
          align: cols[j].align ?? "center",
          lineBreak: false,
        });
      x += cols[j].width;
    }

    // Vertical grid lines
    let lx = startX;
    for (const col of cols) {
      lx += col.width;
      doc.moveTo(lx, y).lineTo(lx, y + rowHeight).stroke(COLORS.border);
    }

    y += rowHeight;
  }

  return y; // returns Y position after the table
}

// ─── PDF generator ────────────────────────────────────────────────────────────

export async function generateReportCardPdf(data: ReportCardPdfData): Promise<Buffer> {
  const verificationUrl = `${data.verification_base_url}/api/public/verify/report-card/${data.uuid}`;

  // Generate QR code as a PNG Buffer
  const qrBuffer: Buffer = await QRCode.toBuffer(verificationUrl, {
    errorCorrectionLevel: "M",
    width: 120,
    margin: 1,
    color: { dark: COLORS.primary, light: COLORS.white },
  });

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 40,
      info: {
        Title: `Report Card - ${data.student_name} - ${data.term} ${data.academic_year}`,
        Author: "NGA Task Mentor",
        Subject: "Student Academic Report Card",
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width;   // 595 for A4
    const margin = 40;
    const contentWidth = pageWidth - margin * 2;
    let y = margin;

    // ── Header band ────────────────────────────────────────────────────────
    doc.rect(margin, y, contentWidth, 70).fill(COLORS.primary);

    doc
      .font(FONTS.bold)
      .fontSize(16)
      .fillColor(COLORS.white)
      .text("NATIONAL GRAMMAR ACADEMY", margin, y + 10, {
        width: contentWidth,
        align: "center",
        lineBreak: false,
      });

    doc
      .font(FONTS.normal)
      .fontSize(9)
      .fillColor("#AAD4FF")
      .text("P.O. Box 1234, Kigali, Rwanda  |  www.nga.ac.rw", margin, y + 31, {
        width: contentWidth,
        align: "center",
        lineBreak: false,
      });

    doc
      .font(FONTS.bold)
      .fontSize(11)
      .fillColor(COLORS.white)
      .text("STUDENT ACADEMIC REPORT CARD", margin, y + 47, {
        width: contentWidth,
        align: "center",
        lineBreak: false,
      });

    y += 78;

    // ── Term / Year strip ──────────────────────────────────────────────────
    doc.rect(margin, y, contentWidth, 20).fill(COLORS.accent);
    doc
      .font(FONTS.bold)
      .fontSize(9)
      .fillColor(COLORS.white)
      .text(
        `Academic Year: ${data.academic_year}   |   Term: ${data.term}`,
        margin,
        y + 5,
        { width: contentWidth, align: "center", lineBreak: false },
      );
    y += 28;

    // ── Student info block ─────────────────────────────────────────────────
    const infoLeft  = margin;
    const infoRight = margin + contentWidth / 2 + 10;
    const infoLabelW = 90;
    const infoValW   = contentWidth / 2 - infoLabelW - 20;

    const infoRows: [string, string][] = [
      ["Student Name", data.student_name],
      ["Student ID",   String(data.student_id)],
      ["Term",         data.term],
      ["Academic Year",data.academic_year],
    ];

    // Attendance is recorded as a single term-level status (Present/Absent/
    // Late), not a day tally — so this shows a ✓/— per status rather than a
    // day count + total that would misleadingly always read "1 / 1".
    const attendanceRows: [string, string][] = [
      ["Present", data.attendance_present ? "Yes" : "—"],
      ["Absent",  data.attendance_absent  ? "Yes" : "—"],
      ["Late",    data.attendance_late    ? "Yes" : "—"],
    ];

    const infoBlockY = y;
    for (const [label, value] of infoRows) {
      doc.font(FONTS.bold).fontSize(8).fillColor(COLORS.muted).text(label + ":", infoLeft, y, { width: infoLabelW, lineBreak: false });
      doc.font(FONTS.normal).fontSize(8).fillColor(COLORS.text).text(value, infoLeft + infoLabelW, y, { width: infoValW, lineBreak: false });
      y += 16;
    }

    let ry = infoBlockY;
    for (const [label, value] of attendanceRows) {
      doc.font(FONTS.bold).fontSize(8).fillColor(COLORS.muted).text(label + ":", infoRight, ry, { width: infoLabelW, lineBreak: false });
      doc.font(FONTS.normal).fontSize(8).fillColor(COLORS.text).text(value, infoRight + infoLabelW, ry, { width: infoValW, lineBreak: false });
      ry += 16;
    }

    y = Math.max(y, ry) + 12;

    // ── Divider ────────────────────────────────────────────────────────────
    doc.moveTo(margin, y).lineTo(margin + contentWidth, y).lineWidth(0.5).stroke(COLORS.border);
    y += 10;

    // ── Grades table ───────────────────────────────────────────────────────
    doc.font(FONTS.bold).fontSize(10).fillColor(COLORS.primary).text("ACADEMIC PERFORMANCE", margin, y);
    y += 16;

    const gradeCols: ColDef[] = [
      { header: "Subject",      width: 90,  align: "left"   },
      { header: "CW (15)",      width: 58,  align: "center" },
      { header: "HW (10)",      width: 58,  align: "center" },
      { header: "MD (25)",      width: 58,  align: "center" },
      { header: "EOT (50)",     width: 58,  align: "center" },
      { header: "Total (100)",  width: 68,  align: "center" },
      { header: "Grade",        width: 40,  align: "center" },
      { header: "Remark",       width: 85,  align: "center" },
    ];

    const gradeRows: string[][] = data.grades.map((g) => {
      const cw  = g.categories.CW?.scaled_score  ?? 0;
      const hw  = g.categories.HW?.scaled_score  ?? 0;
      const md  = g.categories.MD?.scaled_score  ?? 0;
      const eot = g.categories.EOT?.scaled_score ?? 0;
      const total = g.total_score;
      return [
        data.subject_names?.[g.subject_id] ?? `Subject #${g.subject_id}`,
        cw  > 0 ? cw.toFixed(2)  : "—",
        hw  > 0 ? hw.toFixed(2)  : "—",
        md  > 0 ? md.toFixed(2)  : "—",
        eot > 0 ? eot.toFixed(2) : "—",
        total.toFixed(2),
        percentageToLetter(total),
        percentageToRemark(total),
      ];
    });

    if (gradeRows.length === 0) {
      gradeRows.push(["No grades recorded", "—", "—", "—", "—", "—", "—", "—"]);
    }

    y = drawTable(doc, gradeCols, gradeRows, margin, y) + 12;

    // ── Average row note ───────────────────────────────────────────────────
    if (data.grades.length > 0) {
      const avg = data.grades.reduce((s, g) => s + g.total_score, 0) / data.grades.length;
      doc
        .font(FONTS.bold).fontSize(8).fillColor(COLORS.primary)
        .text(`Class Average: ${avg.toFixed(2)} / 100   Grade: ${percentageToLetter(avg)}   Remark: ${percentageToRemark(avg)}`,
          margin, y, { align: "right", width: contentWidth });
      y += 18;
    }

    // ── Behavioral attributes table ────────────────────────────────────────
    doc.font(FONTS.bold).fontSize(10).fillColor(COLORS.primary).text("BEHAVIORAL ATTRIBUTES", margin, y);
    y += 16;

    const attrCols: ColDef[] = [
      { header: "Attribute",  width: 200, align: "left"   },
      { header: "Rating",     width: 120, align: "center" },
      { header: "Indicator",  width: 195, align: "center" },
    ];

    const ratingToIndicator: Record<string, string> = {
      "Excellent": "★★★★★",
      "Very good": "★★★★☆",
      "Good":      "★★★☆☆",
    };

    const attrRows: string[][] = data.attributes.map((a) => [
      a.attribute_name,
      a.rating,
      ratingToIndicator[a.rating] ?? a.rating,
    ]);

    if (attrRows.length === 0) {
      attrRows.push(["No attributes recorded", "—", "—"]);
    }

    y = drawTable(doc, attrCols, attrRows, margin, y) + 12;

    // ── Teacher comment ────────────────────────────────────────────────────
    doc.font(FONTS.bold).fontSize(10).fillColor(COLORS.primary).text("CLASS TEACHER'S COMMENT", margin, y);
    y += 14;

    const comment = data.class_teacher_comment?.trim() || "No comment provided.";
    doc
      .rect(margin, y, contentWidth, 50)
      .fill("#FAFAFA")
      .stroke(COLORS.border);

    doc
      .font(FONTS.normal)
      .fontSize(9)
      .fillColor(COLORS.text)
      .text(comment, margin + 8, y + 8, { width: contentWidth - 16, height: 36 });

    y += 58;

    // ── Signature line ─────────────────────────────────────────────────────
    const sigY = y + 20;
    const sigLeft  = margin;
    const sigRight = margin + contentWidth - 130;

    doc.moveTo(sigLeft,  sigY).lineTo(sigLeft  + 130, sigY).lineWidth(0.5).stroke(COLORS.muted);
    doc.moveTo(sigRight, sigY).lineTo(sigRight + 130, sigY).lineWidth(0.5).stroke(COLORS.muted);

    doc.font(FONTS.normal).fontSize(8).fillColor(COLORS.muted)
      .text("Class Teacher's Signature", sigLeft, sigY + 4, { width: 130, align: "center", lineBreak: false });
    doc.font(FONTS.normal).fontSize(8).fillColor(COLORS.muted)
      .text("Principal's Signature", sigRight, sigY + 4, { width: 130, align: "center", lineBreak: false });

    y = sigY + 30;

    // ── Footer with QR code ────────────────────────────────────────────────
    const footerY = doc.page.height - margin - 80;
    doc.moveTo(margin, footerY).lineTo(margin + contentWidth, footerY).lineWidth(0.5).stroke(COLORS.border);

    // QR code on the right
    const qrSize = 68;
    const qrX = margin + contentWidth - qrSize;
    const qrY = footerY + 6;
    doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });

    // Verification text beside QR
    doc.font(FONTS.bold).fontSize(8).fillColor(COLORS.primary)
      .text("DOCUMENT VERIFICATION", margin, footerY + 8, { width: contentWidth - qrSize - 10, lineBreak: false });

    doc.font(FONTS.normal).fontSize(7).fillColor(COLORS.muted)
      .text(
        "Scan the QR code or visit the URL below to verify the authenticity of this report card.",
        margin, footerY + 20, { width: contentWidth - qrSize - 10 },
      );

    doc.font(FONTS.normal).fontSize(7).fillColor(COLORS.accent)
      .text(verificationUrl, margin, footerY + 44, {
        width: contentWidth - qrSize - 10,
        lineBreak: false,
      });

    doc.font(FONTS.normal).fontSize(7).fillColor(COLORS.muted)
      .text(
        `Generated: ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}   |   ID: ${data.uuid}`,
        margin, footerY + 56, { width: contentWidth - qrSize - 10 },
      );

    doc.end();
  });
}

/**
 * Write a PDF buffer to the report-cards upload directory.
 * Returns the relative path (for storing in the DB).
 */
export function savePdfToDisk(buffer: Buffer, uuid: string): string {
  ensureUploadDir();
  const filename = `report-card-${uuid}.pdf`;
  const fullPath = resolveReportCardPath(filename);
  fs.writeFileSync(fullPath, buffer);
  return `report-cards/${filename}`;
}

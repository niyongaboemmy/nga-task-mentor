import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import type { ReportCardDocument } from "./reportCardDocument";
import { currentTenantOrNull } from "../vendor/nga-tenancy";

/**
 * The term report card PDF, drawn from a ReportCardDocument (a snapshot for
 * approved/published cards, a live render otherwise). Laid out after the card
 * NGA issues today: header, student block, subject table grouped by module
 * with class average and teacher, the summary, attendance, attributes,
 * comments, grading scale, signatures and next-term date, with QR
 * verification of this exact version.
 *
 * Unapproved cards carry a "PROVISIONAL" watermark and no QR: only an
 * approved version can be verified.
 */

const C = {
  primary: "#1e3a5f",
  accent: "#2563eb",
  light: "#E8F0FE",
  zebra: "#F7F9FD",
  border: "#C9D3E3",
  text: "#1A1A1A",
  muted: "#5B6475",
  white: "#FFFFFF",
  fail: "#B42318",
  watermark: "#D92D20",
};
const F = { normal: "Helvetica", bold: "Helvetica-Bold", italic: "Helvetica-Oblique" };

const fmt = (n: number | null | undefined, digits = 0) =>
  n == null ? "" : Number.isInteger(n) && digits === 0 ? String(n) : n.toFixed(digits === 0 ? 0 : digits);
const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

export interface PdfOptions {
  /** e.g. https://taskmentor.amashuri.com — the QR points at {base}/api/public/verify/report-card/{uuid}?v= */
  verificationBaseUrl: string;
  /** Overrides the default (PROVISIONAL for anything not approved/published). */
  watermark?: string | null;
}

export const isIssued = (doc: ReportCardDocument) => doc.card.status === "approved" || doc.card.status === "published";

export function verificationUrl(doc: ReportCardDocument, base: string): string {
  const tenant = currentTenantOrNull();
  const params = new URLSearchParams({ v: String(doc.card.version) });
  if (tenant && !tenant.isPrimary) params.set("tid", String(tenant.tid));
  return `${base.replace(/\/$/, "")}/api/public/verify/report-card/${doc.card.uuid}?${params.toString()}`;
}

export async function renderReportCardPdf(doc: ReportCardDocument, opts: PdfOptions): Promise<Buffer> {
  const issued = isIssued(doc);
  const watermark = opts.watermark !== undefined ? opts.watermark : issued ? null : "PROVISIONAL";
  const url = verificationUrl(doc, opts.verificationBaseUrl);
  const qr: Buffer | null = issued
    ? await QRCode.toBuffer(url, { errorCorrectionLevel: "M", width: 120, margin: 1, color: { dark: C.primary, light: C.white } })
    : null;

  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({
      size: "A4",
      margin: 32,
      info: {
        Title: `Report Card - ${doc.student.name} - ${doc.card.term} ${doc.card.academic_year}`,
        Author: doc.school.name,
        Subject: "Student Academic Report Card",
      },
    });
    const chunks: Buffer[] = [];
    pdf.on("data", (c: Buffer) => chunks.push(c));
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);

    const M = 32;
    const W = pdf.page.width - M * 2;
    const bottom = pdf.page.height - M;
    let y = M;

    const drawWatermark = () => {
      if (!watermark) return;
      pdf.save();
      pdf.rotate(-35, { origin: [pdf.page.width / 2, pdf.page.height / 2] });
      pdf.font(F.bold).fontSize(80).fillColor(C.watermark).fillOpacity(0.08);
      pdf.text(watermark, 0, pdf.page.height / 2 - 40, { width: pdf.page.width, align: "center", lineBreak: false });
      pdf.restore();
      pdf.fillOpacity(1);
    };
    const ensure = (h: number) => {
      if (y + h > bottom) {
        pdf.addPage();
        drawWatermark();
        y = M;
      }
    };
    drawWatermark();

    // ── Header ────────────────────────────────────────────────────────────
    pdf.rect(M, y, W, 56).fill(C.primary);
    pdf.font(F.bold).fontSize(15).fillColor(C.white).text(doc.school.name, M, y + 9, { width: W, align: "center", lineBreak: false });
    if (doc.school.address_line) {
      pdf.font(F.normal).fontSize(8).fillColor("#BFD7FF").text(doc.school.address_line, M, y + 27, { width: W, align: "center", lineBreak: false });
    }
    pdf.font(F.bold).fontSize(10).fillColor(C.white).text("STUDENT ACADEMIC REPORT CARD", M, y + 40, { width: W, align: "center", lineBreak: false });
    y += 64;

    // ── Student block ─────────────────────────────────────────────────────
    const cls = [doc.student.class_name, doc.student.program_name ? `(${doc.student.program_name})` : null].filter(Boolean).join(" ");
    const left: Array<[string, string]> = [
      ["NAME", doc.student.name],
      ["REG. NO.", doc.student.registration_number ?? "—"],
    ];
    const right: Array<[string, string]> = [
      ["CLASS", cls || "—"],
      ["YEAR", `${doc.card.academic_year}  -  TERM: ${doc.card.term}`],
    ];
    const half = W / 2;
    left.forEach(([k, v], i) => {
      pdf.font(F.bold).fontSize(8).fillColor(C.muted).text(`${k}:`, M, y + i * 14, { width: 60, lineBreak: false });
      pdf.font(F.bold).fontSize(9).fillColor(C.text).text(v, M + 62, y + i * 14 - 1, { width: half - 70, lineBreak: false, ellipsis: true });
    });
    right.forEach(([k, v], i) => {
      pdf.font(F.bold).fontSize(8).fillColor(C.muted).text(`${k}:`, M + half, y + i * 14, { width: 44, lineBreak: false });
      pdf.font(F.bold).fontSize(9).fillColor(C.text).text(v, M + half + 46, y + i * 14 - 1, { width: half - 46, lineBreak: false, ellipsis: true });
    });
    y += 34;

    // ── Subject table ─────────────────────────────────────────────────────
    const w = doc.scheme.category_weights;
    const showCA = doc.scheme.show_class_average;
    const showT = doc.scheme.show_subject_teacher;
    type Col = { key: string; label: string; sub?: string; width: number; align: "left" | "center" };
    const cols: Col[] = [
      { key: "name", label: "SUBJECT", width: 0, align: "left" },
      { key: "CW", label: "CW", sub: `/${w.CW}`, width: 32, align: "center" },
      { key: "HW", label: "HW", sub: `/${w.HW}`, width: 32, align: "center" },
      { key: "MD", label: "MD", sub: `/${w.MD}`, width: 32, align: "center" },
      { key: "EOT", label: "EOT", sub: `/${w.EOT}`, width: 32, align: "center" },
      { key: "TOT", label: "TOT", sub: "/100", width: 36, align: "center" },
      { key: "GR", label: "GR", width: 28, align: "center" },
      ...(showCA ? [{ key: "CA", label: "CA", width: 30, align: "center" as const }] : []),
      ...(showT ? [{ key: "T", label: "TEACHER", width: 104, align: "left" as const }] : []),
    ];
    cols[0].width = W - cols.slice(1).reduce((a, c) => a + c.width, 0);

    const header = () => {
      ensure(26);
      pdf.rect(M, y, W, 24).fill(C.light);
      let x = M;
      for (const c of cols) {
        pdf.font(F.bold).fontSize(7.5).fillColor(C.primary).text(c.label, x + 4, y + (c.sub ? 4 : 8), { width: c.width - 8, align: c.align, lineBreak: false });
        if (c.sub) pdf.font(F.normal).fontSize(6.5).fillColor(C.muted).text(c.sub, x + 4, y + 13, { width: c.width - 8, align: c.align, lineBreak: false });
        x += c.width;
      }
      pdf.rect(M, y, W, 24).lineWidth(0.5).stroke(C.border);
      y += 24;
    };
    header();

    const cell = (text: string, x: number, width: number, rowY: number, h: number, align: "left" | "center", opts: { bold?: boolean; color?: string; size?: number } = {}) => {
      const size = opts.size ?? 7.5;
      pdf.font(opts.bold ? F.bold : F.normal).fontSize(size).fillColor(opts.color ?? C.text);
      const th = pdf.heightOfString(text || " ", { width: width - 8 });
      pdf.text(text, x + 4, rowY + Math.max(3, (h - th) / 2), { width: width - 8, align, height: h - 4, ellipsis: true });
    };

    let zebra = 0;
    const hasNamedGroups = doc.groups.some((g) => g.name);
    for (const group of doc.groups) {
      if (hasNamedGroups) {
        ensure(16);
        pdf.rect(M, y, W, 15).fill("#EEF2F8");
        pdf.font(F.bold).fontSize(7.5).fillColor(C.primary).text(group.name ?? "Other subjects", M + 4, y + 4, { width: W - 8, lineBreak: false });
        y += 15;
      }
      for (const s of group.subjects) {
        pdf.font(F.normal).fontSize(7.5);
        const nameH = Math.min(pdf.heightOfString(s.name, { width: cols[0].width - 8 }), 20);
        const h = Math.max(16, nameH + 6);
        if (y + h > bottom) {
          ensure(h + 30);
          header();
        }
        pdf.rect(M, y, W, h).fill(zebra++ % 2 ? C.zebra : C.white);
        let x = M;
        for (const c of cols) {
          const failing = s.passed === false;
          let v = "";
          if (c.key === "name") v = s.name;
          else if (c.key === "TOT") v = fmt(s.total != null ? Math.round(s.total) : null);
          else if (c.key === "GR") v = s.grade ?? "";
          else if (c.key === "CA") v = fmt(s.class_average != null ? Math.round(s.class_average) : null);
          else if (c.key === "T") v = s.teacher ?? "";
          else {
            const n = s.categories[c.key as "CW"];
            v = n == null ? "" : fmt(Math.round(n));
          }
          cell(v, x, c.width, y, h, c.align, {
            bold: c.key === "TOT" || c.key === "GR",
            color: (c.key === "TOT" || c.key === "GR") && failing ? C.fail : undefined,
            size: c.key === "T" ? 7 : 7.5,
          });
          x += c.width;
        }
        pdf.rect(M, y, W, h).lineWidth(0.3).stroke(C.border);
        y += h;
      }
    }
    if (doc.groups.length === 0) {
      ensure(18);
      pdf.font(F.italic).fontSize(8).fillColor(C.muted).text("No subjects recorded for this term.", M + 4, y + 5);
      y += 18;
    }

    // Summary row
    ensure(20);
    const sm = doc.summary;
    pdf.rect(M, y, W, 18).fill(C.light);
    pdf.font(F.bold).fontSize(8.5).fillColor(C.primary).text("AVERAGE", M + 4, y + 5, { width: 80, lineBreak: false });
    const summaryBits = [
      sm.average != null ? `${sm.average.toFixed(2)}%` : "—",
      sm.grade ? `Grade ${sm.grade}` : null,
      doc.scheme.show_position && sm.position != null ? `Position ${sm.position} of ${sm.position_of}` : null,
      showCA && sm.class_average != null ? `Class average ${sm.class_average.toFixed(2)}%` : null,
      sm.subjects_counted ? `Passed ${sm.subjects_passed}/${sm.subjects_counted}` : null,
    ].filter(Boolean).join("     ");
    pdf.text(summaryBits, M + 84, y + 5, { width: W - 88, align: "right", lineBreak: false });
    pdf.rect(M, y, W, 18).lineWidth(0.5).stroke(C.border);
    y += 26;

    // ── Attendance + attributes, side by side ─────────────────────────────
    const a = doc.attendance;
    const attRows: Array<[string, number]> = [
      ["Present", a.present],
      ["Absent", a.absent],
      ["Excused absence", a.excused],
      ["Late", a.late],
      ["Sick", a.sick],
    ];
    const attW = 170;
    const blockH = Math.max(attRows.length, doc.attributes.length) * 14 + 18;
    ensure(blockH + 4);
    const top = y;
    pdf.rect(M, y, attW, 16).fill(C.light);
    pdf.font(F.bold).fontSize(7.5).fillColor(C.primary);
    pdf.text("ATTENDANCE", M + 4, y + 5, { width: 80, lineBreak: false });
    pdf.text("DAYS", M + 90, y + 5, { width: 36, align: "center", lineBreak: false });
    pdf.text("%", M + 128, y + 5, { width: 38, align: "center", lineBreak: false });
    y += 16;
    for (const [label, n] of attRows) {
      pdf.font(F.normal).fontSize(7.5).fillColor(C.text).text(label, M + 4, y + 3, { width: 84, lineBreak: false });
      pdf.text(String(n), M + 90, y + 3, { width: 36, align: "center", lineBreak: false });
      pdf.text(a.total ? String(pct(n, a.total)) : "—", M + 128, y + 3, { width: 38, align: "center", lineBreak: false });
      pdf.moveTo(M, y + 14).lineTo(M + attW, y + 14).lineWidth(0.3).stroke(C.border);
      y += 14;
    }
    pdf.rect(M, top, attW, y - top).lineWidth(0.5).stroke(C.border);
    const attBottom = y;

    // Attributes
    const ax = M + attW + 10;
    const aw = W - attW - 10;
    const ratings = ["Excellent", "Very good", "Good"];
    let ay = top;
    pdf.rect(ax, ay, aw, 16).fill(C.light);
    pdf.font(F.bold).fontSize(7.5).fillColor(C.primary).text("GENERAL ATTRIBUTES", ax + 4, ay + 5, { width: aw - 150, lineBreak: false });
    ratings.forEach((r, i) =>
      pdf.text(r.toUpperCase(), ax + aw - 150 + i * 50, ay + 5, { width: 50, align: "center", lineBreak: false }),
    );
    ay += 16;
    if (doc.attributes.length === 0) {
      pdf.font(F.italic).fontSize(7.5).fillColor(C.muted).text("Not rated.", ax + 4, ay + 3);
      ay += 14;
    }
    for (const attr of doc.attributes) {
      pdf.font(F.normal).fontSize(7.5).fillColor(C.text).text(attr.attribute_name, ax + 4, ay + 3, { width: aw - 156, lineBreak: false, ellipsis: true });
      ratings.forEach((r, i) => {
        if (attr.rating === r) {
          pdf.font(F.bold).fontSize(9).fillColor(C.accent).text("X", ax + aw - 150 + i * 50, ay + 2, { width: 50, align: "center", lineBreak: false });
        }
      });
      pdf.moveTo(ax, ay + 14).lineTo(ax + aw, ay + 14).lineWidth(0.3).stroke(C.border);
      ay += 14;
    }
    pdf.rect(ax, top, aw, ay - top).lineWidth(0.5).stroke(C.border);
    y = Math.max(attBottom, ay) + 10;

    // ── Comments ──────────────────────────────────────────────────────────
    const commentBox = (title: string, text: string | null) => {
      const body = text?.trim() || "—";
      pdf.font(F.normal).fontSize(8);
      const h = Math.min(Math.max(pdf.heightOfString(body, { width: W - 16 }) + 22, 40), 110);
      ensure(h + 6);
      pdf.rect(M, y, W, h).lineWidth(0.5).stroke(C.border);
      pdf.font(F.bold).fontSize(7.5).fillColor(C.primary).text(title, M + 8, y + 6, { width: W - 16, lineBreak: false });
      pdf.font(F.normal).fontSize(8).fillColor(C.text).text(body, M + 8, y + 18, { width: W - 16, height: h - 22, ellipsis: true });
      y += h + 6;
    };
    commentBox("CLASS TEACHER'S COMMENT", doc.comments.class_teacher);
    if (doc.comments.head_teacher?.trim()) commentBox(`${doc.scheme.head_title.toUpperCase()}'S COMMENT`, doc.comments.head_teacher);

    // ── Grading scale + abbreviations ─────────────────────────────────────
    ensure(44);
    const bands = [...doc.scheme.bands].sort((p, q) => q.min - p.min);
    const bw = W / Math.max(bands.length, 1);
    pdf.font(F.bold).fontSize(7).fillColor(C.primary).text("GRADING SCALE", M, y, { lineBreak: false });
    y += 10;
    bands.forEach((b, i) => {
      const max = i === 0 ? 100 : bands[i - 1].min - 1;
      pdf.rect(M + i * bw, y, bw, 24).lineWidth(0.3).stroke(C.border);
      pdf.font(F.normal).fontSize(6.5).fillColor(C.muted).text(`${b.min}-${max}`, M + i * bw, y + 3, { width: bw, align: "center", lineBreak: false });
      pdf.font(F.bold).fontSize(8).fillColor(C.text).text(b.letter, M + i * bw, y + 12, { width: bw, align: "center", lineBreak: false });
    });
    y += 28;
    pdf.font(F.normal).fontSize(6.5).fillColor(C.muted).text(
      "CW: Class work   HW: Homework   MD: Midterm   EOT: End of term exam   TOT: Total   GR: Grade" +
        (showCA ? "   CA: Class average" : ""),
      M, y, { width: W, lineBreak: false },
    );
    y += 14;

    // ── Signatures + next term ────────────────────────────────────────────
    ensure(qr ? 96 : 50);
    const sigY = y + 22;
    pdf.moveTo(M, sigY).lineTo(M + 160, sigY).lineWidth(0.5).stroke(C.muted);
    pdf.moveTo(M + W - 160, sigY).lineTo(M + W, sigY).lineWidth(0.5).stroke(C.muted);
    pdf.font(F.normal).fontSize(7.5).fillColor(C.muted)
      .text("Signature of Class Teacher", M, sigY + 3, { width: 160, align: "center", lineBreak: false })
      .text(`Signature of ${doc.scheme.head_title}`, M + W - 160, sigY + 3, { width: 160, align: "center", lineBreak: false });
    y = sigY + 18;
    if (doc.next_term_begins_on) {
      const d = new Date(`${doc.next_term_begins_on}T00:00:00Z`);
      const when = d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
      pdf.font(F.bold).fontSize(8.5).fillColor(C.primary).text(`Next term begins on ${when}.`, M, y, { width: W, align: "center", lineBreak: false });
      y += 14;
    }

    // ── Verification footer ───────────────────────────────────────────────
    if (qr) {
      const qs = 58;
      ensure(qs + 6);
      pdf.image(qr, M + W - qs, y, { width: qs, height: qs });
      pdf.font(F.bold).fontSize(7).fillColor(C.primary).text("DOCUMENT VERIFICATION", M, y + 4, { width: W - qs - 10, lineBreak: false });
      pdf.font(F.normal).fontSize(6.5).fillColor(C.muted).text(
        `Scan the QR code to verify this report card (version ${doc.card.version}).`,
        M, y + 15, { width: W - qs - 10 },
      );
      pdf.font(F.normal).fontSize(6.5).fillColor(C.accent).text(url, M, y + 27, { width: W - qs - 10, lineBreak: false, ellipsis: true });
      const issuedOn = doc.card.approved_at ? new Date(doc.card.approved_at) : new Date();
      pdf.font(F.normal).fontSize(6.5).fillColor(C.muted).text(
        `Approved ${issuedOn.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}   |   ID ${doc.card.uuid}`,
        M, y + 39, { width: W - qs - 10, lineBreak: false },
      );
    } else {
      pdf.font(F.italic).fontSize(7).fillColor(C.watermark).text(
        "Provisional — not yet approved. This document can't be verified.",
        M, y + 4, { width: W, align: "center", lineBreak: false },
      );
    }

    pdf.end();
  });
}

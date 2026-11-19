import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import type { ReportCardDocument } from "./reportCardDocument";
import { currentTenantOrNull } from "../vendor/nga-tenancy";

/**
 * The term report card PDF, drawn from a ReportCardDocument (a snapshot for
 * approved/published cards, a live render otherwise), in the school's
 * identity: official logo and name, navy brand colour, then the student,
 * results by module with class average and teacher, the summary, attendance,
 * attributes, comments, grading scale, signatures and next-term date, and QR
 * verification of this exact version.
 *
 * Unapproved cards carry a "PROVISIONAL" watermark and no QR.
 */

const C = {
  navy: "#16324F",
  navySoft: "#EAF0F7",
  ink: "#0F172A",
  text: "#1E293B",
  muted: "#64748B",
  line: "#D5DEE9",
  zebra: "#F7F9FC",
  red: "#B42318",
  redSoft: "#FDECEA",
  accent: "#B03A2E",
  white: "#FFFFFF",
};
const F = { normal: "Helvetica", bold: "Helvetica-Bold", italic: "Helvetica-Oblique" };


/** Built-in logos shipped with the server (assets/branding/<logo>-logo-horizontal.png). */
export function logoPath(logo: string | null | undefined): string | null {
  if (!logo || !/^[a-z0-9-]+$/.test(logo)) return null;
  const p = path.resolve(__dirname, "../../assets/branding", `${logo}-logo-horizontal.png`);
  return fs.existsSync(p) ? p : null;
}

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);
const r0 = (n: number | null | undefined) => (n == null ? "" : String(Math.round(n)));

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
    ? await QRCode.toBuffer(url, { errorCorrectionLevel: "M", width: 140, margin: 0, color: { dark: C.navy, light: C.white } })
    : null;
  const logo = logoPath(doc.school.logo);

  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({
      size: "A4",
      margin: 30,
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

    const M = 30;
    const W = pdf.page.width - M * 2;
    const bottom = pdf.page.height - M;
    let y = M;

    const drawWatermark = () => {
      if (!watermark) return;
      pdf.save();
      pdf.rotate(-35, { origin: [pdf.page.width / 2, pdf.page.height / 2] });
      pdf.font(F.bold).fontSize(86).fillColor(C.red).fillOpacity(0.06);
      pdf.text(watermark, 0, pdf.page.height / 2 - 44, { width: pdf.page.width, align: "center", lineBreak: false });
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
    const label = (t: string, x: number, yy: number, w?: number, align: "left" | "center" | "right" = "left") =>
      pdf
        .font(F.bold)
        .fontSize(6.5)
        .fillColor(C.muted)
        .text(t.toUpperCase(), x, yy, { width: w, align, lineBreak: false, characterSpacing: 0.4 });
    drawWatermark();

    // ── Header: official logo (or name) | document title + school contacts ─
    const headH = 58;
    if (logo) {
      pdf.image(logo, M, y, { height: 58 });
    } else {
      pdf.font(F.bold).fontSize(15).fillColor(C.navy).text(doc.school.name, M, y + 12, { width: W * 0.55, lineBreak: false, ellipsis: true });
    }
    const rightW = 260;
    const rx = M + W - rightW;
    pdf.font(F.bold).fontSize(13).fillColor(C.navy).text("STUDENT REPORT CARD", rx, y + 6, { width: rightW, align: "right", lineBreak: false });
    pdf.font(F.normal).fontSize(8.5).fillColor(C.text).text(`${doc.card.term}  ·  ${doc.card.academic_year}`, rx, y + 24, {
      width: rightW,
      align: "right",
      lineBreak: false,
    });
    const contact = [doc.school.address_line, doc.school.contact_line].filter(Boolean).join("  ·  ");
    if (contact) {
      pdf.font(F.normal).fontSize(6.8).fillColor(C.muted).text(contact, rx - 40, y + 40, { width: rightW + 40, align: "right", lineBreak: false, ellipsis: true });
    }
    y += headH + 6;
    pdf.rect(M, y, W, 2.2).fill(C.navy);
    pdf.rect(M, y, 46, 2.2).fill(C.accent);
    y += 12;

    // ── Student panel ─────────────────────────────────────────────────────
    const fields: Array<[string, string]> = [
      ["Student", doc.student.name],
      ["Reg. No.", doc.student.registration_number ?? "—"],
      ["Class", doc.student.class_name ?? "—"],
      ["Programme", doc.student.program_name ?? doc.student.grade_name ?? "—"],
    ];
    const panelH = 36;
    pdf.roundedRect(M, y, W, panelH, 5).fill(C.navySoft);
    const colW = W / fields.length;
    fields.forEach(([k, v], i) => {
      const x = M + 12 + i * colW;
      label(k, x, y + 8, colW - 18);
      pdf.font(F.bold).fontSize(9.5).fillColor(C.ink).text(v, x, y + 18, { width: colW - 18, lineBreak: false, ellipsis: true });
    });
    y += panelH + 12;

    // ── Results table ─────────────────────────────────────────────────────
    const w = doc.scheme.category_weights;
    const showCA = doc.scheme.show_class_average;
    const showT = doc.scheme.show_subject_teacher;
    type Col = { key: string; label: string; sub?: string; width: number; align: "left" | "center" };
    const cols: Col[] = [
      { key: "name", label: "Subject", width: 0, align: "left" },
      { key: "CW", label: "CW", sub: `/${w.CW}`, width: 31, align: "center" },
      { key: "HW", label: "HW", sub: `/${w.HW}`, width: 31, align: "center" },
      { key: "MD", label: "MD", sub: `/${w.MD}`, width: 31, align: "center" },
      { key: "EOT", label: "EOT", sub: `/${w.EOT}`, width: 31, align: "center" },
      { key: "TOT", label: "Total", sub: "/100", width: 38, align: "center" },
      { key: "GR", label: "Grade", width: 44, align: "center" },
      ...(showCA ? [{ key: "CA", label: "Class", sub: "avg", width: 44, align: "center" as const }] : []),
      ...(showT ? [{ key: "T", label: "Teacher", width: 100, align: "left" as const }] : []),
    ];
    cols[0].width = W - cols.slice(1).reduce((a, c) => a + c.width, 0);

    const header = () => {
      ensure(26);
      pdf.rect(M, y, W, 24).fill(C.navy);
      let x = M;
      for (const c of cols) {
        pdf.font(F.bold).fontSize(7.2).fillColor(C.white).text(c.label.toUpperCase(), x + 6, y + (c.sub ? 5 : 9), {
          width: c.width - 12,
          align: c.align,
          lineBreak: false,
        });
        if (c.sub) pdf.font(F.normal).fontSize(6.3).fillColor("#BFD0E3").text(c.sub, x + 6, y + 14, { width: c.width - 12, align: c.align, lineBreak: false });
        x += c.width;
      }
      y += 24;
    };
    header();

    let zebra = 0;
    const named = doc.groups.some((g) => g.name);
    for (const group of doc.groups) {
      if (named) {
        ensure(17);
        pdf.rect(M, y, W, 16).fill(C.navySoft);
        pdf.font(F.bold).fontSize(7.3).fillColor(C.navy).text((group.name ?? "Other subjects").toUpperCase(), M + 6, y + 5, {
          width: W - 12,
          lineBreak: false,
          characterSpacing: 0.4,
        });
        y += 16;
      }
      for (const s of group.subjects) {
        pdf.font(F.normal).fontSize(7.8);
        const nameH = Math.min(pdf.heightOfString(s.name, { width: cols[0].width - 12 }), 20);
        const h = Math.max(18, nameH + 8);
        if (y + h > bottom) {
          ensure(h + 30);
          header();
        }
        pdf.rect(M, y, W, h).fill(zebra++ % 2 ? C.zebra : C.white);
        let x = M;
        const failing = s.passed === false;
        for (const c of cols) {
          if (c.key === "GR") {
            if (s.grade) {
              const pw = 22;
              const px = x + (c.width - pw) / 2;
              pdf.roundedRect(px, y + h / 2 - 6.5, pw, 13, 6.5).fill(failing ? C.redSoft : C.navySoft);
              pdf.font(F.bold).fontSize(7.6).fillColor(failing ? C.red : C.navy).text(s.grade, px, y + h / 2 - 3.6, {
                width: pw,
                align: "center",
                lineBreak: false,
              });
            }
            x += c.width;
            continue;
          }
          let v = "";
          let font = F.normal;
          let color = C.text;
          let size = 7.8;
          if (c.key === "name") {
            v = s.name;
            color = C.ink;
          } else if (c.key === "TOT") {
            v = r0(s.total);
            font = F.bold;
            color = failing ? C.red : C.ink;
            size = 8.4;
          } else if (c.key === "CA") {
            v = r0(s.class_average);
            color = C.muted;
          } else if (c.key === "T") {
            v = s.teacher ?? "";
            color = C.muted;
            size = 7;
          } else {
            v = r0(s.categories[c.key as "CW"]);
          }
          pdf.font(font).fontSize(size);
          const th = pdf.heightOfString(v || " ", { width: c.width - 12 });
          pdf.fillColor(color).text(v, x + 6, y + Math.max(4, (h - th) / 2), { width: c.width - 12, align: c.align, height: h - 4, ellipsis: true });
          x += c.width;
        }
        pdf.moveTo(M, y + h).lineTo(M + W, y + h).lineWidth(0.4).stroke(C.line);
        y += h;
      }
    }
    if (doc.groups.length === 0) {
      ensure(20);
      pdf.font(F.italic).fontSize(8).fillColor(C.muted).text("No subjects recorded for this term.", M + 6, y + 6);
      y += 20;
    }
    y += 10;

    // ── Summary tiles ─────────────────────────────────────────────────────
    const sm = doc.summary;
    const tiles: Array<[string, string, string?]> = [
      ["Average", sm.average != null ? `${sm.average.toFixed(1)}%` : "—", sm.remark ?? undefined],
      ["Grade", sm.grade ?? "—"],
      ...(doc.scheme.show_position && sm.position != null ? [["Position", `${sm.position}`, `of ${sm.position_of}`] as [string, string, string]] : []),
      ...(showCA && sm.class_average != null ? [["Class average", `${sm.class_average.toFixed(1)}%`] as [string, string]] : []),
      ["Subjects passed", `${sm.subjects_passed}/${sm.subjects_counted}`],
    ];
    ensure(48);
    const gap = 8;
    const tw = (W - gap * (tiles.length - 1)) / tiles.length;
    tiles.forEach(([k, v, sub], i) => {
      const x = M + i * (tw + gap);
      const primary = i === 0;
      pdf.roundedRect(x, y, tw, 42, 6).fill(primary ? C.navy : C.navySoft);
      pdf
        .font(F.bold)
        .fontSize(6.5)
        .fillColor(primary ? "#BFD0E3" : C.muted)
        .text(k.toUpperCase(), x + 10, y + 8, { width: tw - 20, lineBreak: false, characterSpacing: 0.4 });
      pdf.font(F.bold).fontSize(15).fillColor(primary ? C.white : C.navy).text(v, x + 10, y + 19, { width: tw - 20, lineBreak: false });
      if (sub) {
        const vw = pdf.font(F.bold).fontSize(15).widthOfString(v);
        pdf.font(F.normal).fontSize(7.2).fillColor(primary ? "#DCE6F2" : C.muted).text(sub, x + 14 + vw, y + 25, { width: tw - vw - 24, lineBreak: false, ellipsis: true });
      }
    });
    y += 54;

    // ── Attendance + attributes ───────────────────────────────────────────
    const a = doc.attendance;
    const attRows: Array<[string, number]> = [
      ["Present", a.present],
      ["Absent", a.absent],
      ["Excused", a.excused],
      ["Late", a.late],
      ["Sick", a.sick],
    ];
    const attW = 176;
    const rowH = 15;
    const blockH = 14 + Math.max(attRows.length, Math.max(doc.attributes.length, 1)) * rowH;
    ensure(blockH + 6);
    const top = y;
    label("Attendance", M, top, 90);
    label("Days", M + 96, top, 34, "center");
    label("%", M + 136, top, 40, "center");
    let ay = top + 12;
    for (const [k, n] of attRows) {
      pdf.font(F.normal).fontSize(8).fillColor(C.text).text(k, M, ay + 3.5, { width: 90, lineBreak: false });
      pdf.font(F.bold).fontSize(8).fillColor(C.ink).text(String(n), M + 96, ay + 3.5, { width: 34, align: "center", lineBreak: false });
      pdf.font(F.normal).fontSize(8).fillColor(C.muted).text(a.total ? `${pct(n, a.total)}%` : "—", M + 136, ay + 3.5, { width: 40, align: "center", lineBreak: false });
      pdf.moveTo(M, ay + rowH).lineTo(M + attW, ay + rowH).lineWidth(0.4).stroke(C.line);
      ay += rowH;
    }
    const bx = M + attW + 22;
    const bw = W - attW - 22;
    const ratings = ["Excellent", "Very good", "Good"];
    const rw = 54;
    label("General attributes", bx, top, bw - ratings.length * rw);
    ratings.forEach((r, i) => label(r, bx + bw - ratings.length * rw + i * rw, top, rw, "center"));
    let by = top + 12;
    if (doc.attributes.length === 0) {
      pdf.font(F.italic).fontSize(8).fillColor(C.muted).text("Not rated.", bx, by + 3.5);
      by += rowH;
    }
    for (const attr of doc.attributes) {
      pdf.font(F.normal).fontSize(8).fillColor(C.text).text(attr.attribute_name, bx, by + 3.5, { width: bw - ratings.length * rw - 6, lineBreak: false, ellipsis: true });
      ratings.forEach((r, i) => {
        const cx = bx + bw - ratings.length * rw + i * rw + rw / 2;
        if (attr.rating === r) pdf.circle(cx, by + 7.5, 3.8).fill(C.navy);
        else pdf.circle(cx, by + 7.5, 3.8).lineWidth(0.6).stroke(C.line);
      });
      pdf.moveTo(bx, by + rowH).lineTo(bx + bw, by + rowH).lineWidth(0.4).stroke(C.line);
      by += rowH;
    }
    y = Math.max(ay, by) + 14;

    // ── Comments ──────────────────────────────────────────────────────────
    const comment = (title: string, text: string | null) => {
      const body = text?.trim() || "—";
      pdf.font(F.normal).fontSize(8.5);
      const h = Math.min(Math.max(pdf.heightOfString(body, { width: W - 24 }) + 26, 42), 110);
      ensure(h + 8);
      pdf.roundedRect(M, y, W, h, 5).lineWidth(0.6).stroke(C.line);
      label(title, M + 12, y + 8, W - 24);
      pdf.font(F.normal).fontSize(8.5).fillColor(C.text).text(body, M + 12, y + 19, { width: W - 24, height: h - 22, ellipsis: true });
      y += h + 8;
    };
    comment("Class teacher's comment", doc.comments.class_teacher);
    if (doc.comments.head_teacher?.trim()) comment(`${doc.scheme.head_title}'s comment`, doc.comments.head_teacher);

    // ── Grading scale ─────────────────────────────────────────────────────
    ensure(44);
    label("Grading scale", M, y);
    y += 10;
    const bands = [...doc.scheme.bands].sort((p, q) => q.min - p.min);
    const bwid = W / Math.max(bands.length, 1);
    bands.forEach((b, i) => {
      const x = M + i * bwid;
      pdf.roundedRect(x + 1.5, y, bwid - 3, 22, 4).fill(C.navySoft);
      pdf.font(F.bold).fontSize(8.5).fillColor(C.navy).text(b.letter, x, y + 3.5, { width: bwid, align: "center", lineBreak: false });
      pdf
        .font(F.normal)
        .fontSize(6)
        .fillColor(C.muted)
        .text(`${b.min}–${i === 0 ? 100 : bands[i - 1].min - 1}`, x, y + 13.5, { width: bwid, align: "center", lineBreak: false });
    });
    y += 28;
    pdf
      .font(F.normal)
      .fontSize(6.3)
      .fillColor(C.muted)
      .text(
        "CW Class work · HW Homework · MD Midterm · EOT End of term exam" + (showCA ? " · Class avg: the class's average in the subject" : ""),
        M,
        y,
        { width: W, lineBreak: false },
      );
    y += 16;

    // ── Signatures + next term ────────────────────────────────────────────
    ensure(qr ? 110 : 64);
    const sigY = y + 24;
    const sigW = 150;
    pdf.moveTo(M, sigY).lineTo(M + sigW, sigY).lineWidth(0.6).stroke(C.muted);
    pdf.moveTo(M + W - sigW, sigY).lineTo(M + W, sigY).lineWidth(0.6).stroke(C.muted);
    pdf
      .font(F.normal)
      .fontSize(7.2)
      .fillColor(C.muted)
      .text("Class teacher", M, sigY + 4, { width: sigW, align: "center", lineBreak: false })
      .text(doc.scheme.head_title, M + W - sigW, sigY + 4, { width: sigW, align: "center", lineBreak: false });
    y = sigY + 20;
    if (doc.next_term_begins_on) {
      const d = new Date(`${doc.next_term_begins_on}T00:00:00Z`);
      const when = d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
      pdf.font(F.bold).fontSize(8.8).fillColor(C.navy).text(`Next term begins on ${when}`, M, y, { width: W, align: "center", lineBreak: false });
      y += 16;
    }

    // ── Footer ────────────────────────────────────────────────────────────
    ensure(qr ? 60 : 20);
    pdf.moveTo(M, y).lineTo(M + W, y).lineWidth(0.4).stroke(C.line);
    y += 8;
    if (qr) {
      const qs = 50;
      pdf.image(qr, M + W - qs, y, { width: qs, height: qs });
      const issuedOn = doc.card.approved_at ? new Date(doc.card.approved_at) : new Date();
      pdf.font(F.bold).fontSize(7.2).fillColor(C.navy).text("Verify this report card", M, y + 4, { width: W - qs - 12, lineBreak: false });
      pdf
        .font(F.normal)
        .fontSize(6.6)
        .fillColor(C.muted)
        .text(
          `Scan the code or open the link. Version ${doc.card.version}, approved ${issuedOn.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.`,
          M,
          y + 15,
          { width: W - qs - 12 },
        );
      pdf.font(F.normal).fontSize(6.4).fillColor(C.navy).text(url, M, y + 27, { width: W - qs - 12, lineBreak: false, ellipsis: true });
      pdf.font(F.normal).fontSize(6.2).fillColor(C.muted).text(`${doc.school.name}  ·  ID ${doc.card.uuid}`, M, y + 38, { width: W - qs - 12, lineBreak: false });
    } else {
      pdf.font(F.italic).fontSize(7).fillColor(C.red).text("Provisional — not yet approved. This document can't be verified.", M, y, {
        width: W,
        align: "center",
        lineBreak: false,
      });
    }

    pdf.end();
  });
}

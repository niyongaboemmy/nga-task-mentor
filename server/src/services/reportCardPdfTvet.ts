import type { ReportCardDocument } from "./reportCardDocument";
import { C, F, drawWatermark, exact, type CardArt } from "./reportCardPdfCommon";

/**
 * The TVET report card template (PDF): the RTB / CAMIS learner's assessment
 * report as TSS schools issue it.
 *
 *   school block (left) · learner block (right)
 *   LEARNER'S [TERMLY] ASSESSMENT REPORT
 *   qualification title · trade / RQF level · sector
 *   Behaviour /40 per term, then modules grouped Complementary → Core
 *   (General, Specific): code, title, weight, FA IA CA TO per term, and on
 *   the Term 3 card the year (AT, %, Re, De)
 *   TOTALS · PERCENTAGE · POSITION · Conduct · trainer's comments per term
 *   deliberation conditions · decision · abbreviations · headmaster + stamp
 *
 * Every component is out of the module weight W (learning hours); TO is out
 * of W per component assessed. Borders and type are deliberately plain, as on
 * the official card, so it photocopies cleanly.
 */

type Doc = ReportCardDocument;
type Subject = Doc["groups"][number]["subjects"][number];
type TermEntry = NonNullable<Doc["tvet"]>["terms"][number];

const INK = "#111827";
const GRID = "#4B5563";
const SOFT = "#E5E7EB";
const BAND = "#F3F4F6";

/** CAMIS order: Complementary, then CORE (General, Specific); anything uncategorised last. */
export const TVET_SECTIONS: Array<{ key: "complementary" | "general" | "specific" | null; label: string; core?: boolean }> = [
  { key: "complementary", label: "COMPLEMENTARY MODULES" },
  { key: "general", label: "GENERAL MODULES", core: true },
  { key: "specific", label: "SPECIFIC MODULES", core: true },
  { key: null, label: "OTHER MODULES" },
];

export function tvetSections(doc: Doc): Array<{ label: string; core: boolean; subjects: Subject[] }> {
  const all = doc.groups.flatMap((g) => g.subjects);
  return TVET_SECTIONS.map((s) => ({
    label: s.label,
    core: !!s.core,
    subjects: all.filter((x) => (x.category ?? null) === s.key).sort((a, b) => (a.code ?? a.name).localeCompare(b.code ?? b.name)),
  })).filter((s) => s.subjects.length > 0);
}

export const TVET_ABBREVIATIONS: Array<[string, string]> = [
  ["FA", "Formative Assessment"],
  ["IA", "Integrated Assessment"],
  ["CA", "Comprehensive Assessment"],
  ["TO", "Total Marks"],
  ["AT", "Annual Total"],
  ["Re", "Re-assessment (%)"],
  ["De", "Decision"],
  ["C", "Competent"],
  ["NYC", "Not Yet Competent"],
];

const termLabel = (t: string) => t.toUpperCase();
const of = (p: number | null, n: number | null) => (p != null && n != null ? `${p} out of ${n}` : "–");

export function drawTvetCard(pdf: PDFKit.PDFDocument, doc: Doc, art: CardArt): void {
  const tv = doc.tvet!;
  const { watermark, url, qr, logo } = art;
  const M = 22;
  const W = pdf.page.width - M * 2;
  const bottom = pdf.page.height - M;
  let y = M;
  const final = tv.final;
  const nTerms = tv.terms.length;

  drawWatermark(pdf, watermark);

  // ── Primitive: a bordered cell with one line of text that shrinks, then ellipsises, to fit.
  type Opt = { bold?: boolean; align?: "left" | "center" | "right"; fill?: string; color?: string; size?: number; border?: boolean; italic?: boolean; min?: number };
  const cell = (text: string, x: number, yy: number, w: number, h: number, o: Opt = {}) => {
    if (o.fill) pdf.rect(x, yy, w, h).fill(o.fill);
    if (o.border !== false) pdf.rect(x, yy, w, h).lineWidth(0.5).stroke(GRID);
    if (!text) return;
    const size = o.size ?? 6.6;
    pdf.font(o.bold ? F.bold : o.italic ? F.italic : F.normal);
    const room = w - 4;
    const fits = (t: string) => pdf.widthOfString(t) <= room - 1; // a hair of slack: pdfkit wraps at the exact width
    let sz = size;
    // Marks shrink as far as needed and are never cut; text shrinks a little, then ends in "…".
    const numeric = /^[\d.,%/ –-]+$/.test(text);
    const min = o.min ?? (numeric ? 3.6 : size - 0.8);
    while (sz > min && !fits(text)) pdf.fontSize((sz -= 0.2));
    pdf.fontSize(sz);
    let t = text;
    if (!fits(t) && !numeric) {
      while (t.length > 1 && !fits(`${t}…`)) t = t.slice(0, -1);
      t = `${t.trimEnd()}…`;
    }
    const align = o.align ?? "center";
    pdf.fillColor(o.color ?? INK).text(t, x + 2, yy + (h - sz) / 2 + 0.6, { width: room, align, lineBreak: false });
  };
  const ensure = (h: number) => {
    if (y + h <= bottom) return false;
    pdf.addPage();
    drawWatermark(pdf, watermark);
    y = M;
    return true;
  };

  // ── School block (left) · learner block (right) ─────────────────────────
  const school = doc.school;
  const left: Array<[string, string]> = [
    ["REPUBLIC OF RWANDA", ""],
    ["MINISTRY OF EDUCATION", ""],
    ["DISTRICT: ", tv.school.district || "–"],
    ["SCHOOL NAME: ", school.name.toUpperCase()],
    ...(tv.school.email ? [["SCHOOL EMAIL: ", tv.school.email] as [string, string]] : []),
    ...(tv.school.phone ? [["TEL: ", tv.school.phone] as [string, string]] : []),
    ...(!tv.school.email && !tv.school.phone && school.contact_line ? [["", school.contact_line] as [string, string]] : []),
  ];
  const right: Array<[string, string]> = [
    ["ACADEMIC YEAR: ", doc.card.academic_year],
    ...(final ? [] : [["TERM: ", doc.card.term] as [string, string]]),
    ["CLASS: ", doc.student.class_name ?? "–"],
    ["LEARNER'S NAME: ", doc.student.name.toUpperCase()],
    ["SDMS ID No: ", doc.student.registration_number ?? "–"],
  ];
  const lh = 10.5;
  const headH = Math.max(left.length, right.length) * lh + 12;
  pdf.rect(M, y, W, headH).lineWidth(0.6).stroke(GRID);
  const line = (k: string, v: string, x: number, yy: number, w: number, align: "left" | "right") => {
    pdf.font(F.bold).fontSize(7.4).fillColor(INK);
    const text = `${k}${v}`;
    pdf.text(text, x, yy, { width: w, align, lineBreak: false, ellipsis: true });
  };
  left.forEach(([k, v], i) => line(k, v, M + 8, y + 7 + i * lh, W * 0.48, "left"));
  right.forEach(([k, v], i) => line(k, v, M + W * 0.5, y + 7 + i * lh, W * 0.5 - 8, "right"));
  if (logo) pdf.image(logo, M + W * 0.5 - 60, y + headH / 2 - 15, { fit: [120, 30], align: "center", valign: "center" });
  y += headH;

  // ── Title ────────────────────────────────────────────────────────────────
  cell(final ? "LEARNER'S ASSESSMENT REPORT" : "LEARNER'S TERMLY ASSESSMENT REPORT", M, y, W, 22, { bold: true, size: 12 });
  y += 22;

  // ── Qualification ────────────────────────────────────────────────────────
  const q = doc.qualification;
  const half = W / 2;
  const qRow = (a: [string, string], b: [string, string]) => {
    cell(`${a[0]}: ${a[1]}`, M, y, half, 15, { bold: true, align: "left", size: 7, min: 5.4 });
    cell(`${b[0]}: ${b[1]}`, M + half, y, half, 15, { bold: true, align: "left", size: 7, min: 5.4 });
    y += 15;
  };
  qRow(["QUALIFICATION TITLE", q?.title || "–"], ["TRADE", q?.trade || doc.student.program_name || "–"]);
  qRow(["RQF LEVEL", q?.rqf_level ? `Level ${q.rqf_level}` : "–"], ["SECTOR", q?.sector || "–"]);
  y += 6;

  // ── Columns ──────────────────────────────────────────────────────────────
  // Final: code, title, weight, [FA IA CA TO] x terms, AT % Re De. Termly: code, title, weight, FA IA CA TO, % De.
  const comp = final ? [22, 20, 23, 26] : [44, 44, 44, 48];
  const tail = final ? [30, 28, 14, 18] : [42, 48];
  const codeW = final ? 46 : 58;
  const wtW = final ? 26 : 38;
  const termW = comp.reduce((a, b) => a + b, 0);
  const tailW = tail.reduce((a, b) => a + b, 0);
  const titleW = W - codeW - wtW - termW * nTerms - tailW;
  const xCode = M;
  const xTitle = xCode + codeW;
  const xWt = xTitle + titleW;
  const xTerm = (i: number) => xWt + wtW + i * termW;
  const xComp = (i: number, k: number) => xTerm(i) + comp.slice(0, k).reduce((a, b) => a + b, 0);
  const xTail = xTerm(nTerms);
  const xTailCol = (k: number) => xTail + tail.slice(0, k).reduce((a, b) => a + b, 0);
  const fs = final ? 6.3 : 7.2;
  const rowH = final ? 14 : 15.5;

  const conductStr = (v: number | null) => (v != null ? `${exact(v)}/${doc.behaviour?.max ?? 40}` : "–");
  const header = () => {
    // Row A: Behaviour | MAX | TERM n... | Annual (or %/De)
    const h1 = 13;
    cell("Behavior", xCode, y, codeW + titleW, h1 * 2, { bold: true, size: 7.2 });
    cell("MAX", xWt, y, wtW, h1, { bold: true });
    cell(String(doc.behaviour?.max ?? 40), xWt, y + h1, wtW, h1, { bold: true });
    tv.terms.forEach((t, i) => {
      cell(termLabel(t.term), xTerm(i), y, termW, h1, { bold: true });
      cell(conductStr(t.conduct), xTerm(i), y + h1, termW, h1, { bold: true });
    });
    if (final) {
      cell("Annual", xTail, y, tailW, h1, { bold: true });
      cell(conductStr(tv.annual?.conduct ?? null), xTail, y + h1, tailW, h1, { bold: true });
    } else {
      cell("Term", xTail, y, tailW, h1, { bold: true });
      cell(tv.terms[0]?.totals.pct != null ? `${exact(tv.terms[0].totals.pct)}%` : "–", xTail, y + h1, tailW, h1, { bold: true });
    }
    y += h1 * 2;
    // Row C: column names
    const h2 = 14;
    cell("Module", xCode, y, codeW, h2, { bold: true, align: "left" });
    cell("Module Title", xTitle, y, titleW, h2, { bold: true, align: "left" });
    cell("Weight", xWt, y, wtW, h2, { bold: true });
    tv.terms.forEach((_, i) => ["FA", "IA", "CA", "TO"].forEach((k, j) => cell(k, xComp(i, j), y, comp[j], h2, { bold: true })));
    (final ? ["AT", "%", "Re", "De"] : ["%", "Decision"]).forEach((k, j) => cell(k, xTailCol(j), y, tail[j], h2, { bold: true }));
    y += h2;
  };
  ensure(80);
  header();

  const band = (label: string, fill?: string) => {
    if (ensure(rowH + 4)) header();
    cell(label, M, y, W, rowH, { bold: true, align: "left", fill, size: 7.2 });
    y += rowH;
  };
  const num = (v: number | null | undefined, na = false) => (v != null ? exact(v) : na ? "N/A" : "–");
  const tone = (v: number | null | undefined) => (v != null ? INK : C.muted);
  const competence = (c: boolean | null | undefined) => (c == null ? "–" : c ? "C" : "NYC");

  const sections = tvetSections(doc);
  let coreShown = false;
  for (const sec of sections) {
    if (sec.core && !coreShown) {
      band("CORE MODULES", SOFT);
      coreShown = true;
    }
    band(sec.label);
    for (const s of sec.subjects) {
      if (ensure(rowH)) header();
      const t = s.tvet;
      cell(s.code ?? "", xCode, y, codeW, rowH, { align: "left", size: fs });
      cell(s.name, xTitle, y, titleW, rowH, { align: "left", size: fs, color: s.mapped === false ? C.muted : INK });
      cell(t ? exact(t.weight) : "–", xWt, y, wtW, rowH, { size: fs });
      tv.terms.forEach((_, i) => {
        const c = t?.terms[i] ?? null;
        cell(num(c?.fa), xComp(i, 0), y, comp[0], rowH, { size: fs, color: tone(c?.fa) });
        cell(num(c?.ia, true), xComp(i, 1), y, comp[1], rowH, { size: fs, color: c?.ia != null ? INK : "#9CA3AF" });
        cell(num(c?.ca), xComp(i, 2), y, comp[2], rowH, { size: fs, color: tone(c?.ca) });
        cell(num(c?.to), xComp(i, 3), y, comp[3], rowH, { size: fs, bold: c?.to != null, color: tone(c?.to) });
      });
      if (final) {
        const a = t?.annual ?? null;
        cell(num(a?.at), xTailCol(0), y, tail[0], rowH, { size: fs, bold: a?.at != null, color: tone(a?.at) });
        cell(a?.pct != null ? `${exact(a.pct)}%` : "–", xTailCol(1), y, tail[1], rowH, { size: fs, color: tone(a?.pct) });
        cell("", xTailCol(2), y, tail[2], rowH);
        cell(competence(a?.competent), xTailCol(3), y, tail[3], rowH, { size: fs, bold: a?.competent === false, color: a?.competent === false ? C.red : INK });
      } else {
        const c = t?.terms[0] ?? null;
        cell(c?.pct != null ? `${exact(c.pct)}%` : "–", xTailCol(0), y, tail[0], rowH, { size: fs, color: tone(c?.pct) });
        cell(s.competent == null ? "–" : s.competent ? "Competent" : "NYC", xTailCol(1), y, tail[1], rowH, {
          size: fs,
          bold: s.competent === false,
          color: s.competent === false ? C.red : s.competent == null ? C.muted : INK,
        });
      }
      y += rowH;
    }
  }
  if (!sections.length) band("No modules recorded for this term.");

  // ── Totals, percentage, position, conduct, comments ─────────────────────
  const labelW = codeW + titleW;
  const sumRow = (label: string, h = rowH) => {
    if (ensure(h)) header();
    cell(label, xCode, y, labelW, h, { bold: true, align: "left", size: 7.2 });
  };
  // TOTALS: the weight column holds the maximum (the year's on a Term 3 card).
  sumRow("TOTALS");
  const maxTotal = final ? tv.annual?.max ?? null : tv.terms[0]?.totals.max ?? null;
  cell(maxTotal != null ? exact(maxTotal) : "–", xWt, y, wtW, rowH, { bold: true, size: fs });
  tv.terms.forEach((t, i) => {
    cell(num(t.totals.fa), xComp(i, 0), y, comp[0], rowH, { bold: true, size: fs });
    cell(num(t.totals.ia, true), xComp(i, 1), y, comp[1], rowH, { bold: t.totals.ia != null, size: fs, color: t.totals.ia != null ? INK : "#9CA3AF" });
    cell(num(t.totals.ca), xComp(i, 2), y, comp[2], rowH, { bold: true, size: fs });
    cell(num(t.totals.to), xComp(i, 3), y, comp[3], rowH, { bold: true, size: fs });
  });
  if (final) {
    cell(num(tv.annual?.total), xTailCol(0), y, tail[0], rowH, { bold: true, size: fs });
    cell(tv.annual?.pct != null ? `${exact(tv.annual.pct)}%` : "–", xTailCol(1), y, tail[1], rowH, { bold: true, size: fs });
    cell("", xTailCol(2), y, tail[2] + tail[3], rowH);
  } else cell("", xTail, y, tailW, rowH);
  y += rowH;

  const spanRow = (label: string, termVal: (t: TermEntry) => string, annualVal: string, h = rowH) => {
    sumRow(label, h);
    cell("", xWt, y, wtW, h);
    tv.terms.forEach((t, i) => cell(termVal(t), xTerm(i), y, termW, h, { bold: true, size: fs + 0.4 }));
    cell(annualVal, xTail, y, tailW, h, { bold: true, size: fs + 0.4 });
    y += h;
  };
  spanRow("PERCENTAGE", (t) => (t.totals.pct != null ? `${exact(t.totals.pct)}%` : "–"), final ? (tv.annual?.pct != null ? `${exact(tv.annual.pct)}%` : "–") : "");
  if (doc.scheme.show_position) spanRow("POSITION", (t) => of(t.position, t.position_of), final ? of(tv.annual?.position ?? null, tv.annual?.position_of ?? null) : "");
  spanRow("Conduct", (t) => conductStr(t.conduct), final ? conductStr(tv.annual?.conduct ?? null) : "");

  // Class trainer's comments & signature: one cell per term.
  const cH = 40;
  if (ensure(cH)) header();
  cell("", xCode, y, labelW + wtW, cH);
  pdf.font(F.bold).fontSize(7.2).fillColor(INK).text("Class Trainer's\nComments &\nsignature:", xCode + 4, y + 6, { width: labelW - 8 });
  tv.terms.forEach((t, i) => {
    cell("", xTerm(i), y, termW, cH);
    if (t.comment?.trim()) pdf.font(F.normal).fontSize(5.8).fillColor(C.text).text(t.comment.trim(), xTerm(i) + 3, y + 3, { width: termW - 6, height: cH - 6, ellipsis: true });
  });
  cell("", xTail, y, tailW, cH);
  y += cH + 6;

  // ── Optional: attendance and general attributes (school additions) ──────
  if (tv.show_attendance || (tv.show_attributes && doc.attributes.length)) {
    const parts: string[] = [];
    if (tv.show_attendance) {
      const a = doc.attendance;
      parts.push(`Attendance: present ${a.present}, absent ${a.absent}, excused ${a.excused}, late ${a.late}, sick ${a.sick} (of ${a.total} days)`);
    }
    if (tv.show_attributes && doc.attributes.length) parts.push(`General attributes: ${doc.attributes.map((x) => `${x.attribute_name} – ${x.rating}`).join("; ")}`);
    const text = parts.join("\n");
    pdf.font(F.normal).fontSize(6.6);
    const h = pdf.heightOfString(text, { width: W - 12 }) + 8;
    ensure(h + 4);
    pdf.rect(M, y, W, h).lineWidth(0.5).stroke(GRID);
    pdf.fillColor(C.text).text(text, M + 6, y + 4, { width: W - 12 });
    y += h + 6;
  }

  // ── Footer: conditions · decision · abbreviations · headmaster + stamp ──
  const fH = 78;
  ensure(fH + 14);
  const fw = [W * 0.27, W * 0.12, W * 0.33, W * 0.28];
  const fx = (i: number) => M + fw.slice(0, i).reduce((a, b) => a + b, 0);
  fw.forEach((w, i) => pdf.rect(fx(i), y, w, fH).lineWidth(0.6).stroke(GRID));
  const title = (t: string, i: number) => pdf.font(F.bold).fontSize(7).fillColor(INK).text(t, fx(i) + 6, y + 6, { width: fw[i] - 12, lineBreak: false });
  title("Deliberation Conditions:", 0);
  let cy = y + 18;
  tv.conditions.forEach((c, i) => {
    pdf.font(F.normal).fontSize(6.3).fillColor(C.text);
    const t = `${i + 1}. ${c}`;
    const h = pdf.heightOfString(t, { width: fw[0] - 12 });
    pdf.text(t, fx(0) + 6, cy, { width: fw[0] - 12 });
    cy += h + 2;
  });
  title("Decision:", 1);
  pdf
    .font(F.bold)
    .fontSize(7.4)
    .fillColor(tv.decision && tv.decision !== "Promoted" && tv.decision !== "Graduated" ? C.red : INK)
    .text(final ? (tv.decision ?? "–") : "–", fx(1) + 6, y + 20, { width: fw[1] - 12 });
  title("Abbreviation", 2);
  const ab = TVET_ABBREVIATIONS.filter(([k]) => final || !["AT", "Re"].includes(k));
  const colX = [0, (fw[2] - 12) * 0.6];
  const perCol = Math.ceil(ab.length / 2);
  ab.forEach(([k, v], i) => {
    const col = Math.floor(i / perCol);
    const ry = y + 18 + (i % perCol) * 9.5;
    const x = fx(2) + 6 + colX[col];
    pdf.font(F.bold).fontSize(6.2).fillColor(INK).text(`${k}: `, x, ry, { continued: true, lineBreak: false });
    pdf.font(F.normal).text(v, { lineBreak: false });
  });
  title("Headmaster's Names and Signature:", 3);
  if (tv.school.headmaster) pdf.font(F.normal).fontSize(7).fillColor(INK).text(tv.school.headmaster, fx(3) + 6, y + 18, { width: fw[3] - 12, lineBreak: false, ellipsis: true });
  pdf.save();
  const stW = qr ? fw[3] - 66 : fw[3] - 16;
  pdf.roundedRect(fx(3) + 6, y + 30, stW, fH - 36, 4).dash(2, { space: 2 }).lineWidth(0.5).stroke("#9CA3AF");
  pdf.restore();
  pdf.undash();
  pdf.font(F.normal).fontSize(5.8).fillColor("#9CA3AF").text("School stamp", fx(3) + 6, y + 30 + (fH - 36) / 2 - 3, { width: stW, align: "center", lineBreak: false });
  if (qr) pdf.image(qr, fx(3) + fw[3] - 54, y + fH - 54, { width: 46, height: 46 });
  y += fH + 4;

  // ── Next term + verification line ───────────────────────────────────────
  const bits: string[] = [];
  if (doc.next_term_begins_on) {
    const d = new Date(`${doc.next_term_begins_on}T00:00:00Z`);
    bits.push(`Next term begins on ${d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}.`);
  }
  if (qr) bits.push(`Verify: scan the code or open ${url} (version ${doc.card.version}).`);
  else bits.push("Provisional: not yet approved, so this report can't be verified.");
  pdf.font(F.normal).fontSize(6).fillColor(qr ? C.muted : C.red).text(bits.join("  ·  "), M, Math.min(y, bottom - 8), { width: W, lineBreak: false, ellipsis: true });
}

import PDFDocument from "pdfkit";
import type { ReportCardDocument } from "./reportCardDocument";
import { C, F, cardArt, collect, exact, logoPath, type CardArt, type PdfOptions } from "./reportCardPdfCommon";
import { drawNormalCard } from "./reportCardPdfNormal";
import { drawTvetCard } from "./reportCardPdfTvet";

export { exact, isIssued, logoPath, verificationUrl, type PdfOptions } from "./reportCardPdfCommon";

/**
 * Report card PDFs, drawn from a ReportCardDocument (a snapshot for
 * approved/published cards, a live render otherwise) with the template of the
 * builder the card was made with: Normal (reportCardPdfNormal.ts) or TVET /
 * CAMIS (reportCardPdfTvet.ts). A snapshot without a builder is Normal.
 *
 * Unapproved cards carry a "PROVISIONAL" watermark and no QR.
 */

/** Draws one card, in its builder's template, from the top of the current page. */
export function drawCard(pdf: PDFKit.PDFDocument, doc: ReportCardDocument, art: CardArt): void {
  if (doc.builder === "tvet" && doc.tvet) drawTvetCard(pdf, doc, art);
  else drawNormalCard(pdf, doc, art);
}

export async function renderReportCardPdf(doc: ReportCardDocument, opts: PdfOptions): Promise<Buffer> {
  const art = await cardArt(doc, opts);
  const pdf = new PDFDocument({
    size: "A4",
    margin: 30,
    info: {
      Title: `Report Card - ${doc.student.name} - ${doc.card.term} ${doc.card.academic_year}`,
      Author: doc.school.name,
      Subject: doc.builder === "tvet" ? "Learner's Assessment Report" : "Student Academic Report Card",
    },
  });
  return collect(pdf, () => drawCard(pdf, doc, art));
}


export interface ClassPackMeta {
  class_name: string;
  term: string;
  academic_year: string;
}

/** Position first (unranked last), then average, then name. */
export function rankOrder(docs: ReportCardDocument[]): ReportCardDocument[] {
  return [...docs].sort((a, b) => {
    const pa = a.summary.position ?? Number.POSITIVE_INFINITY;
    const pb = b.summary.position ?? Number.POSITIVE_INFINITY;
    if (pa !== pb) return pa - pb;
    const aa = a.summary.average ?? -1;
    const ab = b.summary.average ?? -1;
    if (aa !== ab) return ab - aa;
    return a.student.name.localeCompare(b.student.name);
  });
}

const STATUS_LABEL: Record<string, string> = { draft: "Draft", reviewed: "Reviewed", approved: "Approved", published: "Published" };
const COVER_ROW = 19;
const COVER_FIRST_TOP = 236; // y where the first page's ranking rows start
const COVER_NEXT_TOP = 78;

/** Rows per cover page; the cover's page count decides each card's page number. */
function coverPages(n: number, pageH: number, M: number): number {
  const first = Math.floor((pageH - M - 24 - COVER_FIRST_TOP) / COVER_ROW);
  const next = Math.floor((pageH - M - 24 - COVER_NEXT_TOP) / COVER_ROW);
  return n <= first ? 1 : 1 + Math.ceil((n - first) / next);
}

/**
 * Every report card of a class in one PDF: a ranking summary cover (position,
 * average, grade, competent modules, status and the page of each card), then
 * each student's card on its own page, in ranking order.
 */
export async function renderClassReportCardsPdf(docsIn: ReportCardDocument[], meta: ClassPackMeta, opts: PdfOptions): Promise<Buffer> {
  const docs = rankOrder(docsIn);
  const arts = await Promise.all(docs.map((d) => cardArt(d, opts)));
  const pdf = new PDFDocument({
    size: "A4",
    margin: 30,
    autoFirstPage: true,
    info: {
      Title: `Report Cards - ${meta.class_name} - ${meta.term} ${meta.academic_year}`,
      Author: docs[0]?.school.name ?? "",
      Subject: "Class report cards, in ranking order",
    },
  });
  return collect(pdf, () => {
    const M = 30;
    const W = pdf.page.width - M * 2;
    const pageH = pdf.page.height;
    const school = docs[0]?.school;
    const logo = logoPath(school?.logo);
    const nCover = coverPages(docs.length, pageH, M);
    const pageOf = (i: number) => nCover + i + 1;

    const footer = (text: string) => {
      const keep = pdf.page.margins.bottom;
      pdf.page.margins.bottom = 0;
      pdf.font(F.normal).fontSize(6.5).fillColor(C.muted).text(text, M, pageH - 18, { width: W, align: "center", lineBreak: false });
      pdf.page.margins.bottom = keep;
    };

    // ── Cover ───────────────────────────────────────────────────────────
    let y = M;
    if (logo) pdf.image(logo, M, y, { height: 46 });
    else pdf.font(F.bold).fontSize(14).fillColor(C.navy).text(school?.name ?? "", M, y + 10, { width: W * 0.55, lineBreak: false });
    pdf.font(F.bold).fontSize(15).fillColor(C.navy).text("CLASS REPORT CARDS", M, y + 4, { width: W, align: "right", lineBreak: false });
    pdf.font(F.normal).fontSize(9).fillColor(C.text).text(`${meta.class_name}  ·  ${meta.term}  ·  ${meta.academic_year}`, M, y + 24, {
      width: W,
      align: "right",
      lineBreak: false,
    });
    pdf.font(F.normal).fontSize(7).fillColor(C.muted).text("In ranking order · one card per page", M, y + 37, { width: W, align: "right", lineBreak: false });
    y += 56;
    pdf.rect(M, y, 60, 2.5).fill(C.accent);
    pdf.rect(M + 60, y, W - 60, 2.5).fill(C.navy);
    y += 14;

    // Stat tiles
    const avgs = docs.map((d) => d.summary.average).filter((v): v is number => v != null);
    const classAvg = avgs.length ? avgs.reduce((a, b) => a + b, 0) / avgs.length : null;
    const comp = docs.reduce((a, d) => a + (d.summary.modules_competent ?? 0), 0);
    const judged = docs.reduce((a, d) => a + (d.summary.modules_competent ?? 0) + (d.summary.modules_nyc ?? 0), 0);
    const published = docs.filter((d) => d.card.status === "published").length;
    const top = docs[0];
    const tiles: Array<[string, string, string?]> = [
      ["Students", String(docs.length)],
      ["Class average", classAvg != null ? `${exact(classAvg)}%` : "—"],
      ["Top of class", top && top.summary.average != null ? `${exact(top.summary.average)}%` : "—", top?.student.name],
      ["Competent modules", judged ? `${exact((comp / judged) * 100)}%` : "—", judged ? `${comp} of ${judged}` : undefined],
      ["Published", `${published}/${docs.length}`],
    ];
    const gap = 8;
    const tw = (W - gap * (tiles.length - 1)) / tiles.length;
    tiles.forEach(([k, v, sub], i) => {
      const x = M + i * (tw + gap);
      pdf.roundedRect(x, y, tw, 46, 6).fill(i === 0 ? C.navy : C.navySoft);
      pdf.font(F.bold).fontSize(6.3).fillColor(i === 0 ? "#BFD0E3" : C.muted).text(k.toUpperCase(), x + 10, y + 8, { width: tw - 20, lineBreak: false, characterSpacing: 0.4 });
      pdf.font(F.bold).fontSize(15).fillColor(i === 0 ? C.white : C.navy).text(v, x + 10, y + 18, { width: tw - 20, lineBreak: false });
      if (sub) pdf.font(F.normal).fontSize(6.6).fillColor(C.muted).text(sub, x + 10, y + 35, { width: tw - 20, lineBreak: false, ellipsis: true });
    });
    y += 60;

    // Ranking table
    type Col = { label: string; w: number; align: "left" | "center" | "right" };
    const cols: Col[] = [
      { label: "Pos.", w: 38, align: "center" },
      { label: "Student", w: 0, align: "left" },
      { label: "Reg. no.", w: 78, align: "left" },
      { label: "Average", w: 116, align: "left" },
      { label: "Grade", w: 40, align: "center" },
      { label: "Competent", w: 58, align: "center" },
      { label: "Status", w: 62, align: "center" },
      { label: "Page", w: 34, align: "center" },
    ];
    cols[1].w = W - cols.reduce((a, c) => a + c.w, 0);
    const head = () => {
      pdf.rect(M, y, W, 20).fill(C.navy);
      let x = M;
      for (const c of cols) {
        pdf.font(F.bold).fontSize(6.8).fillColor(C.white).text(c.label.toUpperCase(), x + 6, y + 7, { width: c.w - 12, align: c.align, lineBreak: false });
        x += c.w;
      }
      y += 20;
    };
    pdf.font(F.bold).fontSize(8).fillColor(C.navy).text("RANKING", M, y, { lineBreak: false, characterSpacing: 0.6 });
    y += 14;
    head();
    let coverPage = 1;
    docs.forEach((d, i) => {
      if (y + COVER_ROW > pageH - M - 24) {
        footer(`${meta.class_name} · ${meta.term} ${meta.academic_year} · page ${coverPage}`);
        pdf.addPage();
        coverPage++;
        y = COVER_NEXT_TOP - 20;
        head();
      }
      if (i % 2) pdf.rect(M, y, W, COVER_ROW).fill(C.zebra);
      const s = d.summary;
      const mid = y + COVER_ROW / 2 - 3.6;
      let x = M;
      // Position badge (top 3 filled)
      const pos = s.position;
      if (pos != null) {
        const bw = 22;
        const bx = x + (cols[0].w - bw) / 2;
        pdf.roundedRect(bx, y + 3.5, bw, COVER_ROW - 7, 6).fill(pos <= 3 ? C.navy : C.navySoft);
        pdf.font(F.bold).fontSize(7.6).fillColor(pos <= 3 ? C.white : C.navy).text(String(pos), bx, mid, { width: bw, align: "center", lineBreak: false });
      } else pdf.font(F.normal).fontSize(7.6).fillColor(C.muted).text("—", x, mid, { width: cols[0].w, align: "center", lineBreak: false });
      x += cols[0].w;
      pdf.font(F.bold).fontSize(8).fillColor(C.ink).text(d.student.name, x + 6, mid, { width: cols[1].w - 12, lineBreak: false, ellipsis: true });
      x += cols[1].w;
      pdf.font(F.normal).fontSize(7.4).fillColor(C.muted).text(d.student.registration_number ?? "—", x + 6, mid, { width: cols[2].w - 12, lineBreak: false, ellipsis: true });
      x += cols[2].w;
      // Average: value + bar
      if (s.average != null) {
        pdf.font(F.bold).fontSize(8).fillColor(C.ink).text(`${exact(s.average)}%`, x + 6, mid, { width: 40, lineBreak: false });
        const bx = x + 50;
        const bw = cols[3].w - 58;
        pdf.roundedRect(bx, y + COVER_ROW / 2 - 2, bw, 4, 2).fill(C.line);
        pdf.roundedRect(bx, y + COVER_ROW / 2 - 2, Math.max(2, (bw * Math.min(100, s.average)) / 100), 4, 2).fill(C.navy);
      } else pdf.font(F.normal).fontSize(7.6).fillColor(C.muted).text("—", x + 6, mid, { lineBreak: false });
      x += cols[3].w;
      pdf.font(F.bold).fontSize(7.8).fillColor(C.navy).text(s.grade ?? "—", x, mid, { width: cols[4].w, align: "center", lineBreak: false });
      x += cols[4].w;
      const judgedHere = (s.modules_competent ?? 0) + (s.modules_nyc ?? 0);
      pdf
        .font(F.normal)
        .fontSize(7.6)
        .fillColor(s.modules_nyc ? C.red : C.text)
        .text(judgedHere ? `${s.modules_competent ?? 0}/${judgedHere}` : "—", x, mid, { width: cols[5].w, align: "center", lineBreak: false });
      x += cols[5].w;
      const st = d.card.status;
      const issued = st === "approved" || st === "published";
      const pw = 50;
      const px = x + (cols[6].w - pw) / 2;
      pdf.roundedRect(px, y + 4, pw, COVER_ROW - 8, 5.5).fill(st === "published" ? "#E7F6EE" : issued ? C.navySoft : "#FEF3E2");
      pdf
        .font(F.bold)
        .fontSize(6.4)
        .fillColor(st === "published" ? "#05603A" : issued ? C.navy : "#9A5B00")
        .text(STATUS_LABEL[st] ?? st, px, mid + 0.6, { width: pw, align: "center", lineBreak: false });
      x += cols[6].w;
      pdf.font(F.normal).fontSize(7.6).fillColor(C.navy).text(String(pageOf(i)), x, mid, { width: cols[7].w, align: "center", lineBreak: false });
      pdf.goTo(M, y, W, COVER_ROW, `card-${i + 1}`); // the row jumps to the card
      pdf.moveTo(M, y + COVER_ROW).lineTo(M + W, y + COVER_ROW).lineWidth(0.4).stroke(C.line);
      y += COVER_ROW;
    });
    if (!docs.length) {
      pdf.font(F.italic).fontSize(9).fillColor(C.muted).text("No report cards for this class and term.", M, y + 10, { width: W, align: "center" });
    }
    const drafts = docs.filter((d) => !(d.card.status === "approved" || d.card.status === "published")).length;
    pdf
      .font(F.normal)
      .fontSize(6.8)
      .fillColor(C.muted)
      .text(
        `Positions are by average over the modules assessed so far.${drafts ? ` ${drafts} card${drafts === 1 ? " is" : "s are"} not yet approved and marked PROVISIONAL.` : ""}`,
        M,
        Math.min(y + 8, pageH - M - 22),
        { width: W, lineBreak: false, ellipsis: true },
      );
    footer(`${meta.class_name} · ${meta.term} ${meta.academic_year} · page ${coverPage}`);

    // ── One card per page ──────────────────────────────────────────────
    docs.forEach((d, i) => {
      pdf.addPage();
      pdf.addNamedDestination(`card-${i + 1}`);
      drawCard(pdf, d, arts[i]);
      footer(
        `${meta.class_name} · ${meta.term} ${meta.academic_year} · ${d.summary.position != null ? `Position ${d.summary.position} of ${d.summary.position_of ?? docs.length}` : "Not ranked"} · page ${pageOf(i)}`,
      );
    });
  });
}

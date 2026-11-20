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
const COVER_ROW = 24;
const COVER_HEAD = 22;
const COVER_FIRST_TOP = 262; // y where the first page's ranking rows start
const COVER_NEXT_TOP = 70;
const COVER_BOTTOM = 52; // room for the note and the page footer

/** Rows per cover page; the cover's page count decides each card's page number. */
function coverPages(n: number, pageH: number): number {
  const first = Math.floor((pageH - COVER_BOTTOM - COVER_FIRST_TOP - COVER_HEAD) / COVER_ROW);
  const next = Math.floor((pageH - COVER_BOTTOM - COVER_NEXT_TOP - COVER_HEAD) / COVER_ROW);
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
    const nCover = coverPages(docs.length, pageH);
    const pageOf = (i: number) => nCover + i + 1;
    const tvet = docs.some((d) => d.builder === "tvet" && d.tvet);

    const footer = (text: string) => {
      const keep = pdf.page.margins.bottom;
      pdf.page.margins.bottom = 0;
      pdf.font(F.normal).fontSize(6.5).fillColor(C.muted).text(text, M, pageH - 18, { width: W, align: "center", lineBreak: false });
      pdf.page.margins.bottom = keep;
    };
    /** One line that shrinks a little, then ends in "…", to fit. */
    const fitText = (text: string, x: number, y: number, w: number, size: number, font: string, color: string, align: "left" | "center" | "right" = "left", shrink = true) => {
      pdf.font(font);
      let sz = size;
      while (shrink && sz > size - 1.5 && pdf.fontSize(sz).widthOfString(text) > w - 1) sz -= 0.25;
      pdf.fontSize(sz);
      let t = text;
      if (pdf.widthOfString(t) > w - 1) {
        while (t.length > 1 && pdf.widthOfString(`${t}…`) > w - 1) t = t.slice(0, -1);
        t = `${t.trimEnd()}…`;
      }
      pdf.fillColor(color).text(t, x, y + (size - sz) / 2, { width: w, align, lineBreak: false });
    };

    // ── Header: logo (or name) · title, class, term, year ───────────────
    let y = M;
    if (logo) pdf.image(logo, M, y, { height: 44 });
    else fitText(school?.name ?? "", M, y + 14, W * 0.5, 14, F.bold, C.navy);
    pdf.font(F.bold).fontSize(17).fillColor(C.navy).text("Class report cards", M + W * 0.4, y + 2, { width: W * 0.6, align: "right", lineBreak: false });
    fitText(`${meta.class_name}  ·  ${meta.term}  ·  ${meta.academic_year}`, M + W * 0.4, y + 24, W * 0.6, 9.5, F.normal, C.ink, "right");
    pdf
      .font(F.normal)
      .fontSize(7)
      .fillColor(C.muted)
      .text(`${docs.length} learner${docs.length === 1 ? "" : "s"} · in ranking order · one card per page`, M + W * 0.4, y + 38, { width: W * 0.6, align: "right", lineBreak: false });
    y += 58;
    pdf.moveTo(M, y).lineTo(M + W, y).lineWidth(1.2).stroke(C.navy);
    y += 14;

    // ── Summary tiles ───────────────────────────────────────────────────
    const avgs = docs.map((d) => d.summary.average).filter((v): v is number => v != null);
    const classAvg = avgs.length ? avgs.reduce((a, b) => a + b, 0) / avgs.length : null;
    const comp = docs.reduce((a, d) => a + (d.summary.modules_competent ?? 0), 0);
    const judged = docs.reduce((a, d) => a + (d.summary.modules_competent ?? 0) + (d.summary.modules_nyc ?? 0), 0);
    const top = docs.find((d) => d.summary.average != null);
    const spread = avgs.length ? { lo: Math.min(...avgs), hi: Math.max(...avgs) } : null;
    const tiles: Array<{ k: string; v: string; sub?: string; dark?: boolean }> = [
      { k: "Learners", v: String(docs.length), sub: `${docs.filter((d) => d.summary.position != null).length} ranked`, dark: true },
      { k: tvet ? "Class percentage" : "Class average", v: classAvg != null ? `${exact(classAvg)}%` : "—", sub: spread ? `${exact(spread.lo)}% – ${exact(spread.hi)}%` : undefined },
      { k: "Top of the class", v: top?.summary.average != null ? `${exact(top.summary.average)}%` : "—", sub: top?.student.name },
      { k: "Competent modules", v: judged ? `${exact((comp / judged) * 100)}%` : "—", sub: judged ? `${comp} of ${judged}` : undefined },
    ];
    const gap = 10;
    const tw = (W - gap * (tiles.length - 1)) / tiles.length;
    const th = 58;
    tiles.forEach((t, i) => {
      const x = M + i * (tw + gap);
      pdf.roundedRect(x, y, tw, th, 8).fill(t.dark ? C.navy : C.navySoft);
      pdf.font(F.bold).fontSize(6.4).fillColor(t.dark ? "#BFD0E3" : C.muted).text(t.k.toUpperCase(), x + 12, y + 10, { width: tw - 24, lineBreak: false, characterSpacing: 0.5 });
      fitText(t.v, x + 12, y + 21, tw - 24, 17, F.bold, t.dark ? C.white : C.navy);
      if (t.sub) fitText(t.sub, x + 12, y + 42, tw - 24, 7, F.normal, t.dark ? "#BFD0E3" : C.muted);
    });
    y += th + 12;

    // Status counts, one line.
    const counts = ["draft", "reviewed", "approved", "published"].map((st) => [st, docs.filter((d) => d.card.status === st).length] as const);
    let sx = M;
    pdf.font(F.bold).fontSize(6.6).fillColor(C.muted).text("STATUS", sx, y + 4, { lineBreak: false, characterSpacing: 0.5 });
    sx += 40;
    for (const [st, n] of counts) {
      const label = `${STATUS_LABEL[st]}  ${n}`;
      pdf.font(F.bold).fontSize(7);
      const w = pdf.widthOfString(label) + 16;
      const on = n > 0;
      pdf.roundedRect(sx, y, w, 14, 7).fill(on ? (st === "published" ? "#E7F6EE" : st === "draft" ? "#F1F5F9" : C.navySoft) : C.white);
      if (!on) pdf.roundedRect(sx, y, w, 14, 7).lineWidth(0.5).stroke(C.line);
      pdf.fillColor(on ? (st === "published" ? "#05603A" : C.navy) : C.faint).text(label, sx, y + 3.8, { width: w, align: "center", lineBreak: false });
      sx += w + 6;
    }
    y += 26;

    // ── Ranking table ───────────────────────────────────────────────────
    type Col = { key: string; label: string; w: number; align: "left" | "center" | "right" };
    const cols: Col[] = [
      { key: "pos", label: "Pos.", w: 36, align: "center" },
      { key: "name", label: tvet ? "Learner" : "Student", w: 0, align: "left" },
      { key: "reg", label: "Reg. no.", w: 74, align: "left" },
      { key: "avg", label: tvet ? "Percentage" : "Average", w: 108, align: "left" },
      ...(tvet ? [{ key: "conduct", label: "Conduct", w: 50, align: "center" as const }] : [{ key: "grade", label: "Grade", w: 42, align: "center" as const }]),
      { key: "comp", label: "Competent", w: 58, align: "center" },
      { key: "status", label: "Status", w: 58, align: "center" },
      { key: "page", label: "Page", w: 34, align: "center" },
    ];
    cols[1].w = W - cols.reduce((a, c) => a + c.w, 0);
    const head = () => {
      pdf.roundedRect(M, y, W, COVER_HEAD, 6).fill(C.navy);
      pdf.rect(M, y + COVER_HEAD - 6, W, 6).fill(C.navy); // square bottom corners
      let x = M;
      for (const c of cols) {
        const hp = c.align === "center" ? 3 : 8;
        fitText(c.label.toUpperCase(), x + hp, y + 8, c.w - hp * 2, 6.6, F.bold, C.white, c.align);
        x += c.w;
      }
      y += COVER_HEAD;
    };
    pdf.font(F.bold).fontSize(8).fillColor(C.navy).text("RANKING", M, y, { lineBreak: false, characterSpacing: 0.8 });
    y += 13;
    head();
    let coverPage = 1;
    docs.forEach((d, i) => {
      if (y + COVER_ROW > pageH - COVER_BOTTOM) {
        footer(`${meta.class_name} · ${meta.term} ${meta.academic_year} · page ${coverPage}`);
        pdf.addPage();
        coverPage++;
        y = COVER_NEXT_TOP - COVER_HEAD - 8;
        head();
      }
      if (i % 2) pdf.rect(M, y, W, COVER_ROW).fill(C.zebra);
      const s = d.summary;
      const mid = y + COVER_ROW / 2 - 3.8;
      let x = M;
      for (const c of cols) {
        const pad = 8;
        if (c.key === "pos") {
          const pos = s.position;
          if (pos != null) {
            const bw = 22;
            const bx = x + (c.w - bw) / 2;
            pdf.roundedRect(bx, y + COVER_ROW / 2 - 7.5, bw, 15, 7.5).fill(pos <= 3 ? C.navy : C.navySoft);
            pdf.font(F.bold).fontSize(7.6).fillColor(pos <= 3 ? C.white : C.navy).text(String(pos), bx, mid + 0.4, { width: bw, align: "center", lineBreak: false });
          } else pdf.font(F.normal).fontSize(7.6).fillColor(C.faint).text("—", x, mid, { width: c.w, align: "center", lineBreak: false });
        } else if (c.key === "name") fitText(d.student.name, x + pad, mid, c.w - pad * 2, 8.2, F.bold, C.ink, "left", false);
        else if (c.key === "reg") fitText(d.student.registration_number ?? "—", x + pad, mid + 0.4, c.w - pad * 2, 7.4, F.normal, C.muted);
        else if (c.key === "avg") {
          if (s.average != null) {
            pdf.font(F.bold).fontSize(8).fillColor(C.ink).text(`${exact(s.average)}%`, x + pad, mid, { width: 44, lineBreak: false });
            const bx = x + pad + 46;
            const bw = c.w - pad * 2 - 46;
            pdf.roundedRect(bx, y + COVER_ROW / 2 - 2, bw, 4, 2).fill(C.line);
            pdf.roundedRect(bx, y + COVER_ROW / 2 - 2, Math.max(3, (bw * Math.min(100, s.average)) / 100), 4, 2).fill(C.navy);
          } else pdf.font(F.normal).fontSize(7.6).fillColor(C.faint).text("—", x + pad, mid, { lineBreak: false });
        } else if (c.key === "grade") pdf.font(F.bold).fontSize(8).fillColor(C.navy).text(s.grade ?? "—", x, mid, { width: c.w, align: "center", lineBreak: false });
        else if (c.key === "conduct") {
          const cd = d.behaviour?.mark;
          pdf.font(F.normal).fontSize(7.6).fillColor(cd != null ? C.text : C.faint).text(cd != null ? `${exact(cd)}/${d.behaviour?.max ?? 40}` : "—", x, mid, { width: c.w, align: "center", lineBreak: false });
        } else if (c.key === "comp") {
          const judgedHere = (s.modules_competent ?? 0) + (s.modules_nyc ?? 0);
          pdf
            .font(F.normal)
            .fontSize(7.6)
            .fillColor(s.modules_nyc ? C.red : judgedHere ? C.text : C.faint)
            .text(judgedHere ? `${s.modules_competent ?? 0}/${judgedHere}` : "—", x, mid, { width: c.w, align: "center", lineBreak: false });
        } else if (c.key === "status") {
          const st = d.card.status;
          const issued = st === "approved" || st === "published";
          const pw = 52;
          const px = x + (c.w - pw) / 2;
          pdf.roundedRect(px, y + COVER_ROW / 2 - 7, pw, 14, 7).fill(st === "published" ? "#E7F6EE" : issued ? C.navySoft : "#F1F5F9");
          pdf
            .font(F.bold)
            .fontSize(6.6)
            .fillColor(st === "published" ? "#05603A" : issued ? C.navy : C.muted)
            .text(STATUS_LABEL[st] ?? st, px, mid + 1, { width: pw, align: "center", lineBreak: false });
        } else if (c.key === "page") {
          pdf.font(F.bold).fontSize(7.6).fillColor(C.navy).text(String(pageOf(i)), x, mid, { width: c.w, align: "center", lineBreak: false });
        }
        x += c.w;
      }
      pdf.goTo(M, y, W, COVER_ROW, `card-${i + 1}`); // the row jumps to the card
      pdf.moveTo(M, y + COVER_ROW).lineTo(M + W, y + COVER_ROW).lineWidth(0.4).stroke(C.line);
      y += COVER_ROW;
    });
    if (!docs.length) {
      pdf.font(F.italic).fontSize(9).fillColor(C.muted).text("No report cards for this class and term.", M, y + 12, { width: W, align: "center" });
      y += 30;
    }
    const drafts = docs.filter((d) => !(d.card.status === "approved" || d.card.status === "published")).length;
    const note =
      (tvet
        ? "Positions are by the term percentage, weighted by each module's learning hours, over the work assessed so far."
        : "Positions are by the average of the subjects assessed so far.") +
      (drafts ? ` ${drafts} card${drafts === 1 ? " isn't" : "s aren't"} approved yet and ${drafts === 1 ? "is" : "are"} marked PROVISIONAL.` : "") +
      " Click a row to open that card.";
    pdf.font(F.normal).fontSize(6.8).fillColor(C.muted).text(note, M, Math.min(y + 10, pageH - COVER_BOTTOM + 8), { width: W, lineBreak: true });
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

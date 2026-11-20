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
  faint: "#A3B1C2",
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

/** Exact marks, never rounded to whole numbers: up to 2 decimals (the precision marks are stored at), trailing zeros dropped. */
export const exact = (n: number | null | undefined) => (n == null ? "" : String(Number(n.toFixed(2))));
const pct = (n: number, d: number) => (d > 0 ? exact((n / d) * 100) : "0");

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

/** What a card needs besides its document: watermark, verification link + QR, logo. */
interface CardArt {
  watermark: string | null;
  url: string;
  qr: Buffer | null;
  logo: string | null;
}

async function cardArt(doc: ReportCardDocument, opts: PdfOptions): Promise<CardArt> {
  const issued = isIssued(doc);
  const url = verificationUrl(doc, opts.verificationBaseUrl);
  return {
    watermark: opts.watermark !== undefined ? opts.watermark : issued ? null : "PROVISIONAL",
    url,
    qr: issued ? await QRCode.toBuffer(url, { errorCorrectionLevel: "M", width: 140, margin: 0, color: { dark: C.navy, light: C.white } }) : null,
    logo: logoPath(doc.school.logo),
  };
}

/** Collects a pdfkit document into a Buffer once `draw` has drawn it. */
function collect(pdf: PDFKit.PDFDocument, draw: () => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    pdf.on("data", (c: Buffer) => chunks.push(c));
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);
    try {
      draw();
      pdf.end();
    } catch (e) {
      reject(e);
    }
  });
}

export async function renderReportCardPdf(doc: ReportCardDocument, opts: PdfOptions): Promise<Buffer> {
  const art = await cardArt(doc, opts);
  const pdf = new PDFDocument({
    size: "A4",
    margin: 30,
    info: {
      Title: `Report Card - ${doc.student.name} - ${doc.card.term} ${doc.card.academic_year}`,
      Author: doc.school.name,
      Subject: "Student Academic Report Card",
    },
  });
  return collect(pdf, () => drawCard(pdf, doc, art));
}

type DocSubject = ReportCardDocument["groups"][number]["subjects"][number];

/** CAMIS groups modules complementary → core general → core specific. */
export const RTB_GROUPS: Array<{ key: "complementary" | "general" | "specific" | null; label: string }> = [
  { key: "complementary", label: "Complementary modules" },
  { key: "general", label: "Core modules — General" },
  { key: "specific", label: "Core modules — Specific" },
  { key: null, label: "Other modules" },
];

export function rtbGroups(doc: ReportCardDocument): Array<{ label: string; subjects: DocSubject[] }> {
  const all = doc.groups.flatMap((g) => g.subjects);
  return RTB_GROUPS.map((g) => ({
    label: g.label,
    subjects: all.filter((s) => (s.category ?? null) === g.key).sort((a, b) => (a.code ?? a.name).localeCompare(b.code ?? b.name)),
  })).filter((g) => g.subjects.length > 0);
}

/** FA / IA / CA maxima from the category weights. */
export function camisMax(doc: ReportCardDocument): { fa: number; ia: number; ca: number } {
  const w = doc.scheme.category_weights as Record<string, number>;
  return { fa: (w.CW ?? 0) + (w.HW ?? 0) + (w.MD ?? 0), ia: w.IA ?? 50, ca: w.EOT ?? 0 };
}

/** The deliberation choices CAMIS prints on the final-term card. */
export const DELIBERATIONS = ["Promoted at 1st sitting", "Promoted after re-assessment", "Re-assessment required", "Advised to repeat", "Dismissed"];

/** Draws one report card (RTB / CAMIS learner's assessment report) from the top of the current page of `pdf`. */
function drawCard(pdf: PDFKit.PDFDocument, doc: ReportCardDocument, art: CardArt): void {
  const { watermark, url, qr, logo } = art;

  const M = 28;
  const W = pdf.page.width - M * 2;
  const bottom = pdf.page.height - M;
  let y = M;
  const annual = doc.annual ?? null;
  const showComp = doc.scheme.show_competence !== false;
  const showRank = doc.scheme.show_subject_rank !== false && !annual;
  const max = camisMax(doc);
  const finalTerm = !!annual;

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
      return true;
    }
    return false;
  };
  const label = (t: string, x: number, yy: number, w?: number, align: "left" | "center" | "right" = "left") =>
    pdf.font(F.bold).fontSize(6.3).fillColor(C.muted).text(t.toUpperCase(), x, yy, { width: w, align, lineBreak: false, characterSpacing: 0.4 });
  /** One line that shrinks, then ends in "…", to fit. */
  const fit = (text: string, x: number, yy: number, room: number, size: number, font = F.bold, color: string = C.ink, align: "left" | "center" | "right" = "left") => {
    pdf.font(font);
    let sz = size;
    while (sz > size - 2 && pdf.fontSize(sz).widthOfString(text) > room) sz -= 0.5;
    let t = text;
    if (pdf.fontSize(sz).widthOfString(t) > room) {
      while (t.length > 1 && pdf.widthOfString(`${t}…`) > room) t = t.slice(0, -1);
      t = `${t.trimEnd()}…`;
    }
    pdf.fillColor(color).text(t, x, yy + (size - sz) / 2, { width: room, align, lineBreak: false });
  };
  drawWatermark();

  // ── Header: Republic / Ministry / school (left) · logo (right) ────────
  const hdr: Array<[string, string]> = [
    ["REPUBLIC OF RWANDA", F.bold],
    ["MINISTRY OF EDUCATION", F.bold],
    [doc.school.name.toUpperCase(), F.bold],
    ...(doc.school.address_line ? [[doc.school.address_line, F.normal] as [string, string]] : []),
    ...(doc.school.contact_line ? [[doc.school.contact_line, F.normal] as [string, string]] : []),
  ];
  let hy = y;
  hdr.forEach(([t, f], i) => {
    pdf.font(f).fontSize(i < 3 ? 8 : 6.8).fillColor(i < 2 ? C.ink : i === 2 ? C.navy : C.muted).text(t, M, hy, { width: W * 0.62, lineBreak: false, ellipsis: true });
    hy += i < 3 ? 10.5 : 9;
  });
  if (logo) pdf.image(logo, M + W - 150, y, { fit: [150, 52], align: "right" });
  y = Math.max(hy, y + 54) + 6;

  // ── Title bar ─────────────────────────────────────────────────────────
  const title = finalTerm ? "LEARNER'S ASSESSMENT REPORT" : "LEARNER'S TERMLY ASSESSMENT REPORT";
  pdf.roundedRect(M, y, W, 24, 6).fill(C.navy);
  pdf.font(F.bold).fontSize(11).fillColor(C.white).text(title, M, y + 7, { width: W, align: "center", lineBreak: false, characterSpacing: 0.6 });
  y += 30;

  // ── Learner + qualification ───────────────────────────────────────────
  const q = doc.qualification;
  const rows: Array<Array<[string, string]>> = [
    [
      ["Learner's name", doc.student.name],
      ["SDMS ID / Reg. No.", doc.student.registration_number ?? "—"],
      ["Class", doc.student.class_name ?? "—"],
      ["Academic year", finalTerm ? doc.card.academic_year : `${doc.card.academic_year} · ${doc.card.term}`],
    ],
    [
      ["Qualification title", q?.title ?? "—"],
      ["Trade", q?.trade ?? doc.student.program_name ?? "—"],
      ["RQF level", q?.rqf_level ? `Level ${q.rqf_level}` : "—"],
      ...(q?.sector ? [["Sector", q.sector] as [string, string]] : []),
    ],
  ];
  const idH = 62;
  pdf.roundedRect(M, y, W, idH, 6).fill(C.navySoft);
  rows.forEach((r, ri) => {
    const weights = r.length === 4 ? [1.6, 1.1, 0.9, 1.1] : [1.8, 1.3, 0.8];
    const unit = (W - 20) / weights.reduce((a2, b2) => a2 + b2, 0);
    let x = M + 10;
    r.forEach(([k, v], i) => {
      const cw = unit * weights[i];
      label(k, x, y + 7 + ri * 28, cw - 8);
      fit(v, x, y + 16 + ri * 28, cw - 8, 8.8);
      x += cw;
    });
  });
  y += idH + 8;

  // ── Module table ──────────────────────────────────────────────────────
  type Col = { key: string; label: string; sub?: string; group?: string; width: number };
  const t3 = doc.card.term;
  const earlierTerms = annual ? annual.terms.slice(0, -1) : [];
  const termCols = (term: string, idx: number, withIA: boolean): Col[] => [
    { key: `fa${idx}`, label: "FA", sub: `/${max.fa}`, group: term, width: 0 },
    ...(withIA ? [{ key: `ia${idx}`, label: "IA", sub: `/${max.ia}`, group: term, width: 0 }] : []),
    { key: `ca${idx}`, label: "CA", sub: `/${max.ca}`, group: term, width: 0 },
    { key: `to${idx}`, label: "TO", sub: "/100", group: term, width: 0 },
  ];
  const cols: Col[] = annual
    ? [
        { key: "name", label: "Module", width: 0 },
        { key: "wt", label: "Wt", sub: "hrs", width: 24 },
        ...earlierTerms.flatMap((t, i) => termCols(t, i, false)),
        ...termCols(t3, 9, true),
        { key: "at", label: "AT", sub: "/100", group: "Annual", width: 30 },
        { key: "re", label: "Re", group: "Annual", width: 22 },
        ...(showComp ? [{ key: "de", label: "De", group: "Annual", width: 30 }] : []),
      ]
    : [
        { key: "name", label: "Module", width: 0 },
        { key: "wt", label: "Weight", sub: "hours", width: 38 },
        ...termCols(t3, 9, true),
        ...(showRank ? [{ key: "rk", label: "Pos.", sub: "in class", width: 36 }] : []),
        ...(showComp ? [{ key: "de", label: "Decision", width: 62 }] : []),
      ];
  const termW = annual ? 26 : 44;
  for (const c of cols) if (c.width === 0 && c.key !== "name") c.width = c.key.startsWith("to") ? termW + 4 : termW;
  const nameCol = cols.find((c) => c.key === "name")!;
  nameCol.width = W - cols.reduce((a2, c) => a2 + c.width, 0);
  const grouped = cols.some((c) => c.group);
  const fs = annual ? 6.8 : 7.8;

  const header = () => {
    const hh = grouped ? 30 : 24;
    ensure(hh + 20);
    pdf.rect(M, y, W, hh).fill(C.navy);
    let x = M;
    // Group labels over their columns (term names / Annual).
    if (grouped) {
      let gx = M;
      let i = 0;
      while (i < cols.length) {
        const g = cols[i].group;
        let gw = 0;
        let j = i;
        while (j < cols.length && cols[j].group === g) gw += cols[j++].width;
        if (g) {
          pdf.font(F.bold).fontSize(6.4).fillColor(C.white).text(g.toUpperCase(), gx, y + 4, { width: gw, align: "center", lineBreak: false });
          pdf.moveTo(gx + 3, y + 12.5).lineTo(gx + gw - 3, y + 12.5).lineWidth(0.4).stroke("#5B7896");
        }
        gx += gw;
        i = j;
      }
    }
    const top = grouped ? y + 14 : y + 5;
    for (const c of cols) {
      const align = c.key === "name" ? "left" : "center";
      pdf.font(F.bold).fontSize(6.6).fillColor(C.white).text(c.label.toUpperCase(), x + 3, top + (c.sub ? 0 : 4), { width: c.width - 6, align, lineBreak: false });
      if (c.sub) pdf.font(F.normal).fontSize(5.6).fillColor("#BFD0E3").text(c.sub, x + 3, top + 8, { width: c.width - 6, align, lineBreak: false });
      x += c.width;
    }
    y += hh;
  };
  header();

  const cellText = (v: string, x: number, c: Col, h: number, o: { font?: string; color?: string; size?: number } = {}) => {
    pdf.font(o.font ?? F.normal).fontSize(o.size ?? fs);
    pdf.fillColor(o.color ?? C.text).text(v, x + 2, y + (h - (o.size ?? fs)) / 2 + 0.5, { width: c.width - 4, align: "center", lineBreak: false });
  };
  const num = (v: number | null | undefined, na = false) => (v != null ? exact(v) : na ? "N/A" : "–");
  const tone = (v: number | null | undefined, na = false) => (v != null ? C.text : na ? C.muted : C.faint);
  const pill = (text: string, x: number, c: Col, h: number, ok: boolean) => {
    const pw = Math.min(c.width - 6, annual ? 24 : 52);
    const px = x + (c.width - pw) / 2;
    pdf.roundedRect(px, y + h / 2 - 6, pw, 12, 6).fill(ok ? "#E7F6EE" : C.redSoft);
    pdf.font(F.bold).fontSize(annual ? 6 : 6.8).fillColor(ok ? "#05603A" : C.red).text(text, px, y + h / 2 - 3.2, { width: pw, align: "center", lineBreak: false });
  };
  const rowLine = (h: number) => pdf.moveTo(M, y + h).lineTo(M + W, y + h).lineWidth(0.4).stroke(C.line);

  // Behaviour row (first, outside every total).
  if (doc.behaviour) {
    const h = 18;
    pdf.rect(M, y, W, h).fill("#F4F7FB");
    let x = M;
    const b = doc.behaviour;
    const earlierB = new Map((b.earlier ?? []).map((e) => [e.term, e.mark]));
    for (const c of cols) {
      if (c.key === "name") pdf.font(F.bold).fontSize(fs).fillColor(C.navy).text("Behaviour (Conduct)", x + 6, y + (h - fs) / 2 + 0.5, { width: c.width - 10, lineBreak: false });
      else if (c.key.startsWith("to")) {
        const idx = Number(c.key.slice(2));
        const mark = idx === 9 ? b.mark : earlierB.get(earlierTerms[idx]) ?? null;
        cellText(mark != null ? `${exact(mark)}/${b.max}` : "–", x, c, h, { font: F.bold, color: mark != null ? C.ink : C.faint, size: fs - 0.4 });
      } else if (c.key === "at") {
        const marks = [...earlierTerms.map((t) => earlierB.get(t) ?? null), b.mark].filter((m): m is number => m != null);
        cellText(marks.length ? `${exact(marks.reduce((a2, m) => a2 + m, 0))}/${b.max * marks.length}` : "–", x, c, h, { font: F.bold, color: marks.length ? C.ink : C.faint, size: fs - 0.6 });
      }
      x += c.width;
    }
    rowLine(h);
    y += h;
  }

  const groups = rtbGroups(doc);
  let anyPartial = false;
  for (const g of groups) {
    if (ensure(16 + 20)) header();
    pdf.rect(M, y, W, 15).fill(C.navySoft);
    pdf.font(F.bold).fontSize(6.8).fillColor(C.navy).text(g.label.toUpperCase(), M + 6, y + 4.5, { width: W / 2, lineBreak: false, characterSpacing: 0.4 });
    const marked = g.subjects.filter((x2) => (annual ? x2.annual?.total : x2.total) != null);
    const comp = marked.filter((x2) => (annual ? x2.annual?.competent : x2.competent) === true).length;
    pdf
      .font(F.normal)
      .fontSize(6.4)
      .fillColor(C.muted)
      .text(`${g.subjects.length} module${g.subjects.length === 1 ? "" : "s"}${showComp && marked.length ? `  ·  ${comp} of ${marked.length} competent` : ""}`, M + W / 2, y + 4.5, {
        width: W / 2 - 6,
        align: "right",
        lineBreak: false,
      });
    y += 15;
    for (const s of g.subjects) {
      pdf.font(F.normal).fontSize(fs);
      const nameH = Math.min(pdf.heightOfString(s.name, { width: nameCol.width - 10 }), fs * 2.6);
      const h = Math.max(20, nameH + (s.code ? 8 : 0) + 7);
      if (ensure(h)) header();
      const partial = s.total != null && s.weight_covered != null && s.weight_covered < 100;
      if (partial) anyPartial = true;
      const failing = s.competent === false;
      let x = M;
      const tc = s.term_cell ?? { term: t3, fa: null, ia: null, ca: null, total: s.total };
      for (const c of cols) {
        if (c.key === "name") {
          const top = y + (h - nameH - (s.code ? 8 : 0)) / 2;
          if (s.code) pdf.font(F.bold).fontSize(5.9).fillColor(C.muted).text(s.code, x + 6, top, { width: c.width - 10, lineBreak: false, characterSpacing: 0.3 });
          pdf.font(F.normal).fontSize(fs).fillColor(s.total == null && !s.annual?.total ? C.muted : C.ink).text(s.name, x + 6, top + (s.code ? 8 : 0), { width: c.width - 10, height: fs * 2.6, ellipsis: true });
        } else if (c.key === "wt") cellText(s.weight != null ? exact(s.weight) : "–", x, c, h, { color: s.weight != null ? C.text : C.faint });
        else if (/^(fa|ia|ca|to)\d+$/.test(c.key)) {
          const kind = c.key.slice(0, 2) as "fa" | "ia" | "ca" | "to";
          const idx = Number(c.key.slice(2));
          const cell = idx === 9 ? tc : (s.earlier_terms ?? []).find((e) => e.term === earlierTerms[idx]) ?? null;
          const v = kind === "to" ? (cell?.total ?? null) : (cell?.[kind] ?? null);
          const na = kind === "ia" && !finalTerm;
          if (kind === "to") {
            const txt = v != null ? `${exact(v)}${idx === 9 && partial ? "*" : ""}` : "–";
            cellText(txt, x, c, h, { font: F.bold, color: v == null ? C.faint : idx === 9 && failing && !annual ? C.red : C.ink });
          } else cellText(num(v, na), x, c, h, { color: tone(v, na) });
        } else if (c.key === "at") {
          const v = s.annual?.total ?? null;
          cellText(v != null ? exact(v) : "–", x, c, h, { font: F.bold, color: v == null ? C.faint : s.annual?.competent === false ? C.red : C.ink });
        } else if (c.key === "re") cellText("–", x, c, h, { color: C.faint });
        else if (c.key === "rk") cellText(s.rank != null ? `${s.rank}/${s.rank_of}` : "–", x, c, h, { color: s.rank != null ? C.text : C.faint });
        else if (c.key === "de") {
          const comp = annual ? (s.annual?.competent ?? null) : s.competent;
          if (comp != null) pill(annual ? (comp ? "C" : "NYC") : comp ? "Competent" : "NYC", x, c, h, comp);
          else cellText(annual ? "–" : "Not assessed", x, c, h, { font: annual ? F.normal : F.italic, color: C.faint, size: annual ? fs : 6.4 });
        }
        x += c.width;
      }
      rowLine(h);
      y += h;
    }
  }
  if (!groups.length) {
    ensure(20);
    pdf.font(F.italic).fontSize(8).fillColor(C.muted).text("No modules recorded for this term.", M + 6, y + 6);
    y += 20;
  }

  // Totals / percentage / position rows (under the term total and the annual total).
  const sm = doc.summary;
  const termTotal = groups.flatMap((g2) => g2.subjects).filter((x2) => x2.total != null);
  const termMax = termTotal.length * 100;
  const summaryRows: Array<[string, string, string | null]> = [
    // Annual columns are narrow: the maximum goes in the label there.
    [
      annual ? `Totals (out of ${termMax || annual.total_max})` : "Totals",
      termMax ? (annual ? exact(sm.total_marks) : `${exact(sm.total_marks)}/${termMax}`) : "–",
      annual ? (annual.total_max ? `${exact(annual.total_marks)}/${annual.total_max}` : "–") : null,
    ],
    ["Percentage", sm.average != null ? `${exact(sm.average)}%` : "–", annual ? (annual.average != null ? `${exact(annual.average)}%` : "–") : null],
    ...(doc.scheme.show_position
      ? [["Position", sm.position != null ? `${sm.position}/${sm.position_of}` : "–", annual ? (annual.position != null ? `${annual.position}/${annual.position_of}` : "–") : null] as [string, string, string | null]]
      : []),
  ];
  const toCol = cols.findIndex((c) => c.key === "to9");
  const atCol = cols.findIndex((c) => c.key === "at");
  const xOf = (i: number) => M + cols.slice(0, i).reduce((a2, c) => a2 + c.width, 0);
  for (const [k, termV, yearV] of summaryRows) {
    const h = 16;
    if (ensure(h)) header();
    pdf.rect(M, y, W, h).fill(C.navySoft);
    pdf.font(F.bold).fontSize(6.8).fillColor(C.navy).text(k.toUpperCase(), M + 6, y + 5, { width: nameCol.width, lineBreak: false, characterSpacing: 0.4 });
    const toX = xOf(toCol);
    const spanTo = annual ? cols[toCol].width : cols.slice(toCol).reduce((a2, c) => a2 + c.width, 0);
    fit(termV, annual ? toX + 1 : toX + 2, y + 4.6, annual ? cols[toCol].width - 2 : spanTo - 4, fs, F.bold, C.ink, annual ? "center" : "left");
    if (yearV != null && atCol >= 0) {
      const ax = xOf(atCol);
      const aw = cols.slice(atCol).reduce((a2, c) => a2 + c.width, 0);
      pdf.font(F.bold).fontSize(fs).fillColor(C.navy).text(yearV, ax + 2, y + 4.6, { width: aw - 4, align: "left", lineBreak: false });
    }
    pdf.moveTo(M, y + h).lineTo(M + W, y + h).lineWidth(0.4).stroke(C.white);
    y += h;
  }
  if (anyPartial) {
    pdf.font(F.italic).fontSize(6.2).fillColor(C.muted).text("* Term mark over the work assessed so far (categories with no marks yet are left out).", M, y + 3, { width: W, lineBreak: false });
    y += 10;
  }
  if (showComp) {
    const comp = annual ? annual.modules_competent : (sm.modules_competent ?? 0);
    const nyc = annual ? annual.modules_nyc : (sm.modules_nyc ?? 0);
    pdf.font(F.bold).fontSize(7.4).fillColor(C.navy).text(`Competent in ${comp} of ${comp + nyc} module${comp + nyc === 1 ? "" : "s"}${annual ? " over the year" : ""}.`, M, y + 4, { width: W, lineBreak: false });
    y += 14;
  }
  y += 4;

  // ── Class trainer's comment (+ head of school's) ──────────────────────
  const comment = (ttl: string, text: string | null) => {
    const body = text?.trim() || "—";
    pdf.font(F.normal).fontSize(8.2);
    const h = Math.min(Math.max(pdf.heightOfString(body, { width: W - 24 }) + 22, 36), 90);
    ensure(h + 6);
    pdf.roundedRect(M, y, W, h, 6).lineWidth(0.6).stroke(C.line);
    label(ttl, M + 12, y + 7, W - 24);
    pdf.font(F.normal).fontSize(8.2).fillColor(C.text).text(body, M + 12, y + 17, { width: W - 24, height: h - 20, ellipsis: true });
    y += h + 6;
  };
  comment("Class trainer's comment", doc.comments.class_teacher);
  if (doc.comments.head_teacher?.trim()) comment(`${doc.scheme.head_title}'s comment`, doc.comments.head_teacher);

  // ── Attendance + general attributes (school additions, compact) ───────
  const a = doc.attendance;
  const attRows: Array<[string, number]> = [
    ["Present", a.present],
    ["Absent", a.absent],
    ["Excused", a.excused],
    ["Late", a.late],
    ["Sick", a.sick],
  ];
  const rowH = 11.5;
  const attW = 168;
  const blockH = 12 + Math.max(attRows.length, Math.max(doc.attributes.length, 1)) * rowH;
  ensure(blockH + 4);
  const top = y;
  label("Attendance", M, top, 90);
  label("Days", M + 92, top, 34, "center");
  label("%", M + 128, top, 40, "center");
  let ay = top + 11;
  for (const [k, n] of attRows) {
    pdf.font(F.normal).fontSize(7.4).fillColor(C.text).text(k, M, ay + 2.2, { width: 90, lineBreak: false });
    pdf.font(F.bold).fontSize(7.4).fillColor(C.ink).text(String(n), M + 92, ay + 2.2, { width: 34, align: "center", lineBreak: false });
    pdf.font(F.normal).fontSize(7.4).fillColor(C.muted).text(a.total ? `${pct(n, a.total)}%` : "–", M + 128, ay + 2.2, { width: 40, align: "center", lineBreak: false });
    pdf.moveTo(M, ay + rowH).lineTo(M + attW, ay + rowH).lineWidth(0.4).stroke(C.line);
    ay += rowH;
  }
  const bx = M + attW + 20;
  const bw = W - attW - 20;
  const ratings = ["Excellent", "Very good", "Good"];
  const rw = 50;
  label("General attributes", bx, top, bw - ratings.length * rw);
  ratings.forEach((r, i) => label(r, bx + bw - ratings.length * rw + i * rw, top, rw, "center"));
  let by = top + 11;
  if (doc.attributes.length === 0) {
    pdf.font(F.italic).fontSize(7.4).fillColor(C.muted).text("Not rated.", bx, by + 2.2);
    by += rowH;
  }
  for (const attr of doc.attributes) {
    pdf.font(F.normal).fontSize(7.4).fillColor(C.text).text(attr.attribute_name, bx, by + 2.2, { width: bw - ratings.length * rw - 6, lineBreak: false, ellipsis: true });
    ratings.forEach((r, i) => {
      const cx = bx + bw - ratings.length * rw + i * rw + rw / 2;
      if (attr.rating === r) pdf.circle(cx, by + 5.8, 3.1).fill(C.navy);
      else pdf.circle(cx, by + 5.8, 3.1).lineWidth(0.6).stroke(C.line);
    });
    pdf.moveTo(bx, by + rowH).lineTo(bx + bw, by + rowH).lineWidth(0.4).stroke(C.line);
    by += rowH;
  }
  y = Math.max(ay, by) + 8;

  // ── Legend ────────────────────────────────────────────────────────────
  const th = doc.scheme.competence_thresholds;
  const legend =
    `FA Formative assessment (CW+HW+MD) · IA Integrated assessment (Term 3) · CA Comprehensive assessment (end of term) · TO Term total` +
    (annual ? " · AT Annual total (average of the terms assessed) · Re Re-assessment · De Decision" : "") +
    ` · C Competent · NYC Not Yet Competent · N/A Not applicable · Weight = learning hours (credits × 10)` +
    (showComp && th ? ` · Competent from ${th.specific}% (specific modules), ${th.general}% (general), ${th.complementary}% (complementary).` : ".");
  pdf.font(F.normal).fontSize(6);
  const lh = pdf.heightOfString(legend, { width: W });
  ensure(lh + 6);
  pdf.fillColor(C.muted).text(legend, M, y, { width: W });
  y += lh + 6;

  if (doc.next_term_begins_on) {
    ensure(14);
    const d = new Date(`${doc.next_term_begins_on}T00:00:00Z`);
    const when = d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
    pdf.font(F.bold).fontSize(8).fillColor(C.navy).text(`Next term begins on ${when}`, M, y, { width: W, align: "center", lineBreak: false });
    y += 13;
  }

  // ── Deliberation (final term) ─────────────────────────────────────────
  if (finalTerm) {
    const graduating = q?.rqf_level === "5";
    const options = graduating ? ["Graduated", ...DELIBERATIONS.slice(1)] : DELIBERATIONS;
    const dh = 36;
    ensure(dh + 4);
    pdf.roundedRect(M, y, W, dh, 6).lineWidth(0.6).stroke(C.line);
    label("Deliberation", M + 10, y + 6, 120);
    const ow = (W - 20) / options.length;
    options.forEach((o, i) => {
      const ox = M + 10 + i * ow;
      pdf.roundedRect(ox, y + 18, 8, 8, 1.5).lineWidth(0.7).stroke(C.navy);
      fit(o, ox + 12, y + 19, ow - 14, 6.8, F.normal, C.text);
    });
    y += dh + 6;
  }

  // ── Signatures, stamp, verification ───────────────────────────────────
  const bandH = 66;
  ensure(bandH);
  pdf.moveTo(M, y).lineTo(M + W, y).lineWidth(0.4).stroke(C.line);
  const bandTop = y + 8;
  const sigW = 118;
  const sigY = bandTop + 34;
  pdf.font(F.normal).fontSize(6.6).fillColor(C.muted).text("Date: ____________________", M, bandTop + 2, { width: sigW, lineBreak: false });
  pdf.moveTo(M, sigY).lineTo(M + sigW, sigY).lineWidth(0.6).stroke(C.muted);
  pdf.moveTo(M + sigW + 18, sigY).lineTo(M + sigW * 2 + 18, sigY).lineWidth(0.6).stroke(C.muted);
  pdf
    .font(F.normal)
    .fontSize(6.8)
    .fillColor(C.muted)
    .text("Class trainer", M, sigY + 4, { width: sigW, align: "center", lineBreak: false })
    .text(`School manager (${doc.scheme.head_title})`, M + sigW + 18, sigY + 4, { width: sigW, align: "center", lineBreak: false });
  // Stamp area.
  const stX = M + sigW * 2 + 32;
  pdf.save();
  pdf.roundedRect(stX, bandTop, 64, 50, 6).dash(2, { space: 2 }).lineWidth(0.6).stroke(C.faint);
  pdf.restore();
  pdf.undash();
  pdf.font(F.normal).fontSize(6).fillColor(C.faint).text("School stamp", stX, bandTop + 22, { width: 64, align: "center", lineBreak: false });
  const vx = stX + 76;
  const vw = W - (vx - M);
  if (qr) {
    const qsz = 50;
    pdf.image(qr, M + W - qsz, bandTop, { width: qsz, height: qsz });
    const tw2 = vw - qsz - 8;
    const issuedOn = doc.card.approved_at ? new Date(doc.card.approved_at) : new Date();
    pdf.font(F.bold).fontSize(7).fillColor(C.navy).text("Verify this report", vx, bandTop + 2, { width: tw2, lineBreak: false });
    pdf
      .font(F.normal)
      .fontSize(6.2)
      .fillColor(C.muted)
      .text(`Scan the code. Version ${doc.card.version}, approved ${issuedOn.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.`, vx, bandTop + 12, { width: tw2 });
    pdf.font(F.normal).fontSize(5.6).fillColor(C.navy).text(url, vx, bandTop + 32, { width: tw2, height: 16, ellipsis: true });
  } else {
    pdf.font(F.italic).fontSize(6.8).fillColor(C.red).text("Provisional — not yet approved. This report can't be verified.", vx, bandTop + 14, { width: vw, align: "right" });
  }
  y = bandTop + bandH - 8;
}

// ─── Class pack: ranking cover + one card per page, best first ──────────────

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

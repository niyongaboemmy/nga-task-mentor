import type { ReportCardDocument } from "./reportCardDocument";
import { C, F, exact, pct, type CardArt } from "./reportCardPdfCommon";

/**
 * The Normal report card template (PDF): the school's identity (logo, name,
 * navy brand colour), the student, results by subject with CW/HW/MD/EOT,
 * total, grade, class average, rank and teacher, the summary, attendance,
 * attributes, comments, grading scale, signatures, next-term date and the
 * QR verification of this exact version.
 */

/** Page margin of the Normal card (points). */
export const NORMAL_MARGIN = 30;

/** Draws the card from the top of the current page; returns the y where it ends. */
export function drawNormalCard(pdf: PDFKit.PDFDocument, doc: ReportCardDocument, art: CardArt): number {
  const { watermark, url, qr, logo } = art;

  const M = NORMAL_MARGIN;
  const W = pdf.page.width - M * 2;
  const bottom = art.bottom ?? pdf.page.height - M;
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
  // The name gets the most room; any value too long shrinks a little, then ends in "…", always on one line.
  const weights = [1.7, 1, 1, 1.3].slice(0, fields.length);
  const unit = (W - 24) / weights.reduce((a, b) => a + b, 0);
  let x = M + 12;
  fields.forEach(([k, v], i) => {
    const cw = unit * weights[i];
    const room = cw - 12;
    label(k, x, y + 8, room);
    pdf.font(F.bold);
    let size = 9.5;
    while (size > 7.5 && pdf.fontSize(size).widthOfString(v) > room) size -= 0.5;
    let text = v;
    if (pdf.fontSize(size).widthOfString(text) > room) {
      while (text.length > 1 && pdf.widthOfString(`${text}…`) > room) text = text.slice(0, -1);
      text = `${text.trimEnd()}…`;
    }
    pdf.fillColor(C.ink).text(text, x, y + 18 + (9.5 - size) / 2, { lineBreak: false });
    x += cw;
  });
  y += panelH + 12;

  // ── Results table (RTB modules) ───────────────────────────────────────
  const w = doc.scheme.category_weights;
  const showCA = doc.scheme.show_class_average;
  const showT = doc.scheme.show_subject_teacher;
  const showRank = doc.scheme.show_subject_rank !== false;
  const showComp = doc.scheme.show_competence !== false;
  const hasCodes = doc.groups.some((g) => g.subjects.some((x) => x.code));
  type Col = { key: string; label: string; sub?: string; width: number; align: "left" | "center" };
  const cols: Col[] = [
    ...(hasCodes ? [{ key: "code", label: "Code", width: 52, align: "left" as const }] : []),
    { key: "name", label: "Module", width: 0, align: "left" },
    { key: "CW", label: "CW", sub: `/${w.CW}`, width: 31, align: "center" },
    { key: "HW", label: "HW", sub: `/${w.HW}`, width: 31, align: "center" },
    { key: "MD", label: "MD", sub: `/${w.MD}`, width: 31, align: "center" },
    { key: "EOT", label: "EOT", sub: `/${w.EOT}`, width: 31, align: "center" },
    { key: "TOT", label: "Mark", sub: "/100", width: 42, align: "center" },
    { key: "GR", label: "Grade", width: 36, align: "center" },
    ...(showRank ? [{ key: "RK", label: "Pos.", sub: "in class", width: 38, align: "center" as const }] : []),
    ...(showCA ? [{ key: "CA", label: "Class", sub: "avg", width: 36, align: "center" as const }] : []),
    ...(showComp ? [{ key: "DEC", label: "Decision", width: 62, align: "center" as const }] : []),
  ];
  const nameIdx = cols.findIndex((c) => c.key === "name");
  cols[nameIdx].width = W - cols.reduce((a2, c) => a2 + c.width, 0);
  const nameW = cols[nameIdx].width;
  let anyPartial = false;

  const header = () => {
    ensure(26);
    pdf.rect(M, y, W, 24).fill(C.navy);
    let x = M;
    for (const c of cols) {
      pdf.font(F.bold).fontSize(6.9).fillColor(C.white).text(c.label.toUpperCase(), x + 5, y + (c.sub ? 5 : 9), {
        width: c.width - 10,
        align: c.align,
        lineBreak: false,
      });
      if (c.sub) pdf.font(F.normal).fontSize(6).fillColor("#BFD0E3").text(c.sub, x + 5, y + 14, { width: c.width - 10, align: c.align, lineBreak: false });
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
      pdf.font(F.bold).fontSize(7.3).fillColor(C.navy).text((group.name ?? "Other modules").toUpperCase(), M + 6, y + 5, {
        width: W / 2,
        lineBreak: false,
        characterSpacing: 0.4,
      });
      const marked = group.subjects.filter((x) => x.total != null);
      const comp = marked.filter((x) => x.competent).length;
      const info = `${group.subjects.length} module${group.subjects.length === 1 ? "" : "s"}` + (showComp && marked.length ? `  ·  ${comp} of ${marked.length} competent` : "");
      pdf.font(F.normal).fontSize(6.8).fillColor(C.muted).text(info, M + W / 2, y + 5, { width: W / 2 - 6, align: "right", lineBreak: false });
      y += 16;
    }
    for (const s of group.subjects) {
      pdf.font(F.normal).fontSize(7.8);
      const nameH = Math.min(pdf.heightOfString(s.name, { width: nameW - 10 }), 20);
      const teacherLine = showT && s.teacher ? 9 : 0;
      const h = Math.max(19, nameH + teacherLine + 8);
      if (y + h > bottom) {
        ensure(h + 30);
        header();
      }
      pdf.rect(M, y, W, h).fill(zebra++ % 2 ? C.zebra : C.white);
      let x = M;
      const failing = s.competent === false || (s.competent == null && s.passed === false);
      const partial = s.total != null && s.weight_covered != null && s.weight_covered < 100;
      if (partial) anyPartial = true;
      const cell = (v: string, c: Col, o: { font?: string; color?: string; size?: number } = {}) => {
        pdf.font(o.font ?? F.normal).fontSize(o.size ?? 7.8);
        const th = pdf.heightOfString(v || " ", { width: c.width - 10 });
        // +1: glyphs sit high in their line box; this lines numbers up with the pills.
        pdf.fillColor(o.color ?? C.text).text(v, x + 5, y + Math.max(4, (h - th) / 2) + 1, { width: c.width - 10, align: c.align, height: h - 4, ellipsis: true });
      };
      const pill = (text: string, c: Col, bg: string, fg: string, pw: number) => {
        const px = x + (c.width - pw) / 2;
        pdf.roundedRect(px, y + h / 2 - 6.5, pw, 13, 6.5).fill(bg);
        pdf.font(F.bold).fontSize(6.9).fillColor(fg).text(text, px, y + h / 2 - 3.4, { width: pw, align: "center", lineBreak: false });
      };
      for (const c of cols) {
        if (c.key === "name") {
          const top = y + Math.max(4, (h - nameH - teacherLine) / 2);
          pdf.font(F.normal).fontSize(7.8).fillColor(C.ink).text(s.name, x + 5, top, { width: nameW - 10, height: 20, ellipsis: true });
          if (teacherLine) pdf.font(F.normal).fontSize(6.4).fillColor(C.muted).text(s.teacher!, x + 5, top + nameH + 1, { width: nameW - 10, lineBreak: false, ellipsis: true });
        } else if (c.key === "code") cell(s.code ?? "", c, { color: C.muted, size: 7 });
        else if (c.key === "TOT")
          cell(s.total == null ? "–" : `${exact(s.total)}${partial ? "*" : ""}`, c, { font: F.bold, size: 8.6, color: s.total == null ? C.faint : failing ? C.red : C.ink });
        else if (c.key === "GR") {
          if (s.grade) pill(s.grade, c, failing ? C.redSoft : C.navySoft, failing ? C.red : C.navy, 22);
          else cell("–", c, { color: C.faint });
        } else if (c.key === "RK") cell(s.rank != null ? `${s.rank}/${s.rank_of}` : "–", c, { color: s.rank != null ? C.text : C.faint, size: 7.6 });
        else if (c.key === "CA") cell(s.class_average != null ? exact(s.class_average) : "–", c, { color: s.class_average != null ? C.muted : C.faint });
        else if (c.key === "DEC") {
          if (s.competent != null) {
            if (s.competent) pill("Competent", c, "#E7F6EE", "#05603A", 52);
            else pill("NYC", c, C.redSoft, C.red, 34);
          } else if (s.total == null) cell("Not assessed", c, { font: F.italic, color: C.muted, size: 6.8 });
        } else {
          const v = s.categories[c.key as "CW"];
          cell(v != null ? exact(v) : "–", c, { color: v != null ? C.text : C.faint });
        }
        x += c.width;
      }
      pdf.moveTo(M, y + h).lineTo(M + W, y + h).lineWidth(0.4).stroke(C.line);
      y += h;
    }
  }
  if (doc.groups.length === 0) {
    ensure(20);
    pdf.font(F.italic).fontSize(8).fillColor(C.muted).text("No modules recorded for this term.", M + 6, y + 6);
    y += 20;
  }
  if (anyPartial) {
    y += 4;
    pdf.font(F.italic).fontSize(6.6).fillColor(C.muted).text("* Mark over the work assessed so far (categories with no marks yet are left out).", M, y, { width: W, lineBreak: false });
    y += 6;
  }
  y += 10;

  // ── Summary tiles ─────────────────────────────────────────────────────
  const sm = doc.summary;
  const ord = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
  const tiles: Array<[string, string, string?]> = [
    ["Average", sm.average != null ? `${exact(sm.average)}%` : "—", sm.remark ?? undefined],
    ...(doc.scheme.show_position && sm.position != null ? [["Position in class", ord(sm.position), `of ${sm.position_of}`] as [string, string, string]] : []),
    ["Grade", sm.grade ?? "—"],
    ...(showComp
      ? [["Competent", `${sm.modules_competent ?? 0}/${(sm.modules_competent ?? 0) + (sm.modules_nyc ?? 0)}`] as [string, string]]
      : [["Modules passed", `${sm.subjects_passed}/${sm.subjects_counted}`] as [string, string]]),
    ...(showCA && sm.class_average != null ? [["Class average", `${exact(sm.class_average)}%`] as [string, string]] : []),
  ];
  ensure(48);
  const gap = 8;
  const tw = (W - gap * (tiles.length - 1)) / tiles.length;
  tiles.forEach(([k, v, sub], i) => {
    const x = M + i * (tw + gap);
    const primary = i === 0;
    pdf.roundedRect(x, y, tw, 38, 6).fill(primary ? C.navy : C.navySoft);
    pdf
      .font(F.bold)
      .fontSize(6.5)
      .fillColor(primary ? "#BFD0E3" : C.muted)
      .text(k.toUpperCase(), x + 10, y + 7, { width: tw - 20, lineBreak: false, characterSpacing: 0.4 });
    pdf.font(F.bold).fontSize(15).fillColor(primary ? C.white : C.navy).text(v, x + 10, y + 17, { width: tw - 20, lineBreak: false });
    if (sub) {
      const vw = pdf.font(F.bold).fontSize(15).widthOfString(v);
      const sw = pdf.font(F.normal).fontSize(7.2).widthOfString(sub);
      pdf.fillColor(primary ? "#DCE6F2" : C.muted);
      // Beside the value when it fits; otherwise on the label line, right-aligned, so it never wraps.
      if (vw + 4 + sw <= tw - 20) pdf.text(sub, x + 14 + vw, y + 23, { lineBreak: false });
      else pdf.text(sub, x + 10, y + 7, { width: tw - 20, align: "right", lineBreak: false });
    }
  });
  y += 48;

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
  const rowH = 13;
  const blockH = 14 + Math.max(attRows.length, Math.max(doc.attributes.length, 1)) * rowH;
  ensure(blockH + 6);
  const top = y;
  label("Attendance", M, top, 90);
  label("Days", M + 96, top, 34, "center");
  label("%", M + 136, top, 40, "center");
  let ay = top + 12;
  for (const [k, n] of attRows) {
    pdf.font(F.normal).fontSize(8).fillColor(C.text).text(k, M, ay + 2.5, { width: 90, lineBreak: false });
    pdf.font(F.bold).fontSize(8).fillColor(C.ink).text(String(n), M + 96, ay + 2.5, { width: 34, align: "center", lineBreak: false });
    pdf.font(F.normal).fontSize(8).fillColor(C.muted).text(a.total ? `${pct(n, a.total)}%` : "—", M + 136, ay + 2.5, { width: 40, align: "center", lineBreak: false });
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
    pdf.font(F.italic).fontSize(8).fillColor(C.muted).text("Not rated.", bx, by + 2.5);
    by += rowH;
  }
  for (const attr of doc.attributes) {
    pdf.font(F.normal).fontSize(8).fillColor(C.text).text(attr.attribute_name, bx, by + 2.5, { width: bw - ratings.length * rw - 6, lineBreak: false, ellipsis: true });
    ratings.forEach((r, i) => {
      const cx = bx + bw - ratings.length * rw + i * rw + rw / 2;
      if (attr.rating === r) pdf.circle(cx, by + 6.5, 3.4).fill(C.navy);
      else pdf.circle(cx, by + 6.5, 3.4).lineWidth(0.6).stroke(C.line);
    });
    pdf.moveTo(bx, by + rowH).lineTo(bx + bw, by + rowH).lineWidth(0.4).stroke(C.line);
    by += rowH;
  }
  y = Math.max(ay, by) + 10;

  // ── Comments ──────────────────────────────────────────────────────────
  const comment = (title: string, text: string | null) => {
    const body = text?.trim() || "—";
    pdf.font(F.normal).fontSize(8.5);
    const h = Math.min(Math.max(pdf.heightOfString(body, { width: W - 24 }) + 24, 38), 100);
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
      "CW Class work · HW Homework · MD Midterm · EOT End of term exam · Pos. position in class" +
        (doc.scheme.show_competence !== false && doc.scheme.competence_thresholds
          ? ` · Competent: specific modules ${doc.scheme.competence_thresholds.specific}%+, general/complementary ${doc.scheme.competence_thresholds.general}%+ · NYC: not yet competent`
          : ""),
      M,
      y,
      { width: W, lineBreak: false },
    );
  y += 16;

  // ── Next term, then signatures and verification in one band ──────────
  if (doc.next_term_begins_on) {
    ensure(18);
    const d = new Date(`${doc.next_term_begins_on}T00:00:00Z`);
    const when = d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
    pdf.font(F.bold).fontSize(8.6).fillColor(C.navy).text(`Next term begins on ${when}`, M, y, { width: W, align: "center", lineBreak: false });
    y += 16;
  }
  const bandH = 62;
  ensure(bandH);
  pdf.moveTo(M, y).lineTo(M + W, y).lineWidth(0.4).stroke(C.line);
  const bandTop = y + 8;
  const sigW = 130;
  const sigY = bandTop + 30;
  pdf.moveTo(M, sigY).lineTo(M + sigW, sigY).lineWidth(0.6).stroke(C.muted);
  pdf.moveTo(M + sigW + 24, sigY).lineTo(M + sigW * 2 + 24, sigY).lineWidth(0.6).stroke(C.muted);
  pdf
    .font(F.normal)
    .fontSize(7)
    .fillColor(C.muted)
    .text("Class teacher", M, sigY + 4, { width: sigW, align: "center", lineBreak: false })
    .text(doc.scheme.head_title, M + sigW + 24, sigY + 4, { width: sigW, align: "center", lineBreak: false });
  const vx = M + sigW * 2 + 48;
  const vw = W - (vx - M);
  if (qr) {
    const qs = 50;
    pdf.image(qr, M + W - qs, bandTop, { width: qs, height: qs });
    const tw2 = vw - qs - 8;
    const issuedOn = doc.card.approved_at ? new Date(doc.card.approved_at) : new Date();
    pdf.font(F.bold).fontSize(7.2).fillColor(C.navy).text("Verify this report card", vx, bandTop + 2, { width: tw2, lineBreak: false });
    pdf
      .font(F.normal)
      .fontSize(6.4)
      .fillColor(C.muted)
      .text(
        `Scan the code. Version ${doc.card.version}, approved ${issuedOn.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.`,
        vx,
        bandTop + 13,
        { width: tw2 },
      );
    pdf.font(F.normal).fontSize(5.8).fillColor(C.navy).text(url, vx, bandTop + 33, { width: tw2, height: 16, ellipsis: true });
  } else {
    pdf.font(F.italic).fontSize(7).fillColor(C.red).text("Provisional — not yet approved. This document can't be verified.", vx, bandTop + 14, {
      width: vw,
      align: "right",
    });
  }
  y = bandTop + bandH - 8;
  return y;
}

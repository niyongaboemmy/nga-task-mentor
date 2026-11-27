/**
 * The document letterhead on the server: ONE place that puts a school's fixed header and
 * footer on every page of every PDF made here (pdfkit).
 *
 *   header  the school's Documents logo (falls back to its logo, then its name)
 *   footer  the school's footer image and/or footer text lines, then a small line with the
 *           document's own note and "Page N of M"
 *
 * Both are set per school in MIS (Tenants & Schools → Edit school → Document letterhead) and
 * read from the MIS school profile (services/schoolProfile.ts). The browser-side twin
 * (printed pages) is client/src/utils/documentLetterhead.ts; the measurements below are the
 * same on both sides and in MIS.
 *
 * pdfkit, three steps (the document needs `bufferPages: true`):
 *
 *   const lh = await loadLetterhead(req);                 // cached; never throws
 *   const f = letterheadFrame(pdf, lh);                   // f.top / f.bottom / f.pageBottom, in points
 *   ...draw from f.top, break pages at f.pageBottom...
 *   stampLetterhead(pdf, lh, { note: "Annual summary" }); // last: draws it on every page
 *
 * A document with its own masthead (a report card) passes `header: false` to both calls and
 * gets the footer only.
 */
import axios from "axios";
import type { Request } from "express";
import { getSchoolProfile, type SchoolProfile } from "./schoolProfile";

// ─── Measurements (mm), the same as the client and MIS ─────────────────────
export const EDGE_MM = 6;
export const HEADER_LOGO_MM = 13;
export const HEADER_LOGO_MAX_WIDTH_MM = 70;
export const HEADER_NAME_MM = 6;
export const FOOTER_IMAGE_MAX_MM = 22;
export const FOOTER_TEXT_LINE_MM = 3.6;
export const PAGE_LINE_MM = 4;
export const GAP_MM = 4;
export const FOOTER_TEXT_MAX_LINES = 4;

/** Points per millimetre (pdfkit draws in points). */
export const MM = 72 / 25.4;

export interface LetterheadImage {
  /** PNG or JPEG bytes (what pdfkit can draw). */
  data: Buffer;
  width: number;
  height: number;
}

export interface Letterhead {
  schoolName: string;
  header: LetterheadImage | null;
  footer: LetterheadImage | null;
  footerLines: string[];
}

export const EMPTY_LETTERHEAD: Letterhead = { schoolName: "", header: null, footer: null, footerLines: [] };

export const footerLinesOf = (text: unknown): string[] =>
  typeof text === "string"
    ? text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(0, FOOTER_TEXT_MAX_LINES)
    : [];

/** True when the school set a footer (an image or text): the part a report card carries. */
export const hasFooter = (lh: Letterhead | null | undefined): boolean => !!lh && (!!lh.footer || lh.footerLines.length > 0);

// ─── Loading ────────────────────────────────────────────────────────────────
/** Width and height of a PNG or JPEG; null for anything else (pdfkit draws only these two). */
export function imageSize(buf: Buffer): { width: number; height: number } | null {
  if (buf.length >= 24 && buf.readUInt32BE(0) === 0x89504e47 && buf.readUInt32BE(4) === 0x0d0a1a0a) {
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    return width > 0 && height > 0 ? { width, height } : null;
  }
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let pos = 2;
    while (pos + 9 < buf.length) {
      if (buf[pos] !== 0xff) return null;
      const marker = buf[pos + 1];
      if (marker === 0xff) {
        pos++; // fill byte
        continue;
      }
      // SOF0..SOF15 carry the size (not DHT 0xC4, JPG 0xC8, DAC 0xCC).
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        const height = buf.readUInt16BE(pos + 5);
        const width = buf.readUInt16BE(pos + 7);
        return width > 0 && height > 0 ? { width, height } : null;
      }
      pos += 2 + buf.readUInt16BE(pos + 2);
    }
  }
  return null;
}

// One read per address, kept briefly: MIS addresses carry the upload's timestamp, so a new
// upload is a new address; the time limit covers anything that does not.
const IMAGE_TTL_MS = 10 * 60 * 1000;
const IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const CACHE_MAX = 40;
const imageCache = new Map<string, { at: number; image: Promise<LetterheadImage | null> }>();

async function readImage(url: string): Promise<LetterheadImage | null> {
  try {
    const res = await axios.get<ArrayBuffer>(url, { responseType: "arraybuffer", timeout: 8000, maxContentLength: IMAGE_MAX_BYTES });
    const data = Buffer.from(res.data);
    const size = imageSize(data);
    if (!size) {
      console.warn(`documentLetterhead: ${url} is not a PNG or JPEG, left out`);
      return null;
    }
    return { data, ...size };
  } catch (e: any) {
    console.warn(`documentLetterhead: ${url} could not be read:`, e?.message ?? e);
    return null;
  }
}

function cachedImage(url: string | null | undefined): Promise<LetterheadImage | null> {
  if (!url || !/^https?:\/\//i.test(url)) return Promise.resolve(null);
  const hit = imageCache.get(url);
  if (hit && Date.now() - hit.at < IMAGE_TTL_MS) return hit.image;
  const image = readImage(url);
  imageCache.set(url, { at: Date.now(), image });
  // A failed read is not remembered (MIS may just be restarting).
  void image.then((img) => {
    if (!img && imageCache.get(url)?.image === image) imageCache.delete(url);
  });
  if (imageCache.size > CACHE_MAX) imageCache.delete(imageCache.keys().next().value as string);
  return image;
}

export interface LoadOptions {
  /** false skips the header image (a document that draws its own masthead). */
  header?: boolean;
}

/** The letterhead of an MIS school profile. */
export async function letterheadOf(profile: SchoolProfile | null | undefined, opts: LoadOptions = {}): Promise<Letterhead> {
  if (!profile) return EMPTY_LETTERHEAD;
  const [header, footer] = await Promise.all([
    opts.header === false ? null : cachedImage(profile.documents_logo_url).then((img) => img ?? cachedImage(profile.logo_url)),
    cachedImage(profile.documents_footer_url),
  ]);
  return { schoolName: profile.name ?? "", header, footer, footerLines: footerLinesOf(profile.documents_footer_text) };
}

/**
 * The letterhead of the school the request runs for. Without a request (or when MIS can't be
 * reached) the last profile read for this school is used. Never throws: a document is still
 * made when the letterhead cannot be read.
 */
export async function loadLetterhead(req: Request | null, opts: LoadOptions = {}): Promise<Letterhead> {
  try {
    return await letterheadOf((await getSchoolProfile(req)).profile, opts);
  } catch (e: any) {
    console.warn("documentLetterhead: not loaded:", e?.message ?? e);
    return EMPTY_LETTERHEAD;
  }
}

/** Tests only. */
export function clearLetterheadCache() {
  imageCache.clear();
}

// ─── Layout ─────────────────────────────────────────────────────────────────
export interface LetterheadOptions {
  /** Left/right margin of the document in mm (the letterhead lines up with it). Default 14. */
  sideMm?: number;
  /** false leaves the header out (a document that draws its own masthead). */
  header?: boolean;
  /** Small text at the right of the header, e.g. the document's title. */
  title?: string;
  /** Small text at the left of the page-number line; a function gives each page its own (1-based). */
  note?: string | ((page: number, pages: number) => string | null | undefined);
  /** false leaves "Page N of M" out. */
  pageNumbers?: boolean;
}

export interface LetterheadLayout {
  topMm: number;
  bottomMm: number;
  sideMm: number;
  headerMm: number;
  footerImageWidthMm: number;
  footerImageHeightMm: number;
  showHeader: boolean;
}

/** What the letterhead takes from a page of `pageWidthMm` (pure: unit-tested). */
export function letterheadLayout(lh: Letterhead, pageWidthMm: number, opts: LetterheadOptions = {}): LetterheadLayout {
  const sideMm = opts.sideMm ?? 14;
  const contentWidthMm = pageWidthMm - 2 * sideMm;
  const showHeader = opts.header !== false;
  const headerMm = !showHeader ? 0 : lh.header ? HEADER_LOGO_MM : lh.schoolName || opts.title ? HEADER_NAME_MM : 0;
  const topMm = headerMm ? EDGE_MM + headerMm + GAP_MM : 12;

  let footerImageWidthMm = 0;
  let footerImageHeightMm = 0;
  if (lh.footer && lh.footer.width > 0 && lh.footer.height > 0) {
    const ratio = lh.footer.width / lh.footer.height;
    footerImageWidthMm = contentWidthMm;
    footerImageHeightMm = contentWidthMm / ratio;
    if (footerImageHeightMm > FOOTER_IMAGE_MAX_MM) {
      footerImageHeightMm = FOOTER_IMAGE_MAX_MM;
      footerImageWidthMm = FOOTER_IMAGE_MAX_MM * ratio;
    }
  }
  const textMm = lh.footerLines.length * FOOTER_TEXT_LINE_MM;
  const bandMm = footerImageHeightMm + textMm + (footerImageHeightMm && textMm ? 1 : 0);
  const bottomMm = EDGE_MM + PAGE_LINE_MM + (bandMm ? bandMm + 1 : 0) + GAP_MM;
  const r = (n: number) => Math.round(n * 100) / 100;
  return { topMm: r(topMm), bottomMm: r(bottomMm), sideMm, headerMm, footerImageWidthMm: r(footerImageWidthMm), footerImageHeightMm: r(footerImageHeightMm), showHeader };
}

// ─── pdfkit ─────────────────────────────────────────────────────────────────
export interface LetterheadFrame {
  /** First y the document may draw at (points). */
  top: number;
  /** Space to keep free at the bottom (points). */
  bottom: number;
  /** Last y the document may draw at (page height − bottom). */
  pageBottom: number;
}

/** Where a pdfkit document may draw, in points. */
export function letterheadFrame(pdf: PDFKit.PDFDocument, lh: Letterhead, opts: LetterheadOptions = {}): LetterheadFrame {
  const l = letterheadLayout(lh, pdf.page.width / MM, opts);
  const bottom = l.bottomMm * MM;
  return { top: l.topMm * MM, bottom, pageBottom: pdf.page.height - bottom };
}

const INK = "#1a2333";
const MUTED = "#6b7280";
/** Helvetica's ascender: pdfkit places text by its top, the measurements are to the baseline. */
const ASCENT = 0.718;

/**
 * Draws the letterhead on every page of a finished pdfkit document. Call it last, after all
 * pages exist (it needs the page count for "Page N of M"); the document must have been
 * created with `bufferPages: true`.
 */
export function stampLetterhead(pdf: PDFKit.PDFDocument, lh: Letterhead, opts: LetterheadOptions = {}): void {
  const range = pdf.bufferedPageRange();
  const pages = range.count;
  // Opened once, so every page points at the same image instead of carrying its own copy.
  const open = (img: LetterheadImage | null) => (img ? (pdf as any).openImage(img.data) : null);
  const headerImage = opts.header === false ? null : open(lh.header);
  const footerImage = open(lh.footer);
  for (let i = 0; i < pages; i++) {
    pdf.switchToPage(range.start + i);
    const page = pdf.page;
    const w = page.width;
    const h = page.height;
    const l = letterheadLayout(lh, w / MM, opts);
    const side = l.sideMm * MM;
    // Nothing here may start a new page: the letterhead sits inside the page's margins.
    const keep = { top: page.margins.top, bottom: page.margins.bottom };
    page.margins.top = 0;
    page.margins.bottom = 0;
    /** One line of text whose baseline is at `baseline`. */
    const line = (text: string, baseline: number, size: number, align: "left" | "center" | "right", font = "Helvetica", color = MUTED) =>
      pdf
        .font(font)
        .fontSize(size)
        .fillColor(color)
        .fillOpacity(1)
        .text(text, side, baseline - size * ASCENT, { width: w - 2 * side, align, lineBreak: false, ellipsis: true });

    // Header: the mark (or the school's name) at the left, the document title at the right.
    if (l.showHeader) {
      if (lh.header) {
        let ih = HEADER_LOGO_MM * MM;
        let iw = (ih * lh.header.width) / lh.header.height;
        const max = HEADER_LOGO_MAX_WIDTH_MM * MM;
        if (iw > max) {
          iw = max;
          ih = (iw * lh.header.height) / lh.header.width;
        }
        pdf.image(headerImage, side, EDGE_MM * MM + (HEADER_LOGO_MM * MM - ih) / 2, { width: iw, height: ih });
      } else if (lh.schoolName) {
        line(lh.schoolName, (EDGE_MM + HEADER_NAME_MM - 1.5) * MM, 11, "left", "Helvetica-Bold", INK);
      }
      if (opts.title) line(opts.title, (EDGE_MM + (l.headerMm || HEADER_NAME_MM) / 2 + 1) * MM, 7.5, "right");
    }

    // Footer, from the bottom up: page line, text lines, image.
    let y = h - EDGE_MM * MM;
    const note = typeof opts.note === "function" ? opts.note(i + 1, pages) : opts.note;
    if (note) line(note, y - MM, 7, "left");
    if (opts.pageNumbers !== false) line(`Page ${i + 1} of ${pages}`, y - MM, 7, "right");
    y -= (PAGE_LINE_MM + 1) * MM;
    if (lh.footerLines.length) {
      for (let k = lh.footerLines.length - 1; k >= 0; k--) {
        line(lh.footerLines[k], y - MM, 7.5, "center", "Helvetica", INK);
        y -= FOOTER_TEXT_LINE_MM * MM;
      }
      if (lh.footer) y -= MM;
    }
    if (lh.footer && l.footerImageHeightMm) {
      const iw = l.footerImageWidthMm * MM;
      const ih = l.footerImageHeightMm * MM;
      pdf.image(footerImage, (w - iw) / 2, y - ih, { width: iw, height: ih });
    }
    page.margins.top = keep.top;
    page.margins.bottom = keep.bottom;
  }
}

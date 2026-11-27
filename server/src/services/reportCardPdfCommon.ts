import fs from "fs";
import path from "path";
import QRCode from "qrcode";
import type { ReportCardDocument } from "./reportCardDocument";
import { currentTenantOrNull } from "../vendor/nga-tenancy";
import type { Letterhead } from "./documentLetterhead";

/**
 * What every report card PDF template shares: the palette, fonts, the
 * built-in logo, exact mark formatting, the verification link + QR, the
 * PROVISIONAL watermark and collecting pdfkit output into a Buffer.
 */

export const C = {
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
export const F = { normal: "Helvetica", bold: "Helvetica-Bold", italic: "Helvetica-Oblique" };


/** Built-in logos shipped with the server (assets/branding/<logo>-logo-horizontal.png). */
export function logoPath(logo: string | null | undefined): string | null {
  if (!logo || !/^[a-z0-9-]+$/.test(logo)) return null;
  const p = path.resolve(__dirname, "../../assets/branding", `${logo}-logo-horizontal.png`);
  return fs.existsSync(p) ? p : null;
}

/** Exact marks, never rounded to whole numbers: up to 2 decimals (the precision marks are stored at), trailing zeros dropped. */
export const exact = (n: number | null | undefined) => (n == null ? "" : String(Number(n.toFixed(2))));
export const pct = (n: number, d: number) => (d > 0 ? exact((n / d) * 100) : "0");

export interface PdfOptions {
  /** e.g. https://taskmentor.amashuri.com — the QR points at {base}/api/public/verify/report-card/{uuid}?v= */
  verificationBaseUrl: string;
  /** Overrides the default (PROVISIONAL for anything not approved/published). */
  watermark?: string | null;
  /**
   * The school's document letterhead (documentLetterhead.loadLetterhead(req, { header: false })).
   * A card has its own masthead, so only the footer is printed, under the card.
   */
  letterhead?: Letterhead | null;
}

export const isIssued = (doc: ReportCardDocument) => doc.card.status === "approved" || doc.card.status === "published";

export function verificationUrl(doc: ReportCardDocument, base: string): string {
  const tenant = currentTenantOrNull();
  const params = new URLSearchParams({ v: String(doc.card.version) });
  if (tenant && !tenant.isPrimary) params.set("tid", String(tenant.tid));
  return `${base.replace(/\/$/, "")}/api/public/verify/report-card/${doc.card.uuid}?${params.toString()}`;
}

/** What a card needs besides its document: watermark, verification link + QR, logo. */
export interface CardArt {
  watermark: string | null;
  url: string;
  qr: Buffer | null;
  logo: string | null;
  /** Last y the card may draw at before it starts a new page (default: the page height less the card's margin). */
  bottom?: number;
}

export async function cardArt(doc: ReportCardDocument, opts: PdfOptions): Promise<CardArt> {
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
export function collect(pdf: PDFKit.PDFDocument, draw: () => void): Promise<Buffer> {
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

/** Draws the faint diagonal watermark (PROVISIONAL) across the current page. */
export function drawWatermark(pdf: PDFKit.PDFDocument, watermark: string | null): void {
  if (!watermark) return;
  pdf.save();
  pdf.rotate(-35, { origin: [pdf.page.width / 2, pdf.page.height / 2] });
  pdf.font(F.bold).fontSize(86).fillColor(C.red).fillOpacity(0.06);
  pdf.text(watermark, 0, pdf.page.height / 2 - 44, { width: pdf.page.width, align: "center", lineBreak: false });
  pdf.restore();
  pdf.fillOpacity(1);
}

import crypto from "crypto";
import { Request } from "express";
import { Op } from "sequelize";
import { ReportCard } from "../models/ReportCard.model";
import { ReportCardSnapshot } from "../models/ReportCardWorkflow.model";
import fileServer from "../utils/fileServer";
import { buildCardDocuments, loadCohort, type ReportCardDocument } from "./reportCardDocument";
import { renderReportCardPdf } from "./reportCardDocumentPdf";
import { isFrozen } from "./reportCardWorkflow";
import { loadLetterhead } from "./documentLetterhead";

/**
 * Approval freezes a card: the rendered document is stored with the PDF made
 * from it and that PDF's SHA-256. Every read of an approved or published
 * card serves the snapshot, so a regrade, a late mark or a deleted quiz no
 * longer changes a card after approval. Reopening marks the snapshot
 * superseded (kept, never deleted) and the next approval writes version + 1.
 */

export const verificationBase = () =>
  process.env.APP_PUBLIC_URL || process.env.FRONTEND_URL?.replace(/\/$/, "") || "http://localhost:5002";

export const snapshotPdfPath = (uuid: string, version: number) => `report-cards/report-card-${uuid}-v${version}.pdf`;

/** The snapshot an approved/published card serves (latest, not superseded). */
export async function activeSnapshot(cardId: number): Promise<ReportCardSnapshot | null> {
  return ReportCardSnapshot.findOne({
    where: { report_card_id: cardId, superseded_at: { [Op.is]: null } as any },
    order: [["version", "DESC"]],
  });
}

export async function snapshotOfVersion(cardId: number, version: number): Promise<ReportCardSnapshot | null> {
  return ReportCardSnapshot.findOne({ where: { report_card_id: cardId, version } });
}

/** Store `doc` as the snapshot of the card's current version, with its PDF. */
export async function writeSnapshot(
  card: ReportCard,
  doc: ReportCardDocument,
  opts: { actorId: number | null; backfilled?: boolean; req?: Request | null },
): Promise<ReportCardSnapshot> {
  let pdfPath: string | null = null;
  let sha: string | null = null;
  try {
    // The school's footer as it is at approval: the stored PDF keeps it, like everything else on the card.
    const pdf = await renderReportCardPdf(doc, { verificationBaseUrl: verificationBase(), letterhead: await loadLetterhead(opts.req ?? null, { header: false }) });
    sha = crypto.createHash("sha256").update(pdf).digest("hex");
    const path = snapshotPdfPath(card.uuid, doc.card.version);
    await fileServer.uploadFile(pdf, path);
    pdfPath = path;
  } catch (e: any) {
    // The payload is the record; the PDF is re-rendered from it on download.
    console.warn(`reportCardSnapshot: PDF for card ${card.id} v${doc.card.version} not stored:`, e?.message ?? e);
  }
  const [row] = await ReportCardSnapshot.findOrCreate({
    where: { report_card_id: card.id!, version: doc.card.version },
    defaults: {
      report_card_id: card.id!,
      version: doc.card.version,
      payload: doc,
      pdf_path: pdfPath,
      pdf_sha256: sha,
      approved_by: opts.actorId,
      approved_at: doc.card.approved_at ? new Date(doc.card.approved_at) : new Date(),
      backfilled: !!opts.backfilled,
    } as any,
  });
  if (pdfPath && card.pdf_path !== pdfPath) await card.update({ pdf_path: pdfPath });
  return row;
}

/**
 * The frozen document of an approved/published card. A card published before
 * snapshots existed gets one now (marked backfilled) — the first read after
 * the migration fixes its numbers from then on.
 */
export async function frozenDocument(req: Request, card: ReportCard): Promise<ReportCardDocument | null> {
  if (!isFrozen(card.status)) return null;
  const snap = await activeSnapshot(card.id!);
  if (snap) return snap.payload as ReportCardDocument;
  if ((card.version ?? 0) < 1) await card.update({ version: 1 });
  const docs = await buildCardDocuments(req, [card], { cohort: await loadCohort(card) });
  const doc = docs.get(card.id!)!;
  doc.card.version = card.version;
  doc.card.approved_at = (card.approved_at ?? card.updatedAt ?? new Date()).toISOString?.() ?? new Date().toISOString();
  await writeSnapshot(card, doc, { actorId: card.approved_by ?? null, backfilled: true, req });
  return doc;
}

export async function supersedeSnapshots(cardId: number, reason: string): Promise<void> {
  await ReportCardSnapshot.update(
    { superseded_at: new Date(), superseded_reason: reason.slice(0, 500) },
    { where: { report_card_id: cardId, superseded_at: { [Op.is]: null } as any } },
  );
}

/** The card's PDF: the stored file of its snapshot, else rendered from the document. */
export async function cardPdf(doc: ReportCardDocument, snap: ReportCardSnapshot | null, req: Request | null = null): Promise<Buffer> {
  if (snap?.pdf_path) {
    try {
      return await fileServer.downloadToBuffer(snap.pdf_path);
    } catch (e: any) {
      console.warn(`reportCardSnapshot: stored PDF ${snap.pdf_path} unavailable, re-rendering:`, e?.message ?? e);
    }
  }
  return renderReportCardPdf(doc, { verificationBaseUrl: verificationBase(), letterhead: await loadLetterhead(req, { header: false }) });
}

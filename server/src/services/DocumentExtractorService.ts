import mammoth from "mammoth";
// pdf-parse uses CommonJS default export
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse") as (
  buffer: Buffer,
) => Promise<{ text: string }>;

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PDF_MIME = "application/pdf";

export class DocumentExtractorService {
  static readonly MAX_CHARS = 80_000;

  static async extractText(
    buffer: Buffer,
    mimeType: string,
    filename: string,
  ): Promise<{ text: string; charCount: number; truncated: boolean }> {
    const isDocx =
      mimeType === DOCX_MIME || filename.toLowerCase().endsWith(".docx");
    const isPdf =
      mimeType === PDF_MIME || filename.toLowerCase().endsWith(".pdf");

    let rawText = "";

    if (isDocx) {
      const result = await mammoth.extractRawText({ buffer });
      rawText = result.value;
    } else if (isPdf) {
      const result = await pdfParse(buffer);
      rawText = result.text;
    } else {
      throw new Error(
        `Unsupported file type: ${mimeType || filename}. Only PDF and DOCX are supported.`,
      );
    }

    // Normalize whitespace
    rawText = rawText.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

    const truncated = rawText.length > DocumentExtractorService.MAX_CHARS;
    const text = truncated
      ? rawText.slice(0, DocumentExtractorService.MAX_CHARS)
      : rawText;

    return { text, charCount: text.length, truncated };
  }
}

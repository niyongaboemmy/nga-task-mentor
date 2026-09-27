// Upload checks for the AI generator, shared by the dropzone and its tests.

export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const WARN_FILE_BYTES = 5 * 1024 * 1024;
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PDF_MIME = "application/pdf";

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** null when fine, otherwise the reason the file can't be used. */
export function checkFile(file: File): string | null {
  const name = file.name.toLowerCase();
  const ok = file.type === PDF_MIME || file.type === DOCX_MIME || name.endsWith(".pdf") || name.endsWith(".docx");
  if (!ok) return "Only PDF and DOCX files are supported.";
  if (file.size > MAX_FILE_BYTES) return `This file is ${formatBytes(file.size)} — the limit is 20 MB.`;
  if (file.size === 0) return "This file is empty.";
  return null;
}

import path from "path";
import fileServer from "./fileServer";
import { generateUniqueFilename, sanitizeKeepExtension } from "./uploadFilename";
import type { IFileSubmission } from "../models/Submission.model";

/** Size limit for one student submission file (multer + client dropzone). */
export const SUBMISSION_FILE_MAX_MB = 10;

/**
 * What a student may upload when the teacher left "allowed file types" empty.
 * When the teacher did list types, those win (see submissionFileError).
 */
export const DEFAULT_SUBMISSION_EXTENSIONS = [
  "pdf", "doc", "docx", "odt", "rtf", "txt", "md",
  "xls", "xlsx", "ods", "csv",
  "ppt", "pptx", "odp",
  "jpg", "jpeg", "png", "gif", "webp", "heic",
  "zip", "rar", "7z",
  "ai", "psd", "svg",
  "mp3", "m4a", "wav", "mp4", "mov", "webm",
  "html", "css", "js", "ts", "json", "py", "java", "c", "cpp", "cs", "php", "sql",
];

/** Never stored, whatever the teacher allows: they run when opened. */
export const BLOCKED_SUBMISSION_EXTENSIONS = [
  "exe", "msi", "bat", "cmd", "com", "scr", "pif", "vbs", "vbe", "ps1", "dll", "app", "dmg",
];

/** "pdf" for "report.PDF"; "" when the name has no extension. */
export const extensionOf = (name: string): string =>
  path.extname(name || "").replace(/^\./, "").toLowerCase();

/**
 * The assignment's allowed_file_types as bare lower-case extensions.
 * Stored values come in every shape the old and new forms produced:
 * ["pdf","docx"], [".PDF"], "pdf, docx", '["pdf"]' (JSON column read back as a string).
 */
export function normalizeAllowedTypes(raw: unknown): string[] {
  let list: unknown = raw;
  if (typeof list === "string") {
    const s = list.trim();
    if (!s) return [];
    try {
      list = JSON.parse(s);
    } catch {
      list = s.split(/[,\s;]+/);
    }
  }
  if (!Array.isArray(list)) return [];
  const out = new Set<string>();
  for (const v of list) {
    const t = String(v ?? "").trim().toLowerCase().replace(/^\*?\./, "");
    if (t) out.add(t);
  }
  return Array.from(out);
}

/** Why this file can't be submitted to this assignment, or null when it can. */
export function submissionFileError(
  file: { originalname: string; size?: number },
  allowedTypes: unknown,
): string | null {
  const ext = extensionOf(file.originalname);
  const name = `"${file.originalname}"`;
  if (!ext) return `${name} has no file extension, so its type can't be checked. Rename it (e.g. report.pdf) and try again.`;
  if (BLOCKED_SUBMISSION_EXTENSIONS.includes(ext)) return `${name} can't be submitted: .${ext} files are not accepted.`;
  if (file.size !== undefined && file.size > SUBMISSION_FILE_MAX_MB * 1024 * 1024) {
    return `${name} is too large. A submission file can be at most ${SUBMISSION_FILE_MAX_MB} MB.`;
  }
  const allowed = normalizeAllowedTypes(allowedTypes);
  const list = allowed.length ? allowed : DEFAULT_SUBMISSION_EXTENSIONS;
  if (!list.includes(ext)) {
    return allowed.length
      ? `${name} can't be submitted: this assignment accepts ${allowed.map((t) => `.${t}`).join(", ")} files only.`
      : `${name} can't be submitted: .${ext} files are not accepted.`;
  }
  return null;
}

/** Uploads a multer memory-storage file to the shared file-server and returns its record. */
export async function storeSubmissionFile(file: Express.Multer.File): Promise<IFileSubmission> {
  const filename = generateUniqueFilename("submission", file.originalname, sanitizeKeepExtension);
  const storedPath = `submissions/${filename}`;
  await fileServer.uploadFile(file.buffer, storedPath);
  return {
    filename,
    originalname: file.originalname,
    path: storedPath,
    size: file.size,
    mimetype: file.mimetype || "application/octet-stream",
  };
}

/** Model-hook messages that are the student's to fix (400), not a server fault (500). */
const VALIDATION_MESSAGES = [
  /^Text submission is required/,
  /^File submission is required/,
  /^File type .* is not allowed/,
  /^File type unknown/,
  /^Score cannot/,
];
export const isSubmissionValidationError = (err: unknown): err is Error =>
  err instanceof Error &&
  (err.name === "SequelizeValidationError" || VALIDATION_MESSAGES.some((re) => re.test(err.message)));

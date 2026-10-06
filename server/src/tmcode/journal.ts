import crypto from "crypto";

/**
 * Tamper-evident snapshot chain (PROTOCOL.md §4), the server side of
 * nga-tmcode/packages/protocol/src/journal.ts:
 *
 *   key        = HMAC-SHA256(key = base64decode(journal_nonce), "tmcode-journal-v1:" + session_id)
 *   files_hash = hex(SHA-256(JSON.stringify(files sorted by path as [[path, content], ...])))
 *   hmac_n     = hex(HMAC-SHA256(key, hmac_{n-1} | seq | question_id | kind | files_hash | client_ts))
 *   hmac_0     = ""  (one chain per session, across questions)
 */

export interface SnapshotFile {
  path: string;
  content: string;
}

export interface ChainRecord {
  seq: number;
  question_id: number;
  kind: string;
  files_hash: string;
  client_ts: string;
}

/** Sorted by path in UTF-16 code-unit order (JS `<`), like the client. */
export function canonicalFiles(files: SnapshotFile[]): string {
  const sorted = [...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return JSON.stringify(sorted.map((f) => [f.path, f.content]));
}

export const filesHash = (files: SnapshotFile[]): string =>
  crypto.createHash("sha256").update(canonicalFiles(files), "utf8").digest("hex");

export const journalKey = (journalNonceB64: string, sessionId: string): Buffer =>
  crypto
    .createHmac("sha256", Buffer.from(journalNonceB64, "base64"))
    .update(`tmcode-journal-v1:${sessionId}`, "utf8")
    .digest();

export const chainMessage = (prevHmac: string, r: ChainRecord) =>
  `${prevHmac}|${r.seq}|${r.question_id}|${r.kind}|${r.files_hash}|${r.client_ts}`;

export const chainHmac = (key: Buffer, prevHmac: string, r: ChainRecord): string =>
  crypto.createHmac("sha256", key).update(chainMessage(prevHmac, r), "utf8").digest("hex");

/** Constant-time compare of two hex digests. */
export function sameHex(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  if (!/^[0-9a-f]*$/i.test(a) || !/^[0-9a-f]*$/i.test(b)) return false;
  return crypto.timingSafeEqual(Buffer.from(a.toLowerCase(), "hex"), Buffer.from(b.toLowerCase(), "hex"));
}

import crypto from "crypto";
import zlib from "zlib";
import { Op } from "sequelize";
import { ProjectBlob, ProjectRevision } from "../../models";
import fileServer from "../../utils/fileServer";
import { projectLimits } from "./limits";

/**
 * Content-addressed project storage (PROJECTS_PLAN.md §2 "Blobs"). A blob is
 * one file's content, keyed by the sha256 of the UNCOMPRESSED bytes and kept
 * gzip'd: in MySQL (project_blobs.data_gz) when smaller than
 * PROJECTS_BLOB_DB_MAX_KB, otherwise on the file-server at
 * nga-task-mentor/projects/<sha>. Identical files are stored once across
 * every revision and user.
 *
 * Revision manifests are gzip(JSON [{path, sha256, size}]) sorted by path.
 */

export const SHA256_RE = /^[0-9a-f]{64}$/;

export interface ManifestEntry {
  path: string;
  sha256: string;
  size: number;
}

export const sha256Hex = (buf: Buffer) => crypto.createHash("sha256").update(buf).digest("hex");

export class BlobError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

const fsPath = (sha: string) => `projects/${sha}`;

/**
 * Store one gzip'd blob after checking it: it must gunzip, be no bigger than
 * the per-file quota, hash to `sha` and (when given) have `declaredSize`
 * bytes. Storing an existing blob is a no-op.
 */
export async function putBlob(
  sha: string,
  gz: Buffer,
  declaredSize: number | null,
): Promise<{ sha256: string; size: number; storage: "db" | "fs"; existed: boolean }> {
  const limits = projectLimits();
  if (!SHA256_RE.test(sha)) throw new BlobError(400, "VALIDATION_ERROR", "The blob id must be a lowercase sha256 hex.");
  if (!gz || gz.length === 0) throw new BlobError(400, "VALIDATION_ERROR", "Send the file gzip'd as the request body.");

  let raw: Buffer;
  try {
    raw = zlib.gunzipSync(gz, { maxOutputLength: limits.maxFileBytes + 1 });
  } catch (e: any) {
    if (e?.code === "ERR_BUFFER_TOO_LARGE" || /maxOutputLength|buffer/i.test(String(e?.message))) {
      throw new BlobError(413, "FILE_TOO_LARGE", `A file may be at most ${limits.maxFileBytes} bytes.`);
    }
    throw new BlobError(400, "BAD_GZIP", "The body is not valid gzip.");
  }
  if (raw.length > limits.maxFileBytes) {
    throw new BlobError(413, "FILE_TOO_LARGE", `A file may be at most ${limits.maxFileBytes} bytes.`);
  }
  const actual = sha256Hex(raw);
  if (actual !== sha) {
    throw new BlobError(422, "HASH_MISMATCH", "The content does not match its sha256.", { sha256: actual });
  }
  if (declaredSize != null && declaredSize !== raw.length) {
    throw new BlobError(422, "SIZE_MISMATCH", "The content size does not match the declared size.", { size: raw.length });
  }

  const existing = await ProjectBlob.findByPk(sha, { attributes: ["sha256", "size", "storage"] });
  if (existing) return { sha256: sha, size: existing.size, storage: existing.storage, existed: true };

  let storage: "db" | "fs" = raw.length < limits.blobDbMaxBytes ? "db" : "fs";
  if (storage === "fs") {
    try {
      await fileServer.uploadFile(gz, fsPath(sha));
    } catch (e: any) {
      // Dev machines often run without the file-server: keep the blob in
      // MySQL instead. In production a missing file-server is an outage.
      if (process.env.NODE_ENV === "production") {
        console.error("[projects] file-server upload failed:", e?.message);
        throw new BlobError(503, "STORAGE_UNAVAILABLE", "File storage is unavailable. Try again shortly.");
      }
      console.warn("[projects] file-server unavailable, storing blob in the DB:", e?.message);
      storage = "db";
    }
  }
  await ProjectBlob.bulkCreate(
    [{ sha256: sha, size: raw.length, storage, data_gz: storage === "db" ? gz : null, created_at: new Date() }],
    { ignoreDuplicates: true },
  );
  return { sha256: sha, size: raw.length, storage, existed: false };
}

/** The gzip'd content, or null when the blob is unknown or its file is gone. */
export async function readBlobGz(sha: string): Promise<Buffer | null> {
  if (!SHA256_RE.test(sha)) return null;
  const blob = await ProjectBlob.findByPk(sha);
  if (!blob) return null;
  if (blob.storage === "db") return blob.data_gz ?? null;
  try {
    return await fileServer.downloadToBuffer(fsPath(sha));
  } catch (e: any) {
    console.error("[projects] file-server download failed:", sha, e?.message);
    return null;
  }
}

/** Of `shas`, the ones not stored yet. */
export async function missingBlobs(shas: string[]): Promise<string[]> {
  const unique = [...new Set(shas)];
  const found = new Set<string>();
  for (let i = 0; i < unique.length; i += 1000) {
    const rows = await ProjectBlob.findAll({
      where: { sha256: { [Op.in]: unique.slice(i, i + 1000) } },
      attributes: ["sha256"],
    });
    rows.forEach((r) => found.add(r.sha256));
  }
  return unique.filter((s) => !found.has(s));
}

/** Stored sizes of the given blobs. */
export async function blobSizes(shas: string[]): Promise<Map<string, number>> {
  const unique = [...new Set(shas)];
  const out = new Map<string, number>();
  for (let i = 0; i < unique.length; i += 1000) {
    const rows = await ProjectBlob.findAll({
      where: { sha256: { [Op.in]: unique.slice(i, i + 1000) } },
      attributes: ["sha256", "size"],
    });
    rows.forEach((r) => out.set(r.sha256, Number(r.size)));
  }
  return out;
}

// ─── Manifests ───────────────────────────────────────────────────────────────

export const gzipManifest = (files: ManifestEntry[]) =>
  zlib.gzipSync(Buffer.from(JSON.stringify(files)));

// Revisions never change, so their parsed manifests are cached by id.
const manifestCache = new Map<number, ManifestEntry[]>();
const MANIFEST_CACHE_MAX = 300;

export function readManifest(rev: Pick<ProjectRevision, "id" | "manifest_gz">): ManifestEntry[] {
  const hit = manifestCache.get(rev.id);
  if (hit) return hit;
  const files = JSON.parse(zlib.gunzipSync(rev.manifest_gz).toString("utf8")) as ManifestEntry[];
  if (manifestCache.size >= MANIFEST_CACHE_MAX) {
    const oldest = manifestCache.keys().next().value;
    if (oldest !== undefined) manifestCache.delete(oldest);
  }
  manifestCache.set(rev.id, files);
  return files;
}

/** Same files (path, hash) in the same order. */
export const sameManifest = (a: ManifestEntry[], b: ManifestEntry[]) =>
  a.length === b.length && a.every((f, i) => f.path === b[i].path && f.sha256 === b[i].sha256);

// ─── Garbage collection ──────────────────────────────────────────────────────

/**
 * Delete the candidate blobs no remaining revision uses (after a project is
 * deleted). Manifests are gzip'd, so this scans them in id order; revisions
 * committed during the scan are re-checked before anything is deleted.
 */
export async function collectUnusedBlobs(candidates: Iterable<string>): Promise<number> {
  const pending = new Set(candidates);
  if (pending.size === 0) return 0;
  const scan = async (afterId: number) => {
    let last = afterId;
    for (;;) {
      const batch = await ProjectRevision.findAll({
        where: { id: { [Op.gt]: last } },
        attributes: ["id", "manifest_gz"],
        order: [["id", "ASC"]],
        limit: 200,
      });
      if (batch.length === 0) return last;
      for (const rev of batch) {
        for (const f of readManifest(rev)) pending.delete(f.sha256);
        last = rev.id;
      }
      if (pending.size === 0) return last;
    }
  };
  const lastSeen = await scan(0);
  if (pending.size > 0) await scan(lastSeen);
  if (pending.size === 0) return 0;

  const shas = [...pending];
  const rows = await ProjectBlob.findAll({ where: { sha256: { [Op.in]: shas } }, attributes: ["sha256", "storage"] });
  for (const row of rows) {
    if (row.storage === "fs") {
      await fileServer.deleteFile(fsPath(row.sha256)).catch((e) =>
        console.warn("[projects] file-server delete failed:", row.sha256, e?.message),
      );
    }
  }
  return ProjectBlob.destroy({ where: { sha256: { [Op.in]: shas } } });
}

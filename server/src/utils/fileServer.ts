// Client for the shared internal file-server service (lives in the
// nga_central_mis repo, deployed once on the box, used by both apps).
// Talks to it over the loopback interface since both run on the same EC2
// box -- no reason for server-to-server calls to leave it. Every path this
// app passes to the file-server is namespaced under its own app folder so
// it can never collide with nga_central_mis's files in the shared storage
// root.

import { currentTenantOrNull, PRIMARY_TENANT_ID, tenantPathFor } from "../vendor/nga-tenancy";

const FILE_SERVER_URL =
  process.env.FILE_SERVER_URL || "http://127.0.0.1:5004";
const FILE_SERVER_API_KEY = process.env.FILE_SERVER_API_KEY || "";
const NAMESPACE = "nga-task-mentor";

/**
 * Tenancy (CONTRACT.md §8): new files are written under
 * `nga-task-mentor/t/<tid>/<path>`; the stored path (DB rows, /uploads URLs)
 * stays tenant-less and the tenant comes from the request context. Files
 * written before tenancy live at `nga-task-mentor/<path>` and stay readable
 * as they are -- by the primary tenant only, so another school can never
 * reach them.
 */
function tenantId(): number {
  return currentTenantOrNull()?.tid ?? PRIMARY_TENANT_ID;
}

function namespaced(remotePath: string, tid: number = tenantId()): string {
  return tenantPathFor(tid, NAMESPACE, remotePath);
}

function legacyNamespaced(remotePath: string): string {
  return `${NAMESPACE}/${remotePath}`;
}

/** Where to look for a stored path, newest layout first. */
function readCandidates(remotePath: string): string[] {
  const tid = tenantId();
  return tid === PRIMARY_TENANT_ID ? [namespaced(remotePath, tid), legacyNamespaced(remotePath)] : [namespaced(remotePath, tid)];
}

export const __fileServerPaths = { namespaced, legacyNamespaced, readCandidates };

async function request(
  urlPath: string,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(`${FILE_SERVER_URL}${urlPath}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      "X-API-Key": FILE_SERVER_API_KEY,
    },
  });
}

class FileServerService {
  async uploadFile(buffer: Buffer, remotePath: string): Promise<void> {
    const form = new FormData();
    // "path" MUST come before "file": the file-server streams the upload to
    // disk and reads req.body.path when the file part starts. Sent the other
    // way round it sees an empty path and answers 400 "Invalid or unsafe path".
    form.append("path", namespaced(remotePath));
    form.append(
      "file",
      new Blob([new Uint8Array(buffer)]),
      remotePath.split("/").pop(),
    );

    const res = await request("/files", { method: "POST", body: form });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`file-server upload failed: ${body}`);
      throw new Error(`Failed to upload file: ${res.status} ${body}`);
    }
    console.log(`File uploaded: ${remotePath}`);
  }

  async downloadToBuffer(remotePath: string): Promise<Buffer> {
    let status = 404;
    for (const candidate of readCandidates(remotePath)) {
      const res = await request(`/files?path=${encodeURIComponent(candidate)}`);
      if (res.ok) return Buffer.from(await res.arrayBuffer());
      status = res.status;
      if (res.status !== 404) break;
    }
    throw new Error(`Failed to download file: ${status}`);
  }

  /** Streams the file straight into an Express response without buffering
   * the whole thing in memory first -- used by the /uploads proxy route,
   * which serves potentially many concurrent requests for large PDFs. */
  async streamTo(
    remotePath: string,
    res: import("express").Response,
    candidates: string[] = readCandidates(remotePath),
  ): Promise<boolean> {
    let upstream: Response | null = null;
    for (const candidate of candidates) {
      const r = await request(`/files?path=${encodeURIComponent(candidate)}`);
      if (r.ok && r.body) {
        upstream = r;
        break;
      }
    }
    if (!upstream || !upstream.body) return false;

    const contentType = upstream.headers.get("content-type");
    if (contentType) res.setHeader("Content-Type", contentType);
    const contentLength = upstream.headers.get("content-length");
    if (contentLength) res.setHeader("Content-Length", contentLength);

    const reader = upstream.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
    res.end();
    return true;
  }

  /** Only the pre-tenancy location (public legacy editor images). */
  async streamLegacyTo(remotePath: string, res: import("express").Response): Promise<boolean> {
    return this.streamTo(remotePath, res, [legacyNamespaced(remotePath)]);
  }

  async deleteFile(remotePath: string): Promise<void> {
    for (const candidate of readCandidates(remotePath)) {
      const res = await request(`/files?path=${encodeURIComponent(candidate)}`, { method: "DELETE" });
      if (!res.ok && res.status !== 404) {
        throw new Error(`Failed to delete file: ${res.status}`);
      }
    }
    console.log(`File deleted: ${remotePath}`);
  }

  async fileExists(remotePath: string): Promise<boolean> {
    try {
      for (const candidate of readCandidates(remotePath)) {
        const res = await request(`/files/exists?path=${encodeURIComponent(candidate)}`);
        if (!res.ok) continue;
        const data = (await res.json()) as { exists: boolean };
        if (data.exists) return true;
      }
      return false;
    } catch (error) {
      console.error(`file-server exists check failed: ${error}`);
      return false;
    }
  }
}

export default new FileServerService();

// Client for the shared internal file-server service (lives in the
// nga_central_mis repo, deployed once on the box, used by both apps).
// Talks to it over the loopback interface since both run on the same EC2
// box -- no reason for server-to-server calls to leave it. Every path this
// app passes to the file-server is namespaced under its own app folder so
// it can never collide with nga_central_mis's files in the shared storage
// root.

const FILE_SERVER_URL =
  process.env.FILE_SERVER_URL || "http://127.0.0.1:5004";
const FILE_SERVER_API_KEY = process.env.FILE_SERVER_API_KEY || "";
const NAMESPACE = "nga-task-mentor";

function namespaced(remotePath: string): string {
  return `${NAMESPACE}/${remotePath}`;
}

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
    form.append(
      "file",
      new Blob([new Uint8Array(buffer)]),
      remotePath.split("/").pop(),
    );
    form.append("path", namespaced(remotePath));

    const res = await request("/files", { method: "POST", body: form });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`file-server upload failed: ${body}`);
      throw new Error(`Failed to upload file: ${res.status} ${body}`);
    }
    console.log(`File uploaded: ${remotePath}`);
  }

  async downloadToBuffer(remotePath: string): Promise<Buffer> {
    const res = await request(
      `/files?path=${encodeURIComponent(namespaced(remotePath))}`,
    );
    if (!res.ok) {
      throw new Error(`Failed to download file: ${res.status}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /** Streams the file straight into an Express response without buffering
   * the whole thing in memory first -- used by the /uploads proxy route,
   * which serves potentially many concurrent requests for large PDFs. */
  async streamTo(
    remotePath: string,
    res: import("express").Response,
  ): Promise<boolean> {
    const upstream = await request(
      `/files?path=${encodeURIComponent(namespaced(remotePath))}`,
    );
    if (!upstream.ok || !upstream.body) return false;

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

  async deleteFile(remotePath: string): Promise<void> {
    const res = await request(
      `/files?path=${encodeURIComponent(namespaced(remotePath))}`,
      { method: "DELETE" },
    );
    if (!res.ok && res.status !== 404) {
      throw new Error(`Failed to delete file: ${res.status}`);
    }
    console.log(`File deleted: ${remotePath}`);
  }

  async fileExists(remotePath: string): Promise<boolean> {
    try {
      const res = await request(
        `/files/exists?path=${encodeURIComponent(namespaced(remotePath))}`,
      );
      if (!res.ok) return false;
      const data = (await res.json()) as { exists: boolean };
      return data.exists;
    } catch (error) {
      console.error(`file-server exists check failed: ${error}`);
      return false;
    }
  }
}

export default new FileServerService();

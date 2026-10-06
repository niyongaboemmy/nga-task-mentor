import http from "http";
import https from "https";
import dns from "dns";
import net from "net";
import fileServer from "../utils/fileServer";
import { generateUniqueFilename } from "../utils/uploadFilename";

/**
 * Images that live inside rich-text content (assignment descriptions, quiz
 * questions…). They are stored on the shared file-server under
 * editor-images/ and served back through the existing /uploads proxy, so the
 * HTML only ever holds a URL — never a multi-megabyte data: URI, and never a
 * hotlink to someone else's site that may disappear or block us later.
 */

export const EDITOR_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const IMPORT_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;

type ImageKind = { ext: string; mime: string };

/** Identify an image by its first bytes; the claimed mimetype is not trusted. */
export function sniffImage(buf: Buffer): ImageKind | null {
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return { ext: "png", mime: "image/png" };
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)
    return { ext: "jpg", mime: "image/jpeg" };
  if (buf.length >= 6 && /^GIF8[79]a$/.test(buf.subarray(0, 6).toString("latin1")))
    return { ext: "gif", mime: "image/gif" };
  if (buf.length >= 12 && buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP")
    return { ext: "webp", mime: "image/webp" };
  if (buf.length >= 2 && buf[0] === 0x42 && buf[1] === 0x4d) return { ext: "bmp", mime: "image/bmp" };
  if (buf.length >= 12 && buf.subarray(4, 8).toString("latin1") === "ftyp") {
    const brand = buf.subarray(8, 12).toString("latin1");
    if (brand === "avif" || brand === "avis") return { ext: "avif", mime: "image/avif" };
  }
  return null;
}

export class EditorImageError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

/** Store an image buffer and return its public path (/uploads/editor-images/…). */
export async function storeEditorImage(buffer: Buffer, originalName = "image"): Promise<{
  url: string;
  type: string;
  size: number;
}> {
  if (buffer.length === 0) throw new EditorImageError("The image is empty.");
  if (buffer.length > EDITOR_IMAGE_MAX_BYTES) {
    throw new EditorImageError("Image is too large. The maximum is 10 MB.", 413);
  }
  const kind = sniffImage(buffer);
  if (!kind) {
    throw new EditorImageError("Only PNG, JPEG, GIF, WebP, BMP or AVIF images can be added.", 415);
  }
  const base = originalName.replace(/\.[a-z0-9]+$/i, "").replace(/[^a-z0-9]/gi, "_").toLowerCase().slice(0, 40) || "image";
  const filename = generateUniqueFilename("img", `${base}.${kind.ext}`, (n) => n);
  await fileServer.uploadFile(buffer, `editor-images/${filename}`);
  return { url: `/uploads/editor-images/${filename}`, type: kind.mime, size: buffer.length };
}

// --- Import from a URL (pasted web images) ---------------------------------------

/** Loopback, private, link-local, CGNAT, multicast… anything that isn't the public internet. */
export function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return (
      lower === "::" ||
      lower === "::1" ||
      lower.startsWith("fc") ||
      lower.startsWith("fd") ||
      lower.startsWith("fe8") ||
      lower.startsWith("fe9") ||
      lower.startsWith("fea") ||
      lower.startsWith("feb") ||
      lower.startsWith("ff")
    );
  }
  return true;
}

/**
 * DNS lookup that refuses private addresses. Passed to http(s).get as
 * `lookup`, so the check applies to the address actually connected to —
 * a hostname can't pass a pre-check and then rebind to 127.0.0.1.
 */
const guardedLookup: typeof dns.lookup = ((hostname: string, options: any, callback: any) => {
  const cb = typeof options === "function" ? options : callback;
  const opts = typeof options === "function" ? {} : options || {};
  dns.lookup(hostname, { ...opts, all: true }, (err, addresses: any) => {
    if (err) return cb(err);
    const list: { address: string; family: number }[] = Array.isArray(addresses) ? addresses : [addresses];
    const bad = list.find((a) => isPrivateAddress(a.address));
    if (bad || list.length === 0) {
      return cb(new EditorImageError("That image address is not allowed."));
    }
    if (opts.all) return cb(null, list);
    return cb(null, list[0].address, list[0].family);
  });
}) as any;

function fetchOnce(url: URL): Promise<http.IncomingMessage> {
  return new Promise((resolve, reject) => {
    const client = url.protocol === "https:" ? https : http;
    const req = client.get(
      url,
      {
        lookup: guardedLookup,
        timeout: IMPORT_TIMEOUT_MS,
        headers: {
          "User-Agent": "Mozilla/5.0 (TaskMentor image import)",
          Accept: "image/avif,image/webp,image/png,image/jpeg,image/gif,image/*;q=0.8",
        },
      },
      resolve,
    );
    req.on("timeout", () => req.destroy(new EditorImageError("The image took too long to download.", 504)));
    req.on("error", reject);
  });
}

export async function downloadImage(rawUrl: string): Promise<{ buffer: Buffer; name: string }> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new EditorImageError("That is not a valid image address.");
  }

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new EditorImageError("Only http(s) image addresses can be imported.");
    }
    if (net.isIP(url.hostname.replace(/^\[|\]$/g, "")) && isPrivateAddress(url.hostname.replace(/^\[|\]$/g, ""))) {
      throw new EditorImageError("That image address is not allowed.");
    }

    const res = await fetchOnce(url);
    const status = res.statusCode || 0;
    if (status >= 300 && status < 400 && res.headers.location) {
      res.resume();
      url = new URL(res.headers.location, url);
      continue;
    }
    if (status !== 200) {
      res.resume();
      throw new EditorImageError(`The image could not be downloaded (HTTP ${status}).`, 502);
    }
    const declared = Number(res.headers["content-length"] || 0);
    if (declared > EDITOR_IMAGE_MAX_BYTES) {
      res.destroy();
      throw new EditorImageError("Image is too large. The maximum is 10 MB.", 413);
    }

    const chunks: Buffer[] = [];
    let total = 0;
    await new Promise<void>((resolve, reject) => {
      res.on("data", (chunk: Buffer) => {
        total += chunk.length;
        if (total > EDITOR_IMAGE_MAX_BYTES) {
          res.destroy();
          reject(new EditorImageError("Image is too large. The maximum is 10 MB.", 413));
          return;
        }
        chunks.push(chunk);
      });
      res.on("end", () => resolve());
      res.on("error", reject);
    });
    let name = url.pathname.split("/").pop() || "image";
    try {
      name = decodeURIComponent(name);
    } catch {
      /* keep the raw segment */
    }
    return { buffer: Buffer.concat(chunks), name };
  }
  throw new EditorImageError("The image address redirected too many times.", 502);
}

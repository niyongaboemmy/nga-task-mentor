import api from "./axiosConfig";

/**
 * Images inside rich-text content are stored on the server (POST
 * /api/media/editor-images) so the HTML only holds a short URL — never a
 * multi-megabyte data: URI, a blob: URL that dies with the tab, or a hotlink
 * to a site that may block or delete the image later.
 */

const SERVER_ORIGIN = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5001").replace(
  /\/api\/?$/,
  "",
);

export const EDITOR_IMAGE_MAX_MB = 10;
export const EDITOR_IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/bmp", "image/avif"];

/** /uploads/editor-images/x.png → https://api…/uploads/editor-images/x.png (the API is on its own domain). */
export function absoluteUploadUrl(path: string): string {
  return /^https?:\/\//i.test(path) ? path : `${SERVER_ORIGIN}${path.startsWith("/") ? "" : "/"}${path}`;
}

/** True for a src this app already serves — nothing to re-host. */
export function isOwnImage(src: string): boolean {
  return src.startsWith(`${SERVER_ORIGIN}/uploads/`) || src.startsWith("/uploads/");
}

/** What has to happen to an <img src> that just arrived by paste or drop. */
export function imageSourceKind(src: string): "own" | "local" | "remote" | "unreachable" {
  if (!src || isOwnImage(src)) return "own";
  if (/^(blob:|data:image\/)/i.test(src)) return "local";
  if (/^https?:\/\//i.test(src)) return "remote";
  // file://, webkit-fake-url://, cid: … (Word / Outlook / Apple Notes) — the browser can't read these.
  return "unreachable";
}

export function isImageFile(file: File | Blob): boolean {
  return file.type.startsWith("image/") && file.type !== "image/svg+xml";
}

function messageOf(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { message?: string } }; message?: string } | null;
  return e?.response?.data?.message || e?.message || fallback;
}

export async function uploadEditorImage(file: Blob, name = "image.png"): Promise<string> {
  if (file.size > EDITOR_IMAGE_MAX_MB * 1024 * 1024) {
    throw new Error(`Image is too large. The maximum is ${EDITOR_IMAGE_MAX_MB} MB.`);
  }
  const form = new FormData();
  form.append("image", file, (file as File).name || name);
  try {
    const res = await api.post("/media/editor-images", form, { timeout: 120_000 });
    return absoluteUploadUrl(res.data.data.url);
  } catch (err) {
    throw new Error(messageOf(err, "The image could not be uploaded."));
  }
}

export async function importEditorImage(url: string): Promise<string> {
  try {
    const res = await api.post("/media/editor-images/import", { url }, { timeout: 60_000 });
    return absoluteUploadUrl(res.data.data.url);
  } catch (err) {
    throw new Error(messageOf(err, "The image could not be copied from that site."));
  }
}

/** blob:/data: src → server URL. */
export async function uploadLocalImageSrc(src: string): Promise<string> {
  const blob = await (await fetch(src)).blob();
  if (!isImageFile(blob)) throw new Error("Only PNG, JPEG, GIF or WebP images can be pasted.");
  const ext = (blob.type.split("/")[1] || "png").replace("jpeg", "jpg");
  return uploadEditorImage(blob, `pasted.${ext}`);
}

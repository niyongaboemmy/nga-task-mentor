import api, { API_BASE_URL } from "./axiosConfig";

/**
 * Stored files (/uploads/...) need a sign-in since TM-8. Viewers that can't
 * send the session header (iframes, the document viewer, downloads, the
 * desktop app) get a short-lived signed URL from GET /api/media/upload-url.
 */

const SERVER_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");

/** The `/uploads/<subpath>` part of a URL this API serves, or null. */
export function uploadSubpath(url: string): string | null {
  if (!url) return null;
  let path = url;
  if (/^https?:\/\//i.test(url)) {
    if (!url.startsWith(`${SERVER_ORIGIN}/`)) return null;
    path = url.slice(SERVER_ORIGIN.length);
  }
  const m = /^\/?uploads\/([^?#]+)/.exec(path);
  return m ? m[1] : null;
}

/** A URL that opens without the session header: signed for our files, unchanged otherwise. */
export async function signedUploadUrl(url: string): Promise<string> {
  const subpath = uploadSubpath(url);
  if (!subpath) return url;
  try {
    const res = await api.get("/media/upload-url", { params: { path: `/uploads/${subpath}` } });
    const signed: string | undefined = res.data?.url;
    return signed ? `${SERVER_ORIGIN}${signed}` : url;
  } catch {
    return url;
  }
}

/**
 * Project previews are served under /api/tmcode/preview/<token>/ on the API's
 * origin. A root-relative link in the student's site ("/style.css",
 * <script src="/src/main.tsx">) would leave the preview for the API's own root,
 * so HTML and CSS are served with those links moved under the preview's base.
 * Protocol-relative ("//cdn…") and absolute URLs are left alone.
 */

const HTML_ATTR = /(\s(?:src|href|action|poster)\s*=\s*["']?)\/(?!\/)/gi;
const CSS_URL = /(url\(\s*["']?)\/(?!\/)/gi;

/** `base` ends with "/", e.g. "/api/tmcode/preview/abc.def/". */
export function rebasePreviewRoots(text: string, base: string, kind: "html" | "css"): string {
  const html = kind === "html" ? text.replace(HTML_ATTR, `$1${base}`) : text;
  // CSS inside HTML (<style>, style="") too.
  return html.replace(CSS_URL, `$1${base}`);
}

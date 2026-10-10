import { defaultMarkdownParser } from "@tiptap/pm/markdown";
import { DOMSerializer } from "@tiptap/pm/model";

/**
 * TMCode instructions as HTML for RichTextDisplay (UX review S17). Teachers
 * write them in Markdown (TMCode renders them as Markdown); older ones may be
 * HTML from a rich editor. Markdown goes through prosemirror-markdown with raw
 * HTML off (CommonMark, `html: false`), so markup in it stays text; HTML is
 * handed over as is. Either way RichTextDisplay parses it into the Tiptap
 * schema, which keeps only known nodes and marks (no scripts, handlers or
 * styles beyond the schema's), so this is the sanitising step.
 */
export function looksLikeHtml(text: string): boolean {
  return /^\s*<(p|div|h[1-6]|ul|ol|table|pre|blockquote|section|article|span|strong|em|br)\b[^>]*>/i.test(text);
}

export function briefToHtml(text: string | null | undefined): string {
  const source = String(text ?? "");
  if (!source.trim()) return "";
  if (looksLikeHtml(source)) return source;
  try {
    const doc = defaultMarkdownParser.parse(source);
    const fragment = DOMSerializer.fromSchema(doc.type.schema).serializeFragment(doc.content);
    const box = document.createElement("div");
    box.appendChild(fragment);
    return box.innerHTML;
  } catch {
    // Fall back to the text, escaped, one paragraph per blank-line block.
    const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return source
      .split(/\n{2,}/)
      .map((p) => `<p>${escape(p).replace(/\n/g, "<br>")}</p>`)
      .join("");
  }
}

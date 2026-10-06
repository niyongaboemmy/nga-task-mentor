/** File-list helpers behind FileDropzone (kept out of the component file for fast refresh). */

/** "pdf, .DOCX ,zip" → ["pdf", "docx", "zip"] */
export function parseExtensions(allowed: string): string[] {
  return Array.from(
    new Set(
      allowed
        .split(/[,\s]+/)
        .map((t) => t.trim().toLowerCase().replace(/^\./, ""))
        .filter(Boolean),
    ),
  );
}

export const extOf = (name: string) =>
  name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";

const sameFile = (a: File, b: File) =>
  a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Pure merge used by the dropzone (exported for tests): which of `incoming`
 * are accepted on top of `existing`, and why the others were turned away.
 */
export function mergeFiles(
  existing: File[],
  incoming: File[],
  opts: { extensions: string[]; maxFiles: number; maxBytes: number },
): { files: File[]; rejected: { name: string; reason: string }[] } {
  const rejected: { name: string; reason: string }[] = [];
  const accepted: File[] = [];
  for (const file of incoming) {
    const ext = extOf(file.name);
    if (opts.extensions.length && !opts.extensions.includes(ext)) {
      rejected.push({
        name: file.name,
        reason: `.${ext || "?"} files aren't allowed here (allowed: ${opts.extensions.join(", ")})`,
      });
    } else if (opts.maxBytes && file.size > opts.maxBytes) {
      rejected.push({
        name: file.name,
        reason: `too large (${formatBytes(file.size)}, max ${formatBytes(opts.maxBytes)})`,
      });
    } else if (file.size === 0) {
      rejected.push({ name: file.name, reason: "the file is empty" });
    } else if (![...existing, ...accepted].some((f) => sameFile(f, file))) {
      accepted.push(file);
    }
  }

  // A single-file picker swaps its file instead of refusing the new one.
  if (opts.maxFiles === 1) {
    return { files: accepted.length ? [accepted[accepted.length - 1]] : existing, rejected };
  }

  const room = Math.max(0, opts.maxFiles - existing.length);
  accepted.slice(room).forEach((f) =>
    rejected.push({ name: f.name, reason: `only ${opts.maxFiles} files can be attached` }),
  );
  return { files: [...existing, ...accepted.slice(0, room)], rejected };
}

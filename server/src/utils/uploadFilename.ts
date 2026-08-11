import path from "path";

/** Same uniqueness scheme every upload middleware used when it wrote
 * directly to disk via multer.diskStorage's filename callback -- moved
 * here since memoryStorage doesn't call that callback at all. */
export function generateUniqueFilename(
  prefix: string,
  originalName: string,
  sanitize: (name: string) => string,
): string {
  const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
  return `${prefix}-${uniqueSuffix}-${sanitize(originalName)}`;
}

export function sanitizeKeepExtension(name: string): string {
  const ext = path.extname(name);
  const base = path.basename(name, ext);
  return base.replace(/[^a-z0-9]/gi, "_").toLowerCase() + ext;
}

export function sanitizeWholeName(name: string): string {
  return name.replace(/[^a-z0-9.]/gi, "_").toLowerCase();
}

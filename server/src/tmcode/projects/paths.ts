/**
 * Project file paths as TMCode sends them: relative, "/"-separated, at most
 * 260 characters. Refused: "..", ".", empty segments, absolute paths
 * ("/x", "C:/x", "//host"), backslashes, NUL and other control characters.
 * Returns the reason, or null when the path is fine.
 */
export const MAX_PATH_LENGTH = 260;

export function invalidPathReason(path: unknown): string | null {
  if (typeof path !== "string" || path.length === 0) return "empty path";
  if (path.length > MAX_PATH_LENGTH) return `longer than ${MAX_PATH_LENGTH} characters`;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(path)) return "control character (NUL) in path";
  if (path.includes("\\")) return "backslash in path (use /)";
  if (path.startsWith("/") || /^[A-Za-z]:/.test(path)) return "absolute path";
  for (const seg of path.split("/")) {
    if (seg === "") return "empty path segment";
    if (seg === "..") return "'..' in path";
    if (seg === ".") return "'.' in path";
  }
  return null;
}

export const isValidProjectPath = (path: unknown) => invalidPathReason(path) === null;

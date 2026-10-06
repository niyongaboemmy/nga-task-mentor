import { invalidPathReason, isValidProjectPath, MAX_PATH_LENGTH } from "../paths";

describe("project path validation", () => {
  it.each(["main.cpp", "src/main.cpp", "a/b/c/d.txt", ".gitignore", "src/.env.example", "dir/file with spaces.py", "ünï/cødé.js"])(
    "accepts %s",
    (p) => expect(invalidPathReason(p)).toBeNull(),
  );

  it.each([
    ["", "empty path"],
    ["../etc/passwd", "'..'"],
    ["src/../../x", "'..'"],
    ["src/..", "'..'"],
    ["./a", "'.'"],
    ["/etc/passwd", "absolute"],
    ["C:/Windows/x", "absolute"],
    ["c:x", "absolute"],
    ["//server/share", "absolute"],
    ["src\\main.cpp", "backslash"],
    ["a\u0000b", "control"],
    ["a\nb", "control"],
    ["a//b", "empty path segment"],
    ["dir/", "empty path segment"],
  ])("refuses %j (%s)", (p, why) => {
    expect(invalidPathReason(p)).toContain(why);
    expect(isValidProjectPath(p)).toBe(false);
  });

  it("caps the length at 260 characters", () => {
    expect(invalidPathReason("a".repeat(MAX_PATH_LENGTH))).toBeNull();
    expect(invalidPathReason("a".repeat(MAX_PATH_LENGTH + 1))).toContain("260");
  });

  it("refuses non-strings", () => {
    expect(isValidProjectPath(undefined)).toBe(false);
    expect(isValidProjectPath(42)).toBe(false);
  });
});

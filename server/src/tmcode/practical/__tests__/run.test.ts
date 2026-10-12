import { filesToSend, isProbablyText, languageOfPath, pickLanguage, rankEntries, runCandidates } from "../run";

const f = (path: string, size = 100) => ({ path, size });

describe("running a submitted project", () => {
  it("maps extensions to runner languages and skips dependency folders", () => {
    expect(languageOfPath("src/Main.java")).toBe("java");
    expect(languageOfPath("a/b.cc")).toBe("cpp");
    expect(languageOfPath("index.html")).toBeNull();
    const c = runCandidates([f("main.py"), f("node_modules/x/index.js"), f(".tmcode/x.py"), f("README.md")]);
    expect(c.map((x) => x.path)).toEqual(["main.py"]);
  });

  it("picks the asked language, else the project's, else the most common", () => {
    const c = runCandidates([f("a.c"), f("b.c"), f("tool.py")]);
    expect(pickLanguage(c, null)).toBe("c");
    expect(pickLanguage(c, "python")).toBe("python");
    expect(pickLanguage(c, "python", "c")).toBe("c");
    // A language with no files in the revision is ignored.
    expect(pickLanguage(c, "java")).toBe("c");
    expect(pickLanguage([], "java")).toBeNull();
  });

  it("ranks the file that declares main first, tests last", () => {
    const c = runCandidates([f("src/util.c"), f("src/app.c"), f("tests/test_main.c"), f("helpers.c")]);
    const sources = new Map([
      ["src/app.c", "#include <stdio.h>\nint main(void) { return 0; }"],
      ["tests/test_main.c", "int main() {}"],
    ]);
    const ranked = rankEntries(c, "c", sources);
    expect(ranked[0]).toBe("src/app.c");
    expect(ranked[ranked.length - 1]).toBe("tests/test_main.c");
  });

  it("prefers conventional names when nothing declares main", () => {
    const c = runCandidates([f("lib/helpers.js"), f("index.js"), f("zeta.js")]);
    expect(rankEntries(c, "javascript", new Map())[0]).toBe("index.js");
  });

  it("sends the entry first with its sources and support files, within the caps", () => {
    const files = [f("b.cpp"), f("main.cpp"), f("util.hpp"), f("data.txt"), f("logo.png"), f("x.py"), f("huge.cpp", 600 * 1024)];
    const { paths, skipped } = filesToSend(files, "cpp", "main.cpp");
    expect(paths[0]).toBe("main.cpp");
    expect(paths).toEqual(expect.arrayContaining(["b.cpp", "util.hpp", "data.txt"]));
    expect(paths).not.toContain("logo.png");
    expect(paths).not.toContain("x.py");
    expect(paths).not.toContain("huge.cpp");
    expect(skipped).toBe(1);
  });

  it("tells text from binary", () => {
    expect(isProbablyText(Buffer.from("print('hi')"))).toBe(true);
    expect(isProbablyText(Buffer.from([0x89, 0x50, 0x00, 0x01]))).toBe(false);
  });
});

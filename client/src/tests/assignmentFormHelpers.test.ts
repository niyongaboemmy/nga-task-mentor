import { describe, it, expect } from "vitest";
import { mergeFiles, parseExtensions, formatBytes } from "../utils/fileList";
import { distributeMarks, evenRubric, rubricTotal, scaleRubric } from "../utils/rubricMarks";
import { imageSourceKind, absoluteUploadUrl } from "../utils/editorImages";

const file = (name: string, size = 1000, type = "") => {
  const f = new File([new Uint8Array(size)], name, { type, lastModified: 1 });
  return f;
};

describe("parseExtensions", () => {
  it("normalises dots, case, spaces and duplicates", () => {
    expect(parseExtensions(" .PDF, docx  zip,zip")).toEqual(["pdf", "docx", "zip"]);
    expect(parseExtensions("")).toEqual([]);
  });
});

describe("mergeFiles", () => {
  const opts = { extensions: parseExtensions("png, jpg, zip"), maxFiles: 3, maxBytes: 5000 };

  it("appends new files to the ones already chosen", () => {
    const a = file("a.png");
    const { files, rejected } = mergeFiles([a], [file("b.zip")], opts);
    expect(files.map((f) => f.name)).toEqual(["a.png", "b.zip"]);
    expect(rejected).toEqual([]);
  });

  it("says why a file was refused instead of dropping it silently", () => {
    const { files, rejected } = mergeFiles([], [file("design.psd"), file("huge.png", 9000), file("empty.png", 0)], opts);
    expect(files).toEqual([]);
    expect(rejected.map((r) => r.name)).toEqual(["design.psd", "huge.png", "empty.png"]);
    expect(rejected[0].reason).toMatch(/\.psd files aren't allowed/);
    expect(rejected[1].reason).toMatch(/too large/);
  });

  it("ignores a file picked twice", () => {
    const a = file("a.png");
    expect(mergeFiles([a], [file("a.png")], opts).files).toHaveLength(1);
  });

  it("caps the count and reports the overflow", () => {
    const { files, rejected } = mergeFiles([file("1.png")], [file("2.png", 2), file("3.png", 3), file("4.png", 4)], opts);
    expect(files).toHaveLength(3);
    expect(rejected).toEqual([{ name: "4.png", reason: "only 3 files can be attached" }]);
  });

  it("a single-file picker swaps its file", () => {
    const { files } = mergeFiles([file("old.zip")], [file("new.zip", 5)], { ...opts, maxFiles: 1 });
    expect(files.map((f) => f.name)).toEqual(["new.zip"]);
  });

  it("accepts any type when no extensions are set", () => {
    expect(mergeFiles([], [file("x.anything")], { extensions: [], maxFiles: 5, maxBytes: 0 }).files).toHaveLength(1);
  });
});

describe("formatBytes", () => {
  it("formats", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(3 * 1024 * 1024)).toBe("3.0 MB");
  });
});

describe("rubric marks", () => {
  it("matches the server's distribution", () => {
    expect(distributeMarks([40, 30, 20, 10], 10)).toEqual([4, 3, 2, 1]);
    expect(distributeMarks([1, 1, 1], 10)).toEqual([4, 3, 3]);
  });

  it("scales keep proportions and hit the max exactly", () => {
    const r = [
      { criteria: "A", max_score: 20 },
      { criteria: "B", max_score: 10 },
    ];
    expect(scaleRubric(r, 15).map((c) => c.max_score)).toEqual([10, 5]);
    expect(rubricTotal(evenRubric(r, 15))).toBe(15);
  });
});

describe("imageSourceKind", () => {
  it("classifies pasted image sources", () => {
    expect(imageSourceKind(absoluteUploadUrl("/uploads/editor-images/a.png"))).toBe("own");
    expect(imageSourceKind("blob:http://localhost/abc")).toBe("local");
    expect(imageSourceKind("data:image/png;base64,AAAA")).toBe("local");
    expect(imageSourceKind("https://cdn.dribbble.com/x.png")).toBe("remote");
    expect(imageSourceKind("file:///Users/me/AppData/image001.png")).toBe("unreachable");
  });
});

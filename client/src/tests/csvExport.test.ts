import { describe, it, expect, vi, afterEach } from "vitest";
import { csvCell, csvSlug, downloadCsv, toCsv } from "../utils/csvExport";

describe("toCsv", () => {
  it("quotes every cell and doubles inner quotes", () => {
    expect(toCsv([["Ada", 'Say "hi"', "a,b"]])).toBe('"Ada","Say ""hi""","a,b"');
  });

  it("writes null, undefined and NaN as empty cells", () => {
    expect(toCsv([[null, undefined, Number.NaN, ""]])).toBe('"","","",""');
  });

  it("joins rows with CRLF", () => {
    expect(toCsv([["a"], ["b"]])).toBe('"a"\r\n"b"');
  });

  it("neutralises cells that a spreadsheet would run as a formula", () => {
    expect(csvCell("=HYPERLINK(\"http://x\")")).toBe("\"'=HYPERLINK(\"\"http://x\"\")\"");
    expect(csvCell("+1")).toBe("\"'+1\"");
    expect(csvCell("-2+3")).toBe("\"'-2+3\"");
    expect(csvCell("@SUM(A1)")).toBe("\"'@SUM(A1)\"");
    expect(csvCell("\tx")).toBe("\"'\tx\"");
    expect(csvCell("\rx")).toBe("\"'\rx\"");
  });

  it("keeps real numbers, negative ones included, as numbers", () => {
    expect(csvCell(-4.5)).toBe('"-4.5"');
    expect(csvCell(0)).toBe('"0"');
    expect(toCsv([[1, -2, 3.25]])).toBe('"1","-2","3.25"');
  });

  it("leaves ordinary text, including accents, untouched", () => {
    expect(csvCell("Mukamana Énée")).toBe('"Mukamana Énée"');
    expect(csvCell("50%")).toBe('"50%"');
  });
});

describe("downloadCsv", () => {
  afterEach(() => vi.restoreAllMocks());

  it("prepends a UTF-8 BOM and clicks a download link", async () => {
    let blob: Blob | null = null;
    const create = vi.fn((b: Blob) => {
      blob = b;
      return "blob:x";
    });
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    downloadCsv("report", [["Name"], ["Énée"]]);

    expect(click).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalledWith("blob:x");
    expect(blob).not.toBeNull();
    const bytes = new Uint8Array(await blob!.arrayBuffer());
    // EF BB BF is the UTF-8 BOM Excel needs to read accented names.
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    const text = new TextDecoder().decode(bytes.slice(3));
    expect(text).toBe('"Name"\r\n"Énée"');
    expect(blob!.type).toContain("text/csv");
  });

  it("adds the .csv extension once", () => {
    Object.assign(URL, { createObjectURL: vi.fn(() => "blob:y"), revokeObjectURL: vi.fn() });
    const names: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      names.push(this.download);
    });
    downloadCsv("a.csv", [["x"]]);
    downloadCsv("b", [["x"]]);
    expect(names).toEqual(["a.csv", "b.csv"]);
  });
});

describe("csvSlug", () => {
  it("makes a filename-safe slug", () => {
    expect(csvSlug("S4 MPC / Term 1 2026-2027")).toBe("s4-mpc-term-1-2026-2027");
    expect(csvSlug("Énée")).toBe("enee");
    expect(csvSlug("///")).toBe("export");
  });
});

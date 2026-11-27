import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import {
  EMPTY_LETTERHEAD,
  currentLetterhead,
  footerLinesOf,
  letterheadFrame,
  letterheadLayout,
  loadLetterhead,
  resetLetterhead,
  setLetterheadSource,
  stampLetterhead,
  type Letterhead,
  type PdfDoc,
} from "../utils/documentLetterhead";
import PrintLetterhead, { printLetterheadCss } from "../components/ui/PrintLetterhead";
import { letterheadSourceOf } from "../tenancy/letterhead";

/** A logo (248 × 108) and a wide footer strip (1245 × 159), like a real school's. */
const letterhead = (over: Partial<Letterhead> = {}): Letterhead => ({
  schoolName: "Sample School",
  header: { dataUrl: "data:image/png;base64,HEADER", width: 248, height: 108 },
  footer: { dataUrl: "data:image/png;base64,FOOTER", width: 1245, height: 159 },
  footerLines: [],
  ...over,
});

/** The few jsPDF members the letterhead uses, recording what is drawn on which page. */
function fakePdf(pages: number, unit: "mm" | "pt" = "mm") {
  const k = unit === "mm" ? 72 / 25.4 : 1;
  const size = unit === "mm" ? { w: 210, h: 297 } : { w: 595.28, h: 841.89 };
  let page = 1;
  const images: Array<{ page: number; alias: string; x: number; y: number; w: number; h: number }> = [];
  const texts: Array<{ page: number; text: string; x: number; y: number }> = [];
  const doc: PdfDoc = {
    internal: { scaleFactor: k, pageSize: { getWidth: () => size.w, getHeight: () => size.h } },
    getNumberOfPages: () => pages,
    setPage: (n: number) => (page = n),
    addImage: (_d: string, _f: string, x: number, y: number, w: number, h: number, alias: string) => images.push({ page, alias, x, y, w, h }),
    text: (text: string | string[], x: number, y: number) => texts.push({ page, text: String(text), x, y }),
    setFont: () => undefined,
    setFontSize: () => undefined,
    setTextColor: () => undefined,
  };
  return { doc, images, texts, size };
}

describe("letterhead layout (the same numbers as the server and MIS)", () => {
  it("reserves only the page line when the school has set nothing", () => {
    expect(letterheadLayout(EMPTY_LETTERHEAD, 210)).toMatchObject({ topMm: 12, bottomMm: 14, headerMm: 0 });
  });

  it("reserves the logo or the name on top, and the footer strip (22 mm at most) below", () => {
    const l = letterheadLayout(letterhead(), 210);
    expect(l.topMm).toBe(23);
    expect(l.footerImageHeightMm).toBe(22);
    expect(l.footerImageWidthMm).toBeCloseTo((22 * 1245) / 159, 1);
    expect(l.bottomMm).toBe(37);
    expect(letterheadLayout(letterhead({ header: null }), 210).topMm).toBe(16);
    expect(letterheadLayout(letterhead(), 210, { header: false }).topMm).toBe(12);
    expect(letterheadLayout(letterhead({ footerLines: ["a", "b"] }), 210).bottomMm).toBe(45.2);
    expect(footerLinesOf("one\n\n two \nthree\nfour\nfive")).toEqual(["one", "two", "three", "four"]);
  });
});

describe("stamping a jsPDF document", () => {
  it("draws the header and the footer on every page, inside the reserved margins", () => {
    for (const unit of ["mm", "pt"] as const) {
      const { doc, images, texts, size } = fakePdf(3, unit);
      const lh = letterhead({ footerLines: ["PO Box 1"] });
      const frame = letterheadFrame(doc, lh);
      expect(frame.pageBottom).toBeCloseTo(size.h - frame.bottom, 5);
      stampLetterhead(doc, lh, { note: "Marks list" });
      for (const p of [1, 2, 3]) {
        const header = images.find((i) => i.page === p && i.alias === "lh-header")!;
        const footer = images.find((i) => i.page === p && i.alias === "lh-footer")!;
        expect(header.y + header.h).toBeLessThan(frame.top);
        expect(footer.y).toBeGreaterThan(frame.pageBottom);
        expect(footer.y + footer.h).toBeLessThan(size.h);
        expect(footer.x + footer.w / 2).toBeCloseTo(size.w / 2, 5);
        expect(texts.some((t) => t.page === p && t.text === `Page ${p} of 3`)).toBe(true);
        expect(texts.some((t) => t.page === p && t.text === "PO Box 1")).toBe(true);
        expect(texts.some((t) => t.page === p && t.text === "Marks list")).toBe(true);
      }
      expect(images).toHaveLength(6);
    }
  });

  it("prints the school's name without a logo, and no header for a document with its own", () => {
    const named = fakePdf(2);
    stampLetterhead(named.doc, letterhead({ header: null }));
    expect(named.texts.filter((t) => t.text === "Sample School")).toHaveLength(2);
    const own = fakePdf(2);
    stampLetterhead(own.doc, letterhead(), { header: false });
    expect(own.images.map((i) => i.alias)).toEqual(["lh-footer", "lh-footer"]);
  });
});

describe("where the letterhead comes from", () => {
  afterEach(() => setLetterheadSource(async () => null));

  it("reads the school answer, with the school's logo for a missing Documents logo", () => {
    expect(letterheadSourceOf(null)).toBeNull();
    // An older server: no letterhead in the answer.
    expect(letterheadSourceOf({ tid: 1, name: "Sample School", logoUrl: "https://mis.example/logo.png", schools: [], canSwitch: false })).toEqual({
      schoolName: "Sample School",
      headerUrl: null,
      fallbackLogoUrl: "https://mis.example/logo.png",
      footerUrl: null,
      footerText: null,
    });
    expect(
      letterheadSourceOf({
        tid: 1,
        name: "Sample School",
        logoUrl: null,
        letterhead: { headerUrl: "https://mis.example/doc.png", fallbackLogoUrl: "https://mis.example/logo.png", footerUrl: "https://mis.example/footer.png", footerText: "PO Box 1" },
        schools: [],
        canSwitch: false,
      }),
    ).toMatchObject({ headerUrl: "https://mis.example/doc.png", footerUrl: "https://mis.example/footer.png", footerText: "PO Box 1" });
  });

  it("loads once, keeps it for generators that cannot wait, and forgets it on reset", async () => {
    const source = vi.fn(async () => ({ schoolName: "Sample School", footerText: "PO Box 1\nsample.example" }));
    setLetterheadSource(source);
    expect(currentLetterhead()).toBe(EMPTY_LETTERHEAD);
    const lh = await loadLetterhead();
    await loadLetterhead();
    expect(source).toHaveBeenCalledTimes(1);
    expect(lh).toEqual({ schoolName: "Sample School", header: null, footer: null, footerLines: ["PO Box 1", "sample.example"] });
    expect(currentLetterhead()).toBe(lh);
    resetLetterhead();
    expect(currentLetterhead()).toBe(EMPTY_LETTERHEAD);
  });
});

describe("printed pages", () => {
  const ua = navigator.userAgent;
  const setUa = (value: string) => Object.defineProperty(navigator, "userAgent", { value, configurable: true });
  beforeEach(() => setUa("Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36"));
  afterEach(() => setUa(ua));

  it("puts the header and the footer in the paper's margins and reserves their room", () => {
    const css = printLetterheadCss(letterhead({ footerLines: ["PO Box 1"] }), { note: "School reports", pageWidthMm: 297, sideMm: 10 });
    expect(css).toContain("margin-top: 23mm");
    expect(css).toContain("margin-bottom: 41.6mm"); // 6 + 4 + (22 + 3.6 + 1) + 1 + 4
    expect(css).toContain("@top-left");
    expect(css).toContain("data:image/png;base64,HEADER");
    expect(css).toContain("data:image/png;base64,FOOTER");
    expect(css).toContain('"PO Box 1\\A School reports · Page " counter(page) " of " counter(pages)');
  });

  it("stays out of browsers that cannot print in the margins", () => {
    setUa("Mozilla/5.0 Version/17.0 Safari/605.1.15");
    const { container } = render(<PrintLetterhead letterhead={letterhead()} />);
    expect(container.querySelector("style")).toBeNull();
  });
});

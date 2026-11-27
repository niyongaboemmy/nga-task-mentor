import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import {
  EMPTY_LETTERHEAD,
  MM,
  footerLinesOf,
  hasFooter,
  imageSize,
  letterheadFrame,
  letterheadLayout,
  letterheadOf,
  stampLetterhead,
  type Letterhead,
} from "../documentLetterhead";
import { renderClassReportCardsPdf, renderReportCardPdf } from "../reportCardDocumentPdf";
import { generateAnnualReportCardPdf } from "../reportCardPdf.service";
import { normalizeProfile } from "../schoolProfile";
import { tvetDocument } from "./fixtures/tvetDocument";

jest.mock("../tenantSettings", () => ({
  ...jest.requireActual("../tenantSettings"),
  getBranding: jest.fn(async () => ({ name: "Sample School", address_line: "Sample address", contact_line: "", logo: null })),
  getGradingBands: jest.fn(async () => jest.requireActual("../tenantSettings").NGA_GRADING_BANDS),
}));

/** A real PNG (pdfkit has to be able to draw it); the letterhead sizes come from `width`/`height`. */
let png: Buffer;
beforeAll(async () => {
  png = await QRCode.toBuffer("letterhead", { width: 60, margin: 0 });
});

/** A wide strip like a real school footer (1245 × 159) and a logo (248 × 108). */
const letterhead = (over: Partial<Letterhead> = {}): Letterhead => ({
  schoolName: "Sample School",
  header: { data: png, width: 248, height: 108 },
  footer: { data: png, width: 1245, height: 159 },
  footerLines: [],
  ...over,
});

const pageCount = (pdf: Buffer) => (pdf.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length;

describe("letterhead layout (the same numbers as the client and MIS)", () => {
  it("reserves only the page line when the school has set nothing", () => {
    expect(letterheadLayout(EMPTY_LETTERHEAD, 210)).toMatchObject({ topMm: 12, bottomMm: 14, headerMm: 0, footerImageHeightMm: 0 });
  });

  it("reserves the logo, or the school's name, at the top", () => {
    expect(letterheadLayout(letterhead(), 210).topMm).toBe(23);
    expect(letterheadLayout(letterhead({ header: null }), 210).topMm).toBe(16);
    expect(letterheadLayout(letterhead(), 210, { header: false })).toMatchObject({ topMm: 12, showHeader: false });
  });

  it("fits a wide footer strip to the content width, capped at 22 mm high", () => {
    const l = letterheadLayout(letterhead(), 210);
    expect(l.footerImageHeightMm).toBe(22);
    expect(l.footerImageWidthMm).toBeCloseTo((22 * 1245) / 159, 1);
    expect(l.bottomMm).toBe(37); // edge 6 + page line 4 + image 22 + 1 + gap 4
    // Landscape: still capped.
    expect(letterheadLayout(letterhead(), 297).footerImageHeightMm).toBe(22);
    // A thin strip keeps the full width.
    const thin = letterheadLayout(letterhead({ footer: { data: png, width: 1820, height: 100 } }), 210);
    expect(thin.footerImageWidthMm).toBe(182);
    expect(thin.footerImageHeightMm).toBe(10);
  });

  it("adds the text lines (four at most)", () => {
    expect(footerLinesOf(" one \n\n two \r\nthree\nfour\nfive")).toEqual(["one", "two", "three", "four"]);
    expect(footerLinesOf(undefined)).toEqual([]);
    expect(letterheadLayout(letterhead({ footer: null, footerLines: ["a", "b"] }), 210).bottomMm).toBe(22.2); // 6 + 4 + 7.2 + 1 + 4
    expect(letterheadLayout(letterhead({ footerLines: ["a", "b"] }), 210).bottomMm).toBe(45.2); // + image 22 + 1
  });

  it("knows a footer from none", () => {
    expect(hasFooter(EMPTY_LETTERHEAD)).toBe(false);
    expect(hasFooter(letterhead({ footer: null }))).toBe(false);
    expect(hasFooter(letterhead({ footer: null, footerLines: ["a"] }))).toBe(true);
    expect(hasFooter(letterhead())).toBe(true);
  });
});

describe("letterhead images", () => {
  it("reads the size of a PNG and of a JPEG, and refuses anything else", () => {
    const size = imageSize(png)!;
    expect(size.width).toBeGreaterThan(0);
    expect(size.width).toBe(size.height);
    // SOI, APP0 (16 bytes), SOF0 with height 108 and width 248.
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, ...new Array(14).fill(0), 0xff, 0xc0, 0, 17, 8, 0, 108, 0, 248, 3, ...new Array(9).fill(0)]);
    expect(imageSize(jpeg)).toEqual({ width: 248, height: 108 });
    expect(imageSize(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"))).toBeNull();
  });

  it("makes no request for a school that has set no images", async () => {
    const lh = await letterheadOf(normalizeProfile({ name: "Sample School", documents_footer_text: "PO Box 1\nsample.example" }));
    expect(lh).toEqual({ schoolName: "Sample School", header: null, footer: null, footerLines: ["PO Box 1", "sample.example"] });
    expect(await letterheadOf(null)).toBe(EMPTY_LETTERHEAD);
  });
});

describe("stamping a pdfkit document", () => {
  const threePages = () => {
    const pdf = new PDFDocument({ size: "A4", margin: 30, bufferPages: true });
    pdf.addPage();
    pdf.addPage();
    return pdf;
  };

  it("draws the header and the footer on every page, and adds no page", () => {
    const pdf = threePages();
    const image = jest.spyOn(pdf, "image");
    const text = jest.spyOn(pdf, "text");
    const lh = letterhead({ footerLines: ["PO Box 1"] });
    stampLetterhead(pdf, lh, { note: (page) => `Note ${page}` });
    expect(pdf.bufferedPageRange().count).toBe(3);
    expect(image).toHaveBeenCalledTimes(6);
    const said = text.mock.calls.map((c) => c[0]);
    expect(said).toEqual(expect.arrayContaining(["Page 1 of 3", "Page 2 of 3", "Page 3 of 3", "Note 1", "Note 3", "PO Box 1"]));

    // The footer strip sits inside the room the frame reserves, centred.
    const frame = letterheadFrame(pdf, lh);
    const strips = (image.mock.calls as any[][]).filter((c) => c[2] > 400);
    expect(strips).toHaveLength(3);
    for (const [, x, y, o] of strips) {
      expect(y).toBeGreaterThanOrEqual(frame.pageBottom);
      expect(y + o.height).toBeLessThan(pdf.page.height - 6 * MM);
      expect(x + o.width / 2).toBeCloseTo(pdf.page.width / 2, 3);
      expect(o.height).toBeCloseTo(22 * MM, 3);
    }
    pdf.end();
  });

  it("leaves the header out for a document with its own masthead", () => {
    const pdf = threePages();
    const image = jest.spyOn(pdf, "image");
    stampLetterhead(pdf, letterhead(), { header: false });
    expect(image).toHaveBeenCalledTimes(3);
    expect(letterheadFrame(pdf, letterhead(), { header: false }).top).toBeCloseTo(12 * MM, 3);
    pdf.end();
  });

  it("prints the school's name when there is no logo", () => {
    const pdf = threePages();
    const text = jest.spyOn(pdf, "text");
    stampLetterhead(pdf, letterhead({ header: null, footer: null }), { title: "Marks list" });
    const said = text.mock.calls.map((c) => c[0]);
    expect(said.filter((t) => t === "Sample School")).toHaveLength(3);
    expect(said.filter((t) => t === "Marks list")).toHaveLength(3);
    pdf.end();
  });
});

describe("report cards with the school's footer", () => {
  const opts = (lh: Letterhead | null) => ({ verificationBaseUrl: "https://tm.example", letterhead: lh });

  it("keeps a one-page card on one page (drawn slightly smaller above the footer)", async () => {
    for (const final of [true, false]) {
      const plain = await renderReportCardPdf(tvetDocument(final), opts(null));
      const withFooter = await renderReportCardPdf(tvetDocument(final), opts(letterhead({ footerLines: ["PO Box 1", "sample.example"] })));
      expect(pageCount(plain)).toBe(1);
      expect(pageCount(withFooter)).toBe(1);
      expect(withFooter.length).toBeGreaterThan(plain.length);
    }
  });

  it("leaves the card as it was for a school without a footer", async () => {
    const stamped = jest.spyOn(PDFDocument.prototype, "switchToPage");
    await renderReportCardPdf(tvetDocument(true), opts(letterhead({ footer: null })));
    await renderReportCardPdf(tvetDocument(true), opts(null));
    expect(stamped).not.toHaveBeenCalled();
    stamped.mockRestore();
  });

  it("stamps every page of a class pack: the cover and one page per card", async () => {
    const docs = [0, 1, 2].map((i) => {
      const d = tvetDocument(false, "published");
      d.card = { ...d.card, id: i + 1, uuid: `u${i}` };
      d.student = { ...d.student, id: i + 1, name: `Learner ${i + 1}` };
      d.summary = { ...d.summary, position: i + 1, position_of: 3 };
      return d;
    });
    const image = jest.spyOn(PDFDocument.prototype, "image");
    const pdf = await renderClassReportCardsPdf(docs, { class_name: "Sample class", term: "Term 2", academic_year: "2026 - 2027" }, opts(letterhead()));
    expect(pageCount(pdf)).toBe(4);
    // The footer strip (a Buffer-opened image object, drawn 22 mm high) once per page.
    expect((image.mock.calls as any[][]).filter((c) => Math.abs((c[3]?.height ?? 0) - 22 * MM) < 0.01)).toHaveLength(4);
    image.mockRestore();
  });

  it("puts the footer under the annual summary", async () => {
    const data = { student_name: "Learner 1", student_id: 1, academic_year: "2026 - 2027", annual_grades: [], per_term: [], missing_terms: [] };
    const plain = await generateAnnualReportCardPdf(data);
    const withFooter = await generateAnnualReportCardPdf({ ...data, letterhead: letterhead() });
    expect(pageCount(plain)).toBe(1);
    expect(pageCount(withFooter)).toBe(1);
    expect(withFooter.length).toBeGreaterThan(plain.length);
  });
});

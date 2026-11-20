import { renderClassReportCardsPdf, renderReportCardPdf, verificationUrl } from "../reportCardDocumentPdf";
import { NGA_GRADING_BANDS } from "../tenantSettings";
import type { ReportCardDocument } from "../reportCardDocument";
import fs from "fs";
import path from "path";
import { tvetDocument } from "./fixtures/tvetDocument";

const doc = (over: Partial<ReportCardDocument["card"]> = {}): ReportCardDocument => ({
  schema: 1,
  card: { id: 1, uuid: "abc-123", version: 2, status: "published", term: "Term 2", academic_year: "2025-2026", approved_at: "2026-04-01T08:00:00Z", published_at: null, ...over },
  school: { name: "New Generation Coding Academy", address_line: "Kigali, Rwanda", contact_line: "info@nga.ac.rw", logo: "nga" },
  student: { id: 7, name: "Aline Uwase", registration_number: "REG-1", gender: "F", class_group_id: 3, class_name: "Grade 10", grade_name: null, program_name: "SPES" },
  scheme: { category_weights: { CW: 15, HW: 10, MD: 25, EOT: 50, IA: 50, FA: 100, CA: 100 }, pass_mark: 50, bands: [...NGA_GRADING_BANDS], show_position: true, show_class_average: true, show_subject_teacher: true, head_title: "Principal" },
  groups: [
    {
      name: "Core modules",
      subjects: [
        { subject_id: 1, name: "Physics (Design electrical and electronic circuit using optical instruments)", group: "Core modules", teacher: "NSHIMIYIMANA J.", categories: { CW: 14, HW: 9, MD: 22, EOT: 42, IA: null, FA: null, CA: null }, total: 87, grade: "A", remark: "Excellent", passed: true, class_average: 78, missing_marks: 0 },
        { subject_id: 2, name: "English", group: "Core modules", teacher: null, categories: { CW: 5, HW: null, MD: 10, EOT: 20, IA: null, FA: null, CA: null }, total: 35, grade: "F", remark: "Weak", passed: false, class_average: 60, missing_marks: 0 },
      ],
    },
  ],
  summary: { average: 61, grade: "C", remark: "Good", total_marks: 122, subjects_counted: 2, subjects_passed: 1, subjects_failed: 1, position: 3, position_of: 40, class_average: 70 },
  attendance: { present: 50, absent: 2, excused: 1, late: 3, sick: 0, total: 56, source: "imported" },
  attributes: [{ attribute_name: "Punctuality", rating: "Excellent" }],
  comments: { class_teacher: "Keep it up.", head_teacher: "Well done." },
  next_term_begins_on: "2026-04-20",
  grades: [],
});

describe("report card PDF from a document", () => {
  it("renders an issued card", async () => {
    const pdf = await renderReportCardPdf(doc(), { verificationBaseUrl: "https://tm.example" });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(3000);
  });

  it("renders a provisional draft (watermark, no QR) and an empty card", async () => {
    const d = doc({ status: "draft", version: 0, approved_at: null });
    d.groups = [];
    const pdf = await renderReportCardPdf(d, { verificationBaseUrl: "https://tm.example" });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("verifies the exact version", () => {
    expect(verificationUrl(doc(), "https://tm.example/")).toBe("https://tm.example/api/public/verify/report-card/abc-123?v=2");
  });
});

describe("TVET (CAMIS) template", () => {
  // RC_PDF_OUT=<dir> writes the PDFs to look at.
  const save = (name: string, pdf: Buffer) => {
    if (process.env.RC_PDF_OUT) fs.writeFileSync(path.join(process.env.RC_PDF_OUT, name), pdf);
  };

  it("renders the Term 3 card with the year, and a termly card", async () => {
    const annual = await renderReportCardPdf(tvetDocument(true), { verificationBaseUrl: "https://tm.example" });
    expect(annual.subarray(0, 5).toString()).toBe("%PDF-");
    save("tvet-annual.pdf", annual);
    const termly = await renderReportCardPdf(tvetDocument(false, "draft"), { verificationBaseUrl: "https://tm.example" });
    expect(termly.subarray(0, 5).toString()).toBe("%PDF-");
    save("tvet-termly.pdf", termly);
  });

  it("falls back to the Normal template for a snapshot without a builder", async () => {
    const pdf = await renderReportCardPdf(doc(), { verificationBaseUrl: "https://tm.example" });
    save("normal.pdf", pdf);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  });
});

describe("class pack cover", () => {
  it("renders the ranking cover for a TVET class, long names on one line", async () => {
    const names = ["Mukamana Ange Sample", "Uwimana Claudine Marie-Josee Ingabire Sample", "Habimana Eric", "Niyonsaba Grace", "Mugisha Alpha", "Ishimwe Kevin", "Uwase Aline", "Nshuti Brian", "Keza Oceanne", "Ndizihiwe Gael"];
    const docs = names.map((name, i) => {
      const d = tvetDocument(false, i === 0 ? "published" : "draft");
      d.card = { ...d.card, id: i + 1, uuid: `u${i}` };
      d.student = { ...d.student, id: i + 1, name, registration_number: `120823-${String(i + 1).padStart(4, "0")}` };
      d.summary = { ...d.summary, average: 95 - i * 1.3, position: i + 1, position_of: 10 };
      d.behaviour = { mark: 36 - (i % 4), max: 40 };
      return d;
    });
    const pdf = await renderClassReportCardsPdf(docs, { class_name: "SPES Year 2 A", term: "Term 1", academic_year: "2026 - 2027" }, { verificationBaseUrl: "https://tm.example" });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    if (process.env.RC_PDF_OUT) fs.writeFileSync(path.join(process.env.RC_PDF_OUT, "class-pack.pdf"), pdf);
  });
});

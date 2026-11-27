import { normalizeProfile } from "../schoolProfile";

describe("school profile (MIS School)", () => {
  it("keeps the identity fields, trimmed, with blanks as null", () => {
    expect(
      normalizeProfile({ school_id: "3", name: " Sample School ", district: "", contact_email: "info@school.rw", head_teacher_name: "  ", sector: "ICT", extra: "x" }),
    ).toEqual({
      school_id: 3,
      name: "Sample School",
      address: null,
      district: null,
      contact_email: "info@school.rw",
      contact_phone: null,
      sector: "ICT",
      trade: null,
      qualification_title: null,
      head_teacher_name: null,
      logo_url: null,
      documents_logo_url: null,
      documents_footer_url: null,
      documents_footer_text: null,
    });
  });

  it("carries the document letterhead, and reads an MIS without it as none", () => {
    const p = normalizeProfile({ name: "Sample School", logo_url: "https://mis.example/logo.png", documents_logo_url: "https://mis.example/doc.png", documents_footer_url: "https://mis.example/footer.png", documents_footer_text: "Line one\nLine two" });
    expect(p.documents_logo_url).toBe("https://mis.example/doc.png");
    expect(p.documents_footer_url).toBe("https://mis.example/footer.png");
    expect(p.documents_footer_text).toBe("Line one\nLine two");
    // The cached "last copy" is this object as JSON: it reads back the same.
    expect(normalizeProfile(JSON.parse(JSON.stringify(p)))).toEqual(p);
  });
});

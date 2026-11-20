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
    });
  });
});

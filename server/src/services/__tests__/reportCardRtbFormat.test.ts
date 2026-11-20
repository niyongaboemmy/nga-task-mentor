import { isFinalTerm, learningHours, qualificationOf, termCellOf, termIndex } from "../reportCardDocument";

describe("RTB / CAMIS card helpers", () => {
  it("reads the term number from its name", () => {
    expect(termIndex("Term 1")).toBe(1);
    expect(termIndex("TERM III")).toBe(3);
    expect(termIndex("Third term")).toBe(3);
    expect(termIndex("Holiday")).toBeNull();
    expect(isFinalTerm("Term 3")).toBe(true);
    expect(isFinalTerm("Term 2")).toBe(false);
  });

  it("splits a term's mark into FA (CW+HW+MD), IA and CA (EOT)", () => {
    const g = {
      total_score: 80.93,
      categories: {
        CW: { scaled_score: 12.14 } as any,
        HW: { scaled_score: 8 } as any,
        EOT: { scaled_score: 40 } as any,
      },
    };
    expect(termCellOf("Term 1", g)).toEqual({ term: "Term 1", fa: 20.14, ia: null, ca: 40, total: 80.93 });
    expect(termCellOf("Term 2", null)).toEqual({ term: "Term 2", fa: null, ia: null, ca: null, total: null });
  });

  it("reads module weight as learning hours (credits x 10)", () => {
    expect(learningHours("120")).toBe(120);
    expect(learningHours("90 hours")).toBe(90);
    expect(learningHours("12 credits")).toBe(120);
    expect(learningHours("")).toBeNull();
  });

  it("names the qualification from the modules' RQF level and the trade", () => {
    expect(qualificationOf([{ rqf_level: "3" }, { rqf_level: "Level 3" }, { rqf_level: "4" }], "Software Development", "L3 A", null)).toEqual({
      rqf_level: "3",
      trade: "Software Development",
      title: "TVET Certificate III in Software Development",
      sector: null,
    });
    // No module level: the class name says it.
    expect(qualificationOf([], "Coding Academy", "L4. Class B", "Year 2").rqf_level).toBe("4");
    expect(qualificationOf([], null, "Senior 1", null).title).toBeNull();
  });
});

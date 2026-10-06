import { fitName, namesFromMis } from "../names";

describe("names from MIS", () => {
  it("keeps normal names", () => {
    expect(namesFromMis({ first_name: "Aline", last_name: "Uwase" }, "a@x.rw")).toEqual({ first_name: "Aline", last_name: "Uwase" });
  });

  it("fills a missing last name so the user can still sign in", () => {
    expect(namesFromMis({ first_name: "Aline", last_name: "" })).toEqual({ first_name: "Aline", last_name: "-" });
    expect(namesFromMis({ first_name: "Aline", last_name: null })).toEqual({ first_name: "Aline", last_name: "-" });
    expect(namesFromMis({ first_name: "  ", last_name: "   " }, "j.doe@nga.ac.rw")).toEqual({ first_name: "j.doe", last_name: "-" });
    expect(namesFromMis(null)).toEqual({ first_name: "User", last_name: "-" });
  });

  it("cuts very long names to 50 characters and tidies spaces", () => {
    expect(fitName("a".repeat(80), "-")).toHaveLength(50);
    expect(fitName("  Jean   Paul  ", "-")).toBe("Jean Paul");
  });
});

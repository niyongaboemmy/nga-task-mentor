import { alignBloomLevel, bloomPromptSection, parseBloomLevel } from "../bloomsAlignment";
import { buildGenerateFromSourcePrompt } from "../prompts/generateFromDocumentPrompt";

describe("parseBloomLevel", () => {
  it.each([
    [3, 3], ["4", 4], ["L5", 5], ["level 2", 2], ["Applying", 3], ["analyse", 4], ["Analyzing", 4], ["Creating", 6],
  ])("reads %p as L%p", (raw, want) => expect(parseBloomLevel(raw)).toBe(want));

  it.each([[null], [undefined], [0], [7], ["something else"], ["L9"]])("rejects %p", (raw) =>
    expect(parseBloomLevel(raw)).toBeNull(),
  );
});

describe("alignBloomLevel", () => {
  it("keeps a level that fits the difficulty", () => {
    expect(alignBloomLevel(2, "EASY")).toEqual({ level: 2, adjusted: false });
    expect(alignBloomLevel(4, "MEDIUM")).toEqual({ level: 4, adjusted: false });
    expect(alignBloomLevel(4, "DIFFICULT")).toEqual({ level: 4, adjusted: false });
    expect(alignBloomLevel(6, "DIFFICULT")).toEqual({ level: 6, adjusted: false });
  });

  it("moves a mislabelled level to the nearest one in the band", () => {
    expect(alignBloomLevel(5, "EASY")).toEqual({ level: 2, adjusted: true });
    expect(alignBloomLevel(1, "MEDIUM")).toEqual({ level: 3, adjusted: true });
    expect(alignBloomLevel(6, "MEDIUM")).toEqual({ level: 4, adjusted: true });
    expect(alignBloomLevel(1, "DIFFICULT")).toEqual({ level: 4, adjusted: true });
  });

  it("defaults a missing level to the band's first level", () => {
    expect(alignBloomLevel(null, "EASY")).toEqual({ level: 1, adjusted: true });
    expect(alignBloomLevel(null, "DIFFICULT")).toEqual({ level: 4, adjusted: true });
  });
});

describe("prompt", () => {
  it("teaches every level and asks for blooms_level per question", () => {
    const section = bloomPromptSection();
    for (const name of ["Remembering", "Understanding", "Applying", "Analyzing", "Evaluating", "Creating"]) {
      expect(section).toContain(name);
    }
    expect(section).toContain("EASY → L1–L2");
    expect(section).toContain("MEDIUM → L3–L4");
    expect(section).toContain("DIFFICULT → L4–L5–L6");
    const p = buildGenerateFromSourcePrompt({ sourceText: "x", plan: [{ question_type: "true_false", EASY: 1, MEDIUM: 0, DIFFICULT: 0 }] });
    expect(p).toContain(`"blooms_level": <1-6`);
    expect(p).toContain("BLOOM'S TAXONOMY");
  });
});

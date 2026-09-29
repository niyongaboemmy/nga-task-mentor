import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import {
  AccessSnapshot,
  decide,
  scopeFor,
  validateManifest,
} from "../../vendor/nga-access";
import { TM_MANIFEST } from "../manifest";
import { ALL_PERMISSION_KEYS } from "../../constants/permissions";

/**
 * The shared @nga/access decision table (nga_central_mis/packages/access)
 * run against Task Mentor's vendored copy of the core -- the same cases MIS
 * and every other app run, so a decision is identical wherever it is made.
 */
const VENDOR = path.resolve(__dirname, "../../vendor/nga-access");
const table = JSON.parse(fs.readFileSync(path.join(VENDOR, "decision-table.json"), "utf8"));
const snapshot = table.snapshot as AccessSnapshot;

describe("@nga/access vendored copy", () => {
  it("is unedited (body matches its sha256 provenance header)", () => {
    const vendored = fs.readFileSync(path.join(VENDOR, "index.ts"), "utf8");
    const m = vendored.match(/^\/\/ sha256:([0-9a-f]{64})\n/m);
    expect(m).not.toBeNull();
    const headerEnd = vendored.indexOf(m![0]) + m![0].length;
    const body = vendored.slice(headerEnd);
    expect(createHash("sha256").update(body).digest("hex")).toBe(m![1]);
  });

  // When the monorepo sibling is present (local dev), also check for drift.
  const pkg = path.resolve(__dirname, "../../../../../nga_central_mis/packages/access");
  (fs.existsSync(pkg) ? it : it.skip)("matches nga_central_mis/packages/access", () => {
    const core = fs.readFileSync(path.join(pkg, "src/index.ts"), "utf8");
    expect(fs.readFileSync(path.join(VENDOR, "index.ts"), "utf8").endsWith(core)).toBe(true);
    expect(fs.readFileSync(path.join(VENDOR, "decision-table.json"), "utf8")).toBe(
      fs.readFileSync(path.join(pkg, "test/decision-table.json"), "utf8"),
    );
  });
});

describe("@nga/access decision table", () => {
  for (const c of table.cases) {
    it(c.name, () => {
      const d = decide(snapshot, c.cap, c.target, c.minDepth ?? null);
      expect(d.allowed).toBe(c.allowed);
      if ("depth" in c) expect(d.depth).toEqual(c.depth);
      if ("via" in c) expect(d.via).toEqual(c.via);
    });
  }

  for (const c of table.scopeFor) {
    it(`scopeFor: ${c.name}`, () => {
      expect(scopeFor(snapshot, c.cap, c.minDepth ?? null)).toEqual(c.expect);
    });
  }

  it("fails closed on a missing snapshot", () => {
    expect(decide(null, "DISCIPLINE_VIEW", {}).allowed).toBe(false);
    expect(scopeFor(undefined, "DISCIPLINE_VIEW")).toBeNull();
  });
});

describe("Task Mentor manifest", () => {
  it("is valid", () => {
    expect(validateManifest(TM_MANIFEST)).toEqual([]);
  });

  it("is the local permission catalog (the new keys included)", () => {
    const keys = Object.keys(TM_MANIFEST.capabilities).sort();
    expect(keys).toEqual([...ALL_PERMISSION_KEYS].sort());
    expect(keys).toEqual(expect.arrayContaining(["REPORT_CARDS_COMMENT", "REPORT_CARDS_PUBLISH"]));
  });

  it("had exactly the known keys added to the pre-v2 catalog", () => {
    const newKeys = [
      "QUESTION_BANK_HUB_VIEW",
      "RANKINGS_VIEW_ALL",
      "RANKINGS_VIEW_OWN",
      "REPORT_CARDS_COMMENT",
      "REPORT_CARDS_PUBLISH",
    ];
    const legacy = ALL_PERMISSION_KEYS.filter((k) => !newKeys.includes(k));
    expect(Object.keys(TM_MANIFEST.capabilities).filter((k) => !legacy.includes(k)).sort()).toEqual(newKeys);
    expect(TM_MANIFEST.app).toBe("tm");
  });
});

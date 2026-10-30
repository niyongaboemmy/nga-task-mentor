import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { linkAssets } from "../components/code/usePagePreview";

/** nga-webrun (the MIS Code Playground's runner core), vendored for PHP pages. */

const src = (p: string) => fs.readFileSync(path.resolve(__dirname, "..", p), "utf8");

describe("nga-webrun", () => {
  it("vendored copy matches its provenance hash (re-sync with nga_central_mis/packages/webrun/sync.mjs)", () => {
    const [, , shaLine, ...rest] = src("vendor/nga-webrun/index.ts").split("\n");
    expect(shaLine).toBe(`// sha256:${crypto.createHash("sha256").update(rest.join("\n")).digest("hex")}`);
  });

  it("a page's images load from the preview's address; links, data and other sites stay", () => {
    const doc = `<img src="img/logo.png"><img src='../a b.jpg'><img src="data:image/png;base64,x"><img src="https://x.test/a.png"><a href="about.php">About</a>`;
    expect(linkAssets(doc, "pages/home.php", "https://api.test/p/tok/")).toBe(
      `<img src="https://api.test/p/tok/pages/img/logo.png"><img src='https://api.test/p/tok/a%20b.jpg'><img src="data:image/png;base64,x"><img src="https://x.test/a.png"><a href="about.php">About</a>`,
    );
  });
});

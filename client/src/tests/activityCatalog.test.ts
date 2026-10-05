import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import catalog from "../activity/tm.catalog.json";
import { _resetActivityForTests, _trackerForTests, initActivity, resolveRoute, type CatalogEntry } from "../vendor/nga-activity";

/**
 * Platform usage analytics (nga_central_mis USAGE_ANALYTICS_IMPLEMENTATION_PLAN.md §5.4):
 * every Task Mentor route must resolve to a named feature, and this copy of the
 * catalog must equal the server's (the one published to MIS on boot).
 */
const src = (p: string) => fs.readFileSync(path.resolve(__dirname, "..", p), "utf8");
const features = (catalog as { features: CatalogEntry[] }).features;

const compiled = () => {
  _resetActivityForTests();
  initActivity({ app: "tm", endpoint: "/x", configUrl: "/x", catalog: features });
  const c = _trackerForTests()!.compiled;
  _resetActivityForTests();
  return c;
};
const concrete = (p: string) => p.replace(/:[A-Za-z]+/g, "123");

describe("Task Mentor activity catalog", () => {
  it("is a byte-for-byte copy of server/src/activity/catalog.json (npm run sync:activity-catalog)", () => {
    expect(src("activity/tm.catalog.json")).toBe(src("../../server/src/activity/catalog.json"));
  });

  it("names every route in App.tsx and routeConfig.tsx", () => {
    const app = [...src("App.tsx").matchAll(/path="([^"]+)"/g)].map((m) => m[1]);
    const config = [...src("routes/routeConfig.tsx").matchAll(/\bpath:\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(app).toEqual(expect.arrayContaining(["/", "/login", "/sso/callback", "/tmcode"]));
    expect(config.length).toBeGreaterThan(40);
    const paths = [...new Set([...app, ...config])].filter((p) => p !== "*");
    const c = compiled();
    const missing = paths.filter((p) => resolveRoute("tm", c, concrete(p)).feature === "tm.other");
    expect(missing).toEqual([]);
  });

  it("resolves each route to its own pattern, not a looser neighbour", () => {
    const c = compiled();
    const cases: Array<[string, string]> = [
      ["/", "tm.landing"],
      ["/quizzes/public", "tm.quizzes"],
      ["/quizzes/12", "tm.quiz"],
      ["/quizzes/12/take", "tm.quiz.take"],
      ["/quiz/9", "tm.quiz.take"],
      ["/quizzes/12/submissions/5", "tm.quiz.submission"],
      ["/assignments/create", "tm.assignment.create"],
      ["/assignments/4", "tm.assignment"],
      ["/courses/3/quizzes/create", "tm.quiz.create"],
      ["/grades/subjects/3/report", "tm.grades.subject_report"],
      ["/grades/7/marks", "tm.grades.marks"],
    ];
    for (const [p, key] of cases) expect([p, resolveRoute("tm", c, p).feature]).toEqual([p, key]);
  });

  it("has unique keys, tm.* names, and patterns only on pages", () => {
    const keys = features.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const f of features) {
      expect(f.key).toMatch(/^tm\.[a-z0-9_.]+$/);
      expect(f.label).toBeTruthy();
      expect(f.module).toBeTruthy();
      expect(!!f.event !== !!f.patterns?.length).toBe(true);
    }
    expect(features.filter((f) => f.public).map((f) => f.key)).toEqual(["tm.landing", "tm.login", "tm.sso_callback", "tm.tmcode_download"]);
  });

  it("every data-track key in the app is a catalogued event", () => {
    const events = new Set(features.filter((f) => f.event).map((f) => f.key));
    const walk = (dir: string): string[] =>
      fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
        const p = path.join(dir, d.name);
        if (d.isDirectory()) return d.name === "vendor" || d.name === "tests" ? [] : walk(p);
        return /\.tsx?$/.test(d.name) ? [p] : [];
      });
    const used = walk(path.resolve(__dirname, "..")).flatMap((f) =>
      [...fs.readFileSync(f, "utf8").matchAll(/data-track="([^"]+)"/g)].map((m) => m[1]),
    );
    expect(used.length).toBeGreaterThanOrEqual(6);
    expect(used.filter((k) => !events.has(k))).toEqual([]);
  });

  it("vendored SDK files match their provenance hash (re-sync with nga_central_mis/packages/activity/sync.mjs)", () => {
    for (const f of ["index.ts", "react.ts"]) {
      const [, , shaLine, ...rest] = src(`vendor/nga-activity/${f}`).split("\n");
      expect(shaLine).toBe(`// sha256:${crypto.createHash("sha256").update(rest.join("\n")).digest("hex")}`);
    }
  });
});

/**
 * E2E: starters from the Runtime Catalog (CODE_RUNNER_PLAN.md phase 2c):
 * Code › Starters, the Playground's catalog starters, and a new project
 * started from a starter. The API is mocked with the real vendored catalog.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect, type Page, type Route } from "@playwright/test";
import { CORS_HEADERS, loginAs } from "./helpers/auth";

const here = path.dirname(fileURLToPath(import.meta.url));
const CATALOG = JSON.parse(fs.readFileSync(path.join(here, "../../server/src/catalog/catalog.json"), "utf8"));
const STARTERS = JSON.parse(fs.readFileSync(path.join(here, "../../server/src/catalog/starters.json"), "utf8")).starters as any[];
const SHOTS = process.env.TMCODE_SHOTS || "test-results/tmcode-shots";
const shot = (page: Page, name: string) => page.screenshot({ path: `${SHOTS}/${test.info().project.name}-${name}.png` });

test.skip(({ browserName }) => browserName === "webkit", "mocked login not supported on WebKit");

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", headers: CORS_HEADERS, body: JSON.stringify(body) });

const RUNNABLE = new Set(["c", "cpp", "java", "python", "javascript", "typescript", "go", "rust"]);
const summary = (s: any) => {
  const { files, ...rest } = s;
  return { ...rest, file_count: files.filter((f: any) => !f.path.startsWith(".nga/")).length, paths: files.map((f: any) => f.path), has_io_tests: files.some((f: any) => f.path === ".nga/tests.json"), has_unit_tests: !!s.tests?.unit };
};

async function setup(page: Page) {
  const calls: { method: string; path: string; body?: any }[] = [];
  await page.route("**/api/**", (r) => (r.request().method() === "OPTIONS" ? r.fulfill({ status: 204, headers: CORS_HEADERS }) : json(r, { success: true, data: [] })));
  await page.addInitScript(() => {
    sessionStorage.setItem("nga.installDismissedThisSession", "1");
    sessionStorage.setItem("nga.installPillHidden", "1");
    for (const k of Object.keys(localStorage)) if (k.startsWith("tm.playground.")) localStorage.removeItem(k);
  });
  await loginAs(page, "student");
  await page.route("**/api/code/catalog", (r) =>
    json(r, { success: true, data: { version: CATALOG.version, languages: CATALOG.languages.map((l: any) => ({ ...l, runnable: l.enabled && RUNNABLE.has(l.key), kinds: [] })) } }),
  );
  await page.route("**/api/code/starters**", (r) => {
    const url = new URL(r.request().url());
    const id = url.pathname.match(/\/starters\/(.+)$/)?.[1];
    if (id) {
      const s = STARTERS.find((x) => x.id === decodeURIComponent(id));
      return s ? json(r, { success: true, data: { ...summary(s), files: s.files } }) : json(r, { success: false }, 404);
    }
    const lang = url.searchParams.get("language");
    const purpose = url.searchParams.get("purpose");
    const enabled = new Set(CATALOG.languages.filter((l: any) => l.enabled).map((l: any) => l.key));
    return json(r, { success: true, data: STARTERS.filter((s) => enabled.has(s.language) && (!lang || s.language === lang) && (!purpose || s.purpose === purpose)).map(summary) });
  });
  await page.route("**/api/code/run", (r) => json(r, { success: true, data: { engine: "tmjudge", language: "java", entry: "Main.java", files_sent: [], compile: null, tests: [{ id: "own", verdict: "ok", passed: null, stdout: "ok\n", stderr: null, time_ms: 5, memory_kb: 1000 }] } }));
  await page.route("**/api/tmcode/**", (r) => {
    const req = r.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/tmcode/, "");
    if (req.method() === "OPTIONS") return r.fulfill({ status: 204, headers: CORS_HEADERS });
    const body = req.method() === "POST" ? req.postDataJSON() : undefined;
    calls.push({ method: req.method(), path: p, body });
    if (p === "/projects" && req.method() === "POST") return json(r, { project: { id: 9, name: body.name, kind: "tm", status: "draft", language: body.language, owner: { id: 201, name: "John" }, my_role: "owner", presence: [], links: [], members: [], events: [], can: { save: true } } }, 201);
    if (p === "/projects/9/blobs/missing") return json(r, { missing: body.sha256 });
    if (/^\/projects\/9\/blobs\//.test(p)) return json(r, { existed: false }, 201);
    if (p === "/projects/9/revisions") return json(r, { revision: { id: 90, number: 1 } }, 201);
    return json(r, { success: true, data: [] });
  });
  return { calls };
}

test("browse starters by language and purpose, preview one, start a project from it", async ({ page }, info) => {
  test.skip(info.project.name === "mobile", "desktop layout");
  await page.setViewportSize({ width: 1440, height: 900 });
  const { calls } = await setup(page);
  page.on("dialog", (d) => d.accept("Banking app"));
  await page.goto("/taskmentor/code/projects");
  await page.getByRole("link", { name: "Starters" }).click();
  await expect(page).toHaveURL(/\/code\/starters$/);
  await expect(page.getByRole("link", { name: "Code", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("starter-card").first()).toBeVisible();

  await page.getByLabel("Language").click();
  await page.getByRole("option", { name: "Java", exact: true }).click();
  await page.getByRole("button", { name: "Project", exact: true }).click();
  const cards = page.getByTestId("starter-card");
  await expect(cards.first()).toContainText("Java");
  await shot(page, "starters");

  await cards.filter({ hasText: /Maven/ }).first().getByRole("button", { name: "Preview" }).click();
  await expect(page.getByTestId("starter-preview")).toContainText("pom.xml");
  await shot(page, "starter-preview");
  await page.getByRole("dialog").getByRole("button", { name: "New project" }).click();

  await expect(page).toHaveURL(/\/code\/projects\/9\/edit$/);
  const create = calls.find((c) => c.method === "POST" && c.path === "/projects");
  expect(create?.body).toMatchObject({ name: "Banking app", kind: "tm", language: "java" });
  const commit = calls.find((c) => c.path === "/projects/9/revisions");
  expect(commit?.body.files.map((f: any) => f.path)).toContain("pom.xml");
  expect(commit?.body.base_revision_id).toBeNull();
});

test("the Playground offers the catalog's starters for each language", async ({ page }, info) => {
  test.skip(info.project.name === "mobile", "desktop layout");
  await page.setViewportSize({ width: 1440, height: 900 });
  await setup(page);
  await page.goto("/taskmentor/code/playground?language=java");
  await page.getByLabel("Starter").click();
  const options = page.getByRole("option");
  expect(await options.count()).toBeGreaterThan(2);
  await options.filter({ hasText: /^Hello/ }).first().click();
  await expect(page).toHaveURL(/starter=/);
  await expect(page.getByTestId("file-tree")).toContainText(".java");
});

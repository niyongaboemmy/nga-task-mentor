/**
 * E2E: a web server project runs in the Preview tab (CODE_RUNNER_PLAN.md
 * phase 5): Run starts it, its output shows while it starts, then the page
 * appears in a sandboxed frame on the separate preview origin. Mocked API.
 */
import { test, expect, type Page, type Route } from "@playwright/test";
import { CORS_HEADERS, loginAs } from "./helpers/auth";

const SHOTS = process.env.TMCODE_SHOTS || "test-results/tmcode-shots";
const shot = (page: Page, name: string) => page.screenshot({ path: `${SHOTS}/${test.info().project.name}-${name}.png` });

test.skip(({ browserName }) => browserName === "webkit", "mocked login not supported on WebKit");
test.beforeEach(({}, info) => test.skip(info.project.name === "mobile", "desktop layout"));

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", headers: CORS_HEADERS, body: JSON.stringify(body) });
const PREVIEW = "https://preview.example.test/p/pv1/1999999999.sig/";
const EXPRESS = [
  { path: "package.json", content: '{"name":"shop","dependencies":{"express":"^4.19.0"}}' },
  { path: "server.js", content: 'const express = require("express");\nconst app = express();\napp.get("/", (q, s) => s.send("<h1>Hello shop</h1>"));\napp.listen(process.env.PORT || 3000);\n' },
];

async function setup(page: Page, previews: boolean) {
  const calls: { method: string; path: string; body?: unknown }[] = [];
  await page.route("**/api/**", (r) => (r.request().method() === "OPTIONS" ? r.fulfill({ status: 204, headers: CORS_HEADERS }) : json(r, { success: true, data: [] })));
  await page.addInitScript((files) => {
    sessionStorage.setItem("nga.installDismissedThisSession", "1");
    sessionStorage.setItem("nga.installPillHidden", "1");
    localStorage.setItem("tm.code.browserRuns", "off");
    localStorage.setItem("tm.playground.javascript", JSON.stringify(files));
  }, EXPRESS);
  await loginAs(page, "student");
  await page.route("**/api/code/capabilities", (r) => json(r, { success: true, data: { interactive: false, pty: false, unit_tests: false, unit_test_languages: [], previews } }));
  await page.route("**/api/code/previews**", (r) => {
    const req = r.request();
    if (req.method() === "OPTIONS") return r.fulfill({ status: 204, headers: CORS_HEADERS });
    const path = new URL(req.url()).pathname.replace(/^.*\/api/, "");
    calls.push({ method: req.method(), path, body: req.method() === "POST" ? req.postDataJSON() : undefined });
    if (path === "/code/previews" && req.method() === "POST") return json(r, { success: true, data: { id: "abc", url: PREVIEW } }, 201);
    if (path.endsWith("/events")) {
      return r.fulfill({
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "text/event-stream" },
        body: 'event: stage\ndata: {"name":"build"}\n\nevent: log\ndata: {"stream":"stdout","data":"npm install… done\\nlistening on 3000\\n"}\n\nevent: ready\ndata: {"path":"/"}\n\n',
      });
    }
    return r.fulfill({ status: 204, headers: CORS_HEADERS });
  });
  await page.route("https://preview.example.test/**", (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<h1>Hello shop</h1>" }));
  return calls;
}

test("Run starts a web server and shows it in the Preview tab", async ({ page }) => {
  const calls = await setup(page, true);
  await page.goto("/taskmentor/code/playground?language=javascript");
  await expect(page.getByTestId("code-editor").locator(".view-lines")).not.toBeEmpty({ timeout: 20_000 });
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(page.getByRole("tab", { name: "Preview" })).toHaveAttribute("aria-selected", "true");
  const frame = page.getByTestId("preview-frame");
  await expect(frame).toHaveAttribute("src", PREVIEW);
  await expect(frame).toHaveAttribute("sandbox", /allow-scripts/);
  await expect(page.frameLocator('[data-testid="preview-frame"]').getByRole("heading", { name: "Hello shop" })).toBeVisible();
  const start = calls.find((c) => c.method === "POST" && c.path === "/code/previews")?.body as { files: { path: string }[] };
  expect(start.files.map((f) => f.path).sort()).toEqual(["package.json", "server.js"]);
  await page.getByRole("button", { name: "Server output" }).click();
  await expect(page.getByTestId("preview-logs")).toContainText("listening on 3000");
  await shot(page, "server-preview");
});

test("no Preview tab when the runner can't run servers", async ({ page }) => {
  await setup(page, false);
  await page.goto("/taskmentor/code/playground?language=javascript");
  await expect(page.getByTestId("code-editor").locator(".view-lines")).not.toBeEmpty({ timeout: 20_000 });
  await expect(page.getByRole("tab", { name: "Preview" })).toHaveCount(0);
});

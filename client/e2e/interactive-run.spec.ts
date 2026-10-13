/**
 * E2E: interactive runs (CODE_RUNNER_PLAN.md phase 4) — the Output tab is a
 * live terminal when the server supports it, and the input box otherwise.
 * Mocked API; screenshots go to $TMCODE_SHOTS.
 */
import { test, expect, type Page, type Route } from "@playwright/test";
import { CORS_HEADERS, loginAs } from "./helpers/auth";

const SHOTS = process.env.TMCODE_SHOTS || "test-results/tmcode-shots";
const shot = (page: Page, name: string) => page.screenshot({ path: `${SHOTS}/${test.info().project.name}-${name}.png` });

test.skip(({ browserName }) => browserName === "webkit", "mocked login not supported on WebKit");

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", headers: CORS_HEADERS, body: JSON.stringify(body) });

const sse = (events: [string, unknown][]) => events.map(([e, d]) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`).join("");

async function setup(page: Page, interactive: boolean) {
  const calls: { method: string; path: string; body?: unknown }[] = [];
  await page.route("**/api/**", (r) => (r.request().method() === "OPTIONS" ? r.fulfill({ status: 204, headers: CORS_HEADERS }) : json(r, { success: true, data: [] })));
  await page.addInitScript(() => {
    sessionStorage.setItem("nga.installDismissedThisSession", "1");
    sessionStorage.setItem("nga.installPillHidden", "1");
    localStorage.setItem("tm.code.browserRuns", "off");
    localStorage.removeItem("tm.playground.python");
  });
  await loginAs(page, "student");
  await page.route("**/api/code/languages", (r) => json(r, { success: true, data: [{ key: "python", label: "Python", engine: "tmjudge" }] }));
  await page.route("**/api/code/capabilities", (r) => json(r, { success: true, data: { interactive } }));
  await page.route("**/api/code/sessions**", (r) => {
    const req = r.request();
    const path = new URL(req.url()).pathname.replace(/^.*\/api/, "");
    if (req.method() === "OPTIONS") return r.fulfill({ status: 204, headers: CORS_HEADERS });
    calls.push({ method: req.method(), path, body: req.method() === "POST" ? req.postDataJSON() : undefined });
    if (path === "/code/sessions" && req.method() === "POST") return json(r, { success: true, data: { id: "abc123" } }, 201);
    if (path.endsWith("/events")) {
      return r.fulfill({
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "text/event-stream" },
        body: sse([
          ["stage", { name: "run" }],
          ["stdout", { data: "What is your name? " }],
          ["stdout", { data: "Hello, Ada!\n" }],
          ["stderr", { data: "warning: demo\n" }],
          ["exit", { code: 0, signal: null, verdict: "ok", time_ms: 41, memory_kb: 8000 }],
        ]),
      });
    }
    return r.fulfill({ status: 204, headers: CORS_HEADERS });
  });
  await page.route("**/api/code/run", (r) => {
    calls.push({ method: "POST", path: "/code/run", body: r.request().postDataJSON() });
    return json(r, { success: true, data: { engine: "tmjudge", language: "python", entry: "main.py", files_sent: ["main.py"], compile: null, tests: [{ id: "own", verdict: "ok", passed: null, stdout: "Batch output\n", stderr: null, exit_code: 0, time_ms: 12, memory_kb: 9000 }] } });
  });
  return calls;
}

test("with interactive runs, Run opens a live terminal", async ({ page }, info) => {
  test.skip(info.project.name === "mobile", "desktop layout");
  const calls = await setup(page, true);
  await page.goto("/taskmentor/code/playground?language=python");
  await expect(page.getByTestId("code-editor").locator(".view-lines")).not.toBeEmpty({ timeout: 20_000 });
  await expect(page.getByTestId("interactive-terminal")).toBeVisible();
  await expect(page.getByTestId("run-stdin")).toHaveCount(0);

  await page.keyboard.press("ControlOrMeta+Enter");
  const out = page.getByTestId("terminal-output");
  await expect(out).toContainText("What is your name? Hello, Ada!");
  await expect(out).toContainText("warning: demo");
  await expect(out.getByTestId("verdict")).toBeVisible();
  await expect(out).toContainText("41 ms");
  expect(calls.some((c) => c.method === "POST" && c.path === "/code/sessions" && (c.body as { files: unknown[] }).files.length > 0)).toBe(true);
  expect(calls.some((c) => c.path === "/code/run")).toBe(false);
  await shot(page, "interactive-terminal");
});

test("the input line sends what you type to the program", async ({ page }, info) => {
  test.skip(info.project.name === "mobile", "desktop layout");
  const calls = await setup(page, true);
  // Keep the stream open so the run stays live while typing.
  await page.route("**/api/code/sessions/*/events", () => new Promise(() => undefined));
  await page.goto("/taskmentor/code/playground?language=python");
  await expect(page.getByTestId("code-editor").locator(".view-lines")).not.toBeEmpty({ timeout: 20_000 });
  await page.getByRole("button", { name: "Run", exact: true }).first().click();
  const input = page.getByTestId("terminal-input");
  await expect(input).toBeEnabled();
  await input.fill("Ada");
  await input.press("Enter");
  await expect(page.getByTestId("terminal-output")).toContainText("Ada");
  await expect.poll(() => calls.find((c) => c.path === "/code/sessions/abc123/input")?.body).toEqual({ data: "Ada\n" });
  await page.getByTestId("terminal-stop").click();
  await expect.poll(() => calls.some((c) => c.method === "DELETE" && c.path === "/code/sessions/abc123")).toBe(true);
});

test("without interactive runs, the input box and batch Run stay", async ({ page }, info) => {
  test.skip(info.project.name === "mobile", "desktop layout");
  const calls = await setup(page, false);
  await page.goto("/taskmentor/code/playground?language=python");
  await expect(page.getByTestId("code-editor").locator(".view-lines")).not.toBeEmpty({ timeout: 20_000 });
  await expect(page.getByTestId("interactive-terminal")).toHaveCount(0);
  await page.getByTestId("run-stdin").fill("2 3");
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(page.getByTestId("run-output")).toHaveText("Batch output");
  expect(calls.some((c) => c.path === "/code/sessions")).toBe(false);
});

/**
 * E2E: practice runs in the browser (CODE_RUNNER_PLAN.md phase 6) — real
 * JavaScript, Python (Pyodide from the CDN) and SQL (sql.js) runs, with the
 * server's /code/run never called. Needs network for the runtimes.
 */
import { test, expect, type Page, type Route } from "@playwright/test";
import { CORS_HEADERS, loginAs } from "./helpers/auth";

const SHOTS = process.env.TMCODE_SHOTS || "test-results/tmcode-shots";
const shot = (page: Page, name: string) => page.screenshot({ path: `${SHOTS}/${test.info().project.name}-${name}.png` });

test.skip(({ browserName }) => browserName === "webkit", "mocked login not supported on WebKit");
test.beforeEach(({}, info) => test.skip(info.project.name === "mobile", "desktop layout"));

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", headers: CORS_HEADERS, body: JSON.stringify(body) });

async function setup(page: Page, drafts: Record<string, { path: string; content: string }[]> = {}) {
  const serverRuns: unknown[] = [];
  await page.route("**/api/**", (r) => (r.request().method() === "OPTIONS" ? r.fulfill({ status: 204, headers: CORS_HEADERS }) : json(r, { success: true, data: [] })));
  await page.addInitScript((d) => {
    sessionStorage.setItem("nga.installDismissedThisSession", "1");
    sessionStorage.setItem("nga.installPillHidden", "1");
    for (const k of Object.keys(localStorage)) if (k.startsWith("tm.playground.")) localStorage.removeItem(k);
    for (const [lang, files] of Object.entries(d)) localStorage.setItem(`tm.playground.${lang}`, JSON.stringify(files));
  }, drafts);
  await loginAs(page, "student");
  await page.route("**/api/code/run", (r) => {
    serverRuns.push(r.request().postDataJSON());
    return json(r, { success: false, message: "should not be called" }, 500);
  });
  return serverRuns;
}

const ready = (page: Page) => expect(page.getByTestId("code-editor").locator(".view-lines")).not.toBeEmpty({ timeout: 20_000 });

test("JavaScript runs in the browser, with input and the tests", async ({ page }) => {
  const serverRuns = await setup(page);
  await page.goto("/taskmentor/code/playground?language=javascript");
  await ready(page);
  await page.getByTestId("run-stdin").fill("2 3");
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(page.getByTestId("run-output")).toHaveText("Sum: 5");
  await expect(page.getByTestId("ran-in-browser")).toBeVisible();
  await page.getByRole("tab", { name: /Tests/ }).click();
  await page.getByRole("button", { name: "Run tests" }).click();
  await expect(page.getByText(/tests passed/)).toBeVisible();
  expect(serverRuns).toHaveLength(0);
});

test("an endless loop is stopped, and the page stays usable", async ({ page }) => {
  test.setTimeout(60_000);
  await setup(page, { javascript: [{ path: "main.js", content: "while (true) {}\n" }] });
  await page.goto("/taskmentor/code/playground?language=javascript");
  await ready(page);
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(page.getByTestId("verdict")).toHaveText(/time limit/i, { timeout: 20_000 });
  await expect(page.getByText("Stopped after 10 s.")).toBeVisible();
});

test("Python runs in the browser (Pyodide)", async ({ page }) => {
  test.setTimeout(150_000);
  const serverRuns = await setup(page, {
    python: [{ path: "main.py", content: 'name = input("Name? ")\nprint(f"Hello, {name}!")\nprint(sum(int(x) for x in input().split()))\n' }],
  });
  await page.goto("/taskmentor/code/playground?language=python");
  await ready(page);
  await page.getByTestId("run-stdin").fill("Ada\n1 2 3");
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(page.getByTestId("run-output")).toHaveText("Name? Hello, Ada!\n6", { timeout: 120_000 });
  await expect(page.getByTestId("ran-in-browser")).toBeVisible();
  await shot(page, "browser-python");

  // A crash shows Python's traceback, pointing at the student's file.
  await page.getByTestId("run-stdin").fill("");
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(page.getByTestId("verdict")).toHaveText("Crashed");
  await expect(page.getByText(/EOFError/)).toBeVisible();
  await expect(page.getByText('File "main.py", line 1')).toBeVisible();
  expect(serverRuns).toHaveLength(0);
});

test("SQL runs in the browser (sql.js) and prints like sqlite3", async ({ page }) => {
  test.setTimeout(90_000);
  await setup(page, {
    sql: [
      { path: "schema.sql", content: "CREATE TABLE students (id INTEGER PRIMARY KEY, name TEXT, class TEXT);" },
      { path: "seed.sql", content: "INSERT INTO students VALUES (1,'Aline','S4A'),(2,'Grace','S4B'),(3,'Jean','S4B');" },
      { path: "main.sql", content: "SELECT name, class FROM students WHERE class = 'S4B' ORDER BY name;" },
    ],
  });
  await page.goto("/taskmentor/code/playground?language=sql");
  await ready(page);
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(page.getByTestId("run-output")).toHaveText(
    "┌───────┬───────┐\n│ name  │ class │\n├───────┼───────┤\n│ Grace │ S4B   │\n│ Jean  │ S4B   │\n└───────┴───────┘",
    { timeout: 60_000 },
  );
  await shot(page, "browser-sql");
});

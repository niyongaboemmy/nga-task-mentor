/**
 * E2E: a project's unit tests in the code workspace (CODE_RUNNER_PLAN.md
 * phase 3): the Tests tab offers them when the runner can run them for the
 * language, and lists each result with failures first. Mocked API.
 */
import { test, expect, type Page, type Route } from "@playwright/test";
import { CORS_HEADERS, loginAs } from "./helpers/auth";

const SHOTS = process.env.TMCODE_SHOTS || "test-results/tmcode-shots";
const shot = (page: Page, name: string) => page.screenshot({ path: `${SHOTS}/${test.info().project.name}-${name}.png` });

test.skip(({ browserName }) => browserName === "webkit", "mocked login not supported on WebKit");
test.beforeEach(({}, info) => test.skip(info.project.name === "mobile", "desktop layout"));

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", headers: CORS_HEADERS, body: JSON.stringify(body) });

const PROJECT = [
  { path: "shop/cart.py", content: "def total(prices):\n    return sum(prices)\n" },
  { path: "tests/test_cart.py", content: "from shop.cart import total\n\ndef test_total():\n    assert total([1, 2]) == 3\n\ndef test_empty():\n    assert total([]) == 1\n" },
];

async function setup(page: Page, unitLanguages: string[]) {
  const sent: unknown[] = [];
  await page.route("**/api/**", (r) => (r.request().method() === "OPTIONS" ? r.fulfill({ status: 204, headers: CORS_HEADERS }) : json(r, { success: true, data: [] })));
  await page.addInitScript((files) => {
    sessionStorage.setItem("nga.installDismissedThisSession", "1");
    sessionStorage.setItem("nga.installPillHidden", "1");
    localStorage.setItem("tm.code.browserRuns", "off");
    localStorage.setItem("tm.playground.python", JSON.stringify(files));
  }, PROJECT);
  await loginAs(page, "student");
  await page.route("**/api/code/capabilities", (r) => json(r, { success: true, data: { interactive: false, unit_tests: unitLanguages.length > 0, unit_test_languages: unitLanguages } }));
  await page.route("**/api/code/test", (r) => {
    sent.push(r.request().postDataJSON());
    return json(r, {
      success: true,
      data: {
        engine: "tmjudge", language: "python", entry: null, kind: "python/project", files_sent: [], compile: null, tests: [], error: null,
        unit: {
          framework: "pytest", verdict: "failed", total: 2, passed: 1, failed: 1, skipped: 0, errors: 0, time_ms: 840, output: "", truncated: false,
          tests: [
            { id: "a", name: "test_total", group: "tests/test_cart.py", file: "tests/test_cart.py", line: 3, status: "passed", durationMs: 2, message: null, details: null },
            { id: "b", name: "test_empty", group: "tests/test_cart.py", file: "tests/test_cart.py", line: 6, status: "failed", durationMs: 1, message: "assert 0 == 1", details: "E   assert 0 == 1\nE    +  where 0 = total([])" },
          ],
        },
      },
    });
  });
  return sent;
}

test("run a project's unit tests from the Tests tab", async ({ page }) => {
  const sent = await setup(page, ["python", "java"]);
  await page.goto("/taskmentor/code/playground?language=python");
  await expect(page.getByTestId("code-editor").locator(".view-lines")).not.toBeEmpty({ timeout: 20_000 });
  await page.getByRole("tab", { name: /Tests/ }).click();
  await page.getByTestId("run-unit-tests").click();
  await expect(page.getByTestId("unit-summary")).toContainText("1 of 2 passed");
  await expect(page.getByTestId("unit-summary")).toContainText("pytest");
  const rows = page.getByTestId("unit-test");
  await expect(rows.first()).toContainText("test_empty");
  await expect(rows.first()).toContainText("assert 0 == 1");
  await expect(rows.first()).toContainText("tests/test_cart.py:6");
  const body = sent[0] as { language: string; files: { path: string }[] };
  expect(body.language).toBe("python");
  expect(body.files.map((f) => f.path).sort()).toEqual(["shop/cart.py", "tests/test_cart.py"]);
  await shot(page, "unit-tests");

  // Ctrl/⌘+Shift+Enter runs them too (no input/output tests here); switching tabs doesn't rerun.
  await page.getByRole("tab", { name: "Output" }).click();
  await page.locator(".monaco-editor .view-lines").first().click();
  await page.keyboard.press("ControlOrMeta+Shift+Enter");
  await expect.poll(() => sent.length).toBe(2);
  await page.getByRole("tab", { name: "Output" }).click();
  await page.getByRole("tab", { name: /Tests/ }).click();
  await page.waitForTimeout(500);
  expect(sent).toHaveLength(2);
});

test("no unit tests section when the runner can't run them", async ({ page }) => {
  await setup(page, []);
  await page.goto("/taskmentor/code/playground?language=python");
  await expect(page.getByTestId("code-editor").locator(".view-lines")).not.toBeEmpty({ timeout: 20_000 });
  await page.getByRole("tab", { name: /Tests/ }).click();
  await expect(page.getByText("This project has no input/output tests.")).toBeVisible();
  await expect(page.getByTestId("unit-tests")).toHaveCount(0);
});

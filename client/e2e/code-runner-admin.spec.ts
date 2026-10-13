/**
 * E2E: Admin → Code runner (CODE_RUNNER_PLAN.md phase 1) against the Vite
 * dev server with a mocked API. Screenshots go to $TMCODE_SHOTS.
 */
import { test, expect, type Page, type Route } from "@playwright/test";
import { CORS_HEADERS, loginAs } from "./helpers/auth";

const SHOTS = process.env.TMCODE_SHOTS || "test-results/tmcode-shots";
const shot = (page: Page, name: string) => page.screenshot({ path: `${SHOTS}/${test.info().project.name}-${name}.png`, fullPage: true });

test.skip(({ browserName }) => browserName === "webkit", "mocked login not supported on WebKit");

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", headers: CORS_HEADERS, body: JSON.stringify(body) });

const STATUS = {
  engine: "tmjudge",
  engines: {
    tmjudge: {
      configured: true,
      url: "http://127.0.0.1:5010",
      reachable: true,
      error: null,
      sandbox: "isolate",
      queue: { running: 1, waiting: 0, concurrency: 2 },
      toolchains: { "python-3": "3.12.3", "node-22": "22.11.0", typescript: "22.11.0", c17: "13.2.0", cpp17: "13.2.0", "java-21": "21.0.5" },
    },
    judge0: { configured: true, role: "fallback", quota: { remaining: 41, limit: 50, header: "submissions", at: new Date().toISOString() } },
  },
  languages: [
    { key: "python", label: "Python", engine: "tmjudge", available: true },
    { key: "javascript", label: "JavaScript", engine: "tmjudge", available: true },
    { key: "java", label: "Java", engine: "tmjudge", available: true },
    { key: "cpp", label: "C++", engine: "tmjudge", available: true },
    { key: "go", label: "Go", engine: "judge0", available: true },
    { key: "swift", label: "Swift", engine: null, available: false },
  ],
  runs: {
    since: new Date(Date.now() - 3600_000).toISOString(),
    window: 40,
    by_outcome: { ok: 38, RUNNER_REJECTED: 2 },
    by_engine: { tmjudge: 39, judge0: 1 },
    by_language: { python: 30, java: 10 },
    duration_ms: { p50: 420, p95: 1800 },
    recent_errors: [
      { at: new Date().toISOString(), engine: "judge0", language: "go", tests: 1, ms: 300, outcome: "RUNNER_REJECTED", message: "The code runner refused the request (access key or subscription)." },
    ],
  },
  checked_at: new Date().toISOString(),
};

async function setup(page: Page) {
  await page.route("**/api/**", (r) => (r.request().method() === "OPTIONS" ? r.fulfill({ status: 204, headers: CORS_HEADERS }) : json(r, { success: true, data: [] })));
  await page.addInitScript(() => {
    sessionStorage.setItem("nga.installDismissedThisSession", "1");
    sessionStorage.setItem("nga.installPillHidden", "1");
  });
  await loginAs(page, "admin");
  await page.route("**/api/code-runner/status", (r) => json(r, { success: true, data: STATUS }));
}

test("an admin sees which engine runs code, its health, languages and recent problems", async ({ page }, info) => {
  test.skip(info.project.name === "mobile", "checked on desktop");
  await page.setViewportSize({ width: 1440, height: 900 });
  await setup(page);
  await page.goto("/taskmentor/dashboard");
  await page.getByRole("link", { name: "Code runner" }).click();
  await expect(page).toHaveURL(/\/admin\/code-runner$/);
  const main = page.getByTestId("code-runner-page");
  await expect(main.getByText("NGA code runner (tm-judge)").first()).toBeVisible();
  await expect(main.getByText("Online")).toBeVisible();
  await expect(main.getByText("Backup")).toBeVisible();
  await expect(main.getByText("95% answered")).toBeVisible();
  await expect(page.getByTestId("runner-language")).toHaveCount(6);
  await expect(page.getByTestId("runner-language").filter({ hasText: "Swift" })).toContainText("Not available");
  await expect(page.getByTestId("runner-error")).toContainText("Refused by the runner");
  // Admins see one "Quizzes" item.
  await expect(page.getByRole("link", { name: "Quizzes", exact: true })).toHaveCount(1);
  await shot(page, "code-runner-admin");
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await page.waitForTimeout(400);
  await shot(page, "code-runner-admin-dark");
});
